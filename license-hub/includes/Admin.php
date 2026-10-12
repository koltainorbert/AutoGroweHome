<?php
/**
 * Admin screens of the licence centre: licences, releases, settings, log.
 *
 * @package AGHLicenseHub
 */

defined( 'ABSPATH' ) || exit;

final class AGHLS_Admin {

	const CAP = 'manage_options';

	public static function init(): void {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_post_aghls', array( __CLASS__, 'handle' ) );
		add_action( 'admin_head', array( __CLASS__, 'styles' ) );
		add_action( 'admin_footer', array( __CLASS__, 'scripts' ) );
		add_action( 'admin_notices', array( __CLASS__, 'notices' ) );
	}

	public static function menu(): void {
		add_menu_page( __( 'AGH Licencek', 'agh-license-hub' ), __( 'AGH Licencek', 'agh-license-hub' ), self::CAP, 'aghls', array( __CLASS__, 'page_licenses' ), 'dashicons-admin-network', 58 );
		add_submenu_page( 'aghls', __( 'Licencek', 'agh-license-hub' ), __( 'Licencek', 'agh-license-hub' ), self::CAP, 'aghls', array( __CLASS__, 'page_licenses' ) );
		add_submenu_page( 'aghls', __( 'Új licenc', 'agh-license-hub' ), __( 'Új licenc', 'agh-license-hub' ), self::CAP, 'aghls-new', array( __CLASS__, 'page_new' ) );
		add_submenu_page( 'aghls', __( 'Kiadások (frissítések)', 'agh-license-hub' ), __( 'Kiadások', 'agh-license-hub' ), self::CAP, 'aghls-releases', array( __CLASS__, 'page_releases' ) );
		add_submenu_page( 'aghls', __( 'Beállítás és kapcsolódás', 'agh-license-hub' ), __( 'Beállítás', 'agh-license-hub' ), self::CAP, 'aghls-settings', array( __CLASS__, 'page_settings' ) );
		add_submenu_page( 'aghls', __( 'Napló', 'agh-license-hub' ), __( 'Napló', 'agh-license-hub' ), self::CAP, 'aghls-log', array( __CLASS__, 'page_log' ) );
	}

	private static function ours(): bool {
		return isset( $_GET['page'] ) && 0 === strpos( sanitize_key( wp_unslash( $_GET['page'] ) ), 'aghls' ); // phpcs:ignore WordPress.Security.NonceVerification
	}

	private static function url( string $page, array $args = array() ): string {
		return add_query_arg( array_merge( array( 'page' => $page ), $args ), admin_url( 'admin.php' ) );
	}

	private static function action_url( string $do, array $args = array() ): string {
		return wp_nonce_url( add_query_arg( array_merge( array( 'action' => 'aghls', 'do' => $do ), $args ), admin_url( 'admin-post.php' ) ), 'aghls_' . $do );
	}

	private static function back( string $url, string $msg, bool $error = false ): void {
		set_transient( 'aghls_notice_' . get_current_user_id(), array( 'msg' => $msg, 'error' => $error ), 60 );
		wp_safe_redirect( $url );
		exit;
	}

	public static function notices(): void {
		if ( ! self::ours() ) {
			return;
		}
		$n = get_transient( 'aghls_notice_' . get_current_user_id() );
		if ( $n ) {
			delete_transient( 'aghls_notice_' . get_current_user_id() );
			echo '<div class="notice notice-' . ( $n['error'] ? 'error' : 'success' ) . ' is-dismissible"><p>' . esc_html( $n['msg'] ) . '</p></div>';
		}
		if ( 0 !== strpos( self::base(), 'https://' ) ) {
			echo '<div class="notice notice-warning"><p>' . esc_html__( 'Az oldal nem HTTPS-en fut: az AutoGroweHome plugin csak HTTPS-licencszerverhez kapcsolódik. Élesben HTTPS kell.', 'agh-license-hub' ) . '</p></div>';
		}
	}

	private static function base(): string {
		return AGHLS_Api::base_url();
	}

	/* ================================================================== actions */

	public static function handle(): void {
		if ( ! current_user_can( self::CAP ) ) {
			wp_die( esc_html__( 'Nincs jogosultságod.', 'agh-license-hub' ) );
		}
		$do = isset( $_REQUEST['do'] ) ? sanitize_key( wp_unslash( $_REQUEST['do'] ) ) : '';
		check_admin_referer( 'aghls_' . $do );
		$id = isset( $_REQUEST['id'] ) ? (int) $_REQUEST['id'] : 0;
		$p  = wp_unslash( $_POST ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- sanitized in Store::clean().
		switch ( $do ) {
			case 'save':
				$f = array(
					'customer' => $p['customer'] ?? '', 'email' => $p['email'] ?? '', 'plan' => $p['plan'] ?? 'starter', 'billing_cycle' => $p['billing_cycle'] ?? 'yearly',
					'expires_at' => $p['expires_at'] ?? '', 'sites_allowed' => $p['sites_allowed'] ?? 1, 'updates' => ! empty( $p['updates'] ), 'notes' => $p['notes'] ?? '',
					'status' => $id && ( $l = AGHLS_Store::get( $id ) ) ? $l['status'] : 'active',
				);
				if ( $id ) {
					AGHLS_Store::update( $id, $f );
					self::back( self::url( 'aghls', array( 'view' => 'show', 'id' => $id ) ), __( 'Licenc mentve.', 'agh-license-hub' ) );
				}
				list( $nid ) = AGHLS_Store::create( $f );
				if ( ! empty( $p['send_mail'] ) && is_email( $f['email'] ) ) {
					self::mail( $nid );
				}
				self::back( self::url( 'aghls', array( 'view' => 'show', 'id' => $nid, 'created' => 1 ) ), __( 'Licenc létrehozva. A kulcs lent látható és másolható.', 'agh-license-hub' ) );
				break;
			case 'extend':
				AGHLS_Store::extend( $id );
				self::back( self::url( 'aghls', array( 'view' => 'show', 'id' => $id ) ), __( 'Lejárat meghosszabbítva egy időszakkal.', 'agh-license-hub' ) );
				break;
			case 'revoke':
			case 'restore':
				AGHLS_Store::set_status( $id, 'revoke' === $do ? 'revoked' : 'active' );
				self::back( self::url( 'aghls', array( 'view' => 'show', 'id' => $id ) ), 'revoke' === $do ? __( 'Licenc visszavonva: a következő ellenőrzéskor az ügyfél oldala Starterre vált.', 'agh-license-hub' ) : __( 'Licenc újra aktív.', 'agh-license-hub' ) );
				break;
			case 'delete':
				AGHLS_Store::delete( $id );
				self::back( self::url( 'aghls' ), __( 'Licenc törölve.', 'agh-license-hub' ) );
				break;
			case 'free':
				AGHLS_Store::free_site( (int) ( $_REQUEST['act'] ?? 0 ) );
				self::back( self::url( 'aghls', array( 'view' => 'show', 'id' => $id ) ), __( 'Hely felszabadítva.', 'agh-license-hub' ) );
				break;
			case 'mail':
				$ok = self::mail( $id );
				self::back( self::url( 'aghls', array( 'view' => 'show', 'id' => $id ) ), $ok ? __( 'E-mail elküldve.', 'agh-license-hub' ) : __( 'Az e-mail nem ment el (nincs cím, vagy a WordPress levélküldése hibás).', 'agh-license-hub' ), ! $ok );
				break;
			case 'release_upload':
				if ( empty( $_FILES['zip']['tmp_name'] ) || ! is_uploaded_file( $_FILES['zip']['tmp_name'] ) ) { // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
					self::back( self::url( 'aghls-releases' ), __( 'Nincs feltöltött fájl.', 'agh-license-hub' ), true );
				}
				$r = AGHLS_Releases::add( $_FILES['zip']['tmp_name'], (string) ( $p['tested'] ?? '' ), (string) ( $p['notes'] ?? '' ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
				self::back( self::url( 'aghls-releases' ), isset( $r['error'] ) ? $r['error'] : sprintf( /* translators: %s: version */ __( 'A(z) %s verzió felkerült; a jogosult oldalak 12 órán belül látják a frissítést.', 'agh-license-hub' ), $r['version'] ), isset( $r['error'] ) );
				break;
			case 'release_toggle':
				AGHLS_Releases::set_published( $id, ! empty( $_REQUEST['on'] ) );
				self::back( self::url( 'aghls-releases' ), __( 'Kiadás frissítve.', 'agh-license-hub' ) );
				break;
			case 'release_delete':
				AGHLS_Releases::delete( $id );
				self::back( self::url( 'aghls-releases' ), __( 'Kiadás törölve.', 'agh-license-hub' ) );
				break;
			case 'settings':
				update_option( 'aghls_rate_limit', max( 0, min( 600, (int) ( $p['rate_limit'] ?? 30 ) ) ), false );
				update_option( 'aghls_mail_from', sanitize_text_field( (string) ( $p['mail_from'] ?? '' ) ), false );
				self::back( self::url( 'aghls-settings' ), __( 'Beállítások mentve.', 'agh-license-hub' ) );
				break;
			case 'rotate':
				AGHLS_Crypto::rotate_keys();
				self::back( self::url( 'aghls-settings' ), __( 'Új kulcspár készült. Minden AutoGroweHome-telepítésbe az új nyilvános kulcs kell!', 'agh-license-hub' ) );
				break;
		}
		self::back( self::url( 'aghls' ), __( 'Ismeretlen művelet.', 'agh-license-hub' ), true );
	}

	/** Sends the licence key and the setup steps to the customer. */
	public static function mail( int $id ): bool {
		$l = AGHLS_Store::get( $id );
		if ( ! $l || ! is_email( $l['email'] ) ) {
			return false;
		}
		$key   = AGHLS_Store::plain_key( $l );
		$plans = AGHLS_Store::plans();
		$exp   = $l['expires_at'] ? wp_date( 'Y. m. d.', strtotime( $l['expires_at'] . ' UTC' ) ) : __( 'nem jár le', 'agh-license-hub' );
		$lines = array(
			sprintf( /* translators: %s: name */ __( 'Kedves %s!', 'agh-license-hub' ), $l['customer'] ?: __( 'Ügyfelünk', 'agh-license-hub' ) ),
			'',
			__( 'Köszönjük, hogy az AutoGroweHome háztervezőt választottad. A licenced adatai:', 'agh-license-hub' ),
			'',
			__( 'Licenckulcs:', 'agh-license-hub' ) . ' ' . $key,
			__( 'Csomag:', 'agh-license-hub' ) . ' ' . ( $plans[ $l['plan'] ]['label'] ?? $l['plan'] ),
			__( 'Érvényes:', 'agh-license-hub' ) . ' ' . $exp,
			__( 'Weboldalak száma:', 'agh-license-hub' ) . ' ' . (int) $l['sites_allowed'],
			'',
			__( 'Aktiválás: WordPress admin → AutoGroweHome → Licenc. Ha a „Licencszerver” mezők üresek, add meg ezeket:', 'agh-license-hub' ),
			__( 'Szerver URL:', 'agh-license-hub' ) . ' ' . self::base(),
			__( 'Szerver nyilvános kulcsa:', 'agh-license-hub' ) . ' ' . AGHLS_Crypto::public_key(),
			__( 'Ezután írd be a licenckulcsot, és kattints az Aktiválás gombra.', 'agh-license-hub' ),
			'',
			get_bloginfo( 'name' ),
		);
		$from    = (string) get_option( 'aghls_mail_from', '' );
		$headers = $from ? array( 'From: ' . $from ) : array();
		return (bool) wp_mail( $l['email'], __( 'AutoGroweHome licenckulcs', 'agh-license-hub' ), implode( "\n", $lines ), $headers );
	}

	/* ================================================================== pages */

	private static function head( string $title, string $sub = '', string $actions = '' ): void {
		echo '<div class="wrap aghls"><div class="aghls-head"><div><h1>' . esc_html( $title ) . '</h1>' . ( $sub ? '<p class="aghls-sub">' . esc_html( $sub ) . '</p>' : '' ) . '</div><div>' . $actions . '</div></div>'; // phpcs:ignore WordPress.Security.EscapeOutput -- $actions built from escaped parts.
	}

	private static function badge( string $state ): string {
		$map = array(
			'active'  => array( 'ok', __( 'Aktív', 'agh-license-hub' ) ),
			'expired' => array( 'warn', __( 'Lejárt', 'agh-license-hub' ) ),
			'revoked' => array( 'bad', __( 'Visszavonva', 'agh-license-hub' ) ),
		);
		$b = $map[ $state ] ?? array( 'muted', $state );
		return '<span class="aghls-badge is-' . $b[0] . '">' . esc_html( $b[1] ) . '</span>';
	}

	private static function exp_text( array $l ): string {
		if ( empty( $l['expires_at'] ) ) {
			return __( 'Örökös', 'agh-license-hub' );
		}
		$t    = strtotime( $l['expires_at'] . ' UTC' );
		$days = (int) floor( ( $t - time() ) / DAY_IN_SECONDS );
		$s    = wp_date( 'Y. m. d.', $t );
		if ( $days < 0 ) {
			return $s;
		}
		return $s . ' · ' . sprintf( /* translators: %d: days */ _n( '%d nap', '%d nap', $days, 'agh-license-hub' ), $days );
	}

	public static function page_licenses(): void {
		$view = isset( $_GET['view'] ) ? sanitize_key( wp_unslash( $_GET['view'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		$id   = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0; // phpcs:ignore WordPress.Security.NonceVerification
		if ( 'edit' === $view && $id ) {
			self::form( AGHLS_Store::get( $id ) );
			return;
		}
		if ( 'show' === $view && $id ) {
			self::show( $id );
			return;
		}
		$q     = isset( $_GET['s'] ) ? sanitize_text_field( wp_unslash( $_GET['s'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		$state = isset( $_GET['state'] ) ? sanitize_key( wp_unslash( $_GET['state'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		$c     = AGHLS_Store::counts();
		self::head( __( 'AGH Licencek', 'agh-license-hub' ), __( 'Az AutoGroweHome ügyféllicencei: kiadás, aktiválások, hosszabbítás, visszavonás.', 'agh-license-hub' ), '<a class="button button-primary button-hero" href="' . esc_url( self::url( 'aghls-new' ) ) . '">+ ' . esc_html__( 'Új licenc', 'agh-license-hub' ) . '</a>' );
		echo '<div class="aghls-stats">';
		foreach ( array( '' => array( $c['all'], __( 'Összes licenc', 'agh-license-hub' ) ), 'active' => array( $c['active'], __( 'Aktív', 'agh-license-hub' ) ), 'expired' => array( $c['expired'], __( 'Lejárt', 'agh-license-hub' ) ), 'revoked' => array( $c['revoked'], __( 'Visszavonva', 'agh-license-hub' ) ) ) as $k => $v ) {
			echo '<a class="aghls-stat' . ( $state === $k ? ' is-on' : '' ) . '" href="' . esc_url( self::url( 'aghls', $k ? array( 'state' => $k ) : array() ) ) . '"><b>' . (int) $v[0] . '</b><span>' . esc_html( $v[1] ) . '</span></a>';
		}
		echo '<div class="aghls-stat"><b>' . (int) $c['sites'] . '</b><span>' . esc_html__( 'Aktivált weboldal', 'agh-license-hub' ) . '</span></div></div>';
		echo '<form class="aghls-search" method="get"><input type="hidden" name="page" value="aghls"><input type="search" name="s" value="' . esc_attr( $q ) . '" placeholder="' . esc_attr__( 'Keresés: ügyfél, e-mail, kulcs eleje, megjegyzés', 'agh-license-hub' ) . '"> <button class="button">' . esc_html__( 'Keresés', 'agh-license-hub' ) . '</button></form>';
		$rows  = AGHLS_Store::search( $q, $state );
		$plans = AGHLS_Store::plans();
		if ( ! $rows ) {
			echo '<div class="aghls-card aghls-empty"><p>' . esc_html__( 'Még nincs licenc. Kattints az „Új licenc” gombra – a kulcs azonnal elkészül.', 'agh-license-hub' ) . '</p></div></div>';
			return;
		}
		echo '<div class="aghls-card"><table class="widefat striped aghls-table"><thead><tr><th>' . esc_html__( 'Ügyfél', 'agh-license-hub' ) . '</th><th>' . esc_html__( 'Kulcs', 'agh-license-hub' ) . '</th><th>' . esc_html__( 'Csomag', 'agh-license-hub' ) . '</th><th>' . esc_html__( 'Lejárat', 'agh-license-hub' ) . '</th><th>' . esc_html__( 'Weboldalak', 'agh-license-hub' ) . '</th><th>' . esc_html__( 'Állapot', 'agh-license-hub' ) . '</th></tr></thead><tbody>';
		foreach ( $rows as $l ) {
			$link = self::url( 'aghls', array( 'view' => 'show', 'id' => $l['id'] ) );
			echo '<tr><td><a class="row-title" href="' . esc_url( $link ) . '">' . esc_html( $l['customer'] ?: '—' ) . '</a><br><span class="aghls-muted">' . esc_html( $l['email'] ) . '</span></td>';
			echo '<td><code>' . esc_html( $l['key_hint'] ) . '</code></td>';
			echo '<td>' . esc_html( $plans[ $l['plan'] ]['label'] ?? $l['plan'] ) . '<br><span class="aghls-muted">' . esc_html( AGHLS_Store::cycles()[ $l['billing_cycle'] ] ?? '' ) . '</span></td>';
			echo '<td>' . esc_html( self::exp_text( $l ) ) . '</td>';
			echo '<td>' . (int) $l['sites_used'] . ' / ' . (int) $l['sites_allowed'] . '</td>';
			echo '<td>' . self::badge( AGHLS_Store::state( $l ) ) . '</td></tr>'; // phpcs:ignore WordPress.Security.EscapeOutput
		}
		echo '</tbody></table></div></div>';
	}

	public static function page_new(): void {
		self::form( null );
	}

	private static function form( ?array $l ): void {
		$plans = AGHLS_Store::plans();
		$edit  = (bool) $l;
		$l     = $l ?: array( 'customer' => '', 'email' => '', 'plan' => 'professional', 'billing_cycle' => 'yearly', 'expires_at' => gmdate( 'Y-m-d', strtotime( '+1 year' ) ), 'sites_allowed' => 1, 'updates' => 1, 'notes' => '', 'id' => 0 );
		$exp   = $l['expires_at'] ? substr( (string) $l['expires_at'], 0, 10 ) : '';
		self::head( $edit ? __( 'Licenc szerkesztése', 'agh-license-hub' ) : __( 'Új licenc', 'agh-license-hub' ), $edit ? '' : __( 'Mentéskor a kulcs automatikusan elkészül (AGH-XXXXX-…). Később is megnézhető és újraküldhető.', 'agh-license-hub' ) );
		echo '<form class="aghls-card aghls-form" method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		wp_nonce_field( 'aghls_save' );
		echo '<input type="hidden" name="action" value="aghls"><input type="hidden" name="do" value="save"><input type="hidden" name="id" value="' . (int) $l['id'] . '">';
		echo '<div class="aghls-grid">';
		echo '<label>' . esc_html__( 'Ügyfél neve / cég', 'agh-license-hub' ) . '<input type="text" name="customer" value="' . esc_attr( $l['customer'] ) . '" required></label>';
		echo '<label>' . esc_html__( 'E-mail', 'agh-license-hub' ) . '<input type="email" name="email" value="' . esc_attr( $l['email'] ) . '"></label>';
		echo '<label>' . esc_html__( 'Csomag', 'agh-license-hub' ) . '<select name="plan" data-sites>';
		foreach ( $plans as $k => $p ) {
			echo '<option value="' . esc_attr( $k ) . '" data-sites="' . (int) $p['sites'] . '"' . selected( $l['plan'], $k, false ) . '>' . esc_html( $p['label'] ) . '</option>';
		}
		echo '</select></label>';
		echo '<label>' . esc_html__( 'Számlázás', 'agh-license-hub' ) . '<select name="billing_cycle" data-cycle>';
		foreach ( AGHLS_Store::cycles() as $k => $v ) {
			echo '<option value="' . esc_attr( $k ) . '"' . selected( $l['billing_cycle'], $k, false ) . '>' . esc_html( $v ) . '</option>';
		}
		echo '</select></label>';
		echo '<label>' . esc_html__( 'Lejárat napja', 'agh-license-hub' ) . '<input type="date" name="expires_at" value="' . esc_attr( $exp ) . '" data-exp><small>' . esc_html__( 'Örökös licencnél nincs lejárat.', 'agh-license-hub' ) . '</small></label>';
		echo '<label>' . esc_html__( 'Weboldalak száma', 'agh-license-hub' ) . '<input type="number" min="1" max="1000" name="sites_allowed" value="' . (int) $l['sites_allowed'] . '" data-sitesinput><small>' . esc_html__( 'Ennyi oldalon aktiválható egyszerre.', 'agh-license-hub' ) . '</small></label>';
		echo '</div>';
		echo '<label class="aghls-check"><input type="checkbox" name="updates" value="1"' . checked( (int) $l['updates'], 1, false ) . '> ' . esc_html__( 'Jogosult a frissítésekre (a Kiadásokból)', 'agh-license-hub' ) . '</label>';
		if ( ! $edit ) {
			echo '<label class="aghls-check"><input type="checkbox" name="send_mail" value="1"> ' . esc_html__( 'Kulcs elküldése e-mailben az ügyfélnek mentéskor', 'agh-license-hub' ) . '</label>';
		}
		echo '<label>' . esc_html__( 'Megjegyzés (csak neked látszik)', 'agh-license-hub' ) . '<textarea name="notes" rows="3">' . esc_textarea( (string) $l['notes'] ) . '</textarea></label>';
		echo '<p><button class="button button-primary button-hero">' . esc_html( $edit ? __( 'Mentés', 'agh-license-hub' ) : __( 'Licenc létrehozása', 'agh-license-hub' ) ) . '</button> <a class="button button-hero" href="' . esc_url( $edit ? self::url( 'aghls', array( 'view' => 'show', 'id' => $l['id'] ) ) : self::url( 'aghls' ) ) . '">' . esc_html__( 'Mégse', 'agh-license-hub' ) . '</a></p></form></div>';
	}

	private static function show( int $id ): void {
		$l = AGHLS_Store::get( $id );
		if ( ! $l ) {
			echo '<div class="wrap"><p>' . esc_html__( 'Nincs ilyen licenc.', 'agh-license-hub' ) . '</p></div>';
			return;
		}
		$plans   = AGHLS_Store::plans();
		$state   = AGHLS_Store::state( $l );
		$created = ! empty( $_GET['created'] ); // phpcs:ignore WordPress.Security.NonceVerification
		$acts    = AGHLS_Store::activations( $id );
		$used    = count( array_filter( $acts, function ( $a ) { return (int) $a['active']; } ) );
		$btn     = function ( $do, $label, $cls = '', $confirm = '', $args = array() ) use ( $id ) {
			return '<a class="button ' . $cls . '" href="' . esc_url( self::action_url( $do, array_merge( array( 'id' => $id ), $args ) ) ) . '"' . ( $confirm ? ' data-confirm="' . esc_attr( $confirm ) . '"' : '' ) . '>' . esc_html( $label ) . '</a>';
		};
		self::head( $l['customer'] ?: __( 'Licenc', 'agh-license-hub' ), $l['email'], '<a class="button" href="' . esc_url( self::url( 'aghls' ) ) . '">← ' . esc_html__( 'Licencek', 'agh-license-hub' ) . '</a>' );
		$key = AGHLS_Store::plain_key( $l );
		echo '<div class="aghls-card aghls-keycard' . ( $created ? ' is-new' : '' ) . '"><div class="aghls-keylabel">' . esc_html__( 'Licenckulcs', 'agh-license-hub' ) . '</div>';
		echo '<div class="aghls-key"><code data-key="' . esc_attr( $key ) . '">' . esc_html( $created ? $key : $l['key_hint'] ) . '</code>';
		echo ' <button type="button" class="button" data-copy="' . esc_attr( $key ) . '">' . esc_html__( 'Másolás', 'agh-license-hub' ) . '</button>';
		if ( ! $created ) {
			echo ' <button type="button" class="button" data-reveal>' . esc_html__( 'Megjelenítés', 'agh-license-hub' ) . '</button>';
		}
		echo '</div><p class="aghls-muted">' . esc_html__( 'Az ügyfél ezt írja be: WordPress admin → AutoGroweHome → Licenc → Aktiválás.', 'agh-license-hub' ) . '</p></div>';

		echo '<div class="aghls-cols"><div class="aghls-card"><h2>' . esc_html__( 'Adatok', 'agh-license-hub' ) . ' ' . self::badge( $state ) . '</h2><table class="aghls-kv">'; // phpcs:ignore WordPress.Security.EscapeOutput
		$rows = array(
			__( 'Csomag', 'agh-license-hub' )      => ( $plans[ $l['plan'] ]['label'] ?? $l['plan'] ) . ' · ' . ( AGHLS_Store::cycles()[ $l['billing_cycle'] ] ?? '' ),
			__( 'Lejárat', 'agh-license-hub' )     => self::exp_text( $l ),
			__( 'Weboldalak', 'agh-license-hub' )  => $used . ' / ' . (int) $l['sites_allowed'],
			__( 'Frissítések', 'agh-license-hub' ) => (int) $l['updates'] ? __( 'jogosult', 'agh-license-hub' ) : __( 'nem jogosult', 'agh-license-hub' ),
			__( 'Létrehozva', 'agh-license-hub' )  => wp_date( 'Y. m. d. H:i', strtotime( $l['created_at'] . ' UTC' ) ),
			__( 'Megjegyzés', 'agh-license-hub' )  => $l['notes'] ?: '—',
		);
		foreach ( $rows as $k => $v ) {
			echo '<tr><th>' . esc_html( $k ) . '</th><td>' . esc_html( (string) $v ) . '</td></tr>';
		}
		echo '</table><p class="aghls-actions">';
		echo '<a class="button" href="' . esc_url( self::url( 'aghls', array( 'view' => 'edit', 'id' => $id ) ) ) . '">' . esc_html__( 'Szerkesztés', 'agh-license-hub' ) . '</a> ';
		if ( 'lifetime' !== $l['billing_cycle'] ) {
			echo $btn( 'extend', 'monthly' === $l['billing_cycle'] ? __( 'Hosszabbítás +1 hónap', 'agh-license-hub' ) : __( 'Hosszabbítás +1 év', 'agh-license-hub' ), 'button-primary' ) . ' '; // phpcs:ignore WordPress.Security.EscapeOutput
		}
		echo $btn( 'mail', __( 'Kulcs küldése e-mailben', 'agh-license-hub' ) ) . ' '; // phpcs:ignore WordPress.Security.EscapeOutput
		echo 'revoked' === $l['status'] ? $btn( 'restore', __( 'Újraengedélyezés', 'agh-license-hub' ) ) : $btn( 'revoke', __( 'Visszavonás', 'agh-license-hub' ), 'aghls-danger', __( 'Visszavonod? Az ügyfél oldala a következő ellenőrzéskor Starterre vált.', 'agh-license-hub' ) ); // phpcs:ignore WordPress.Security.EscapeOutput
		echo ' ' . $btn( 'delete', __( 'Törlés', 'agh-license-hub' ), 'aghls-danger', __( 'Végleg törlöd a licencet és az aktiválásait?', 'agh-license-hub' ) ) . '</p></div>'; // phpcs:ignore WordPress.Security.EscapeOutput

		echo '<div class="aghls-card"><h2>' . esc_html__( 'Aktivált weboldalak', 'agh-license-hub' ) . '</h2>';
		if ( ! $acts ) {
			echo '<p class="aghls-muted">' . esc_html__( 'Még egy oldalon sincs aktiválva.', 'agh-license-hub' ) . '</p>';
		} else {
			echo '<table class="widefat striped"><thead><tr><th>' . esc_html__( 'Weboldal', 'agh-license-hub' ) . '</th><th>' . esc_html__( 'Verzió', 'agh-license-hub' ) . '</th><th>' . esc_html__( 'Utoljára', 'agh-license-hub' ) . '</th><th></th></tr></thead><tbody>';
			foreach ( $acts as $a ) {
				echo '<tr' . ( (int) $a['active'] ? '' : ' class="aghls-off"' ) . '><td><a href="' . esc_url( $a['site_url'] ) . '" target="_blank" rel="noopener">' . esc_html( preg_replace( '#^https?://#', '', $a['site_url'] ) ) . '</a><br><span class="aghls-muted">' . esc_html( $a['instance_id'] ) . '</span></td><td>' . esc_html( $a['plugin_version'] ) . '</td><td>' . esc_html( wp_date( 'Y. m. d. H:i', strtotime( $a['last_seen'] . ' UTC' ) ) ) . '</td><td>';
				echo (int) $a['active'] ? $btn( 'free', __( 'Felszabadítás', 'agh-license-hub' ), 'button-small', __( 'Felszabadítod ezt a helyet? Ezen az oldalon a licenc a következő ellenőrzéskor inaktív lesz.', 'agh-license-hub' ), array( 'act' => $a['id'] ) ) : esc_html__( 'inaktív', 'agh-license-hub' ); // phpcs:ignore WordPress.Security.EscapeOutput
				echo '</td></tr>';
			}
			echo '</tbody></table>';
		}
		echo '</div></div>';
		self::log_table( AGHLS_Store::log_rows( $id, 30 ), __( 'Utolsó kérések', 'agh-license-hub' ) );
		echo '</div>';
	}

	public static function page_releases(): void {
		self::head( __( 'Kiadások (frissítések)', 'agh-license-hub' ), __( 'Az ide feltöltött AutoGroweHome-ZIP-et a jogosult, aktivált oldalak a WordPress frissítései között látják (12 órás gyorsítótárral).', 'agh-license-hub' ) );
		echo '<form class="aghls-card aghls-form" method="post" enctype="multipart/form-data" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		wp_nonce_field( 'aghls_release_upload' );
		echo '<input type="hidden" name="action" value="aghls"><input type="hidden" name="do" value="release_upload"><h2>' . esc_html__( 'Új verzió feltöltése', 'agh-license-hub' ) . '</h2>';
		echo '<div class="aghls-grid"><label>' . esc_html__( 'AutoGroweHome ZIP (dist/autogrowehome-X.Y.Z.zip)', 'agh-license-hub' ) . '<input type="file" name="zip" accept=".zip" required></label>';
		echo '<label>' . esc_html__( 'Tesztelt WordPress-verzió (nem kötelező)', 'agh-license-hub' ) . '<input type="text" name="tested" placeholder="6.8"></label></div>';
		echo '<label>' . esc_html__( 'Megjegyzés', 'agh-license-hub' ) . '<textarea name="notes" rows="2"></textarea></label>';
		echo '<p><button class="button button-primary">' . esc_html__( 'Feltöltés', 'agh-license-hub' ) . '</button> <span class="aghls-muted">' . esc_html__( 'A verziószámot a csomagból olvassa ki; ugyanaz a verzió kétszer nem tölthető fel.', 'agh-license-hub' ) . '</span></p></form>';
		$all = AGHLS_Releases::all();
		echo '<div class="aghls-card"><h2>' . esc_html__( 'Feltöltött verziók', 'agh-license-hub' ) . '</h2>';
		if ( ! $all ) {
			echo '<p class="aghls-muted">' . esc_html__( 'Még nincs feltöltött verzió.', 'agh-license-hub' ) . '</p></div></div>';
			return;
		}
		$latest = AGHLS_Releases::latest();
		echo '<table class="widefat striped"><thead><tr><th>' . esc_html__( 'Verzió', 'agh-license-hub' ) . '</th><th>' . esc_html__( 'Méret', 'agh-license-hub' ) . '</th><th>SHA-256</th><th>' . esc_html__( 'Feltöltve', 'agh-license-hub' ) . '</th><th>' . esc_html__( 'Állapot', 'agh-license-hub' ) . '</th><th></th></tr></thead><tbody>';
		foreach ( $all as $r ) {
			$is_latest = $latest && $latest['id'] === $r['id'];
			echo '<tr><td><b>' . esc_html( $r['version'] ) . '</b>' . ( $is_latest ? ' <span class="aghls-badge is-ok">' . esc_html__( 'ezt kínálja', 'agh-license-hub' ) . '</span>' : '' ) . ( $r['notes'] ? '<br><span class="aghls-muted">' . esc_html( $r['notes'] ) . '</span>' : '' ) . '</td>';
			echo '<td>' . esc_html( size_format( (int) $r['size'] ) ) . '</td><td><code title="' . esc_attr( $r['sha256'] ) . '">' . esc_html( substr( $r['sha256'], 0, 12 ) ) . '…</code></td><td>' . esc_html( wp_date( 'Y. m. d.', strtotime( $r['created_at'] . ' UTC' ) ) ) . '</td>';
			echo '<td>' . ( (int) $r['published'] ? esc_html__( 'közzétéve', 'agh-license-hub' ) : esc_html__( 'rejtve', 'agh-license-hub' ) ) . '</td><td>';
			echo '<a class="button button-small" href="' . esc_url( self::action_url( 'release_toggle', array( 'id' => $r['id'], 'on' => (int) $r['published'] ? 0 : 1 ) ) ) . '">' . esc_html( (int) $r['published'] ? __( 'Elrejtés', 'agh-license-hub' ) : __( 'Közzététel', 'agh-license-hub' ) ) . '</a> ';
			echo '<a class="button button-small aghls-danger" data-confirm="' . esc_attr__( 'Törlöd ezt a verziót?', 'agh-license-hub' ) . '" href="' . esc_url( self::action_url( 'release_delete', array( 'id' => $r['id'] ) ) ) . '">' . esc_html__( 'Törlés', 'agh-license-hub' ) . '</a></td></tr>';
		}
		echo '</tbody></table></div></div>';
	}

	public static function page_settings(): void {
		$base = self::base();
		$pub  = AGHLS_Crypto::public_key();
		self::head( __( 'Beállítás és kapcsolódás', 'agh-license-hub' ), __( 'Ezt a két adatot kell az AutoGroweHome pluginnak megadni (ügyféloldalon vagy a pluginba beépítve).', 'agh-license-hub' ) );
		echo '<div class="aghls-card"><h2>' . esc_html__( 'Kapcsolódási adatok', 'agh-license-hub' ) . '</h2><table class="aghls-kv">';
		echo '<tr><th>' . esc_html__( 'Szerver URL', 'agh-license-hub' ) . '</th><td><code>' . esc_html( $base ) . '</code> <button type="button" class="button button-small" data-copy="' . esc_attr( $base ) . '">' . esc_html__( 'Másolás', 'agh-license-hub' ) . '</button> <a class="button button-small" target="_blank" rel="noopener" href="' . esc_url( $base . '/v1/ping' ) . '">' . esc_html__( 'Teszt', 'agh-license-hub' ) . '</a></td></tr>';
		echo '<tr><th>' . esc_html__( 'Nyilvános kulcs (Ed25519)', 'agh-license-hub' ) . '</th><td><code>' . esc_html( $pub ) . '</code> <button type="button" class="button button-small" data-copy="' . esc_attr( $pub ) . '">' . esc_html__( 'Másolás', 'agh-license-hub' ) . '</button></td></tr>';
		echo '</table>';
		$snippet = "define( 'AGH_LICENSE_SERVER', '" . $base . "' );\ndefine( 'AGH_LICENSE_PUBKEY', '" . $pub . "' );";
		echo '<p>' . esc_html__( 'Vagy a wp-config.php-ba (ügyféloldalon):', 'agh-license-hub' ) . '</p><pre class="aghls-pre">' . esc_html( $snippet ) . '</pre><button type="button" class="button" data-copy="' . esc_attr( $snippet ) . '">' . esc_html__( 'Kódrészlet másolása', 'agh-license-hub' ) . '</button>';
		echo '<p class="aghls-muted">' . esc_html__( 'A nyilvános kulcs nem titok. A titkos aláírókulcs titkosítva van az adatbázisban; erősebb védelemhez a wp-config.php-ba is tehető (AGHLS_SECRET_KEY, AGHLS_PEPPER).', 'agh-license-hub' ) . '</p></div>';

		echo '<form class="aghls-card aghls-form" method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		wp_nonce_field( 'aghls_settings' );
		echo '<input type="hidden" name="action" value="aghls"><input type="hidden" name="do" value="settings"><h2>' . esc_html__( 'Beállítások', 'agh-license-hub' ) . '</h2><div class="aghls-grid">';
		echo '<label>' . esc_html__( 'Kérés / perc / IP (0 = nincs korlát)', 'agh-license-hub' ) . '<input type="number" min="0" max="600" name="rate_limit" value="' . (int) get_option( 'aghls_rate_limit', 30 ) . '"></label>';
		echo '<label>' . esc_html__( 'Levél feladója (pl. Infostudio <info@infostudio.hu>)', 'agh-license-hub' ) . '<input type="text" name="mail_from" value="' . esc_attr( (string) get_option( 'aghls_mail_from', '' ) ) . '"></label>';
		echo '</div><p><button class="button button-primary">' . esc_html__( 'Mentés', 'agh-license-hub' ) . '</button></p></form>';

		echo '<div class="aghls-card aghls-dangerzone"><h2>' . esc_html__( 'Kulcscsere', 'agh-license-hub' ) . '</h2><p>' . esc_html__( 'Új aláíró kulcspár. Csak akkor, ha a titkos kulcs kiszivárgott: utána minden ügyféloldalra az új nyilvános kulcs kell, különben a licencük 14 nap türelmi idő után Starterre vált.', 'agh-license-hub' ) . '</p>';
		echo '<a class="button aghls-danger" data-confirm="' . esc_attr__( 'Biztosan új kulcspárt készítesz? Minden telepítésbe az új nyilvános kulcs kell.', 'agh-license-hub' ) . '" href="' . esc_url( self::action_url( 'rotate' ) ) . '">' . esc_html__( 'Új kulcspár', 'agh-license-hub' ) . '</a> <span class="aghls-muted">' . esc_html( sprintf( /* translators: %s: date */ __( 'Jelenlegi kulcs: %s', 'agh-license-hub' ), AGHLS_Crypto::key_created_at() ?: '—' ) ) . '</span></div></div>';
	}

	public static function page_log(): void {
		self::head( __( 'Napló', 'agh-license-hub' ), __( 'Az utolsó 200 kérés (180 napig őrzi; az IP-címek csak kivonatként).', 'agh-license-hub' ) );
		self::log_table( AGHLS_Store::log_rows( 0, 200 ), '' );
		echo '</div>';
	}

	private static function log_table( array $rows, string $title ): void {
		echo '<div class="aghls-card">' . ( $title ? '<h2>' . esc_html( $title ) . '</h2>' : '' );
		if ( ! $rows ) {
			echo '<p class="aghls-muted">' . esc_html__( 'Még nincs bejegyzés.', 'agh-license-hub' ) . '</p></div>';
			return;
		}
		echo '<table class="widefat striped"><thead><tr><th>' . esc_html__( 'Idő', 'agh-license-hub' ) . '</th><th>' . esc_html__( 'Licenc', 'agh-license-hub' ) . '</th><th>' . esc_html__( 'Művelet', 'agh-license-hub' ) . '</th><th>' . esc_html__( 'Eredmény', 'agh-license-hub' ) . '</th><th>' . esc_html__( 'Weboldal', 'agh-license-hub' ) . '</th></tr></thead><tbody>';
		foreach ( $rows as $r ) {
			echo '<tr><td>' . esc_html( wp_date( 'Y. m. d. H:i:s', strtotime( $r['created_at'] . ' UTC' ) ) ) . '</td><td>' . ( (int) $r['license_id'] ? '<a href="' . esc_url( self::url( 'aghls', array( 'view' => 'show', 'id' => $r['license_id'] ) ) ) . '">#' . (int) $r['license_id'] . '</a>' : '—' ) . '</td><td>' . esc_html( $r['action'] ) . '</td><td>' . esc_html( $r['result'] ) . '</td><td>' . esc_html( preg_replace( '#^https?://#', '', $r['site_url'] ) ) . '</td></tr>';
		}
		echo '</tbody></table></div>';
	}

	/* ================================================================== assets */

	public static function styles(): void {
		if ( ! self::ours() ) {
			return;
		}
		echo '<style>
.aghls{max-width:1180px}.aghls-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin:14px 0 18px;flex-wrap:wrap}.aghls-head h1{font-weight:500;letter-spacing:.02em;margin:0;padding:0}.aghls-sub{margin:6px 0 0;color:#646970}
.aghls-card{background:#fff;border:1px solid #e2e4e7;border-radius:14px;padding:18px 20px;margin:0 0 16px;box-shadow:0 4px 16px rgba(30,34,38,.04)}.aghls-card h2{margin:0 0 12px;font-weight:500;display:flex;gap:10px;align-items:center}
.aghls-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 16px}.aghls-stat{display:flex;flex-direction:column;gap:2px;background:#fff;border:1px solid #e2e4e7;border-radius:14px;padding:14px 16px;text-decoration:none;color:#1d2327}.aghls-stat b{font-size:26px;font-weight:600}.aghls-stat span{color:#646970}.aghls-stat.is-on{border-color:#B9824F;box-shadow:0 0 0 1px #B9824F inset}
.aghls-search{margin:0 0 14px}.aghls-search input[type=search]{width:min(420px,100%)}.aghls-muted{color:#757b82;font-size:12.5px}.aghls-empty p{font-size:14px}
.aghls-badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600}.aghls-badge.is-ok{background:#e6f4ea;color:#1e6b34}.aghls-badge.is-warn{background:#fff4e0;color:#8a5300}.aghls-badge.is-bad{background:#fde8e8;color:#9b1c1c}.aghls-badge.is-muted{background:#eef0f2;color:#50575e}
.aghls-form label{display:flex;flex-direction:column;gap:4px;font-weight:600;margin:0 0 12px}.aghls-form input[type=text],.aghls-form input[type=email],.aghls-form input[type=number],.aghls-form input[type=date],.aghls-form select,.aghls-form textarea{font-weight:400;max-width:100%}.aghls-form small{font-weight:400;color:#757b82}.aghls-form .aghls-check{flex-direction:row;align-items:center;gap:8px;font-weight:400}
.aghls-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:4px 18px}
.aghls-keycard{display:flex;flex-direction:column;gap:6px}.aghls-keycard.is-new{border-color:#B9824F;box-shadow:0 0 0 2px rgba(185,130,79,.25)}.aghls-keylabel{text-transform:uppercase;letter-spacing:.12em;font-size:11px;color:#8a5a2e;font-weight:700}.aghls-key{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.aghls-key code{font-size:20px;padding:8px 12px;border-radius:10px;background:#f6f7f7;letter-spacing:.06em}
.aghls-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:16px}.aghls-kv{border-collapse:collapse;width:100%}.aghls-kv th{text-align:left;color:#646970;font-weight:500;padding:6px 14px 6px 0;width:38%;vertical-align:top}.aghls-kv td{padding:6px 0;word-break:break-all}
.aghls-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:14px}.aghls .aghls-danger{color:#b32d2e;border-color:#e0b4b4}.aghls-off td{opacity:.55}.aghls-pre{background:#1e2226;color:#e8e6e1;padding:12px 14px;border-radius:10px;overflow:auto;white-space:pre}.aghls-dangerzone{border-color:#f0d0d0}
</style>';
	}

	public static function scripts(): void {
		if ( ! self::ours() ) {
			return;
		}
		echo "<script>(function(){document.addEventListener('click',function(e){var c=e.target.closest('[data-copy]');if(c){e.preventDefault();var t=c.getAttribute('data-copy');(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){var o=c.textContent;c.textContent='✓ " . esc_js( __( 'Másolva', 'agh-license-hub' ) ) . "';setTimeout(function(){c.textContent=o;},1400);}).catch(function(){window.prompt('" . esc_js( __( 'Másold ki:', 'agh-license-hub' ) ) . "',t);});return;}var r=e.target.closest('[data-reveal]');if(r){var k=document.querySelector('[data-key]');if(k){k.textContent=k.getAttribute('data-key');}r.remove();return;}var d=e.target.closest('[data-confirm]');if(d&&!window.confirm(d.getAttribute('data-confirm'))){e.preventDefault();}});var p=document.querySelector('select[data-sites]'),s=document.querySelector('[data-sitesinput]');if(p&&s){p.addEventListener('change',function(){s.value=p.options[p.selectedIndex].getAttribute('data-sites');});}var cy=document.querySelector('[data-cycle]'),ex=document.querySelector('[data-exp]');function sync(){if(!cy||!ex)return;ex.disabled=cy.value==='lifetime';if(cy.value!=='lifetime'&&!ex.value){var d=new Date();d.setFullYear(d.getFullYear()+(cy.value==='yearly'?1:0));if(cy.value==='monthly'){d.setMonth(d.getMonth()+1);}ex.value=d.toISOString().slice(0,10);}}if(cy){cy.addEventListener('change',function(){if(ex){ex.value='';}sync();});sync();}})();</script>";
	}
}
