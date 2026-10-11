<?php
/**
 * Persistent asynchronous job queue with atomic claiming, priorities,
 * retries, timeouts and stale-lock recovery.
 *
 * Workers run from WP-Cron (every minute), from a loopback spawn right after
 * a request, from status polling (bounded time budget) and from WP-CLI
 * (`wp agh queue run`). None of them blocks page rendering.
 *
 * Locking: a claimed job carries a random lock_token and a lock that outlives
 * the worst-case provider call (see lock_seconds()). complete(), wait() and
 * fail() only touch the row while the caller still owns that token, so a
 * stale worker whose lock expired cannot overwrite a re-claimed job.
 *
 * Concurrency: limits.max_parallel_jobs (> 0) caps the number of jobs that
 * are processed at the same time site-wide, using atomic lease rows in the
 * options table (one per slot, same technique as poll_tick()).
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Generation;

use AutoGroweHome\Installer;
use AutoGroweHome\Projects\Repository;
use AutoGroweHome\RateLimit\RateLimiter;
use AutoGroweHome\Support\Http;
use AutoGroweHome\Support\Logger;
use AutoGroweHome\Support\Settings;
use AutoGroweHome\Support\Util;

defined( 'ABSPATH' ) || exit;

final class JobQueue {

	/** Minimum lock duration in seconds (the effective value is lock_seconds()). */
	public const LOCK_SECONDS = 150;

	/** Option name prefix of the parallel-job lease rows. */
	private const SLOT_PREFIX = 'agh_job_slot_';

	/** Download timeout of upscaled images (Pipeline::upscale()). */
	public const DOWNLOAD_TIMEOUT = 180;

	public static function push( string $type, int $project_id, array $payload = array(), int $priority = 10, int $asset_id = 0, int $delay = 0, int $max_attempts = 3 ): int {
		global $wpdb;
		$now = Util::now();
		$wpdb->insert(
			Installer::table( 'jobs' ),
			array(
				'project_id'   => $project_id,
				'asset_id'     => $asset_id,
				'type'         => $type,
				'payload'      => Util::json( $payload ),
				'status'       => 'queued',
				'priority'     => max( 0, min( 255, $priority ) ),
				'attempts'     => 0,
				'max_attempts' => max( 1, $max_attempts ),
				'run_after'    => gmdate( 'Y-m-d H:i:s', time() + $delay ),
				'created_at'   => $now,
				'updated_at'   => $now,
			)
		);
		return (int) $wpdb->insert_id;
	}

	/**
	 * Lock duration derived from the configured provider timeouts/retries so a
	 * lock never expires while its worker is still inside a provider call.
	 *
	 * Worst case of one job = the longer of
	 *  - one Anthropic call (anthropic.timeout × (retries+1) + back-off), and
	 *  - one Magnific call with the longest timeout used (90 s, upscaler) ×
	 *    (magnific.retries+1) + back-off, followed by an image download
	 *    (DOWNLOAD_TIMEOUT),
	 * plus a 60 s margin for local work (drawings, previews, DB).
	 */
	public static function lock_seconds(): int {
		$anthropic = Http::worst_case_seconds( max( 1, (int) Settings::get( 'anthropic.timeout', 90 ) ), max( 0, (int) Settings::get( 'anthropic.retries', 2 ) ) );
		$magnific  = Http::worst_case_seconds( 90, max( 0, (int) Settings::get( 'magnific.retries', 2 ) ) ) + self::DOWNLOAD_TIMEOUT;
		return (int) max( self::LOCK_SECONDS, max( $anthropic, $magnific ) + 60 );
	}

	/**
	 * Claim up to $limit runnable jobs atomically.
	 */
	public static function claim( int $limit = 1, ?int $project_id = null ): array {
		global $wpdb;
		$t     = Installer::table( 'jobs' );
		$now   = Util::now();
		$where = "status IN ('queued','waiting','running') AND run_after <= %s AND (locked_until IS NULL OR locked_until < %s)";
		$args  = array( $now, $now );
		if ( null !== $project_id ) {
			$where .= ' AND project_id = %d';
			$args[] = $project_id;
		}
		$args[] = $limit * 3;
		$ids    = $wpdb->get_col( $wpdb->prepare( "SELECT id FROM {$t} WHERE {$where} ORDER BY priority ASC, id ASC LIMIT %d", $args ) ); // phpcs:ignore
		$out    = array();
		$lock   = self::lock_seconds();
		foreach ( (array) $ids as $id ) {
			if ( count( $out ) >= $limit ) {
				break;
			}
			$token    = wp_generate_password( 32, false, false );
			$affected = $wpdb->query(
				$wpdb->prepare(
					"UPDATE {$t} SET status = 'running', lock_token = %s, locked_until = %s, attempts = attempts + 1, started_at = COALESCE(started_at, %s), updated_at = %s WHERE id = %d AND status IN ('queued','waiting','running') AND (locked_until IS NULL OR locked_until < %s)", // phpcs:ignore
					$token,
					Util::gmt_after( $lock ),
					$now,
					$now,
					(int) $id,
					$now
				)
			);
			if ( 1 === (int) $affected ) {
				$job = self::get( (int) $id );
				if ( $job && $job['lock_token'] === $token ) {
					$out[] = $job;
				}
			}
		}
		return $out;
	}

	public static function get( int $id ): ?array {
		global $wpdb;
		$t   = Installer::table( 'jobs' );
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore
		if ( ! $row ) {
			return null;
		}
		$row['id']         = (int) $row['id'];
		$row['project_id'] = (int) $row['project_id'];
		$row['asset_id']   = (int) $row['asset_id'];
		$row['attempts']   = (int) $row['attempts'];
		$row['max_attempts'] = (int) $row['max_attempts'];
		$row['payload']    = Util::decode( $row['payload'] );
		return $row;
	}

	/**
	 * @return bool False when the caller no longer owns the job (stale worker).
	 */
	public static function complete( array $job ): bool {
		return self::set_owned( $job, array( 'status' => 'done', 'locked_until' => null, 'lock_token' => '' ) );
	}

	/**
	 * Re-schedule a polling job without consuming an attempt.
	 *
	 * @return bool False when the caller no longer owns the job (stale worker).
	 */
	public static function wait( array $job, int $seconds, array $payload = array() ): bool {
		global $wpdb;
		$t   = Installer::table( 'jobs' );
		$sql = "UPDATE {$t} SET status = 'waiting', run_after = %s, locked_until = NULL, lock_token = '', attempts = CASE WHEN attempts > 0 THEN attempts - 1 ELSE 0 END, payload = %s, updated_at = %s WHERE id = %d";
		$arg = array( Util::gmt_after( $seconds ), Util::json( array_merge( (array) $job['payload'], $payload ) ), Util::now(), $job['id'] );
		if ( array_key_exists( 'lock_token', $job ) ) {
			$sql  .= ' AND lock_token = %s';
			$arg[] = (string) $job['lock_token'];
		}
		$ok = 1 === (int) $wpdb->query( $wpdb->prepare( $sql, $arg ) ); // phpcs:ignore
		if ( ! $ok ) {
			self::stale( $job, 'wait' );
		}
		return $ok;
	}

	/**
	 * @return bool True when the job will be retried – or when it is no longer
	 *              owned by this worker (stale lock: another worker re-claimed
	 *              it, so the caller must not finalise anything).
	 */
	public static function fail( array $job, string $error, bool $retryable = true ): bool {
		$retry = $retryable && $job['attempts'] < $job['max_attempts'];
		$owned = self::set_owned(
			$job,
			array(
				'status'       => $retry ? 'queued' : 'failed',
				'run_after'    => Util::gmt_after( $retry ? min( 300, 15 * ( 2 ** max( 0, $job['attempts'] - 1 ) ) ) : 0 ),
				'locked_until' => null,
				'lock_token'   => '',
				'last_error'   => substr( $error, 0, 2000 ),
			)
		);
		if ( ! $owned ) {
			return true;
		}
		if ( ! $retry ) {
			Logger::error( 'queue', 'Job failed permanently: ' . $job['type'], array( 'job' => $job['id'], 'error' => $error ), $job['project_id'] );
		}
		return $retry;
	}

	/**
	 * Atomic update of a job row that only succeeds while the caller still
	 * holds the lock token it received from claim(). Job arrays without a
	 * lock_token key (built by hand, not claimed) fall back to id-only updates.
	 */
	private static function set_owned( array $job, array $data ): bool {
		global $wpdb;
		$data['updated_at'] = Util::now();
		$where              = array( 'id' => (int) $job['id'] );
		if ( array_key_exists( 'lock_token', $job ) ) {
			$where['lock_token'] = (string) $job['lock_token'];
		}
		$ok = 1 === (int) $wpdb->update( Installer::table( 'jobs' ), $data, $where );
		if ( ! $ok ) {
			self::stale( $job, (string) ( $data['status'] ?? 'update' ) );
		}
		return $ok;
	}

	private static function stale( array $job, string $op ): void {
		Logger::warning( 'queue', 'Stale worker: job lock lost, update skipped', array( 'job' => $job['id'] ?? 0, 'type' => $job['type'] ?? '', 'op' => $op ), (int) ( $job['project_id'] ?? 0 ) );
	}

	public static function nudge_asset( int $asset_id ): void {
		global $wpdb;
		$t = Installer::table( 'jobs' );
		$wpdb->query( $wpdb->prepare( "UPDATE {$t} SET run_after = %s WHERE asset_id = %d AND status = 'waiting'", Util::now(), $asset_id ) ); // phpcs:ignore
	}

	/**
	 * Cancel the pending work of a project.
	 *
	 * - queued/waiting jobs → cancelled (a job currently being processed keeps
	 *   running; the pipeline re-checks the project/asset state afterwards);
	 * - render assets whose job was cancelled (queued or polling) → cancelled,
	 *   so progress totals and stage states can finish; a cancelled
	 *   single-concept rebuild gives back its own reserved unit when its image
	 *   cost nothing;
	 * - a project that has not finished planning (status queued/planning) →
	 *   status "cancelled" (it is then never finalised as ready/partial and
	 *   agh_concepts_finished does not fire);
	 * - the project's daily generation unit is given back – once – when the
	 *   project cost nothing so far (Pipeline::cost_free(): no ledger cost, no
	 *   produced image) and no job of it is being processed right now. This
	 *   also covers a cancel during rendering.
	 *
	 * @return int Number of cancelled jobs.
	 */
	public static function cancel_project( int $project_id ): int {
		global $wpdb;
		$t    = Installer::table( 'jobs' );
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT id, type, asset_id FROM {$t} WHERE project_id = %d AND status IN ('queued','waiting')", $project_id ), ARRAY_A ) ?: array(); // phpcs:ignore
		$n    = 0;
		foreach ( $rows as $row ) {
			// Per job, so a job claimed by a worker in the meantime is left alone.
			$won = $wpdb->query( $wpdb->prepare( "UPDATE {$t} SET status = 'cancelled', locked_until = NULL, updated_at = %s WHERE id = %d AND status IN ('queued','waiting')", Util::now(), (int) $row['id'] ) ); // phpcs:ignore
			if ( 1 !== (int) $won ) {
				continue;
			}
			$n++;
			if ( 'render' === $row['type'] && (int) $row['asset_id'] > 0 ) {
				$a = Repository::asset( (int) $row['asset_id'] );
				if ( $a && in_array( $a['status'], array( 'queued', 'running' ), true ) ) {
					Repository::update_asset( (int) $a['id'], array( 'status' => 'cancelled' ) );
				}
				if ( $a && Pipeline::asset_cost_free( (int) $a['id'] ) ) {
					self::refund_job_once( (int) $row['id'] ); // only jobs that reserved a unit (rebuilds).
				}
			}
		}
		$p = Repository::project_by_id( $project_id );
		if ( $p && in_array( $p['status'], array( 'queued', 'planning' ), true ) ) {
			Repository::update_project( $project_id, array( 'status' => 'cancelled', 'stage' => 'done' ) );
		}
		$busy = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$t} WHERE project_id = %d AND status = 'running' AND locked_until >= %s", $project_id, Util::now() ) ); // phpcs:ignore
		if ( $p && 0 === $busy && Pipeline::cost_free( $project_id ) ) {
			self::refund_project_once( $project_id );
		}
		return $n;
	}

	/**
	 * Give back the daily-quota units a job reserved (payload "reserved") – at
	 * most once: the payload is atomically marked "refunded" first.
	 *
	 * @return bool True when units were released by this call.
	 */
	public static function refund_job_once( int $job_id ): bool {
		global $wpdb;
		$t   = Installer::table( 'jobs' );
		$raw = (string) $wpdb->get_var( $wpdb->prepare( "SELECT payload FROM {$t} WHERE id = %d", $job_id ) ); // phpcs:ignore
		$d   = Util::decode( $raw );
		if ( empty( $d['reserved'] ) || ! empty( $d['refunded'] ) ) {
			return false;
		}
		$d['refunded'] = Util::now();
		$won           = $wpdb->query( $wpdb->prepare( "UPDATE {$t} SET payload = %s WHERE id = %d AND payload = %s", Util::json( $d ), $job_id, $raw ) ); // phpcs:ignore
		if ( 1 !== (int) $won ) {
			return false;
		}
		RateLimiter::release( (array) $d['reserved'] );
		return true;
	}

	/**
	 * Give back the generation unit of a project (reserved by its plan job) –
	 * at most once per project.
	 */
	public static function refund_project_once( int $project_id ): bool {
		global $wpdb;
		$t  = Installer::table( 'jobs' );
		$id = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$t} WHERE project_id = %d AND type = 'plan' ORDER BY id ASC LIMIT 1", $project_id ) ); // phpcs:ignore
		return $id > 0 && self::refund_job_once( $id );
	}

	/**
	 * Daily-quota units reserved by the request that created the project
	 * (empty once they were given back).
	 */
	public static function reserved_for( int $project_id ): array {
		global $wpdb;
		$t   = Installer::table( 'jobs' );
		$row = $wpdb->get_var( $wpdb->prepare( "SELECT payload FROM {$t} WHERE project_id = %d AND type = 'plan' ORDER BY id ASC LIMIT 1", $project_id ) ); // phpcs:ignore
		$d   = Util::decode( (string) $row );
		return empty( $d['refunded'] ) ? (array) ( $d['reserved'] ?? array() ) : array();
	}

	public static function counts( int $project_id ): array {
		global $wpdb;
		$t    = Installer::table( 'jobs' );
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT status, COUNT(*) AS n FROM {$t} WHERE project_id = %d GROUP BY status", $project_id ), ARRAY_A ) ?: array(); // phpcs:ignore
		$out  = array();
		foreach ( $rows as $r ) {
			$out[ $r['status'] ] = (int) $r['n'];
		}
		return $out;
	}

	public static function pending_total(): int {
		global $wpdb;
		$t = Installer::table( 'jobs' );
		return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$t} WHERE status IN ('queued','waiting','running')" ); // phpcs:ignore
	}

	/**
	 * Queue work piggy-backed on status polling (hosts without working cron).
	 *
	 * Throttled site-wide with an atomic lease on one option row:
	 *  - at most one tick runs at a time: the winner holds the lease for its
	 *    time budget ($seconds);
	 *  - when the tick ends, the lease is released with the finishing time, so
	 *    the next tick can start ~5 s (5–6 s, whole seconds) after the previous
	 *    one FINISHED;
	 *  - if a tick dies (or one job overruns the budget), the lease expires
	 *    5 s after the budget ($seconds + 5 s from its start).
	 * Many polling visitors therefore cannot multiply the work.
	 */
	public static function poll_tick( float $seconds = 8.0 ): int {
		global $wpdb;
		$key   = 'agh_poll_tick';
		$now   = time();
		$lease = sprintf( '%d.%06d', $now + (int) ceil( $seconds ), random_int( 0, 999999 ) );
		$wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, %s, 'no')", $key, '0' ) ); // phpcs:ignore
		$won = $wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->options} SET option_value = %s WHERE option_name = %s AND ( option_value + 0 ) < %d", $lease, $key, $now - 5 ) ); // phpcs:ignore
		if ( 1 !== (int) $won ) {
			return 0;
		}
		wp_cache_delete( $key, 'options' );
		try {
			return self::run( $seconds );
		} finally {
			// Release: the next tick may start 5 s after this one finished.
			$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->options} SET option_value = %s WHERE option_name = %s AND option_value = %s", (string) time(), $key, $lease ) ); // phpcs:ignore
			wp_cache_delete( $key, 'options' );
		}
	}

	/**
	 * Acquire one of the limits.max_parallel_jobs lease slots.
	 *
	 * @return string|null Lease value to release later, '' when the limit is
	 *                     disabled (≤ 0), null when all slots are busy.
	 */
	public static function acquire_slot(): ?string {
		global $wpdb;
		$max = (int) Settings::get( 'limits.max_parallel_jobs', 4 );
		if ( $max <= 0 ) {
			return '';
		}
		$now  = time();
		$lock = self::lock_seconds();
		for ( $i = 0; $i < $max; $i++ ) {
			$key   = self::SLOT_PREFIX . $i;
			$lease = sprintf( '%d.%06d', $now + $lock, random_int( 0, 999999 ) );
			$wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, %s, 'no')", $key, '0' ) ); // phpcs:ignore
			$won = $wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->options} SET option_value = %s WHERE option_name = %s AND ( option_value + 0 ) < %d", $lease, $key, $now ) ); // phpcs:ignore
			if ( 1 === (int) $won ) {
				wp_cache_delete( $key, 'options' );
				return $key . '|' . $lease;
			}
		}
		return null;
	}

	public static function release_slot( ?string $slot ): void {
		global $wpdb;
		if ( null === $slot || '' === $slot ) {
			return;
		}
		list( $key, $lease ) = array_pad( explode( '|', $slot, 2 ), 2, '' );
		// Only release our own lease (it may have expired and been taken over).
		$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->options} SET option_value = '0' WHERE option_name = %s AND option_value = %s", $key, $lease ) ); // phpcs:ignore
		wp_cache_delete( $key, 'options' );
	}

	/**
	 * Process jobs until the time budget is used.
	 *
	 * @return int Number of processed jobs.
	 */
	public static function run( float $seconds = 20.0, ?int $project_id = null ): int {
		$deadline = microtime( true ) + $seconds;
		$n        = 0;
		while ( microtime( true ) < $deadline ) {
			$slot = self::acquire_slot();
			if ( null === $slot ) {
				break; // Site-wide parallel limit reached; other workers are busy.
			}
			$jobs = self::claim( 1, $project_id );
			if ( empty( $jobs ) ) {
				self::release_slot( $slot );
				break;
			}
			try {
				foreach ( $jobs as $job ) {
					try {
						Pipeline::handle( $job );
					} catch ( \Throwable $e ) {
						Logger::error( 'queue', 'Job exception: ' . $e->getMessage(), array( 'job' => $job['id'], 'file' => basename( $e->getFile() ) . ':' . $e->getLine() ), $job['project_id'] );
						self::fail( $job, $e->getMessage(), true );
					}
					$n++;
				}
			} finally {
				self::release_slot( $slot );
			}
		}
		return $n;
	}

	/**
	 * Fire a non-blocking loopback request that runs the queue (like spawn_cron()).
	 */
	public static function spawn(): void {
		if ( ! wp_next_scheduled( 'agh_process_queue_now' ) ) {
			wp_schedule_single_event( time(), 'agh_process_queue_now' );
		}
		if ( function_exists( 'spawn_cron' ) && ! ( defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON ) ) {
			spawn_cron();
		}
	}

	public static function cleanup( int $days = 14 ): void {
		global $wpdb;
		$t = Installer::table( 'jobs' );
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$t} WHERE status IN ('done','failed','cancelled') AND updated_at < %s", gmdate( 'Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS ) ) ); // phpcs:ignore
	}
}
