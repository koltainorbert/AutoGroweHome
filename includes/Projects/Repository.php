<?php
/**
 * Data access for projects, concepts and assets.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Projects;

use AutoGroweHome\Installer;
use AutoGroweHome\Support\Storage;
use AutoGroweHome\Support\Util;

defined( 'ABSPATH' ) || exit;

final class Repository {

	/* ---------------------------------------------------------------- projects */

	public static function create_project( array $config, int $user_id, string $guest_hash, string $ip_hash, string $lang, int $prompt_version ): array {
		global $wpdb;
		$uuid = Util::uuid();
		$now  = Util::now();
		$wpdb->insert(
			Installer::table( 'projects' ),
			array(
				'uuid'           => $uuid,
				'owner_user_id'  => $user_id,
				'guest_key_hash' => $guest_hash,
				'name'           => substr( (string) ( $config['project_name'] ?? '' ), 0, 190 ),
				'status'         => 'queued',
				'config'         => Util::json( $config ),
				'config_hash'    => self::config_hash( $config ),
				'prompt_version' => $prompt_version,
				'lang'           => substr( $lang, 0, 12 ),
				'stage'          => 'validate',
				'ip_hash'        => $ip_hash,
				'created_at'     => $now,
				'updated_at'     => $now,
			)
		);
		return self::project_by_id( (int) $wpdb->insert_id );
	}

	public static function config_hash( array $config ): string {
		$c = $config;
		unset( $c['project_name'], $c['house_name'], $c['_explicit'] );
		ksort( $c );
		return hash( 'sha256', Util::json( $c ) );
	}

	public static function project_by_id( int $id ): ?array {
		global $wpdb;
		$t   = Installer::table( 'projects' );
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore
		return $row ? self::hydrate_project( $row ) : null;
	}

	public static function project_by_uuid( string $uuid ): ?array {
		if ( ! Util::is_uuid( $uuid ) ) {
			return null;
		}
		global $wpdb;
		$t   = Installer::table( 'projects' );
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE uuid = %s", $uuid ), ARRAY_A ); // phpcs:ignore
		return $row ? self::hydrate_project( $row ) : null;
	}

	private static function hydrate_project( array $row ): array {
		$row['id']                  = (int) $row['id'];
		$row['owner_user_id']       = (int) $row['owner_user_id'];
		$row['selected_concept_id'] = (int) $row['selected_concept_id'];
		$row['prompt_version']      = (int) $row['prompt_version'];
		$row['saved']               = (int) $row['saved'];
		$row['config']              = Util::decode( $row['config'] );
		return $row;
	}

	public static function update_project( int $id, array $data ): void {
		global $wpdb;
		if ( isset( $data['config'] ) && is_array( $data['config'] ) ) {
			$data['config_hash'] = self::config_hash( $data['config'] );
			$data['config']      = Util::json( $data['config'] );
		}
		$data['updated_at'] = Util::now();
		$wpdb->update( Installer::table( 'projects' ), $data, array( 'id' => $id ) );
	}

	/**
	 * Recent project with an identical configuration (dedupe / cache). Failed,
	 * cancelled (nothing produced) and deleted projects are never reused.
	 */
	public static function find_recent_same( string $config_hash, int $user_id, string $guest_hash, int $minutes ): ?array {
		global $wpdb;
		$t     = Installer::table( 'projects' );
		$since = gmdate( 'Y-m-d H:i:s', time() - $minutes * 60 );
		if ( $user_id > 0 ) {
			$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE config_hash = %s AND owner_user_id = %d AND created_at >= %s AND status NOT IN ('failed','cancelled','deleted') ORDER BY id DESC LIMIT 1", $config_hash, $user_id, $since ), ARRAY_A ); // phpcs:ignore
		} else {
			$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE config_hash = %s AND guest_key_hash = %s AND guest_key_hash <> '' AND created_at >= %s AND status NOT IN ('failed','cancelled','deleted') ORDER BY id DESC LIMIT 1", $config_hash, $guest_hash, $since ), ARRAY_A ); // phpcs:ignore
		}
		return $row ? self::hydrate_project( $row ) : null;
	}

	public static function projects_for_owner( int $user_id, string $guest_hash, int $limit = 20 ): array {
		global $wpdb;
		$t = Installer::table( 'projects' );
		if ( $user_id > 0 ) {
			$rows = $wpdb->get_results( $wpdb->prepare( "SELECT id, uuid, name, status, created_at, updated_at, saved, selected_concept_id FROM {$t} WHERE owner_user_id = %d AND status <> 'deleted' ORDER BY id DESC LIMIT %d", $user_id, $limit ), ARRAY_A ); // phpcs:ignore
		} elseif ( '' !== $guest_hash ) {
			$rows = $wpdb->get_results( $wpdb->prepare( "SELECT id, uuid, name, status, created_at, updated_at, saved, selected_concept_id FROM {$t} WHERE guest_key_hash = %s AND status <> 'deleted' ORDER BY id DESC LIMIT %d", $guest_hash, $limit ), ARRAY_A ); // phpcs:ignore
		} else {
			$rows = array();
		}
		return $rows ?: array();
	}

	public static function list_projects( array $args ): array {
		global $wpdb;
		$t      = Installer::table( 'projects' );
		$where  = array( "status <> 'deleted'" );
		$params = array();
		if ( ! empty( $args['status'] ) ) {
			$where[]  = 'status = %s';
			$params[] = $args['status'];
		}
		if ( ! empty( $args['search'] ) ) {
			$where[]  = '(name LIKE %s OR uuid LIKE %s)';
			$like     = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$params[] = $like;
			$params[] = $like;
		}
		$per    = max( 1, min( 100, (int) ( $args['per_page'] ?? 20 ) ) );
		$page   = max( 1, (int) ( $args['page'] ?? 1 ) );
		$sqlw   = implode( ' AND ', $where );
		$total  = (int) $wpdb->get_var( $params ? $wpdb->prepare( "SELECT COUNT(*) FROM {$t} WHERE {$sqlw}", $params ) : "SELECT COUNT(*) FROM {$t} WHERE {$sqlw}" ); // phpcs:ignore
		$params[] = $per;
		$params[] = ( $page - 1 ) * $per;
		$rows   = $wpdb->get_results( $wpdb->prepare( "SELECT id, uuid, name, status, stage, owner_user_id, saved, selected_concept_id, created_at, updated_at FROM {$t} WHERE {$sqlw} ORDER BY id DESC LIMIT %d OFFSET %d", $params ), ARRAY_A ); // phpcs:ignore
		return array( 'items' => $rows ?: array(), 'total' => $total, 'pages' => (int) ceil( $total / $per ) );
	}

	/**
	 * Permanently delete a project with all files and rows (no checks – the
	 * caller decides; GDPR erasure and retention use it directly). For user
	 * or admin initiated deletion use delete_project_safe().
	 */
	public static function delete_project( int $id ): void {
		global $wpdb;
		$p = self::project_by_id( $id );
		if ( ! $p ) {
			return;
		}
		Storage::delete_project( $p['uuid'] );
		foreach ( array( 'assets', 'concepts', 'jobs', 'access' ) as $tbl ) {
			$wpdb->delete( Installer::table( $tbl ), array( 'project_id' => $id ) );
		}
		$wpdb->delete( Installer::table( 'projects' ), array( 'id' => $id ) );
	}

	public static function has_quote( int $project_id ): bool {
		global $wpdb;
		$qt = Installer::table( 'quotes' );
		return (bool) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$qt} WHERE project_id = %d LIMIT 1", $project_id ) ); // phpcs:ignore
	}

	/**
	 * Deletion requested by the visitor (REST DELETE) or an administrator.
	 * A project with a quote request is refused: the quote, its consent log
	 * and the contractor package depend on it (GDPR erasure goes through the
	 * WordPress eraser / quote anonymisation instead). Otherwise queued jobs
	 * are cancelled and the project is removed with its rows and private files.
	 *
	 * @return bool|\WP_Error True on success, WP_Error (status 404/409) otherwise.
	 */
	public static function delete_project_safe( int $id ) {
		$p = self::project_by_id( $id );
		if ( ! $p ) {
			return new \WP_Error( 'agh_not_found', __( 'A projekt nem található.', 'autogrowehome' ), array( 'status' => 404 ) );
		}
		if ( self::has_quote( $id ) ) {
			return new \WP_Error( 'agh_has_quote', __( 'A projekthez ajánlatkérés tartozik; törlését az adatkezelőtől kérheted.', 'autogrowehome' ), array( 'status' => 409 ) );
		}
		\AutoGroweHome\Generation\JobQueue::cancel_project( $id );
		self::delete_project( $id ); // Also removes contractor access rows and the file folder.
		return true;
	}

	/** Built-in text parameters that hold technical values, not free text (kept). */
	private const TECHNICAL_TEXT = array( 'tile_size' );

	/** Free-text keys of a room (RoomProgram::sanitize()). */
	private const ROOM_TEXT = array( 'notes', 'floor', 'wall', 'ceiling', 'lighting', 'furniture', 'decor', 'curtains', 'doors', 'windows', 'electrical', 'heating' );

	/**
	 * Remove every free text from a project configuration, keep the technical
	 * parameters (numbers, selections, colours, toggles, room sizes/types):
	 * - text/textarea parameters (built-in and admin-defined x_* ones; an x_*
	 *   string without a known definition counts as free text), except the
	 *   technical TECHNICAL_TEXT ones;
	 * - room names (reset to the room type's generic label) and all free-text
	 *   room fields (notes, finishes, furniture …).
	 */
	public static function scrub_config( array $config ): array {
		$types = array();
		foreach ( \AutoGroweHome\Params\Definitions::fields() as $f ) {
			$types[ $f['id'] ] = (string) ( $f['type'] ?? '' );
		}
		foreach ( \AutoGroweHome\Params\Registry::custom() as $f ) {
			if ( is_array( $f ) && isset( $f['id'] ) ) {
				$types[ (string) $f['id'] ] = (string) ( $f['type'] ?? 'text' );
			}
		}
		foreach ( $config as $k => $v ) {
			$k    = (string) $k;
			$type = $types[ $k ] ?? '';
			$free = in_array( $type, array( 'text', 'textarea' ), true ) && ! in_array( $k, self::TECHNICAL_TEXT, true );
			if ( '' === $type && 0 === strpos( $k, 'x_' ) && is_string( $v ) ) {
				$free = true;
			}
			if ( $free ) {
				$config[ $k ] = '';
			}
		}
		if ( isset( $config['rooms'] ) && is_array( $config['rooms'] ) ) {
			$room_types = \AutoGroweHome\Params\Definitions::room_types();
			foreach ( $config['rooms'] as $i => $room ) {
				if ( ! is_array( $room ) ) {
					continue;
				}
				if ( isset( $room['name'] ) ) {
					$config['rooms'][ $i ]['name'] = (string) ( $room_types[ $room['type'] ?? '' ][0] ?? '' );
				}
				foreach ( self::ROOM_TEXT as $txt ) {
					unset( $config['rooms'][ $i ][ $txt ] );
				}
			}
		}
		return $config;
	}

	/**
	 * GDPR: strip a project down to non-personal data when its quote is
	 * anonymised or erased. Every free text is removed from the configuration
	 * (scrub_config()), files, assets (prompts),
	 * concepts (AI texts may quote the description), jobs and contractor links
	 * are deleted, owner links are cleared and the row is marked 'deleted'
	 * (hidden everywhere). The technical parameters stay for aggregate use;
	 * the daily statistics are separate and unaffected.
	 */
	public static function anonymize_project( int $id ): void {
		global $wpdb;
		$p = self::project_by_id( $id );
		if ( ! $p ) {
			return;
		}
		\AutoGroweHome\Generation\JobQueue::cancel_project( $id );
		Storage::delete_project( $p['uuid'] );
		foreach ( array( 'assets', 'concepts', 'jobs', 'access' ) as $tbl ) {
			$wpdb->delete( Installer::table( $tbl ), array( 'project_id' => $id ) );
		}
		self::update_project(
			$id,
			array(
				'name'                => '',
				'config'              => self::scrub_config( (array) $p['config'] ),
				'owner_user_id'       => 0,
				'guest_key_hash'      => '',
				'ip_hash'             => '',
				'selected_concept_id' => 0,
				'saved'               => 0,
				'status'              => 'deleted',
			)
		);
	}

	/* ---------------------------------------------------------------- concepts */

	public static function create_concept( int $project_id, string $variant, array $brief, array $building ): array {
		global $wpdb;
		$uuid = Util::uuid();
		$now  = Util::now();
		$wpdb->insert(
			Installer::table( 'concepts' ),
			array(
				'uuid'           => $uuid,
				'project_id'     => $project_id,
				'variant'        => $variant,
				'title'          => substr( (string) ( $brief['name'] ?? $variant ), 0, 190 ),
				'brief'          => Util::json( $brief ),
				'building'       => Util::json( $building ),
				'consistency_id' => substr( hash( 'sha256', $uuid . '|' . Util::json( $building['parts'] ?? array() ) ), 0, 16 ),
				'status'         => 'planned',
				'created_at'     => $now,
				'updated_at'     => $now,
			)
		);
		return self::concept( (int) $wpdb->insert_id );
	}

	public static function concept( int $id ): ?array {
		global $wpdb;
		$t   = Installer::table( 'concepts' );
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore
		return $row ? self::hydrate_concept( $row ) : null;
	}

	public static function concept_by_uuid( string $uuid ): ?array {
		if ( ! Util::is_uuid( $uuid ) ) {
			return null;
		}
		global $wpdb;
		$t   = Installer::table( 'concepts' );
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE uuid = %s", $uuid ), ARRAY_A ); // phpcs:ignore
		return $row ? self::hydrate_concept( $row ) : null;
	}

	public static function concepts( int $project_id ): array {
		global $wpdb;
		$t    = Installer::table( 'concepts' );
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$t} WHERE project_id = %d ORDER BY variant ASC", $project_id ), ARRAY_A ) ?: array(); // phpcs:ignore
		return array_map( array( __CLASS__, 'hydrate_concept' ), $rows );
	}

	private static function hydrate_concept( array $row ): array {
		$row['id']         = (int) $row['id'];
		$row['project_id'] = (int) $row['project_id'];
		$row['revision']   = (int) $row['revision'];
		$row['brief']      = Util::decode( $row['brief'] );
		$row['building']   = Util::decode( $row['building'] );
		return $row;
	}

	public static function update_concept( int $id, array $data ): void {
		global $wpdb;
		foreach ( array( 'brief', 'building' ) as $k ) {
			if ( isset( $data[ $k ] ) && is_array( $data[ $k ] ) ) {
				$data[ $k ] = Util::json( $data[ $k ] );
			}
		}
		$data['updated_at'] = Util::now();
		$wpdb->update( Installer::table( 'concepts' ), $data, array( 'id' => $id ) );
	}

	/* ---------------------------------------------------------------- assets */

	public static function create_asset( array $a ): array {
		global $wpdb;
		$now  = Util::now();
		$row  = array_merge(
			array(
				'uuid'         => Util::uuid(),
				'project_id'   => 0,
				'concept_id'   => 0,
				'kind'         => 'render',
				'view'         => '',
				'label'        => '',
				'status'       => 'queued',
				'provider'     => '',
				'access_level' => 'contractor',
				'version'      => 1,
				'sort'         => 0,
				'created_at'   => $now,
				'updated_at'   => $now,
			),
			$a
		);
		$wpdb->insert( Installer::table( 'assets' ), $row );
		return self::asset( (int) $wpdb->insert_id );
	}

	public static function asset( int $id ): ?array {
		global $wpdb;
		$t   = Installer::table( 'assets' );
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore
		return $row ? self::hydrate_asset( $row ) : null;
	}

	public static function asset_by_uuid( string $uuid ): ?array {
		if ( ! Util::is_uuid( $uuid ) ) {
			return null;
		}
		global $wpdb;
		$t   = Installer::table( 'assets' );
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE uuid = %s", $uuid ), ARRAY_A ); // phpcs:ignore
		return $row ? self::hydrate_asset( $row ) : null;
	}

	public static function assets( int $project_id, int $concept_id = 0 ): array {
		global $wpdb;
		$t = Installer::table( 'assets' );
		if ( $concept_id > 0 ) {
			$rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$t} WHERE project_id = %d AND concept_id = %d ORDER BY sort ASC, id ASC", $project_id, $concept_id ), ARRAY_A ); // phpcs:ignore
		} else {
			$rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$t} WHERE project_id = %d ORDER BY concept_id ASC, sort ASC, id ASC", $project_id ), ARRAY_A ); // phpcs:ignore
		}
		return array_map( array( __CLASS__, 'hydrate_asset' ), $rows ?: array() );
	}

	private static function hydrate_asset( array $row ): array {
		foreach ( array( 'id', 'project_id', 'concept_id', 'width', 'height', 'bytes', 'is_upscaled', 'is_test', 'version', 'gen_ms', 'sort' ) as $k ) {
			$row[ $k ] = (int) $row[ $k ];
		}
		$row['cost'] = (float) $row['cost'];
		return $row;
	}

	public static function update_asset( int $id, array $data ): void {
		global $wpdb;
		$data['updated_at'] = Util::now();
		$wpdb->update( Installer::table( 'assets' ), $data, array( 'id' => $id ) );
	}

	/**
	 * Public, permission-filtered asset metadata (never file paths).
	 */
	public static function public_asset( array $a, bool $full = false ): array {
		$out = array(
			'id'         => $a['uuid'],
			'kind'       => $a['kind'],
			'view'       => $a['view'],
			'label'      => $a['label'],
			'status'     => $a['status'],
			'is_test'    => (bool) $a['is_test'],
			'width'      => $a['width'],
			'height'     => $a['height'],
			'mime'       => $a['mime'],
			'resolution' => self::resolution_label( $a ),
			'upscaled'   => (bool) $a['is_upscaled'],
			'access'     => $a['access_level'],
			'version'    => $a['version'],
		);
		if ( $full ) {
			$out['provider']  = $a['provider'];
			$out['model']     = $a['model'];
			$out['gen_ms']    = $a['gen_ms'];
			$out['bytes']     = $a['bytes'];
			$out['error']     = (string) $a['error'];
			$out['created']   = $a['created_at'];
		}
		return $out;
	}

	/**
	 * Honest resolution label: "4K" only for ≥3840 px wide natively generated images.
	 */
	public static function resolution_label( array $a ): string {
		if ( 'image/svg+xml' === $a['mime'] ) {
			return 'SVG';
		}
		if ( $a['width'] <= 0 ) {
			return '';
		}
		$long = max( $a['width'], $a['height'] );
		$tag  = $long >= 3840 ? '4K' : ( $long >= 2560 ? '2.5K' : ( $long >= 1920 ? 'FHD' : 'HD' ) );
		if ( $a['is_upscaled'] ) {
			$tag .= ' (' . __( 'felskálázott', 'autogrowehome' ) . ')';
		}
		return $a['width'] . '×' . $a['height'] . ' · ' . $tag;
	}
}
