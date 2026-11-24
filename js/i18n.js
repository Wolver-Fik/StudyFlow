/* StudyFlow — núcleo de internacionalización.
   Los archivos js/i18n/<codigo>.js registran sus diccionarios aquí.
   Expone window.StudyI18n. */
(function () {
  'use strict';

  /* Evita reinicializar el núcleo si otra ruta (js/i18n/i18n.js) ya lo cargó. */
  if (window.StudyI18n && window.StudyI18n.__core) return;

  var KEY = 'studyflow-lang';
  var CODES = ['en', 'es', 'pt', 'fr', 'it', 'de', 'ru', 'ja'];
  var BASE = 'en';
  var NAMES = {
    en: 'English', es: 'Español', pt: 'Português', fr: 'Français',
    it: 'Italiano', de: 'Deutsch', ru: 'Русский', ja: '日本語'
  };
  var dicts = {}, current = BASE, listeners = [];

  function register(code, dict) { if (!dict) return; dicts[code] = dict; }
  function supported(code) { return CODES.indexOf(String(code || '').toLowerCase().split('-')[0]) >= 0 ? String(code).toLowerCase().split('-')[0] : false; }
  function canonical(code) { return supported(code) || BASE; }

  function detect() {
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (supported(saved)) return canonical(saved);
    var nav = String(navigator.language || (navigator.userLanguage || '')).toLowerCase().replace(/_/g, '-');
    return supported(nav) ? canonical(nav) : BASE;
  }

  function raw(key, lang) {
    var l = canonical(lang || current);
    var d = dicts[l] || {};
    if (Object.prototype.hasOwnProperty.call(d, key)) return d[key];
    if (l !== BASE) {
      var b = dicts[BASE] || {};
      if (Object.prototype.hasOwnProperty.call(b, key)) return b[key];
    }
    return key;
  }

  function t(key, vars) {
    var s = raw(key);
    if (typeof s !== 'string') return s;
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) {
      return (vars[k] !== undefined && vars[k] !== null) ? vars[k] : m;
    });
  }

  function category(n) {
    try {
      if (typeof Intl !== 'undefined' && Intl.PluralRules) return new Intl.PluralRules(current).select(n);
    } catch (e) {}
    return n === 1 ? 'one' : 'other';
  }

  /* Count with plural keys: base.one / base.few / base.many / base.other. */
  function count(base, n, vars) {
    var cat = category(n);
    var key = base + '.' + cat;
    if (raw(key) === key) key = base + '.other';
    if (raw(key) === key) key = base;
    var v = Object.assign({}, vars || {}, { n: n });
    return t(key, v);
  }

  function locale() {
    return { en: 'en-US', es: 'es-ES', pt: 'pt-BR', fr: 'fr-FR', it: 'it-IT', de: 'de-DE', ru: 'ru-RU', ja: 'ja-JP' }[current] || 'en-US';
  }

  /* Locale-aware number and date helpers used by the app. */
  function nf(digits) {
    try {
      return new Intl.NumberFormat(locale(), { maximumFractionDigits: digits == null ? 2 : digits });
    } catch (e) {
      return { format: function (x) { return String(x); } };
    }
  }
  function num(value, digits) { return nf(digits).format(Number(value) || 0); }
  function date(day, options) {
    try { return new Intl.DateTimeFormat(locale(), options).format(day); }
    catch (e) { return String(day); }
  }

  /* Nunca dejar una clave literal (p. ej. "header.backup") visible si un
     diccionario no ha llegado a registrarse: se conserva el texto original. */
  function resolved(el, attr, prop, isAttr) {
    var key = el.getAttribute(attr);
    if (!key) return null;
    var store = isAttr ? 'data-i18n-fallback-' + prop : 'data-i18n-fallback';
    var original = el.getAttribute(store);
    if (original === null || original === undefined) {
      original = isAttr
        ? (el.getAttribute(prop) || '')
        : String(el[prop] == null ? '' : el[prop]);
      el.setAttribute(store, original);
    }
    var val = t(key);
    if (typeof val !== 'string') val = String(val == null ? '' : val);
    if (val === key) val = original;
    return val;
  }

  function apply() {
    var root = document.documentElement;
    root.lang = current;
    var a = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < a.length; i++) {
      var v = resolved(a[i], 'data-i18n', 'textContent');
      if (v !== null) a[i].textContent = v;
    }
    var b = document.querySelectorAll('[data-i18n-html]');
    for (i = 0; i < b.length; i++) {
      var vh = resolved(b[i], 'data-i18n-html', 'innerHTML');
      if (vh !== null) b[i].innerHTML = vh;
    }
    var c = document.querySelectorAll('[data-i18n-ph]');
    for (i = 0; i < c.length; i++) {
      var vp = resolved(c[i], 'data-i18n-ph', 'placeholder');
      if (vp !== null) c[i].placeholder = vp;
    }
    var d = document.querySelectorAll('[data-i18n-aria]');
    for (i = 0; i < d.length; i++) {
      var va = resolved(d[i], 'data-i18n-aria', 'aria-label', true);
      if (va !== null) d[i].setAttribute('aria-label', va);
    }
    var e = document.querySelectorAll('[data-i18n-title]');
    for (i = 0; i < e.length; i++) {
      var vt = resolved(e[i], 'data-i18n-title', 'title', true);
      if (vt !== null) e[i].title = vt;
    }
    var sel = document.getElementById('langSel');
    if (sel) sel.value = current;
    var title = t('meta.title');
    document.title = title === 'meta.title' ? 'StudyFlow' : title;
  }

  function setLang(code) {
    code = canonical(code);
    if (!code || code === current) return;
    current = code;
    try { localStorage.setItem(KEY, code); } catch (e) {}
    apply();
    for (var i = 0; i < listeners.length; i++) listeners[i](code);
  }

  function init() {
    current = detect();
    var sel = document.getElementById('langSel');
    if (sel && !sel._sfBound) {
      sel._sfBound = true;
      sel.addEventListener('change', function () { setLang(sel.value); });
    }
    apply();
    return current;
  }
  function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

  window.StudyI18n = {
    __core: true,
    KEY: KEY, CODES: CODES, NAMES: NAMES, BASE: BASE,
    register: register, supported: supported, init: init, apply: apply,
    t: t, raw: raw, get: raw, count: count, plural: category,
    locale: locale, num: num, date: date,
    current: function () { return current; },
    setLang: setLang, onChange: onChange
  };
})();
