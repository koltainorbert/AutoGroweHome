<?php
/**
 * Keys and signatures of the licence centre.
 *
 * - Ed25519 key pair: the secret key signs every API answer; the public key goes into the
 *   AutoGroweHome plugin (AGH_LICENSE_PUBKEY or its Licence page). The secret key is stored
 *   encrypted in the database (or given as the AGHLS_SECRET_KEY constant in wp-config.php).
 * - Pepper: server-side secret for the HMAC of licence keys and IP addresses (AGHLS_PEPPER
 *   constant or generated option). Licence keys are looked up by their HMAC only.
 * - Licence keys are additionally stored encrypted so the admin can show and resend them.
 *
 * WordPress ships sodium_compat, so the sodium functions exist even without the PHP extension.
 *
 * @package AGHLicenseHub
 */

defined( 'ABSPATH' ) || exit;

final class AGHLS_Crypto {

	const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

	/** Generated secrets: pepper, encrypted signing key, public key. */
	private static function secrets(): array {
		$o = get_option( 'aghls_secrets', array() );
		return is_array( $o ) ? $o : array();
	}

	public static function ensure_keys(): void {
		$o = self::secrets();
		$changed = false;
		if ( empty( $o['pepper'] ) ) {
			$o['pepper'] = bin2hex( random_bytes( 32 ) );
			$changed     = true;
		}
		if ( empty( $o['public'] ) || empty( $o['secret'] ) ) {
			$o       = array_merge( $o, self::new_keypair( $o['pepper'] ) );
			$changed = true;
		}
		if ( $changed ) {
			update_option( 'aghls_secrets', $o, false );
		}
	}

	private static function new_keypair( string $pepper ): array {
		$kp = sodium_crypto_sign_keypair();
		return array(
			'public'     => base64_encode( sodium_crypto_sign_publickey( $kp ) ),
			'secret'     => self::seal( sodium_crypto_sign_secretkey( $kp ), $pepper ),
			'created_at' => gmdate( 'Y-m-d H:i:s' ),
		);
	}

	/** New signing key pair (all installed plugins must receive the new public key). */
	public static function rotate_keys(): void {
		$o = self::secrets();
		$o = array_merge( $o, self::new_keypair( self::pepper() ) );
		update_option( 'aghls_secrets', $o, false );
	}

	public static function pepper(): string {
		if ( defined( 'AGHLS_PEPPER' ) && strlen( (string) AGHLS_PEPPER ) >= 32 ) {
			return (string) AGHLS_PEPPER;
		}
		self::ensure_keys();
		return (string) self::secrets()['pepper'];
	}

	public static function public_key(): string {
		if ( defined( 'AGHLS_SECRET_KEY' ) ) {
			$sk = base64_decode( (string) AGHLS_SECRET_KEY, true );
			if ( false !== $sk && SODIUM_CRYPTO_SIGN_SECRETKEYBYTES === strlen( $sk ) ) {
				return base64_encode( sodium_crypto_sign_publickey_from_secretkey( $sk ) );
			}
		}
		self::ensure_keys();
		return (string) self::secrets()['public'];
	}

	public static function key_created_at(): string {
		return (string) ( self::secrets()['created_at'] ?? '' );
	}

	private static function secret_key(): string {
		if ( defined( 'AGHLS_SECRET_KEY' ) ) {
			$sk = base64_decode( (string) AGHLS_SECRET_KEY, true );
			if ( false !== $sk && SODIUM_CRYPTO_SIGN_SECRETKEYBYTES === strlen( $sk ) ) {
				return $sk;
			}
		}
		self::ensure_keys();
		$sk = self::open( (string) self::secrets()['secret'], self::pepper() );
		if ( SODIUM_CRYPTO_SIGN_SECRETKEYBYTES !== strlen( $sk ) ) {
			throw new RuntimeException( 'Signing key unavailable' );
		}
		return $sk;
	}

	/** Canonical JSON exactly as the AutoGroweHome plugin builds it (LicenseManager::canonical). */
	public static function canonical( array $data ): string {
		ksort( $data );
		return (string) wp_json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
	}

	public static function sign( array $data ): string {
		return base64_encode( sodium_crypto_sign_detached( self::canonical( $data ), self::secret_key() ) );
	}

	public static function verify( array $data, string $sig_b64 ): bool {
		$sig = base64_decode( $sig_b64, true );
		$pub = base64_decode( self::public_key(), true );
		return false !== $sig && false !== $pub && SODIUM_CRYPTO_SIGN_BYTES === strlen( $sig ) && sodium_crypto_sign_verify_detached( $sig, self::canonical( $data ), $pub );
	}

	/* -------------------------------------------------------------- licence keys */

	/** New key: AGH-XXXXX-XXXXX-XXXXX-XXXXX (no ambiguous characters). */
	public static function new_license_key(): string {
		$a = self::KEY_ALPHABET;
		$groups = array();
		for ( $g = 0; $g < 4; $g++ ) {
			$s = '';
			for ( $i = 0; $i < 5; $i++ ) {
				$s .= $a[ random_int( 0, strlen( $a ) - 1 ) ];
			}
			$groups[] = $s;
		}
		return 'AGH-' . implode( '-', $groups );
	}

	public static function normalize_key( string $key ): string {
		return strtoupper( trim( $key ) );
	}

	public static function key_hash( string $key ): string {
		return hash_hmac( 'sha256', self::normalize_key( $key ), self::pepper() );
	}

	public static function ip_hash( string $ip ): string {
		return substr( hash_hmac( 'sha256', $ip, self::pepper() ), 0, 32 );
	}

	/** Short, safe-to-show form of a key: AGH-K7P2M-…-Q9X4D */
	public static function key_hint( string $key ): string {
		$k = self::normalize_key( $key );
		return substr( $k, 0, 9 ) . '…' . substr( $k, -5 );
	}

	/* -------------------------------------------------------------- symmetric encryption */

	private static function box_key( string $pepper ): string {
		return sodium_crypto_generichash( 'aghls|' . $pepper . '|' . wp_salt( 'auth' ), '', SODIUM_CRYPTO_SECRETBOX_KEYBYTES );
	}

	public static function seal( string $plain, ?string $pepper = null ): string {
		$nonce = random_bytes( SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
		return base64_encode( $nonce . sodium_crypto_secretbox( $plain, $nonce, self::box_key( $pepper ?? self::pepper() ) ) );
	}

	public static function open( string $sealed, ?string $pepper = null ): string {
		$raw = base64_decode( $sealed, true );
		if ( false === $raw || strlen( $raw ) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ) {
			return '';
		}
		$plain = sodium_crypto_secretbox_open( substr( $raw, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ), substr( $raw, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ), self::box_key( $pepper ?? self::pepper() ) );
		return false === $plain ? '' : $plain;
	}
}
