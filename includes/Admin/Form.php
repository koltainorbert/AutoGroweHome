<?php
/**
 * Spec-driven settings form renderer + sanitizer for the admin pages.
 *
 * Spec item: [key, type, label, help?, extra?]
 * Types: text, textarea, number, float, bool, select, multicheck, color, url, email, secret, media, json, code.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Admin;

use AutoGroweHome\Support\Secrets;
use AutoGroweHome\Support\Settings;

defined( 'ABSPATH' ) || exit;

final class Form {

	public static function render( string $group, array $spec ): void {
		echo '<table class="form-table agh-form-table" role="presentation"><tbody>';
		foreach ( $spec as $f ) {
			list( $key, $type, $label ) = $f;
			$help  = $f[3] ?? '';
			$extra = $f[4] ?? array();
			$name  = 'agh[' . $group . '][' . $key . ']';
			$id    = 'agh-' . $group . '-' . $key;
			$val   = 'secret' === $type ? '' : Settings::get( $group . '.' . $key );
			if ( 'heading' === $type ) {
				echo '<tr><th colspan="2"><h3 class="agh-admin-subhead">' . esc_html( $label ) . '</h3>' . ( $help ? '<p class="description">' . wp_kses_post( $help ) . '</p>' : '' ) . '</th></tr>';
				continue;
			}
			echo '<tr><th scope="row"><label for="' . esc_attr( $id ) . '">' . esc_html( $label ) . '</label></th><td>';
			switch ( $type ) {
				case 'textarea':
				case 'code':
					echo '<textarea class="large-text' . ( 'code' === $type ? ' code' : '' ) . '" rows="' . (int) ( $extra['rows'] ?? 5 ) . '" id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '">' . esc_textarea( is_scalar( $val ) ? (string) $val : '' ) . '</textarea>';
					break;
				case 'json':
					echo '<textarea class="large-text code" rows="' . (int) ( $extra['rows'] ?? 6 ) . '" id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '">' . esc_textarea( wp_json_encode( $val, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE ) ) . '</textarea>';
					break;
				case 'number':
				case 'float':
					echo '<input type="number" class="small-text" style="width:110px" id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '" value="' . esc_attr( (string) $val ) . '" step="' . esc_attr( (string) ( $extra['step'] ?? ( 'float' === $type ? '0.01' : '1' ) ) ) . '"' . ( isset( $extra['min'] ) ? ' min="' . esc_attr( (string) $extra['min'] ) . '"' : '' ) . ( isset( $extra['max'] ) ? ' max="' . esc_attr( (string) $extra['max'] ) . '"' : '' ) . '> ' . esc_html( $extra['unit'] ?? '' );
					break;
				case 'bool':
					echo '<label class="agh-toggle"><input type="hidden" name="' . esc_attr( $name ) . '" value="0"><input type="checkbox" id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '" value="1" ' . checked( (bool) $val, true, false ) . '><span></span></label>';
					break;
				case 'select':
					echo '<select id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '">';
					foreach ( (array) ( $extra['options'] ?? array() ) as $ov => $ol ) {
						echo '<option value="' . esc_attr( (string) $ov ) . '" ' . selected( (string) $val, (string) $ov, false ) . '>' . esc_html( $ol ) . '</option>';
					}
					echo '</select>';
					break;
				case 'multicheck':
					echo '<input type="hidden" name="' . esc_attr( $name ) . '[]" value="">';
					echo '<div class="agh-multicheck">';
					foreach ( (array) ( $extra['options'] ?? array() ) as $ov => $ol ) {
						echo '<label><input type="checkbox" name="' . esc_attr( $name ) . '[]" value="' . esc_attr( (string) $ov ) . '" ' . checked( in_array( (string) $ov, array_map( 'strval', (array) $val ), true ), true, false ) . '> ' . esc_html( $ol ) . '</label>';
					}
					echo '</div>';
					break;
				case 'color':
					echo '<input type="text" class="agh-color-field" id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '" value="' . esc_attr( (string) $val ) . '" data-default-color="' . esc_attr( (string) ( Settings::defaults()[ $group ][ $key ] ?? '' ) ) . '">';
					break;
				case 'media':
					$url = $val ? wp_get_attachment_image_url( (int) $val, 'thumbnail' ) : '';
					echo '<div class="agh-media"><input type="hidden" id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '" value="' . esc_attr( (string) (int) $val ) . '"><img src="' . esc_url( (string) $url ) . '" alt="" ' . ( $url ? '' : 'hidden' ) . '><button type="button" class="button agh-media-pick">' . esc_html__( 'Kiválasztás', 'autogrowehome' ) . '</button> <button type="button" class="button-link agh-media-clear">' . esc_html__( 'Eltávolítás', 'autogrowehome' ) . '</button></div>';
					break;
				case 'secret':
					$sname  = (string) ( $extra['secret'] ?? $key );
					$source = Secrets::source( $sname );
					$mask   = Secrets::mask( $sname );
					if ( 'constant' === $source ) {
						echo '<code>' . esc_html( $mask ) . '</code> <span class="description">' . esc_html__( 'wp-config.php konstansból (itt nem módosítható).', 'autogrowehome' ) . '</span>';
					} else {
						echo '<input type="password" autocomplete="new-password" class="regular-text" id="' . esc_attr( $id ) . '" name="agh_secret[' . esc_attr( $sname ) . ']" value="" placeholder="' . esc_attr( '' !== $mask ? $mask : __( 'Nincs beállítva', 'autogrowehome' ) ) . '"> ';
						if ( '' !== $mask ) {
							echo '<label><input type="checkbox" name="agh_secret_clear[' . esc_attr( $sname ) . ']" value="1"> ' . esc_html__( 'Kulcs törlése', 'autogrowehome' ) . '</label>';
						}
						echo '<p class="description">' . esc_html__( 'Titkosítva tárolva; a mező üresen hagyva megtartja a meglévő kulcsot. Soha nem jelenik meg a böngészőben.', 'autogrowehome' ) . '</p>';
					}
					break;
				case 'url':
				case 'email':
				case 'text':
				default:
					echo '<input type="' . esc_attr( 'url' === $type ? 'url' : ( 'email' === $type ? 'email' : 'text' ) ) . '" class="regular-text" id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '" value="' . esc_attr( is_scalar( $val ) ? (string) $val : '' ) . '"' . ( isset( $extra['placeholder'] ) ? ' placeholder="' . esc_attr( $extra['placeholder'] ) . '"' : '' ) . '>';
			}
			if ( '' !== $help ) {
				echo '<p class="description">' . wp_kses_post( $help ) . '</p>';
			}
			echo '</td></tr>';
		}
		echo '</tbody></table>';
	}

	/**
	 * Sanitize posted values for one group according to its spec and save.
	 *
	 * @param array $posted Already unslashed input (the caller runs wp_unslash()
	 *                      once on $_POST); it must not be unslashed again here,
	 *                      or backslashes in text settings would be lost.
	 * @return array The sanitized values handed to Settings::update_group()
	 *               (the stored value can still differ: provider URLs are
	 *               reset to the factory default when not https).
	 */
	public static function save( string $group, array $spec, array $posted ): array {
		$out = array();
		foreach ( $spec as $f ) {
			list( $key, $type ) = $f;
			$extra = $f[4] ?? array();
			if ( in_array( $type, array( 'heading', 'secret' ), true ) ) {
				continue;
			}
			$raw = $posted[ $key ] ?? null;
			switch ( $type ) {
				case 'bool':
					$out[ $key ] = ! empty( $raw ) && '0' !== $raw;
					break;
				case 'number':
					$v = (int) $raw;
					if ( isset( $extra['min'] ) ) {
						$v = max( (int) $extra['min'], $v );
					}
					if ( isset( $extra['max'] ) ) {
						$v = min( (int) $extra['max'], $v );
					}
					$out[ $key ] = $v;
					break;
				case 'float':
					$v = (float) str_replace( ',', '.', (string) $raw );
					if ( isset( $extra['min'] ) ) {
						$v = max( (float) $extra['min'], $v );
					}
					if ( isset( $extra['max'] ) ) {
						$v = min( (float) $extra['max'], $v );
					}
					$out[ $key ] = $v;
					break;
				case 'select':
					$opts        = array_map( 'strval', array_keys( (array) ( $extra['options'] ?? array() ) ) );
					$out[ $key ] = in_array( (string) $raw, $opts, true ) ? (string) $raw : ( $opts[0] ?? '' );
					break;
				case 'multicheck':
					$opts        = array_map( 'strval', array_keys( (array) ( $extra['options'] ?? array() ) ) );
					$out[ $key ] = array_values( array_intersect( array_map( 'strval', array_filter( (array) $raw ) ), $opts ) );
					break;
				case 'color':
					$out[ $key ] = preg_match( '/^#[0-9a-fA-F]{6}$/', (string) $raw ) ? strtoupper( (string) $raw ) : (string) ( Settings::defaults()[ $group ][ $key ] ?? '#000000' );
					break;
				case 'url':
					$out[ $key ] = esc_url_raw( trim( (string) $raw ) );
					break;
				case 'email':
					$out[ $key ] = sanitize_email( (string) $raw );
					break;
				case 'media':
					$out[ $key ] = absint( $raw );
					break;
				case 'json':
					$d           = json_decode( (string) $raw, true );
					$out[ $key ] = is_array( $d ) ? $d : ( Settings::get( $group . '.' . $key ) ?? array() );
					break;
				case 'textarea':
				case 'code':
					$out[ $key ] = sanitize_textarea_field( (string) $raw );
					break;
				default:
					$out[ $key ] = sanitize_text_field( (string) $raw );
			}
		}
		Settings::update_group( $group, $out );
		return $out;
	}

	/**
	 * Store posted secrets (only non-empty values replace; checkbox clears).
	 */
	public static function save_secrets( array $posted, array $clear ): void {
		foreach ( array( 'anthropic_api_key', 'magnific_api_key' ) as $name ) {
			if ( ! empty( $clear[ $name ] ) ) {
				Secrets::set( $name, '' );
				continue;
			}
			$v = isset( $posted[ $name ] ) ? trim( (string) wp_unslash( $posted[ $name ] ) ) : '';
			if ( '' !== $v ) {
				Secrets::set( $name, preg_replace( '/[^\x21-\x7E]/', '', $v ) );
			}
		}
	}
}
