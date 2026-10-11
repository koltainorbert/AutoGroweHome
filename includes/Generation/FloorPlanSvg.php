<?php
/**
 * Deterministic SVG drawing sheets generated from the building data model.
 *
 * Sheets: floor plan per level, furnished plan, dimensioned plan, roof plan,
 * elevations (4 in one sheet), conceptual section, room list.
 * Every sheet carries a title block with the "concept – not a permit or
 * construction document" disclaimer.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Generation;

use AutoGroweHome\Support\Settings;

defined( 'ABSPATH' ) || exit;

final class FloorPlanSvg {

	private const W  = 1680;
	private const H  = 1188;
	private const PAD = 70;
	private const TB_H = 150;

	private const ZONE_FILL = array(
		'day'         => '#F4EEE5',
		'night'       => '#EEF1F3',
		'wet'         => '#E5EEF2',
		'service'     => '#EFEEE9',
		'circulation' => '#F8F6F2',
	);

	/** @var array */
	private $m;
	/** @var array */
	private $c;
	/** @var array */
	private $meta;
	/** @var float */
	private $s = 30.0;
	/** @var float */
	private $ox = 0.0;
	/** @var float */
	private $oy = 0.0;

	public function __construct( array $model, array $config, array $meta ) {
		$this->m    = $model;
		$this->c    = $config;
		$this->meta = $meta;
	}

	/**
	 * @return array<int,array{view:string,label:string,svg:string}>
	 */
	public function all(): array {
		$out = array();
		foreach ( $this->m['levels'] as $lv ) {
			$i     = (int) $lv['index'];
			$out[] = array( 'view' => 'plan_' . $i, 'label' => sprintf( /* translators: %s: level */ __( 'Alaprajz – %s', 'autogrowehome' ), $lv['name'] ), 'svg' => $this->plan( $i, 'plain' ) );
			$out[] = array( 'view' => 'furnished_' . $i, 'label' => sprintf( /* translators: %s: level */ __( 'Bútorozott alaprajz – %s', 'autogrowehome' ), $lv['name'] ), 'svg' => $this->plan( $i, 'furnished' ) );
			$out[] = array( 'view' => 'dimensioned_' . $i, 'label' => sprintf( /* translators: %s: level */ __( 'Méretezett alaprajzi koncepció – %s', 'autogrowehome' ), $lv['name'] ), 'svg' => $this->plan( $i, 'dimensioned' ) );
		}
		$out[] = array( 'view' => 'roof', 'label' => __( 'Tetőfelülnézet', 'autogrowehome' ), 'svg' => $this->roof_plan() );
		$out[] = array( 'view' => 'elevations', 'label' => __( 'Homlokzati nézetek', 'autogrowehome' ), 'svg' => $this->elevations() );
		$out[] = array( 'view' => 'section', 'label' => __( 'Metszeti koncepció', 'autogrowehome' ), 'svg' => $this->section() );
		$out[] = array( 'view' => 'roomlist', 'label' => __( 'Helyiséglista', 'autogrowehome' ), 'svg' => $this->room_list() );
		return $out;
	}

	/* ------------------------------------------------------------------ helpers */

	private static function e( $s ): string {
		return htmlspecialchars( (string) $s, ENT_QUOTES | ENT_XML1, 'UTF-8' );
	}

	private static function n( float $v ): string {
		return rtrim( rtrim( number_format( $v, 2, '.', '' ), '0' ), '.' );
	}

	private function X( float $x ): string {
		return self::n( $this->ox + $x * $this->s );
	}

	private function Y( float $y ): string {
		return self::n( $this->oy + $y * $this->s );
	}

	private function L( float $len ): string {
		return self::n( $len * $this->s );
	}

	private static function fmt_m( float $v ): string {
		return number_format( $v, 2, ',', '' );
	}

	private static function fmt_area( float $v ): string {
		return number_format( $v, 1, ',', ' ' ) . ' m²';
	}

	private function fit( float $minx, float $miny, float $maxx, float $maxy, float $margin_px = 110 ): void {
		$aw       = self::W - 2 * self::PAD - 2 * $margin_px;
		$ah       = self::H - 2 * self::PAD - self::TB_H - 2 * $margin_px;
		$bw       = max( 1, $maxx - $minx );
		$bh       = max( 1, $maxy - $miny );
		$this->s  = min( $aw / $bw, $ah / $bh, 70 );
		$this->ox = self::PAD + $margin_px + ( $aw - $bw * $this->s ) / 2 - $minx * $this->s;
		$this->oy = self::PAD + $margin_px + ( $ah - $bh * $this->s ) / 2 - $miny * $this->s;
	}

	private function bounds( bool $with_site = true ): array {
		$minx = 0.0;
		$miny = 0.0;
		$maxx = (float) $this->m['width'];
		$maxy = (float) $this->m['length'];
		if ( $with_site ) {
			foreach ( array( 'terrace', 'garage' ) as $k ) {
				if ( ! empty( $this->m[ $k ] ) ) {
					$r    = $this->m[ $k ];
					$minx = min( $minx, $r['x'] );
					$miny = min( $miny, $r['y'] );
					$maxx = max( $maxx, $r['x'] + $r['w'] );
					$maxy = max( $maxy, $r['y'] + $r['h'] );
				}
			}
		}
		return array( $minx, $miny, $maxx, $maxy );
	}

	private function open_svg( string $title ): string {
		$brand = Settings::get( 'branding.color_primary', '#B9824F' );
		return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' . self::W . ' ' . self::H . '" width="' . self::W . '" height="' . self::H . '" font-family="Helvetica, Arial, sans-serif">'
			. '<title>' . self::e( $title ) . '</title>'
			. '<defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#9AA0A6" stroke-width="1"/></pattern>'
			. '<marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#2B2E31"/></marker>'
			. '<marker id="tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="10" markerHeight="10" orient="auto"><path d="M2,8 L8,2" stroke="#2B2E31" stroke-width="1.4"/></marker></defs>'
			. '<rect width="100%" height="100%" fill="#FFFFFF"/>'
			. '<rect x="24" y="24" width="' . ( self::W - 48 ) . '" height="' . ( self::H - 48 ) . '" fill="none" stroke="#2B2E31" stroke-width="1.5"/>'
			. '<rect x="24" y="24" width="10" height="' . ( self::H - 48 ) . '" fill="' . self::e( $brand ) . '"/>';
	}

	private function title_block( string $sheet_title, string $scale_note = '' ): string {
		$x   = self::W - 24 - 640;
		$y   = self::H - 24 - self::TB_H;
		$p   = $this->meta;
		$out = '<g>';
		$out .= '<rect x="' . $x . '" y="' . $y . '" width="640" height="' . self::TB_H . '" fill="#FFFFFF" stroke="#2B2E31" stroke-width="1.5"/>';
		$out .= '<line x1="' . $x . '" y1="' . ( $y + 44 ) . '" x2="' . ( $x + 640 ) . '" y2="' . ( $y + 44 ) . '" stroke="#2B2E31"/>';
		$out .= '<line x1="' . ( $x + 400 ) . '" y1="' . ( $y + 44 ) . '" x2="' . ( $x + 400 ) . '" y2="' . ( $y + self::TB_H ) . '" stroke="#2B2E31"/>';
		$out .= '<text x="' . ( $x + 16 ) . '" y="' . ( $y + 30 ) . '" font-size="20" font-weight="700" letter-spacing="2">' . self::e( mb_strtoupper( $sheet_title ) ) . '</text>';
		$out .= '<text x="' . ( $x + 16 ) . '" y="' . ( $y + 70 ) . '" font-size="15">' . self::e( $p['project'] ?? '' ) . '</text>';
		$out .= '<text x="' . ( $x + 16 ) . '" y="' . ( $y + 92 ) . '" font-size="15">' . self::e( sprintf( /* translators: 1: letter, 2: name */ __( '%1$s változat – %2$s', 'autogrowehome' ), $p['variant'] ?? 'A', $p['concept'] ?? '' ) ) . '</text>';
		$out .= '<text x="' . ( $x + 16 ) . '" y="' . ( $y + 114 ) . '" font-size="12" fill="#5A5F64">' . self::e( sprintf( /* translators: 1: id, 2: date */ __( 'Projekt: %1$s · %2$s', 'autogrowehome' ), substr( (string) ( $p['project_id'] ?? '' ), 0, 8 ), $p['date'] ?? gmdate( 'Y-m-d' ) ) ) . '</text>';
		$out .= '<text x="' . ( $x + 16 ) . '" y="' . ( $y + 136 ) . '" font-size="11" fill="#C2553F">' . self::e( __( 'KONCEPCIÓTERV – nem engedélyezési és nem kiviteli dokumentáció.', 'autogrowehome' ) ) . '</text>';
		$out .= '<text x="' . ( $x + 416 ) . '" y="' . ( $y + 70 ) . '" font-size="13">' . self::e( '' !== $scale_note ? $scale_note : __( 'Grafikus lépték szerint', 'autogrowehome' ) ) . '</text>';
		$out .= '<text x="' . ( $x + 416 ) . '" y="' . ( $y + 92 ) . '" font-size="12" fill="#5A5F64">' . self::e( __( 'Méretek: m, tájékoztató jellegű', 'autogrowehome' ) ) . '</text>';
		$out .= '<text x="' . ( $x + 416 ) . '" y="' . ( $y + 114 ) . '" font-size="12" fill="#5A5F64">' . self::e( __( 'Szakági tervező ellenőrzése szükséges.', 'autogrowehome' ) ) . '</text>';
		$out .= '<text x="' . ( $x + 416 ) . '" y="' . ( $y + 136 ) . '" font-size="12" font-weight="700" letter-spacing="1.5">' . self::e( mb_strtoupper( (string) Settings::get( 'general.plugin_name', 'AutoGroweHome' ) ) ) . '</text>';
		$out .= '</g>';
		return $out;
	}

	private function scale_bar(): string {
		$x   = 60;
		$y   = self::H - 70;
		$out = '<g font-size="12">';
		for ( $i = 0; $i < 5; $i++ ) {
			$out .= '<rect x="' . self::n( $x + $i * $this->s ) . '" y="' . $y . '" width="' . self::n( $this->s ) . '" height="8" fill="' . ( $i % 2 ? '#FFFFFF' : '#2B2E31' ) . '" stroke="#2B2E31"/>';
			$out .= '<text x="' . self::n( $x + $i * $this->s ) . '" y="' . ( $y - 6 ) . '" text-anchor="middle">' . $i . '</text>';
		}
		$out .= '<text x="' . self::n( $x + 5 * $this->s ) . '" y="' . ( $y - 6 ) . '" text-anchor="middle">5 m</text>';
		$out .= '</g>';
		return $out;
	}

	private function north_arrow(): string {
		// Garden (bottom of drawing) faces the configured orientation.
		$map   = array( 'south' => 0, 'south_west' => 45, 'west' => 90, 'north' => 180, 'east' => -90, 'south_east' => -45 );
		$rot   = $map[ $this->c['orientation'] ?? 'south' ] ?? 0;
		$cx    = self::W - 100;
		$cy    = 110;
		return '<g transform="translate(' . $cx . ',' . $cy . ') rotate(' . $rot . ')"><circle r="34" fill="none" stroke="#2B2E31"/><path d="M0,-30 L9,8 L0,2 L-9,8 z" fill="#2B2E31"/><text y="-38" text-anchor="middle" font-size="14" font-weight="700" transform="rotate(' . ( -$rot ) . ' 0 -42)">É</text></g>';
	}

	private function header( string $title, string $subtitle ): string {
		return '<text x="60" y="78" font-size="30" font-weight="300" letter-spacing="4">' . self::e( mb_strtoupper( $title ) ) . '</text>'
			. '<text x="60" y="104" font-size="14" fill="#5A5F64" letter-spacing="1">' . self::e( $subtitle ) . '</text>';
	}

	/* ------------------------------------------------------------------ plans */

	private function plan( int $level, string $mode ): string {
		list( $minx, $miny, $maxx, $maxy ) = $this->bounds( 0 === $level );
		$this->fit( $minx, $miny, $maxx, $maxy, 'dimensioned' === $mode ? 130 : 70 );
		$lv     = $this->m['levels'][ $level ];
		$titles = array(
			'plain'       => __( 'Alaprajz', 'autogrowehome' ),
			'furnished'   => __( 'Bútorozott alaprajz', 'autogrowehome' ),
			'dimensioned' => __( 'Méretezett alaprajzi koncepció', 'autogrowehome' ),
		);
		$svg  = $this->open_svg( $titles[ $mode ] . ' – ' . $lv['name'] );
		$svg .= $this->header( $titles[ $mode ], $lv['name'] . ' · ' . sprintf( /* translators: %s: area */ __( 'nettó %s', 'autogrowehome' ), self::fmt_area( $this->level_area( $level ) ) ) );

		// Site elements (ground floor only).
		if ( 0 === $level && ! empty( $this->m['terrace'] ) ) {
			$t    = $this->m['terrace'];
			$svg .= '<rect x="' . $this->X( $t['x'] ) . '" y="' . $this->Y( $t['y'] ) . '" width="' . $this->L( $t['w'] ) . '" height="' . $this->L( $t['h'] ) . '" fill="#EFE6D8" stroke="#8C7A66" stroke-width="1"/>';
			for ( $xx = $t['x'] + 0.15; $xx < $t['x'] + $t['w']; $xx += 0.15 * 1.0 + 0.0 ) {
				$svg .= '<line x1="' . $this->X( $xx ) . '" y1="' . $this->Y( $t['y'] ) . '" x2="' . $this->X( $xx ) . '" y2="' . $this->Y( $t['y'] + $t['h'] ) . '" stroke="#D9CBB6" stroke-width="0.6"/>';
				$xx += 0.0;
			}
			$svg .= $this->label( $t['x'] + $t['w'] / 2, $t['y'] + $t['h'] / 2, __( 'Fedett terasz', 'autogrowehome' ), self::fmt_area( $t['area'] ), $t['w'], $t['h'] );
			if ( 'furnished' === $mode ) {
				$svg .= $this->table_with_chairs( $t['x'] + $t['w'] / 2, $t['y'] + $t['h'] / 2, min( 2.0, $t['w'] * 0.4 ), 0.9 );
			}
		}
		if ( 0 === $level && ! empty( $this->m['garage'] ) ) {
			$g     = $this->m['garage'];
			$dash  = 'carport' === $g['kind'] ? ' stroke-dasharray="8 6"' : '';
			$svg  .= '<rect x="' . $this->X( $g['x'] ) . '" y="' . $this->Y( $g['y'] ) . '" width="' . $this->L( $g['w'] ) . '" height="' . $this->L( $g['h'] ) . '" fill="' . ( 'carport' === $g['kind'] ? '#FFFFFF' : '#ECEBE8' ) . '" stroke="#2B2E31" stroke-width="' . ( 'carport' === $g['kind'] ? 1.5 : self::n( 0.3 * $this->s ) ) . '"' . $dash . '/>';
			$svg  .= $this->label( $g['x'] + $g['w'] / 2, $g['y'] + $g['h'] / 2, 'carport' === $g['kind'] ? __( 'Fedett beálló', 'autogrowehome' ) : __( 'Garázs', 'autogrowehome' ), self::fmt_area( $g['w'] * $g['h'] ), $g['w'], $g['h'] );
			if ( 'furnished' === $mode ) {
				$cars = $g['w'] > 5.5 ? 2 : 1;
				for ( $i = 0; $i < $cars; $i++ ) {
					$cx   = $g['x'] + ( $i + 0.5 ) * $g['w'] / $cars;
					$svg .= '<rect x="' . $this->X( $cx - 0.9 ) . '" y="' . $this->Y( $g['y'] + 0.6 ) . '" width="' . $this->L( 1.8 ) . '" height="' . $this->L( 4.5 ) . '" rx="' . $this->L( 0.35 ) . '" fill="none" stroke="#9AA0A6" stroke-width="1"/>';
				}
			}
		}

		// Walls: part outlines (on this level only the parts that have rooms).
		foreach ( $this->m['parts'] as $p ) {
			if ( ! $this->part_has_level( $p['id'], $level ) ) {
				continue;
			}
			$svg .= '<rect x="' . $this->X( $p['x'] ) . '" y="' . $this->Y( $p['y'] ) . '" width="' . $this->L( $p['w'] ) . '" height="' . $this->L( $p['h'] ) . '" fill="#2B2E31"/>';
		}
		foreach ( $this->m['rooms'] as $r ) {
			if ( (int) $r['level'] !== $level ) {
				continue;
			}
			$fill = self::ZONE_FILL[ $r['zone'] ] ?? '#F6F3EE';
			$svg .= '<rect x="' . $this->X( $r['x'] ) . '" y="' . $this->Y( $r['y'] ) . '" width="' . $this->L( $r['w'] ) . '" height="' . $this->L( $r['h'] ) . '" fill="' . $fill . '"/>';
			if ( in_array( $r['type'], array( 'bathroom', 'wc', 'laundry' ), true ) && 'plain' !== $mode ) {
				$svg .= $this->tile_grid( $r );
			}
			if ( 'furnished' === $mode || 'stairs' === $r['type'] ) {
				$svg .= $this->furniture( $r );
			}
			$svg .= $this->label( $r['x'] + $r['w'] / 2, $r['y'] + $r['h'] / 2, $r['name'], self::fmt_area( $r['area'] ), $r['w'], $r['h'], 'dimensioned' === $mode ? self::fmt_m( $r['w'] ) . ' × ' . self::fmt_m( $r['h'] ) : '' );
		}

		// Openings.
		foreach ( $this->m['openings'] as $o ) {
			if ( (int) $o['level'] !== $level ) {
				continue;
			}
			$svg .= $this->opening( $o, $level );
		}

		if ( 'dimensioned' === $mode ) {
			$svg .= $this->dimensions( $level );
		}
		if ( ! empty( $lv['attic'] ) ) {
			$svg .= '<text x="60" y="130" font-size="13" fill="#C2553F">' . self::e( __( 'Tetőtér: a térdfal és a ferde tetősík miatt az 1,90 m alatti belmagasságú rész a hasznos alapterületbe csak korlátozottan számít.', 'autogrowehome' ) ) . '</text>';
		}
		$svg .= $this->legend();
		$svg .= $this->north_arrow();
		$svg .= $this->scale_bar();
		$svg .= $this->title_block( $titles[ $mode ] . ' – ' . $lv['name'] );
		$svg .= '</svg>';
		return $svg;
	}

	private function part_has_level( string $part, int $level ): bool {
		foreach ( $this->m['rooms'] as $r ) {
			if ( $r['part'] === $part && (int) $r['level'] === $level ) {
				return true;
			}
		}
		return false;
	}

	private function level_area( int $level ): float {
		$s = 0.0;
		foreach ( $this->m['rooms'] as $r ) {
			if ( (int) $r['level'] === $level ) {
				$s += $r['area'];
			}
		}
		return $s;
	}

	private function label( float $cx, float $cy, string $name, string $area, float $w, float $h, string $dims = '' ): string {
		$minpx = min( $w, $h ) * $this->s;
		$fs    = max( 9, min( 17, $minpx / 6.5 ) );
		$chars = max( 1, function_exists( 'mb_strlen' ) ? mb_strlen( $name ) : strlen( $name ) );
		$fs    = max( 6.5, min( $fs, ( $w * $this->s - 8 ) / ( $chars * 0.56 ) ) );
		$out  = '<text x="' . $this->X( $cx ) . '" y="' . self::n( $this->oy + $cy * $this->s - ( '' !== $dims ? $fs * 0.6 : $fs * 0.15 ) ) . '" font-size="' . self::n( $fs ) . '" text-anchor="middle" font-weight="600" fill="#1E2226">' . self::e( $name ) . '</text>';
		$out .= '<text x="' . $this->X( $cx ) . '" y="' . self::n( $this->oy + $cy * $this->s + $fs * ( '' !== $dims ? 0.6 : 1.05 ) ) . '" font-size="' . self::n( $fs * 0.85 ) . '" text-anchor="middle" fill="#5A5F64">' . self::e( $area ) . '</text>';
		if ( '' !== $dims ) {
			$out .= '<text x="' . $this->X( $cx ) . '" y="' . self::n( $this->oy + $cy * $this->s + $fs * 1.65 ) . '" font-size="' . self::n( $fs * 0.75 ) . '" text-anchor="middle" fill="#8C7A66">' . self::e( $dims ) . '</text>';
		}
		return $out;
	}

	private function opening( array $o, int $level ): string {
		$t     = 'ext' === $o['side'] ? BuildingModel::T_EXT : BuildingModel::T_INT;
		$w     = (float) $o['width'];
		$h     = 'h' === $o['orient'];
		$x     = (float) $o['x'];
		$y     = (float) $o['y'];
		// Exterior openings sit on the inner face; shift by half the wall thickness outward.
		if ( 'ext' === $o['side'] ) {
			$shift = $t / 2;
			$e     = $o['edge'] ?? '';
			$dir   = in_array( $e, array( 'v_start', 'u_start' ), true ) ? -1 : 1;
			if ( $this->m['mirror'] && in_array( $e, array( 'u_start', 'u_end' ), true ) ) {
				$dir = -$dir;
			}
			if ( $h ) {
				$y += $dir * $shift;
			} else {
				$x += $dir * $shift;
			}
		}
		$rx  = $h ? $x - $w / 2 : $x - $t / 2;
		$ry  = $h ? $y - $t / 2 : $y - $w / 2;
		$rw  = $h ? $w : $t;
		$rh  = $h ? $t : $w;
		$out = '';
		switch ( $o['type'] ) {
			case 'window':
			case 'sliding':
				$out .= '<rect x="' . $this->X( $rx ) . '" y="' . $this->Y( $ry ) . '" width="' . $this->L( $rw ) . '" height="' . $this->L( $rh ) . '" fill="#FFFFFF" stroke="#2B2E31" stroke-width="0.8"/>';
				if ( $h ) {
					$out .= '<line x1="' . $this->X( $rx ) . '" y1="' . $this->Y( $y ) . '" x2="' . $this->X( $rx + $rw ) . '" y2="' . $this->Y( $y ) . '" stroke="#4A90B8" stroke-width="1.6"/>';
					if ( 'sliding' === $o['type'] ) {
						$out .= '<line x1="' . $this->X( $rx ) . '" y1="' . $this->Y( $y - $t / 4 ) . '" x2="' . $this->X( $rx + $rw / 2 ) . '" y2="' . $this->Y( $y - $t / 4 ) . '" stroke="#4A90B8" stroke-width="1.2"/><line x1="' . $this->X( $rx + $rw / 2 ) . '" y1="' . $this->Y( $y + $t / 4 ) . '" x2="' . $this->X( $rx + $rw ) . '" y2="' . $this->Y( $y + $t / 4 ) . '" stroke="#4A90B8" stroke-width="1.2"/>';
					}
				} else {
					$out .= '<line x1="' . $this->X( $x ) . '" y1="' . $this->Y( $ry ) . '" x2="' . $this->X( $x ) . '" y2="' . $this->Y( $ry + $rh ) . '" stroke="#4A90B8" stroke-width="1.6"/>';
				}
				break;
			case 'entrance':
			case 'door':
				$fill = '#F8F6F2';
				$out .= '<rect x="' . $this->X( $rx ) . '" y="' . $this->Y( $ry ) . '" width="' . $this->L( $rw ) . '" height="' . $this->L( $rh ) . '" fill="' . $fill . '"/>';
				// Swing arc into the room side.
				$r   = $w;
				if ( $h ) {
					$hx  = $rx;
					$hy  = $y;
					$sgn = 'entrance' === $o['type'] ? 1 : ( 'v_end' === ( $o['edge'] ?? '' ) ? -1 : 1 );
					$out .= '<line x1="' . $this->X( $hx ) . '" y1="' . $this->Y( $hy ) . '" x2="' . $this->X( $hx ) . '" y2="' . $this->Y( $hy + $sgn * $r ) . '" stroke="#2B2E31" stroke-width="1.2"/>';
					$out .= '<path d="M' . $this->X( $hx ) . ',' . $this->Y( $hy + $sgn * $r ) . ' A' . $this->L( $r ) . ',' . $this->L( $r ) . ' 0 0 ' . ( $sgn > 0 ? 0 : 1 ) . ' ' . $this->X( $hx + $r ) . ',' . $this->Y( $hy ) . '" fill="none" stroke="#9AA0A6" stroke-width="0.9" stroke-dasharray="3 3"/>';
				} else {
					$hx  = $x;
					$hy  = $ry;
					$sgn = 'v_end' === ( $o['edge'] ?? '' ) ? -1 : 1;
					$out .= '<line x1="' . $this->X( $hx ) . '" y1="' . $this->Y( $hy ) . '" x2="' . $this->X( $hx + $sgn * $r ) . '" y2="' . $this->Y( $hy ) . '" stroke="#2B2E31" stroke-width="1.2"/>';
					$out .= '<path d="M' . $this->X( $hx + $sgn * $r ) . ',' . $this->Y( $hy ) . ' A' . $this->L( $r ) . ',' . $this->L( $r ) . ' 0 0 ' . ( $sgn > 0 ? 1 : 0 ) . ' ' . $this->X( $hx ) . ',' . $this->Y( $hy + $r ) . '" fill="none" stroke="#9AA0A6" stroke-width="0.9" stroke-dasharray="3 3"/>';
				}
				if ( 'entrance' === $o['type'] ) {
					$out .= '<path d="M' . $this->X( $x ) . ',' . self::n( $this->oy + $y * $this->s - 40 ) . ' L' . $this->X( $x ) . ',' . self::n( $this->oy + $y * $this->s - 8 ) . '" stroke="#C2553F" stroke-width="2.5" marker-end="url(#arr)"/>';
					$out .= '<text x="' . $this->X( $x ) . '" y="' . self::n( $this->oy + $y * $this->s - 46 ) . '" font-size="12" text-anchor="middle" fill="#C2553F" font-weight="700">' . self::e( __( 'BEJÁRAT', 'autogrowehome' ) ) . '</text>';
				}
				break;
		}
		return $out;
	}

	private function tile_grid( array $r ): string {
		$out  = '<g stroke="#D3DEE3" stroke-width="0.6">';
		$step = 0.6;
		for ( $xx = $r['x'] + $step; $xx < $r['x'] + $r['w']; $xx += $step ) {
			$out .= '<line x1="' . $this->X( $xx ) . '" y1="' . $this->Y( $r['y'] ) . '" x2="' . $this->X( $xx ) . '" y2="' . $this->Y( $r['y'] + $r['h'] ) . '"/>';
		}
		for ( $yy = $r['y'] + $step; $yy < $r['y'] + $r['h']; $yy += $step ) {
			$out .= '<line x1="' . $this->X( $r['x'] ) . '" y1="' . $this->Y( $yy ) . '" x2="' . $this->X( $r['x'] + $r['w'] ) . '" y2="' . $this->Y( $yy ) . '"/>';
		}
		return $out . '</g>';
	}

	private function rect( float $x, float $y, float $w, float $h, string $extra = '' ): string {
		return '<rect x="' . $this->X( $x ) . '" y="' . $this->Y( $y ) . '" width="' . $this->L( $w ) . '" height="' . $this->L( $h ) . '" ' . ( '' !== $extra ? $extra : 'fill="#FFFFFF" stroke="#6B7075" stroke-width="1"' ) . '/>';
	}

	private function table_with_chairs( float $cx, float $cy, float $tw, float $th ): string {
		$out = $this->rect( $cx - $tw / 2, $cy - $th / 2, $tw, $th );
		$n   = max( 1, (int) floor( $tw / 0.65 ) );
		for ( $i = 0; $i < $n; $i++ ) {
			$px   = $cx - $tw / 2 + ( $i + 0.5 ) * $tw / $n - 0.22;
			$out .= $this->rect( $px, $cy - $th / 2 - 0.5, 0.44, 0.42, 'fill="#FFFFFF" stroke="#9AA0A6" stroke-width="0.9" rx="3"' );
			$out .= $this->rect( $px, $cy + $th / 2 + 0.08, 0.44, 0.42, 'fill="#FFFFFF" stroke="#9AA0A6" stroke-width="0.9" rx="3"' );
		}
		return $out;
	}

	/**
	 * Simple furniture symbols per room type, kept inside the room rectangle.
	 */
	private function furniture( array $r ): string {
		$x   = $r['x'];
		$y   = $r['y'];
		$w   = $r['w'];
		$h   = $r['h'];
		$m   = 0.12;
		$out = '<g>';
		$long_x = $w >= $h;
		switch ( $r['type'] ) {
			case 'master':
			case 'bedroom':
			case 'guest':
			case 'kids':
				$bw  = 'master' === $r['type'] ? min( 1.8, $w - 1.2 ) : min( 1.4, max( 0.9, $w - 1.4 ) );
				$bl  = min( 2.0, $h - 0.9 );
				if ( $bw > 0.7 && $bl > 1.5 ) {
					$bx  = $x + ( $w - $bw ) / 2;
					$by  = 'front' === $r['band'] ? $y + $m : $y + $h - $bl - $m;
					$out .= $this->rect( $bx, $by, $bw, $bl, 'fill="#FFFFFF" stroke="#6B7075" stroke-width="1.1" rx="3"' );
					$py  = 'front' === $r['band'] ? $by + 0.1 : $by + $bl - 0.5;
					$out .= $this->rect( $bx + 0.1, $py, $bw - 0.2, 0.4, 'fill="#F1F2F3" stroke="#9AA0A6" stroke-width="0.8" rx="4"' );
					if ( $w - $bw > 1.0 ) {
						$out .= $this->rect( $bx - 0.5, $py, 0.42, 0.42 );
						$out .= $this->rect( $bx + $bw + 0.08, $py, 0.42, 0.42 );
					}
					// Wardrobe along a side wall.
					if ( $h > 3.2 ) {
						$out .= $this->rect( $x + $m, 'front' === $r['band'] ? $y + $h - 0.62 - $m : $y + $m, min( 2.4, $w - 2 * $m ), 0.6, 'fill="url(#hatch)" stroke="#6B7075" stroke-width="1"' );
					}
				}
				if ( 'kids' === $r['type'] && $w > 2.8 ) {
					$out .= $this->rect( $x + $w - 1.3, $y + $h / 2 - 0.3, 1.2, 0.6 );
				}
				break;
			case 'living':
			case 'living_kitchen':
				// Kitchen run along the front wall on one side (living_kitchen).
				$kx = $x;
				if ( 'living_kitchen' === $r['type'] ) {
					$kw   = min( 4.2, $w * 0.42 );
					$kx   = $this->m['mirror'] ? $x + $m : $x + $w - $kw - $m;
					$out .= $this->rect( $kx, $y + $m, $kw, 0.62, 'fill="#ECEBE8" stroke="#6B7075" stroke-width="1"' );
					$out .= '<circle cx="' . $this->X( $kx + $kw * 0.3 ) . '" cy="' . $this->Y( $y + $m + 0.31 ) . '" r="' . $this->L( 0.18 ) . '" fill="none" stroke="#9AA0A6"/>';
					$out .= $this->rect( $kx + $kw * 0.6, $y + $m + 0.1, 0.5, 0.42, 'fill="none" stroke="#9AA0A6" stroke-width="0.9" rx="2"' );
					if ( 'island' === ( $this->c['kitchen_layout'] ?? '' ) && $h > 4.4 ) {
						$out .= $this->rect( $kx + 0.4, $y + 1.75, min( 2.4, $kw - 0.6 ), 0.9, 'fill="#ECEBE8" stroke="#6B7075" stroke-width="1"' );
					}
					$dx   = $this->m['mirror'] ? $x + $kw + 1.6 : $kx - 1.4;
					if ( $h > 3.4 && $w > 9.0 ) {
						$out .= $this->table_with_chairs( $dx, $y + $h / 2 + 0.3, 1.8, 0.9 );
					}
					$sx = $this->m['mirror'] ? $x + $w - 3.2 : $x + 0.3;
				} else {
					$sx = $x + ( $w - 3.0 ) / 2;
				}
				$sy   = $y + max( 1.0, $h / 2 - 0.6 );
				if ( $h > 2.8 ) {
					$out .= $this->rect( $sx, $sy, 2.8, 0.9, 'fill="#FFFFFF" stroke="#6B7075" stroke-width="1.1" rx="5"' );
					$out .= $this->rect( $sx, $sy, 0.9, 1.9, 'fill="#FFFFFF" stroke="#6B7075" stroke-width="1.1" rx="5"' );
					$out .= $this->rect( $sx + 1.2, $sy + 1.1, 1.1, 0.6, 'fill="none" stroke="#9AA0A6" stroke-width="0.9" rx="3"' );
				}
				break;
			case 'dining':
				$out .= $this->table_with_chairs( $x + $w / 2, $y + $h / 2, min( 2.0, $w - 1.2 ), min( 0.9, $h - 1.4 ) );
				break;
			case 'kitchen':
				$out .= $this->rect( $x + $m, $y + $m, $w - 2 * $m, 0.62, 'fill="#ECEBE8" stroke="#6B7075" stroke-width="1"' );
				if ( $h > 2.6 ) {
					$out .= $this->rect( $x + $m, $y + $m, 0.62, $h - 2 * $m, 'fill="#ECEBE8" stroke="#6B7075" stroke-width="1"' );
				}
				break;
			case 'bathroom':
				$tub = in_array( 'bathtub', (array) ( $this->c['bath_fixtures'] ?? array() ), true ) || in_array( 'freestanding', (array) ( $this->c['bath_fixtures'] ?? array() ), true );
				if ( $tub && $w > 1.8 ) {
					$out .= $this->rect( $x + $m, $y + $m, min( 1.7, $w - 0.3 ), 0.75, 'fill="#FFFFFF" stroke="#6B7075" stroke-width="1.1" rx="8"' );
				} else {
					$out .= $this->rect( $x + $w - 1.0 - $m, $y + $m, 0.9, 0.9, 'fill="none" stroke="#6B7075" stroke-width="1.1"' );
					$out .= '<line x1="' . $this->X( $x + $w - 1.0 - $m ) . '" y1="' . $this->Y( $y + $m ) . '" x2="' . $this->X( $x + $w - 0.1 - $m ) . '" y2="' . $this->Y( $y + 0.9 + $m ) . '" stroke="#9AA0A6" stroke-width="0.8"/>';
				}
				$out .= $this->rect( $x + $m, $y + $h - 0.5 - $m, min( 1.2, $w * 0.45 ), 0.48, 'fill="#FFFFFF" stroke="#6B7075" stroke-width="1" rx="4"' );
				$out .= '<ellipse cx="' . $this->X( $x + $w - 0.45 ) . '" cy="' . $this->Y( $y + $h - 0.45 ) . '" rx="' . $this->L( 0.2 ) . '" ry="' . $this->L( 0.28 ) . '" fill="#FFFFFF" stroke="#6B7075"/>';
				break;
			case 'wc':
				$out .= '<ellipse cx="' . $this->X( $x + $w / 2 ) . '" cy="' . $this->Y( $y + $h - 0.4 ) . '" rx="' . $this->L( 0.2 ) . '" ry="' . $this->L( 0.28 ) . '" fill="#FFFFFF" stroke="#6B7075"/>';
				$out .= $this->rect( $x + $m, $y + $m, min( 0.45, $w - 0.2 ), 0.3, 'fill="#FFFFFF" stroke="#6B7075" stroke-width="0.9" rx="3"' );
				break;
			case 'laundry':
			case 'utility':
				$n = max( 1, min( 2, (int) floor( ( $w - 0.2 ) / 0.65 ) ) );
				for ( $i = 0; $i < $n; $i++ ) {
					$out .= $this->rect( $x + $m + $i * 0.65, $y + $m, 0.6, 0.6, 'fill="#FFFFFF" stroke="#6B7075" stroke-width="1"' );
					$out .= '<circle cx="' . $this->X( $x + $m + $i * 0.65 + 0.3 ) . '" cy="' . $this->Y( $y + $m + 0.3 ) . '" r="' . $this->L( 0.2 ) . '" fill="none" stroke="#9AA0A6"/>';
				}
				break;
			case 'office':
				$out .= $this->rect( $x + $m, $y + $h / 2 - 0.4, min( 1.6, $w - 0.3 ), 0.75 );
				$out .= '<circle cx="' . $this->X( $x + $m + 0.8 ) . '" cy="' . $this->Y( $y + $h / 2 + 0.75 ) . '" r="' . $this->L( 0.25 ) . '" fill="none" stroke="#9AA0A6"/>';
				break;
			case 'wardrobe':
			case 'pantry':
				$out .= $this->rect( $x + $m, $y + $m, $w - 2 * $m, min( 0.6, $h / 3 ), 'fill="url(#hatch)" stroke="#6B7075" stroke-width="1"' );
				break;
			case 'technical':
				$out .= $this->rect( $x + $m, $y + $m, 0.6, 0.6, 'fill="#FFFFFF" stroke="#6B7075" stroke-width="1"' );
				$out .= $this->rect( $x + $m + 0.7, $y + $m, 0.6, 0.6, 'fill="#FFFFFF" stroke="#6B7075" stroke-width="1"' );
				break;
			case 'stairs':
				$steps = 16;
				if ( $long_x ) {
					$run = ( $w - 0.2 ) / $steps;
					for ( $i = 0; $i <= $steps; $i++ ) {
						$out .= '<line x1="' . $this->X( $x + 0.1 + $i * $run ) . '" y1="' . $this->Y( $y + 0.1 ) . '" x2="' . $this->X( $x + 0.1 + $i * $run ) . '" y2="' . $this->Y( $y + min( $h, 1.2 ) ) . '" stroke="#6B7075" stroke-width="0.9"/>';
					}
					$out .= '<line x1="' . $this->X( $x + 0.2 ) . '" y1="' . $this->Y( $y + min( $h, 1.2 ) / 2 ) . '" x2="' . $this->X( $x + $w - 0.3 ) . '" y2="' . $this->Y( $y + min( $h, 1.2 ) / 2 ) . '" stroke="#2B2E31" stroke-width="1.4" marker-end="url(#arr)"/>';
				} else {
					$run = ( $h - 0.2 ) / $steps;
					for ( $i = 0; $i <= $steps; $i++ ) {
						$out .= '<line x1="' . $this->X( $x + 0.1 ) . '" y1="' . $this->Y( $y + 0.1 + $i * $run ) . '" x2="' . $this->X( $x + min( $w, 1.2 ) ) . '" y2="' . $this->Y( $y + 0.1 + $i * $run ) . '" stroke="#6B7075" stroke-width="0.9"/>';
					}
					$out .= '<line x1="' . $this->X( $x + min( $w, 1.2 ) / 2 ) . '" y1="' . $this->Y( $y + 0.2 ) . '" x2="' . $this->X( $x + min( $w, 1.2 ) / 2 ) . '" y2="' . $this->Y( $y + $h - 0.3 ) . '" stroke="#2B2E31" stroke-width="1.4" marker-end="url(#arr)"/>';
				}
				break;
			case 'gym':
			case 'playroom':
				$out .= $this->rect( $x + $w / 2 - 0.9, $y + $h / 2 - 0.5, 1.8, 1.0, 'fill="none" stroke="#9AA0A6" stroke-width="1" rx="6"' );
				break;
			case 'sauna':
				$out .= $this->rect( $x + $m, $y + $m, $w - 2 * $m, 0.6, 'fill="url(#hatch)" stroke="#6B7075" stroke-width="1"' );
				break;
		}
		return $out . '</g>';
	}

	private function dim_line( float $x1, float $y1, float $x2, float $y2, string $text, float $offset_px ): string {
		$h = abs( $y1 - $y2 ) < 0.001;
		if ( $h ) {
			$yy  = $this->oy + $y1 * $this->s + $offset_px;
			$out = '<line x1="' . $this->X( $x1 ) . '" y1="' . self::n( $yy ) . '" x2="' . $this->X( $x2 ) . '" y2="' . self::n( $yy ) . '" stroke="#2B2E31" stroke-width="0.9" marker-start="url(#tick)" marker-end="url(#tick)"/>';
			$out .= '<line x1="' . $this->X( $x1 ) . '" y1="' . $this->Y( $y1 ) . '" x2="' . $this->X( $x1 ) . '" y2="' . self::n( $yy + ( $offset_px > 0 ? 6 : -6 ) ) . '" stroke="#9AA0A6" stroke-width="0.6"/>';
			$out .= '<line x1="' . $this->X( $x2 ) . '" y1="' . $this->Y( $y2 ) . '" x2="' . $this->X( $x2 ) . '" y2="' . self::n( $yy + ( $offset_px > 0 ? 6 : -6 ) ) . '" stroke="#9AA0A6" stroke-width="0.6"/>';
			if ( ( $x2 - $x1 ) * $this->s > 26 ) {
				$out .= '<text x="' . self::n( $this->ox + ( $x1 + $x2 ) / 2 * $this->s ) . '" y="' . self::n( $yy - 5 ) . '" font-size="12" text-anchor="middle">' . self::e( $text ) . '</text>';
			}
			return $out;
		}
		$xx  = $this->ox + $x1 * $this->s + $offset_px;
		$out = '<line x1="' . self::n( $xx ) . '" y1="' . $this->Y( $y1 ) . '" x2="' . self::n( $xx ) . '" y2="' . $this->Y( $y2 ) . '" stroke="#2B2E31" stroke-width="0.9" marker-start="url(#tick)" marker-end="url(#tick)"/>';
		$out .= '<line x1="' . $this->X( $x1 ) . '" y1="' . $this->Y( $y1 ) . '" x2="' . self::n( $xx + ( $offset_px > 0 ? 6 : -6 ) ) . '" y2="' . $this->Y( $y1 ) . '" stroke="#9AA0A6" stroke-width="0.6"/>';
		$out .= '<line x1="' . $this->X( $x2 ) . '" y1="' . $this->Y( $y2 ) . '" x2="' . self::n( $xx + ( $offset_px > 0 ? 6 : -6 ) ) . '" y2="' . $this->Y( $y2 ) . '" stroke="#9AA0A6" stroke-width="0.6"/>';
		if ( ( $y2 - $y1 ) * $this->s > 26 ) {
			$cy   = $this->oy + ( $y1 + $y2 ) / 2 * $this->s;
			$out .= '<text x="' . self::n( $xx - 6 ) . '" y="' . self::n( $cy ) . '" font-size="12" text-anchor="middle" transform="rotate(-90 ' . self::n( $xx - 6 ) . ' ' . self::n( $cy ) . ')">' . self::e( $text ) . '</text>';
		}
		return $out;
	}

	private function dimensions( int $level ): string {
		$out  = '<g>';
		$main = $this->m['parts'][0];
		$W    = (float) $this->m['width'];
		$D    = (float) $this->m['length'];
		$out .= $this->dim_line( 0, 0, $W, 0, self::fmt_m( $W ), -70 );
		$out .= $this->dim_line( 0, 0, 0, $D, self::fmt_m( $D ), -70 );

		// Room chains along front and garden bands of the main part.
		$below = false;
		foreach ( array_slice( $this->m['parts'], 1 ) as $p ) {
			if ( $p['y'] > $main['y'] + $main['h'] - 1 ) {
				$below = true;
			}
		}
		foreach ( array( 'front' => -35, 'garden' => 35 ) as $band => $off ) {
			if ( 'garden' === $band && $below ) {
				continue;
			}
			$xs = array();
			$ref_y = $band === 'front' ? $main['y'] : $main['y'] + $main['h'];
			foreach ( $this->m['rooms'] as $r ) {
				if ( (int) $r['level'] !== $level || $r['band'] !== $band || 'main' !== $r['part'] ) {
					continue;
				}
				$xs[] = round( $r['x'] - BuildingModel::T_INT / 2, 2 );
				$xs[] = round( $r['x'] + $r['w'] + BuildingModel::T_INT / 2, 2 );
			}
			$xs = array_values( array_unique( $xs ) );
			sort( $xs );
			for ( $i = 0; $i < count( $xs ) - 1; $i++ ) {
				if ( $xs[ $i + 1 ] - $xs[ $i ] > 0.3 ) {
					$out .= $this->dim_line( $xs[ $i ], $ref_y, $xs[ $i + 1 ], $ref_y, self::fmt_m( $xs[ $i + 1 ] - $xs[ $i ] ), $off + ( 'garden' === $band && 0 === $level && ! empty( $this->m['terrace'] ) ? $this->m['terrace']['h'] * $this->s : 0 ) );
				}
			}
		}
		// Band depths on the right side of the main part.
		$ys = array( $main['y'], $main['y'] + $main['h'] );
		foreach ( $this->m['rooms'] as $r ) {
			if ( (int) $r['level'] === $level && 'corridor' === $r['band'] && 'main' === $r['part'] ) {
				$ys[] = round( $r['y'] - BuildingModel::T_INT / 2, 2 );
				$ys[] = round( $r['y'] + $r['h'] + BuildingModel::T_INT / 2, 2 );
			}
		}
		$ys = array_values( array_unique( $ys ) );
		sort( $ys );
		$right = $main['x'] + $main['w'];
		for ( $i = 0; $i < count( $ys ) - 1; $i++ ) {
			$out .= $this->dim_line( $right, $ys[ $i ], $right, $ys[ $i + 1 ], self::fmt_m( $ys[ $i + 1 ] - $ys[ $i ] ), 45 + ( ! empty( $this->m['garage'] ) && $this->m['garage']['x'] > $right - 0.1 ? $this->m['garage']['w'] * $this->s : 0 ) );
		}
		return $out . '</g>';
	}

	private function legend(): string {
		$items = array(
			'day'         => __( 'Nappali zóna', 'autogrowehome' ),
			'night'       => __( 'Éjszakai zóna', 'autogrowehome' ),
			'wet'         => __( 'Vizes helyiségek', 'autogrowehome' ),
			'service'     => __( 'Kiszolgáló', 'autogrowehome' ),
			'circulation' => __( 'Közlekedő', 'autogrowehome' ),
		);
		$x   = 60;
		$y   = self::H - 150;
		$out = '<g font-size="12">';
		$i   = 0;
		foreach ( $items as $k => $l ) {
			$xx   = $x + ( $i % 3 ) * 170;
			$yy   = $y + intdiv( $i, 3 ) * 22;
			$out .= '<rect x="' . $xx . '" y="' . ( $yy - 11 ) . '" width="16" height="14" fill="' . self::ZONE_FILL[ $k ] . '" stroke="#9AA0A6"/>';
			$out .= '<text x="' . ( $xx + 24 ) . '" y="' . $yy . '">' . self::e( $l ) . '</text>';
			$i++;
		}
		return $out . '</g>';
	}

	/* ------------------------------------------------------------------ roof */

	private function part_roof( array $p ): array {
		$r    = $this->m['roof'];
		$span = min( $p['w'], $p['h'] );
		$rise = 'flat' === $r['type'] ? 0.35 : ( 'shed' === $r['type'] ? $span * tan( deg2rad( $r['pitch'] ) ) : $span / 2 * tan( deg2rad( $r['pitch'] ) ) );
		return array(
			'dir'  => $p['w'] >= $p['h'] ? 'x' : 'y',
			'rise' => $rise,
			'span' => $span,
		);
	}

	private function roof_plan(): string {
		list( $minx, $miny, $maxx, $maxy ) = $this->bounds( true );
		$ov = (float) max( $this->m['roof']['overhang'], $this->m['roof']['eaves'] );
		$this->fit( $minx - $ov, $miny - $ov, $maxx + $ov, $maxy + $ov, 70 );
		$r    = $this->m['roof'];
		$svg  = $this->open_svg( __( 'Tetőfelülnézet', 'autogrowehome' ) );
		$types = array( 'gable' => __( 'nyeregtető', 'autogrowehome' ), 'hip' => __( 'kontyolt tető', 'autogrowehome' ), 'half_hip' => __( 'csonkakontyos tető', 'autogrowehome' ), 'shed' => __( 'félnyeregtető', 'autogrowehome' ), 'pyramid' => __( 'sátortető', 'autogrowehome' ), 'flat' => __( 'lapostető', 'autogrowehome' ), 'multi' => __( 'több tetősík', 'autogrowehome' ), 'complex' => __( 'összetett tető', 'autogrowehome' ) );
		$svg .= $this->header( __( 'Tetőfelülnézet', 'autogrowehome' ), ( $types[ $r['type'] ] ?? $r['type'] ) . ( 'flat' !== $r['type'] ? ' · ' . self::n( $r['pitch'] ) . '°' : '' ) . ' · ' . sprintf( /* translators: %s: height */ __( 'gerincmagasság ≈ %s m', 'autogrowehome' ), self::fmt_m( $r['ridge_height'] ) ) );
		$roof_fill = $this->c['roof_color'] ?? '#3A3D40';

		if ( ! empty( $this->m['terrace'] ) ) {
			$t    = $this->m['terrace'];
			$svg .= $this->rect( $t['x'], $t['y'], $t['w'], $t['h'], 'fill="#F0E8DC" stroke="#8C7A66" stroke-dasharray="6 4"' );
		}
		if ( ! empty( $this->m['garage'] ) ) {
			$g    = $this->m['garage'];
			$svg .= $this->rect( $g['x'], $g['y'], $g['w'], $g['h'], 'fill="#D9D7D2" stroke="#2B2E31" stroke-width="1.2"' );
		}

		foreach ( $this->m['parts'] as $p ) {
			$pr  = $this->part_roof( $p );
			$o   = 'flat' === $r['type'] ? 0.1 : $ov;
			$x0  = $p['x'] - $o;
			$y0  = $p['y'] - $o;
			$w   = $p['w'] + 2 * $o;
			$h   = $p['h'] + 2 * $o;
			$svg .= $this->rect( $x0, $y0, $w, $h, 'fill="' . self::e( $this->tint( $roof_fill, 0.55 ) ) . '" stroke="#2B2E31" stroke-width="1.6"' );
			$svg .= '<rect x="' . $this->X( $p['x'] ) . '" y="' . $this->Y( $p['y'] ) . '" width="' . $this->L( $p['w'] ) . '" height="' . $this->L( $p['h'] ) . '" fill="none" stroke="#2B2E31" stroke-width="0.8" stroke-dasharray="10 5"/>';
			$cx = $x0 + $w / 2;
			$cy = $y0 + $h / 2;
			$line = static function ( $a, $b, $c2, $d, $self, $wpx = 1.6 ) {
				return '<line x1="' . $self->X( $a ) . '" y1="' . $self->Y( $b ) . '" x2="' . $self->X( $c2 ) . '" y2="' . $self->Y( $d ) . '" stroke="#2B2E31" stroke-width="' . $wpx . '"/>';
			};
			switch ( $r['type'] ) {
				case 'flat':
					$svg .= $this->rect( $x0 + 0.3, $y0 + 0.3, $w - 0.6, $h - 0.6, 'fill="none" stroke="#2B2E31" stroke-width="1"' );
					$svg .= '<circle cx="' . $this->X( $x0 + 0.8 ) . '" cy="' . $this->Y( $y0 + $h - 0.8 ) . '" r="' . $this->L( 0.12 ) . '" fill="#2B2E31"/>';
					$svg .= '<circle cx="' . $this->X( $x0 + $w - 0.8 ) . '" cy="' . $this->Y( $y0 + $h - 0.8 ) . '" r="' . $this->L( 0.12 ) . '" fill="#2B2E31"/>';
					$svg .= $this->slope_arrow( $cx, $cy - 0.6, $cx, $cy + 0.9, '2%' );
					break;
				case 'shed':
					if ( 'x' === $pr['dir'] ) {
						$svg .= $this->slope_arrow( $cx, $y0 + 1.0, $cx, $y0 + $h - 1.0, self::n( $r['pitch'] ) . '°' );
					} else {
						$svg .= $this->slope_arrow( $x0 + 1.0, $cy, $x0 + $w - 1.0, $cy, self::n( $r['pitch'] ) . '°' );
					}
					break;
				case 'pyramid':
					$svg .= $line( $x0, $y0, $cx, $cy, $this ) . $line( $x0 + $w, $y0, $cx, $cy, $this ) . $line( $x0, $y0 + $h, $cx, $cy, $this ) . $line( $x0 + $w, $y0 + $h, $cx, $cy, $this );
					break;
				case 'hip':
				case 'half_hip':
				case 'multi':
				case 'complex':
					$hipd = 'half_hip' === $r['type'] ? min( $w, $h ) / 4 : min( $w, $h ) / 2;
					if ( 'x' === $pr['dir'] ) {
						$svg .= $line( $x0 + $hipd, $cy, $x0 + $w - $hipd, $cy, $this, 2.2 );
						$svg .= $line( $x0, $y0, $x0 + $hipd, $cy, $this ) . $line( $x0, $y0 + $h, $x0 + $hipd, $cy, $this );
						$svg .= $line( $x0 + $w, $y0, $x0 + $w - $hipd, $cy, $this ) . $line( $x0 + $w, $y0 + $h, $x0 + $w - $hipd, $cy, $this );
					} else {
						$svg .= $line( $cx, $y0 + $hipd, $cx, $y0 + $h - $hipd, $this, 2.2 );
						$svg .= $line( $x0, $y0, $cx, $y0 + $hipd, $this ) . $line( $x0 + $w, $y0, $cx, $y0 + $hipd, $this );
						$svg .= $line( $x0, $y0 + $h, $cx, $y0 + $h - $hipd, $this ) . $line( $x0 + $w, $y0 + $h, $cx, $y0 + $h - $hipd, $this );
					}
					break;
				default: // gable.
					if ( 'x' === $pr['dir'] ) {
						$svg .= $line( $x0, $cy, $x0 + $w, $cy, $this, 2.2 );
						$svg .= $this->slope_arrow( $cx - 2, $cy - 0.6, $cx - 2, $y0 + 0.6, self::n( $r['pitch'] ) . '°' );
						$svg .= $this->slope_arrow( $cx + 2, $cy + 0.6, $cx + 2, $y0 + $h - 0.6, self::n( $r['pitch'] ) . '°' );
					} else {
						$svg .= $line( $cx, $y0, $cx, $y0 + $h, $this, 2.2 );
						$svg .= $this->slope_arrow( $cx - 0.6, $cy, $x0 + 0.6, $cy, self::n( $r['pitch'] ) . '°' );
						$svg .= $this->slope_arrow( $cx + 0.6, $cy, $x0 + $w - 0.6, $cy, self::n( $r['pitch'] ) . '°' );
					}
			}
			// Solar panels on the garden-side slope of the main part.
			if ( $r['solar'] && 'main' === $p['id'] ) {
				$rows = 'flat' === $r['type'] ? 3 : 2;
				$cols = max( 2, (int) floor( ( $w - 2 ) / 1.15 ) );
				$sy   = 'flat' === $r['type'] ? $y0 + 1.0 : $cy + 0.5;
				for ( $i = 0; $i < $cols; $i++ ) {
					for ( $j = 0; $j < $rows; $j++ ) {
						$svg .= $this->rect( $x0 + 1.0 + $i * 1.15, $sy + $j * 1.8, 1.05, 1.7, 'fill="#1F2A36" stroke="#8FA3B5" stroke-width="0.8"' );
					}
				}
			}
			if ( $r['chimney'] && 'main' === $p['id'] ) {
				$svg .= $this->rect( $cx + $w * 0.18, $cy - 0.9, 0.6, 0.6, 'fill="#9D9A93" stroke="#2B2E31" stroke-width="1.2"' );
			}
			if ( $r['roof_windows'] > 0 && 'main' === $p['id'] && 'flat' !== $r['type'] ) {
				for ( $i = 0; $i < min( 6, $r['roof_windows'] ); $i++ ) {
					$svg .= $this->rect( $x0 + 1.5 + $i * ( ( $w - 3 ) / max( 1, min( 6, $r['roof_windows'] ) ) ), $y0 + 1.0, 0.78, 1.18, 'fill="#BFD7E6" stroke="#2B2E31" stroke-width="1"' );
				}
			}
		}
		$W    = (float) $this->m['width'] + 2 * $ov;
		$svg .= $this->dim_line( -$ov, -$ov, $W - $ov, -$ov, self::fmt_m( $W ), -40 );
		$svg .= '<text x="60" y="140" font-size="13" fill="#5A5F64">' . self::e( sprintf( /* translators: 1: overhang, 2: eaves */ __( 'Oromkinyúlás: %1$s m · ereszkinyúlás: %2$s m', 'autogrowehome' ), self::fmt_m( $r['overhang'] ), self::fmt_m( $r['eaves'] ) ) ) . '</text>';
		$svg .= $this->north_arrow();
		$svg .= $this->scale_bar();
		$svg .= $this->title_block( __( 'Tetőfelülnézet', 'autogrowehome' ) );
		return $svg . '</svg>';
	}

	private function slope_arrow( float $x1, float $y1, float $x2, float $y2, string $label ): string {
		return '<line x1="' . $this->X( $x1 ) . '" y1="' . $this->Y( $y1 ) . '" x2="' . $this->X( $x2 ) . '" y2="' . $this->Y( $y2 ) . '" stroke="#FFFFFF" stroke-width="2" marker-end="url(#arr)"/>'
			. '<text x="' . $this->X( ( $x1 + $x2 ) / 2 + 0.3 ) . '" y="' . $this->Y( ( $y1 + $y2 ) / 2 ) . '" font-size="12" fill="#FFFFFF">' . self::e( $label ) . '</text>';
	}

	private function tint( string $hex, float $amount ): string {
		if ( ! preg_match( '/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i', $hex, $m ) ) {
			return '#9A9DA0';
		}
		$c = array();
		for ( $i = 1; $i <= 3; $i++ ) {
			$v   = hexdec( $m[ $i ] );
			$c[] = (int) round( $v + ( 255 - $v ) * $amount );
		}
		return sprintf( '#%02X%02X%02X', $c[0], $c[1], $c[2] );
	}

	/* ------------------------------------------------------------------ elevations */

	/**
	 * Elevation profile for a face: returns [x-from, x-to] in elevation coords and depth order.
	 */
	private function elevation( string $face, float $ox, float $oy, float $scale ): string {
		$r      = $this->m['roof'];
		$W      = (float) $this->m['width'];
		$D      = (float) $this->m['length'];
		$horiz  = in_array( $face, array( 'front', 'back' ), true );
		$extent = $horiz ? $W : $D;
		$P      = static fn( $v ) => self::n( $v );
		$tx     = function ( float $u ) use ( $face, $extent, $ox, $scale ) {
			// Viewer looks at the face; back and right faces are mirrored.
			$u = in_array( $face, array( 'back', 'left' ), true ) ? $extent - $u : $u;
			return $ox + $u * $scale;
		};
		$ty  = static fn( float $h ) => $oy - $h * $scale;
		$out = '';
		$facade = $this->c['facade_color'] ?? '#F2EFE9';
		$roofc  = $this->c['roof_color'] ?? '#3A3D40';
		$frame  = $this->c['window_frame_color'] ?? '#2F3235';

		// Ground.
		$out .= '<line x1="' . $P( $ox - 40 ) . '" y1="' . $P( $oy ) . '" x2="' . $P( $ox + $extent * $scale + 40 ) . '" y2="' . $P( $oy ) . '" stroke="#2B2E31" stroke-width="2"/>';

		// Parts sorted far to near.
		$parts = $this->m['parts'];
		usort(
			$parts,
			static function ( $a, $b ) use ( $face ) {
				$ka = 'front' === $face ? $a['y'] : ( 'back' === $face ? -( $a['y'] + $a['h'] ) : ( 'left' === $face ? $a['x'] : -( $a['x'] + $a['w'] ) ) );
				$kb = 'front' === $face ? $b['y'] : ( 'back' === $face ? -( $b['y'] + $b['h'] ) : ( 'left' === $face ? $b['x'] : -( $b['x'] + $b['w'] ) ) );
				return $kb <=> $ka;
			}
		);
		foreach ( $parts as $p ) {
			$u0    = $horiz ? $p['x'] : $p['y'];
			$u1    = $horiz ? $p['x'] + $p['w'] : $p['y'] + $p['h'];
			$a     = min( $tx( $u0 ), $tx( $u1 ) );
			$b     = max( $tx( $u0 ), $tx( $u1 ) );
			$eave  = $this->part_has_level( $p['id'], 1 ) || 'main' === $p['id'] ? $r['eaves_height'] : $r['plinth'] + ( (float) ( $this->c['ceiling_height'] ?? 2.8 ) + 0.35 );
			$pr    = $this->part_roof( $p );
			$along = ( 'x' === $pr['dir'] ) === $horiz; // Ridge parallel to this face.
			$ovh   = $r['overhang'] * $scale;
			$eav   = $r['eaves'] * $scale;

			// Plinth + wall.
			$out .= '<rect x="' . $P( $a ) . '" y="' . $P( $ty( $eave ) ) . '" width="' . $P( $b - $a ) . '" height="' . $P( ( $eave ) * $scale ) . '" fill="' . self::e( $facade ) . '" stroke="#2B2E31" stroke-width="1.6"/>';
			$out .= '<rect x="' . $P( $a ) . '" y="' . $P( $ty( $r['plinth'] ) ) . '" width="' . $P( $b - $a ) . '" height="' . $P( $r['plinth'] * $scale ) . '" fill="' . self::e( $this->c['plinth_color'] ?? '#4A4D50' ) . '" stroke="#2B2E31" stroke-width="1"/>';

			$top  = $ty( $eave );
			$rise = $pr['rise'] * $scale;
			$pts  = '';
			switch ( $r['type'] ) {
				case 'flat':
					$out .= '<rect x="' . $P( $a - 4 ) . '" y="' . $P( $top - 0.35 * $scale ) . '" width="' . $P( $b - $a + 8 ) . '" height="' . $P( 0.35 * $scale ) . '" fill="' . self::e( $this->tint( $roofc, 0.2 ) ) . '" stroke="#2B2E31" stroke-width="1.4"/>';
					break;
				case 'shed':
					if ( $along ) {
						$hgt  = 'front' === $face ? $rise : 0.25 * $scale;
						$pts  = $P( $a - $eav ) . ',' . $P( $top ) . ' ' . $P( $b + $eav ) . ',' . $P( $top ) . ' ' . $P( $b + $eav ) . ',' . $P( $top - $hgt - 4 ) . ' ' . $P( $a - $eav ) . ',' . $P( $top - $hgt - 4 );
					} else {
						$pts  = $P( $a - $ovh ) . ',' . $P( $top ) . ' ' . $P( $b + $ovh ) . ',' . $P( $top ) . ' ' . $P( $b + $ovh ) . ',' . $P( $top - ( 'left' === $face ? 0.2 * $scale : $rise ) ) . ' ' . $P( $a - $ovh ) . ',' . $P( $top - ( 'left' === $face ? $rise : 0.2 * $scale ) );
					}
					break;
				case 'gable':
					if ( $along ) {
						$pts = $P( $a - $ovh ) . ',' . $P( $top ) . ' ' . $P( $b + $ovh ) . ',' . $P( $top ) . ' ' . $P( $b + $ovh ) . ',' . $P( $top - $rise ) . ' ' . $P( $a - $ovh ) . ',' . $P( $top - $rise );
					} else {
						$mid  = ( $a + $b ) / 2;
						$drop = $eav * tan( deg2rad( $r['pitch'] ) );
						$vt   = 0.28 * $scale;
						$out .= '<polygon points="' . $P( $a ) . ',' . $P( $top ) . ' ' . $P( $mid ) . ',' . $P( $top - $rise ) . ' ' . $P( $b ) . ',' . $P( $top ) . '" fill="' . self::e( $facade ) . '" stroke="#2B2E31" stroke-width="1.2"/>';
						$pts  = $P( $a - $eav ) . ',' . $P( $top + $drop ) . ' ' . $P( $mid ) . ',' . $P( $top - $rise ) . ' ' . $P( $b + $eav ) . ',' . $P( $top + $drop ) . ' ' . $P( $b + $eav ) . ',' . $P( $top + $drop - $vt ) . ' ' . $P( $mid ) . ',' . $P( $top - $rise - $vt ) . ' ' . $P( $a - $eav ) . ',' . $P( $top + $drop - $vt );
						$pts  = $P( $a - $eav ) . ',' . $P( $top + $drop ) . ' ' . $P( $mid ) . ',' . $P( $top - $rise - $vt ) . ' ' . $P( $b + $eav ) . ',' . $P( $top + $drop ) . ' ' . $P( $b + $eav - 0.3 * $scale ) . ',' . $P( $top + $drop ) . ' ' . $P( $mid ) . ',' . $P( $top - $rise + 0.05 * $scale ) . ' ' . $P( $a - $eav + 0.3 * $scale ) . ',' . $P( $top + $drop );
					}
					break;
				default: // hip, half-hip, pyramid, multi, complex.
					$mid  = ( $a + $b ) / 2;
					$inset = 'pyramid' === $r['type'] ? ( $b - $a ) / 2 : ( 'half_hip' === $r['type'] ? $pr['span'] / 4 * $scale : $pr['span'] / 2 * $scale );
					if ( $along && 'pyramid' !== $r['type'] ) {
						$pts = $P( $a - $eav ) . ',' . $P( $top ) . ' ' . $P( $b + $eav ) . ',' . $P( $top ) . ' ' . $P( $b - $inset + $eav ) . ',' . $P( $top - $rise ) . ' ' . $P( $a + $inset - $eav ) . ',' . $P( $top - $rise );
					} elseif ( 'half_hip' === $r['type'] ) {
						$hh  = $rise * 0.35;
						$pts = $P( $a - $eav ) . ',' . $P( $top ) . ' ' . $P( $mid - ( $b - $a ) * 0.18 ) . ',' . $P( $top - $rise + $hh ) . ' ' . $P( $mid ) . ',' . $P( $top - $rise ) . ' ' . $P( $mid + ( $b - $a ) * 0.18 ) . ',' . $P( $top - $rise + $hh ) . ' ' . $P( $b + $eav ) . ',' . $P( $top );
					} else {
						$pts = $P( $a - $eav ) . ',' . $P( $top ) . ' ' . $P( $mid ) . ',' . $P( $top - $rise ) . ' ' . $P( $b + $eav ) . ',' . $P( $top );
					}
			}
			if ( '' !== $pts ) {
				$out .= '<polygon points="' . $pts . '" fill="' . self::e( $roofc ) . '" stroke="#1E2226" stroke-width="1.6"/>';
			}
			if ( $r['chimney'] && 'main' === $p['id'] && 'flat' !== $r['type'] ) {
				$chx  = ( $a + $b ) / 2 + ( $b - $a ) * 0.18;
				$out .= '<rect x="' . $P( $chx ) . '" y="' . $P( $top - $rise * 0.9 - 0.9 * $scale ) . '" width="' . $P( 0.6 * $scale ) . '" height="' . $P( $rise * 0.5 + 0.9 * $scale ) . '" fill="#9D9A93" stroke="#2B2E31" stroke-width="1.2"/>';
			}
		}

		// Openings on this face.
		$storey = (float) ( $this->c['ceiling_height'] ?? 2.8 ) + 0.35;
		foreach ( $this->m['openings'] as $o ) {
			if ( 'ext' !== ( $o['side'] ?? '' ) || ! $this->on_face( $o, $face ) ) {
				continue;
			}
			$u    = $horiz ? $o['x'] : $o['y'];
			$cx   = $tx( $u );
			$lvl  = (int) $o['level'];
			$base = $r['plinth'] + $lvl * $storey;
			switch ( $o['type'] ) {
				case 'sliding':
					$sill = 0.0;
					$hh   = 2.4;
					break;
				case 'entrance':
					$sill = 0.0;
					$hh   = 2.3;
					break;
				default:
					$room = $this->m['rooms'][ $o['room'] ] ?? array( 'type' => '' );
					$wet  = in_array( $room['type'], array( 'bathroom', 'wc', 'laundry', 'utility' ), true );
					$pano = 'panoramic' === ( $this->c['window_style'] ?? '' ) && ! $wet;
					$sill = $wet ? 1.5 : ( $pano ? 0.1 : 0.9 );
					$hh   = $wet ? 0.6 : ( $pano ? 2.3 : 1.5 );
			}
			$ww   = (float) $o['width'] * $scale;
			$fill = 'entrance' === $o['type'] ? ( $this->c['entrance_door_color'] ?? '#2B2E31' ) : '#A9C4D6';
			$out .= '<rect x="' . $P( $cx - $ww / 2 ) . '" y="' . $P( $ty( $base + $sill + $hh ) ) . '" width="' . $P( $ww ) . '" height="' . $P( $hh * $scale ) . '" fill="' . self::e( $fill ) . '" stroke="' . self::e( $frame ) . '" stroke-width="2"/>';
			if ( 'sliding' === $o['type'] ) {
				$out .= '<line x1="' . $P( $cx ) . '" y1="' . $P( $ty( $base + $hh ) ) . '" x2="' . $P( $cx ) . '" y2="' . $P( $ty( $base ) ) . '" stroke="' . self::e( $frame ) . '" stroke-width="2"/>';
			}
		}

		// Height marks.
		$xm   = $ox + $extent * $scale + 26;
		$out .= '<g font-size="11" fill="#2B2E31">';
		foreach ( array( array( 0, '±0,00' ), array( $r['eaves_height'], '+' . self::fmt_m( $r['eaves_height'] ) ), array( $r['ridge_height'], '+' . self::fmt_m( $r['ridge_height'] ) ) ) as $mk ) {
			$yy   = $ty( $mk[0] );
			$out .= '<path d="M' . $P( $xm ) . ',' . $P( $yy ) . ' l8,-8 l-16,0 z" fill="#2B2E31"/><text x="' . $P( $xm + 12 ) . '" y="' . $P( $yy - 2 ) . '">' . self::e( $mk[1] ) . '</text>';
		}
		$out .= '</g>';
		return $out;
	}

	private function on_face( array $o, string $face ): bool {
		$tol = BuildingModel::T_EXT + 0.05;
		foreach ( $this->m['parts'] as $p ) {
			switch ( $face ) {
				case 'front':
					if ( 'h' === $o['orient'] && abs( $o['y'] - ( $p['y'] + BuildingModel::T_EXT ) ) < $tol && $o['x'] >= $p['x'] && $o['x'] <= $p['x'] + $p['w'] && 'v_start' === ( $o['edge'] ?? '' ) ) {
						return true;
					}
					break;
				case 'back':
					if ( 'h' === $o['orient'] && abs( $o['y'] - ( $p['y'] + $p['h'] - BuildingModel::T_EXT ) ) < $tol && $o['x'] >= $p['x'] && $o['x'] <= $p['x'] + $p['w'] && in_array( $o['edge'] ?? '', array( 'v_end' ), true ) ) {
						return true;
					}
					if ( 'v' === $p['axis'] && 'h' === $o['orient'] && abs( $o['y'] - ( $p['y'] + $p['h'] - BuildingModel::T_EXT ) ) < $tol ) {
						return true;
					}
					break;
				case 'left':
					if ( 'v' === $o['orient'] && abs( $o['x'] - ( $p['x'] + BuildingModel::T_EXT ) ) < $tol ) {
						return true;
					}
					break;
				case 'right':
					if ( 'v' === $o['orient'] && abs( $o['x'] - ( $p['x'] + $p['w'] - BuildingModel::T_EXT ) ) < $tol ) {
						return true;
					}
					break;
			}
		}
		return false;
	}

	private function elevations(): string {
		$W     = (float) $this->m['width'];
		$D     = (float) $this->m['length'];
		$H     = (float) $this->m['roof']['ridge_height'] + 1.0;
		$cellw = ( self::W - 2 * self::PAD - 120 ) / 2;
		$cellh = ( self::H - 2 * self::PAD - self::TB_H - 120 ) / 2;
		$scale = min( ( $cellw - 80 ) / max( $W, $D ), ( $cellh - 70 ) / $H, 40 );
		$this->s = $scale;
		$svg   = $this->open_svg( __( 'Homlokzati nézetek', 'autogrowehome' ) );
		$svg  .= $this->header( __( 'Homlokzati nézetek', 'autogrowehome' ), __( 'Tervjellegű koncepció – a nyílászárók helye a tervvázlatból származik', 'autogrowehome' ) );
		$faces = array(
			'front' => __( 'Utcai (bejárati) homlokzat', 'autogrowehome' ),
			'back'  => __( 'Kerti homlokzat', 'autogrowehome' ),
			'left'  => __( 'Bal oldali homlokzat', 'autogrowehome' ),
			'right' => __( 'Jobb oldali homlokzat', 'autogrowehome' ),
		);
		$i = 0;
		foreach ( $faces as $face => $label ) {
			$col   = $i % 2;
			$row   = intdiv( $i, 2 );
			$ext   = in_array( $face, array( 'front', 'back' ), true ) ? $W : $D;
			$ox    = self::PAD + 40 + $col * ( $cellw + 40 ) + ( $cellw - $ext * $scale ) / 2;
			$oy    = self::PAD + 90 + $row * ( $cellh + 30 ) + $cellh - 40;
			$svg  .= $this->elevation( $face, $ox, $oy, $scale );
			$svg  .= '<text x="' . self::n( self::PAD + 40 + $col * ( $cellw + 40 ) ) . '" y="' . self::n( $oy + 30 ) . '" font-size="15" font-weight="600" letter-spacing="1">' . self::e( mb_strtoupper( $label ) ) . '</text>';
			$i++;
		}
		$svg .= $this->scale_bar();
		$svg .= $this->title_block( __( 'Homlokzati nézetek', 'autogrowehome' ) );
		return $svg . '</svg>';
	}

	/* ------------------------------------------------------------------ section */

	private function section(): string {
		$r      = $this->m['roof'];
		$main   = $this->m['parts'][0];
		$pr     = $this->part_roof( $main );
		// Cut perpendicular to the ridge so the roof pitch is visible.
		$span   = 'x' === $pr['dir'] ? $main['h'] : $main['w'];
		$H      = $r['ridge_height'] + 1.6;
		$scale  = min( ( self::W - 2 * self::PAD - 400 ) / max( 1, $span + 2 ), ( self::H - 2 * self::PAD - self::TB_H - 200 ) / $H, 60 );
		$this->s = $scale;
		$ox     = self::PAD + 200;
		$oy     = self::H - self::PAD - self::TB_H - 70;
		$P      = static fn( $v ) => self::n( $v );
		$X      = static fn( float $u ) => $ox + $u * $scale;
		$Y      = static fn( float $h ) => $oy - $h * $scale;
		$svg    = $this->open_svg( __( 'Metszeti koncepció', 'autogrowehome' ) );
		$svg   .= $this->header( __( 'Metszeti koncepció', 'autogrowehome' ), __( 'A–A metszet a gerincre merőlegesen, sematikus', 'autogrowehome' ) );
		$t      = BuildingModel::T_EXT;
		$storey = (float) ( $this->c['ceiling_height'] ?? 2.8 ) + 0.35;
		$levels = count( $this->m['levels'] );
		$attic  = ! empty( $this->m['levels'][ $levels - 1 ]['attic'] );
		$wallh  = $r['eaves_height'];

		// Ground and foundation.
		$svg .= '<rect x="' . $P( $X( -1.5 ) ) . '" y="' . $P( $Y( 0 ) ) . '" width="' . $P( ( $span + 3 ) * $scale ) . '" height="' . $P( 0.9 * $scale ) . '" fill="url(#hatch)" stroke="none"/>';
		$svg .= '<line x1="' . $P( $X( -1.5 ) ) . '" y1="' . $P( $Y( 0 ) ) . '" x2="' . $P( $X( $span + 1.5 ) ) . '" y2="' . $P( $Y( 0 ) ) . '" stroke="#2B2E31" stroke-width="2"/>';
		// Walls.
		foreach ( array( 0, $span - $t ) as $wx ) {
			$svg .= '<rect x="' . $P( $X( $wx ) ) . '" y="' . $P( $Y( $wallh ) ) . '" width="' . $P( $t * $scale ) . '" height="' . $P( ( $wallh + 0.6 ) * $scale ) . '" fill="#2B2E31"/>';
		}
		// Slabs.
		for ( $l = 0; $l <= $levels; $l++ ) {
			$h = $r['plinth'] + $l * $storey;
			if ( $l === $levels && ! $attic ) {
				$h = $wallh;
			}
			if ( $l === $levels && $attic ) {
				continue;
			}
			$svg .= '<rect x="' . $P( $X( 0 ) ) . '" y="' . $P( $Y( $h ) ) . '" width="' . $P( $span * $scale ) . '" height="' . $P( 0.3 * $scale ) . '" fill="#6B7075"/>';
			if ( $l < $levels ) {
				$svg .= '<text x="' . $P( $X( $span / 2 ) ) . '" y="' . $P( $Y( $h + $storey / 2 ) ) . '" font-size="15" text-anchor="middle" fill="#5A5F64">' . self::e( $this->m['levels'][ $l ]['name'] ) . '</text>';
			}
		}
		// Roof.
		$ov   = $r['eaves'];
		$rise = $pr['rise'];
		$roofc = $this->c['roof_color'] ?? '#3A3D40';
		if ( 'flat' === $r['type'] ) {
			$svg .= '<rect x="' . $P( $X( -0.1 ) ) . '" y="' . $P( $Y( $wallh + 0.45 ) ) . '" width="' . $P( ( $span + 0.2 ) * $scale ) . '" height="' . $P( 0.45 * $scale ) . '" fill="' . self::e( $roofc ) . '"/>';
		} elseif ( 'shed' === $r['type'] ) {
			$svg .= '<polygon points="' . $P( $X( -$ov ) ) . ',' . $P( $Y( $wallh + $rise + 0.1 ) ) . ' ' . $P( $X( $span + $ov ) ) . ',' . $P( $Y( $wallh - 0.1 ) ) . ' ' . $P( $X( $span + $ov ) ) . ',' . $P( $Y( $wallh + 0.2 ) ) . ' ' . $P( $X( -$ov ) ) . ',' . $P( $Y( $wallh + $rise + 0.4 ) ) . '" fill="' . self::e( $roofc ) . '" stroke="#1E2226"/>';
		} else {
			$drop = $ov * tan( deg2rad( $r['pitch'] ) );
			$th   = 0.3 / cos( deg2rad( $r['pitch'] ) );
			$svg .= '<polygon points="' . $P( $X( -$ov ) ) . ',' . $P( $Y( $wallh - $drop ) ) . ' ' . $P( $X( $span / 2 ) ) . ',' . $P( $Y( $wallh + $rise ) ) . ' ' . $P( $X( $span + $ov ) ) . ',' . $P( $Y( $wallh - $drop ) ) . ' ' . $P( $X( $span + $ov ) ) . ',' . $P( $Y( $wallh - $drop + $th ) ) . ' ' . $P( $X( $span / 2 ) ) . ',' . $P( $Y( $wallh + $rise + $th ) ) . ' ' . $P( $X( -$ov ) ) . ',' . $P( $Y( $wallh - $drop + $th ) ) . '" fill="' . self::e( $roofc ) . '" stroke="#1E2226"/>';
			$svg .= '<path d="M' . $P( $X( 1.4 ) ) . ',' . $P( $Y( $wallh + 1.4 * tan( deg2rad( $r['pitch'] ) ) + 0.5 ) ) . ' a' . $P( 1.2 * $scale ) . ',' . $P( 1.2 * $scale ) . ' 0 0 1 ' . $P( 1.0 * $scale ) . ',0" fill="none" stroke="#C2553F"/>';
			$svg .= '<text x="' . $P( $X( 2.6 ) ) . '" y="' . $P( $Y( $wallh + 0.6 ) ) . '" font-size="14" fill="#C2553F">' . self::e( self::n( $r['pitch'] ) . '°' ) . '</text>';
		}
		// Height chain.
		$xl   = $X( $span + 2.2 );
		$marks = array( 0.0, $r['plinth'] );
		for ( $l = 1; $l < $levels; $l++ ) {
			$marks[] = $r['plinth'] + $l * $storey;
		}
		$marks[] = $wallh;
		$marks[] = $r['ridge_height'];
		$marks   = array_values( array_unique( array_map( static fn( $v ) => round( $v, 2 ), $marks ) ) );
		sort( $marks );
		for ( $i = 0; $i < count( $marks ) - 1; $i++ ) {
			$y1   = $Y( $marks[ $i ] );
			$y2   = $Y( $marks[ $i + 1 ] );
			$svg .= '<line x1="' . $P( $xl ) . '" y1="' . $P( $y1 ) . '" x2="' . $P( $xl ) . '" y2="' . $P( $y2 ) . '" stroke="#2B2E31" marker-start="url(#tick)" marker-end="url(#tick)"/>';
			$svg .= '<text x="' . $P( $xl + 10 ) . '" y="' . $P( ( $y1 + $y2 ) / 2 + 4 ) . '" font-size="12">' . self::e( self::fmt_m( $marks[ $i + 1 ] - $marks[ $i ] ) ) . '</text>';
		}
		foreach ( $marks as $mk ) {
			$svg .= '<text x="' . $P( $xl + 70 ) . '" y="' . $P( $Y( $mk ) + 4 ) . '" font-size="12" fill="#5A5F64">' . self::e( ( $mk > 0 ? '+' : '±' ) . self::fmt_m( $mk ) ) . '</text>';
		}
		$svg .= '<line x1="' . $P( $X( 0 ) ) . '" y1="' . $P( $oy + 40 ) . '" x2="' . $P( $X( $span ) ) . '" y2="' . $P( $oy + 40 ) . '" stroke="#2B2E31" marker-start="url(#tick)" marker-end="url(#tick)"/>';
		$svg .= '<text x="' . $P( $X( $span / 2 ) ) . '" y="' . $P( $oy + 34 ) . '" font-size="12" text-anchor="middle">' . self::e( self::fmt_m( $span ) ) . '</text>';
		$svg .= '<text x="60" y="140" font-size="13" fill="#5A5F64">' . self::e( __( 'A rétegrendek, szerkezeti méretek és alapozás szakági tervezést igényelnek.', 'autogrowehome' ) ) . '</text>';
		$svg .= $this->scale_bar();
		$svg .= $this->title_block( __( 'Metszeti koncepció', 'autogrowehome' ) );
		return $svg . '</svg>';
	}

	/* ------------------------------------------------------------------ room list */

	private function room_list(): string {
		$svg  = $this->open_svg( __( 'Helyiséglista', 'autogrowehome' ) );
		$svg .= $this->header( __( 'Helyiséglista', 'autogrowehome' ), sprintf( /* translators: 1: planned, 2: requested */ __( 'Tervezett nettó: %1$s · kért: %2$s', 'autogrowehome' ), self::fmt_area( $this->m['checks']['net_planned'] ?? 0 ), self::fmt_area( $this->m['checks']['net_requested'] ?? 0 ) ) );
		$x    = 80;
		$y    = 170;
		$cols = array( 60, 360, 200, 170, 170, 200 );
		$hdr  = array( '#', __( 'Helyiség', 'autogrowehome' ), __( 'Szint', 'autogrowehome' ), __( 'Terület', 'autogrowehome' ), __( 'Igény', 'autogrowehome' ), __( 'Méret', 'autogrowehome' ) );
		$cx   = $x;
		$svg .= '<rect x="' . $x . '" y="' . ( $y - 24 ) . '" width="' . array_sum( $cols ) . '" height="34" fill="#F4EEE5"/>';
		foreach ( $hdr as $i => $h ) {
			$svg .= '<text x="' . ( $cx + 10 ) . '" y="' . $y . '" font-size="14" font-weight="700">' . self::e( $h ) . '</text>';
			$cx  += $cols[ $i ];
		}
		$rooms = array_values( $this->m['rooms'] );
		usort( $rooms, static fn( $a, $b ) => ( $a['level'] <=> $b['level'] ) ?: strcmp( $a['band'], $b['band'] ) );
		$n    = 1;
		$tot  = 0.0;
		$levels = $this->m['levels'];
		foreach ( $rooms as $r ) {
			$y   += 30;
			if ( $y > self::H - self::TB_H - 80 ) {
				$svg .= '<text x="' . $x . '" y="' . ( $y + 10 ) . '" font-size="13" fill="#5A5F64">' . self::e( __( '… a teljes lista a CSV-fájlban.', 'autogrowehome' ) ) . '</text>';
				break;
			}
			$cells = array( (string) $n++, $r['name'], $levels[ $r['level'] ]['name'] ?? '', self::fmt_area( $r['area'] ), $r['target'] > 0 ? self::fmt_area( $r['target'] ) : '–', self::fmt_m( $r['w'] ) . ' × ' . self::fmt_m( $r['h'] ) );
			$cx    = $x;
			if ( 0 === $n % 2 ) {
				$svg .= '<rect x="' . $x . '" y="' . ( $y - 20 ) . '" width="' . array_sum( $cols ) . '" height="30" fill="#FAF8F5"/>';
			}
			foreach ( $cells as $i => $cell ) {
				$svg .= '<text x="' . ( $cx + 10 ) . '" y="' . $y . '" font-size="14">' . self::e( $cell ) . '</text>';
				$cx  += $cols[ $i ];
			}
			$tot += $r['area'];
		}
		$y   += 40;
		$svg .= '<line x1="' . $x . '" y1="' . ( $y - 24 ) . '" x2="' . ( $x + array_sum( $cols ) ) . '" y2="' . ( $y - 24 ) . '" stroke="#2B2E31"/>';
		$svg .= '<text x="' . ( $x + 70 ) . '" y="' . $y . '" font-size="15" font-weight="700">' . self::e( __( 'Összes nettó alapterület', 'autogrowehome' ) ) . '</text>';
		$svg .= '<text x="' . ( $x + 630 ) . '" y="' . $y . '" font-size="15" font-weight="700">' . self::e( self::fmt_area( $tot ) ) . '</text>';
		if ( ! empty( $this->m['terrace'] ) ) {
			$svg .= '<text x="' . ( $x + 70 ) . '" y="' . ( $y + 26 ) . '" font-size="14" fill="#5A5F64">' . self::e( __( 'Fedett terasz (nem számít a nettóba)', 'autogrowehome' ) ) . '</text><text x="' . ( $x + 630 ) . '" y="' . ( $y + 26 ) . '" font-size="14" fill="#5A5F64">' . self::e( self::fmt_area( $this->m['terrace']['area'] ) ) . '</text>';
		}
		foreach ( array_slice( (array) ( $this->m['checks']['warnings'] ?? array() ), 0, 4 ) as $i => $w ) {
			$svg .= '<text x="' . $x . '" y="' . ( self::H - self::TB_H - 120 + $i * 20 ) . '" font-size="12" fill="#C2553F">⚠ ' . self::e( $w ) . '</text>';
		}
		$svg .= $this->title_block( __( 'Helyiséglista', 'autogrowehome' ), '' );
		return $svg . '</svg>';
	}

	/**
	 * CSV export of the room list.
	 */
	public static function rooms_csv( array $model ): string {
		$rows   = array();
		$rows[] = array( 'level', 'id', 'type', 'name', 'area_m2', 'requested_m2', 'width_m', 'length_m', 'x_m', 'y_m' );
		foreach ( $model['rooms'] as $r ) {
			$rows[] = array( $r['level'], $r['id'], $r['type'], $r['name'], $r['area'], $r['target'], $r['w'], $r['h'], $r['x'], $r['y'] );
		}
		$fh = fopen( 'php://temp', 'w+' ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		fwrite( $fh, "\xEF\xBB\xBF" ); // phpcs:ignore
		foreach ( $rows as $row ) {
			fputcsv( $fh, array_map( array( __CLASS__, 'csv_safe' ), $row ), ';' );
		}
		rewind( $fh );
		$csv = stream_get_contents( $fh );
		fclose( $fh ); // phpcs:ignore
		return (string) $csv;
	}

	/**
	 * Prevent CSV formula injection.
	 */
	public static function csv_safe( $v ) {
		$v = (string) $v;
		return preg_match( '/^[=+\-@\t\r]/', $v ) && ! is_numeric( $v ) ? "'" . $v : $v;
	}
}
