<?php
/**
 * Raster "massing guides" (PNG, GD) rendered from the building model.
 *
 * Used as structure reference for image models so that every view of the
 * same concept follows the same deterministic geometry (proportions, roof
 * shape, opening positions). Also used by the clearly labelled test provider.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Generation;

defined( 'ABSPATH' ) || exit;

final class GuideRenderer {

	public const W = 1344;
	public const H = 768;

	public static function available(): bool {
		return function_exists( 'imagecreatetruecolor' ) && function_exists( 'imagepng' );
	}

	/**
	 * @param array  $m      Building model.
	 * @param array  $c      Config.
	 * @param string $view   front|back|left|right|hero|aerial|garden|evening.
	 * @param string $label  Optional watermark text (test provider).
	 * @return string PNG bytes ('' when GD is missing).
	 */
	public static function render( array $m, array $c, string $view, string $label = '' ): string {
		if ( ! self::available() ) {
			return '';
		}
		$img   = imagecreatetruecolor( self::W, self::H );
		$night = 'evening' === $view;
		$sky1  = $night ? array( 22, 34, 66 ) : array( 196, 216, 236 );
		$sky2  = $night ? array( 64, 82, 120 ) : array( 238, 242, 246 );
		for ( $y = 0; $y < self::H * 0.72; $y++ ) {
			$t = $y / ( self::H * 0.72 );
			$col = imagecolorallocate( $img, (int) ( $sky1[0] + ( $sky2[0] - $sky1[0] ) * $t ), (int) ( $sky1[1] + ( $sky2[1] - $sky1[1] ) * $t ), (int) ( $sky1[2] + ( $sky2[2] - $sky1[2] ) * $t ) );
			imageline( $img, 0, $y, self::W, $y, $col );
		}
		$grass = imagecolorallocate( $img, $night ? 40 : 128, $night ? 60 : 160, $night ? 40 : 98 );
		imagefilledrectangle( $img, 0, (int) ( self::H * 0.72 ), self::W, self::H, $grass );

		$facade = self::hex( $img, (string) ( $c['facade_color'] ?? '#F2EFE9' ) );
		$facade_side = self::hex( $img, (string) ( $c['facade_color'] ?? '#F2EFE9' ), 0.82 );
		$roof   = self::hex( $img, (string) ( $c['roof_color'] ?? '#3A3D40' ) );
		$roof2  = self::hex( $img, (string) ( $c['roof_color'] ?? '#3A3D40' ), 0.8 );
		$plinth = self::hex( $img, (string) ( $c['plinth_color'] ?? '#4A4D50' ) );
		$glass  = $night ? imagecolorallocate( $img, 255, 205, 130 ) : imagecolorallocate( $img, 120, 150, 172 );
		$ink    = imagecolorallocate( $img, 30, 34, 38 );

		$r      = $m['roof'];
		$main   = $m['parts'][0];
		$W      = (float) $main['w'];
		$D      = (float) $main['h'];
		$eave   = (float) $r['eaves_height'];
		$rise   = (float) $r['ridge_height'] - $eave;
		$ground = (int) ( self::H * 0.78 );

		if ( in_array( $view, array( 'front', 'back', 'left', 'right' ), true ) ) {
			$horiz = in_array( $view, array( 'front', 'back' ), true );
			$ext   = $horiz ? $W : $D;
			$s     = min( ( self::W * 0.72 ) / max( 1, $ext ), ( self::H * 0.55 ) / max( 1, $eave + $rise ) );
			$x0    = ( self::W - $ext * $s ) / 2;
			$ytop  = $ground - $eave * $s;
			imagefilledrectangle( $img, (int) $x0, (int) $ytop, (int) ( $x0 + $ext * $s ), $ground, $facade );
			imagefilledrectangle( $img, (int) $x0, (int) ( $ground - $r['plinth'] * $s ), (int) ( $x0 + $ext * $s ), $ground, $plinth );
			$along = ( $W >= $D ) === $horiz;
			$ov    = (float) $r['eaves'] * $s;
			if ( 'flat' === $r['type'] ) {
				imagefilledrectangle( $img, (int) ( $x0 - 4 ), (int) ( $ytop - 0.35 * $s ), (int) ( $x0 + $ext * $s + 4 ), (int) $ytop, $roof );
			} elseif ( $along ) {
				$inset = in_array( $r['type'], array( 'hip', 'pyramid', 'half_hip' ), true ) ? min( $W, $D ) / 2 * $s * ( 'half_hip' === $r['type'] ? 0.5 : 1 ) : 0;
				$hgt   = 'shed' === $r['type'] ? ( 'front' === $view ? $rise * $s : 0.3 * $s ) : $rise * $s;
				imagefilledpolygon( $img, array( (int) ( $x0 - $ov ), (int) $ytop, (int) ( $x0 + $ext * $s + $ov ), (int) $ytop, (int) ( $x0 + $ext * $s - $inset ), (int) ( $ytop - $hgt ), (int) ( $x0 + $inset ), (int) ( $ytop - $hgt ) ), $roof );
			} else {
				$mid = $x0 + $ext * $s / 2;
				if ( 'gable' === $r['type'] ) {
					imagefilledpolygon( $img, array( (int) $x0, (int) $ytop, (int) $mid, (int) ( $ytop - $rise * $s ), (int) ( $x0 + $ext * $s ), (int) $ytop ), $facade );
					imagesetthickness( $img, (int) max( 3, 0.25 * $s ) );
					imageline( $img, (int) ( $x0 - $ov ), (int) ( $ytop + 0.2 * $s ), (int) $mid, (int) ( $ytop - $rise * $s ), $roof );
					imageline( $img, (int) $mid, (int) ( $ytop - $rise * $s ), (int) ( $x0 + $ext * $s + $ov ), (int) ( $ytop + 0.2 * $s ), $roof );
					imagesetthickness( $img, 1 );
				} elseif ( 'shed' === $r['type'] ) {
					imagefilledpolygon( $img, array( (int) ( $x0 - $ov ), (int) $ytop, (int) ( $x0 + $ext * $s + $ov ), (int) $ytop, (int) ( $x0 + $ext * $s + $ov ), (int) ( $ytop - ( 'left' === $view ? 0.3 : $rise ) * $s ), (int) ( $x0 - $ov ), (int) ( $ytop - ( 'left' === $view ? $rise : 0.3 ) * $s ) ), $roof );
				} else {
					imagefilledpolygon( $img, array( (int) ( $x0 - $ov ), (int) $ytop, (int) $mid, (int) ( $ytop - $rise * $s ), (int) ( $x0 + $ext * $s + $ov ), (int) $ytop ), $roof );
				}
			}
			// Openings.
			$storey = (float) ( $c['ceiling_height'] ?? 2.8 ) + 0.35;
			foreach ( $m['openings'] as $o ) {
				if ( 'ext' !== ( $o['side'] ?? '' ) || ! self::on_face( $o, $view, $main ) ) {
					continue;
				}
				$u    = $horiz ? (float) $o['x'] - $main['x'] : (float) $o['y'] - $main['y'];
				if ( in_array( $view, array( 'back', 'left' ), true ) ) {
					$u = $ext - $u;
				}
				$cx   = $x0 + $u * $s;
				$base = $r['plinth'] + (int) $o['level'] * $storey;
				$sill = in_array( $o['type'], array( 'sliding', 'entrance' ), true ) ? 0 : 0.9;
				$hh   = in_array( $o['type'], array( 'sliding', 'entrance' ), true ) ? 2.3 : 1.5;
				$hw   = (float) $o['width'] * $s / 2;
				imagefilledrectangle( $img, (int) ( $cx - $hw ), (int) ( $ground - ( $base + $sill + $hh ) * $s ), (int) ( $cx + $hw ), (int) ( $ground - ( $base + $sill ) * $s ), 'entrance' === $o['type'] ? $ink : $glass );
			}
		} else {
			// Oblique three-quarter view of the main volume (garden side + right side).
			$s     = min( ( self::W * 0.55 ) / max( 1, $W ), ( self::H * 0.45 ) / max( 1, $eave + $rise ) );
			$k     = 'aerial' === $view ? 0.55 : 0.38;
			$dx    = $D * $s * $k;
			$dy    = $D * $s * $k * ( 'aerial' === $view ? 0.7 : 0.35 );
			$x0    = ( self::W - $W * $s - $dx ) / 2;
			$base  = $ground;
			$top   = $base - $eave * $s;
			// Side wall.
			imagefilledpolygon( $img, array( (int) ( $x0 + $W * $s ), $base, (int) ( $x0 + $W * $s + $dx ), (int) ( $base - $dy ), (int) ( $x0 + $W * $s + $dx ), (int) ( $top - $dy ), (int) ( $x0 + $W * $s ), (int) $top ), $facade_side );
			// Front (garden) wall.
			imagefilledrectangle( $img, (int) $x0, (int) $top, (int) ( $x0 + $W * $s ), $base, $facade );
			imagefilledrectangle( $img, (int) $x0, (int) ( $base - $r['plinth'] * $s ), (int) ( $x0 + $W * $s ), $base, $plinth );
			// Roof.
			$rh = $rise * $s;
			if ( 'flat' === $r['type'] ) {
				imagefilledpolygon( $img, array( (int) $x0, (int) $top, (int) ( $x0 + $W * $s ), (int) $top, (int) ( $x0 + $W * $s + $dx ), (int) ( $top - $dy ), (int) ( $x0 + $dx ), (int) ( $top - $dy ) ), $roof2 );
			} else {
				$ridge_y = $top - $dy / 2 - $rh;
				$inset   = in_array( $r['type'], array( 'hip', 'pyramid' ), true ) ? $dx / 2 + min( $W, $D ) * $s / 4 : 0;
				imagefilledpolygon( $img, array( (int) ( $x0 - 8 ), (int) $top, (int) ( $x0 + $W * $s + 8 ), (int) $top, (int) ( $x0 + $W * $s + $dx / 2 - $inset ), (int) $ridge_y, (int) ( $x0 + $dx / 2 + $inset ), (int) $ridge_y ), $roof );
				imagefilledpolygon( $img, array( (int) ( $x0 + $W * $s + 8 ), (int) $top, (int) ( $x0 + $W * $s + $dx + 8 ), (int) ( $top - $dy ), (int) ( $x0 + $W * $s + $dx / 2 - $inset ), (int) $ridge_y ), 'gable' === $r['type'] ? $facade_side : $roof2 );
			}
			// Garden openings.
			foreach ( $m['openings'] as $o ) {
				if ( 'ext' !== ( $o['side'] ?? '' ) || ! self::on_face( $o, 'back', $main ) || 0 !== (int) $o['level'] ) {
					continue;
				}
				$cx = $x0 + ( (float) $o['x'] - $main['x'] ) * $s;
				$hw = (float) $o['width'] * $s / 2;
				$hh = 'sliding' === $o['type'] ? 2.3 : 1.5;
				$sl = 'sliding' === $o['type'] ? 0.0 : 0.9;
				imagefilledrectangle( $img, (int) ( $cx - $hw ), (int) ( $base - ( $r['plinth'] + $sl + $hh ) * $s ), (int) ( $cx + $hw ), (int) ( $base - ( $r['plinth'] + $sl ) * $s ), $glass );
			}
			if ( ! empty( $m['terrace'] ) ) {
				$wood = imagecolorallocate( $img, 186, 150, 110 );
				imagefilledpolygon( $img, array( (int) ( $x0 + 0.1 * $W * $s ), $base + 2, (int) ( $x0 + 0.9 * $W * $s ), $base + 2, (int) ( $x0 + 0.85 * $W * $s ), (int) ( $base + $m['terrace']['h'] * $s * 0.35 ), (int) ( $x0 + 0.05 * $W * $s ), (int) ( $base + $m['terrace']['h'] * $s * 0.35 ) ), $wood );
			}
		}

		if ( '' !== $label ) {
			$band = imagecolorallocatealpha( $img, 255, 255, 255, 30 );
			imagefilledrectangle( $img, 0, 0, self::W, 46, $band );
			imagestring( $img, 5, 16, 14, self::ascii( $label ), $ink );
			$red = imagecolorallocate( $img, 194, 85, 63 );
			imagestring( $img, 5, self::W - 330, 14, 'TESZT KEP - NEM AI GENERALAS', $red );
		}

		ob_start();
		imagepng( $img, null, 6 );
		$png = (string) ob_get_clean();
		imagedestroy( $img );
		return $png;
	}

	private static function on_face( array $o, string $face, array $p ): bool {
		$tol = BuildingModel::T_EXT + 0.05;
		$e   = (string) ( $o['edge'] ?? '' );
		switch ( $face ) {
			case 'front':
				return 'h' === $o['orient'] && abs( $o['y'] - ( $p['y'] + BuildingModel::T_EXT ) ) < $tol && 'v_start' === $e;
			case 'back':
				return 'h' === $o['orient'] && abs( $o['y'] - ( $p['y'] + $p['h'] - BuildingModel::T_EXT ) ) < $tol && 'v_end' === $e;
			case 'left':
				return 'v' === $o['orient'] && abs( $o['x'] - ( $p['x'] + BuildingModel::T_EXT ) ) < $tol;
			case 'right':
				return 'v' === $o['orient'] && abs( $o['x'] - ( $p['x'] + $p['w'] - BuildingModel::T_EXT ) ) < $tol;
		}
		return false;
	}

	private static function hex( $img, string $hex, float $shade = 1.0 ) {
		if ( ! preg_match( '/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i', $hex, $m ) ) {
			return imagecolorallocate( $img, 200, 200, 200 );
		}
		return imagecolorallocate( $img, (int) ( hexdec( $m[1] ) * $shade ), (int) ( hexdec( $m[2] ) * $shade ), (int) ( hexdec( $m[3] ) * $shade ) );
	}

	private static function ascii( string $s ): string {
		return substr( (string) preg_replace( '/[^\x20-\x7E]/', '', remove_accents( $s ) ), 0, 80 );
	}
}
