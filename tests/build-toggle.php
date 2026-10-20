<?php
/**
 * Switches the build mode („Építés az alapoktól”) on the test site, for the E2E tests.
 *
 * Usage: php tests/build-toggle.php on|off [/path/to/test/wordpress]   (default: /home/claude/wpsite)
 * Prints the new state (build.enabled=1|0).
 */
$agh_on = ( $argv[1] ?? 'on' ) === 'on';
$agh_wp = $argv[2] ?? '/home/claude/wpsite';
$_SERVER['HTTP_HOST']   = '127.0.0.1:8899';
$_SERVER['REQUEST_URI'] = '/';
require $agh_wp . '/wp-load.php';
$s = get_option( 'agh_settings', array() );
$s = is_array( $s ) ? $s : array();
$s['build'] = array_merge( isset( $s['build'] ) && is_array( $s['build'] ) ? $s['build'] : array(), array( 'enabled' => $agh_on ) );
update_option( 'agh_settings', $s );
echo 'build.enabled=' . ( $agh_on ? '1' : '0' ) . "\n";
