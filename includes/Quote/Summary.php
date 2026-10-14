<?php
/**
 * Human-readable parameter summary (HTML/JSON/text) for packages and admin.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Quote;

use AutoGroweHome\Catalog\Catalog;
use AutoGroweHome\Params\Definitions;
use AutoGroweHome\Params\Registry;
use AutoGroweHome\Params\Validator;
use AutoGroweHome\Support\Settings;

defined( 'ABSPATH' ) || exit;

final class Summary {

	/**
	 * Human value of one parameter.
	 */
	public static function value( array $def, $v ): string {
		switch ( $def['type'] ) {
			case 'toggle':
				return $v ? __( 'igen', 'autogrowehome' ) : __( 'nem', 'autogrowehome' );
			case 'select':
			case 'cards':
				return (string) ( $def['options'][ (string) $v ] ?? $v );
			case 'catalog':
				$item = '' !== (string) $v ? Catalog::get( $def['catalog'], (string) $v ) : null;
				return $item ? $item['name'] : '–';
			case 'multiselect':
				$labels = array();
				foreach ( (array) $v as $x ) {
					$labels[] = $def['options'][ $x ] ?? $x;
				}
				return $labels ? implode( ', ', $labels ) : '–';
			case 'color':
				return (string) $v;
			case 'image':
				return '' !== (string) $v ? __( 'feltöltve', 'autogrowehome' ) : '–';
			case 'rooms':
				return sprintf( /* translators: %d: count */ _n( '%d helyiség', '%d helyiség', count( (array) $v ), 'autogrowehome' ), count( (array) $v ) );
			default:
				if ( is_numeric( $v ) ) {
					return number_format_i18n( (float) $v, floor( (float) $v ) == (float) $v ? 0 : 1 ) . ( ! empty( $def['unit'] ) ? ' ' . $def['unit'] : '' );
				}
				return '' === (string) $v ? '–' : (string) $v;
		}
	}

	/**
	 * Grouped rows: category label => [[label, value], ...].
	 */
	public static function rows( array $c ): array {
		$cats = Definitions::categories();
		$out  = array();
		foreach ( Registry::fields() as $id => $def ) {
			if ( 'rooms' === $def['type'] || 'roomitems' === $def['type'] || 'layout' === $def['type'] || ! array_key_exists( $id, $c ) || ! Validator::visible( $def, $c ) ) {
				continue;
			}
			$cat           = $cats[ $def['category'] ]['label'] ?? $def['category'];
			$out[ $cat ][] = array( $def['label'], self::value( $def, $c[ $id ] ), 'color' === $def['type'] ? (string) $c[ $id ] : '' );
		}
		return $out;
	}

	public static function html( array $project, ?array $concept, ?array $quote = null ): string {
		$c     = $project['config'];
		$brand = esc_html( (string) Settings::get( 'general.plugin_name', 'AutoGroweHome' ) );
		$h     = '<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>' . esc_html__( 'Paraméter-összesítő', 'autogrowehome' ) . '</title>';
		$h    .= '<style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1E2226;max-width:960px;margin:40px auto;padding:0 20px;line-height:1.5}h1{font-weight:300;letter-spacing:.12em;text-transform:uppercase}h2{font-size:15px;letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:6px;margin-top:32px}table{width:100%;border-collapse:collapse}td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}td:first-child{width:40%;color:#5A5F64}.sw{display:inline-block;width:14px;height:14px;border-radius:4px;border:1px solid #ccc;vertical-align:middle;margin-right:6px}.warn{background:#FFF6E8;border-left:3px solid #D69A2D;padding:10px 14px;margin:8px 0}.disc{background:#FBEDEA;border-left:3px solid #C2553F;padding:10px 14px;margin:24px 0;font-size:14px}</style></head><body>';
		$h    .= '<p style="letter-spacing:.2em;color:#B9824F;font-size:12px">' . $brand . '</p>';
		$h    .= '<h1>' . esc_html__( 'Paraméter-összesítő', 'autogrowehome' ) . '</h1>';
		$h    .= '<p>' . esc_html__( 'Projektazonosító', 'autogrowehome' ) . ': <strong>' . esc_html( $project['uuid'] ) . '</strong><br>';
		if ( $concept ) {
			$h .= esc_html__( 'Kiválasztott változat', 'autogrowehome' ) . ': <strong>' . esc_html( $concept['variant'] . ' – ' . $concept['title'] ) . '</strong><br>';
		}
		$h .= esc_html__( 'Dátum', 'autogrowehome' ) . ': ' . esc_html( wp_date( 'Y-m-d H:i' ) ) . '</p>';
		$h .= '<div class="disc">' . esc_html__( 'A látványtervek mesterséges intelligenciával készült koncepcionális vizualizációk. A tervvázlatok strukturált adatokból generált koncepciótervek, nem engedélyezési és nem kiviteli dokumentációk; szakági tervező ellenőrzése szükséges.', 'autogrowehome' ) . '</div>';

		if ( $concept ) {
			$b  = $concept['brief'];
			$h .= '<h2>' . esc_html__( 'Koncepció', 'autogrowehome' ) . '</h2><p><strong>' . esc_html( (string) ( $b['tagline'] ?? '' ) ) . '</strong></p><p>' . esc_html( (string) ( $b['exterior_description'] ?? '' ) ) . '</p>';
			if ( ! empty( $b['warnings'] ) ) {
				foreach ( (array) $b['warnings'] as $w ) {
					$h .= '<div class="warn">' . esc_html( (string) $w ) . '</div>';
				}
			}
			$m  = $concept['building'];
			$h .= '<table><tr><td>' . esc_html__( 'Befoglaló méret', 'autogrowehome' ) . '</td><td>' . esc_html( number_format_i18n( (float) $m['width'], 2 ) . ' × ' . number_format_i18n( (float) $m['length'], 2 ) . ' m' ) . '</td></tr>';
			$h .= '<tr><td>' . esc_html__( 'Tervezett nettó alapterület', 'autogrowehome' ) . '</td><td>' . esc_html( number_format_i18n( (float) $m['checks']['net_planned'], 1 ) . ' m²' ) . '</td></tr>';
			$h .= '<tr><td>' . esc_html__( 'Beépített alapterület', 'autogrowehome' ) . '</td><td>' . esc_html( number_format_i18n( (float) $m['checks']['footprint'], 1 ) . ' m²' ) . '</td></tr>';
			$h .= '<tr><td>' . esc_html__( 'Gerincmagasság (becsült)', 'autogrowehome' ) . '</td><td>' . esc_html( number_format_i18n( (float) $m['roof']['ridge_height'], 2 ) . ' m' ) . '</td></tr></table>';

			$h .= '<h2>' . esc_html__( 'Helyiséglista', 'autogrowehome' ) . '</h2><table>';
			$levels = $m['levels'];
			foreach ( $m['rooms'] as $r ) {
				$h .= '<tr><td>' . esc_html( ( $levels[ $r['level'] ]['name'] ?? '' ) . ' · ' . $r['name'] ) . '</td><td>' . esc_html( number_format_i18n( (float) $r['area'], 1 ) . ' m² (' . number_format_i18n( (float) $r['w'], 2 ) . ' × ' . number_format_i18n( (float) $r['h'], 2 ) . ' m)' ) . '</td></tr>';
			}
			$h .= '</table>';
		}

		foreach ( self::rows( $c ) as $cat => $rows ) {
			$h .= '<h2>' . esc_html( $cat ) . '</h2><table>';
			foreach ( $rows as $r ) {
				$sw = '' !== $r[2] ? '<span class="sw" style="background:' . esc_attr( $r[2] ) . '"></span>' : '';
				$h .= '<tr><td>' . esc_html( $r[0] ) . '</td><td>' . $sw . esc_html( $r[1] ) . '</td></tr>';
			}
			$h .= '</table>';
		}
		if ( $quote ) {
			$h .= '<h2>' . esc_html__( 'Ajánlatkérés', 'autogrowehome' ) . '</h2><table>';
			foreach ( array( 'full_name' => __( 'Név', 'autogrowehome' ), 'email' => __( 'E-mail', 'autogrowehome' ), 'phone' => __( 'Telefon', 'autogrowehome' ), 'city' => __( 'Település', 'autogrowehome' ), 'site_location' => __( 'Építési helyszín', 'autogrowehome' ), 'start_period' => __( 'Tervezett kezdés', 'autogrowehome' ), 'budget' => __( 'Költségkeret', 'autogrowehome' ), 'note' => __( 'Megjegyzés', 'autogrowehome' ) ) as $k => $l ) {
				$h .= '<tr><td>' . esc_html( $l ) . '</td><td>' . nl2br( esc_html( (string) ( $quote[ $k ] ?? '' ) ) ) . '</td></tr>';
			}
			$h .= '</table>';
		}
		$h .= '</body></html>';
		return $h;
	}

	public static function json( array $project, ?array $concept ): string {
		$out = array(
			'project_id' => $project['uuid'],
			'concept'    => $concept ? array( 'variant' => $concept['variant'], 'title' => $concept['title'], 'brief' => $concept['brief'] ) : null,
			'parameters' => $project['config'],
			'prompt_version' => $project['prompt_version'],
			'generated'  => gmdate( 'c' ),
		);
		return (string) wp_json_encode( $out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE );
	}
}
