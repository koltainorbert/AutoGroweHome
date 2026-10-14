<?php
/**
 * Access-protected file storage for generated images, plans and packages.
 *
 * Files are kept in a non-guessable directory under uploads (or a custom path
 * outside the web root via the AGH_PRIVATE_DIR constant) protected by
 * .htaccess / web.config / index.php, and are only ever delivered through the
 * permission-checked REST file endpoint.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Support;

defined( 'ABSPATH' ) || exit;

final class Storage {

	public static function base_dir(): string {
		if ( defined( 'AGH_PRIVATE_DIR' ) && AGH_PRIVATE_DIR ) {
			return trailingslashit( (string) AGH_PRIVATE_DIR );
		}
		$suffix = get_option( 'agh_private_suffix' );
		if ( ! $suffix ) {
			$suffix = strtolower( wp_generate_password( 16, false, false ) );
			update_option( 'agh_private_suffix', $suffix, false );
		}
		$up = wp_upload_dir( null, false );
		return trailingslashit( $up['basedir'] ) . 'agh-private-' . $suffix . '/';
	}

	/**
	 * The plugin's own directory under uploads (the default place), whatever AGH_PRIVATE_DIR says.
	 * After the constant is set the files left there have to be moved; this is where they are.
	 */
	public static function uploads_dir(): string {
		$suffix = (string) get_option( 'agh_private_suffix', '' );
		if ( '' === $suffix ) {
			return '';
		}
		$up = wp_upload_dir( null, false );
		return trailingslashit( $up['basedir'] ) . 'agh-private-' . $suffix . '/';
	}

	/**
	 * Is there anything left in the old uploads directory while a custom path is in use?
	 *
	 * @return int Number of project folders still there (0: nothing to move).
	 */
	public static function stray_projects(): int {
		if ( ! defined( 'AGH_PRIVATE_DIR' ) || ! AGH_PRIVATE_DIR ) {
			return 0;
		}
		$old = self::uploads_dir();
		if ( '' === $old || ! is_dir( $old ) || rtrim( $old, '/' ) === rtrim( self::base_dir(), '/' ) ) {
			return 0;
		}
		$n = 0;
		foreach ( (array) scandir( $old ) as $e ) {
			if ( Util::is_uuid( (string) $e ) && is_dir( $old . $e ) ) {
				$n++;
			}
		}
		return $n;
	}

	/**
	 * Move the project folders left in the old uploads directory to the directory in use now.
	 * An existing file in the target is never overwritten; whatever could not be moved is counted.
	 * When the old directory is left with the protection files only, it is removed.
	 *
	 * @return array{moved:int,files:int,failed:int,removed:bool}
	 */
	public static function move_from_uploads(): array {
		$out = array( 'moved' => 0, 'files' => 0, 'failed' => 0, 'removed' => false );
		if ( ! self::stray_projects() ) {
			return $out;
		}
		$old = self::uploads_dir();
		$new = self::base_dir();
		wp_mkdir_p( $new );
		foreach ( (array) scandir( $old ) as $e ) {
			$e = (string) $e;
			if ( ! Util::is_uuid( $e ) || ! is_dir( $old . $e ) ) {
				continue;
			}
			$ok = true;
			$it = new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator( $old . $e, \FilesystemIterator::SKIP_DOTS ), \RecursiveIteratorIterator::SELF_FIRST );
			foreach ( $it as $f ) {
				$rel = substr( $f->getPathname(), strlen( $old ) );
				$dst = $new . $rel;
				if ( $f->isDir() ) {
					wp_mkdir_p( $dst );
					continue;
				}
				if ( file_exists( $dst ) ) {
					$out['failed']++;
					$ok = false;
					continue;
				}
				wp_mkdir_p( dirname( $dst ) );
				if ( @rename( $f->getPathname(), $dst ) ) { // phpcs:ignore WordPress.PHP.NoSilencedErrors
					$out['files']++;
				} elseif ( @copy( $f->getPathname(), $dst ) ) { // phpcs:ignore WordPress.PHP.NoSilencedErrors
					unlink( $f->getPathname() ); // phpcs:ignore WordPress.WP.AlternativeFunctions
					$out['files']++;
				} else {
					$out['failed']++;
					$ok = false;
				}
			}
			if ( $ok ) {
				self::rmtree_empty( $old . $e );
				$out['moved']++;
			}
		}
		// nothing of ours left: the protection files and the probe may go with the directory
		if ( ! self::stray_projects() ) {
			foreach ( array( '.htaccess', 'web.config', 'index.php', 'index.html', 'agh-probe.txt' ) as $name ) {
				if ( is_file( $old . $name ) ) {
					unlink( $old . $name ); // phpcs:ignore WordPress.WP.AlternativeFunctions
				}
			}
			$rest = array_diff( (array) scandir( $old ), array( '.', '..' ) );
			if ( ! $rest ) {
				$out['removed'] = rmdir( $old ); // phpcs:ignore WordPress.WP.AlternativeFunctions
			}
		}
		return $out;
	}

	/** Remove a directory tree that holds no files any more. */
	private static function rmtree_empty( string $dir ): void {
		if ( ! is_dir( $dir ) ) {
			return;
		}
		$it = new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator( $dir, \FilesystemIterator::SKIP_DOTS ), \RecursiveIteratorIterator::CHILD_FIRST );
		foreach ( $it as $f ) {
			if ( $f->isDir() ) {
				@rmdir( $f->getPathname() ); // phpcs:ignore
			}
		}
		@rmdir( $dir ); // phpcs:ignore
	}

	public static function base_url(): string {
		if ( defined( 'AGH_PRIVATE_DIR' ) && AGH_PRIVATE_DIR ) {
			return '';
		}
		$up = wp_upload_dir( null, false );
		return trailingslashit( $up['baseurl'] ) . 'agh-private-' . get_option( 'agh_private_suffix' ) . '/';
	}

	public static function ensure_private_dir(): bool {
		$dir = self::base_dir();
		if ( ! wp_mkdir_p( $dir ) ) {
			return false;
		}
		$files = array(
			'.htaccess'  => "# AutoGroweHome – deny direct access\n<IfModule mod_authz_core.c>\n\tRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n\tOrder deny,allow\n\tDeny from all\n</IfModule>\nOptions -Indexes\n",
			'web.config' => "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<configuration><system.webServer><authorization><deny users=\"*\" /></authorization></system.webServer></configuration>\n",
			'index.php'  => "<?php\n// Silence is golden.\nhttp_response_code( 403 );\n",
			'index.html' => '',
		);
		foreach ( $files as $name => $content ) {
			if ( ! file_exists( $dir . $name ) ) {
				file_put_contents( $dir . $name, $content ); // phpcs:ignore WordPress.WP.AlternativeFunctions
			}
		}
		file_put_contents( $dir . 'agh-probe.txt', 'agh-probe' ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		return is_writable( $dir );
	}

	/**
	 * Store binary content under a project folder.
	 *
	 * @return string Relative path.
	 */
	public static function put( string $project_uuid, string $name, string $data ): string {
		if ( ! Util::is_uuid( $project_uuid ) ) {
			throw new \InvalidArgumentException( 'Invalid project id' );
		}
		$name = preg_replace( '/[^A-Za-z0-9._-]/', '-', $name );
		$rel  = $project_uuid . '/' . $name;
		$abs  = self::base_dir() . $rel;
		wp_mkdir_p( dirname( $abs ) );
		if ( false === file_put_contents( $abs, $data, LOCK_EX ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions
			throw new \RuntimeException( 'Storage write failed' );
		}
		return $rel;
	}

	/**
	 * Resolve a relative path safely (no traversal outside the base dir).
	 */
	public static function path( string $rel ): string {
		if ( '' === $rel || false !== strpos( $rel, '..' ) || 0 === strpos( $rel, '/' ) ) {
			return '';
		}
		$abs  = self::base_dir() . $rel;
		$real = realpath( $abs );
		$base = realpath( self::base_dir() );
		if ( false === $real || false === $base || 0 !== strpos( $real, $base . DIRECTORY_SEPARATOR ) ) {
			return '';
		}
		return $real;
	}

	public static function delete_project( string $project_uuid ): void {
		if ( ! Util::is_uuid( $project_uuid ) ) {
			return;
		}
		$dir = self::base_dir() . $project_uuid;
		if ( ! is_dir( $dir ) ) {
			return;
		}
		$it = new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator( $dir, \FilesystemIterator::SKIP_DOTS ), \RecursiveIteratorIterator::CHILD_FIRST );
		foreach ( $it as $f ) {
			$f->isDir() ? rmdir( $f->getPathname() ) : unlink( $f->getPathname() ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		}
		rmdir( $dir ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	}

	/**
	 * Create a downscaled preview (JPEG) next to the original.
	 *
	 * @return array{path:string,width:int,height:int}
	 */
	public static function make_preview( string $rel, int $max_px ): array {
		$abs = self::path( $rel );
		if ( '' === $abs ) {
			return array( 'path' => '', 'width' => 0, 'height' => 0 );
		}
		$editor = wp_get_image_editor( $abs );
		if ( is_wp_error( $editor ) ) {
			return array( 'path' => '', 'width' => 0, 'height' => 0 );
		}
		$editor->resize( $max_px, $max_px, false );
		$editor->set_quality( 82 );
		$prev_rel = preg_replace( '/\.(png|jpe?g|webp)$/i', '', $rel ) . '-preview.jpg';
		$saved    = $editor->save( self::base_dir() . $prev_rel, 'image/jpeg' );
		if ( is_wp_error( $saved ) ) {
			return array( 'path' => '', 'width' => 0, 'height' => 0 );
		}
		return array( 'path' => $prev_rel, 'width' => (int) $saved['width'], 'height' => (int) $saved['height'] );
	}

	/**
	 * Self-check: is the private directory reachable over HTTP? (should be 403/404)
	 *
	 * @return array{writable:bool,public:bool|null,message:string}
	 */
	public static function health(): array {
		$writable = self::ensure_private_dir();
		$url      = self::base_url();
		if ( '' === $url ) {
			return array( 'writable' => $writable, 'public' => false, 'message' => 'Custom path outside web root.' );
		}
		$res = wp_remote_get( $url . 'agh-probe.txt', array( 'timeout' => 5, 'sslverify' => false ) );
		if ( is_wp_error( $res ) ) {
			return array( 'writable' => $writable, 'public' => null, 'message' => $res->get_error_message() );
		}
		$public = 200 === (int) wp_remote_retrieve_response_code( $res ) && false !== strpos( (string) wp_remote_retrieve_body( $res ), 'agh-probe' );
		return array( 'writable' => $writable, 'public' => $public, 'message' => '' );
	}
}
