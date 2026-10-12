<?php
/**
 * Stuck-project watchdog test (runs on the test site: php tests/stuck-project-test.php [wp-dir]).
 *
 * Checks that a project still marked "rendering"/"planning" without any live
 * job is finalised (no endless spinner), that a fresh or genuinely running
 * project is left alone, and that orphans do not block a new generation.
 */

$agh_wp_dir = $argv[1] ?? '/home/claude/wpsite';
define( 'WP_USE_THEMES', false );
$_SERVER['HTTP_HOST']   = '127.0.0.1:8899';
$_SERVER['REQUEST_URI'] = '/';
$_SERVER['REMOTE_ADDR'] = '203.0.113.9';
require $agh_wp_dir . '/wp-load.php';

use AutoGroweHome\Generation\JobQueue;
use AutoGroweHome\Installer;
use AutoGroweHome\Projects\Repository;

global $wpdb;
$pt   = Installer::table( 'projects' );
$jt   = Installer::table( 'jobs' );
$ok   = 0;
$fail = 0;
$check = function ( string $name, bool $cond ) use ( &$ok, &$fail ) {
	if ( $cond ) {
		$ok++;
	} else {
		$fail++;
		echo "HIBA: {$name}\n";
	}
};

$make = function ( string $status, int $age ) use ( $wpdb, $pt ) {
	$p = Repository::create_project( array( 'house_type' => 'family' ), 0, 'stucktest', 'stucktest-ip', 'hu_HU', 1 );
	$time = gmdate( 'Y-m-d H:i:s', time() - $age );
	$wpdb->update( $pt, array( 'status' => $status, 'updated_at' => $time, 'created_at' => gmdate( 'Y-m-d H:i:s', time() - min( $age, 600 ) ) ), array( 'id' => $p['id'] ) );
	return Repository::project_by_id( $p['id'] );
};

// 1. Orphan: rendering, 10 min without change, no job → failed.
$p = $make( 'rendering', 600 );
$check( 'árva projekt lezárva', JobQueue::recover_orphan( $p ) );
$check( 'árva projekt állapota failed', 'failed' === Repository::project_by_id( $p['id'] )['status'] );

// 2. Fresh project (grace period) → untouched.
$p = $make( 'planning', 10 );
$check( 'friss projekt érintetlen', ! JobQueue::recover_orphan( $p ) );
$check( 'friss projekt állapota marad', 'planning' === Repository::project_by_id( $p['id'] )['status'] );

// 3. Old but with a queued job → untouched.
$p = $make( 'rendering', 600 );
JobQueue::push( 'plan', $p['id'], array() );
$check( 'élő feladatos projekt érintetlen', ! JobQueue::recover_orphan( $p ) );
$check( 'élő feladat felismerve', JobQueue::has_live_jobs( $p['id'] ) );

// 4. Running job with an expired lock (killed worker) → not live.
$wpdb->update( $jt, array( 'status' => 'running', 'locked_until' => gmdate( 'Y-m-d H:i:s', time() - 60 ) ), array( 'project_id' => $p['id'] ) );
$check( 'lejárt zár nem élő', ! JobQueue::has_live_jobs( $p['id'] ) );
$check( 'lejárt záras projekt lezárva', JobQueue::recover_orphan( Repository::project_by_id( $p['id'] ) ) );

// 5. Finished project → never touched.
$p = $make( 'ready', 600 );
$check( 'kész projekt érintetlen', ! JobQueue::recover_orphan( $p ) );

// Cleanup.
$ids = $wpdb->get_col( "SELECT id FROM {$pt} WHERE ip_hash = 'stucktest-ip'" ); // phpcs:ignore
foreach ( $ids as $id ) {
	$wpdb->delete( $jt, array( 'project_id' => (int) $id ) );
	$wpdb->delete( $pt, array( 'id' => (int) $id ) );
}

echo "beragadt projekt: {$ok}/" . ( $ok + $fail ) . ( $fail ? ' HIBA' : ' OK' ) . "\n";
exit( $fail ? 1 : 0 );
