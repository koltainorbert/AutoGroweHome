<?php
/**
 * CAD/BIM interface. The canonical exchange format is the agh-building-v1
 * JSON (see docs/FEJLESZTOI-DOKUMENTACIO.md). This class adds a minimal DXF
 * R12 export (wall outlines, room rectangles, openings, labels) readable by
 * common CAD tools. Further exporters (IFC, etc.) can hook in via the
 * "agh_cad_exporters" filter; every registered exporter is run by
 * documents(), which the pipeline uses to store the concept's CAD files.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Generation;

use AutoGroweHome\License\Features;
use AutoGroweHome\Support\Logger;

defined( 'ABSPATH' ) || exit;

final class CadExport {

	/**
	 * Registered exporters.
	 *
	 * Filter "agh_cad_exporters": array id => array(
	 *   'label'    => string   Display label of the stored document,
	 *   'callback' => callable function( array $building_model ): string,
	 *   'mime'     => string   (optional, default application/octet-stream),
	 *   'ext'      => string   (optional file extension, default = id),
	 *   'feature'  => string   (optional licence feature; default
	 *                           'export_advanced', '' = always available),
	 * ).
	 */
	public static function exporters(): array {
		return (array) apply_filters(
			'agh_cad_exporters',
			array(
				'json' => array(
					'label'    => __( 'Épület-adatmodell (JSON, CAD/BIM-interfész)', 'autogrowehome' ),
					'callback' => static fn( array $m ) => (string) wp_json_encode( $m, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE ),
					'mime'     => 'application/json',
					'ext'      => 'json',
					'feature'  => '',
				),
				'dxf'  => array(
					'label'    => __( 'Alaprajzi vonalrajz (DXF R12)', 'autogrowehome' ),
					'callback' => array( __CLASS__, 'dxf' ),
					'mime'     => 'application/dxf',
					'ext'      => 'dxf',
					'feature'  => 'export_advanced',
				),
			)
		);
	}

	/**
	 * Run every registered exporter for one building model.
	 *
	 * The JSON exporter is stored under the historical asset view
	 * "building_json"; the others under their (sanitized) id. Exporters whose
	 * licence feature is not enabled, that are not callable, return an empty
	 * string or throw are skipped (the latter is logged).
	 *
	 * @return array<string,array{label:string,mime:string,ext:string,content:string}> Keyed by asset view.
	 */
	public static function documents( array $m ): array {
		$out = array();
		foreach ( self::exporters() as $id => $ex ) {
			$id = sanitize_key( (string) $id );
			if ( '' === $id || ! is_array( $ex ) || ! is_callable( $ex['callback'] ?? null ) ) {
				continue;
			}
			$feature = (string) ( $ex['feature'] ?? 'export_advanced' );
			if ( '' !== $feature && ! Features::enabled( $feature ) ) {
				continue;
			}
			try {
				$content = (string) call_user_func( $ex['callback'], $m );
			} catch ( \Throwable $e ) {
				Logger::warning( 'cad', 'CAD exporter failed', array( 'exporter' => $id, 'error' => $e->getMessage() ) );
				continue;
			}
			if ( '' === $content ) {
				continue;
			}
			$ext  = sanitize_key( (string) ( $ex['ext'] ?? $id ) );
			$mime = (string) ( $ex['mime'] ?? 'application/octet-stream' );
			$out[ 'json' === $id ? 'building_json' : $id ] = array(
				'label'   => sanitize_text_field( (string) ( $ex['label'] ?? $id ) ),
				'mime'    => preg_match( '#^[a-z0-9.+-]+/[a-z0-9.+-]+$#i', $mime ) ? $mime : 'application/octet-stream',
				'ext'     => '' !== $ext ? $ext : 'bin',
				'content' => $content,
			);
		}
		return $out;
	}

	public static function dxf( array $m ): string {
		$out   = array( '0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '6', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES' );
		$line  = static function ( float $x1, float $y1, float $x2, float $y2, string $layer ) use ( &$out ) {
			// DXF Y axis points up: flip.
			array_push( $out, '0', 'LINE', '8', $layer, '10', self::f( $x1 ), '20', self::f( -$y1 ), '30', '0', '11', self::f( $x2 ), '21', self::f( -$y2 ), '31', '0' );
		};
		$rect  = static function ( float $x, float $y, float $w, float $h, string $layer ) use ( $line ) {
			$line( $x, $y, $x + $w, $y, $layer );
			$line( $x + $w, $y, $x + $w, $y + $h, $layer );
			$line( $x + $w, $y + $h, $x, $y + $h, $layer );
			$line( $x, $y + $h, $x, $y, $layer );
		};
		foreach ( $m['levels'] as $lv ) {
			$l   = (int) $lv['index'];
			$off = $l * ( (float) $m['length'] + 5 );
			foreach ( $m['parts'] as $p ) {
				$rect( $p['x'], $p['y'] + $off, $p['w'], $p['h'], 'WALL_OUTER_L' . $l );
			}
			foreach ( $m['rooms'] as $r ) {
				if ( (int) $r['level'] !== $l ) {
					continue;
				}
				$rect( $r['x'], $r['y'] + $off, $r['w'], $r['h'], 'ROOMS_L' . $l );
				$label = remove_accents( $r['name'] ) . ' ' . number_format( $r['area'], 1, '.', '' ) . ' m2';
				array_push( $out, '0', 'TEXT', '8', 'TEXT_L' . $l, '10', self::f( $r['x'] + 0.2 ), '20', self::f( -( $r['y'] + $off + $r['h'] / 2 ) ), '30', '0', '40', '0.25', '1', substr( preg_replace( '/[^\x20-\x7E]/', '', $label ), 0, 60 ) );
			}
			foreach ( $m['openings'] as $o ) {
				if ( (int) $o['level'] !== $l ) {
					continue;
				}
				$hw = (float) $o['width'] / 2;
				if ( 'h' === $o['orient'] ) {
					$line( $o['x'] - $hw, $o['y'] + $off, $o['x'] + $hw, $o['y'] + $off, 'OPENINGS_L' . $l );
				} else {
					$line( $o['x'], $o['y'] - $hw + $off, $o['x'], $o['y'] + $hw + $off, 'OPENINGS_L' . $l );
				}
			}
		}
		array_push( $out, '0', 'ENDSEC', '0', 'EOF' );
		return implode( "\r\n", $out ) . "\r\n";
	}

	private static function f( float $v ): string {
		return number_format( $v, 4, '.', '' );
	}
}
