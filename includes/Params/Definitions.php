<?php
/**
 * Built-in parameter definitions.
 *
 * Each field: id, category, type, label, help, default, [min,max,step,unit],
 * [options => value => label], [prompt_map => value => English phrase],
 * prompt (English template with {value}), required, advanced, show_if, quick, feature.
 *
 * Prompt fragments are English because image models follow English best;
 * labels/help are translatable (Hungarian source).
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Params;

defined( 'ABSPATH' ) || exit;

final class Definitions {

	public static function categories(): array {
		return array(
			'basics'   => array( 'label' => __( 'Alapadatok', 'autogrowehome' ), 'icon' => 'home' ),
			'style'    => array( 'label' => __( 'Építészeti stílus', 'autogrowehome' ), 'icon' => 'sparkle' ),
			'massing'  => array( 'label' => __( 'Épületforma', 'autogrowehome' ), 'icon' => 'cube' ),
			'roof'     => array( 'label' => __( 'Tető', 'autogrowehome' ), 'icon' => 'roof' ),
			'facade'   => array( 'label' => __( 'Homlokzat', 'autogrowehome' ), 'icon' => 'wall' ),
			'openings' => array( 'label' => __( 'Nyílászárók', 'autogrowehome' ), 'icon' => 'window' ),
			'rooms'    => array( 'label' => __( 'Helyiségek', 'autogrowehome' ), 'icon' => 'plan' ),
			'interior' => array( 'label' => __( 'Belső tér', 'autogrowehome' ), 'icon' => 'sofa' ),
			'kitchen'  => array( 'label' => __( 'Konyha', 'autogrowehome' ), 'icon' => 'kitchen' ),
			'bathroom' => array( 'label' => __( 'Fürdőszoba', 'autogrowehome' ), 'icon' => 'bath' ),
			'surfaces' => array( 'label' => __( 'Burkolatok', 'autogrowehome' ), 'icon' => 'tiles' ),
			'garden'   => array( 'label' => __( 'Kert és környezet', 'autogrowehome' ), 'icon' => 'tree' ),
			'energy'   => array( 'label' => __( 'Gépészet és energia', 'autogrowehome' ), 'icon' => 'bolt' ),
			'scene'    => array( 'label' => __( 'Fény és kamera', 'autogrowehome' ), 'icon' => 'camera' ),
			'custom'   => array( 'label' => __( 'Egyedi leírás', 'autogrowehome' ), 'icon' => 'pen' ),
		);
	}

	/**
	 * Option helper: value => [label, prompt].
	 */
	private static function opts( array $map ): array {
		$options = array();
		$prompts = array();
		foreach ( $map as $value => $pair ) {
			$options[ $value ] = $pair[0];
			$prompts[ $value ] = $pair[1];
		}
		return array( 'options' => $options, 'prompt_map' => $prompts );
	}

	public static function fields(): array {
		$f = array();

		/* ---------------------------------------------------------------- Alapadatok */
		$f[] = array( 'id' => 'project_name', 'category' => 'basics', 'type' => 'text', 'label' => __( 'Projekt neve', 'autogrowehome' ), 'help' => __( 'Saját elnevezés, a mentett projektek között így találod meg.', 'autogrowehome' ), 'default' => '', 'max' => 120, 'prompt' => '' );
		$f[] = array( 'id' => 'house_name', 'category' => 'basics', 'type' => 'text', 'label' => __( 'Ház megnevezése', 'autogrowehome' ), 'help' => __( 'Pl. „Napfényes családi ház”. Képre nem kerül felirat.', 'autogrowehome' ), 'default' => '', 'max' => 120, 'advanced' => true, 'prompt' => '' );
		$f[] = array_merge(
			array( 'id' => 'property_type', 'category' => 'basics', 'type' => 'select', 'label' => __( 'Ingatlan típusa', 'autogrowehome' ), 'help' => __( 'Az épület alaptípusa.', 'autogrowehome' ), 'default' => 'detached', 'required' => true, 'prompt' => 'a {value}' ),
			self::opts(
				array(
					'detached'      => array( __( 'Családi ház (szabadon álló)', 'autogrowehome' ), 'detached single-family house' ),
					'semi_detached' => array( __( 'Ikerház', 'autogrowehome' ), 'semi-detached house (one half shown)' ),
					'row'           => array( __( 'Sorház', 'autogrowehome' ), 'row house unit' ),
					'holiday'       => array( __( 'Nyaraló / hétvégi ház', 'autogrowehome' ), 'holiday cottage' ),
					'villa'         => array( __( 'Villa', 'autogrowehome' ), 'luxury villa' ),
					'small'         => array( __( 'Kisház / tiny house', 'autogrowehome' ), 'compact small house' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'building_function', 'category' => 'basics', 'type' => 'select', 'label' => __( 'Épület funkciója', 'autogrowehome' ), 'help' => __( 'Mire használjátok elsősorban az épületet?', 'autogrowehome' ), 'default' => 'family', 'advanced' => true, 'prompt' => 'designed as a {value}' ),
			self::opts(
				array(
					'family'     => array( __( 'Állandó családi otthon', 'autogrowehome' ), 'permanent family home' ),
					'multi_gen'  => array( __( 'Többgenerációs otthon', 'autogrowehome' ), 'multi-generational home' ),
					'home_office'=> array( __( 'Otthon + home office', 'autogrowehome' ), 'home with dedicated home office' ),
					'holiday'    => array( __( 'Pihenő / üdülő', 'autogrowehome' ), 'leisure retreat' ),
					'rental'     => array( __( 'Bérbeadásra', 'autogrowehome' ), 'rental home' ),
				)
			)
		);
		$f[] = array( 'id' => 'occupants', 'category' => 'basics', 'type' => 'integer', 'label' => __( 'Lakók száma', 'autogrowehome' ), 'help' => __( 'Hány fő fog tartósan a házban lakni.', 'autogrowehome' ), 'default' => 4, 'min' => 1, 'max' => 16, 'quick' => array( 2, 3, 4, 5, 6 ), 'required' => true, 'prompt' => '' );
		$f[] = array( 'id' => 'bedrooms', 'category' => 'basics', 'type' => 'integer', 'label' => __( 'Hálószobák száma', 'autogrowehome' ), 'help' => __( 'A fő hálószobát is beleértve.', 'autogrowehome' ), 'default' => 3, 'min' => 0, 'max' => 10, 'quick' => array( 1, 2, 3, 4, 5 ), 'required' => true, 'prompt' => '{value} bedrooms' );
		$f[] = array( 'id' => 'bathrooms', 'category' => 'basics', 'type' => 'integer', 'label' => __( 'Fürdőszobák száma', 'autogrowehome' ), 'help' => __( 'Teljes fürdőszobák (a külön WC-t a helyiségeknél adhatod meg).', 'autogrowehome' ), 'default' => 2, 'min' => 1, 'max' => 6, 'quick' => array( 1, 2, 3 ), 'required' => true, 'prompt' => '{value} bathrooms' );
		$f[] = array_merge(
			array( 'id' => 'levels', 'category' => 'basics', 'type' => 'select', 'label' => __( 'Szintek', 'autogrowehome' ), 'help' => __( 'Földszintes, emeletes vagy tetőtér-beépítéses kialakítás.', 'autogrowehome' ), 'default' => 'single', 'required' => true, 'prompt' => '{value}' ),
			self::opts(
				array(
					'single' => array( __( 'Földszintes', 'autogrowehome' ), 'single-storey bungalow' ),
					'attic'  => array( __( 'Földszint + tetőtér', 'autogrowehome' ), 'one-and-a-half storey house with habitable attic' ),
					'two'    => array( __( 'Kétszintes (emeletes)', 'autogrowehome' ), 'two-storey house' ),
					'three'  => array( __( 'Háromszintes', 'autogrowehome' ), 'three-storey house' ),
				)
			)
		);
		$f[] = array( 'id' => 'net_area', 'category' => 'basics', 'type' => 'range', 'label' => __( 'Nettó hasznos alapterület', 'autogrowehome' ), 'help' => __( 'A helyiségek összes hasznos alapterülete (terasz nélkül).', 'autogrowehome' ), 'default' => 120, 'min' => 25, 'max' => 800, 'step' => 1, 'unit' => 'm²', 'quick' => array( 60, 90, 120, 150, 200 ), 'required' => true, 'prompt' => 'approximately {value} square metres of living area' );
		$f[] = array( 'id' => 'gross_area', 'category' => 'basics', 'type' => 'number', 'label' => __( 'Bruttó alapterület', 'autogrowehome' ), 'help' => __( 'Falakkal együtt. Üresen hagyva a rendszer kb. a nettó +15%-ával számol.', 'autogrowehome' ), 'default' => 0, 'min' => 0, 'max' => 1200, 'step' => 1, 'unit' => 'm²', 'advanced' => true, 'prompt' => '' );
		$f[] = array( 'id' => 'plot_area', 'category' => 'basics', 'type' => 'number', 'label' => __( 'Telek területe', 'autogrowehome' ), 'help' => __( 'Ha nem ismert, hagyd 0-n.', 'autogrowehome' ), 'default' => 800, 'min' => 0, 'max' => 50000, 'step' => 10, 'unit' => 'm²', 'quick' => array( 500, 800, 1000, 1500 ), 'prompt' => '' );
		$f[] = array( 'id' => 'plot_width', 'category' => 'basics', 'type' => 'number', 'label' => __( 'Telek szélessége', 'autogrowehome' ), 'help' => __( 'Utcafronti szélesség.', 'autogrowehome' ), 'default' => 20, 'min' => 0, 'max' => 500, 'step' => 0.5, 'unit' => 'm', 'advanced' => true, 'prompt' => '' );
		$f[] = array( 'id' => 'plot_length', 'category' => 'basics', 'type' => 'number', 'label' => __( 'Telek hosszúsága', 'autogrowehome' ), 'help' => __( 'Telekmélység.', 'autogrowehome' ), 'default' => 40, 'min' => 0, 'max' => 1000, 'step' => 0.5, 'unit' => 'm', 'advanced' => true, 'prompt' => '' );
		$f[] = array( 'id' => 'building_width', 'category' => 'basics', 'type' => 'number', 'label' => __( 'Épület szélessége', 'autogrowehome' ), 'help' => __( 'Külső befoglaló méret. 0 = automatikus.', 'autogrowehome' ), 'default' => 0, 'min' => 0, 'max' => 60, 'step' => 0.1, 'unit' => 'm', 'advanced' => true, 'prompt' => '' );
		$f[] = array( 'id' => 'building_length', 'category' => 'basics', 'type' => 'number', 'label' => __( 'Épület hosszúsága', 'autogrowehome' ), 'help' => __( 'Külső befoglaló méret. 0 = automatikus.', 'autogrowehome' ), 'default' => 0, 'min' => 0, 'max' => 80, 'step' => 0.1, 'unit' => 'm', 'advanced' => true, 'prompt' => '' );
		$f[] = array_merge(
			array( 'id' => 'orientation', 'category' => 'basics', 'type' => 'select', 'label' => __( 'Kert felőli homlokzat tájolása', 'autogrowehome' ), 'help' => __( 'Merre néz a nappali és a terasz.', 'autogrowehome' ), 'default' => 'south', 'prompt' => 'living spaces and terrace facing {value}' ),
			self::opts(
				array(
					'south' => array( __( 'Dél', 'autogrowehome' ), 'south' ),
					'south_west' => array( __( 'Délnyugat', 'autogrowehome' ), 'south-west' ),
					'south_east' => array( __( 'Délkelet', 'autogrowehome' ), 'south-east' ),
					'west'  => array( __( 'Nyugat', 'autogrowehome' ), 'west' ),
					'east'  => array( __( 'Kelet', 'autogrowehome' ), 'east' ),
					'north' => array( __( 'Észak', 'autogrowehome' ), 'north' ),
				)
			)
		);
		$f[] = array( 'id' => 'country', 'category' => 'basics', 'type' => 'text', 'label' => __( 'Tervezési ország és régió', 'autogrowehome' ), 'help' => __( 'Pl. Magyarország, Balaton-felvidék. Az építészeti környezetet befolyásolja.', 'autogrowehome' ), 'default' => 'Magyarország', 'max' => 120, 'prompt' => 'located in {value}' );
		$f[] = array_merge(
			array( 'id' => 'climate', 'category' => 'basics', 'type' => 'select', 'label' => __( 'Éghajlati környezet', 'autogrowehome' ), 'help' => __( 'A növényzetet és a fényviszonyokat hangolja.', 'autogrowehome' ), 'default' => 'continental', 'advanced' => true, 'prompt' => '{value} climate setting' ),
			self::opts(
				array(
					'continental'   => array( __( 'Mérsékelt kontinentális', 'autogrowehome' ), 'temperate continental' ),
					'mediterranean' => array( __( 'Mediterrán', 'autogrowehome' ), 'mediterranean' ),
					'alpine'        => array( __( 'Hegyvidéki / alpesi', 'autogrowehome' ), 'alpine mountain' ),
					'oceanic'       => array( __( 'Óceáni', 'autogrowehome' ), 'mild oceanic' ),
					'nordic'        => array( __( 'Északi', 'autogrowehome' ), 'nordic' ),
				)
			)
		);
		$f[] = array( 'id' => 'budget', 'category' => 'basics', 'type' => 'number', 'label' => __( 'Tervezett költségkeret', 'autogrowehome' ), 'help' => __( 'Tájékoztató adat a kivitelező számára. Nem árajánlat.', 'autogrowehome' ), 'default' => 0, 'min' => 0, 'max' => 10000000000, 'step' => 1000000, 'unit' => 'Ft', 'prompt' => '' );
		$f[] = array( 'id' => 'build_period', 'category' => 'basics', 'type' => 'text', 'label' => __( 'Kívánt építési időszak', 'autogrowehome' ), 'help' => __( 'Pl. 2027 tavasz.', 'autogrowehome' ), 'default' => '', 'max' => 60, 'advanced' => true, 'prompt' => '' );
		$f[] = array( 'id' => 'accessible', 'category' => 'basics', 'type' => 'toggle', 'label' => __( 'Akadálymentes kialakítás', 'autogrowehome' ), 'help' => __( 'Küszöbmentes bejárat, szélesebb ajtók, akadálymentes fürdő.', 'autogrowehome' ), 'default' => false, 'prompt' => 'barrier-free accessible design with level threshold entrance' );

		/* ---------------------------------------------------------------- Stílus */
		$f[] = array_merge(
			array( 'id' => 'arch_style', 'category' => 'style', 'type' => 'cards', 'label' => __( 'Építészeti stílus', 'autogrowehome' ), 'help' => __( 'A három koncepció ebből a stílusirányból indul ki.', 'autogrowehome' ), 'default' => 'modern_minimal', 'required' => true, 'prompt' => '{value} architecture' ),
			self::opts(
				array(
					'modern_minimal'   => array( __( 'Modern minimalista', 'autogrowehome' ), 'modern minimalist' ),
					'contemporary_lux' => array( __( 'Kortárs luxus', 'autogrowehome' ), 'contemporary luxury' ),
					'mediterranean'    => array( __( 'Mediterrán', 'autogrowehome' ), 'Mediterranean' ),
					'scandinavian'     => array( __( 'Skandináv', 'autogrowehome' ), 'Scandinavian' ),
					'bauhaus'          => array( __( 'Bauhaus', 'autogrowehome' ), 'Bauhaus-inspired' ),
					'japandi'          => array( __( 'Japandi', 'autogrowehome' ), 'Japandi' ),
					'classic_burgher'  => array( __( 'Klasszikus polgári', 'autogrowehome' ), 'classic European burgher-style' ),
					'rustic'           => array( __( 'Vidéki, rusztikus', 'autogrowehome' ), 'rustic countryside' ),
					'modern_farmhouse' => array( __( 'Modern parasztház', 'autogrowehome' ), 'modern Hungarian farmhouse (barnhouse)' ),
					'american_farm'    => array( __( 'Amerikai farmhouse', 'autogrowehome' ), 'American farmhouse' ),
					'alpine'           => array( __( 'Alpesi', 'autogrowehome' ), 'alpine chalet' ),
					'industrial'       => array( __( 'Ipari stílus', 'autogrowehome' ), 'industrial loft-style' ),
					'organic_modern'   => array( __( 'Organikus modern', 'autogrowehome' ), 'organic modern' ),
					'high_tech'        => array( __( 'High-tech', 'autogrowehome' ), 'high-tech' ),
					'passive'          => array( __( 'Passzívház', 'autogrowehome' ), 'passive-house standard compact' ),
					'custom'           => array( __( 'Egyedi stílus', 'autogrowehome' ), 'custom' ),
				)
			)
		);
		$f[] = array( 'id' => 'style_custom', 'category' => 'style', 'type' => 'text', 'label' => __( 'Egyedi stílus leírása', 'autogrowehome' ), 'help' => __( 'Röviden, pl. „modern pajta, sötét fa és üveg”.', 'autogrowehome' ), 'default' => '', 'max' => 200, 'show_if' => array( 'field' => 'arch_style', 'op' => '=', 'value' => 'custom' ), 'prompt' => 'style described as: {value}' );
		$f[] = array( 'id' => 'style_intensity', 'category' => 'style', 'type' => 'range', 'label' => __( 'Karakteresség', 'autogrowehome' ), 'help' => __( 'Mennyire visszafogott vagy karakteres legyen az építészet.', 'autogrowehome' ), 'default' => 50, 'min' => 0, 'max' => 100, 'step' => 5, 'unit' => '%', 'advanced' => true, 'prompt' => '' );

		/* ---------------------------------------------------------------- Épületforma */
		$f[] = array_merge(
			array( 'id' => 'footprint', 'category' => 'massing', 'type' => 'cards', 'label' => __( 'Alaprajzi forma', 'autogrowehome' ), 'help' => __( 'Az épülettömeg alapformája.', 'autogrowehome' ), 'default' => 'rectangle', 'prompt' => '{value} footprint' ),
			self::opts(
				array(
					'rectangle' => array( __( 'Egyszerű téglalap', 'autogrowehome' ), 'simple rectangular' ),
					'l_shape'   => array( __( 'L alakú', 'autogrowehome' ), 'L-shaped' ),
					'u_shape'   => array( __( 'U alakú', 'autogrowehome' ), 'U-shaped around a courtyard' ),
					'staggered' => array( __( 'Tagolt, eltolt tömegek', 'autogrowehome' ), 'articulated staggered volumes' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'garage', 'category' => 'massing', 'type' => 'select', 'label' => __( 'Garázs / beálló', 'autogrowehome' ), 'help' => __( 'Gépkocsi-tárolás módja.', 'autogrowehome' ), 'default' => 'carport', 'prompt' => '{value}' ),
			self::opts(
				array(
					'none'        => array( __( 'Nincs', 'autogrowehome' ), '' ),
					'carport'     => array( __( 'Fedett beálló', 'autogrowehome' ), 'attached carport' ),
					'garage_1'    => array( __( 'Egyállásos garázs', 'autogrowehome' ), 'attached single garage' ),
					'garage_2'    => array( __( 'Kétállásos garázs', 'autogrowehome' ), 'attached double garage' ),
					'separate'    => array( __( 'Különálló garázs', 'autogrowehome' ), 'detached garage building' ),
				)
			)
		);
		$f[] = array( 'id' => 'terrace_area', 'category' => 'massing', 'type' => 'range', 'label' => __( 'Fedett terasz', 'autogrowehome' ), 'help' => __( 'A kert felőli fedett terasz mérete (0 = nincs).', 'autogrowehome' ), 'default' => 20, 'min' => 0, 'max' => 120, 'step' => 1, 'unit' => 'm²', 'quick' => array( 0, 12, 20, 30 ), 'prompt' => 'generous covered terrace of about {value} m2' );
		$f[] = array( 'id' => 'balcony', 'category' => 'massing', 'type' => 'toggle', 'label' => __( 'Erkély', 'autogrowehome' ), 'help' => __( 'Csak emeletes vagy tetőteres háznál.', 'autogrowehome' ), 'default' => false, 'show_if' => array( 'field' => 'levels', 'op' => '!=', 'value' => 'single' ), 'prompt' => 'upper floor balcony' );
		$f[] = array( 'id' => 'entrance_canopy', 'category' => 'massing', 'type' => 'toggle', 'label' => __( 'Bejárati előtető', 'autogrowehome' ), 'help' => '', 'default' => true, 'prompt' => 'sheltered entrance canopy' );
		$f[] = array( 'id' => 'outdoor_covered', 'category' => 'massing', 'type' => 'toggle', 'label' => __( 'További fedett kültéri tér', 'autogrowehome' ), 'help' => __( 'Pl. nyári konyha, fedett pihenő.', 'autogrowehome' ), 'default' => false, 'advanced' => true, 'prompt' => 'additional covered outdoor living area' );
		$f[] = array( 'id' => 'exterior_steps', 'category' => 'massing', 'type' => 'toggle', 'label' => __( 'Külső lépcsők', 'autogrowehome' ), 'help' => __( 'Lejtős telek vagy megemelt padlószint esetén.', 'autogrowehome' ), 'default' => false, 'advanced' => true, 'prompt' => 'a few exterior steps to the entrance' );
		$f[] = array( 'id' => 'basement', 'category' => 'massing', 'type' => 'toggle', 'label' => __( 'Pince / alagsor', 'autogrowehome' ), 'help' => '', 'default' => false, 'prompt' => 'partial basement' );
		$f[] = array( 'id' => 'technical_room', 'category' => 'massing', 'type' => 'toggle', 'label' => __( 'Gépészeti helyiség', 'autogrowehome' ), 'help' => '', 'default' => true, 'advanced' => true, 'prompt' => '' );
		$f[] = array( 'id' => 'chimney', 'category' => 'massing', 'type' => 'toggle', 'label' => __( 'Kémény / kandalló', 'autogrowehome' ), 'help' => '', 'default' => false, 'prompt' => 'one chimney for a fireplace' );
		$f[] = array_merge(
			array( 'id' => 'chimney_type', 'category' => 'massing', 'type' => 'select', 'label' => __( 'Kémény típusa', 'autogrowehome' ), 'help' => '', 'default' => 'auto', 'show_if' => array( 'field' => 'chimney', 'op' => '=', 'value' => true ), 'advanced' => true, 'prompt' => '{value}' ),
			self::opts(
				array(
							'auto' => array( __( 'A stílushoz illő', 'autogrowehome' ), 'chimney matching the style' ),
							'brick' => array( __( 'Téglakémény', 'autogrowehome' ), 'brick chimney with a concrete cap' ),
							'render' => array( __( 'Vakolt kémény', 'autogrowehome' ), 'rendered chimney with a metal cap' ),
							'stone' => array( __( 'Kő kémény', 'autogrowehome' ), 'natural stone chimney' ),
							'steel' => array( __( 'Rozsdamentes füstcső', 'autogrowehome' ), 'slim stainless steel flue' ),
							'clad' => array( __( 'Fémlemez burkolt', 'autogrowehome' ), 'dark standing-seam clad chimney' ),
							'wide' => array( __( 'Széles, kétfüstjáratú', 'autogrowehome' ), 'wide twin-flue chimney' ),
				)
			)
		);
		$f[] = array( 'id' => 'roof_storage', 'category' => 'massing', 'type' => 'toggle', 'label' => __( 'Tető alatti tároló', 'autogrowehome' ), 'help' => '', 'default' => false, 'advanced' => true, 'prompt' => '' );
		$f[] = array( 'id' => 'expandable', 'category' => 'massing', 'type' => 'toggle', 'label' => __( 'Jövőbeni bővíthetőség', 'autogrowehome' ), 'help' => __( 'A tervvázlat jelöli a bővítési irányt.', 'autogrowehome' ), 'default' => false, 'advanced' => true, 'prompt' => '' );
		$f[] = array( 'id' => 'ceiling_height', 'category' => 'massing', 'type' => 'number', 'label' => __( 'Általános belmagasság', 'autogrowehome' ), 'help' => '', 'default' => 2.8, 'min' => 2.4, 'max' => 5, 'step' => 0.05, 'unit' => 'm', 'advanced' => true, 'prompt' => '' );

		/* ---------------------------------------------------------------- Tető */
		$f[] = array_merge(
			array( 'id' => 'roof_type', 'category' => 'roof', 'type' => 'cards', 'label' => __( 'Tetőforma', 'autogrowehome' ), 'help' => __( 'A tető alapgeometriája.', 'autogrowehome' ), 'default' => 'gable', 'required' => true, 'prompt' => '{value}' ),
			self::opts(
				array(
					'gable'    => array( __( 'Nyeregtető', 'autogrowehome' ), 'pitched gable roof' ),
					'hip'      => array( __( 'Kontyolt tető', 'autogrowehome' ), 'hipped roof' ),
					'half_hip' => array( __( 'Csonkakontyos (félnyereg) tető', 'autogrowehome' ), 'half-hipped (jerkinhead) roof' ),
					'shed'     => array( __( 'Félnyeregtető (pult)', 'autogrowehome' ), 'single-pitch mono roof' ),
					'pyramid'  => array( __( 'Sátortető', 'autogrowehome' ), 'pyramid hip roof' ),
					'flat'     => array( __( 'Lapostető', 'autogrowehome' ), 'flat roof with slim parapet' ),
					'multi'    => array( __( 'Több tetősík', 'autogrowehome' ), 'multi-plane combined roof' ),
					'complex'  => array( __( 'Összetett geometria', 'autogrowehome' ), 'complex roof geometry with intersecting gables' ),
				)
			)
		);
		$f[] = array( 'id' => 'roof_pitch', 'category' => 'roof', 'type' => 'range', 'label' => __( 'Tetőhajlásszög', 'autogrowehome' ), 'help' => __( 'Lapostetőnél nem értelmezett.', 'autogrowehome' ), 'default' => 35, 'min' => 0, 'max' => 60, 'step' => 1, 'unit' => '°', 'quick' => array( 25, 30, 35, 40, 45 ), 'show_if' => array( 'field' => 'roof_type', 'op' => '!=', 'value' => 'flat' ), 'prompt' => 'roof pitch about {value} degrees' );
		$f[] = array( 'id' => 'ridge_height', 'category' => 'roof', 'type' => 'number', 'label' => __( 'Gerincmagasság', 'autogrowehome' ), 'help' => __( '0 = számított érték a hajlásszögből.', 'autogrowehome' ), 'default' => 0, 'min' => 0, 'max' => 20, 'step' => 0.1, 'unit' => 'm', 'advanced' => true, 'prompt' => '' );
		$f[] = array( 'id' => 'roof_overhang', 'category' => 'roof', 'type' => 'number', 'label' => __( 'Tetőkinyúlás', 'autogrowehome' ), 'help' => __( 'Oromfali kinyúlás.', 'autogrowehome' ), 'default' => 0.4, 'min' => 0, 'max' => 2.5, 'step' => 0.05, 'unit' => 'm', 'advanced' => true, 'prompt' => 'roof overhang of {value} m' );
		$f[] = array( 'id' => 'eaves_depth', 'category' => 'roof', 'type' => 'number', 'label' => __( 'Eresz mélysége', 'autogrowehome' ), 'help' => '', 'default' => 0.6, 'min' => 0, 'max' => 3, 'step' => 0.05, 'unit' => 'm', 'advanced' => true, 'prompt' => 'eaves depth {value} m' );
		$f[] = array_merge(
			array( 'id' => 'gable_finish', 'category' => 'roof', 'type' => 'select', 'label' => __( 'Oromfal kialakítása', 'autogrowehome' ), 'help' => '', 'default' => 'plaster', 'advanced' => true, 'show_if' => array( 'field' => 'roof_type', 'op' => 'in', 'value' => array( 'gable', 'half_hip', 'complex', 'multi' ) ), 'prompt' => 'gable ends finished in {value}' ),
			self::opts(
				array(
					'plaster' => array( __( 'Vakolt', 'autogrowehome' ), 'smooth render' ),
					'wood'    => array( __( 'Fa burkolat', 'autogrowehome' ), 'vertical timber cladding' ),
					'metal'   => array( __( 'Fémlemez', 'autogrowehome' ), 'standing-seam metal' ),
					'glass'   => array( __( 'Üvegezett', 'autogrowehome' ), 'full-height glazing' ),
					'flush'   => array( __( 'Eresz nélküli, minimál', 'autogrowehome' ), 'flush minimal detail without overhang' ),
				)
			)
		);
		$f[] = array( 'id' => 'roof_windows', 'category' => 'roof', 'type' => 'integer', 'label' => __( 'Tetősíkablakok száma', 'autogrowehome' ), 'help' => '', 'default' => 0, 'min' => 0, 'max' => 20, 'show_if' => array( 'field' => 'roof_type', 'op' => '!=', 'value' => 'flat' ), 'prompt' => '{value} roof windows in the roof plane' );
		$f[] = array( 'id' => 'dormers', 'category' => 'roof', 'type' => 'integer', 'label' => __( 'Tetőablakok (felülvilágító / „kutyaól”)', 'autogrowehome' ), 'help' => '', 'default' => 0, 'min' => 0, 'max' => 8, 'advanced' => true, 'show_if' => array( 'field' => 'roof_type', 'op' => '!=', 'value' => 'flat' ), 'prompt' => '{value} dormer windows' );
		$f[] = array( 'id' => 'roof_solar', 'category' => 'roof', 'type' => 'toggle', 'label' => __( 'Napelemek a tetőn', 'autogrowehome' ), 'help' => '', 'default' => false, 'prompt' => 'neatly integrated black solar panels on the roof' );
		$f[] = array_merge(
			array( 'id' => 'solar_type', 'category' => 'roof', 'type' => 'select', 'label' => __( 'Napelem típusa', 'autogrowehome' ), 'help' => '', 'default' => 'black_mono', 'show_if' => array( 'field' => 'roof_solar', 'op' => '=', 'value' => true ), 'prompt' => '{value}' ),
			self::opts(
				array(
							'black_mono' => array( __( 'Fekete, keret nélküli (all-black)', 'autogrowehome' ), 'all-black monocrystalline solar panels' ),
							'blue_poly' => array( __( 'Kék cellák, ezüst kerettel', 'autogrowehome' ), 'blue solar panels with silver frames' ),
							'in_roof' => array( __( 'Tetőbe integrált', 'autogrowehome' ), 'in-roof integrated solar panels flush with the roof surface' ),
							'solar_tile' => array( __( 'Napelemes cserép', 'autogrowehome' ), 'solar roof tiles' ),
							'glass' => array( __( 'Üveg-üveg modul', 'autogrowehome' ), 'frameless glass-glass solar modules' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'solar_coverage', 'category' => 'roof', 'type' => 'select', 'label' => __( 'Napelemmező mérete', 'autogrowehome' ), 'help' => '', 'default' => 'medium', 'show_if' => array( 'field' => 'roof_solar', 'op' => '=', 'value' => true ), 'prompt' => '{value}' ),
			self::opts(
				array(
							'small' => array( __( 'Kicsi (néhány panel)', 'autogrowehome' ), 'a small array of solar panels' ),
							'medium' => array( __( 'Közepes', 'autogrowehome' ), 'a medium solar array' ),
							'full' => array( __( 'Teljes tetősík', 'autogrowehome' ), 'solar panels covering most of the roof plane' ),
				)
			)
		);
		$f[] = array( 'id' => 'snow_guards', 'category' => 'roof', 'type' => 'toggle', 'label' => __( 'Hófogók', 'autogrowehome' ), 'help' => '', 'default' => true, 'advanced' => true, 'prompt' => 'discreet snow guards' );
		$f[] = array_merge(
			array( 'id' => 'gutters', 'category' => 'roof', 'type' => 'select', 'label' => __( 'Ereszcsatorna és lefolyó', 'autogrowehome' ), 'help' => '', 'default' => 'anthracite', 'advanced' => true, 'prompt' => '{value} gutters and downpipes' ),
			self::opts(
				array(
					'anthracite' => array( __( 'Antracit', 'autogrowehome' ), 'anthracite' ),
					'black'      => array( __( 'Fekete', 'autogrowehome' ), 'black' ),
					'white'      => array( __( 'Fehér', 'autogrowehome' ), 'white' ),
					'copper'     => array( __( 'Réz', 'autogrowehome' ), 'copper' ),
					'hidden'     => array( __( 'Rejtett', 'autogrowehome' ), 'concealed' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'flashing', 'category' => 'roof', 'type' => 'select', 'label' => __( 'Bádogozás, szegélyek', 'autogrowehome' ), 'help' => '', 'default' => 'match_roof', 'advanced' => true, 'prompt' => 'flashings and trims {value}' ),
			self::opts(
				array(
					'match_roof' => array( __( 'Tetőfedéshez illő', 'autogrowehome' ), 'colour-matched to the roof' ),
					'contrast'   => array( __( 'Kontrasztos', 'autogrowehome' ), 'in a contrasting dark tone' ),
					'copper'     => array( __( 'Réz', 'autogrowehome' ), 'in copper' ),
				)
			)
		);
		$f[] = array( 'id' => 'roof_ventilation', 'category' => 'roof', 'type' => 'toggle', 'label' => __( 'Látható tetőszellőzés', 'autogrowehome' ), 'help' => '', 'default' => false, 'advanced' => true, 'prompt' => 'small ridge ventilation elements' );
		$f[] = array_merge(
			array( 'id' => 'roof_vent_type', 'category' => 'roof', 'type' => 'select', 'label' => __( 'Tetőszellőző típusa', 'autogrowehome' ), 'help' => '', 'default' => 'tile_vent', 'show_if' => array( 'field' => 'roof_ventilation', 'op' => '=', 'value' => true ), 'advanced' => true, 'prompt' => '{value}' ),
			self::opts(
				array(
							'tile_vent' => array( __( 'Szellőzőcserép', 'autogrowehome' ), 'discreet vent tiles' ),
							'ridge_vent' => array( __( 'Gerincszellőző', 'autogrowehome' ), 'continuous ridge vent' ),
							'turbine' => array( __( 'Szélkerekes (turbina)', 'autogrowehome' ), 'a rotating turbine roof vent' ),
							'mushroom' => array( __( 'Gomba alakú', 'autogrowehome' ), 'low mushroom roof vents' ),
							'pipe' => array( __( 'Szellőzőcső kürtővel', 'autogrowehome' ), 'vent pipes with rain caps' ),
							'solar_fan' => array( __( 'Napelemes ventilátor', 'autogrowehome' ), 'a solar-powered roof fan' ),
				)
			)
		);
		$f[] = array( 'id' => 'exposed_rafters', 'category' => 'roof', 'type' => 'toggle', 'label' => __( 'Látható tetőszerkezeti elemek', 'autogrowehome' ), 'help' => __( 'Pl. látszó szarufavégek, fa mennyezet a teraszon.', 'autogrowehome' ), 'default' => false, 'advanced' => true, 'prompt' => 'exposed timber rafter ends' );
		$f[] = array( 'id' => 'roof_brand', 'category' => 'roof', 'type' => 'catalog', 'catalog' => 'roof_brand', 'label' => __( 'Tetőfedési márka', 'autogrowehome' ), 'help' => __( 'Az adminisztrátor által felvett gyártók közül.', 'autogrowehome' ), 'default' => 'bramac', 'show_if' => array( 'field' => 'roof_type', 'op' => '!=', 'value' => 'flat' ), 'prompt' => '' );
		$f[] = array( 'id' => 'roof_product', 'category' => 'roof', 'type' => 'catalog', 'catalog' => 'roof_product', 'filter_by' => 'roof_brand', 'label' => __( 'Tetőcserép / termék', 'autogrowehome' ), 'help' => __( 'A katalógusban rögzített termékek közül. A gyári tételek színmintái tájékoztató jellegűek, gyártói ellenőrzésre várnak.', 'autogrowehome' ), 'default' => '', 'show_if' => array( 'field' => 'roof_type', 'op' => '!=', 'value' => 'flat' ), 'prompt' => 'roof covered with {value}' );
		$f[] = array( 'id' => 'roof_color', 'category' => 'roof', 'type' => 'color', 'label' => __( 'Tetőfedés színe', 'autogrowehome' ), 'help' => __( 'Termék választásakor a termék színe az irányadó.', 'autogrowehome' ), 'default' => '#3A3D40', 'prompt' => 'roof colour {color}' );
		$f[] = array_merge(
			array( 'id' => 'roof_surface', 'category' => 'roof', 'type' => 'select', 'label' => __( 'Tetőfelület', 'autogrowehome' ), 'help' => '', 'default' => 'matt', 'prompt' => '{value} roof surface' ),
			self::opts(
				array(
					'matt'   => array( __( 'Matt', 'autogrowehome' ), 'matte' ),
					'satin'  => array( __( 'Selyemfényű', 'autogrowehome' ), 'satin' ),
					'glazed' => array( __( 'Mázas', 'autogrowehome' ), 'glazed' ),
					'green'  => array( __( 'Zöldtető', 'autogrowehome' ), 'extensive green (sedum)' ),
					'gravel' => array( __( 'Kavicsolt (lapostető)', 'autogrowehome' ), 'gravel ballast' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'ridge_tile', 'category' => 'roof', 'type' => 'select', 'label' => __( 'Gerinc / kúpcserép', 'autogrowehome' ), 'help' => '', 'default' => 'round', 'show_if' => array( 'field' => 'roof_type', 'op' => '!=', 'value' => 'flat' ), 'prompt' => '{value}' ),
			self::opts(
				array(
							'round' => array( __( 'Kerek kúpcserép', 'autogrowehome' ), 'half-round ridge tiles' ),
							'angular' => array( __( 'Szögletes kúpcserép', 'autogrowehome' ), 'angular ridge tiles' ),
							'mortar' => array( __( 'Habarcsba rakott kúp', 'autogrowehome' ), 'mortar-bedded ridge tiles' ),
							'dry' => array( __( 'Száraz gerinc, szellőző kúp', 'autogrowehome' ), 'dry-fixed ventilated ridge' ),
							'metal' => array( __( 'Fém gerincléc', 'autogrowehome' ), 'a slim metal ridge cap' ),
							'none' => array( __( 'Nem látszó, csupasz gerinc', 'autogrowehome' ), 'a clean ridge without visible caps' ),
				)
			)
		);

		/* ---------------------------------------------------------------- Homlokzat */
		$f[] = array_merge(
			array( 'id' => 'facade_main', 'category' => 'facade', 'type' => 'cards', 'label' => __( 'Fő homlokzatanyag', 'autogrowehome' ), 'help' => '', 'default' => 'render', 'required' => true, 'prompt' => 'main facade in {value}' ),
			self::opts(
				array(
					'render'   => array( __( 'Vakolt felület', 'autogrowehome' ), 'smooth mineral render' ),
					'brick'    => array( __( 'Tégla', 'autogrowehome' ), 'exposed brick' ),
					'clinker'  => array( __( 'Klinker / burkolótégla', 'autogrowehome' ), 'clinker brick slips' ),
					'stone'    => array( __( 'Természetes kő', 'autogrowehome' ), 'natural stone' ),
					'wood'     => array( __( 'Fa burkolat', 'autogrowehome' ), 'timber cladding' ),
					'metal'    => array( __( 'Fém burkolat', 'autogrowehome' ), 'standing-seam metal cladding' ),
					'concrete' => array( __( 'Betonhatású', 'autogrowehome' ), 'architectural concrete-look panels' ),
					'panel'    => array( __( 'Dekoratív panel', 'autogrowehome' ), 'large-format decorative facade panels' ),
					'wood_horizontal' => array( __( 'Vízszintes fa burkolat', 'autogrowehome' ), 'horizontal timber lap siding' ),
					'board_batten'    => array( __( 'Lécezett deszkaburkolat', 'autogrowehome' ), 'painted board-and-batten siding' ),
					'charred_wood'    => array( __( 'Égetett fa (shou sugi ban)', 'autogrowehome' ), 'charred timber cladding (shou sugi ban)' ),
					'limestone'       => array( __( 'Mészkő lapburkolat', 'autogrowehome' ), 'sawn limestone slab cladding' ),
					'brick_white'     => array( __( 'Festett tégla', 'autogrowehome' ), 'white limewashed brick' ),
					'fiber_cement'    => array( __( 'Szálcement lap', 'autogrowehome' ), 'large-format fibre-cement panels with visible fixings' ),
				)
			)
		);
		$f[] = array( 'id' => 'facade_color', 'category' => 'facade', 'type' => 'color', 'label' => __( 'Vakolat / fő szín', 'autogrowehome' ), 'help' => '', 'default' => '#F2EFE9', 'collections' => true, 'prompt' => 'facade colour {color}' );
		$f[] = array_merge(
			array( 'id' => 'facade_accent', 'category' => 'facade', 'type' => 'multiselect', 'label' => __( 'Kiegészítő anyagok', 'autogrowehome' ), 'help' => __( 'Legfeljebb kettő javasolt.', 'autogrowehome' ), 'default' => array( 'wood' ), 'max_items' => 3, 'prompt' => 'accent surfaces in {value}' ),
			self::opts(
				array(
					'wood'     => array( __( 'Fa', 'autogrowehome' ), 'warm oak timber' ),
					'stone'    => array( __( 'Kő', 'autogrowehome' ), 'natural stone' ),
					'brick'    => array( __( 'Tégla', 'autogrowehome' ), 'brick' ),
					'metal'    => array( __( 'Fém', 'autogrowehome' ), 'dark metal' ),
					'concrete' => array( __( 'Beton', 'autogrowehome' ), 'fair-faced concrete' ),
					'render_dark' => array( __( 'Sötét vakolat', 'autogrowehome' ), 'dark grey render' ),
				)
			)
		);
		$f[] = array( 'id' => 'facade_accent_color', 'category' => 'facade', 'type' => 'color', 'label' => __( 'Kiegészítő szín', 'autogrowehome' ), 'help' => '', 'default' => '#B9824F', 'advanced' => true, 'prompt' => 'accent colour {color}' );
		$f[] = array_merge(
			array( 'id' => 'plinth', 'category' => 'facade', 'type' => 'select', 'label' => __( 'Lábazat', 'autogrowehome' ), 'help' => '', 'default' => 'dark_render', 'advanced' => true, 'prompt' => 'plinth in {value}' ),
			self::opts(
				array(
					'dark_render' => array( __( 'Sötét lábazati vakolat', 'autogrowehome' ), 'dark textured plinth render' ),
					'stone'       => array( __( 'Kő lábazat', 'autogrowehome' ), 'stone plinth' ),
					'concrete'    => array( __( 'Látszóbeton', 'autogrowehome' ), 'exposed concrete plinth' ),
					'flush'       => array( __( 'Homlokzattal egyező', 'autogrowehome' ), 'flush, same as facade' ),
				)
			)
		);
		$f[] = array( 'id' => 'plinth_color', 'category' => 'facade', 'type' => 'color', 'label' => __( 'Lábazat színe', 'autogrowehome' ), 'help' => '', 'default' => '#4A4D50', 'advanced' => true, 'show_if' => array( 'field' => 'plinth', 'op' => '!=', 'value' => 'flush' ), 'prompt' => '' );
		$f[] = array_merge(
			array( 'id' => 'facade_texture', 'category' => 'facade', 'type' => 'select', 'label' => __( 'Faltextúra', 'autogrowehome' ), 'help' => '', 'default' => 'fine', 'advanced' => true, 'prompt' => '{value} wall texture' ),
			self::opts(
				array(
					'fine'   => array( __( 'Finom szemcsés', 'autogrowehome' ), 'fine-grain' ),
					'smooth' => array( __( 'Sima', 'autogrowehome' ), 'smooth' ),
					'coarse' => array( __( 'Durva, kapart', 'autogrowehome' ), 'coarse scraped' ),
				)
			)
		);
		$f[] = array( 'id' => 'facade_insulation', 'category' => 'facade', 'type' => 'toggle', 'label' => __( 'Homlokzati hőszigetelés', 'autogrowehome' ), 'help' => __( 'Igényként rögzül, a vizualizáción nem látható.', 'autogrowehome' ), 'default' => true, 'advanced' => true, 'prompt' => '' );
		$f[] = array( 'id' => 'facade_ornaments', 'category' => 'facade', 'type' => 'toggle', 'label' => __( 'Díszítőelemek, párkányok', 'autogrowehome' ), 'help' => '', 'default' => false, 'advanced' => true, 'prompt' => 'subtle cornices and window surrounds' );
		$f[] = array_merge(
			array( 'id' => 'corner_detail', 'category' => 'facade', 'type' => 'select', 'label' => __( 'Sarokmegoldás', 'autogrowehome' ), 'help' => '', 'default' => 'sharp', 'advanced' => true, 'prompt' => '{value} building corners' ),
			self::opts(
				array(
					'sharp'    => array( __( 'Éles, minimál', 'autogrowehome' ), 'crisp sharp' ),
					'quoins'   => array( __( 'Kiemelt sarokkövek', 'autogrowehome' ), 'stone quoin' ),
					'glass'    => array( __( 'Üvegezett sarok', 'autogrowehome' ), 'glazed' ),
				)
			)
		);
		$f[] = array( 'id' => 'exterior_lighting', 'category' => 'facade', 'type' => 'toggle', 'label' => __( 'Kültéri homlokzatvilágítás', 'autogrowehome' ), 'help' => '', 'default' => true, 'prompt' => 'warm wall-mounted exterior lights' );
		$f[] = array( 'id' => 'house_number', 'category' => 'facade', 'type' => 'toggle', 'label' => __( 'Házszám a bejáratnál', 'autogrowehome' ), 'help' => __( 'Felirat a képeken nem jelenik meg (olvashatatlan szöveg elkerülése).', 'autogrowehome' ), 'default' => false, 'advanced' => true, 'prompt' => 'a small minimal house-number plate without legible text' );

		/* ---------------------------------------------------------------- Nyílászárók */
		$f[] = array_merge(
			array( 'id' => 'window_style', 'category' => 'openings', 'type' => 'cards', 'label' => __( 'Ablakok jellege', 'autogrowehome' ), 'help' => '', 'default' => 'large', 'prompt' => '{value}' ),
			self::opts(
				array(
					'classic'   => array( __( 'Klasszikus méret', 'autogrowehome' ), 'classic proportioned windows' ),
					'large'     => array( __( 'Nagy üvegfelületek', 'autogrowehome' ), 'large-format windows' ),
					'panoramic' => array( __( 'Panorámaablakok', 'autogrowehome' ), 'floor-to-ceiling panoramic glazing' ),
					'vertical'  => array( __( 'Álló, keskeny ablakok', 'autogrowehome' ), 'tall slender vertical windows' ),
					'arched'    => array( __( 'Íves ablakok', 'autogrowehome' ), 'arched-top windows' ),
					'square'    => array( __( 'Kis négyzetes ablakok', 'autogrowehome' ), 'small square windows' ),
					'ribbon'    => array( __( 'Szalagablakok', 'autogrowehome' ), 'horizontal ribbon windows' ),
					'bay'       => array( __( 'Szélesített, osztott ablakok', 'autogrowehome' ), 'wide multi-pane windows' ),
				)
			)
		);
		$f[] = array( 'id' => 'window_frame_color', 'category' => 'openings', 'type' => 'color', 'label' => __( 'Ablakkeret színe', 'autogrowehome' ), 'help' => '', 'default' => '#2F3235', 'prompt' => 'window frames {color}' );
		$f[] = array_merge(
			array( 'id' => 'window_frame_material', 'category' => 'openings', 'type' => 'select', 'label' => __( 'Ablakkeret anyaga', 'autogrowehome' ), 'help' => '', 'default' => 'aluminium', 'prompt' => 'slim {value} frames' ),
			self::opts(
				array(
					'pvc'       => array( __( 'Műanyag', 'autogrowehome' ), 'PVC' ),
					'aluminium' => array( __( 'Alumínium', 'autogrowehome' ), 'aluminium' ),
					'wood'      => array( __( 'Fa', 'autogrowehome' ), 'timber' ),
					'wood_alu'  => array( __( 'Fa-alu', 'autogrowehome' ), 'timber-aluminium' ),
				)
			)
		);
		$f[] = array( 'id' => 'window_divided', 'category' => 'openings', 'type' => 'toggle', 'label' => __( 'Osztott üvegezés', 'autogrowehome' ), 'help' => '', 'default' => false, 'advanced' => true, 'prompt' => 'divided-lite glazing bars' );
		$f[] = array( 'id' => 'corner_window', 'category' => 'openings', 'type' => 'toggle', 'label' => __( 'Sarokablak', 'autogrowehome' ), 'help' => '', 'default' => false, 'advanced' => true, 'prompt' => 'one frameless corner window' );
		$f[] = array_merge(
			array( 'id' => 'terrace_door', 'category' => 'openings', 'type' => 'select', 'label' => __( 'Teraszajtó', 'autogrowehome' ), 'help' => '', 'default' => 'lift_slide', 'prompt' => '{value} to the terrace' ),
			self::opts(
				array(
					'french'     => array( __( 'Kétszárnyú erkélyajtó', 'autogrowehome' ), 'double french doors' ),
					'sliding'    => array( __( 'Tolóajtó', 'autogrowehome' ), 'sliding glass doors' ),
					'lift_slide' => array( __( 'Emelő-toló ajtó', 'autogrowehome' ), 'large lift-and-slide glass doors' ),
					'folding'    => array( __( 'Harmonikaajtó', 'autogrowehome' ), 'bi-folding glass doors' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'entrance_door', 'category' => 'openings', 'type' => 'select', 'label' => __( 'Bejárati ajtó', 'autogrowehome' ), 'help' => '', 'default' => 'solid_modern', 'prompt' => '{value} front door' ),
			self::opts(
				array(
					'solid_modern' => array( __( 'Modern tömör, hosszú fogantyúval', 'autogrowehome' ), 'modern solid flush' ),
					'glass_strip'  => array( __( 'Üvegcsíkos', 'autogrowehome' ), 'modern with vertical glass strip' ),
					'wood'         => array( __( 'Fa', 'autogrowehome' ), 'solid oak' ),
					'classic'      => array( __( 'Klasszikus, betétes', 'autogrowehome' ), 'classic panelled' ),
					'pivot'        => array( __( 'Forgóajtó (pivot)', 'autogrowehome' ), 'oversized pivot' ),
					'double'       => array( __( 'Kétszárnyú', 'autogrowehome' ), 'double-leaf' ),
					'glass_full'   => array( __( 'Teljes üveg, keskeny kerettel', 'autogrowehome' ), 'full-glass slim-framed' ),
					'half_glass'   => array( __( 'Felül üvegezett', 'autogrowehome' ), 'half-glazed' ),
					'slat'         => array( __( 'Fa lamellás', 'autogrowehome' ), 'vertical timber slat' ),
					'sidelight'    => array( __( 'Oldalvilágítóval', 'autogrowehome' ), 'solid with a full-height sidelight' ),
				)
			)
		);
		$f[] = array( 'id' => 'entrance_door_color', 'category' => 'openings', 'type' => 'color', 'label' => __( 'Bejárati ajtó színe', 'autogrowehome' ), 'help' => '', 'default' => '#2B2E31', 'prompt' => 'front door colour {color}' );
		$f[] = array_merge(
			array( 'id' => 'glazing', 'category' => 'openings', 'type' => 'select', 'label' => __( 'Üvegezés jellege', 'autogrowehome' ), 'help' => '', 'default' => 'clear', 'advanced' => true, 'prompt' => '{value} glazing' ),
			self::opts(
				array(
					'clear'   => array( __( 'Víztiszta', 'autogrowehome' ), 'clear triple' ),
					'tinted'  => array( __( 'Enyhén színezett', 'autogrowehome' ), 'slightly tinted' ),
					'frosted' => array( __( 'Fürdőben matt', 'autogrowehome' ), 'clear with frosted bathroom' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'shading', 'category' => 'openings', 'type' => 'multiselect', 'label' => __( 'Árnyékolás', 'autogrowehome' ), 'help' => '', 'default' => array( 'blinds' ), 'prompt' => 'shading with {value}' ),
			self::opts(
				array(
					'blinds'    => array( __( 'Külső raffstore', 'autogrowehome' ), 'integrated external venetian blinds' ),
					'shutters'  => array( __( 'Redőny', 'autogrowehome' ), 'concealed roller shutters' ),
					'louvres'   => array( __( 'Zsalugáter', 'autogrowehome' ), 'louvred shutters' ),
					'spalettas' => array( __( 'Spaletta', 'autogrowehome' ), 'traditional wooden spaletta shutters' ),
					'pergola'   => array( __( 'Lamellás pergola', 'autogrowehome' ), 'bioclimatic louvred pergola' ),
				)
			)
		);
		$f[] = array( 'id' => 'shutter_color', 'category' => 'openings', 'type' => 'color', 'label' => __( 'Spaletta / redőny színe', 'autogrowehome' ), 'help' => __( 'Az „Árnyékolás” mezőben választott spalettára, redőnyre vonatkozik.', 'autogrowehome' ), 'default' => '#3E4245', 'prompt' => 'shutters {color}' );
		$f[] = array( 'id' => 'insect_screens', 'category' => 'openings', 'type' => 'toggle', 'label' => __( 'Szúnyoghálók', 'autogrowehome' ), 'help' => __( 'Igényként rögzül.', 'autogrowehome' ), 'default' => true, 'advanced' => true, 'prompt' => '' );

		/* ---------------------------------------------------------------- Helyiségek */
		$f[] = array( 'id' => 'open_plan', 'category' => 'rooms', 'type' => 'toggle', 'label' => __( 'Nyitott nappali–konyha–étkező', 'autogrowehome' ), 'help' => __( 'Egy légtérben kialakított közösségi tér.', 'autogrowehome' ), 'default' => true, 'prompt' => 'open-plan living, kitchen and dining space' );
		$f[] = array( 'id' => 'rooms', 'category' => 'rooms', 'type' => 'rooms', 'label' => __( 'Helyiségprogram', 'autogrowehome' ), 'help' => __( 'Helyiségenként állíthatod a méretet, anyagokat és stílust. Az „Automatikus” gomb az alapadatokból javaslatot készít.', 'autogrowehome' ), 'default' => array(), 'prompt' => '' );

		/* ---------------------------------------------------------------- Belső tér */
		$f[] = array_merge(
			array( 'id' => 'interior_style', 'category' => 'interior', 'type' => 'cards', 'label' => __( 'Belső stílus (egész ház)', 'autogrowehome' ), 'help' => __( 'Helyiségenként felülírható.', 'autogrowehome' ), 'default' => 'warm_neutral', 'prompt' => '{value} interior design' ),
			self::opts( self::interior_styles() )
		);
		$f[] = array( 'id' => 'interior_style_custom', 'category' => 'interior', 'type' => 'text', 'label' => __( 'Egyedi belső stílus', 'autogrowehome' ), 'help' => '', 'default' => '', 'max' => 200, 'show_if' => array( 'field' => 'interior_style', 'op' => '=', 'value' => 'custom' ), 'prompt' => 'interior described as: {value}' );
		$f[] = array( 'id' => 'wall_color', 'category' => 'interior', 'type' => 'color', 'label' => __( 'Általános falszín', 'autogrowehome' ), 'help' => '', 'default' => '#F4F1EC', 'prompt' => 'walls painted {color}' );
		$f[] = array_merge(
			array( 'id' => 'ceiling', 'category' => 'interior', 'type' => 'select', 'label' => __( 'Mennyezet', 'autogrowehome' ), 'help' => '', 'default' => 'flat', 'advanced' => true, 'prompt' => '{value} ceiling' ),
			self::opts(
				array(
					'flat'    => array( __( 'Sík, festett', 'autogrowehome' ), 'flat white' ),
					'beams'   => array( __( 'Látszó gerendás', 'autogrowehome' ), 'exposed timber beam' ),
					'vaulted' => array( __( 'Szarufáig nyitott', 'autogrowehome' ), 'vaulted open-to-rafters' ),
					'cove'    => array( __( 'Rejtett fénysávos', 'autogrowehome' ), 'flat with recessed cove lighting' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'lighting', 'category' => 'interior', 'type' => 'select', 'label' => __( 'Világítás jellege', 'autogrowehome' ), 'help' => '', 'default' => 'warm_layered', 'prompt' => '{value} lighting' ),
			self::opts(
				array(
					'warm_layered' => array( __( 'Meleg, rétegzett', 'autogrowehome' ), 'warm layered' ),
					'minimal'      => array( __( 'Minimál, rejtett', 'autogrowehome' ), 'minimal concealed' ),
					'statement'    => array( __( 'Látványos függesztékek', 'autogrowehome' ), 'statement pendant' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'furniture_style', 'category' => 'interior', 'type' => 'select', 'label' => __( 'Bútorozási stílus', 'autogrowehome' ), 'help' => '', 'default' => 'contemporary', 'prompt' => '{value} furniture' ),
			self::opts(
				array(
					'contemporary' => array( __( 'Kortárs', 'autogrowehome' ), 'contemporary' ),
					'mid_century'  => array( __( 'Mid-century', 'autogrowehome' ), 'mid-century modern' ),
					'classic'      => array( __( 'Klasszikus', 'autogrowehome' ), 'classic' ),
					'rustic'       => array( __( 'Rusztikus', 'autogrowehome' ), 'rustic solid wood' ),
					'luxury'       => array( __( 'Luxus', 'autogrowehome' ), 'luxury designer' ),
				)
			)
		);
		$f[] = array( 'id' => 'furniture_color', 'category' => 'interior', 'type' => 'color', 'label' => __( 'Bútorok fő színe', 'autogrowehome' ), 'help' => '', 'default' => '#D8CCBB', 'advanced' => true, 'prompt' => 'upholstery in {color}' );
		$f[] = array( 'id' => 'decor', 'category' => 'interior', 'type' => 'toggle', 'label' => __( 'Dekoráció, növények', 'autogrowehome' ), 'help' => '', 'default' => true, 'advanced' => true, 'prompt' => 'tasteful decor and indoor plants' );
		$f[] = array( 'id' => 'curtains', 'category' => 'interior', 'type' => 'toggle', 'label' => __( 'Függönyök', 'autogrowehome' ), 'help' => '', 'default' => true, 'advanced' => true, 'prompt' => 'sheer linen curtains' );

		/* ---------------------------------------------------------------- Konyha */
		$f[] = array_merge(
			array( 'id' => 'kitchen_layout', 'category' => 'kitchen', 'type' => 'cards', 'label' => __( 'Konyhaelrendezés', 'autogrowehome' ), 'help' => '', 'default' => 'island', 'prompt' => '{value} kitchen' ),
			self::opts(
				array(
					'straight' => array( __( 'Egyenes', 'autogrowehome' ), 'single-wall' ),
					'l'        => array( __( 'L alakú', 'autogrowehome' ), 'L-shaped' ),
					'u'        => array( __( 'U alakú', 'autogrowehome' ), 'U-shaped' ),
					'island'   => array( __( 'Szigetes', 'autogrowehome' ), 'large island' ),
					'galley'   => array( __( 'Kétsoros', 'autogrowehome' ), 'galley' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'worktop', 'category' => 'kitchen', 'type' => 'select', 'label' => __( 'Munkalap anyaga', 'autogrowehome' ), 'help' => '', 'default' => 'quartz', 'prompt' => '{value} worktop' ),
			self::opts(
				array(
					'quartz'  => array( __( 'Kvarc kompozit', 'autogrowehome' ), 'quartz composite' ),
					'granite' => array( __( 'Gránit', 'autogrowehome' ), 'granite' ),
					'ceramic' => array( __( 'Kerámia', 'autogrowehome' ), 'sintered ceramic' ),
					'wood'    => array( __( 'Tömörfa', 'autogrowehome' ), 'solid oak' ),
					'laminate'=> array( __( 'Laminált', 'autogrowehome' ), 'laminate' ),
				)
			)
		);
		$f[] = array( 'id' => 'worktop_color', 'category' => 'kitchen', 'type' => 'color', 'label' => __( 'Munkalap színe', 'autogrowehome' ), 'help' => '', 'default' => '#EDEBE6', 'advanced' => true, 'prompt' => 'worktop colour {color}' );
		$f[] = array_merge(
			array( 'id' => 'fronts', 'category' => 'kitchen', 'type' => 'select', 'label' => __( 'Frontok', 'autogrowehome' ), 'help' => '', 'default' => 'matt_lacquer', 'prompt' => '{value} cabinet fronts' ),
			self::opts(
				array(
					'matt_lacquer' => array( __( 'Matt lakk', 'autogrowehome' ), 'matte lacquer' ),
					'wood_veneer'  => array( __( 'Furnér', 'autogrowehome' ), 'oak veneer' ),
					'shaker'       => array( __( 'Keretes (shaker)', 'autogrowehome' ), 'shaker-style' ),
					'gloss'        => array( __( 'Magasfényű', 'autogrowehome' ), 'high-gloss' ),
					'fenix'        => array( __( 'Ujjlenyomat-mentes nano', 'autogrowehome' ), 'super-matte nano-laminate' ),
				)
			)
		);
		$f[] = array( 'id' => 'fronts_color', 'category' => 'kitchen', 'type' => 'color', 'label' => __( 'Frontok színe', 'autogrowehome' ), 'help' => '', 'default' => '#E9E4DC', 'prompt' => 'cabinet colour {color}' );
		$f[] = array_merge(
			array( 'id' => 'handles', 'category' => 'kitchen', 'type' => 'select', 'label' => __( 'Fogantyúk', 'autogrowehome' ), 'help' => '', 'default' => 'handleless', 'advanced' => true, 'prompt' => '{value}' ),
			self::opts(
				array(
					'handleless' => array( __( 'Fogantyú nélküli', 'autogrowehome' ), 'handleless push-to-open' ),
					'bar_black'  => array( __( 'Fekete rúd', 'autogrowehome' ), 'slim black bar handles' ),
					'brass'      => array( __( 'Sárgaréz', 'autogrowehome' ), 'brushed brass handles' ),
					'knobs'      => array( __( 'Gombfogantyú', 'autogrowehome' ), 'round knobs' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'appliances', 'category' => 'kitchen', 'type' => 'multiselect', 'label' => __( 'Beépített gépek', 'autogrowehome' ), 'help' => '', 'default' => array( 'oven', 'hob', 'dishwasher', 'fridge' ), 'advanced' => true, 'prompt' => 'integrated {value}' ),
			self::opts(
				array(
					'oven'       => array( __( 'Sütő', 'autogrowehome' ), 'oven' ),
					'hob'        => array( __( 'Indukciós főzőlap', 'autogrowehome' ), 'induction hob' ),
					'hood_hidden'=> array( __( 'Rejtett páraelszívó', 'autogrowehome' ), 'hidden extractor' ),
					'dishwasher' => array( __( 'Mosogatógép', 'autogrowehome' ), 'dishwasher' ),
					'fridge'     => array( __( 'Beépített hűtő', 'autogrowehome' ), 'built-in fridge' ),
					'side_by_side' => array( __( 'Side-by-side hűtő', 'autogrowehome' ), 'side-by-side fridge' ),
					'wine'       => array( __( 'Borhűtő', 'autogrowehome' ), 'wine fridge' ),
					'coffee'     => array( __( 'Beépített kávégép', 'autogrowehome' ), 'built-in coffee machine' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'sink', 'category' => 'kitchen', 'type' => 'select', 'label' => __( 'Mosogató', 'autogrowehome' ), 'help' => '', 'default' => 'undermount', 'advanced' => true, 'prompt' => '{value} sink' ),
			self::opts(
				array(
					'undermount' => array( __( 'Alulragasztott', 'autogrowehome' ), 'undermount' ),
					'composite'  => array( __( 'Gránit kompozit', 'autogrowehome' ), 'black composite' ),
					'farmhouse'  => array( __( 'Farmhouse kerámia', 'autogrowehome' ), 'ceramic farmhouse' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'backsplash', 'category' => 'kitchen', 'type' => 'select', 'label' => __( 'Hátfal', 'autogrowehome' ), 'help' => '', 'default' => 'worktop_material', 'advanced' => true, 'prompt' => 'backsplash in {value}' ),
			self::opts(
				array(
					'worktop_material' => array( __( 'Munkalappal egyező', 'autogrowehome' ), 'the same material as the worktop' ),
					'tiles'   => array( __( 'Csempe', 'autogrowehome' ), 'handmade zellige tiles' ),
					'glass'   => array( __( 'Üveg', 'autogrowehome' ), 'back-painted glass' ),
					'mirror'  => array( __( 'Tükör', 'autogrowehome' ), 'tinted mirror' ),
				)
			)
		);
		$f[] = array( 'id' => 'pantry_link', 'category' => 'kitchen', 'type' => 'toggle', 'label' => __( 'Kamrakapcsolat', 'autogrowehome' ), 'help' => __( 'A kamra a konyhából nyílik.', 'autogrowehome' ), 'default' => true, 'advanced' => true, 'prompt' => '' );

		/* ---------------------------------------------------------------- Fürdő */
		$f[] = array_merge(
			array( 'id' => 'bath_fixtures', 'category' => 'bathroom', 'type' => 'multiselect', 'label' => __( 'Szaniterek', 'autogrowehome' ), 'help' => '', 'default' => array( 'walkin', 'double_basin', 'wc' ), 'prompt' => 'bathroom with {value}' ),
			self::opts(
				array(
					'bathtub'      => array( __( 'Kád', 'autogrowehome' ), 'a bathtub' ),
					'freestanding' => array( __( 'Szabadon álló kád', 'autogrowehome' ), 'a freestanding bathtub' ),
					'shower'       => array( __( 'Zuhanykabin', 'autogrowehome' ), 'a glass shower enclosure' ),
					'walkin'       => array( __( 'Walk-in zuhany', 'autogrowehome' ), 'a frameless walk-in shower' ),
					'basin'        => array( __( 'Mosdó', 'autogrowehome' ), 'a wall-hung basin' ),
					'double_basin' => array( __( 'Dupla mosdó', 'autogrowehome' ), 'a double vanity' ),
					'wc'           => array( __( 'Fali WC', 'autogrowehome' ), 'a wall-hung toilet' ),
					'bidet'        => array( __( 'Bidé', 'autogrowehome' ), 'a bidet' ),
					'towel_rail'   => array( __( 'Törölközőszárító', 'autogrowehome' ), 'a heated towel rail' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'bath_tiles', 'category' => 'bathroom', 'type' => 'select', 'label' => __( 'Burkolat', 'autogrowehome' ), 'help' => '', 'default' => 'large_stone', 'prompt' => '{value}' ),
			self::opts(
				array(
					'large_stone' => array( __( 'Nagyméretű kőhatású lap', 'autogrowehome' ), 'large-format stone-look porcelain tiles' ),
					'microcement' => array( __( 'Mikrocement', 'autogrowehome' ), 'seamless microcement' ),
					'terrazzo'    => array( __( 'Terrazzo', 'autogrowehome' ), 'terrazzo' ),
					'marble'      => array( __( 'Márványhatás', 'autogrowehome' ), 'marble-look porcelain' ),
					'zellige'     => array( __( 'Kézműves csempe', 'autogrowehome' ), 'handmade glazed tiles' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'taps', 'category' => 'bathroom', 'type' => 'select', 'label' => __( 'Csaptelepek', 'autogrowehome' ), 'help' => '', 'default' => 'black', 'prompt' => '{value} taps and fittings' ),
			self::opts(
				array(
					'chrome'  => array( __( 'Króm', 'autogrowehome' ), 'chrome' ),
					'black'   => array( __( 'Matt fekete', 'autogrowehome' ), 'matte black' ),
					'brass'   => array( __( 'Szálcsiszolt arany', 'autogrowehome' ), 'brushed brass' ),
					'steel'   => array( __( 'Inox', 'autogrowehome' ), 'brushed steel' ),
				)
			)
		);
		$f[] = array( 'id' => 'bath_mirror', 'category' => 'bathroom', 'type' => 'toggle', 'label' => __( 'Világító tükör', 'autogrowehome' ), 'help' => '', 'default' => true, 'advanced' => true, 'prompt' => 'backlit mirror' );
		$f[] = array( 'id' => 'bath_storage', 'category' => 'bathroom', 'type' => 'toggle', 'label' => __( 'Rejtett tárolók, fülkék', 'autogrowehome' ), 'help' => '', 'default' => true, 'advanced' => true, 'prompt' => 'recessed storage niches' );
		$f[] = array( 'id' => 'bath_color', 'category' => 'bathroom', 'type' => 'color', 'label' => __( 'Fürdő fő színe', 'autogrowehome' ), 'help' => '', 'default' => '#D9D4CC', 'advanced' => true, 'prompt' => 'bathroom palette around {color}' );

		/* ---------------------------------------------------------------- Burkolatok */
		$f[] = array_merge(
			array( 'id' => 'floor_main', 'category' => 'surfaces', 'type' => 'cards', 'label' => __( 'Fő padlóburkolat', 'autogrowehome' ), 'help' => __( 'Nappali, étkező és a nyitott terek; a többi helyiség alább külön is megadható.', 'autogrowehome' ), 'default' => 'parquet', 'prompt' => '{value} floors in living areas' ),
			self::opts(
				array(
					'parquet'     => array( __( 'Parketta', 'autogrowehome' ), 'wide-plank natural oak parquet' ),
					'herringbone' => array( __( 'Halszálkás parketta', 'autogrowehome' ), 'herringbone oak parquet' ),
					'chevron'     => array( __( 'Francia halszálka', 'autogrowehome' ), 'chevron (French herringbone) oak parquet' ),
					'laminate'    => array( __( 'Laminált', 'autogrowehome' ), 'oak-look laminate' ),
					'vinyl'       => array( __( 'Vinyl', 'autogrowehome' ), 'wood-look vinyl' ),
					'wood_tile'   => array( __( 'Fahatású járólap', 'autogrowehome' ), 'wood-look porcelain plank tiles' ),
					'tiles_large' => array( __( 'Nagyméretű lap', 'autogrowehome' ), 'large-format porcelain tiles' ),
					'marble'      => array( __( 'Márvány', 'autogrowehome' ), 'polished white marble slabs' ),
					'stone'       => array( __( 'Természetes kő', 'autogrowehome' ), 'natural limestone' ),
					'travertine'  => array( __( 'Travertin', 'autogrowehome' ), 'honed travertine' ),
					'terrazzo'    => array( __( 'Terrazzo', 'autogrowehome' ), 'terrazzo' ),
					'microcement' => array( __( 'Mikrocement', 'autogrowehome' ), 'microcement' ),
					'concrete'    => array( __( 'Betonhatású', 'autogrowehome' ), 'polished concrete-look' ),
				)
			)
		);
		$f[] = array( 'id' => 'floor_color', 'category' => 'surfaces', 'type' => 'color', 'label' => __( 'Padló árnyalata', 'autogrowehome' ), 'help' => '', 'default' => '#C9A57C', 'prompt' => 'floor tone {color}' );
		/* Floors per room group: "same" keeps the main floor; the prompt picks the right one per room. */
		$f[] = array_merge(
			array( 'id' => 'floor_bedrooms', 'category' => 'surfaces', 'type' => 'cards', 'label' => __( 'Hálószobák padlója', 'autogrowehome' ), 'help' => '', 'default' => 'same', 'prompt' => '' ),
			self::opts(
				array(
					'same'        => array( __( 'Mint a fő padló', 'autogrowehome' ), '' ),
					'parquet'     => array( __( 'Parketta', 'autogrowehome' ), 'wide-plank natural oak parquet' ),
					'herringbone' => array( __( 'Halszálkás parketta', 'autogrowehome' ), 'herringbone oak parquet' ),
					'chevron'     => array( __( 'Francia halszálka', 'autogrowehome' ), 'chevron oak parquet' ),
					'laminate'    => array( __( 'Laminált', 'autogrowehome' ), 'oak-look laminate' ),
					'vinyl'       => array( __( 'Vinyl', 'autogrowehome' ), 'wood-look vinyl' ),
					'carpet'      => array( __( 'Szőnyegpadló', 'autogrowehome' ), 'soft wall-to-wall wool carpet' ),
					'cork'        => array( __( 'Parafa', 'autogrowehome' ), 'natural cork flooring' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'floor_kitchen', 'category' => 'surfaces', 'type' => 'cards', 'label' => __( 'Konyha padlója', 'autogrowehome' ), 'help' => '', 'default' => 'same', 'prompt' => '' ),
			self::opts(
				array(
					'same'         => array( __( 'Mint a fő padló', 'autogrowehome' ), '' ),
					'tiles_large'  => array( __( 'Nagyméretű lap', 'autogrowehome' ), 'large-format porcelain tiles' ),
					'wood_tile'    => array( __( 'Fahatású járólap', 'autogrowehome' ), 'wood-look porcelain plank tiles' ),
					'stone'        => array( __( 'Természetes kő', 'autogrowehome' ), 'natural limestone' ),
					'marble'       => array( __( 'Márvány', 'autogrowehome' ), 'polished marble' ),
					'terrazzo'     => array( __( 'Terrazzo', 'autogrowehome' ), 'terrazzo' ),
					'cement_tiles' => array( __( 'Mintás cementlap', 'autogrowehome' ), 'patterned encaustic cement tiles' ),
					'microcement'  => array( __( 'Mikrocement', 'autogrowehome' ), 'microcement' ),
					'vinyl'        => array( __( 'Vinyl', 'autogrowehome' ), 'wood-look vinyl' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'floor_entry', 'category' => 'surfaces', 'type' => 'cards', 'label' => __( 'Előtér és közlekedő padlója', 'autogrowehome' ), 'help' => '', 'default' => 'same', 'prompt' => '' ),
			self::opts(
				array(
					'same'         => array( __( 'Mint a fő padló', 'autogrowehome' ), '' ),
					'tiles_large'  => array( __( 'Nagyméretű lap', 'autogrowehome' ), 'large-format porcelain tiles' ),
					'wood_tile'    => array( __( 'Fahatású járólap', 'autogrowehome' ), 'wood-look porcelain plank tiles' ),
					'stone'        => array( __( 'Természetes kő', 'autogrowehome' ), 'natural limestone' ),
					'marble'       => array( __( 'Márvány', 'autogrowehome' ), 'polished marble' ),
					'terrazzo'     => array( __( 'Terrazzo', 'autogrowehome' ), 'terrazzo' ),
					'cement_tiles' => array( __( 'Mintás cementlap', 'autogrowehome' ), 'patterned encaustic cement tiles' ),
					'microcement'  => array( __( 'Mikrocement', 'autogrowehome' ), 'microcement' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'floor_wet', 'category' => 'surfaces', 'type' => 'cards', 'label' => __( 'Vizes helyiségek padlója', 'autogrowehome' ), 'help' => __( 'Fürdőszoba, WC, mosókonyha, wellness.', 'autogrowehome' ), 'default' => 'tiles', 'prompt' => '' ),
			self::opts(
				array(
					'tiles'        => array( __( 'Hidegburkolat', 'autogrowehome' ), 'porcelain tiles' ),
					'wood_tile'    => array( __( 'Fahatású járólap', 'autogrowehome' ), 'wood-look porcelain plank tiles' ),
					'marble'       => array( __( 'Márvány', 'autogrowehome' ), 'marble-look porcelain' ),
					'terrazzo'     => array( __( 'Terrazzo', 'autogrowehome' ), 'terrazzo' ),
					'cement_tiles' => array( __( 'Mintás cementlap', 'autogrowehome' ), 'patterned encaustic cement tiles' ),
					'microcement'  => array( __( 'Mikrocement', 'autogrowehome' ), 'microcement' ),
					'stone'        => array( __( 'Kő', 'autogrowehome' ), 'stone' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'wall_finish', 'category' => 'surfaces', 'type' => 'multiselect', 'label' => __( 'Falburkolatok', 'autogrowehome' ), 'help' => '', 'default' => array(), 'advanced' => true, 'prompt' => 'feature walls with {value}' ),
			self::opts(
				array(
					'slats'     => array( __( 'Fa lamellás panel', 'autogrowehome' ), 'vertical oak slat panels' ),
					'wallpaper' => array( __( 'Tapéta', 'autogrowehome' ), 'textured wallpaper' ),
					'stone'     => array( __( 'Kőburkolat', 'autogrowehome' ), 'stone cladding' ),
					'panels'    => array( __( 'Dekoratív falpanel', 'autogrowehome' ), 'decorative wall panels' ),
					'limewash'  => array( __( 'Mészfesték hatás', 'autogrowehome' ), 'limewash plaster' ),
				)
			)
		);
		$f[] = array( 'id' => 'tile_size', 'category' => 'surfaces', 'type' => 'text', 'label' => __( 'Burkolatméret', 'autogrowehome' ), 'help' => __( 'Pl. 60×120 cm.', 'autogrowehome' ), 'default' => '60×120', 'max' => 30, 'advanced' => true, 'prompt' => '' );
		$f[] = array_merge(
			array( 'id' => 'tile_pattern', 'category' => 'surfaces', 'type' => 'select', 'label' => __( 'Burkolatmintázat', 'autogrowehome' ), 'help' => '', 'default' => 'straight', 'advanced' => true, 'prompt' => '' ),
			self::opts(
				array(
					'straight' => array( __( 'Egyenes', 'autogrowehome' ), 'straight-laid' ),
					'offset'   => array( __( 'Kötésben', 'autogrowehome' ), 'offset-laid' ),
					'herring'  => array( __( 'Halszálka', 'autogrowehome' ), 'herringbone' ),
				)
			)
		);
		$f[] = array( 'id' => 'grout_color', 'category' => 'surfaces', 'type' => 'color', 'label' => __( 'Fugaszín', 'autogrowehome' ), 'help' => '', 'default' => '#BDB6AC', 'advanced' => true, 'prompt' => '' );
		$f[] = array( 'id' => 'skirting', 'category' => 'surfaces', 'type' => 'toggle', 'label' => __( 'Rejtett / falsíkba süllyesztett szegély', 'autogrowehome' ), 'help' => '', 'default' => false, 'advanced' => true, 'prompt' => 'flush shadow-gap skirting' );

		/* ---------------------------------------------------------------- Kert */
		$f[] = array_merge(
			array( 'id' => 'garden_style', 'category' => 'garden', 'type' => 'cards', 'label' => __( 'Kert stílusa', 'autogrowehome' ), 'help' => __( 'A háztól függően harmonizál.', 'autogrowehome' ), 'default' => 'natural', 'prompt' => '{value} landscaping' ),
			self::opts(
				array(
					'natural'   => array( __( 'Természetközeli', 'autogrowehome' ), 'naturalistic with ornamental grasses and perennials' ),
					'formal'    => array( __( 'Rendezett, formális', 'autogrowehome' ), 'formal clipped' ),
					'minimal'   => array( __( 'Minimál', 'autogrowehome' ), 'minimal architectural' ),
					'cottage'   => array( __( 'Vidéki virágos', 'autogrowehome' ), 'cottage flower' ),
					'mediterranean' => array( __( 'Mediterrán', 'autogrowehome' ), 'Mediterranean with olive trees and lavender' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'garden_features', 'category' => 'garden', 'type' => 'multiselect', 'label' => __( 'Kerti elemek', 'autogrowehome' ), 'help' => '', 'default' => array( 'lawn', 'trees', 'paths', 'garden_lights' ), 'prompt' => 'garden with {value}' ),
			self::opts(
				array(
					'lawn'          => array( __( 'Gyep', 'autogrowehome' ), 'manicured lawn' ),
					'trees'         => array( __( 'Fák, bokrok', 'autogrowehome' ), 'young trees and shrubs' ),
					'hedge'         => array( __( 'Sövény', 'autogrowehome' ), 'hedge' ),
					'flowerbeds'    => array( __( 'Virágágyások', 'autogrowehome' ), 'flower beds' ),
					'paths'         => array( __( 'Kerti utak', 'autogrowehome' ), 'stepping-stone paths' ),
					'garden_lights' => array( __( 'Kerti világítás', 'autogrowehome' ), 'low garden lights' ),
					'pool'          => array( __( 'Medence', 'autogrowehome' ), 'a rectangular swimming pool' ),
					'pergola'       => array( __( 'Pergola', 'autogrowehome' ), 'a pergola' ),
					'outdoor_kitchen' => array( __( 'Kültéri konyha / grill', 'autogrowehome' ), 'an outdoor kitchen with grill' ),
					'firepit'       => array( __( 'Tűzrakóhely', 'autogrowehome' ), 'a fire pit' ),
					'playground'    => array( __( 'Játszótér', 'autogrowehome' ), 'a small play area' ),
					'shed'          => array( __( 'Kerti tároló', 'autogrowehome' ), 'a garden shed' ),
					'robot_mower'   => array( __( 'Robotfűnyíró-garázs', 'autogrowehome' ), 'a robot-mower garage' ),
					'outdoor_shower'=> array( __( 'Kültéri zuhany', 'autogrowehome' ), 'an outdoor shower' ),
					'irrigation'    => array( __( 'Öntözőrendszer', 'autogrowehome' ), '' ),
					'rainwater'     => array( __( 'Esővízgyűjtés', 'autogrowehome' ), 'a rainwater tank' ),
					'garden_furniture' => array( __( 'Kerti bútorok', 'autogrowehome' ), 'outdoor furniture' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'terrace_floor', 'category' => 'garden', 'type' => 'select', 'label' => __( 'Teraszburkolat', 'autogrowehome' ), 'help' => '', 'default' => 'wpc', 'prompt' => 'terrace decking in {value}' ),
			self::opts(
				array(
					'wpc'     => array( __( 'WPC / fa hatású', 'autogrowehome' ), 'warm wood-look composite' ),
					'wood'    => array( __( 'Fa', 'autogrowehome' ), 'hardwood' ),
					'stone'   => array( __( 'Kőlap', 'autogrowehome' ), 'large stone slabs' ),
					'ceramic' => array( __( 'Kültéri kerámia', 'autogrowehome' ), '2 cm outdoor porcelain' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'driveway', 'category' => 'garden', 'type' => 'select', 'label' => __( 'Kocsibeálló / bejáró', 'autogrowehome' ), 'help' => '', 'default' => 'pavers', 'prompt' => 'driveway in {value}' ),
			self::opts(
				array(
					'pavers'   => array( __( 'Térkő', 'autogrowehome' ), 'large grey concrete pavers' ),
					'gravel'   => array( __( 'Kavics', 'autogrowehome' ), 'gravel' ),
					'grass'    => array( __( 'Gyephézagos', 'autogrowehome' ), 'grass pavers' ),
					'asphalt'  => array( __( 'Aszfalt', 'autogrowehome' ), 'asphalt' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'fence', 'category' => 'garden', 'type' => 'select', 'label' => __( 'Kerítés', 'autogrowehome' ), 'help' => '', 'default' => 'slats', 'prompt' => '{value} fence' ),
			self::opts(
				array(
					'none'   => array( __( 'Nincs', 'autogrowehome' ), 'no' ),
					'slats'  => array( __( 'Lamellás fém/fa', 'autogrowehome' ), 'horizontal slatted' ),
					'mesh'   => array( __( 'Drótháló + sövény', 'autogrowehome' ), 'discreet mesh with hedge' ),
					'masonry'=> array( __( 'Falazott', 'autogrowehome' ), 'rendered masonry' ),
					'gabion' => array( __( 'Gabion', 'autogrowehome' ), 'gabion stone' ),
				)
			)
		);
		$f[] = array( 'id' => 'gate', 'category' => 'garden', 'type' => 'toggle', 'label' => __( 'Kapu és gyalogosbejárat', 'autogrowehome' ), 'help' => '', 'default' => true, 'advanced' => true, 'prompt' => 'matching driveway gate and pedestrian gate' );
		$f[] = array( 'id' => 'neighbors', 'category' => 'garden', 'type' => 'toggle', 'label' => __( 'Környező épületek látszódjanak', 'autogrowehome' ), 'help' => '', 'default' => false, 'advanced' => true, 'prompt' => 'neighbouring houses softly visible in the background' );

		/* ---------------------------------------------------------------- Energia */
		$f[] = array_merge(
			array( 'id' => 'energy', 'category' => 'energy', 'type' => 'multiselect', 'label' => __( 'Gépészeti igények', 'autogrowehome' ), 'help' => __( 'Igényfelmérési adatok. A rendszer nem állít ki energetikai besorolást.', 'autogrowehome' ), 'default' => array( 'heat_pump', 'underfloor' ), 'prompt' => '' ),
			self::opts(
				array(
					'heat_pump'   => array( __( 'Hőszivattyú', 'autogrowehome' ), 'a discreet heat-pump outdoor unit' ),
					'underfloor'  => array( __( 'Padlófűtés', 'autogrowehome' ), '' ),
					'ceiling_cool'=> array( __( 'Mennyezeti hűtés', 'autogrowehome' ), '' ),
					'ac'          => array( __( 'Klíma', 'autogrowehome' ), '' ),
					'solar'       => array( __( 'Napelem', 'autogrowehome' ), '' ),
					'battery'     => array( __( 'Energiatároló', 'autogrowehome' ), '' ),
					'ev_charger'  => array( __( 'Elektromosautó-töltő', 'autogrowehome' ), 'a wall-mounted EV charger near the parking' ),
					'mvhr'        => array( __( 'Hővisszanyerős szellőzés', 'autogrowehome' ), '' ),
					'rainwater'   => array( __( 'Esővízhasznosítás', 'autogrowehome' ), '' ),
					'smart_home'  => array( __( 'Okosotthon', 'autogrowehome' ), '' ),
					'led'         => array( __( 'Energiatakarékos világítás', 'autogrowehome' ), '' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'ac_units', 'category' => 'energy', 'type' => 'select', 'label' => __( 'Klíma / hőszivattyú külső egysége', 'autogrowehome' ), 'help' => '', 'default' => 'none', 'advanced' => true, 'prompt' => '{value}' ),
			self::opts(
				array(
							'none' => array( __( 'Nem látszik', 'autogrowehome' ), '' ),
							'wall' => array( __( 'Falra szerelt, konzolon', 'autogrowehome' ), 'a wall-bracket air-conditioning outdoor unit on the side wall' ),
							'ground' => array( __( 'Földön álló, alapon', 'autogrowehome' ), 'a ground-standing heat-pump outdoor unit on a base' ),
							'screened' => array( __( 'Lamellás takarással', 'autogrowehome' ), 'an outdoor unit hidden behind a timber slat screen' ),
							'roof' => array( __( 'Lapostetőn', 'autogrowehome' ), 'an outdoor unit on the flat roof behind the parapet' ),
				)
			)
		);

		/* ---------------------------------------------------------------- Scene */
		$f[] = array_merge(
			array( 'id' => 'time_of_day', 'category' => 'scene', 'type' => 'cards', 'label' => __( 'Napszak', 'autogrowehome' ), 'help' => '', 'default' => 'golden', 'prompt' => '{value}' ),
			self::opts(
				array(
					'morning' => array( __( 'Reggel', 'autogrowehome' ), 'soft morning light' ),
					'midday'  => array( __( 'Napközben', 'autogrowehome' ), 'bright diffuse daylight' ),
					'golden'  => array( __( 'Naplemente', 'autogrowehome' ), 'warm golden-hour light' ),
					'blue'    => array( __( 'Kék óra', 'autogrowehome' ), 'blue hour dusk with interior lights on' ),
					'night'   => array( __( 'Éjszaka', 'autogrowehome' ), 'night scene with architectural lighting' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'season', 'category' => 'scene', 'type' => 'select', 'label' => __( 'Évszak', 'autogrowehome' ), 'help' => '', 'default' => 'summer', 'prompt' => '{value} season' ),
			self::opts(
				array(
					'spring' => array( __( 'Tavasz', 'autogrowehome' ), 'late spring' ),
					'summer' => array( __( 'Nyár', 'autogrowehome' ), 'early summer' ),
					'autumn' => array( __( 'Ősz', 'autogrowehome' ), 'golden autumn' ),
					'winter' => array( __( 'Tél', 'autogrowehome' ), 'crisp winter with light snow' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'weather', 'category' => 'scene', 'type' => 'select', 'label' => __( 'Időjárás, felhőzet', 'autogrowehome' ), 'help' => '', 'default' => 'few_clouds', 'prompt' => '{value}' ),
			self::opts(
				array(
					'clear'      => array( __( 'Derült', 'autogrowehome' ), 'clear sky' ),
					'few_clouds' => array( __( 'Gomolyfelhős', 'autogrowehome' ), 'a few soft clouds' ),
					'overcast'   => array( __( 'Borult, szórt fény', 'autogrowehome' ), 'soft overcast sky' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'camera', 'category' => 'scene', 'type' => 'select', 'label' => __( 'Fő kép kameraállása', 'autogrowehome' ), 'help' => '', 'default' => 'three_quarter', 'advanced' => true, 'prompt' => '{value}' ),
			self::opts(
				array(
					'three_quarter' => array( __( 'Háromnegyed nézet', 'autogrowehome' ), 'three-quarter view from the garden' ),
					'frontal'       => array( __( 'Szemből', 'autogrowehome' ), 'frontal symmetrical view' ),
					'low'           => array( __( 'Alacsony, monumentális', 'autogrowehome' ), 'low-angle view' ),
					'elevated'      => array( __( 'Enyhén magasról', 'autogrowehome' ), 'slightly elevated view' ),
				)
			)
		);
		$f[] = array_merge(
			array( 'id' => 'lens', 'category' => 'scene', 'type' => 'select', 'label' => __( 'Objektív, perspektíva', 'autogrowehome' ), 'help' => '', 'default' => '24mm', 'advanced' => true, 'prompt' => '{value}' ),
			self::opts(
				array(
					'24mm' => array( __( '24 mm, egyenes függőlegesek', 'autogrowehome' ), 'shot on a 24mm tilt-shift lens with corrected verticals' ),
					'35mm' => array( __( '35 mm, természetes', 'autogrowehome' ), 'shot on a 35mm lens, natural perspective' ),
					'50mm' => array( __( '50 mm, tömörített', 'autogrowehome' ), 'shot on a 50mm lens, compressed perspective' ),
				)
			)
		);
		$f[] = array( 'id' => 'night_lighting', 'category' => 'scene', 'type' => 'toggle', 'label' => __( 'Esti épületvilágítás', 'autogrowehome' ), 'help' => __( 'Az esti nézetben bekapcsolt fények.', 'autogrowehome' ), 'default' => true, 'advanced' => true, 'prompt' => '' );

		/* ---------------------------------------------------------------- Custom */
		$f[] = array( 'id' => 'custom_text', 'category' => 'custom', 'type' => 'textarea', 'label' => __( 'Saját instrukció', 'autogrowehome' ), 'help' => __( 'Írd le szabadon az elképzelésed. Az „AI értelmezés” gomb javaslatokat tesz a paraméterekre; a konkrét beállításaid elsőbbséget élveznek.', 'autogrowehome' ), 'default' => '', 'max' => 1500, 'prompt' => '' );

		return $f;
	}

	public static function interior_styles(): array {
		return array(
			'modern_minimal' => array( __( 'Modern minimalista', 'autogrowehome' ), 'modern minimalist' ),
			'luxury'         => array( __( 'Luxus', 'autogrowehome' ), 'refined luxury' ),
			'scandinavian'   => array( __( 'Skandináv', 'autogrowehome' ), 'Scandinavian' ),
			'japandi'        => array( __( 'Japandi', 'autogrowehome' ), 'Japandi' ),
			'classic'        => array( __( 'Klasszikus', 'autogrowehome' ), 'classic' ),
			'mediterranean'  => array( __( 'Mediterrán', 'autogrowehome' ), 'Mediterranean' ),
			'industrial'     => array( __( 'Indusztriális', 'autogrowehome' ), 'industrial' ),
			'wood_stone'     => array( __( 'Természetes fa és kő', 'autogrowehome' ), 'natural wood and stone' ),
			'warm_neutral'   => array( __( 'Meleg neutrális', 'autogrowehome' ), 'warm neutral' ),
			'monochrome'     => array( __( 'Monokróm', 'autogrowehome' ), 'monochrome' ),
			'custom'         => array( __( 'Egyedi', 'autogrowehome' ), 'custom' ),
		);
	}

	/**
	 * Room types: value => [label, prompt noun, default area m², render by default, zone (day|night|wet|service|circulation), min area].
	 */
	public static function room_types(): array {
		return array(
			'living'    => array( __( 'Nappali', 'autogrowehome' ), 'living room', 30, true, 'day', 12 ),
			'dining'    => array( __( 'Étkező', 'autogrowehome' ), 'dining area', 12, false, 'day', 6 ),
			'kitchen'   => array( __( 'Konyha', 'autogrowehome' ), 'kitchen', 12, true, 'day', 5 ),
			'living_kitchen' => array( __( 'Nappali + konyha + étkező', 'autogrowehome' ), 'open-plan living room with kitchen and dining', 45, true, 'day', 20 ),
			'master'    => array( __( 'Fő hálószoba', 'autogrowehome' ), 'master bedroom', 16, true, 'night', 10 ),
			'bedroom'   => array( __( 'Hálószoba', 'autogrowehome' ), 'bedroom', 12, false, 'night', 8 ),
			'guest'     => array( __( 'Vendégszoba', 'autogrowehome' ), 'guest bedroom', 11, false, 'night', 8 ),
			'kids'      => array( __( 'Gyerekszoba', 'autogrowehome' ), 'children\'s bedroom', 12, true, 'night', 8 ),
			'office'    => array( __( 'Dolgozószoba', 'autogrowehome' ), 'home office', 10, false, 'day', 6 ),
			'wardrobe'  => array( __( 'Gardrób', 'autogrowehome' ), 'walk-in wardrobe', 5, false, 'night', 2 ),
			'bathroom'  => array( __( 'Fürdőszoba', 'autogrowehome' ), 'bathroom', 7, true, 'wet', 3.5 ),
			'wc'        => array( __( 'Vendég-WC', 'autogrowehome' ), 'guest toilet', 2, false, 'wet', 1.2 ),
			'laundry'   => array( __( 'Mosókonyha', 'autogrowehome' ), 'laundry room', 5, false, 'service', 3 ),
			'pantry'    => array( __( 'Kamra', 'autogrowehome' ), 'pantry', 3, false, 'service', 1.5 ),
			'utility'   => array( __( 'Háztartási helyiség', 'autogrowehome' ), 'utility room', 4, false, 'service', 2 ),
			'technical' => array( __( 'Gépészeti helyiség', 'autogrowehome' ), 'technical room', 5, false, 'service', 3 ),
			'hall'      => array( __( 'Előtér', 'autogrowehome' ), 'entrance hall', 6, false, 'circulation', 3 ),
			'corridor'  => array( __( 'Közlekedő', 'autogrowehome' ), 'corridor', 6, false, 'circulation', 2 ),
			'stairs'    => array( __( 'Lépcsőház', 'autogrowehome' ), 'staircase', 8, false, 'circulation', 5 ),
			'wellness'  => array( __( 'Wellness', 'autogrowehome' ), 'wellness area', 12, false, 'wet', 6 ),
			'sauna'     => array( __( 'Szauna', 'autogrowehome' ), 'sauna', 5, false, 'wet', 3 ),
			'gym'       => array( __( 'Edzőterem', 'autogrowehome' ), 'home gym', 14, false, 'day', 8 ),
			'playroom'  => array( __( 'Játszószoba', 'autogrowehome' ), 'playroom', 12, false, 'day', 6 ),
			'wine'      => array( __( 'Borospince', 'autogrowehome' ), 'wine cellar', 8, false, 'service', 3 ),
			'custom'    => array( __( 'Egyéb helyiség', 'autogrowehome' ), 'room', 10, false, 'day', 2 ),
		);
	}
}
