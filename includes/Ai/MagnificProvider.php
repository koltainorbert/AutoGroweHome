<?php
/**
 * Magnific API adapter.
 *
 * Endpoints and the fields this adapter actually SENDS (contract checked
 * against docs.magnific.com, October 2026; the APIs accept further optional
 * fields that are not used here):
 *  - Base URL https://api.magnific.com (setting magnific.base_url, https only),
 *    auth header "x-magnific-api-key"; requests never follow redirects.
 *  - POST /v1/ai/mystic (hero images, and views when the reference
 *    strategy is not used): prompt, resolution (1k|2k|4k), aspect_ratio,
 *    model, engine, creative_detailing, filter_nsfw (setting
 *    magnific.filter_nsfw, default true); optionally structure_reference +
 *    structure_strength (structure guidance), style_reference + adherence
 *    (consistency with the hero, or the operator's style sample photo) + hdr,
 *    fixed_generation, webhook_url. There is no negative-prompt field.
 *    → {data:{task_id,status,generated[]}}; GET /v1/ai/mystic/{task-id}.
 *  - POST /v1/ai/text-to-image/flux-2-pro (views with the reference
 *    strategy): prompt, width, height (256–1440), input_image (hero);
 *    optionally input_image_2 (structure guide), seed, webhook_url.
 *  - POST /v1/ai/image-upscaler-precision: image, sharpen, ultra_detail
 *    (optionally webhook_url). With a configured creative upscaler endpoint
 *    ("image-upscaler" without "precision"): image, scale_factor,
 *    optimized_for, prompt, creativity, resemblance (optionally webhook_url).
 *  - Status values: CREATED, IN_PROGRESS, COMPLETED, FAILED.
 *  - Prompt length: every prompt is capped at PromptEngine::MAX_PROMPT
 *    characters (plugin-side limit; PromptEngine::combined() already fits
 *    prompts into it, clip() here is a last guard).
 *
 * The GET status path for non-Mystic endpoints follows the same
 * "{endpoint}/{task-id}" convention; it is configurable via the
 * agh_magnific_status_path filter if Magnific changes it. Task references
 * are stored as "{endpoint}|{task-id}"; the endpoint part must satisfy the
 * same rule as the endpoint settings (Settings::is_endpoint_path()).
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Ai;

use AutoGroweHome\Prompt\PromptEngine;
use AutoGroweHome\Support\Http;
use AutoGroweHome\Support\Secrets;
use AutoGroweHome\Support\Settings;

defined( 'ABSPATH' ) || exit;

final class MagnificProvider implements ImageProviderInterface {

	private const ASPECTS = array(
		'16:9' => 'widescreen_16_9',
		'4:3'  => 'classic_4_3',
		'3:2'  => 'standard_3_2',
		'1:1'  => 'square_1_1',
		'3:4'  => 'traditional_3_4',
		'2:1'  => 'horizontal_2_1',
	);

	public function id(): string {
		return 'magnific';
	}

	public function label(): string {
		return 'Magnific';
	}

	public function configured(): bool {
		return (bool) Settings::get( 'magnific.enabled', true ) && Secrets::has( 'magnific_api_key' );
	}

	public function capabilities(): array {
		return array(
			'reference' => true,
			'structure' => true,
			'photo'     => true,   // the 3D picture itself can be turned into the photo (1.16.0)
			'native_4k' => true,
			'upscale'   => true,
			'is_test'   => false,
			// Mystic and Flux have no negative-prompt field (docs.magnific.com, 2026-10): the list
			// goes at the end of the prompt text instead (PromptEngine::compose()).
			'negative'  => false,
		);
	}

	private function base(): string {
		return untrailingslashit( (string) Settings::get( 'magnific.base_url', 'https://api.magnific.com' ) );
	}

	private function headers(): array {
		return array(
			'x-magnific-api-key' => Secrets::get( 'magnific_api_key' ),
			'Content-Type'       => 'application/json',
			'Accept'             => 'application/json',
		);
	}

	private function endpoint( string $key, string $default ): string {
		$e = (string) Settings::get( 'magnific.' . $key, $default );
		return '/' . ltrim( $e, '/' );
	}

	public function submit( array $r ): array {
		if ( ! $this->configured() ) {
			return $this->fail( __( 'A Magnific API-kulcs nincs beállítva.', 'autogrowehome' ), false );
		}
		$op = $r['op'] ?? 'hero';
		if ( 'upscale' === $op ) {
			return $this->submit_upscale( $r );
		}
		if ( ! empty( $r['photo'] ) && ! empty( $r['structure_image'] ) ) {
			return $this->submit_photo( $r );
		}
		$use_reference = in_array( $op, array( 'view', 'interior' ), true ) && ! empty( $r['reference_image'] );
		$strategy      = (string) Settings::get( 'magnific.view_strategy', 'reference' );

		// Bound to the 3D model (Faithful/Clone with its picture): Flux has no structure strength and
		// follows the text, so the view goes the Mystic way – the 3D picture as structure, the chosen
		// hero as style reference (1.15.3).
		$bound = ! empty( $r['bound'] ) && ! empty( $r['structure_image'] ) && Settings::get( 'magnific.structure_guidance', true );
		if ( $use_reference && 'reference' === $strategy && ! $bound ) {
			$endpoint = $this->endpoint( 'reference_endpoint', '/v1/ai/text-to-image/flux-2-pro' );
			$body     = array(
				'prompt'      => PromptEngine::clip( (string) $r['prompt'] ),
				'width'       => (int) min( 1440, max( 256, (int) Settings::get( 'magnific.reference_width', 1440 ) ) ),
				'height'      => (int) min( 1440, max( 256, (int) Settings::get( 'magnific.reference_height', 816 ) ) ),
				'input_image' => (string) $r['reference_image'],
			);
			if ( ! empty( $r['structure_image'] ) ) {
				$body['input_image_2'] = (string) $r['structure_image'];
			}
			if ( isset( $r['seed'] ) ) {
				$body['seed'] = (int) $r['seed'];
			}
			$native = '1k';
			$model  = 'flux-2-pro';
		} else {
			$endpoint = $this->endpoint( 'hero_endpoint', '/v1/ai/mystic' );
			$res      = in_array( $r['resolution'] ?? '', array( '1k', '2k', '4k' ), true ) ? $r['resolution'] : (string) Settings::get( 'magnific.preview_resolution', '2k' );
			$body     = array(
				'prompt'             => PromptEngine::clip( (string) $r['prompt'] ),
				'resolution'         => $res,
				'aspect_ratio'       => self::ASPECTS[ $r['aspect'] ?? '16:9' ] ?? (string) Settings::get( 'magnific.aspect_ratio', 'widescreen_16_9' ),
				'model'              => (string) Settings::get( 'magnific.mystic_model', 'realism' ),
				'engine'             => (string) Settings::get( 'magnific.mystic_engine', 'automatic' ),
				'creative_detailing' => (int) Settings::get( 'magnific.creative_detailing', 33 ),
				'filter_nsfw'        => (bool) Settings::get( 'magnific.filter_nsfw', true ),
			);
			if ( ! empty( $r['structure_image'] ) && Settings::get( 'magnific.structure_guidance', true ) ) {
				$body['structure_reference'] = (string) $r['structure_image'];
				$body['structure_strength']  = PromptEngine::fidelity_strength();
			}
			if ( $use_reference ) {
				$body['style_reference'] = (string) $r['reference_image'];
				$body['adherence']       = (int) Settings::get( 'magnific.style_adherence', 60 );
			} elseif ( ! empty( $r['style_image'] ) ) {
				// the operator's sample photo of the style: the photographic look, while the 3D guide
				// keeps the form (style strength 40–50 → adherence 60–50)
				$body['style_reference'] = (string) $r['style_image'];
				$body['adherence']       = PromptEngine::style_adherence();
			}
			if ( isset( $body['style_reference'] ) ) {
				// only works together with a style reference: lower looks more natural, higher more "AI"
				$body['hdr'] = max( 0, min( 100, (int) Settings::get( 'magnific.hdr', 35 ) ) );
			}
			if ( ! empty( $r['fixed'] ) ) {
				$body['fixed_generation'] = true;
			}
			$native = $res;
			$model  = 'mystic/' . $body['model'];
		}
		if ( ! empty( $r['webhook_url'] ) ) {
			$body['webhook_url'] = (string) $r['webhook_url'];
		}

		$resp = Http::request( 'POST', $this->base() . $endpoint, $this->headers(), $body, 60, (int) Settings::get( 'magnific.retries', 2 ) );
		$out  = $this->parse( $resp, $endpoint );
		$out['native_resolution'] = $native;
		$out['model']             = $model;
		$out['cost_key']          = 'flux-2-pro' === $model ? 'reference_image' : ( '4k' === $native ? 'mystic_4k' : 'mystic_2k' );
		return $out;
	}

	/**
	 * "Photo from the 3D picture" (1.16.0): Flux 2 Pro edits the visitor's 3D picture into a
	 * photograph; a view also gets the chosen hero photo as second image (same materials and light).
	 * Measured in the Magnific app on Norbi's 3D picture: roof colour, garage, pergola, pool, fence
	 * and car all stayed in place.
	 */
	private function submit_photo( array $r ): array {
		$endpoint = $this->endpoint( 'reference_endpoint', '/v1/ai/text-to-image/flux-2-pro' );
		$size     = static fn( $v, int $d ): int => (int) max( 256, min( 1440, ( (int) round( ( (int) $v ?: $d ) / 16 ) ) * 16 ) );
		$body     = array(
			'prompt'      => PromptEngine::clip( (string) $r['prompt'] ),
			'width'       => $size( $r['width'] ?? 0, 1440 ),
			'height'      => $size( $r['height'] ?? 0, 880 ),
			'input_image' => (string) $r['structure_image'],
		);
		if ( ! empty( $r['reference_image'] ) ) {
			$body['input_image_2'] = (string) $r['reference_image'];
		}
		if ( isset( $r['seed'] ) ) {
			$body['seed'] = (int) $r['seed'];
		}
		if ( ! empty( $r['webhook_url'] ) ) {
			$body['webhook_url'] = (string) $r['webhook_url'];
		}
		$resp = Http::request( 'POST', $this->base() . $endpoint, $this->headers(), $body, 60, (int) Settings::get( 'magnific.retries', 2 ) );
		$out  = $this->parse( $resp, $endpoint );
		$out['native_resolution'] = '1k';
		$out['model']             = 'flux-2-pro/photo';
		$out['cost_key']          = 'reference_image';
		return $out;
	}

	private function submit_upscale( array $r ): array {
		$endpoint = $this->endpoint( 'upscale_endpoint', '/v1/ai/image-upscaler-precision' );
		$body     = array(
			'image'        => (string) ( $r['image'] ?? '' ),
			'sharpen'      => (int) Settings::get( 'magnific.upscale_sharpen', 40 ),
			'ultra_detail' => (int) Settings::get( 'magnific.upscale_ultra_detail', 30 ),
		);
		if ( false !== strpos( $endpoint, 'image-upscaler' ) && false === strpos( $endpoint, 'precision' ) ) {
			// Creative upscaler contract.
			$body = array(
				'image'         => (string) ( $r['image'] ?? '' ),
				'scale_factor'  => '2x',
				'optimized_for' => '3d_renders',
				'prompt'        => PromptEngine::clip( (string) ( $r['prompt'] ?? '' ) ),
				'creativity'    => 0,
				'resemblance'   => 5,
			);
		}
		if ( ! empty( $r['webhook_url'] ) ) {
			$body['webhook_url'] = (string) $r['webhook_url'];
		}
		$resp = Http::request( 'POST', $this->base() . $endpoint, $this->headers(), $body, 90, (int) Settings::get( 'magnific.retries', 2 ) );
		$out  = $this->parse( $resp, $endpoint );
		$out['native_resolution'] = '';
		$out['model']             = 'upscaler';
		$out['cost_key']          = 'upscale';
		return $out;
	}

	public function status( string $task ): array {
		$parts = explode( '|', $task, 2 );
		if ( 2 !== count( $parts ) || ! preg_match( '/^[0-9a-f-]{36}$/i', $parts[1] ) || ! Settings::is_endpoint_path( $parts[0] ) ) {
			return $this->fail( 'Invalid task reference', false );
		}
		$path = apply_filters( 'agh_magnific_status_path', $parts[0] . '/' . $parts[1], $parts[0], $parts[1] );
		$resp = Http::request( 'GET', $this->base() . $path, $this->headers(), null, 30, 1 );
		return $this->parse( $resp, $parts[0] );
	}

	private function parse( array $resp, string $endpoint ): array {
		if ( ! $resp['ok'] ) {
			$msg = $resp['error'];
			if ( 401 === $resp['code'] || 403 === $resp['code'] ) {
				$msg = __( 'Magnific: érvénytelen vagy jogosulatlan API-kulcs.', 'autogrowehome' ) . ' (' . $resp['code'] . ')';
			} elseif ( 402 === $resp['code'] ) {
				$msg = __( 'Magnific: elfogyott a kredit vagy nincs aktív előfizetés.', 'autogrowehome' );
			}
			return $this->fail( $msg, (bool) $resp['transient'] );
		}
		$data = $resp['json']['data'] ?? null;
		if ( ! is_array( $data ) || empty( $data['task_id'] ) ) {
			return $this->fail( __( 'Magnific: váratlan válaszformátum.', 'autogrowehome' ), true );
		}
		$status = strtoupper( (string) ( $data['status'] ?? '' ) );
		$map    = array(
			'CREATED'     => 'pending',
			'IN_PROGRESS' => 'pending',
			'COMPLETED'   => 'completed',
			'FAILED'      => 'failed',
		);
		$urls = array();
		foreach ( (array) ( $data['generated'] ?? array() ) as $u ) {
			// DNS/IP safety is enforced again by wp_safe_remote_get() when downloading.
			if ( is_string( $u ) && 0 === strpos( $u, 'https://' ) && false !== filter_var( $u, FILTER_VALIDATE_URL ) ) {
				$urls[] = $u;
			}
		}
		$state = $map[ $status ] ?? 'pending';
		if ( 'completed' === $state && empty( $urls ) ) {
			$state = 'failed';
		}
		$nsfw = ! empty( $data['has_nsfw'] ) && in_array( true, (array) $data['has_nsfw'], true );
		return array(
			'ok'        => 'failed' !== $state,
			'status'    => $state,
			'task'      => $endpoint . '|' . $data['task_id'],
			'urls'      => $urls,
			'bytes'     => '',
			'error'     => 'failed' === $state ? ( $nsfw ? __( 'A szolgáltató szűrője blokkolta a képet.', 'autogrowehome' ) : __( 'A szolgáltató hibát jelzett a generálás során.', 'autogrowehome' ) ) : '',
			'transient' => 'failed' === $state && ! $nsfw,
		);
	}

	private function fail( string $msg, bool $transient ): array {
		return array(
			'ok'        => false,
			'status'    => 'failed',
			'task'      => '',
			'urls'      => array(),
			'bytes'     => '',
			'error'     => $msg,
			'transient' => $transient,
		);
	}

	/**
	 * Authentication check without generation cost: querying a random task id
	 * returns 404 with a valid key and 401 with an invalid one.
	 */
	public function test(): array {
		if ( ! Secrets::has( 'magnific_api_key' ) ) {
			return array( 'ok' => false, 'message' => __( 'Nincs API-kulcs.', 'autogrowehome' ) );
		}
		$resp = Http::request( 'GET', $this->base() . $this->endpoint( 'hero_endpoint', '/v1/ai/mystic' ) . '/' . wp_generate_uuid4(), $this->headers(), null, 20, 0 );
		if ( 401 === $resp['code'] || 403 === $resp['code'] ) {
			return array( 'ok' => false, 'message' => __( 'A kulcsot a Magnific elutasította (401/403).', 'autogrowehome' ) );
		}
		if ( 0 === $resp['code'] ) {
			return array( 'ok' => false, 'message' => __( 'A Magnific API nem érhető el: ', 'autogrowehome' ) . $resp['error'] );
		}
		if ( in_array( $resp['code'], array( 200, 400, 404 ), true ) ) {
			return array( 'ok' => true, 'message' => sprintf( /* translators: 1: http code, 2: ms */ __( 'Kapcsolat rendben (HTTP %1$d, %2$d ms). A kulcs hitelesítve.', 'autogrowehome' ), $resp['code'], $resp['ms'] ) );
		}
		return array( 'ok' => false, 'message' => $resp['error'] );
	}
}
