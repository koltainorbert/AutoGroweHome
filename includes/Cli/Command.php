<?php
/**
 * WP-CLI commands: `wp agh queue [run] [--seconds=<n>]`, `wp agh status`,
 * `wp agh retention`.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Cli;

use AutoGroweHome\Ai\Providers;
use AutoGroweHome\Generation\JobQueue;
use AutoGroweHome\Privacy\Privacy;

defined( 'ABSPATH' ) || exit;

final class Command {

	/**
	 * Process queued generation jobs.
	 *
	 * ## OPTIONS
	 *
	 * [<action>]
	 * : Optional; the only action is "run" (`wp agh queue run` and `wp agh queue` are equivalent).
	 * ---
	 * default: run
	 * options:
	 *   - run
	 * ---
	 *
	 * [--seconds=<seconds>]
	 * : Time budget. Default 50.
	 *
	 * ## EXAMPLES
	 *
	 *     wp agh queue run --seconds=50
	 *     wp agh queue --seconds=20
	 *
	 * @subcommand queue
	 */
	public function queue( $args, $assoc ) {
		$action = $args[0] ?? 'run';
		if ( 'run' !== $action ) {
			\WP_CLI::error( 'Usage: wp agh queue [run] [--seconds=50]' );
		}
		$n = JobQueue::run( (float) ( $assoc['seconds'] ?? 50 ) );
		\WP_CLI::success( sprintf( '%d job(s) processed, %d pending.', $n, JobQueue::pending_total() ) );
	}

	/**
	 * Show provider and queue status.
	 */
	public function status( $args, $assoc ) {
		$s = Providers::status();
		\WP_CLI::line( 'Image provider: ' . ( $s['image_ready'] ? $s['image_label'] : 'none' ) . ( $s['image_is_test'] ? ' (TEST MODE)' : '' ) );
		\WP_CLI::line( 'Anthropic: ' . ( $s['text_ready'] ? 'configured' : 'not configured (rule-based planner)' ) );
		\WP_CLI::line( 'Pending jobs: ' . JobQueue::pending_total() );
	}

	/**
	 * Run the data retention clean-up now.
	 */
	public function retention( $args, $assoc ) {
		Privacy::retention();
		\WP_CLI::success( 'Retention clean-up finished.' );
	}
}
