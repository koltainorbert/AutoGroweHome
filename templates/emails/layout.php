<?php
/**
 * E-mail layout. Variables: $brand, $color, $footer, $body (already escaped HTML).
 *
 * @package AutoGroweHome
 */

defined( 'ABSPATH' ) || exit;
?>
<!doctype html>
<html lang="<?php echo esc_attr( get_bloginfo( 'language' ) ); ?>">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title><?php echo esc_html( $brand ); ?></title></head>
<body style="margin:0;padding:0;background:#F6F3EE;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1E2226;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F3EE;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(30,34,38,.08);">
<tr><td style="padding:28px 32px;border-bottom:1px solid #EFEAE2;">
<div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:<?php echo esc_attr( $color ); ?>;font-weight:600;"><?php echo esc_html( $brand ); ?></div>
</td></tr>
<tr><td style="padding:28px 32px;font-size:15px;line-height:1.6;"><?php echo $body; // phpcs:ignore WordPress.Security.EscapeOutput -- escaped in Mailer::wrap(). ?></td></tr>
<tr><td style="padding:18px 32px;background:#FAF8F5;font-size:12px;color:#7A7F84;"><?php echo esc_html( '' !== $footer ? $footer : get_bloginfo( 'name' ) ); ?></td></tr>
</table>
</td></tr>
</table>
</body>
</html>
