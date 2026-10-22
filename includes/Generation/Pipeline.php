<?php
/**
 * Generation pipeline: plan → concepts & drawings → hero renders → gallery
 * (selected concept or all) → optional upscaling. Each step is a queue job.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Generation;

use AutoGroweHome\Ai\ImageProviderInterface;
use AutoGroweHome\Ai\Providers;
use AutoGroweHome\License\Features;
use AutoGroweHome\Params\Definitions;
use AutoGroweHome\Params\Validator;
use AutoGroweHome\Projects\Repository;
use AutoGroweHome\Prompt\PromptEngine;
use AutoGroweHome\Prompt\VisionPrompt;
use AutoGroweHome\Quote\QuoteService;
use AutoGroweHome\Stats\Stats;
use AutoGroweHome\Support\Http;
use AutoGroweHome\Support\Logger;
use AutoGroweHome\Support\Settings;
use AutoGroweHome\Support\Storage;
use AutoGroweHome\Support\Util;

defined( 'ABSPATH' ) || exit;

final class Pipeline {

	/**
	 * Create a project and queue its planning job.
	 */
	public static function start( array $config, array $ctx ): array {
		$version = (int) PromptEngine::get()['version'];
		$project = Repository::create_project( $config, (int) $ctx['user_id'], (string) $ctx['guest_hash'], (string) $ctx['ip_hash'], (string) $ctx['lang'], $version );
		JobQueue::push( 'plan', $project['id'], array( 'reserved' => $ctx['reserved'] ?? array(), 'lang' => $ctx['lang'] ), 1, 0, 0, 2 );
		JobQueue::spawn();
		return $project;
	}

	public static function handle( array $job ): void {
		switch ( $job['type'] ) {
			case 'plan':
				self::plan( $job );
				break;
			case 'render':
				self::render( $job );
				break;
			case 'upscale':
				self::upscale( $job );
				break;
			case 'notify':
			case 'package':
				QuoteService::handle_job( $job );
				break;
			default:
				JobQueue::fail( $job, 'Unknown job type', false );
		}
	}

	/* ------------------------------------------------------------------ plan */

	private static function plan( array $job ): void {
		$p = Repository::project_by_id( $job['project_id'] );
		if ( ! $p || in_array( $p['status'], array( 'deleted', 'cancelled' ), true ) ) {
			JobQueue::complete( $job );
			return;
		}
		$c = $p['config'];
		Repository::update_project( $p['id'], array( 'status' => 'planning', 'stage' => 'prepare' ) );

		$check = Validator::check( $c );
		if ( ! empty( $check['errors'] ) ) {
			Repository::update_project( $p['id'], array( 'status' => 'failed', 'stage' => 'validate' ) );
			JobQueue::refund_job_once( (int) $job['id'] );
			JobQueue::complete( $job );
			return;
		}

		// Idempotency: a retried plan job must not duplicate concepts.
		if ( empty( Repository::concepts( $p['id'] ) ) ) {
			$plan = Planner::plan( $c, (string) ( $job['payload']['lang'] ?? $p['lang'] ) );
			if ( ! empty( $plan['usage'] ) ) {
				$cost = ( $plan['usage']['in'] ?? 0 ) / 1e6 * (float) Settings::get( 'costs.anthropic_in_mtok', 0 ) + ( $plan['usage']['out'] ?? 0 ) / 1e6 * (float) Settings::get( 'costs.anthropic_out_mtok', 0 );
				Stats::ledger( 'anthropic', 'plan', $cost, $p['id'], 0, (float) ( ( $plan['usage']['in'] ?? 0 ) + ( $plan['usage']['out'] ?? 0 ) ) );
				Stats::inc( empty( $plan['error'] ) ? 'provider_ok' : 'provider_fail', 'anthropic' );
			}
			// The visitor may have cancelled (or deleted) the project while the
			// planner was running: create nothing, refund if nothing was spent.
			if ( self::is_stopped( $p['id'] ) ) {
				if ( Repository::project_by_id( $p['id'] ) && self::cost_free( $p['id'] ) ) {
					JobQueue::refund_job_once( (int) $job['id'] );
				}
				JobQueue::complete( $job );
				return;
			}
			$order = 0;
			foreach ( $plan['concepts'] as $letter => $brief ) {
				$building          = BuildingModel::build( $c, $letter, (array) ( $brief['room_areas'] ?? array() ) );
				$brief['warnings'] = array_values( array_unique( array_merge( (array) ( $plan['conflicts'] ?? array() ), (array) ( $building['checks']['warnings'] ?? array() ) ) ) );
				$brief['planner']  = $plan['source'];
				$concept           = Repository::create_concept( $p['id'], $letter, $brief, $building );
				self::documents( $p, $concept );
				self::hero_asset( $p, $concept, $order++ );
			}
		}

		// Cancelled while the concepts were being created: drop the queued renders.
		if ( self::is_stopped( $p['id'] ) ) {
			JobQueue::cancel_project( $p['id'] );
			JobQueue::complete( $job );
			return;
		}
		Repository::update_project( $p['id'], array( 'status' => 'rendering', 'stage' => 'exterior' ) );
		if ( 'all' === Settings::get( 'limits.gallery_mode', 'selected' ) ) {
			foreach ( Repository::concepts( $p['id'] ) as $concept ) {
				Repository::update_concept( $concept['id'], array( 'gallery_status' => 'pending' ) );
			}
		}
		Stats::inc( 'style', (string) ( $c['arch_style'] ?? '' ) );
		Stats::inc( 'roof', (string) ( $c['roof_type'] ?? '' ) );
		Stats::inc( 'area_bucket', Stats::area_bucket( (float) ( $c['net_area'] ?? 0 ) ) );
		JobQueue::complete( $job );
	}

	/**
	 * True when the project was deleted or cancelled (re-read from the DB).
	 */
	private static function is_stopped( int $project_id ): bool {
		$p = Repository::project_by_id( $project_id );
		return ! $p || in_array( $p['status'], array( 'deleted', 'cancelled' ), true );
	}

	/**
	 * True when the project has cost nothing so far: no accepted paid-provider
	 * call in the ledger (row count, not sum – prices may be configured as 0)
	 * and no image produced (no finished render, archived ones included).
	 * Otherwise a visitor could cancel right after the provider calls and get
	 * the daily unit back again and again.
	 */
	public static function cost_free( int $project_id ): bool {
		global $wpdb;
		// A ledger row is written for every accepted paid-provider call (Anthropic
		// plan, image submit, upscale) even when the configured unit price is 0,
		// so "free" means: no paid call was accepted at all – not "sum is 0".
		$t = \AutoGroweHome\Installer::table( 'ledger' );
		if ( (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$t} WHERE project_id = %d", $project_id ) ) > 0 ) { // phpcs:ignore
			return false;
		}
		foreach ( Repository::assets( $project_id ) as $a ) {
			if ( 'render' === $a['kind'] && ( 'done' === $a['status'] || '' !== (string) $a['file_path'] ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * True when one render asset cost nothing: no cost on the asset, no
	 * accepted paid submission in the ledger for it and no image stored.
	 */
	public static function asset_cost_free( int $asset_id ): bool {
		global $wpdb;
		$a = Repository::asset( $asset_id );
		if ( ! $a || (float) $a['cost'] > 0 || '' !== (string) $a['file_path'] ) {
			return false;
		}
		$t = \AutoGroweHome\Installer::table( 'ledger' );
		// Any accepted paid submission counts, even at a configured price of 0.
		return 0 === (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$t} WHERE asset_id = %d", $asset_id ) ); // phpcs:ignore
	}

	/**
	 * Deterministic drawings and data documents for a concept.
	 */
	public static function documents( array $p, array $concept ): void {
		$m    = $concept['building'];
		$meta = array(
			'project'    => '' !== $p['name'] ? $p['name'] : __( 'AutoGroweHome projekt', 'autogrowehome' ),
			'project_id' => $p['uuid'],
			'variant'    => $concept['variant'],
			'concept'    => $concept['title'],
			'date'       => wp_date( 'Y-m-d' ),
		);
		$sort = 100;
		if ( Features::enabled( 'floorplans' ) ) {
			$svg = new FloorPlanSvg( $m, $p['config'], $meta );
			foreach ( $svg->all() as $sheet ) {
				$name = $concept['variant'] . '-' . $sheet['view'] . '.svg';
				$rel  = Storage::put( $p['uuid'], 'plans/' . $name, $sheet['svg'] );
				Repository::create_asset(
					array(
						'project_id'   => $p['id'],
						'concept_id'   => $concept['id'],
						'kind'         => 'plan',
						'view'         => $sheet['view'],
						'label'        => $sheet['label'],
						'status'       => 'done',
						'provider'     => 'agh-svg',
						'model'        => 'BuildingModel ' . AGH_VERSION,
						'file_path'    => $rel,
						'mime'         => 'image/svg+xml',
						'bytes'        => strlen( $sheet['svg'] ),
						'access_level' => Settings::get( 'access.client_plan_previews', true ) ? 'client' : 'contractor',
						'sort'         => $sort++,
					)
				);
			}
		}
		$docs = array(
			'roomlist_csv' => array( __( 'Helyiséglista (CSV)', 'autogrowehome' ), 'text/csv', 'csv', FloorPlanSvg::rooms_csv( $m ) ),
		);
		// CAD/BIM files from the exporter registry (agh_cad_exporters): JSON
		// always, DXF and add-on exporters with the export_advanced feature.
		foreach ( CadExport::documents( $m ) as $view => $d ) {
			$docs[ $view ] = array( $d['label'], $d['mime'], $d['ext'], $d['content'] );
		}
		foreach ( $docs as $view => $d ) {
			$rel = Storage::put( $p['uuid'], 'docs/' . $concept['variant'] . '-' . $view . '.' . $d[2], $d[3] );
			Repository::create_asset(
				array(
					'project_id'   => $p['id'],
					'concept_id'   => $concept['id'],
					'kind'         => 'doc',
					'view'         => $view,
					'label'        => $d[0],
					'status'       => 'done',
					'provider'     => 'agh',
					'file_path'    => $rel,
					'mime'         => $d[1],
					'bytes'        => strlen( $d[3] ),
					'access_level' => 'contractor',
					'sort'         => $sort++,
				)
			);
		}
	}

	private static function hero_asset( array $p, array $concept, int $order ): void {
		$built = PromptEngine::build( $p['config'], $concept, 'hero', null, (int) $p['prompt_version'] );
		$asset = Repository::create_asset(
			array(
				'project_id'   => $p['id'],
				'concept_id'   => $concept['id'],
				'kind'         => 'render',
				'view'         => 'hero',
				'label'        => __( 'Fő látványterv', 'autogrowehome' ),
				'status'       => 'queued',
				'prompt'       => PromptEngine::combined( $built ),
				'access_level' => 'client',
				'sort'         => 0,
			)
		);
		JobQueue::push( 'render', $p['id'], array( 'op' => 'hero' ), 2 + $order, $asset['id'], 0, 1 + (int) Settings::get( 'limits.auto_retry_max', 2 ) );
	}

	/**
	 * Queue the gallery (exterior views + interiors) for one concept.
	 *
	 * @return int Number of queued images.
	 */
	public static function enqueue_gallery( array $p, array $concept ): int {
		// Only live images count as existing: archived (retired by a
		// regeneration), cancelled and failed ones are re-rendered. New assets
		// get the next version number per view, so earlier files are kept.
		$existing = array();
		$versions = array();
		foreach ( Repository::assets( $p['id'], $concept['id'] ) as $a ) {
			if ( 'render' !== $a['kind'] ) {
				continue;
			}
			$versions[ $a['view'] ] = max( $versions[ $a['view'] ] ?? 0, (int) $a['version'] );
			if ( in_array( $a['status'], array( 'queued', 'running', 'done' ), true ) ) {
				$existing[ $a['view'] ] = true;
			}
		}
		$labels   = PromptEngine::get( (int) $p['prompt_version'] )['views'];
		$views    = array_values( array_diff( (array) Settings::get( 'limits.exterior_views', array() ), array( 'hero' ) ) );
		$maxv     = (int) Features::limit( 'max_exterior_views', 8 );
		if ( ! Features::enabled( 'detailed_gallery' ) ) {
			$views = array_values( array_intersect( array( 'front', 'back', 'aerial' ), $views ) );
		}
		$views    = array_slice( $views, 0, max( 0, $maxv - 1 ) );
		$c        = $p['config'];
		if ( empty( $c['night_lighting'] ) ) {
			$views = array_values( array_diff( $views, array( 'evening' ) ) );
		}
		$queued = 0;
		$sort   = 1;
		$max_total = (int) Settings::get( 'limits.max_images_request', 40 );
		foreach ( $views as $view ) {
			if ( isset( $existing[ $view ] ) || $queued >= $max_total ) {
				continue;
			}
			$built = PromptEngine::build( $c, $concept, $view, null, (int) $p['prompt_version'] );
			$asset = Repository::create_asset(
				array(
					'project_id'   => $p['id'],
					'concept_id'   => $concept['id'],
					'kind'         => 'render',
					'view'         => $view,
					'label'        => $labels[ $view ]['label'] ?? $view,
					'status'       => 'queued',
					'prompt'       => PromptEngine::combined( $built ),
					'access_level' => 'contractor',
					'sort'         => $sort++,
					'version'      => 1 + ( $versions[ $view ] ?? 0 ),
				)
			);
			JobQueue::push( 'render', $p['id'], array( 'op' => 'view' ), 6, $asset['id'], 0, 1 + (int) Settings::get( 'limits.auto_retry_max', 2 ) );
			$queued++;
		}
		$imax  = min( (int) Settings::get( 'limits.interiors_max', 4 ), (int) Features::limit( 'max_interiors', 10 ) );
		$types = Definitions::room_types();
		$n     = 0;
		foreach ( (array) ( $c['rooms'] ?? array() ) as $room ) {
			if ( $n >= $imax || empty( $room['render'] ) || $queued >= $max_total ) {
				continue;
			}
			$view = 'interior_' . $room['id'];
			if ( isset( $existing[ $view ] ) ) {
				$n++;
				continue;
			}
			$built = PromptEngine::build( $c, $concept, 'interior', $room, (int) $p['prompt_version'] );
			$asset = Repository::create_asset(
				array(
					'project_id'   => $p['id'],
					'concept_id'   => $concept['id'],
					'kind'         => 'render',
					'view'         => $view,
					'label'        => $room['name'] ?: ( $types[ $room['type'] ][0] ?? $room['type'] ),
					'status'       => 'queued',
					'prompt'       => PromptEngine::combined( $built ),
					'access_level' => 'contractor',
					'sort'         => 20 + $n,
					'version'      => 1 + ( $versions[ $view ] ?? 0 ),
				)
			);
			JobQueue::push( 'render', $p['id'], array( 'op' => 'interior', 'room' => $room['id'] ), 7, $asset['id'], 0, 1 + (int) Settings::get( 'limits.auto_retry_max', 2 ) );
			$n++;
			$queued++;
		}
		Repository::update_concept( $concept['id'], array( 'gallery_status' => $queued > 0 ? 'rendering' : 'ready' ) );
		JobQueue::spawn();
		return $queued;
	}

	/* ------------------------------------------------------------------ render */

	private static function provider_for( array $asset, array $job ): ?ImageProviderInterface {
		$id = (string) ( $job['payload']['provider'] ?? $asset['provider'] );
		if ( '' !== $id ) {
			$p = Providers::image( $id );
			if ( $p && $p->configured() ) {
				return $p;
			}
		}
		return Providers::active_image();
	}

	private static function render( array $job ): void {
		$asset = Repository::asset( $job['asset_id'] );
		if ( ! $asset || in_array( $asset['status'], array( 'done', 'cancelled' ), true ) ) {
			// A rebuild superseded before it produced anything gives its unit back.
			if ( $asset && 'cancelled' === $asset['status'] && self::asset_cost_free( (int) $asset['id'] ) ) {
				JobQueue::refund_job_once( (int) $job['id'] );
			}
			JobQueue::complete( $job );
			return;
		}
		$p       = Repository::project_by_id( $asset['project_id'] );
		$concept = Repository::concept( $asset['concept_id'] );
		if ( ! $p || ! $concept || 'deleted' === $p['status'] ) {
			JobQueue::complete( $job );
			return;
		}
		$provider = self::provider_for( $asset, $job );
		if ( ! $provider ) {
			self::asset_failed( $job, $asset, $p, __( 'Nincs beállított, működő képszolgáltató.', 'autogrowehome' ), false );
			return;
		}
		$op = (string) ( $job['payload']['op'] ?? 'view' );

		// Polling an already submitted task.
		if ( '' !== $asset['provider_task_id'] && $asset['provider'] === $provider->id() ) {
			$timeout = (int) Settings::get( 'magnific.timeout', 420 );
			if ( strtotime( $asset['updated_at'] . ' UTC' ) < time() - $timeout && strtotime( (string) $job['started_at'] . ' UTC' ) < time() - $timeout ) {
				self::asset_failed( $job, $asset, $p, __( 'Időtúllépés a szolgáltatónál.', 'autogrowehome' ), true );
				return;
			}
			$st = $provider->status( $asset['provider_task_id'] );
			self::consume( $job, $asset, $p, $concept, $provider, $st );
			return;
		}

		// Reference image for views (consistency with the hero of the same concept).
		$reference = '';
		if ( 'view' === $op && $provider->capabilities()['reference'] ) {
			foreach ( Repository::assets( $p['id'], $concept['id'] ) as $a ) {
				if ( 'hero' === $a['view'] && 'done' === $a['status'] ) {
					$path = Storage::path( '' !== $a['preview_path'] ? $a['preview_path'] : $a['file_path'] );
					if ( '' !== $path ) {
						$reference = base64_encode( (string) file_get_contents( $path ) ); // phpcs:ignore
					}
				}
			}
		}
		// Geometry guidance. First choice is the picture of the 3D model the visitor built and sent
		// with the request (the hero is their very camera angle, a room its interior view); without one
		// the server draws its own massing guide for the elevation views, as before.
		$room = null;
		if ( 'interior' === $op ) {
			$rid = (string) ( $job['payload']['room'] ?? '' );
			foreach ( (array) ( $p['config']['rooms'] ?? array() ) as $r ) {
				if ( is_array( $r ) && (string) ( $r['id'] ?? '' ) === $rid ) {
					$room = $r;
				}
			}
		}
		$structure  = '';
		$shot       = '';
		$guide_view = 'interior' === $op ? ( null !== $room ? 'interior_' . preg_replace( '/[^a-z0-9_]/', '', strtolower( (string) $room['id'] ) ) : '' ) : (string) $asset['view'];
		if ( '' !== $guide_view && $provider->capabilities()['structure'] && Settings::get( 'magnific.structure_guidance', true ) ) {
			$shot = Storage::guide_path( (string) $p['uuid'], $guide_view );
			if ( '' !== $shot ) {
				$structure = base64_encode( (string) file_get_contents( $shot ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions
			} elseif ( in_array( $guide_view, array( 'front', 'back', 'left', 'right' ), true ) ) {
				$png = GuideRenderer::render( $concept['building'], $p['config'], $guide_view );
				if ( '' !== $png ) {
					$structure = base64_encode( $png );
				}
			}
		}
		// The style sample: a real photograph of the chosen architectural style (or of an interior),
		// picked by the operator. It gives the picture its photographic look; the 3D guide gives the
		// form. Views that follow the hero keep the hero as their reference.
		$style_image = '' === $reference && $provider->capabilities()['reference'] ? self::style_sample( 'interior' === $op ? 'interior' : (string) ( $p['config']['arch_style'] ?? '' ) ) : '';
		// The prompt is put together again here, so the binding block in front, the closing reference
		// sentence and the negative list (with the wrong alternatives of this configuration) all fit the
		// length limit together and the negative list is never cut off.
		// Faithful/Clone with the visitor's 3D picture: the picture is the design, the concept texts
		// of the three variants would describe other houses (1.15.2).
		$bound  = '' !== $structure && 'interior' !== $op && '' !== PromptEngine::reference_lead();
		$built  = PromptEngine::build( $p['config'], $concept, 'interior' === $op ? 'interior' : (string) $asset['view'], $room, (int) $p['prompt_version'], $bound );
		$lead   = '';
		$note   = '';
		if ( '' !== $structure ) {
			// Faithful and clone open with the binding block; the gentler levels only add a closing
			// sentence. Both together would not fit the prompt limit and would say the same twice.
			$lead = 'interior' === $op ? PromptEngine::interior_lead() : PromptEngine::reference_lead();
			$note = '' !== $lead ? '' : ( 'interior' === $op ? PromptEngine::interior_note() : PromptEngine::reference_note() );
		}
		// 1.15.0: the prompt written from the picture. Claude looks at the visitor's own 3D screenshot of
		// this view (the full scene, vehicles and people included) and writes prompt and negative list
		// with the prompt-engineer template; the binding block and the configuration's wrong
		// alternatives stay. Any failure keeps the configuration prompt above.
		$vision = null;
		if ( VisionPrompt::applies( $op, (string) $asset['view'] ) ) {
			$vision = VisionPrompt::run( $p, (string) $asset['view'] );
			if ( null !== $vision ) {
				$built = VisionPrompt::built( $vision, (array) $p['config'], (string) $asset['view'] );
			}
		}
		$inline = ! ( $provider->capabilities()['negative'] ?? false ) && Settings::get( 'magnific.negative_inline', true );
		$prompt = PromptEngine::compose( $built, $lead, $note, $inline );
		// 1.16.0 "photo from the 3D picture": the visitor's own 3D picture itself goes in as the input
		// image and is turned into a photograph (Flux 2 Pro edit) – colours, materials and every object
		// stay where the visitor put them. Only with their screenshot, at Faithful/Clone/custom.
		$photo  = false;
		$width  = 0;
		$height = 0;
		if ( '' !== $shot && PromptEngine::photo_mode() && ( $provider->capabilities()['photo'] ?? false ) ) {
			$pic   = VisionPrompt::picture( (string) $p['uuid'], $guide_view );
			$pic   = '' !== $pic ? $pic : $shot;
			$size  = @getimagesize( $pic ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
			$photo = true;
			$structure = base64_encode( (string) file_get_contents( $pic ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions
			list( $width, $height ) = PromptEngine::photo_size( (int) ( $size[0] ?? 0 ), (int) ( $size[1] ?? 0 ) );
			$prompt = PromptEngine::photo_prompt( (array) $p['config'], 'interior' === $op ? 'interior' : (string) $asset['view'], $room, '' !== $reference, null !== $vision ? (string) $vision['prompt'] : '' );
		}
		if ( $prompt !== (string) $asset['prompt'] ) {
			// every asset keeps the exact prompt that went out
			Repository::update_asset( $asset['id'], array( 'prompt' => $prompt ) );
		}
		$request = array(
			'op'              => $op,
			'view'            => $asset['view'],
			'prompt'          => $prompt,
			'aspect'          => '16:9',
			'resolution'      => 'hero' === $asset['view'] && 'all' === Settings::get( 'limits.gallery_mode' ) ? self::max_res( (string) Settings::get( 'magnific.final_resolution', '4k' ) ) : self::max_res( (string) Settings::get( 'magnific.preview_resolution', '2k' ) ),
			'reference_image' => $reference,
			'structure_image' => $structure,
			'bound'           => $bound,   // Faithful/Clone with the 3D picture: the provider keeps to the structure (1.15.3)
			'photo'           => $photo,   // the 3D picture itself is turned into the photo (1.16.0)
			'width'           => $width,
			'height'          => $height,
			'style_image'     => $style_image,
			'negative_prompt' => (string) ( $built['negative_list'] ?? $built['negative'] ),
			'building'        => $concept['building'],
			'config'          => $p['config'],
			'label'           => $concept['variant'] . ' – ' . $asset['label'],
		);
		if ( Settings::get( 'magnific.use_webhook', false ) && 'magnific' === $provider->id() ) {
			$request['webhook_url'] = rest_url( AGH_REST_NS . '/webhook/magnific/' . Util::webhook_token() );
		}
		/**
		 * The whole request going to the image provider (prompt, guide picture, reference).
		 *
		 * @param array $request Request.
		 * @param array $asset   Asset row.
		 * @param array $p       Project.
		 */
		$request = (array) apply_filters( 'agh_provider_request', $request, $asset, $p );
		$res     = $provider->submit( $request );
		Stats::inc( $res['ok'] ? 'provider_ok' : 'provider_fail', $provider->id() );
		if ( $res['ok'] && 'test' !== $provider->id() ) {
			$cost = Stats::cost_of( (string) ( $res['cost_key'] ?? '' ) );
			Stats::ledger( $provider->id(), (string) ( $res['cost_key'] ?? 'image' ), $cost, $p['id'], $asset['id'] );
			Repository::update_asset( $asset['id'], array( 'cost' => $cost ) );
		}
		Repository::update_asset(
			$asset['id'],
			array(
				'provider'          => $provider->id(),
				'model'             => (string) ( $res['model'] ?? '' ),
				'provider_task_id'  => (string) ( $res['task'] ?? '' ),
				'native_resolution' => (string) ( $res['native_resolution'] ?? '' ),
				'status'            => 'running',
				'is_test'           => $provider->capabilities()['is_test'] ? 1 : 0,
			)
		);
		$asset = Repository::asset( $asset['id'] );
		self::consume( $job, $asset, $p, $concept, $provider, $res );
	}

	/**
	 * The style sample photo for a style (or "interior"), base64 JPEG at most 1536 px. Order: the
	 * sample set in Settings → Magnific, the style's reference picture in the catalog, the general
	 * sample; '' when there is none. Media library pictures
	 * only – these are the operator's reference photos, not client data.
	 */
	public static function style_sample( string $style ): string {
		$key = 'interior' === $style ? 'style_ref_interior' : 'style_ref_' . sanitize_key( $style );
		$id  = (int) Settings::get( 'magnific.' . $key, 0 );
		if ( $id <= 0 && 'interior' !== $style && '' !== $style ) {
			// the reference picture of the style in the catalog (Katalógus → Stílusok), if there is one
			$row = \AutoGroweHome\Catalog\Catalog::get( 'style', sanitize_key( $style ) );
			$id  = $row ? (int) ( $row['image_id'] ?? 0 ) : 0;
		}
		if ( $id <= 0 && 'interior' !== $style ) {
			$id = (int) Settings::get( 'magnific.style_ref_default', 0 );
		}
		if ( $id <= 0 ) {
			return '';
		}
		$file = (string) get_attached_file( $id );
		if ( '' === $file || ! is_file( $file ) || ! wp_attachment_is_image( $id ) ) {
			return '';
		}
		$editor = wp_get_image_editor( $file );
		if ( is_wp_error( $editor ) ) {
			$raw = (string) file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions
			return strlen( $raw ) > 0 && strlen( $raw ) < 4194304 ? base64_encode( $raw ) : '';
		}
		$size = $editor->get_size();
		if ( max( (int) $size['width'], (int) $size['height'] ) > 1536 ) {
			$editor->resize( 1536, 1536, false );
		}
		$editor->set_quality( 86 );
		// a temporary file only (wp_tempnam() is an admin-side function, not loaded in the queue)
		$res = $editor->save( trailingslashit( get_temp_dir() ) . 'agh-style-' . wp_generate_password( 12, false ) . '.jpg', 'image/jpeg' );
		if ( is_wp_error( $res ) || empty( $res['path'] ) ) {
			return '';
		}
		$raw = (string) file_get_contents( $res['path'] ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		@unlink( $res['path'] ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		return base64_encode( $raw );
	}

	private static function max_res( string $res ): string {
		$order = array( '1k' => 1, '2k' => 2, '4k' => 3 );
		$cap   = (string) Features::limit( 'max_resolution', '4k' );
		return ( $order[ $res ] ?? 2 ) > ( $order[ $cap ] ?? 3 ) ? $cap : $res;
	}

	private static function consume( array $job, array $asset, array $p, array $concept, ImageProviderInterface $provider, array $res ): void {
		if ( 'pending' === $res['status'] ) {
			JobQueue::wait( $job, max( 3, (int) Settings::get( 'magnific.poll_interval', 6 ) ) );
			return;
		}
		if ( 'completed' === $res['status'] ) {
			$data = (string) ( $res['bytes'] ?? '' );
			$mime = 'image/png';
			if ( '' === $data ) {
				$dl = Http::download( (string) ( $res['urls'][0] ?? '' ) );
				if ( ! $dl['ok'] ) {
					self::asset_failed( $job, $asset, $p, 'Download failed: ' . $dl['error'], true, false );
					return;
				}
				$data = $dl['data'];
				$mime = $dl['mime'];
			}
			self::store( $asset, $p, $concept, $data, $mime );
			JobQueue::complete( $job );
			self::after_asset( $p['id'], $concept['id'], $asset['view'] );
			return;
		}
		self::asset_failed( $job, $asset, $p, (string) $res['error'], (bool) $res['transient'] );
	}

	private static function store( array $asset, array $p, array $concept, string $data, string $mime ): void {
		$ext  = array( 'image/jpeg' => 'jpg', 'image/webp' => 'webp' )[ $mime ] ?? 'png';
		$name = 'renders/' . $concept['variant'] . '-' . preg_replace( '/[^a-z0-9_]/', '', $asset['view'] ) . '-v' . $asset['version'] . '.' . $ext;
		$rel  = Storage::put( $p['uuid'], $name, $data );
		$info = @getimagesizefromstring( $data ); // phpcs:ignore
		// The guide picture has to have the same shape as the finished image, otherwise the structure
		// reference is stretched or cropped and the geometry drifts. The real shape is measured here,
		// from the picture the service actually returned, and the next guides are taken that way.
		if ( $info && $info[0] > 0 && $info[1] > 0 && ! $asset['is_test'] ) {
			$ratio = round( $info[0] / $info[1], 4 );
			$known = (float) Settings::get( 'magnific.guide_aspect', 1.645 );
			if ( $ratio > 0.4 && $ratio < 3.2 && abs( $ratio - $known ) > $known * 0.02 ) {
				Settings::update_group( 'magnific', array( 'guide_aspect' => $ratio ) );
			}
		}
		$prev = Storage::make_preview( $rel, (int) Settings::get( 'access.preview_max_px', 1280 ) );
		$ms   = max( 0, ( time() - strtotime( $asset['created_at'] . ' UTC' ) ) * 1000 );
		Repository::update_asset(
			$asset['id'],
			array(
				'status'       => 'done',
				'file_path'    => $rel,
				'preview_path' => $prev['path'],
				'mime'         => $mime,
				'width'        => $info ? (int) $info[0] : 0,
				'height'       => $info ? (int) $info[1] : 0,
				'bytes'        => strlen( $data ),
				'gen_ms'       => $ms,
				'error'        => null,
			)
		);
		Stats::inc( 'image_ok' );
		Stats::inc( 'gen_ms', '', (float) $ms );
		Stats::inc( 'gen_count' );
	}

	private static function asset_failed( array $job, array $asset, array $p, string $error, bool $transient, bool $allow_fallback = true ): void {
		$fallback = Providers::fallback_image();
		if ( $allow_fallback && ! $transient && $fallback && $fallback->id() !== $asset['provider'] && '' !== $asset['provider'] ) {
			Repository::update_asset( $asset['id'], array( 'provider' => $fallback->id(), 'provider_task_id' => '', 'status' => 'queued', 'error' => $error ) );
			JobQueue::wait( $job, 1, array( 'provider' => $fallback->id() ) );
			Logger::warning( 'render', 'Switching to fallback provider', array( 'asset' => $asset['uuid'], 'error' => $error ), $p['id'] );
			return;
		}
		// A retry must re-submit: clear the task reference.
		Repository::update_asset( $asset['id'], array( 'provider_task_id' => '', 'error' => substr( $error, 0, 1000 ) ) );
		$retry = JobQueue::fail( $job, $error, $transient );
		if ( ! $retry ) {
			Repository::update_asset( $asset['id'], array( 'status' => 'failed' ) );
			// Single-concept rebuild (REST regenerate): its own reserved unit
			// (job payload "reserved") comes back when the new main image failed
			// without any cost – never the project's original generation unit.
			if ( ! empty( $job['payload']['reserved'] ) && self::asset_cost_free( (int) $asset['id'] ) ) {
				JobQueue::refund_job_once( (int) $job['id'] );
			}
			Stats::inc( 'image_fail' );
			Stats::inc( 'error', substr( preg_replace( '/[0-9a-f-]{36}/', '', $error ), 0, 90 ) );
			self::after_asset( $p['id'], $asset['concept_id'], $asset['view'] );
		}
	}

	/**
	 * Recompute concept / project states after an asset finished.
	 */
	public static function after_asset( int $project_id, int $concept_id, string $view ): void {
		$p = Repository::project_by_id( $project_id );
		if ( ! $p ) {
			return;
		}
		$concepts = Repository::concepts( $project_id );
		$heroes_done   = 0;
		$heroes_final  = 0;
		$all_gallery_final = true;
		foreach ( $concepts as $concept ) {
			$assets = Repository::assets( $project_id, $concept['id'] );
			$hero   = null;
			$open   = 0;
			$done   = 0;
			foreach ( $assets as $a ) {
				if ( 'render' !== $a['kind'] ) {
					continue;
				}
				if ( 'hero' === $a['view'] ) {
					$hero = $a;
					continue;
				}
				if ( in_array( $a['status'], array( 'queued', 'running' ), true ) ) {
					$open++;
				} elseif ( 'done' === $a['status'] ) {
					$done++;
				}
			}
			if ( $hero && in_array( $hero['status'], array( 'done', 'failed' ), true ) ) {
				$heroes_final++;
				if ( 'done' === $hero['status'] ) {
					$heroes_done++;
					if ( 'planned' === $concept['status'] ) {
						Repository::update_concept( $concept['id'], array( 'status' => 'ready' ) );
					}
					if ( 'pending' === $concept['gallery_status'] ) {
						self::enqueue_gallery( $p, $concept );
						$open++;
					}
				} elseif ( 'planned' === $concept['status'] ) {
					Repository::update_concept( $concept['id'], array( 'status' => 'failed' ) );
				}
			}
			if ( 'rendering' === $concept['gallery_status'] && 0 === $open ) {
				Repository::update_concept( $concept['id'], array( 'gallery_status' => $done > 0 ? 'ready' : 'failed' ) );
				if ( $done > 0 && Settings::get( 'magnific.upscale_enabled', false ) && (int) $p['selected_concept_id'] === $concept['id'] ) {
					self::queue_upscales( $p, $concept );
				}
			}
			if ( $open > 0 ) {
				$all_gallery_final = false;
			}
		}
		// Never finalise without concepts (e.g. a cancel during planning) and
		// never touch a cancelled/deleted project (status is not rendering/planning).
		if ( count( $concepts ) > 0 && $heroes_final === count( $concepts ) && in_array( $p['status'], array( 'rendering', 'planning' ), true ) ) {
			$status = $heroes_done === count( $concepts ) ? 'ready' : ( $heroes_done > 0 ? 'partial' : 'failed' );
			Repository::update_project( $project_id, array( 'status' => $status, 'stage' => $all_gallery_final ? 'done' : 'gallery' ) );
			Stats::inc( 'concepts_ready', '', (float) $heroes_done );
			if ( 0 === $heroes_done && self::cost_free( $project_id ) ) {
				// Refund rule: nothing was produced and no provider cost occurred.
				// Once per project; never after a rebuild of produced images.
				JobQueue::refund_project_once( $project_id );
			}
			/**
			 * Fires once when the three concepts of a request have finished
			 * (ready, partial or failed). Galleries may still be rendering.
			 *
			 * @param int    $project_id Project id.
			 * @param string $status     ready|partial|failed.
			 */
			do_action( 'agh_concepts_finished', $project_id, $status );
		} elseif ( in_array( $p['status'], array( 'ready', 'partial' ), true ) ) {
			Repository::update_project( $project_id, array( 'stage' => $all_gallery_final ? 'done' : 'gallery' ) );
		}
	}

	/* ------------------------------------------------------------------ upscale */

	public static function queue_upscales( array $p, array $concept ): void {
		foreach ( Repository::assets( $p['id'], $concept['id'] ) as $a ) {
			if ( 'render' === $a['kind'] && 'done' === $a['status'] && ! $a['is_upscaled'] && ! $a['is_test'] && max( $a['width'], $a['height'] ) < 3840 ) {
				JobQueue::push( 'upscale', $p['id'], array( 'phase' => 'submit' ), 9, $a['id'], 0, 2 );
			}
		}
	}

	private static function upscale( array $job ): void {
		$asset    = Repository::asset( $job['asset_id'] );
		$provider = Providers::image( 'magnific' );
		if ( ! $asset || ! $provider || ! $provider->configured() || 'done' !== $asset['status'] ) {
			JobQueue::complete( $job );
			return;
		}
		$p    = Repository::project_by_id( $asset['project_id'] );
		$task = (string) ( $job['payload']['task'] ?? '' );
		if ( '' === $task ) {
			$path = Storage::path( $asset['file_path'] );
			if ( '' === $path ) {
				JobQueue::fail( $job, 'Missing file', false );
				return;
			}
			$res = $provider->submit( array( 'op' => 'upscale', 'image' => base64_encode( (string) file_get_contents( $path ) ), 'prompt' => (string) $asset['prompt'] ) ); // phpcs:ignore
			if ( $res['ok'] ) {
				Stats::ledger( 'magnific', 'upscale', Stats::cost_of( 'upscale' ), $p['id'], $asset['id'] );
			}
		} else {
			$res = $provider->status( $task );
		}
		if ( 'pending' === $res['status'] ) {
			JobQueue::wait( $job, max( 5, (int) Settings::get( 'magnific.poll_interval', 6 ) ), array( 'task' => $res['task'] ?: $task ) );
			return;
		}
		if ( 'completed' !== $res['status'] ) {
			JobQueue::fail( $job, (string) $res['error'], (bool) $res['transient'] );
			return;
		}
		$dl = Http::download( (string) ( $res['urls'][0] ?? '' ), JobQueue::DOWNLOAD_TIMEOUT, 120000000 );
		if ( ! $dl['ok'] ) {
			JobQueue::fail( $job, $dl['error'], true );
			return;
		}
		$ext  = array( 'image/jpeg' => 'jpg', 'image/webp' => 'webp' )[ $dl['mime'] ] ?? 'png';
		$rel  = Storage::put( $p['uuid'], self::upscaled_name( (string) $asset['file_path'], $ext ), $dl['data'] );
		$info = @getimagesizefromstring( $dl['data'] ); // phpcs:ignore
		Repository::update_asset(
			$asset['id'],
			array(
				'file_path'   => $rel,
				'mime'        => $dl['mime'],
				'width'       => $info ? (int) $info[0] : 0,
				'height'      => $info ? (int) $info[1] : 0,
				'bytes'       => strlen( $dl['data'] ),
				'is_upscaled' => 1,
				'version'     => $asset['version'] + 1,
			)
		);
		JobQueue::complete( $job );
	}

	/**
	 * Storage name of an upscaled render. Storage::put() flattens "renders/x"
	 * to "renders-x", so the stored base name already carries the prefix:
	 * "renders-A-hero-v1.png" → "renders/A-hero-v1-upscaled.png"
	 * (stored as "renders-A-hero-v1-upscaled.png", not "renders-renders-…").
	 */
	public static function upscaled_name( string $file_path, string $ext ): string {
		$base = preg_replace( '/^renders[-\/]/', '', (string) pathinfo( $file_path, PATHINFO_FILENAME ) );
		$base = preg_replace( '/-upscaled$/', '', (string) $base );
		return 'renders/' . $base . '-upscaled.' . $ext;
	}

	/* ------------------------------------------------------------------ progress */

	/**
	 * Honest progress: derived only from real asset/job states.
	 */
	public static function progress( array $p ): array {
		$assets = Repository::assets( $p['id'] );
		$stages = array(
			'validate' => __( 'Paraméterek ellenőrzése', 'autogrowehome' ),
			'prepare'  => __( 'Házkoncepciók előkészítése', 'autogrowehome' ),
			'exterior' => __( 'Külső nézetek készítése', 'autogrowehome' ),
			'interior' => __( 'Belső nézetek készítése', 'autogrowehome' ),
			'docs'     => __( 'Tervjellegű dokumentumok készítése', 'autogrowehome' ),
			'process'  => __( 'Képek feldolgozása', 'autogrowehome' ),
			'gallery'  => __( 'Galéria összeállítása', 'autogrowehome' ),
			'done'     => __( 'Projekt kész', 'autogrowehome' ),
		);
		// Archived (retired by a regeneration) and cancelled renders are no
		// longer part of the job, so they count neither in totals nor as done.
		// Failed renders are final: a stage whose remaining images all failed
		// is "done" with an error count ("errors" on the stage), never "active"
		// forever; if every image of a stage failed, the stage is "error".
		$count = array( 'ext_total' => 0, 'ext_done' => 0, 'ext_failed' => 0, 'int_total' => 0, 'int_done' => 0, 'int_failed' => 0, 'docs' => 0, 'failed' => 0 );
		foreach ( $assets as $a ) {
			if ( 'render' === $a['kind'] ) {
				if ( in_array( $a['status'], array( 'archived', 'cancelled' ), true ) ) {
					continue;
				}
				$g = 0 === strpos( $a['view'], 'interior_' ) ? 'int' : 'ext';
				$count[ $g . '_total' ]++;
				if ( 'done' === $a['status'] ) {
					$count[ $g . '_done' ]++;
				} elseif ( 'failed' === $a['status'] ) {
					$count[ $g . '_failed' ]++;
					$count['failed']++;
				}
			} else {
				$count['docs']++;
			}
		}
		$stage_state = static function ( int $total, int $done, int $failed, string $empty ): string {
			if ( 0 === $total ) {
				return $empty;
			}
			if ( $done + $failed < $total ) {
				return 'active';
			}
			return 0 === $done ? 'error' : 'done';
		};
		$planned   = ! empty( Repository::concepts( $p['id'] ) );
		$cancelled = 'cancelled' === $p['status'];
		$state     = array();
		$state['validate'] = 'failed' === $p['status'] && 'validate' === $p['stage'] ? 'error' : ( 'queued' === $p['status'] ? 'active' : 'done' );
		$state['prepare']  = $planned ? 'done' : ( 'planning' === $p['status'] ? 'active' : ( $cancelled ? 'skipped' : 'pending' ) );
		$state['docs']     = $count['docs'] > 0 ? 'done' : ( $planned ? 'done' : ( $cancelled ? 'skipped' : 'pending' ) );
		$state['exterior'] = $stage_state( $count['ext_total'], $count['ext_done'], $count['ext_failed'], $cancelled ? 'skipped' : 'pending' );
		$state['interior'] = $stage_state( $count['int_total'], $count['int_done'], $count['int_failed'], 'skipped' );
		$state['process']  = $count['ext_done'] > 0 ? ( 'active' === $state['exterior'] || 'active' === $state['interior'] ? 'active' : 'done' ) : ( $cancelled ? 'skipped' : 'pending' );
		$state['gallery']  = in_array( $p['status'], array( 'ready', 'partial' ), true ) ? ( 'done' === $p['stage'] ? 'done' : 'active' ) : ( $cancelled ? 'skipped' : 'pending' );
		$state['done']     = in_array( $p['status'], array( 'ready', 'partial' ), true ) && 'done' === $p['stage'] ? 'done' : ( 'failed' === $p['status'] ? 'error' : ( $cancelled ? 'skipped' : 'pending' ) );
		$errors            = array(
			'exterior' => $count['ext_failed'],
			'interior' => $count['int_failed'],
		);

		$total   = $count['ext_total'] + $count['int_total'];
		$fin     = $count['ext_done'] + $count['int_done'] + $count['failed'];
		$percent = null;
		if ( $planned && $total > 0 ) {
			$percent = (int) floor( 10 + 90 * min( 1, $fin / $total ) );
		} elseif ( $planned ) {
			$percent = 10;
		}
		$list = array();
		foreach ( $stages as $k => $label ) {
			$item = array( 'id' => $k, 'label' => $label, 'state' => $state[ $k ] );
			if ( ! empty( $errors[ $k ] ) ) {
				$item['errors'] = $errors[ $k ];
			}
			$list[] = $item;
		}
		return array(
			'stages'  => $list,
			'percent' => $percent,
			'counts'  => $count,
			'pending_jobs' => JobQueue::counts( $p['id'] ),
		);
	}
}
