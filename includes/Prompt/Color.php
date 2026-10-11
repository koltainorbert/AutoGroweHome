<?php
/**
 * Converts HEX colours to descriptive English colour names for prompts
 * (image models follow words far better than hex codes).
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Prompt;

defined( 'ABSPATH' ) || exit;

final class Color {

	public static function describe( string $hex ): string {
		if ( ! preg_match( '/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i', $hex, $m ) ) {
			return '';
		}
		$r = hexdec( $m[1] ) / 255;
		$g = hexdec( $m[2] ) / 255;
		$b = hexdec( $m[3] ) / 255;
		$max = max( $r, $g, $b );
		$min = min( $r, $g, $b );
		$l   = ( $max + $min ) / 2;
		$d   = $max - $min;
		$s   = 0.0;
		$h   = 0.0;
		if ( $d > 0.0001 ) {
			$s = $l > 0.5 ? $d / ( 2 - $max - $min ) : $d / ( $max + $min );
			if ( $max === $r ) {
				$h = fmod( ( ( $g - $b ) / $d ), 6 );
			} elseif ( $max === $g ) {
				$h = ( ( $b - $r ) / $d ) + 2;
			} else {
				$h = ( ( $r - $g ) / $d ) + 4;
			}
			$h *= 60;
			if ( $h < 0 ) {
				$h += 360;
			}
		}

		// Near-neutrals.
		if ( $s < 0.12 || $d < 0.06 ) {
			$warm = $r > $b + 0.02;
			if ( $l > 0.93 ) {
				return $warm ? 'warm white' : 'pure white';
			}
			if ( $l > 0.82 ) {
				return $warm ? 'off-white' : 'very light grey';
			}
			if ( $l > 0.62 ) {
				return $warm ? 'light greige' : 'light grey';
			}
			if ( $l > 0.42 ) {
				return $warm ? 'warm mid grey' : 'mid grey';
			}
			if ( $l > 0.22 ) {
				return 'anthracite grey';
			}
			if ( $l > 0.12 ) {
				return 'dark charcoal';
			}
			return 'black';
		}

		$hue = 'red';
		$names = array(
			array( 15, 'red' ), array( 40, 'orange' ), array( 65, 'yellow' ), array( 90, 'olive' ),
			array( 160, 'green' ), array( 200, 'teal' ), array( 250, 'blue' ), array( 290, 'violet' ), array( 340, 'magenta' ), array( 361, 'red' ),
		);
		foreach ( $names as $n ) {
			if ( $h < $n[0] ) {
				$hue = $n[1];
				break;
			}
		}
		// Warm earthy tones.
		if ( in_array( $hue, array( 'orange', 'red', 'yellow' ), true ) ) {
			if ( $l < 0.25 ) {
				return 'red' === $hue ? 'deep burgundy' : 'dark brown';
			}
			if ( $l < 0.45 ) {
				return 'red' === $hue ? 'brick red' : ( 'yellow' === $hue ? 'olive brown' : 'warm brown' );
			}
			if ( $l < 0.65 && $s < 0.6 ) {
				return 'red' === $hue ? 'terracotta' : ( 'orange' === $hue ? 'natural oak' : 'ochre' );
			}
			if ( $l > 0.8 ) {
				return 'yellow' === $hue ? 'cream' : 'warm sand beige';
			}
			return 'orange' === $hue ? 'honey oak' : ( 'red' === $hue ? 'coral red' : 'mustard yellow' );
		}
		$tone = $l < 0.3 ? 'dark ' : ( $l > 0.75 ? 'pale ' : '' );
		$mut  = $s < 0.35 ? 'muted ' : '';
		if ( 'green' === $hue && $s < 0.35 ) {
			return $tone . 'sage green';
		}
		if ( 'blue' === $hue && $s < 0.35 ) {
			return $tone . 'slate blue';
		}
		return trim( $tone . $mut . $hue );
	}
}
