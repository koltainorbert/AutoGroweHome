<?php
/**
 * The picture prompt written from the picture (1.15.0): Claude looks at the screenshot of the
 * visitor's 3D model and writes the Magnific prompt and negative list from what it sees, with
 * Norbi's prompt-engineer template (assets/data/prompts/vision-exterior.txt). Only the curly
 * placeholders of the template are filled in; an empty value becomes "default".
 *
 * Exterior views only, and only with a stored 3D screenshot of that view. Any failure (no key,
 * time-out, a malformed answer) returns null and the caller keeps the PromptEngine prompt, so the
 * picture is always made. The answer is kept next to the guide pictures (vision-<view>.json), so a
 * retry or the same house again costs no further call.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Prompt;

use AutoGroweHome\Ai\Providers;
use AutoGroweHome\License\Features;
use AutoGroweHome\Support\Http;
use AutoGroweHome\Support\Logger;
use AutoGroweHome\Support\Settings;
use AutoGroweHome\Support\Storage;
use AutoGroweHome\Support\Util;

defined( 'ABSPATH' ) || exit;

final class VisionPrompt {

	/** The base every negative list starts with (from the template). */
	public const BASE_NEGATIVE = 'CGI, 3D render, video game graphics, cartoon, illustration, painting, plastic look, low-poly trees, oversaturated, distorted perspective, warped lines, changed architecture, extra windows, missing windows, extra floors, missing floors, blurry, low resolution, noise, artifacts, deformed vehicles, deformed people, unrealistic shadows, UI elements, watermark, text, labels';

	/** The inventory fields of the template, in its order. */
	public const ELEMENTS = array( 'floors', 'building_shape', 'roof', 'facade', 'openings', 'outdoor_structures', 'objects', 'vegetation', 'camera_angle' );

	/** Placeholders of the task part. */
	public const PLACEHOLDERS = array( 'MAGNIFIC_DESCRIPTION', 'TIME_OF_DAY', 'SEASON', 'WEATHER', 'EXTRA_WISHES' );

	/** A shorter answer is not a usable prompt (the template asks for 150–250 words). */
	private const MIN_PROMPT = 200;

	/** Longest prompt taken over; the rest of the 3900 characters is for the binding block and the negative list. */
	private const MAX_PROMPT = 2400;

	/** Views without a picture of their own (no 3D screenshot is taken for them). */
	private const VIEWS = array( 'hero', 'front', 'back', 'left', 'right', 'aerial', 'garden', 'evening' );

	/**
	 * In the licence plan (Professional and up), switched on and able to run (Anthropic configured).
	 */
	public static function enabled(): bool {
		// a Professional csomag funkciója (1.15.1); saját oldalon (AGH_OWNER_MODE) mindig él
		return Features::enabled( 'vision_prompt' ) && (bool) Settings::get( 'anthropic.vision_prompt', true ) && Providers::text()->configured();
	}

	/**
	 * The template: the operator's own (Settings → Anthropic) or the built-in one.
	 */
	public static function template(): string {
		$own = trim( (string) Settings::get( 'anthropic.vision_template', '' ) );
		if ( '' !== $own ) {
			return $own;
		}
		$file = AGH_DIR . 'assets/data/prompts/vision-exterior.txt';
		return is_readable( $file ) ? (string) file_get_contents( $file ) : ''; // phpcs:ignore WordPress.WP.AlternativeFunctions
	}

	/**
	 * The template in two: the instructions (system prompt) before the "---" line, the task after it.
	 * Without the line everything is the system prompt and the task is the line about the picture.
	 *
	 * @return array{0:string,1:string}
	 */
	public static function split( string $tpl ): array {
		$tpl   = str_replace( "\r\n", "\n", $tpl );
		$parts = preg_split( '/\n-{3,}\s*\n/', $tpl, 2 );
		if ( 2 === count( $parts ) ) {
			return array( trim( $parts[0] ), trim( $parts[1] ) );
		}
		return array( trim( $tpl ), 'The 3D exterior screenshot of the house is attached.' );
	}

	/**
	 * The values of the placeholders for a configuration. Every empty one is "default".
	 *
	 * @return array<string,string>
	 */
	public static function vars( array $c ): array {
		$wish = array();
		$own  = trim( (string) ( $c['custom_text'] ?? '' ) );
		if ( '' !== $own ) {
			$wish[] = $own;
		}
		$roof = PromptEngine::roof_product_phrase( $c );
		if ( '' !== $roof ) {
			// the catalogue product keeps its name in the picture prompt (BRAMAC)
			$wish[] = 'Roof covering product: ' . $roof . '.';
		}
		$vars = array(
			'MAGNIFIC_DESCRIPTION' => '',
			'TIME_OF_DAY'          => PromptEngine::phrase( 'time_of_day', $c ),
			'SEASON'               => PromptEngine::phrase( 'season', $c ),
			'WEATHER'              => PromptEngine::phrase( 'weather', $c ),
			'EXTRA_WISHES'         => implode( ' ', $wish ),
		);
		foreach ( $vars as $k => $v ) {
			$v          = trim( (string) preg_replace( '/\s+/', ' ', (string) $v ) );
			$vars[ $k ] = '' === $v ? 'default' : $v;
		}
		return $vars;
	}

	/**
	 * Only the curly placeholders are replaced; anything else in the template stays as written.
	 */
	public static function fill( string $task, array $vars ): string {
		foreach ( self::PLACEHOLDERS as $k ) {
			$task = str_replace( '{' . $k . '}', (string) ( $vars[ $k ] ?? 'default' ), $task );
		}
		return $task;
	}

	/**
	 * Whether a view can get a prompt from its picture.
	 */
	public static function applies( string $op, string $view ): bool {
		// Only where the picture must follow the model ("Faithful", "Clone", custom strength). On
		// "Free" and "Balanced" the three concepts may differ in massing and materials, and that
		// comes from the configuration prompt – one screenshot would make them alike.
		$fidelity = (string) Settings::get( 'magnific.fidelity', 'faithful' );
		return 'interior' !== $op && in_array( $view, self::VIEWS, true ) && in_array( $fidelity, array( 'faithful', 'clone', 'custom' ), true );
	}

	/**
	 * The picture Claude looks at: the full scene of the view (vehicles, people, pets and trees in
	 * it) when the browser took one beside the clean guide, otherwise the guide itself. Only the
	 * visitor's own 3D screenshots count, never the server's flat massing drawing.
	 */
	public static function picture( string $uuid, string $view ): string {
		$full = Storage::guide_path( $uuid, 'scene_' . $view );
		return '' !== $full ? $full : Storage::guide_path( $uuid, $view );
	}

	/**
	 * Run the template on the picture of a view.
	 *
	 * @return array{prompt:string,negative:string[],detected:array,cached:bool,model:string}|null
	 */
	public static function run( array $p, string $view ): ?array {
		$uuid = (string) ( $p['uuid'] ?? '' );
		if ( ! Util::is_uuid( $uuid ) || ! in_array( $view, self::VIEWS, true ) || ! self::enabled() ) {
			return null;
		}
		$img = self::picture( $uuid, $view );
		if ( '' === $img ) {
			return null;
		}
		list( $system, $task ) = self::split( self::template() );
		if ( '' === $system ) {
			return null;
		}
		$raw  = (string) file_get_contents( $img ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		$task = self::fill( $task, self::vars( (array) ( $p['config'] ?? array() ) ) );
		$mime = '.png' === substr( $img, -4 ) ? 'image/png' : 'image/jpeg';
		$key  = sha1( sha1( $raw ) . '|' . sha1( $system ) . '|' . $task . '|' . (string) Settings::get( 'anthropic.model', '' ) );

		$kept = self::stored( $uuid, $view );
		if ( $kept && ( $kept['key'] ?? '' ) === $key && '' !== (string) ( $kept['prompt'] ?? '' ) ) {
			return array(
				'prompt'   => (string) $kept['prompt'],
				'negative' => self::items( (string) ( $kept['negative_prompt'] ?? '' ) ),
				'detected' => (array) ( $kept['detected_elements'] ?? array() ),
				'cached'   => true,
				'model'    => (string) ( $kept['model'] ?? '' ),
			);
		}

		$res = Providers::text()->call_tool(
			$system,
			$task,
			'submit_render_prompt',
			'Return the inventory of the screenshot, the positive prompt and the negative prompt, exactly as the OUTPUT section asks.',
			self::schema(),
			2000,
			array(
				array(
					'mime' => $mime,
					'data' => base64_encode( $raw ),
				),
			),
			array(
				'temperature' => (float) Settings::get( 'anthropic.vision_temperature', 0.2 ),
				'timeout'     => (int) Settings::get( 'anthropic.vision_timeout', 60 ),
				'retries'     => (int) Settings::get( 'anthropic.vision_retries', 1 ),
			)
		);
		$pid = (int) ( $p['id'] ?? 0 );
		if ( ! $res['ok'] ) {
			Logger::warning( 'vision', 'Picture prompt failed, the configuration prompt is used', array( 'view' => $view, 'error' => $res['error'] ), $pid );
			return null;
		}
		$out    = self::clean( (array) $res['input'] );
		$prompt = $out['prompt'];
		if ( mb_strlen( $prompt ) < self::MIN_PROMPT ) {
			Logger::warning( 'vision', 'Picture prompt too short, the configuration prompt is used', array( 'view' => $view, 'length' => mb_strlen( $prompt ) ), $pid );
			return null;
		}
		$record = array(
			'key'               => $key,
			'model'             => (string) $res['model'],
			'created'           => gmdate( 'c' ),
			'usage'             => (array) $res['usage'],
			'detected_elements' => $out['detected'],
			'prompt'            => $prompt,
			'negative_prompt'   => implode( ', ', $out['negative'] ),
		);
		try {
			Storage::put( $uuid, 'vision/' . $view . '.json', (string) wp_json_encode( $record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT ) );
		} catch ( \Throwable $e ) {
			// not kept: the next attempt asks again
			unset( $e );
		}
		Logger::info( 'vision', 'Picture prompt written', array( 'view' => $view, 'chars' => mb_strlen( $prompt ), 'usage' => $res['usage'] ), $pid );
		return array(
			'prompt'   => $prompt,
			'negative' => $out['negative'],
			'detected' => $out['detected'],
			'cached'   => false,
			'model'    => (string) $res['model'],
		);
	}

	/**
	 * The kept answer of a view (admin: "what the picture keeps"), null when there is none.
	 */
	public static function stored( string $uuid, string $view ): ?array {
		if ( ! Util::is_uuid( $uuid ) || ! preg_match( '/^[a-z][a-z0-9_]{1,30}$/', $view ) ) {
			return null;
		}
		$abs = Storage::path( $uuid . '/vision-' . $view . '.json' );
		if ( '' === $abs || ! is_file( $abs ) ) {
			return null;
		}
		$d = json_decode( (string) file_get_contents( $abs ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		return is_array( $d ) ? $d : null;
	}

	/**
	 * The answer made safe: plain one-line text, the inventory with all nine fields ("none" when
	 * missing), the negative list starting with the template's base.
	 *
	 * @return array{prompt:string,negative:string[],detected:array<string,string>}
	 */
	public static function clean( array $in ): array {
		$line   = static fn( $v ): string => trim( (string) preg_replace( '/\s+/', ' ', wp_strip_all_tags( is_scalar( $v ) ? (string) $v : '' ) ) );
		$prompt = $line( $in['prompt'] ?? '' );
		if ( mb_strlen( $prompt ) > self::MAX_PROMPT ) {
			$cut    = mb_substr( $prompt, 0, self::MAX_PROMPT );
			$dot    = mb_strrpos( $cut, '. ' );
			$prompt = false !== $dot && $dot > self::MAX_PROMPT / 2 ? mb_substr( $cut, 0, $dot + 1 ) : $cut;
		}
		$detected = array();
		$src      = is_array( $in['detected_elements'] ?? null ) ? $in['detected_elements'] : array();
		foreach ( self::ELEMENTS as $k ) {
			$v              = $line( $src[ $k ] ?? '' );
			$detected[ $k ] = '' === $v ? 'none' : mb_substr( $v, 0, 400 );
		}
		return array(
			'prompt'   => $prompt,
			'negative' => self::merge( self::items( $line( $in['negative_prompt'] ?? '' ) ) ),
			'detected' => $detected,
		);
	}

	/**
	 * A comma list as items.
	 *
	 * @return string[]
	 */
	public static function items( string $list ): array {
		$out = array();
		foreach ( explode( ',', $list ) as $i ) {
			$i = trim( $i, " \t\n\r\0\x0B." );
			if ( '' !== $i ) {
				$out[] = $i;
			}
		}
		return $out;
	}

	/**
	 * The base first (always whole), then the further items, each once, in their order.
	 *
	 * @param string[] ...$lists Further items (the model's own, then the configuration's wrong alternatives).
	 * @return string[]
	 */
	public static function merge( array ...$lists ): array {
		$out  = array();
		$seen = array();
		foreach ( array_merge( array( self::items( self::BASE_NEGATIVE ) ), $lists ) as $list ) {
			foreach ( $list as $i ) {
				$k = strtolower( trim( (string) $i ) );
				if ( '' === $k || isset( $seen[ $k ] ) ) {
					continue;
				}
				$seen[ $k ] = true;
				$out[]      = trim( (string) $i );
			}
		}
		return $out;
	}

	/**
	 * The prompt parts for PromptEngine::compose(): the picture prompt and "Avoid: …" with the
	 * model's negative list and the configuration's wrong alternatives. Without parts compose() only
	 * ever shortens the prompt body, never the negative list.
	 *
	 * @return array{prompt:string,negative:string,negative_list:string,view:string,parts:array}
	 */
	public static function built( array $vision, array $config, string $view ): array {
		$neg = self::merge( (array) $vision['negative'], PromptEngine::config_negative( $config, false ) );
		return array(
			'prompt'        => (string) $vision['prompt'],
			'negative'      => 'Avoid: ' . implode( ', ', $neg ) . '.',
			'negative_list' => implode( ', ', $neg ),
			'view'          => $view,
			'parts'         => array(),
		);
	}

	/**
	 * The JSON shape of the template's OUTPUT section, for the forced tool call.
	 */
	public static function schema(): array {
		$props = array();
		foreach ( self::ELEMENTS as $k ) {
			$props[ $k ] = array( 'type' => 'string' );
		}
		return array(
			'type'       => 'object',
			'properties' => array(
				'detected_elements' => array(
					'type'       => 'object',
					'properties' => $props,
					'required'   => self::ELEMENTS,
				),
				'prompt'            => array( 'type' => 'string' ),
				'negative_prompt'   => array( 'type' => 'string' ),
			),
			'required'   => array( 'detected_elements', 'prompt', 'negative_prompt' ),
		);
	}

	/**
	 * Worst case of one picture-prompt call in seconds (for the job lock).
	 */
	public static function worst_case_seconds(): int {
		if ( ! self::enabled() ) {
			return 0;
		}
		return Http::worst_case_seconds( max( 10, (int) Settings::get( 'anthropic.vision_timeout', 60 ) ), max( 0, (int) Settings::get( 'anthropic.vision_retries', 1 ) ) );
	}
}
