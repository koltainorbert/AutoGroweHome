/*! AutoGroweHome – admin interactions */
(function ($) {
	'use strict';
	var A = window.AGH_ADMIN || {};
	var I = A.i18n || {};
	var L = A.stats || {};
	function api(method, path, body) {
		return fetch(A.rest + path, { method: method, credentials: 'same-origin', headers: { 'X-WP-Nonce': A.nonce, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
			.then(function (r) { return r.json().then(function (d) { if (!r.ok) { throw new Error(d.message || r.status); } return d; }); });
	}
	function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

	$(function () {
		$('.agh-color-field').wpColorPicker({ change: function () { setTimeout(brandPreview, 10); } });

		$(document).on('click', '.agh-confirm', function (e) { if (!window.confirm(I.confirm)) { e.preventDefault(); } });

		$(document).on('click', '.agh-media-pick', function (e) {
			e.preventDefault();
			var wrap = $(this).closest('.agh-media');
			var frame = wp.media({ title: I.pick, button: { text: I.use }, multiple: false, library: { type: 'image' } });
			frame.on('select', function () {
				var a = frame.state().get('selection').first().toJSON();
				wrap.find('input[type=hidden]').val(a.id);
				wrap.find('img').attr('src', (a.sizes && a.sizes.thumbnail ? a.sizes.thumbnail.url : a.url)).prop('hidden', false);
			});
			frame.open();
		});
		$(document).on('click', '.agh-media-clear', function (e) { e.preventDefault(); var w = $(this).closest('.agh-media'); w.find('input[type=hidden]').val('0'); w.find('img').prop('hidden', true); });

		$('.agh-test-provider').on('click', function () {
			var b = $(this), out = $('.agh-test-result');
			b.prop('disabled', true);
			out.html('<div class="agh-r">' + esc(I.testing) + '</div>');
			api('POST', 'admin/test-provider', { provider: b.data('provider') }).then(function (r) {
				out.html('<div class="agh-r ' + (r.ok ? 'is-ok' : 'is-err') + '"><strong>' + esc(b.text()) + ':</strong> ' + esc(r.message) + '</div>');
			}).catch(function (e) { out.html('<div class="agh-r is-err">' + esc(e.message) + '</div>'); }).then(function () { b.prop('disabled', false); });
		});

		$('#agh-prompt-preview').on('click', function () {
			$('#agh-prompt-out').text(I.running);
			api('POST', 'admin/prompt/preview', { view: $('#agh-prompt-view').val(), version: parseInt($('#agh-prompt-version').val(), 10) }).then(function (r) {
				$('#agh-prompt-out').text('v' + r.version + ' · ' + r.length + ' chars\n\n' + r.prompt + (r.negative ? '\n\n' + r.negative : ''));
			}).catch(function (e) { $('#agh-prompt-out').text(e.message); });
		});
		$('#agh-prompt-test').on('click', function () {
			if (!window.confirm(I.confirm)) { return; }
			api('POST', 'admin/prompt/test', { version: parseInt($('#agh-prompt-version').val(), 10) }).then(function (r) {
				$('#agh-prompt-out').html(esc(I.started) + ' <a href="' + esc(r.admin_url) + '">' + esc(r.project) + '</a>');
			}).catch(function (e) { $('#agh-prompt-out').text(e.message); });
		});
		$('.agh-compare-link').on('click', function (e) {
			e.preventDefault();
			var v = $(this).data('version');
			var views = ['hero', 'front', 'interior'];
			var out = $('#agh-compare-out').html('');
			views.forEach(function (view) {
				api('POST', 'admin/prompt/preview', { view: view, version: v }).then(function (r) { out.append('<h4>v' + esc(v) + ' · ' + esc(view) + '</h4><pre class="agh-pre">' + esc(r.prompt) + '</pre>'); });
			});
		});

		$('.agh-table-filter').on('input', function () {
			var q = this.value.toLowerCase();
			$(this).next('.agh-filterable').find('tbody tr').each(function () { $(this).toggle($(this).text().toLowerCase().indexOf(q) !== -1); });
		});

		$('.agh-row-add').on('click', function () {
			var name = $(this).data('target');
			var box = $('.agh-rows[data-name="' + name + '"]');
			var i = Date.now();
			var html = name === 'tour'
				? '<div class="agh-row"><input type="text" name="tour[' + i + '][icon]" style="width:90px" placeholder="icon"><input type="text" name="tour[' + i + '][title]" class="regular-text"><textarea name="tour[' + i + '][text]" rows="2" class="large-text"></textarea><button type="button" class="button-link agh-row-del">×</button></div>'
				: '<div class="agh-row"><input type="text" name="faq[' + i + '][cat]" style="width:140px"><input type="text" name="faq[' + i + '][q]" class="regular-text"><textarea name="faq[' + i + '][a]" rows="2" class="large-text"></textarea><button type="button" class="button-link agh-row-del">×</button></div>';
			box.append(html);
		});
		$(document).on('click', '.agh-row-del', function () { $(this).closest('.agh-row').remove(); });

		function brandPreview() {
			var p = document.getElementById('agh-brand-preview');
			if (!p) { return; }
			var g = function (k) { var el = document.getElementById('agh-branding-' + k); return el ? el.value : ''; };
			if (g('color_primary')) { p.style.setProperty('--bp-primary', g('color_primary')); }
			if (g('color_bg')) { p.style.setProperty('--bp-bg', g('color_bg')); }
			if (g('color_ink')) { p.style.setProperty('--bp-ink', g('color_ink')); }
			if (g('radius')) { p.style.setProperty('--bp-r', g('radius') + 'px'); }
			if (g('blur')) { p.style.setProperty('--bp-blur', g('blur') + 'px'); }
			var f = g('font_heading'); if (f) { p.querySelector('.agh-bp-title').style.fontFamily = f; }
		}
		$(document).on('input change', '[id^="agh-branding-"]', brandPreview);
		brandPreview();

		var st = document.getElementById('agh-stats');
		if (st) { loadStats(st); }
	});

	function loadStats(el) {
		api('GET', 'admin/stats' + (A.rest.indexOf('?') === -1 ? '?' : '&') + 'from=' + el.getAttribute('data-from') + '&to=' + el.getAttribute('data-to')).then(function (d) {
			var t = d.totals, dv = d.derived, cur = d.currency;
			var n = function (v, dig) { return v === null || v === undefined ? '–' : Number(v).toLocaleString(undefined, { maximumFractionDigits: dig === undefined ? 0 : dig }); };
			var cards = [
				[L.popup_open, n(t.popup_open)], [L.design_start, n(t.design_start)], [L.generate, n(t.generate_request)], [L.concepts, n(t.concepts_ready)],
				[L.selected, n(t.design_complete)], [L.saved, n(t.project_saved)], [L.quotes, n(t.quote_submitted)], [L.conversion, dv.quote_conversion === null ? '–' : n(dv.quote_conversion, 1) + '%'],
				[L.images, n(t.image_ok) + ' / ' + n(t.image_fail)], [L.success_rate, dv.image_success_rate === null ? '–' : n(dv.image_success_rate, 1) + '%'], [L.avg_time, dv.avg_gen_seconds === null ? '–' : n(dv.avg_gen_seconds, 1) + ' s'], [L.downloads, n(t.package_download)],
				[L.cost, n(t.cost, 2) + ' ' + cur], [L.cost_concept, dv.cost_per_concept === null ? '–' : n(dv.cost_per_concept, 3) + ' ' + cur], [L.cost_quote, dv.cost_per_quote === null ? '–' : n(dv.cost_per_quote, 2) + ' ' + cur], [L.limit_hit, n(t.limit_hit)]
			];
			var html = '<div class="agh-grid-4">' + cards.map(function (c) { return '<div class="agh-card agh-stat"><span>' + esc(c[0]) + '</span><b>' + esc(c[1]) + '</b></div>'; }).join('') + '</div>';
			html += '<div class="agh-card"><h2>' + esc(L.trend) + '</h2>' + chart(d.series) + '</div>';
			if (el.getAttribute('data-advanced') === '1') {
				html += '<div class="agh-grid-3">';
				[[L.b_style, 'style'], [L.b_roof, 'roof'], [L.b_area, 'area_bucket'], [L.b_param, 'param'], [L.b_error, 'error'], [L.b_cost, 'cost'], [L.b_ok, 'provider_ok'], [L.b_fail, 'provider_fail'], [L.b_limit, 'limit_hit']].forEach(function (b) {
					html += '<div class="agh-card"><h3>' + esc(b[0]) + '</h3>' + bars(d.breakdown[b[1]] || []) + '</div>';
				});
				html += '</div>';
			}
			el.innerHTML = html;
		}).catch(function (e) { el.innerHTML = '<p>' + esc(e.message) + '</p>'; });
	}
	function bars(rows) {
		if (!rows.length) { return '<p class="description">–</p>'; }
		var max = Math.max.apply(null, rows.map(function (r) { return Number(r.value); }));
		return '<div class="agh-bars">' + rows.map(function (r) { return '<div><span>' + esc(r.dim) + '</span><span class="bar" style="width:' + Math.max(2, Number(r.value) / max * 100) + '%"></span><span>' + esc(Math.round(Number(r.value) * 100) / 100) + '</span></div>'; }).join('') + '</div>';
	}
	function chart(series) {
		var keys = [['generate_request', '#1E2226', L.l_generate], ['popup_open', '#B9824F', L.l_popup], ['quote_submitted', '#5E8C61', L.l_quote]];
		var days = (series.generate_request || []).map(function (p) { return p.day; });
		if (!days.length) { return '<p>–</p>'; }
		var W = 900, H = 200, pad = 28;
		var max = 1;
		keys.forEach(function (k) { (series[k[0]] || []).forEach(function (p) { max = Math.max(max, p.value); }); });
		var x = function (i) { return pad + i * (W - 2 * pad) / Math.max(1, days.length - 1); };
		var y = function (v) { return H - pad - v * (H - 2 * pad) / max; };
		var svg = '<svg class="agh-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
		for (var g = 0; g <= 4; g++) { var gy = pad + g * (H - 2 * pad) / 4; svg += '<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + gy + '" y2="' + gy + '" stroke="#EEE"/>'; }
		keys.forEach(function (k) {
			var pts = (series[k[0]] || []).map(function (p, i) { return x(i) + ',' + y(p.value); }).join(' ');
			svg += '<polyline fill="none" stroke="' + k[1] + '" stroke-width="2.2" points="' + pts + '"/>';
		});
		svg += '<text x="' + pad + '" y="' + (H - 6) + '" font-size="11" fill="#888">' + esc(days[0]) + '</text><text x="' + (W - pad) + '" y="' + (H - 6) + '" font-size="11" fill="#888" text-anchor="end">' + esc(days[days.length - 1]) + '</text><text x="4" y="' + (pad + 4) + '" font-size="11" fill="#888">' + max + '</text></svg>';
		return svg + '<div class="agh-chart-legend">' + keys.map(function (k) { return '<span><i style="background:' + k[1] + '"></i>' + esc(k[2]) + '</span>'; }).join('') + '</div>';
	}
})(jQuery);
