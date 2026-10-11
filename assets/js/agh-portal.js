/*! AutoGroweHome – contractor portal */
(function () {
	'use strict';
	var C = window.AGH_PORTAL || {};
	var I = C.i18n || {};
	var app = document.getElementById('agh-portal-app');
	if (!app) { return; }
	function t(k) { return I[k] || k; }
	function h(tag, attrs) {
		var el = document.createElement(tag);
		attrs = attrs || {};
		Object.keys(attrs).forEach(function (k) {
			var v = attrs[k];
			if (v === null || v === undefined || v === false) { return; }
			if (k === 'text') { el.textContent = v; } else if (k === 'class') { el.className = v; } else if (k.indexOf('on') === 0) { el.addEventListener(k.slice(2), v); } else { el.setAttribute(k, v); }
		});
		for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c === null || c === undefined) { continue; } if (Array.isArray(c)) { c.forEach(function (x) { if (x) { el.appendChild(x); } }); } else { el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); } }
		return el;
	}
	function api(method, path, body) {
		var headers = { 'Accept': 'application/json' };
		if (C.wpNonce) { headers['X-WP-Nonce'] = C.wpNonce; }
		var o = { method: method, credentials: 'same-origin', headers: headers };
		if (body) { headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
		return fetch(C.rest + path, o).then(function (r) { return r.json().then(function (d) { if (!r.ok) { var e = new Error(d.message || r.status); e.status = r.status; throw e; } return d; }); });
	}
	function msg(text) { app.innerHTML = ''; app.appendChild(h('div', { class: 'agh-glass agh-portal-card' }, h('p', { text: text }))); }

	function start() {
		var m = /[#&]t=([a-f0-9]{64})/.exec(location.hash);
		if (m) {
			// Remove the token from the address bar and history immediately.
			history.replaceState(null, '', location.pathname + location.search);
			api('POST', 'contractor/session', { token: m[1] }).then(load).catch(function (e) { msg(e.message || t('link_error')); });
		} else {
			load();
		}
	}

	function load() {
		msg(t('loading'));
		api('GET', 'contractor/projects').then(render).catch(function (e) { msg(e.status === 401 || e.status === 403 ? t('no_access') : e.message); });
	}

	function thumbs(list) {
		var g = h('div', { class: 'agh-portal-thumbs' });
		list.forEach(function (a) {
			if (!a.preview) { return; }
			g.appendChild(h('a', { href: a.download || a.preview, target: '_blank', rel: 'noopener' }, h('img', { src: a.preview, alt: a.label, loading: 'lazy' }), h('span', { text: a.label + (a.resolution ? ' · ' + a.resolution : '') + (a.is_test ? ' · TEST' : '') })));
		});
		return g;
	}

	function render(data) {
		app.innerHTML = '';
		var bar = h('div', { style: 'display:flex;justify-content:flex-end;margin-bottom:10px' }, h('button', { type: 'button', class: 'agh-btn agh-btn-s', onclick: function () { api('POST', 'contractor/logout', {}).then(function () { msg(t('no_access')); }); }, text: t('logout') }));
		app.appendChild(bar);
		if (!data.items.length) { msg(t('no_access')); return; }
		data.items.forEach(function (it) {
			var q = it.quote, p = it.project, c = (p.concepts || [])[0] || {};
			var assets = c.assets || [];
			var ext = (c.hero ? [c.hero] : []).concat(assets.filter(function (a) { return a.kind === 'render' && a.view.indexOf('interior_') !== 0; }));
			var int = assets.filter(function (a) { return a.kind === 'render' && a.view.indexOf('interior_') === 0; });
			var plans = assets.filter(function (a) { return a.kind === 'plan'; });
			var docs = assets.filter(function (a) { return a.kind === 'doc'; });
			var dl = h('dl', { class: 'agh-sum-list' });
			[['name', q.full_name], ['email', q.email], ['phone', q.phone], ['city', q.city], ['site', q.site_location], ['start', q.start_period], ['budget', q.budget], ['note', q.note]].forEach(function (r) { if (r[1]) { dl.appendChild(h('dt', { text: t(r[0]) })); dl.appendChild(h('dd', { text: r[1] })); } });
			var params = h('div', null);
			Object.keys(it.summary || {}).forEach(function (cat) {
				var d2 = h('dl', { class: 'agh-sum-list', style: 'margin-bottom:10px' });
				it.summary[cat].forEach(function (r) { d2.appendChild(h('dt', { text: r[0] })); d2.appendChild(h('dd', { text: r[1] })); });
				params.appendChild(h('details', null, h('summary', { text: cat, style: 'cursor:pointer;font-weight:600;padding:6px 0' }), d2));
			});
			var cons = h('ul', { class: 'agh-small' });
			(it.consents || []).forEach(function (cn) { cons.appendChild(h('li', { text: cn.created_at + ' · ' + cn.consent_type + ' · ' + (Number(cn.granted) ? t('granted') : t('not_granted')) + (cn.doc_version ? ' · v' + cn.doc_version : '') })); });
			var card = h('section', { class: 'agh-glass agh-portal-card' },
				h('div', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px' },
					h('h2', { class: 'agh-h', style: 'font-size:17px;flex:1', text: (c.variant ? c.variant + ' – ' : '') + (c.title || '') }),
					h('span', { class: 'agh-badge', text: t('project') + ' #' + p.id.slice(0, 8) }),
					q.package ? h('a', { class: 'agh-btn agh-btn-primary', href: q.package, text: t('download_zip') }) : h('span', { class: 'agh-badge agh-badge-warn', text: t('package_wait') })),
				h('div', { class: 'agh-portal-grid' },
					h('div', null,
						h('h3', { class: 'agh-eyebrow', text: t('exterior') }), thumbs(ext),
						int.length ? h('h3', { class: 'agh-eyebrow', style: 'margin-top:16px', text: t('interior') }) : null, int.length ? thumbs(int) : null,
						plans.length ? h('h3', { class: 'agh-eyebrow', style: 'margin-top:16px', text: t('plans') }) : null, plans.length ? thumbs(plans) : null,
						docs.length ? h('h3', { class: 'agh-eyebrow', style: 'margin-top:16px', text: t('docs') }) : null,
						docs.length ? h('ul', null, docs.map(function (d) { return h('li', null, h('a', { href: d.download || d.preview, text: d.label })); })) : null),
					h('div', null,
						h('h3', { class: 'agh-eyebrow', text: t('client') }), dl,
						h('h3', { class: 'agh-eyebrow', style: 'margin-top:16px', text: t('params') }), params,
						h('h3', { class: 'agh-eyebrow', style: 'margin-top:16px', text: t('consents') }), cons)),
				h('p', { class: 'agh-disclaimer', style: 'margin-top:14px', text: t('disclaimer') }));
			app.appendChild(card);
		});
	}
	start();
})();
