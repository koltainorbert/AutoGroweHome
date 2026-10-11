<?php
/**
 * Quote request: validation, separate consents with versioned documents,
 * consent log, contractor package + notification jobs.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Quote;

use AutoGroweHome\Frontend\I18n;
use AutoGroweHome\Generation\JobQueue;
use AutoGroweHome\Installer;
use AutoGroweHome\License\Features;
use AutoGroweHome\Mail\Mailer;
use AutoGroweHome\Projects\Repository;
use AutoGroweHome\RateLimit\RateLimiter;
use AutoGroweHome\Stats\Stats;
use AutoGroweHome\Support\Ip;
use AutoGroweHome\Support\Logger;
use AutoGroweHome\Support\Settings;
use AutoGroweHome\Support\Util;

defined( 'ABSPATH' ) || exit;

final class QuoteService {

	/** Quote form token (shared contract 2): minimum and maximum age in seconds. */
	public const FORM_MIN_SECONDS = 3;
	public const FORM_MAX_SECONDS = 7200;

	/** Package job: wait for the selected concept's gallery at most this long. */
	public const PACKAGE_MAX_WAIT  = 1200;
	public const PACKAGE_WAIT_STEP = 30;

	/**
	 * Consent definitions currently in force (versioned via Admin → Jogi és GDPR).
	 */
	public static function consents(): array {
		$terms_url = (string) Settings::get( 'legal.terms_url', '' );
		$out       = array();
		if ( Settings::get( 'legal.terms_required', true ) && '' !== $terms_url ) {
			$out['terms'] = array(
				'required' => true,
				'label'    => __( 'Megismertem és elfogadom az Általános Szerződési Feltételeket.', 'autogrowehome' ),
				'url'      => $terms_url,
				'version'  => (string) Settings::get( 'legal.terms_version', '1.0' ),
			);
		}
		$out['privacy'] = array(
			'required' => true,
			'label'    => __( 'Megismertem az adatkezelési tájékoztatót.', 'autogrowehome' ),
			'url'      => (string) Settings::get( 'legal.privacy_url', '' ),
			'version'  => (string) Settings::get( 'legal.privacy_version', '1.0' ),
		);
		$contact        = (string) Settings::get( 'legal.contact_text', '' );
		$out['contact'] = array(
			'required' => true,
			'label'    => '' !== $contact ? $contact : __( 'Hozzájárulok, hogy a tervcsomagomat és az elérhetőségeimet az ajánlat elkészítése céljából továbbítsák a kivitelezőnek, aki ezzel kapcsolatban felveheti velem a kapcsolatot.', 'autogrowehome' ),
			'url'      => (string) Settings::get( 'legal.privacy_url', '' ),
			'version'  => (string) Settings::get( 'legal.privacy_version', '1.0' ),
		);
		if ( Settings::get( 'legal.marketing_enabled', true ) ) {
			$mk               = (string) Settings::get( 'legal.marketing_text', '' );
			$out['marketing'] = array(
				'required' => false,
				'label'    => '' !== $mk ? $mk : __( 'Opcionális: hozzájárulok, hogy a jövőben marketingcélú ajánlatokat küldjenek nekem. Ez nem feltétele az ajánlatkérésnek, és bármikor visszavonható.', 'autogrowehome' ),
				'url'      => (string) Settings::get( 'legal.privacy_url', '' ),
				'version'  => (string) Settings::get( 'legal.privacy_version', '1.0' ),
			);
		}
		return $out;
	}

	/**
	 * @return array{ok:bool,errors:array,quote?:array}
	 */
	public static function submit( array $project, array $raw ): array {
		$errors = array();
		// Spam protection: honeypot + server-signed form timestamp (GET
		// /projects/{id}/quote-token). The former client-side "started" value
		// is ignored – it could be set to anything.
		if ( ! empty( $raw['website'] ) ) {
			return array( 'ok' => false, 'errors' => array( '_form' => __( 'A kérés nem dolgozható fel.', 'autogrowehome' ) ) );
		}
		$token_error = self::check_form_token( (string) $project['uuid'], $raw['form_token'] ?? '' );
		if ( '' !== $token_error ) {
			return array( 'ok' => false, 'errors' => array( 'form_token' => $token_error ) );
		}

		$concept = null;
		if ( ! empty( $raw['concept'] ) ) {
			$concept = Repository::concept_by_uuid( (string) $raw['concept'] );
		} elseif ( $project['selected_concept_id'] ) {
			$concept = Repository::concept( $project['selected_concept_id'] );
		}
		if ( ! $concept || (int) $concept['project_id'] !== (int) $project['id'] ) {
			$errors['concept'] = __( 'Válassz ki egy házváltozatot.', 'autogrowehome' );
		}

		$name  = Util::clean_text( $raw['full_name'] ?? '', 120 );
		$email = sanitize_email( (string) ( $raw['email'] ?? '' ) );
		$phone = preg_replace( '/[^0-9+\s\-()\/]/', '', (string) ( $raw['phone'] ?? '' ) );
		$city  = Util::clean_text( $raw['city'] ?? '', 120 );
		if ( mb_strlen( $name ) < 3 ) {
			$errors['full_name'] = __( 'Add meg a teljes neved.', 'autogrowehome' );
		}
		if ( ! is_email( $email ) ) {
			$errors['email'] = __( 'Érvénytelen e-mail-cím.', 'autogrowehome' );
		}
		if ( strlen( preg_replace( '/\D/', '', $phone ) ) < 7 ) {
			$errors['phone'] = __( 'Érvénytelen telefonszám.', 'autogrowehome' );
		}
		if ( '' === $city ) {
			$errors['city'] = __( 'Add meg a települést.', 'autogrowehome' );
		}
		$given = array();
		foreach ( self::consents() as $key => $def ) {
			$val           = isset( $raw['consents'][ $key ] ) && true === filter_var( $raw['consents'][ $key ], FILTER_VALIDATE_BOOLEAN );
			$given[ $key ] = $val;
			if ( $def['required'] && ! $val ) {
				$errors[ 'consent_' . $key ] = __( 'Ez a hozzájárulás szükséges az ajánlatkéréshez.', 'autogrowehome' );
			}
		}
		if ( ! empty( $errors ) ) {
			return array( 'ok' => false, 'errors' => $errors );
		}

		$rl = RateLimiter::reserve_custom( Ip::hash(), 'quote', 5 );
		if ( ! $rl ) {
			return array( 'ok' => false, 'errors' => array( '_form' => __( 'Ma már túl sok ajánlatkérést küldtél erről a címről.', 'autogrowehome' ) ) );
		}

		global $wpdb;
		$uuid = Util::uuid();
		$now  = Util::now();
		$wpdb->insert(
			Installer::table( 'quotes' ),
			array(
				'uuid'          => $uuid,
				'project_id'    => $project['id'],
				'concept_id'    => $concept['id'],
				'full_name'     => $name,
				'email'         => $email,
				'phone'         => substr( trim( $phone ), 0, 60 ),
				'city'          => $city,
				'site_location' => Util::clean_text( $raw['site_location'] ?? '', 190 ),
				'start_period'  => Util::clean_text( $raw['start_period'] ?? '', 60 ),
				'budget'        => Util::clean_text( $raw['budget'] ?? '', 60 ),
				'note'          => Util::clean_text( $raw['note'] ?? '', 2000 ),
				'lang'          => substr( (string) apply_filters( 'plugin_locale', determine_locale(), 'autogrowehome' ), 0, 12 ),
				'status'        => 'pending',
				'created_at'    => $now,
				'updated_at'    => $now,
			)
		);
		$quote_id = (int) $wpdb->insert_id;
		$ip_hash  = Ip::hash();
		// Optional evidence: the visitor's browser user agent, stored only when
		// the setting legal.store_user_agent is on (wp-admin → AutoGroweHome →
		// Jogi és GDPR, admin.php?page=agh-legal; default off).
		// Exported by the GDPR exporter, cleared on anonymisation.
		$ua = Settings::get( 'legal.store_user_agent', false ) && isset( $_SERVER['HTTP_USER_AGENT'] ) ? substr( sanitize_text_field( wp_unslash( (string) $_SERVER['HTTP_USER_AGENT'] ) ), 0, 255 ) : '';
		foreach ( self::consents() as $key => $def ) {
			$wpdb->insert(
				Installer::table( 'consents' ),
				array(
					'quote_id'     => $quote_id,
					'project_id'   => $project['id'],
					'consent_type' => $key,
					'granted'      => $given[ $key ] ? 1 : 0,
					'doc_version'  => $def['version'],
					'doc_url'      => esc_url_raw( $def['url'] ),
					'event'        => 'given',
					'ip_hash'      => $ip_hash,
					'user_agent'   => $ua,
					'created_at'   => $now,
				)
			);
		}
		Repository::update_project( $project['id'], array( 'saved' => 1, 'selected_concept_id' => $concept['id'] ) );
		JobQueue::push( 'package', $project['id'], array( 'quote' => $quote_id ), 3, 0, 0, 3 );
		JobQueue::spawn();
		Stats::inc( 'quote_submitted' );
		$quote = self::get( $quote_id );
		/**
		 * Fires after a quote request and its consents were stored (before the
		 * contractor package is built). Useful for CRM integrations.
		 *
		 * @param array $quote   Stored quote row.
		 * @param array $project Project row.
		 */
		do_action( 'agh_quote_submitted', $quote, $project );
		return array( 'ok' => true, 'errors' => array(), 'quote' => $quote );
	}

	/**
	 * "<unix ts>.<hmac>" bound to the project; see check_form_token().
	 */
	public static function form_token( string $project_uuid, ?int $ts = null ): string {
		$ts = $ts ?? time();
		return $ts . '.' . self::form_hmac( $project_uuid, $ts );
	}

	private static function form_hmac( string $project_uuid, int $ts ): string {
		return hash_hmac( 'sha256', 'agh-quote-form|' . strtolower( $project_uuid ) . '|' . $ts, wp_salt( 'nonce' ) );
	}

	/**
	 * @param mixed $token Submitted form_token.
	 * @return string '' when valid, otherwise the error shown on the form
	 *                (missing, forged or other project, < 3 s or > 2 h old).
	 */
	public static function check_form_token( string $project_uuid, $token ): string {
		$token = is_string( $token ) ? trim( $token ) : '';
		if ( ! preg_match( '/^(\d{9,11})\.([a-f0-9]{64})$/', $token, $m ) || ! hash_equals( self::form_hmac( $project_uuid, (int) $m[1] ), $m[2] ) ) {
			return __( 'Az űrlap munkamenete érvénytelen vagy lejárt. Kérjük, nyisd meg újra az ajánlatkérő űrlapot.', 'autogrowehome' );
		}
		$age = time() - (int) $m[1];
		if ( $age < self::FORM_MIN_SECONDS ) {
			return __( 'Túl gyors beküldés. Kérjük, próbáld újra.', 'autogrowehome' );
		}
		if ( $age > self::FORM_MAX_SECONDS ) {
			return __( 'Az űrlap munkamenete érvénytelen vagy lejárt. Kérjük, nyisd meg újra az ajánlatkérő űrlapot.', 'autogrowehome' );
		}
		return '';
	}

	public static function get( int $id ): ?array {
		global $wpdb;
		$t = Installer::table( 'quotes' );
		$r = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore
		return $r ?: null;
	}

	public static function get_by_uuid( string $uuid ): ?array {
		if ( ! Util::is_uuid( $uuid ) ) {
			return null;
		}
		global $wpdb;
		$t = Installer::table( 'quotes' );
		$r = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE uuid = %s", $uuid ), ARRAY_A ); // phpcs:ignore
		return $r ?: null;
	}

	public static function update( int $id, array $data ): void {
		global $wpdb;
		$data['updated_at'] = Util::now();
		$wpdb->update( Installer::table( 'quotes' ), $data, array( 'id' => $id ) );
	}

	/**
	 * Consent / forwarding log of a quote. The user agent (stored only when
	 * legal.store_user_agent is on – Jogi és GDPR admin page) is left out
	 * unless asked for, so it never reaches the contractor package or portal.
	 */
	public static function consent_log( int $quote_id, bool $with_user_agent = false ): array {
		global $wpdb;
		$t    = Installer::table( 'consents' );
		$cols = 'consent_type, granted, doc_version, doc_url, event, created_at' . ( $with_user_agent ? ', user_agent' : '' );
		return $wpdb->get_results( $wpdb->prepare( "SELECT {$cols} FROM {$t} WHERE quote_id = %d ORDER BY id", $quote_id ), ARRAY_A ) ?: array(); // phpcs:ignore
	}

	public static function list( array $args ): array {
		global $wpdb;
		$t     = Installer::table( 'quotes' );
		$per   = max( 1, min( 100, (int) ( $args['per_page'] ?? 20 ) ) );
		$page  = max( 1, (int) ( $args['page'] ?? 1 ) );
		$total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$t}" ); // phpcs:ignore
		$rows  = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$t} ORDER BY id DESC LIMIT %d OFFSET %d", $per, ( $page - 1 ) * $per ), ARRAY_A ) ?: array(); // phpcs:ignore
		return array( 'items' => $rows, 'total' => $total, 'pages' => (int) ceil( $total / $per ) );
	}

	/**
	 * Queue job handler: build package, then notify.
	 */
	public static function handle_job( array $job ): void {
		$quote = self::get( (int) ( $job['payload']['quote'] ?? 0 ) );
		if ( ! $quote || ! empty( $quote['anonymized'] ) ) {
			JobQueue::complete( $job );
			return;
		}
		if ( 'package' === $job['type'] ) {
			// The package job is queued right after the quote (priority 3), before
			// the gallery renders (priority 6–7): wait (without using attempts)
			// while the selected concept's images are still being produced, at
			// most PACKAGE_MAX_WAIT; then build with what is final – the package
			// readme lists the missing items.
			$since = (int) ( $job['payload']['wait_since'] ?? 0 );
			$since = $since > 0 ? $since : time();
			if ( time() - $since < self::PACKAGE_MAX_WAIT && self::gallery_busy( $quote ) ) {
				JobQueue::wait( $job, self::PACKAGE_WAIT_STEP, array( 'wait_since' => $since ) );
				return;
			}
			try {
				$rel = PackageBuilder::build( $quote );
				self::update( (int) $quote['id'], array( 'package_path' => $rel ) );
				JobQueue::complete( $job );
				JobQueue::push( 'notify', (int) $quote['project_id'], array( 'quote' => (int) $quote['id'] ), 3, 0, 0, 4 );
			} catch ( \Throwable $e ) {
				Logger::error( 'package', $e->getMessage(), array( 'quote' => $quote['uuid'] ), (int) $quote['project_id'] );
				if ( ! JobQueue::fail( $job, $e->getMessage(), true ) ) {
					// Notify anyway (without package) so the request is not lost.
					JobQueue::push( 'notify', (int) $quote['project_id'], array( 'quote' => (int) $quote['id'] ), 3, 0, 0, 4 );
				}
			}
			return;
		}
		// notify. The job id identifies the notification round: a retry of the
		// same job only re-sends to the recipients that failed before; a new
		// notify job (e.g. admin "resend") sends to everybody again.
		$ok = self::notify( $quote, (int) $job['id'] );
		if ( $ok ) {
			self::update( (int) $quote['id'], array( 'status' => 'notified', 'notified_at' => Util::now() ) );
			self::log_event( $quote, 'forwarded' );
			JobQueue::complete( $job );
		} else {
			$retry = JobQueue::fail( $job, 'Contractor e-mail failed', true );
			if ( ! $retry ) {
				self::update( (int) $quote['id'], array( 'status' => 'notify_failed' ) );
				// Some recipients may have received it: the log must say so.
				self::log_event( $quote, self::sent_count( (int) $quote['id'], (int) $job['id'] ) > 0 ? 'forwarded_partial' : 'forward_failed' );
			}
		}
	}

	/**
	 * Is the quoted concept's gallery still being produced (renders queued or
	 * running, or upscales pending)?
	 */
	public static function gallery_busy( array $quote ): bool {
		$concept = Repository::concept( (int) $quote['concept_id'] );
		if ( ! $concept ) {
			return false;
		}
		$ids = array();
		foreach ( Repository::assets( (int) $quote['project_id'], (int) $concept['id'] ) as $a ) {
			if ( 'render' !== $a['kind'] ) {
				continue;
			}
			if ( in_array( $a['status'], array( 'queued', 'running' ), true ) ) {
				return true;
			}
			$ids[] = (int) $a['id'];
		}
		if ( empty( $ids ) ) {
			return false;
		}
		global $wpdb;
		$jt = Installer::table( 'jobs' );
		$in = implode( ',', $ids );
		return (bool) $wpdb->get_var( "SELECT id FROM {$jt} WHERE type = 'upscale' AND status IN ('queued','waiting','running') AND asset_id IN ({$in}) LIMIT 1" ); // phpcs:ignore
	}

	private static function log_event( array $quote, string $event ): void {
		global $wpdb;
		$wpdb->insert(
			Installer::table( 'consents' ),
			array(
				'quote_id'     => (int) $quote['id'],
				'project_id'   => (int) $quote['project_id'],
				'consent_type' => 'forwarding',
				'granted'      => in_array( $event, array( 'forwarded', 'forwarded_partial' ), true ) ? 1 : 0,
				'event'        => $event,
				'created_at'   => Util::now(),
			)
		);
	}

	/**
	 * Recipient list: main contractor + optional extra addresses (multi-contractor feature).
	 */
	public static function recipients(): array {
		$list = array();
		$main = (string) Settings::get( 'contractor.email', '' );
		if ( is_email( $main ) ) {
			$list[] = $main;
		}
		if ( Settings::get( 'contractor.multi_enabled', false ) && Features::enabled( 'multi_contractor' ) ) {
			foreach ( preg_split( '/[\s,;]+/', (string) Settings::get( 'contractor.extra_emails', '' ) ) as $e ) {
				if ( is_email( $e ) ) {
					$list[] = $e;
				}
			}
		}
		$out = array();
		foreach ( $list as $e ) {
			$out[ self::normalize_email( $e ) ] = $e;
		}
		return array_values( $out );
	}

	public static function normalize_email( string $email ): string {
		return strtolower( trim( $email ) );
	}

	/**
	 * Name used in contractor e-mails ({contractor_name}): contractor.name,
	 * else the contact person, else the company.
	 */
	public static function contractor_name(): string {
		foreach ( array( 'contractor.name', 'contractor.contact_name', 'contractor.company' ) as $key ) {
			$v = trim( (string) Settings::get( $key, '' ) );
			if ( '' !== $v ) {
				return $v;
			}
		}
		return '';
	}

	/**
	 * Per-recipient delivery state kept in quotes.recipients (JSON):
	 * { "to": { "<email>": { "status": "sent|failed", "round": <job id>, "at": "<UTC>" } },
	 *   "client": "<UTC of the client confirmation>" }
	 */
	public static function delivery( int $quote_id ): array {
		global $wpdb;
		$t = Installer::table( 'quotes' );
		$d = Util::decode( (string) $wpdb->get_var( $wpdb->prepare( "SELECT recipients FROM {$t} WHERE id = %d", $quote_id ) ) ); // phpcs:ignore
		return array(
			'to'     => isset( $d['to'] ) && is_array( $d['to'] ) ? $d['to'] : array(),
			'client' => (string) ( $d['client'] ?? '' ),
		);
	}

	private static function save_delivery( int $quote_id, array $d ): void {
		self::update( $quote_id, array( 'recipients' => Util::json( $d ) ) );
	}

	private static function sent_count( int $quote_id, int $round ): int {
		$n = 0;
		foreach ( self::delivery( $quote_id )['to'] as $state ) {
			if ( 'sent' === ( $state['status'] ?? '' ) && (int) ( $state['round'] ?? 0 ) === $round ) {
				$n++;
			}
		}
		return $n;
	}

	/**
	 * Quotes whose contractor notification was delivered to this address
	 * (contractor role scope in the portal). Quotes from before per-recipient
	 * tracking (no delivery data) count for the currently configured recipients.
	 *
	 * @return int[]
	 */
	public static function quote_ids_for_recipient( string $email ): array {
		global $wpdb;
		$email = self::normalize_email( $email );
		if ( '' === $email ) {
			return array();
		}
		$t    = Installer::table( 'quotes' );
		$like = '%' . $wpdb->esc_like( '"' . $email . '":' ) . '%';
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT id, recipients FROM {$t} WHERE recipients LIKE %s ORDER BY id DESC LIMIT 500", $like ), ARRAY_A ) ?: array(); // phpcs:ignore
		$ids  = array();
		foreach ( $rows as $row ) {
			$d = Util::decode( (string) $row['recipients'] );
			if ( 'sent' === ( $d['to'][ $email ]['status'] ?? '' ) ) {
				$ids[] = (int) $row['id'];
			}
		}
		if ( in_array( $email, array_map( array( __CLASS__, 'normalize_email' ), self::recipients() ), true ) ) {
			foreach ( (array) $wpdb->get_col( "SELECT id FROM {$t} WHERE ( recipients IS NULL OR recipients = '' ) AND status = 'notified' ORDER BY id DESC LIMIT 500" ) as $id ) { // phpcs:ignore
				$ids[] = (int) $id;
			}
		}
		return array_values( array_unique( $ids ) );
	}

	/**
	 * Send the contractor notification(s) and the client confirmation.
	 *
	 * @param int $round Notification round (notify job id). Recipients already
	 *                   served in the same round are skipped; 0 = send to all.
	 * @return bool True when every recipient got the e-mail in this round.
	 */
	public static function notify( array $quote, int $round = 0 ): bool {
		$project = Repository::project_by_id( (int) $quote['project_id'] );
		$concept = Repository::concept( (int) $quote['concept_id'] );
		if ( ! $project ) {
			return false;
		}
		$hours = (int) Settings::get( 'contractor.link_hours', 168 );
		$vars  = array(
			'site_name'       => get_bloginfo( 'name' ),
			'project_id'      => $project['uuid'],
			'concept'         => $concept ? $concept['variant'] . ' – ' . $concept['title'] : '',
			'client_name'     => $quote['full_name'],
			'client_email'    => $quote['email'],
			'client_phone'    => $quote['phone'],
			'city'            => $quote['city'],
			'site_location'   => $quote['site_location'],
			'start_period'    => $quote['start_period'],
			'budget'          => $quote['budget'],
			'note'            => $quote['note'],
			'contractor_name' => self::contractor_name(),
			'expires'         => wp_date( 'Y-m-d H:i', time() + $hours * HOUR_IN_SECONDS ),
		);
		$all_ok = true;
		$rcpts  = self::recipients();
		if ( empty( $rcpts ) ) {
			Logger::error( 'mail', 'No contractor e-mail configured' );
			return false;
		}
		$qid   = (int) $quote['id'];
		$state = self::delivery( $qid );
		$clang = (string) Settings::get( 'contractor.lang', 'hu_HU' );
		foreach ( $rcpts as $to ) {
			$key  = self::normalize_email( $to );
			$prev = $state['to'][ $key ] ?? array();
			if ( $round > 0 && 'sent' === ( $prev['status'] ?? '' ) && (int) ( $prev['round'] ?? 0 ) === $round ) {
				continue; // Delivered earlier in this round (job retry): no duplicate mail or link.
			}
			// A new link replaces this recipient's earlier links for the quote (resend).
			AccessTokens::revoke_quote( $qid, $key );
			$token        = AccessTokens::create( 'link', $qid, (int) $project['id'], $hours, 0, $key );
			$vars['link'] = AccessTokens::portal_url( $token );
			$ok           = (bool) I18n::with_locale(
				$clang,
				static fn() => Mailer::send( $to, Mailer::fill( Mailer::template( 'contractor_subject' ), $vars ), Mailer::fill( Mailer::template( 'contractor_body' ), $vars ), array( 'Reply-To: ' . str_replace( array( "\r", "\n" ), '', $quote['email'] ) ) )
			);
			if ( ! $ok ) {
				AccessTokens::revoke_quote( $qid, $key ); // The link never reached anybody.
			}
			$state['to'][ $key ] = array( 'status' => $ok ? 'sent' : 'failed', 'round' => $round, 'at' => Util::now() );
			self::save_delivery( $qid, $state );
			$all_ok = $all_ok && $ok;
		}
		// The client confirmation goes out once per quote (not again on resend).
		if ( $all_ok && '' === $state['client'] && Settings::get( 'contractor.client_confirmation', true ) ) {
			$sent = I18n::with_locale(
				'' !== (string) $quote['lang'] ? (string) $quote['lang'] : 'hu_HU',
				static fn() => Mailer::send( $quote['email'], Mailer::fill( Mailer::template( 'client_subject' ), $vars ), Mailer::fill( Mailer::template( 'client_body' ), $vars ) )
			);
			if ( $sent ) {
				$state['client'] = Util::now();
				self::save_delivery( $qid, $state );
			}
		}
		return $all_ok;
	}

	/**
	 * GDPR: anonymise a quote (keeps aggregate data, removes personal data):
	 * every contact / free-text field, the consent log's IP hash and user
	 * agent, the contractor package and links – and, once no other active
	 * quote needs it, the linked project's personal free text and files
	 * (Repository::anonymize_project()).
	 */
	public static function anonymize( int $id ): void {
		global $wpdb;
		$q = self::get( $id );
		if ( ! $q ) {
			return;
		}
		self::update(
			$id,
			array(
				'full_name'     => '[törölve]',
				'email'         => '',
				'phone'         => '',
				'city'          => '',
				'site_location' => '',
				'start_period'  => '',
				'budget'        => '',
				'note'          => '',
				'anonymized'    => 1,
			)
		);
		$wpdb->update( Installer::table( 'consents' ), array( 'ip_hash' => '', 'user_agent' => '' ), array( 'quote_id' => $id ) );
		if ( $q['package_path'] ) {
			$path = \AutoGroweHome\Support\Storage::path( $q['package_path'] );
			if ( '' !== $path ) {
				wp_delete_file( $path );
			}
			self::update( $id, array( 'package_path' => '' ) );
		}
		AccessTokens::revoke_quote( $id, '', true );
		$pid    = (int) $q['project_id'];
		$active = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . Installer::table( 'quotes' ) . ' WHERE project_id = %d AND anonymized = 0', $pid ) ); // phpcs:ignore
		if ( $pid > 0 && 0 === $active ) {
			Repository::anonymize_project( $pid );
		}
	}
}
