<?php
/**
 * Editable quick tour and FAQ content (Admin → Súgó).
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Frontend;

defined( 'ABSPATH' ) || exit;

final class Help {

	public const OPTION = 'agh_help';

	public static function default_tour(): array {
		return array(
			array( 'icon' => 'sparkle', 'title' => __( 'Üdv a háztervezőben!', 'autogrowehome' ), 'text' => __( 'Néhány perc alatt három különböző házkoncepciót kapsz fotórealisztikus látványtervekkel és tervvázlatokkal.', 'autogrowehome' ) ),
			array( 'icon' => 'home', 'title' => __( '1. Add meg az alapokat', 'autogrowehome' ), 'text' => __( 'Bal oldalt kategóriánként állíthatod a házat. Egyszerű módban csak a legfontosabbakat látod, a Részletes mód mindent megmutat.', 'autogrowehome' ) ),
			array( 'icon' => 'plan', 'title' => __( '2. Ellenőrizd az összegzést', 'autogrowehome' ), 'text' => __( 'Jobb oldalt élőben látod a főbb adatokat és az esetleges ellentmondásokat. Generálás csak akkor indul, ha te kéred.', 'autogrowehome' ) ),
			array( 'icon' => 'camera', 'title' => __( '3. Generálj három koncepciót', 'autogrowehome' ), 'text' => __( 'Egy generálás három különálló házváltozatot készít. Naponta korlátozott számú generálás indítható.', 'autogrowehome' ) ),
			array( 'icon' => 'check', 'title' => __( '4. Válaszd ki a kedvenced', 'autogrowehome' ), 'text' => __( 'A kiválasztott házhoz elkészül a teljes galéria; a fő látványképet letöltheted, a projektet elmentheted.', 'autogrowehome' ) ),
			array( 'icon' => 'mail', 'title' => __( '5. Kérj ajánlatot', 'autogrowehome' ), 'text' => __( 'Ha szeretnéd, a hozzájárulásod után a teljes tervcsomagot továbbítjuk a kivitelezőnek.', 'autogrowehome' ) ),
		);
	}

	public static function default_faq(): array {
		$g = __( 'Általános', 'autogrowehome' );
		$t = __( 'Tervezés', 'autogrowehome' );
		$d = __( 'Adatvédelem', 'autogrowehome' );
		$q = __( 'Ajánlatkérés', 'autogrowehome' );
		return array(
			array( 'cat' => $g, 'q' => __( 'Mi ez a háztervező?', 'autogrowehome' ), 'a' => __( 'Egy AI-alapú eszköz, amely a megadott paraméterekből három különböző házkoncepciót készít látványtervekkel és koncepcionális tervvázlatokkal.', 'autogrowehome' ) ),
			array( 'cat' => $g, 'q' => __( 'Kell hozzá építészeti tudás?', 'autogrowehome' ), 'a' => __( 'Nem. Az Egyszerű mód csak a legfontosabb kérdéseket teszi fel, a többit a rendszer javasolja.', 'autogrowehome' ) ),
			array( 'cat' => $t, 'q' => __( 'Engedélyezési tervnek használhatom a vázlatokat?', 'autogrowehome' ), 'a' => __( 'Nem. A tervvázlatok strukturált adatokból generált koncepciótervek; engedélyezéshez és kivitelezéshez szakági tervező szükséges.', 'autogrowehome' ) ),
			array( 'cat' => $t, 'q' => __( 'Miért korlátozott a napi generálások száma?', 'autogrowehome' ), 'a' => __( 'A képgenerálás valódi költséggel jár. Egy generálás három koncepciót jelent, és egy napi keretbe számít.', 'autogrowehome' ) ),
			array( 'cat' => $t, 'q' => __( 'Mennyi ideig tart a generálás?', 'autogrowehome' ), 'a' => __( 'Jellemzően néhány perc, de a külső szolgáltatók terhelésétől függ. Közben bezárhatod az ablakot; a mentett projektet később megnyithatod.', 'autogrowehome' ) ),
			array( 'cat' => $t, 'q' => __( 'Ugyanaz a ház szerepel minden képen?', 'autogrowehome' ), 'a' => __( 'A rendszer rögzített épületleírással és referenciaképpel dolgozik az egységesség érdekében, de az AI-képeken kisebb eltérések előfordulhatnak.', 'autogrowehome' ) ),
			array( 'cat' => $d, 'q' => __( 'Milyen adatokat tárolunk?', 'autogrowehome' ), 'a' => __( 'A ház paramétereit és a generált képeket. Személyes adatot csak ajánlatkéréskor kérünk, a kifejezett hozzájárulásoddal. Az IP-címet csak kódolt (hash) formában, a napi keret ellenőrzéséhez használjuk.', 'autogrowehome' ) ),
			array( 'cat' => $d, 'q' => __( 'Átadjuk-e az adataimat AI-szolgáltatónak?', 'autogrowehome' ), 'a' => __( 'A ház paraméterei és a szabad szöveges leírás a képgenerálás és az értelmezés céljából a beállított AI-szolgáltatókhoz kerülnek; személyes elérhetőségeid nem.', 'autogrowehome' ) ),
			array( 'cat' => $q, 'q' => __( 'Mi történik ajánlatkérés után?', 'autogrowehome' ), 'a' => __( 'A kivitelező e-mailben értesítést kap egy biztonságos, időkorlátos hivatkozással a tervcsomaghoz, és felveszi veled a kapcsolatot.', 'autogrowehome' ) ),
			array( 'cat' => $q, 'q' => __( 'Kötelező a marketing-hozzájárulás?', 'autogrowehome' ), 'a' => __( 'Nem. Az opcionális, és nem feltétele az ajánlatkérésnek.', 'autogrowehome' ) ),
		);
	}

	public static function tour(): array {
		$o = get_option( self::OPTION, array() );
		return ! empty( $o['tour'] ) && is_array( $o['tour'] ) ? $o['tour'] : self::default_tour();
	}

	public static function faq(): array {
		$o = get_option( self::OPTION, array() );
		return ! empty( $o['faq'] ) && is_array( $o['faq'] ) ? $o['faq'] : self::default_faq();
	}

	public static function save( array $tour, array $faq ): void {
		$clean = static function ( array $items, array $keys ) {
			$out = array();
			foreach ( $items as $i ) {
				$row = array();
				foreach ( $keys as $k ) {
					$row[ $k ] = 'a' === $k || 'text' === $k ? wp_kses_post( (string) ( $i[ $k ] ?? '' ) ) : sanitize_text_field( (string) ( $i[ $k ] ?? '' ) );
				}
				if ( '' !== trim( implode( '', $row ) ) ) {
					$out[] = $row;
				}
			}
			return $out;
		};
		update_option(
			self::OPTION,
			array(
				'tour' => $clean( $tour, array( 'icon', 'title', 'text' ) ),
				'faq'  => $clean( $faq, array( 'cat', 'q', 'a' ) ),
			),
			false
		);
	}
}
