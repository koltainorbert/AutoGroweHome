/*! AutoGroweHome – FAQ search/filter and pricing period toggle */
(function () {
	'use strict';
	function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
	Array.prototype.forEach.call(document.querySelectorAll('[data-agh-faq]'), function (root) {
		var input = root.querySelector('.agh-faq-search');
		var cats = root.querySelectorAll('.agh-faq-cats button');
		var items = root.querySelectorAll('.agh-faq-item');
		var empty = root.querySelector('.agh-faq-empty');
		var cat = '';
		function apply() {
			var q = norm(input.value.trim()), shown = 0;
			Array.prototype.forEach.call(items, function (it) {
				var ok = (!cat || it.getAttribute('data-cat') === cat) && (!q || norm(it.textContent).indexOf(q) !== -1);
				it.hidden = !ok;
				if (ok) { shown++; if (q) { it.open = true; } }
			});
			empty.hidden = shown > 0;
		}
		input.addEventListener('input', apply);
		Array.prototype.forEach.call(cats, function (b) {
			b.addEventListener('click', function () {
				cat = b.getAttribute('data-cat');
				Array.prototype.forEach.call(cats, function (x) { x.classList.toggle('is-on', x === b); });
				apply();
			});
		});
	});
	Array.prototype.forEach.call(document.querySelectorAll('.agh-pricing'), function (root) {
		var btns = root.querySelectorAll('.agh-pr-toggle button');
		Array.prototype.forEach.call(btns, function (b) {
			b.addEventListener('click', function () {
				var p = b.getAttribute('data-period');
				Array.prototype.forEach.call(btns, function (x) { x.classList.toggle('is-on', x === b); });
				Array.prototype.forEach.call(root.querySelectorAll('.agh-pr-card [data-period]'), function (el) { el.hidden = el.getAttribute('data-period') !== p; });
			});
		});
	});
})();
