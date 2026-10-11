<?php
/**
 * Local test provider: renders clearly labelled massing images ("TESZT KÉP –
 * NEM AI GENERÁLÁS") from the building model with GD. It lets the whole
 * pipeline (queue, gallery, package, e-mail) be tested without API keys.
 * Assets produced by it are flagged is_test=1 everywhere in the UI.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Ai;

use AutoGroweHome\Generation\GuideRenderer;
use AutoGroweHome\Support\Settings;

defined( 'ABSPATH' ) || exit;

final class TestImageProvider implements ImageProviderInterface {

	public function id(): string {
		return 'test';
	}

	public function label(): string {
		return __( 'Teszt mód (helyi vázlatkép, nem AI)', 'autogrowehome' );
	}

	public function configured(): bool {
		return (bool) Settings::get( 'images.allow_test_provider', true ) && GuideRenderer::available();
	}

	public function capabilities(): array {
		return array(
			'reference' => false,
			'structure' => false,
			'native_4k' => false,
			'upscale'   => false,
			'is_test'   => true,
		);
	}

	public function submit( array $r ): array {
		$model  = $r['building'] ?? array();
		$config = $r['config'] ?? array();
		$view   = (string) ( $r['view'] ?? 'hero' );
		if ( empty( $model ) ) {
			return array( 'ok' => false, 'status' => 'failed', 'task' => '', 'urls' => array(), 'bytes' => '', 'error' => 'Missing building model', 'transient' => false );
		}
		$png = GuideRenderer::render( $model, $config, 'interior' === ( $r['op'] ?? '' ) ? 'garden' : $view, (string) ( $r['label'] ?? $view ) );
		return array(
			'ok'                => '' !== $png,
			'status'            => '' !== $png ? 'completed' : 'failed',
			'task'              => 'local',
			'urls'              => array(),
			'bytes'             => $png,
			'error'             => '' !== $png ? '' : 'GD not available',
			'transient'         => false,
			'native_resolution' => '',
			'model'             => 'test-massing',
			'cost_key'          => '',
		);
	}

	public function status( string $task ): array {
		return array( 'ok' => false, 'status' => 'failed', 'task' => $task, 'urls' => array(), 'bytes' => '', 'error' => 'Synchronous provider', 'transient' => false );
	}

	public function test(): array {
		return GuideRenderer::available()
			? array( 'ok' => true, 'message' => __( 'A helyi teszt-renderelő (GD) elérhető.', 'autogrowehome' ) )
			: array( 'ok' => false, 'message' => __( 'A PHP GD kiterjesztés hiányzik.', 'autogrowehome' ) );
	}
}
