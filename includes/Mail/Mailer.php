<?php
/**
 * HTML e-mails with editable subject/body templates and safe placeholders.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Mail;

use AutoGroweHome\Support\Logger;
use AutoGroweHome\Support\Settings;

defined( 'ABSPATH' ) || exit;

final class Mailer {

	public static function placeholders(): array {
		return array( '{site_name}', '{project_id}', '{concept}', '{client_name}', '{client_email}', '{client_phone}', '{city}', '{site_location}', '{start_period}', '{budget}', '{note}', '{link}', '{expires}', '{contractor_name}' );
	}

	public static function defaults(): array {
		return array(
			'contractor_subject' => __( 'Új ajánlatkérés – {project_id}', 'autogrowehome' ),
			'contractor_body'    => __( "Kedves {contractor_name}!\n\nÚj ajánlatkérés érkezett a(z) {site_name} háztervezőjéből.\n\nProjektazonosító: {project_id}\nKiválasztott koncepció: {concept}\n\nÜgyfél: {client_name}\nE-mail: {client_email}\nTelefon: {client_phone}\nTelepülés: {city}\nÉpítési helyszín: {site_location}\nTervezett kezdés: {start_period}\nKöltségkeret: {budget}\n\nMegjegyzés:\n{note}\n\nA teljes tervcsomag (látványképek, tervvázlatok, paraméterek) biztonságos, időkorlátos hivatkozáson érhető el (lejár: {expires}):\n{link}\n\nA hivatkozást ne továbbítsd harmadik félnek.", 'autogrowehome' ),
			'client_subject'     => __( 'Ajánlatkérésedet továbbítottuk – {project_id}', 'autogrowehome' ),
			'client_body'        => __( "Kedves {client_name}!\n\nKöszönjük, ajánlatkérésedet a(z) {concept} koncepcióval továbbítottuk a kivitelezőnek. Hamarosan felveszik veled a kapcsolatot.\n\nProjektazonosító: {project_id}\n\nAz adataid kezeléséről az adatkezelési tájékoztatóban olvashatsz.", 'autogrowehome' ),
		);
	}

	public static function template( string $key ): string {
		$v = (string) Settings::get( 'emails.' . $key, '' );
		return '' !== trim( $v ) ? $v : self::defaults()[ $key ];
	}

	/**
	 * Fill placeholders. Values are plain text (escaped when rendered as HTML).
	 */
	public static function fill( string $tpl, array $vars ): string {
		$map = array();
		foreach ( $vars as $k => $v ) {
			$map[ '{' . $k . '}' ] = (string) $v;
		}
		return strtr( $tpl, $map );
	}

	public static function send( string $to, string $subject, string $text_body, array $headers = array() ): bool {
		$to = sanitize_email( $to );
		if ( ! is_email( $to ) ) {
			return false;
		}
		$subject = wp_strip_all_tags( str_replace( array( "\r", "\n" ), ' ', $subject ) );
		$html    = self::wrap( $text_body );
		$from_name  = (string) Settings::get( 'emails.from_name', '' );
		$from_email = (string) Settings::get( 'emails.from_email', '' );
		$h          = array_merge( array( 'Content-Type: text/html; charset=UTF-8' ), $headers );
		if ( '' !== $from_email && is_email( $from_email ) ) {
			$h[] = 'From: ' . ( '' !== $from_name ? '"' . str_replace( array( '"', "\r", "\n" ), '', $from_name ) . '" ' : '' ) . '<' . $from_email . '>';
		}
		$ok = wp_mail( $to, $subject, $html, $h );
		if ( ! $ok ) {
			Logger::error( 'mail', 'wp_mail failed', array( 'to_domain' => substr( strrchr( $to, '@' ), 1 ) ) );
		}
		return (bool) $ok;
	}

	private static function wrap( string $text ): string {
		$brand  = (string) Settings::get( 'general.plugin_name', 'AutoGroweHome' );
		$color  = (string) Settings::get( 'branding.color_primary', '#B9824F' );
		$footer = (string) Settings::get( 'branding.footer_text', '' );
		$body   = make_clickable( nl2br( esc_html( $text ) ) );
		ob_start();
		include AGH_DIR . 'templates/emails/layout.php';
		return (string) ob_get_clean();
	}
}
