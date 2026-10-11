<?php
/**
 * Contract for image generation providers.
 *
 * Request keys: op (hero|view|interior|upscale), prompt, aspect (e.g. 16:9),
 * resolution (1k|2k|4k), reference_image (base64, optional), structure_image
 * (base64, optional), image (base64, for upscale), seed (int, optional),
 * webhook_url (optional).
 *
 * Result keys: ok, status (pending|completed|failed), task (opaque string to
 * pass to status()), urls (string[]), bytes (raw image data for local
 * providers), error, transient, native_resolution, model, cost_key.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Ai;

defined( 'ABSPATH' ) || exit;

interface ImageProviderInterface {

	public function id(): string;

	public function label(): string;

	public function configured(): bool;

	/**
	 * @return array{reference:bool,structure:bool,native_4k:bool,upscale:bool,is_test:bool}
	 */
	public function capabilities(): array;

	public function submit( array $request ): array;

	public function status( string $task ): array;

	/**
	 * Connection test that does not incur generation cost where possible.
	 *
	 * @return array{ok:bool,message:string}
	 */
	public function test(): array;
}
