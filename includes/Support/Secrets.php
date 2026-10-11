<?php
/**
 * Encrypted, server-side-only storage of API keys and other secrets.
 *
 * Keys may also be provided as wp-config.php constants (recommended):
 *   define( 'AGH_ANTHROPIC_API_KEY', '...' );
 *   define( 'AGH_MAGNIFIC_API_KEY', '...' );
 *
 * Encryption key: when AGH_SECRET_SALT is defined (recommended), the key is
 * derived from it ALONE, so rotating the WordPress salts does not affect the
 * stored secrets. Without AGH_SECRET_SALT the key is derived from the
 * WordPress AUTH/SECURE_AUTH salts – rotating those salts then makes every
 * stored secret undecryptable (the API keys read as empty and must be entered
 * again; keys defined as wp-config.php constants are not affected).
 *
 * Formats: "s1:" libsodium secretbox; "o2:" OpenSSL AES-256-CBC + HMAC-SHA256
 * with separate derived encryption/MAC keys; "o1:" legacy OpenSSL format (one
 * key for both) – read only. Values written with an older key derivation or
 * format are decrypted with the legacy key/format and re-encrypted with the
 * current one as soon as they are read (get()) or by upgrade_storage().
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Support;

defined( 'ABSPATH' ) || exit;

final class Secrets {

	private const OPTION = 'agh_secrets';

	private const CONSTANTS = array(
		'anthropic_api_key' => 'AGH_ANTHROPIC_API_KEY',
		'magnific_api_key'  => 'AGH_MAGNIFIC_API_KEY',
		'license_key'       => 'AGH_LICENSE_KEY',
	);

	/**
	 * Current master key: from AGH_SECRET_SALT only when it is defined and not
	 * empty, otherwise from the WordPress AUTH/SECURE_AUTH salts.
	 */
	private static function key(): string {
		if ( defined( 'AGH_SECRET_SALT' ) && '' !== (string) AGH_SECRET_SALT ) {
			return hash( 'sha256', 'agh-secrets|salt|' . AGH_SECRET_SALT, true );
		}
		return self::legacy_key();
	}

	/**
	 * Key derivation of earlier versions: AGH_SECRET_SALT (if any) mixed with
	 * the WordPress salts. Used to read values written before AGH_SECRET_SALT
	 * became the sole source (and equal to key() when it is not defined).
	 */
	private static function legacy_key( bool $with_salt = true ): string {
		$material = ( $with_salt && defined( 'AGH_SECRET_SALT' ) ? AGH_SECRET_SALT : '' ) . wp_salt( 'auth' ) . wp_salt( 'secure_auth' );
		return hash( 'sha256', 'agh-secrets|' . $material, true );
	}

	/**
	 * Keys to try when decrypting, current first: the current key, the legacy
	 * mixed derivation and – so that adding AGH_SECRET_SALT later keeps the
	 * stored values readable – the derivation from the WordPress salts alone.
	 *
	 * @return string[]
	 */
	private static function candidate_keys(): array {
		$keys = array( self::key() );
		foreach ( array( self::legacy_key( true ), self::legacy_key( false ) ) as $k ) {
			if ( ! in_array( $k, $keys, true ) ) {
				$keys[] = $k;
			}
		}
		return $keys;
	}

	/**
	 * Purpose-bound subkey (HKDF-style expand step: HMAC-SHA256 of a master
	 * key with a distinct label), so encryption and authentication never use
	 * the same key.
	 */
	private static function subkey( string $master, string $label ): string {
		return hash_hmac( 'sha256', 'agh-secrets|' . $label . "\x01", $master, true );
	}

	public static function source( string $name ): string {
		if ( isset( self::CONSTANTS[ $name ] ) && defined( self::CONSTANTS[ $name ] ) && '' !== (string) constant( self::CONSTANTS[ $name ] ) ) {
			return 'constant';
		}
		$all = get_option( self::OPTION, array() );
		return ! empty( $all[ $name ] ) ? 'database' : 'none';
	}

	public static function get( string $name ): string {
		if ( isset( self::CONSTANTS[ $name ] ) && defined( self::CONSTANTS[ $name ] ) ) {
			$v = (string) constant( self::CONSTANTS[ $name ] );
			if ( '' !== $v ) {
				return $v;
			}
		}
		$all = get_option( self::OPTION, array() );
		if ( empty( $all[ $name ] ) || ! is_string( $all[ $name ] ) ) {
			return '';
		}
		$res = self::decrypt( $all[ $name ] );
		if ( '' !== $res['plain'] && $res['legacy'] ) {
			// Older key derivation or format: re-encrypt with the current scheme.
			self::set( $name, $res['plain'] );
		}
		return $res['plain'];
	}

	public static function set( string $name, string $value ): void {
		$all = get_option( self::OPTION, array() );
		$all = is_array( $all ) ? $all : array();
		if ( '' === $value ) {
			unset( $all[ $name ] );
		} else {
			$all[ $name ] = self::encrypt( $value );
		}
		update_option( self::OPTION, $all, false );
	}

	public static function has( string $name ): bool {
		return '' !== self::get( $name );
	}

	/**
	 * Masked representation for display, never the full value.
	 */
	public static function mask( string $name ): string {
		$v = self::get( $name );
		if ( '' === $v ) {
			return '';
		}
		$len = strlen( $v );
		return str_repeat( '•', 8 ) . ( $len > 8 ? substr( $v, -4 ) : '' );
	}

	/**
	 * Encrypt with the current key: libsodium secretbox ("s1:") when
	 * available, otherwise AES-256-CBC + HMAC-SHA256 encrypt-then-MAC with
	 * separate derived keys ("o2:").
	 */
	private static function encrypt( string $plain ): string {
		$key = self::key();
		if ( function_exists( 'sodium_crypto_secretbox' ) ) {
			$nonce = random_bytes( SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
			$box   = sodium_crypto_secretbox( $plain, $nonce, $key );
			return 's1:' . base64_encode( $nonce . $box );
		}
		$iv  = random_bytes( 16 );
		$enc = openssl_encrypt( $plain, 'aes-256-cbc', self::subkey( $key, 'enc' ), OPENSSL_RAW_DATA, $iv );
		$mac = hash_hmac( 'sha256', 'o2' . $iv . $enc, self::subkey( $key, 'mac' ), true );
		return 'o2:' . base64_encode( $iv . $mac . $enc );
	}

	/**
	 * Decrypt with the current key first, then with the legacy key.
	 *
	 * @return array{plain:string,legacy:bool} legacy = true when the value
	 *         should be re-encrypted (legacy key or legacy "o1:" format).
	 */
	private static function decrypt( string $stored ): array {
		foreach ( self::candidate_keys() as $i => $key ) {
			$plain = self::decrypt_with( $stored, $key );
			if ( '' !== $plain ) {
				return array( 'plain' => $plain, 'legacy' => $i > 0 || 0 === strpos( $stored, 'o1:' ) );
			}
		}
		return array( 'plain' => '', 'legacy' => false );
	}

	private static function decrypt_with( string $stored, string $key ): string {
		if ( 0 === strpos( $stored, 's1:' ) && function_exists( 'sodium_crypto_secretbox_open' ) ) {
			$raw = base64_decode( substr( $stored, 3 ), true );
			if ( false === $raw || strlen( $raw ) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ) {
				return '';
			}
			$nonce = substr( $raw, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
			$box   = substr( $raw, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
			$plain = sodium_crypto_secretbox_open( $box, $nonce, $key );
			return false === $plain ? '' : $plain;
		}
		if ( 0 === strpos( $stored, 'o2:' ) || 0 === strpos( $stored, 'o1:' ) ) {
			$v2  = 0 === strpos( $stored, 'o2:' );
			$raw = base64_decode( substr( $stored, 3 ), true );
			if ( false === $raw || strlen( $raw ) < 49 ) {
				return '';
			}
			$iv      = substr( $raw, 0, 16 );
			$mac     = substr( $raw, 16, 32 );
			$enc     = substr( $raw, 48 );
			$enc_key = $v2 ? self::subkey( $key, 'enc' ) : $key;
			$expect  = $v2 ? hash_hmac( 'sha256', 'o2' . $iv . $enc, self::subkey( $key, 'mac' ), true ) : hash_hmac( 'sha256', $iv . $enc, $key, true );
			if ( ! hash_equals( $expect, $mac ) ) {
				return '';
			}
			$plain = openssl_decrypt( $enc, 'aes-256-cbc', $enc_key, OPENSSL_RAW_DATA, $iv );
			return false === $plain ? '' : $plain;
		}
		return '';
	}

	/**
	 * One-off migration: re-encrypt every stored value that still uses the
	 * legacy key derivation or the legacy "o1:" format with the current key
	 * and format. Idempotent and safe to call on every plugin upgrade.
	 *
	 * @return int Number of re-encrypted values.
	 */
	public static function upgrade_storage(): int {
		$all = get_option( self::OPTION, array() );
		if ( ! is_array( $all ) ) {
			return 0;
		}
		$n = 0;
		foreach ( $all as $name => $stored ) {
			if ( ! is_string( $stored ) ) {
				continue;
			}
			$res = self::decrypt( $stored );
			if ( '' !== $res['plain'] && $res['legacy'] ) {
				$all[ $name ] = self::encrypt( $res['plain'] );
				$n++;
			}
		}
		if ( $n > 0 ) {
			update_option( self::OPTION, $all, false );
		}
		return $n;
	}
}
