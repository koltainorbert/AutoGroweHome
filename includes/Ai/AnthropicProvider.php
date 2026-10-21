<?php
/**
 * Anthropic Messages API adapter (text understanding & structuring only –
 * image generation is never delegated to it).
 *
 * Uses forced tool use (tool_choice = tool) so the model must return JSON
 * matching our input_schema; the result is then validated again locally.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Ai;

use AutoGroweHome\Support\Http;
use AutoGroweHome\Support\Secrets;
use AutoGroweHome\Support\Settings;

defined( 'ABSPATH' ) || exit;

final class AnthropicProvider {

	public function configured(): bool {
		return (bool) Settings::get( 'anthropic.enabled', true ) && Secrets::has( 'anthropic_api_key' );
	}

	private function headers(): array {
		return array(
			'x-api-key'         => Secrets::get( 'anthropic_api_key' ),
			'anthropic-version' => (string) Settings::get( 'anthropic.version', '2023-06-01' ),
			'content-type'      => 'application/json',
		);
	}

	/**
	 * Call the model and force a single tool call.
	 *
	 * @param array $images  Pictures sent before the text, each array( 'mime' => 'image/jpeg', 'data' => base64 ).
	 * @param array $opts    Overrides for this call: temperature (float), timeout (s), retries.
	 * @return array{ok:bool,input:array,error:string,usage:array,model:string,transient:bool}
	 */
	public function call_tool( string $system, string $user, string $tool_name, string $tool_description, array $schema, int $max_tokens = 0, array $images = array(), array $opts = array() ): array {
		if ( ! $this->configured() ) {
			return array( 'ok' => false, 'input' => array(), 'error' => __( 'Az Anthropic API-kulcs nincs beállítva.', 'autogrowehome' ), 'usage' => array(), 'model' => '', 'transient' => false );
		}
		$model   = (string) Settings::get( 'anthropic.model', 'claude-sonnet-5-5' );
		$content = $user;
		if ( ! empty( $images ) ) {
			// the picture first, then the question about it
			$content = array();
			foreach ( $images as $img ) {
				$content[] = array(
					'type'   => 'image',
					'source' => array(
						'type'       => 'base64',
						'media_type' => (string) ( $img['mime'] ?? 'image/jpeg' ),
						'data'       => (string) ( $img['data'] ?? '' ),
					),
				);
			}
			$content[] = array(
				'type' => 'text',
				'text' => $user,
			);
		}
		$body = array(
			'model'       => $model,
			'max_tokens'  => $max_tokens > 0 ? $max_tokens : (int) Settings::get( 'anthropic.max_tokens', 8000 ),
			'temperature' => isset( $opts['temperature'] ) ? (float) $opts['temperature'] : (float) Settings::get( 'anthropic.temperature', 0.6 ),
			'system'      => $system,
			'messages'    => array(
				array(
					'role'    => 'user',
					'content' => $content,
				),
			),
			'tools'       => array(
				array(
					'name'         => $tool_name,
					'description'  => $tool_description,
					'input_schema' => $schema,
				),
			),
			'tool_choice' => array(
				'type' => 'tool',
				'name' => $tool_name,
			),
		);
		$resp = Http::request(
			'POST',
			(string) Settings::get( 'anthropic.endpoint', 'https://api.anthropic.com/v1/messages' ),
			$this->headers(),
			$body,
			isset( $opts['timeout'] ) ? (int) $opts['timeout'] : (int) Settings::get( 'anthropic.timeout', 90 ),
			isset( $opts['retries'] ) ? (int) $opts['retries'] : (int) Settings::get( 'anthropic.retries', 2 )
		);
		$usage = array(
			'in'  => (int) ( $resp['json']['usage']['input_tokens'] ?? 0 ),
			'out' => (int) ( $resp['json']['usage']['output_tokens'] ?? 0 ),
		);
		if ( ! $resp['ok'] ) {
			$msg = $resp['error'];
			if ( 401 === $resp['code'] ) {
				$msg = __( 'Anthropic: érvénytelen API-kulcs (401).', 'autogrowehome' );
			} elseif ( 404 === $resp['code'] ) {
				$msg = __( 'Anthropic: a megadott modell nem található (404). Ellenőrizd a modellazonosítót.', 'autogrowehome' );
			}
			return array( 'ok' => false, 'input' => array(), 'error' => $msg, 'usage' => $usage, 'model' => $model, 'transient' => (bool) $resp['transient'] );
		}
		foreach ( (array) ( $resp['json']['content'] ?? array() ) as $block ) {
			if ( 'tool_use' === ( $block['type'] ?? '' ) && $tool_name === ( $block['name'] ?? '' ) && is_array( $block['input'] ?? null ) ) {
				return array( 'ok' => true, 'input' => $block['input'], 'error' => '', 'usage' => $usage, 'model' => (string) ( $resp['json']['model'] ?? $model ), 'transient' => false );
			}
		}
		$stop = (string) ( $resp['json']['stop_reason'] ?? '' );
		return array( 'ok' => false, 'input' => array(), 'error' => 'Anthropic: no tool output (stop_reason: ' . $stop . ')', 'usage' => $usage, 'model' => $model, 'transient' => 'max_tokens' !== $stop );
	}

	/**
	 * Free connection test via GET /v1/models (no token cost).
	 */
	public function test(): array {
		if ( ! Secrets::has( 'anthropic_api_key' ) ) {
			return array( 'ok' => false, 'message' => __( 'Nincs API-kulcs.', 'autogrowehome' ) );
		}
		$endpoint = (string) Settings::get( 'anthropic.endpoint', 'https://api.anthropic.com/v1/messages' );
		$models   = preg_replace( '#/messages$#', '/models', $endpoint );
		$resp     = Http::request( 'GET', $models . '?limit=100', $this->headers(), null, 20, 0 );
		if ( ! $resp['ok'] ) {
			return array( 'ok' => false, 'message' => 401 === $resp['code'] ? __( 'Érvénytelen API-kulcs (401).', 'autogrowehome' ) : $resp['error'] );
		}
		$ids   = array_map( static fn( $m ) => (string) ( $m['id'] ?? '' ), (array) ( $resp['json']['data'] ?? array() ) );
		$model = (string) Settings::get( 'anthropic.model', '' );
		$found = in_array( $model, $ids, true );
		return array(
			'ok'      => true,
			'message' => sprintf( /* translators: 1: ms, 2: model status */ __( 'Kapcsolat rendben (%1$d ms). %2$s', 'autogrowehome' ), $resp['ms'], $found ? sprintf( /* translators: %s: model id. */ __( 'A(z) %s modell elérhető.', 'autogrowehome' ), $model ) : sprintf( /* translators: 1: configured model id, 2: available model ids. */ __( 'Figyelem: a(z) %1$s modell nem szerepel a listában. Elérhető: %2$s', 'autogrowehome' ), $model, implode( ', ', array_slice( $ids, 0, 8 ) ) ) ),
			'models'  => $ids,
		);
	}
}
