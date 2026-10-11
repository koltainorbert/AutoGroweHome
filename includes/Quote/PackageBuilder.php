<?php
/**
 * Contractor package (ZIP) with a meaningful folder structure.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Quote;

use AutoGroweHome\Generation\FloorPlanSvg;
use AutoGroweHome\License\Features;
use AutoGroweHome\Projects\Repository;
use AutoGroweHome\Support\Settings;
use AutoGroweHome\Support\Storage;
use AutoGroweHome\Support\Util;

defined( 'ABSPATH' ) || exit;

final class PackageBuilder {

	/**
	 * @return string Relative path of the ZIP inside private storage.
	 */
	public static function build( array $quote ): string {
		if ( ! class_exists( 'ZipArchive' ) ) {
			throw new \RuntimeException( 'PHP ZipArchive extension missing' );
		}
		$project = Repository::project_by_id( (int) $quote['project_id'] );
		$concept = Repository::concept( (int) $quote['concept_id'] );
		if ( ! $project || ! $concept ) {
			throw new \RuntimeException( 'Project or concept missing' );
		}
		$short  = substr( $project['uuid'], 0, 8 );
		$root   = 'AutoGroweHome_' . $short . '_' . $concept['variant'] . '/';
		$rel    = Storage::put( $project['uuid'], 'packages/' . $quote['uuid'] . '.zip', '' );
		$abs    = Storage::path( $rel );
		$zip    = new \ZipArchive();
		if ( true !== $zip->open( $abs, \ZipArchive::CREATE | \ZipArchive::OVERWRITE ) ) {
			throw new \RuntimeException( 'Cannot create ZIP' );
		}
		$full     = Features::enabled( 'package_full' );
		$assets   = Repository::assets( $project['id'], $concept['id'] );
		$meta_csv = array( array( 'file', 'type', 'view', 'label', 'width', 'height', 'resolution', 'mime', 'bytes', 'provider', 'model', 'upscaled', 'test_image', 'version', 'generated_ms' ) );
		$folders  = array(
			'hero'     => '01_Fokep/',
			'exterior' => '02_Kulso_nezetek/',
			'interior' => '03_Belso_nezetek/',
			'plan'     => '04_Tervvazlatok/',
			'doc'      => '05_Dokumentumok/',
		);
		$n       = 1;
		$missing = array();
		foreach ( $assets as $a ) {
			// Without "package_full" only the main image and the front/back views
			// go into the package – other renders are neither packed nor missing.
			if ( 'render' === $a['kind'] && ! $full && ! in_array( $a['view'], array( 'hero', 'front', 'back' ), true ) ) {
				continue;
			}
			if ( 'render' === $a['kind'] && in_array( $a['status'], array( 'queued', 'running', 'failed' ), true ) ) {
				// Not final when the package was built (gallery still rendering after
				// the maximum wait, or failed) – listed in the readme.
				$missing[] = ( $a['label'] ?: $a['view'] ) . ' (' . ( 'failed' === $a['status'] ? __( 'sikertelen', 'autogrowehome' ) : __( 'még készült', 'autogrowehome' ) ) . ')';
				continue;
			}
			if ( 'done' !== $a['status'] || '' === $a['file_path'] ) {
				continue;
			}
			// Same server-side feature gates as the file endpoint.
			if ( ( 'plan' === $a['kind'] && ! Features::enabled( 'floorplans' ) ) || ( 'doc' === $a['kind'] && 'dxf' === $a['view'] && ! Features::enabled( 'export_advanced' ) ) ) {
				continue;
			}
			if ( 'render' === $a['kind'] ) {
				$folder = 'hero' === $a['view'] ? $folders['hero'] : ( 0 === strpos( $a['view'], 'interior_' ) ? $folders['interior'] : $folders['exterior'] );
			} elseif ( 'plan' === $a['kind'] ) {
				$folder = $folders['plan'];
			} else {
				$folder = $folders['doc'];
			}
			$path = Storage::path( $a['file_path'] );
			if ( '' === $path || is_link( $path ) ) {
				continue;
			}
			$ext   = strtolower( pathinfo( $path, PATHINFO_EXTENSION ) );
			$fname = sprintf( '%02d_%s_%s.%s', $n++, $concept['variant'], Util::slugify_filename( $a['label'] ?: $a['view'] ), preg_replace( '/[^a-z0-9]/', '', $ext ) );
			$zip->addFile( $path, $root . $folder . $fname );
			$meta_csv[] = array( $folder . $fname, $a['kind'], $a['view'], $a['label'], $a['width'], $a['height'], Repository::resolution_label( $a ), $a['mime'], $a['bytes'], $a['provider'], $a['model'], $a['is_upscaled'] ? 'yes' : 'no', $a['is_test'] ? 'yes' : 'no', $a['version'], $a['gen_ms'] );
		}

		$docs = $folders['doc'];
		$zip->addFromString( $root . $docs . 'parameter-osszesito.html', Summary::html( $project, $concept, $quote ) );
		$zip->addFromString( $root . $docs . 'parameterek.json', Summary::json( $project, $concept ) );
		$zip->addFromString( $root . $docs . 'kepek-metaadatai.csv', self::csv( $meta_csv ) );
		$zip->addFromString( $root . $docs . 'ugyfel-leirasa.txt', (string) ( $project['config']['custom_text'] ?? '' ) );
		$zip->addFromString(
			$root . $docs . 'ugyfel-elerhetosegek.txt',
			implode(
				"\n",
				array(
					__( 'Név', 'autogrowehome' ) . ': ' . $quote['full_name'],
					__( 'E-mail', 'autogrowehome' ) . ': ' . $quote['email'],
					__( 'Telefon', 'autogrowehome' ) . ': ' . $quote['phone'],
					__( 'Település', 'autogrowehome' ) . ': ' . $quote['city'],
					__( 'Építési helyszín', 'autogrowehome' ) . ': ' . $quote['site_location'],
					__( 'Tervezett kezdés', 'autogrowehome' ) . ': ' . $quote['start_period'],
					__( 'Költségkeret', 'autogrowehome' ) . ': ' . $quote['budget'],
					__( 'Megjegyzés', 'autogrowehome' ) . ': ' . $quote['note'],
				)
			)
		);
		$zip->addFromString( $root . $docs . 'hozzajarulasi-naplo.json', (string) wp_json_encode( QuoteService::consent_log( (int) $quote['id'] ), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE ) );
		$zip->addFromString( $root . '00_OLVASSEL.txt', self::readme( $project, $concept, $quote, $missing ) );
		$zip->close();
		clearstatcache();
		return $rel;
	}

	private static function csv( array $rows ): string {
		$fh = fopen( 'php://temp', 'w+' ); // phpcs:ignore
		fwrite( $fh, "\xEF\xBB\xBF" ); // phpcs:ignore
		foreach ( $rows as $r ) {
			fputcsv( $fh, array_map( array( FloorPlanSvg::class, 'csv_safe' ), $r ), ';' );
		}
		rewind( $fh );
		$s = (string) stream_get_contents( $fh );
		fclose( $fh ); // phpcs:ignore
		return $s;
	}

	/**
	 * @param string[] $missing Images not final when the package was built.
	 */
	private static function readme( array $p, array $concept, array $quote, array $missing = array() ): string {
		$brand = (string) Settings::get( 'general.plugin_name', 'AutoGroweHome' );
		$extra = array();
		if ( ! empty( $missing ) ) {
			$extra[] = '';
			$extra[] = __( 'Hiányzó képek (a csomag összeállításakor nem voltak készen):', 'autogrowehome' );
			foreach ( $missing as $m ) {
				$extra[] = '  - ' . $m;
			}
		}
		return implode(
			"\r\n",
			array_merge(
				array(
					$brand . ' – ' . __( 'kivitelezői tervcsomag', 'autogrowehome' ),
					str_repeat( '=', 50 ),
					__( 'Projektazonosító', 'autogrowehome' ) . ': ' . $p['uuid'],
					__( 'Kiválasztott változat', 'autogrowehome' ) . ': ' . $concept['variant'] . ' – ' . $concept['title'],
					__( 'Ajánlatkérés azonosító', 'autogrowehome' ) . ': ' . $quote['uuid'],
					__( 'Összeállítva', 'autogrowehome' ) . ': ' . wp_date( 'Y-m-d H:i' ),
					'',
					__( 'Tartalom', 'autogrowehome' ) . ':',
					'  01_Fokep            – ' . __( 'kiválasztott fő látványkép', 'autogrowehome' ),
					'  02_Kulso_nezetek    – ' . __( 'külső nézetek', 'autogrowehome' ),
					'  03_Belso_nezetek    – ' . __( 'belső nézetek', 'autogrowehome' ),
					'  04_Tervvazlatok     – ' . __( 'alaprajzok, tető, homlokzatok, metszet (SVG)', 'autogrowehome' ),
					'  05_Dokumentumok     – ' . __( 'paraméterek, helyiséglista, épületmodell, képmetaadatok, hozzájárulási napló', 'autogrowehome' ),
					'',
					__( 'FONTOS: A látványtervek mesterséges intelligenciával készült koncepcionális vizualizációk. A tervvázlatok strukturált adatokból generált koncepciótervek; nem minősülnek engedélyezési vagy kiviteli dokumentációnak. A végleges tervezéshez szakági tervező szükséges.', 'autogrowehome' ),
					__( 'A képek felbontását a kepek-metaadatai.csv tartalmazza; a "test_image=yes" jelölésű képek tesztmódban készült vázlatok, nem AI-látványtervek.', 'autogrowehome' ),
					__( 'A csomag személyes adatokat tartalmaz – kezeld bizalmasan, és töröld, ha már nincs rá szükség.', 'autogrowehome' ),
				),
				$extra
			)
		);
	}
}
