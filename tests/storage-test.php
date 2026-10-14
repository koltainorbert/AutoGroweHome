<?php
/**
 * A védett tárhely ellenőrzése valódi WordPressen (tesztoldal: bin/test-wp.sh).
 *
 * 1. szakasz (alapállapot, uploads alatt): a könyvtár írható, és a próbafájl HTTP-n elérhető –
 *    a PHP beépített szervere is figyelmen kívül hagyja a .htaccess-t, tehát pontosan az a helyzet,
 *    amit Norbi szervere (Nginx) produkál. Ebben a szakaszban készül két projekt fájlja is.
 * 2. szakasz (AGH_PRIVATE_DIR webgyökéren kívül): a könyvtárnak nincs URL-je, a health() már nem
 *    jelez, a régi helyen maradt projektek áthozhatók, és utána minden fájl olvasható az új helyről.
 *
 * Használat: php tests/storage-test.php [/path/to/test/wordpress]   (alap: /home/claude/wpsite)
 */

$agh_wp_dir = $argv[1] ?? '/home/claude/wpsite';
$agh_phase2 = getenv( 'AGH_TEST_PRIVATE' );
if ( $agh_phase2 ) {
	define( 'AGH_PRIVATE_DIR', $agh_phase2 );
}
$_SERVER['HTTP_HOST']   = '127.0.0.1:8899';
$_SERVER['REQUEST_URI'] = '/';
require $agh_wp_dir . '/wp-load.php';

use AutoGroweHome\Support\Storage;

$pass = 0;
$fail = 0;
$msg  = array();
function t( $ok, $name ) {
	global $pass, $fail, $msg;
	if ( $ok ) {
		$pass++;
	} else {
		$fail++;
		$msg[] = $name;
	}
}

$state_file = sys_get_temp_dir() . '/agh-storage-test-state.json';

if ( ! $agh_phase2 ) {
	/* ---------------------------------------------------------------- 1. szakasz: alapállapot */
	t( Storage::ensure_private_dir(), 'a védett könyvtár írható' );
	$dir = Storage::base_dir();
	t( is_dir( $dir ), 'a könyvtár létezik' );
	t( file_exists( $dir . '.htaccess' ) && file_exists( $dir . 'index.php' ), 'a védelmi fájlok megvannak' );
	t( '' !== Storage::base_url(), 'alapállapotban van URL-je (uploads alatt van)' );

	$uuids = array( wp_generate_uuid4(), wp_generate_uuid4() );
	$rels  = array();
	foreach ( $uuids as $i => $u ) {
		$rels[] = Storage::put( $u, 'renders/kep-' . $i . '.txt', 'AGH-' . $i );
		$rels[] = Storage::put( $u, 'packages/csomag-' . $i . '.txt', 'ZIP-' . $i );
	}
	t( 4 === count( array_filter( $rels, function ( $r ) { return '' !== Storage::path( $r ); } ) ), 'a 4 fájl a helyén van' );

	$h = Storage::health();
	t( true === $h['public'], 'a próbafájl HTTP-n elérhető (a tesztszerver sem olvas .htaccess-t)' );
	t( true === $h['writable'], 'health: írható' );

	// az útvonal-ellenőrzés nem enged ki a bázison kívülre
	t( '' === Storage::path( '../wp-config.php' ), 'nem enged ki ..-vel' );
	t( '' === Storage::path( '/etc/passwd' ), 'nem enged ki abszolút úttal' );
	t( 0 === Storage::stray_projects(), 'egyéni könyvtár nélkül nincs mit áthozni' );

	file_put_contents( $state_file, wp_json_encode( array( 'uuids' => $uuids, 'rels' => $rels, 'old' => $dir ) ) );

	// 2. szakasz külön folyamatban, mert a konstans csak induláskor állítható
	$priv = sys_get_temp_dir() . '/agh-private-test-' . wp_generate_password( 8, false, false ) . '/';
	mkdir( $priv, 0775, true );
	$cmd = 'AGH_TEST_PRIVATE=' . escapeshellarg( $priv ) . ' php ' . escapeshellarg( __FILE__ ) . ' ' . escapeshellarg( $agh_wp_dir );
	$out = array();
	$rc  = 0;
	exec( $cmd . ' 2>&1', $out, $rc );
	$tail = trim( (string) end( $out ) );
	echo implode( "\n", array_slice( $out, 0, -1 ) ) . ( count( $out ) > 1 ? "\n" : '' );
	echo 'tárhely 1. szakasz: ' . $pass . '/' . ( $pass + $fail ) . ( $fail ? ' – hiba: ' . implode( ', ', $msg ) : '' ) . "\n";
	echo $tail . "\n";
	@unlink( $state_file );
	exit( $fail || $rc ? 1 : 0 );
}

/* ---------------------------------------------------------------- 2. szakasz: egyéni könyvtár */
$state = json_decode( (string) file_get_contents( $state_file ), true );
t( is_array( $state ) && ! empty( $state['uuids'] ), 'az 1. szakasz állapota megvan' );

t( rtrim( Storage::base_dir(), '/' ) === rtrim( $agh_phase2, '/' ), 'a tárhely az AGH_PRIVATE_DIR-re mutat' );
t( '' === Storage::base_url(), 'nincs URL-je (webgyökéren kívül van)' );
$h = Storage::health();
t( false === $h['public'], 'health: kívülről nem elérhető' );
t( true === $h['writable'], 'health: írható' );

t( 2 === Storage::stray_projects(), 'a régi helyen 2 projekt maradt' );
$m = Storage::move_from_uploads();
t( 2 === $m['moved'] && 4 === $m['files'] && 0 === $m['failed'], 'áthozva 2 projekt, 4 fájl, 0 hiba' );
t( 0 === Storage::stray_projects(), 'a régi helyen nem maradt projekt' );
t( ! is_dir( (string) $state['old'] ), 'a kiürült régi könyvtár törlődött' );

$ok = 0;
foreach ( (array) $state['rels'] as $rel ) {
	$abs = Storage::path( $rel );
	if ( '' !== $abs && is_file( $abs ) && '' !== (string) file_get_contents( $abs ) ) {
		$ok++;
	}
}
t( 4 === $ok, 'mind a 4 fájl olvasható az új helyen' );
t( '' === Storage::path( '../../etc/passwd' ), 'az új helyen sem enged ki' );

// takarítás
foreach ( (array) $state['uuids'] as $u ) {
	Storage::delete_project( (string) $u );
}
foreach ( array( '.htaccess', 'web.config', 'index.php', 'index.html', 'agh-probe.txt' ) as $f ) {
	@unlink( Storage::base_dir() . $f );
}
@rmdir( Storage::base_dir() );
delete_option( 'agh_private_suffix' );

echo 'tárhely 2. szakasz: ' . $pass . '/' . ( $pass + $fail ) . ( $fail ? ' – hiba: ' . implode( ', ', $msg ) : '' ) . "\n";
exit( $fail ? 1 : 0 );
