<?php
/**
 * Provider registry (active + fallback image provider, text provider).
 * Third parties can register further image providers with the
 * "agh_image_providers" filter (array id => ImageProviderInterface).
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Ai;

use AutoGroweHome\Support\Settings;

defined( 'ABSPATH' ) || exit;

final class Providers {

	/** @var array<string,ImageProviderInterface>|null */
	private static $images = null;

	/**
	 * @return array<string,ImageProviderInterface>
	 */
	public static function images(): array {
		if ( null === self::$images ) {
			$list = array(
				'magnific' => new MagnificProvider(),
				'test'     => new TestImageProvider(),
			);
			$extra = apply_filters( 'agh_image_providers', array() );
			foreach ( (array) $extra as $id => $p ) {
				if ( $p instanceof ImageProviderInterface && ! isset( $list[ $id ] ) ) {
					$list[ $id ] = $p;
				}
			}
			self::$images = $list;
		}
		return self::$images;
	}

	public static function image( string $id ): ?ImageProviderInterface {
		$all = self::images();
		return $all[ $id ] ?? null;
	}

	public static function active_image(): ?ImageProviderInterface {
		$p = self::image( (string) Settings::get( 'images.active_provider', 'magnific' ) );
		if ( $p && $p->configured() ) {
			return $p;
		}
		$fb = self::fallback_image();
		return $fb;
	}

	public static function fallback_image(): ?ImageProviderInterface {
		$id = (string) Settings::get( 'images.fallback_provider', '' );
		if ( '' === $id ) {
			return null;
		}
		$p = self::image( $id );
		return $p && $p->configured() ? $p : null;
	}

	public static function text(): AnthropicProvider {
		return new AnthropicProvider();
	}

	/**
	 * Status summary for admin and the frontend (no secrets).
	 */
	public static function status(): array {
		$active = self::active_image();
		return array(
			'image_provider'   => $active ? $active->id() : '',
			'image_label'      => $active ? $active->label() : '',
			'image_is_test'    => $active ? (bool) $active->capabilities()['is_test'] : false,
			'image_ready'      => (bool) $active,
			'text_ready'       => self::text()->configured(),
		);
	}

	public static function reset(): void {
		self::$images = null;
	}
}
