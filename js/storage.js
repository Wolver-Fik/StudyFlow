/* StudyFlow - storage.js
 * Persistencia, estado, datos demo, escala de notas y respaldo JSON/CSV.
 */
(function () {
  'use strict';

  const I = window.StudyI18n || null;
  const T = (key, vars) => I ? I.t(key, vars) : key;

  /* Cada elemento generado por el Modo Demo guarda su clave i18n en demoKey.
     Así se puede volver a traducir al cambiar de idioma sin tocar nunca el
     contenido que la persona creó o editó (esos elementos no tienen demoKey). */
  const DEMO_FIELDS = [
    ['subjects', 'name'], ['units', 'name'], ['blocks', 'note'],
    ['exams', 'title'], ['grades', 'name'],
    /* Las flashcards tienen dos textos traducibles: cada uno lleva su clave. */
    ['flashcards', 'front', 'demoKey'], ['flashcards', 'back', 'demoBackKey'],
    /* Etapa 2: el enunciado del banco de preguntas también es traducible; las
       cuatro opciones se manejan aparte (demoOptionKeys). */
    ['questions', 'text', 'demoKey']
  ];
  function demoKeyField(pair) { return pair && pair[2] ? pair[2] : 'demoKey'; }
  function demoKeyOf(x, pair) {
    const field = demoKeyField(pair);
    return x && typeof x[field] === 'string' && x[field] ? x[field] : null;
  }
  function demoText(x, pair) {
    const key = demoKeyOf(x, pair);
    if (!key || !I) return null;
    const v = T(key);
    return typeof v === 'string' && v !== key ? v : null;
  }
  function withDemo(out, x, pair) {
    const field = demoKeyField(pair), key = demoKeyOf(x, pair);
    return key ? Object.assign(out, { [field]: key }) : out;
  }

  /* Títulos originales del modo demo → clave i18n. Se generan desde los
     propios diccionarios (es/en) para no duplicar traducciones. La comparación
     ignora tildes, mayúsculas y puntuación: "Introduccion a la Economia"
     reconoce "Introducción a la Economía" y "Writing and Style" a
     "Writing & Style". */
  const SAMPLE_FIELD_KEYS = {
    subjects: [
      'sample.subject.econ', 'sample.subject.writing',
      'sample.subject.history', 'sample.subject.stats'
    ],
    units: [
      'sample.unit.econ.concepts', 'sample.unit.econ.supply',
      'sample.unit.econ.market', 'sample.unit.econ.policy',
      'sample.unit.writing.structure', 'sample.unit.writing.arguments',
      'sample.unit.writing.style', 'sample.unit.writing.review',
      'sample.unit.history.causes', 'sample.unit.history.process',
      'sample.unit.history.sources', 'sample.unit.history.legacy',
      'sample.unit.stats.descriptive', 'sample.unit.stats.probability',
      'sample.unit.stats.sampling', 'sample.unit.stats.inference'
    ],
    blocks: ['sample.room'],
    exams: [
      'sample.exam.midterm', 'sample.exam.delivery',
      'sample.exam.unit', 'sample.exam.reading'
    ],
    grades: [
      'sample.grade.midterm', 'sample.grade.task', 'sample.grade.test',
      'sample.grade.essay', 'sample.grade.practical'
    ],
    flashcards: [
      'sample.card.econ.supply.q', 'sample.card.econ.supply.a',
      'sample.card.econ.elasticity.q', 'sample.card.econ.elasticity.a',
      'sample.card.writing.argument.q', 'sample.card.writing.argument.a',
      'sample.card.writing.coherence.q', 'sample.card.writing.coherence.a',
      'sample.card.history.causes.q', 'sample.card.history.causes.a',
      'sample.card.stats.mean.q', 'sample.card.stats.mean.a'
    ],
    /* Etapa 2: enunciados y opciones de las preguntas de ejemplo. */
    questions: [
      'sample.q.econ.supply.q', 'sample.q.econ.supply.o1', 'sample.q.econ.supply.o2', 'sample.q.econ.supply.o3', 'sample.q.econ.supply.o4',
      'sample.q.econ.policy.q', 'sample.q.econ.policy.o1', 'sample.q.econ.policy.o2', 'sample.q.econ.policy.o3', 'sample.q.econ.policy.o4',
      'sample.q.writing.argument.q', 'sample.q.writing.argument.o1', 'sample.q.writing.argument.o2', 'sample.q.writing.argument.o3', 'sample.q.writing.argument.o4',
      'sample.q.history.causes.q', 'sample.q.history.causes.o1', 'sample.q.history.causes.o2', 'sample.q.history.causes.o3', 'sample.q.history.causes.o4',
      'sample.q.stats.mean.q', 'sample.q.stats.mean.o1', 'sample.q.stats.mean.o2', 'sample.q.stats.mean.o3', 'sample.q.stats.mean.o4'
    ]
  };
  const SAMPLE_LANGS = ['es', 'en'];
  let sampleAliasCache = null;
  function normSampleText(s) {
    let v = String(s == null ? '' : s).toLowerCase().replace(/&/g, ' and ');
    try { v = v.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    return v.replace(/[¿?¡!.,;:()\[\]{}"'`´+·\-_/]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function sampleAliases() {
    if (sampleAliasCache) return sampleAliasCache;
    sampleAliasCache = {};
    Object.keys(SAMPLE_FIELD_KEYS).forEach(field => {
      const map = Object.create(null);
      SAMPLE_FIELD_KEYS[field].forEach(key => {
        SAMPLE_LANGS.forEach(lang => {
          let v;
          try { v = I ? I.raw(key, lang) : null; } catch (e) { v = null; }
          if (typeof v !== 'string' || v === key) return;
          const n = normSampleText(v);
          if (n && !map[n]) map[n] = key;
        });
      });
      sampleAliasCache[field] = map;
    });
    /* Índice global: versiones anteriores podían guardar un título de ejemplo
       en otra sección (p. ej. un examen llamado "Parcial 1"). */
    const all = Object.create(null);
    Object.keys(sampleAliasCache).forEach(field => {
      Object.keys(sampleAliasCache[field]).forEach(n => {
        if (!all[n]) all[n] = sampleAliasCache[field][n];
      });
    });
    sampleAliasCache.all = all;
    return sampleAliasCache;
  }
  /* Datos guardados antes de que existiera demoKey: recuperan su clave según
     el texto de ejemplo exacto (es/en). Se prefiere la clave del propio campo. */
  function backfillSampleKeys(state) {
    if (!state || !I) return false;
    const aliases = sampleAliases();
    let changed = false;
    DEMO_FIELDS.forEach(pair => {
      const map = aliases[pair[0]];
      const list = state[pair[0]];
      if (!Array.isArray(list)) return;
      list.forEach(item => {
        if (!item || demoKeyOf(item, pair)) return;
        const n = normSampleText(item[pair[1]]);
        const key = (map && map[n]) || aliases.all[n];
        if (key) { item[demoKeyField(pair)] = key; changed = true; }
      });
    });
    return changed;
  }

  /* Reaplica el idioma vigente a los textos que siguen siendo de ejemplo.
     Devuelve true si cambió algo para que la app pueda persistir el estado. */
  function localizeSample(state) {
    if (!state || !I) return false;
    let changed = backfillSampleKeys(state);
    DEMO_FIELDS.forEach(pair => {
      const list = state[pair[0]];
      if (!Array.isArray(list)) return;
      list.forEach(item => {
        const text = demoText(item, pair);
        if (text != null && item[pair[1]] !== text) {
          item[pair[1]] = text;
          changed = true;
        }
      });
    });
    /* Las opciones de una pregunta de ejemplo llevan una clave por índice. */
    (state.questions || []).forEach(q => {
      if (!q || !Array.isArray(q.demoOptionKeys)) return;
      q.demoOptionKeys.forEach((key, i) => {
        if (!key || !Array.isArray(q.options)) return;
        const text = demoText({ demoKey: key }, ['questions', 'text']);
        if (text != null && q.options[i] !== text) { q.options[i] = text; changed = true; }
      });
    });
    return changed;
  }

  const KEY = 'studyflow-v1';
  const LEGACY_KEY = 'panel-estudio-v1';

  /* ---------- Capa IndexedDB (Etapa 1) ----------
     IndexedDB es el almacen principal; localStorage sigue siendo el espejo
     sincrono que consume app.js. El store 'files' guarda adjuntos/imagenes
     grandes sin el limite de 5 MB. La API sincrona no cambia. */
  const DB_NAME = 'studyflow_db';
  /* Etapa 2: versión 2 añade los stores dedicados del banco de preguntas y del
     historial de simulacros. Los datos anteriores se conservan intactos. */
  const DB_VERSION = 2;
  const SCHEMA_VERSION = 5;
  const STORE_STATE = 'state';
  const STORE_FILES = 'files';
  const STORE_QUESTIONS = 'questions';
  const STORE_QUIZZES = 'quizHistory';
  const STATE_KEY = 'main';
  const MIRROR_KEYS = [KEY, LEGACY_KEY, 'studyflow-lang'];
  let dbPromise = null, idbReady = false, idbFailed = false;
  let initPromise = null, writeChain = Promise.resolve(), memoryBackup = null;
  let lastSavePromise = Promise.resolve();

  /* IndexedDB es la única fuente de verdad; `memoryState` es la copia en
     memoria que consume la API síncrona. */
  let memoryState = null;
  const STORAGE_ERROR_MESSAGE = 'Error al guardar los datos en este dispositivo. Exporta un respaldo JSON por seguridad.';
  let storageErrorHandler = null, lastStorageError = null, storageErrorActive = false;
  function emitStorageError(err, origin) {
    if (storageErrorActive) return;
    storageErrorActive = true;
    lastStorageError = { message: STORAGE_ERROR_MESSAGE, error: err || null, origin: origin || '' };
    try { if (typeof storageErrorHandler === 'function') storageErrorHandler(lastStorageError); } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent('onStorageError', { detail: lastStorageError }));
    } catch (e) {
      try {
        const ev = document.createEvent('CustomEvent');
        ev.initCustomEvent('onStorageError', false, false, lastStorageError);
        window.dispatchEvent(ev);
      } catch (e2) {}
    }
  }
  /* Se llama tras una escritura confirmada: el error queda cerrado y la base
     vuelve a considerarse usable para la siguiente operación. */
  function clearStorageError() { storageErrorActive = false; lastStorageError = null; idbFailed = false; }
  function persistStatus() { return !lastStorageError && !idbFailed; }

  function idbOpen() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!('indexedDB' in window)) { reject(new Error('IndexedDB no disponible')); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_STATE)) db.createObjectStore(STORE_STATE);
        if (!db.objectStoreNames.contains(STORE_FILES)) db.createObjectStore(STORE_FILES, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_QUESTIONS)) db.createObjectStore(STORE_QUESTIONS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_QUIZZES)) db.createObjectStore(STORE_QUIZZES, { keyPath: 'id' });
      };
      req.onsuccess = function () { idbReady = true; resolve(req.result); };
      req.onerror = function () { idbFailed = true; reject(req.error || new Error('No se pudo abrir IndexedDB')); };
      req.onblocked = function () { idbFailed = true; reject(new Error('IndexedDB bloqueada')); };
    });
    /* Una apertura fallida no queda cacheada: la próxima escritura reintenta. */
    dbPromise.catch(function () { dbPromise = null; });
    return dbPromise;
  }
  function idbRequest(db, store, mode, run) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(store, mode), os = tx.objectStore(store);
      let result;
      try { result = run(os); } catch (e) { reject(e); return; }
      tx.oncomplete = function () { resolve(result && result.result !== undefined ? result.result : undefined); };
      tx.onerror = function () { reject(tx.error || new Error('Error de IndexedDB')); };
      tx.onabort = function () { reject(tx.error || new Error('Transaccion abortada')); };
    });
  }
  function idbGet(store, key) {
    return idbOpen().then(function (db) { return idbRequest(db, store, 'readonly', function (os) { return os.get(key); }); });
  }
  function idbGetAll(store) {
    return idbOpen().then(function (db) { return idbRequest(db, store, 'readonly', function (os) { return os.getAll(); }); });
  }
  function idbPut(store, key, value) {
    return idbOpen().then(function (db) {
      return idbRequest(db, store, 'readwrite', function (os) { return key === undefined ? os.put(value) : os.put(value, key); });
    });
  }
  function idbDelete(store, key) {
    return idbOpen().then(function (db) { return idbRequest(db, store, 'readwrite', function (os) { return os.delete(key); }); });
  }
  /* El banco y el historial también viven en stores propios de IndexedDB,
     además del sobre 'state'. Así siguen disponibles aunque el espejo
     localStorage quede fuera de servicio. Solo se reescriben si cambiaron. */
  let quizMirrorSig = { questions: null, history: null };
  let quizWriteChain = Promise.resolve();
  function mirrorQuizData(state, force) {
    if (!state) return Promise.resolve();
    const qs = Array.isArray(state.questions) ? state.questions : [];
    const hs = Array.isArray(state.quizHistory) ? state.quizHistory : [];
    const sq = JSON.stringify(qs), sh = JSON.stringify(hs);
    if (!force && sq === quizMirrorSig.questions && sh === quizMirrorSig.history) return Promise.resolve();
    const previousSig = quizMirrorSig;
    quizMirrorSig = { questions: sq, history: sh };
    const attempt = quizWriteChain.then(function () {
      return idbOpen().then(function (db) {
        return new Promise(function (resolve, reject) {
          const tx = db.transaction([STORE_QUESTIONS, STORE_QUIZZES], 'readwrite');
          const qos = tx.objectStore(STORE_QUESTIONS), hos = tx.objectStore(STORE_QUIZZES);
          try {
            qos.clear(); hos.clear();
            qs.forEach(function (q) { if (q && q.id) qos.put(q); });
            hs.forEach(function (r) { if (r && r.id) hos.put(r); });
          } catch (e) { reject(e); return; }
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { reject(tx.error || new Error('Error al guardar el banco de preguntas')); };
          tx.onabort = function () { reject(tx.error || new Error('Transacción abortada')); };
        });
      });
    });
    quizWriteChain = attempt.catch(function () {});
    return attempt.then(function () {
      return true;
    }, function (e) {
      /* La firma sólo avanza si la transacción terminó: así un reintento vuelve
         a escribir el banco en lugar de darlo por guardado. */
      quizMirrorSig = previousSig;
      idbFailed = true; storageOk = false;
      emitStorageError(e, 'IndexedDB (banco/historial)');
      throw e;
    });
  }
  function listQuizData() {
    return Promise.all([idbGetAll(STORE_QUESTIONS), idbGetAll(STORE_QUIZZES)])
      .then(function (r) { return { questions: r[0] || [], quizHistory: r[1] || [] }; })
      .catch(function () { return { questions: [], quizHistory: [] }; });
  }
  const LIGHT_KEYS = ['studyflow-lang'];
  const HEAVY_KEYS = [KEY, LEGACY_KEY];

  /* localStorage solo conserva preferencias ligeras; el estado completo
     reside en IndexedDB y en `memoryState` mientras la app está abierta. */
  function localSnapshot() {
    const snap = {};
    try { LIGHT_KEYS.forEach(function (k) { const v = localStorage.getItem(k); if (v !== null) snap[k] = v; }); } catch (e) {}
    return snap;
  }
  function restoreSnapshot(snap) {
    try { LIGHT_KEYS.forEach(function (k) { if (Object.prototype.hasOwnProperty.call(snap, k)) localStorage.setItem(k, snap[k]); }); } catch (e) {}
  }
  function pruneLocalState() {
    try { HEAVY_KEYS.forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
  }
  function writeIDB(data) {
    const attempt = writeChain.then(function () {
      return idbPut(STORE_STATE, STATE_KEY, {
        schemaVersion: SCHEMA_VERSION, app: 'studyflow', data: data,
        localStorage: localSnapshot(), updatedAt: new Date().toISOString()
      });
    });
    writeChain = attempt.catch(function () {});
    return attempt.then(function () {
      return true;
    }, function (e) {
      idbFailed = true; storageOk = false;
      emitStorageError(e, 'IndexedDB');
      throw e;
    });
  }
  function initIDB() {
    if (initPromise) return initPromise;
    initPromise = idbOpen().then(function () { return idbGet(STORE_STATE, STATE_KEY); })
      .then(function (rec) {
        if (!rec) {
          /* Migración única: solo si IndexedDB está vacío se lee localStorage. */
          try {
            const raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              const data = (parsed && parsed.app === 'studyflow' && parsed.data) ? parsed.data : parsed;
              memoryState = data;
              /* El espejo localStorage se poda sólo cuando IndexedDB confirmó
                 la escritura; si falla, el respaldo original sigue disponible. */
              return writeIDB(data).then(function () {
                clearStorageError(); storageOk = true;
                pruneLocalState();
              });
            }
          } catch (e) {}
          pruneLocalState();
          return;
        }
        const remote = (rec.schemaVersion && rec.data) ? rec.data : rec;
        memoryState = remote;
        pruneLocalState();
      }).catch(function (e) { idbFailed = true; emitStorageError(e, 'IndexedDB (init)'); });
    return initPromise;
  }
  function whenReady() { return initIDB(); }
  function putFile(id, data, meta) {
    const rec = {
      id: String(id), data: data, type: (meta && meta.type) || '', name: (meta && meta.name) || '',
      size: typeof data === 'string' ? data.length : ((data && data.size) || 0),
      schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString()
    };
    return idbPut(STORE_FILES, undefined, rec);
  }
  function getFile(id) { return idbGet(STORE_FILES, String(id)); }
  function listFiles() { return idbGetAll(STORE_FILES); }
  function deleteFile(id) { return idbDelete(STORE_FILES, String(id)); }

  /* Borrado total: vacía los cuatro stores de IndexedDB y las claves propias
     de localStorage. Se encola tras las escrituras pendientes para que ningún
     guardado en curso reaparezca después del borrado. */
  function clearAllStorage() {
    const keys = Array.from(new Set(MIRROR_KEYS.concat(LIGHT_KEYS, HEAVY_KEYS)));
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.indexOf('studyflow-') === 0 || k === LEGACY_KEY)) keys.push(k);
      }
    } catch (e) {}
    const attempt = Promise.all([writeChain, quizWriteChain]).then(function () {
      return idbOpen();
    }).then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction([STORE_STATE, STORE_FILES, STORE_QUESTIONS, STORE_QUIZZES], 'readwrite');
        tx.objectStore(STORE_STATE).clear();
        tx.objectStore(STORE_FILES).clear();
        tx.objectStore(STORE_QUESTIONS).clear();
        tx.objectStore(STORE_QUIZZES).clear();
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error || new Error('Error al borrar IndexedDB')); };
        tx.onabort = function () { reject(tx.error || new Error('Transacción abortada')); };
      });
    });
    writeChain = attempt.catch(function () {});
    quizWriteChain = attempt.catch(function () {});
    return attempt.then(function () {
      keys.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
      memoryState = null;
      quizMirrorSig = { questions: null, history: null };
      lastSavePromise = Promise.resolve();
      clearStorageError(); storageOk = true;
      return true;
    }, function (e) {
      idbFailed = true; storageOk = false;
      emitStorageError(e, 'IndexedDB (borrado)');
      throw e;
    });
  }

  const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const DAYS_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const COLORS = ['#E0A96D', '#D97B66', '#8FB996', '#C9B07A', '#B9A1D8', '#E2A0A0', '#7FB7B5', '#D4C48A'];

  const SCALE_PRESETS = [
    { id: '0-10', label: '0–10', max: 10, pass: 6, type: 'numeric' },
    { id: '0-12', label: '0–12', max: 12, pass: 6, type: 'numeric' },
    { id: '0-100', label: '0–100', max: 100, pass: 60, type: 'numeric' },
    { id: 'A-F', label: 'A–F', max: 4, pass: 2, type: 'letter', letters: ['F', 'D', 'C', 'B', 'A'] }
  ];

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseYmd = (s) => { const p = String(s || '').split('-').map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); };
  /* Acepta sólo YYYY-MM-DD que existan de verdad: rechaza 2026-99-99,
     2026-02-30 y cualquier fecha que el calendario corrija al construirla. */
  const isRealYmd = (str) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str == null ? '' : str));
    if (!m) return false;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
    const dt = new Date(y, mo - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
  };
  const todayKey = () => ymd(new Date());
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const dayIdx = (d) => (d.getDay() + 6) % 7;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fnum = (v) => parseFloat(String(v == null ? '' : v).replace(',', '.'));
  const num = (x, d) => {
    const digits = d == null ? 2 : d;
    if (I) return I.num(x, digits);
    const n = +(+(x || 0)).toFixed(digits);
    return String(n).replace('.', ',');
  };
  const toMin = (h) => { const p = String(h || '0:0').split(':').map(Number); return (p[0] || 0) * 60 + (p[1] || 0); };
  const normTime = (h) => { const m = Math.max(0, toMin(h)); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
  const fmtDur = (sec) => {
    sec = Math.max(0, Math.round(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
    if (!I) return h ? (h + ' h' + (m ? ' ' + m + ' min' : '')) : (m + ' min');
    if (h && m) return T('chart.hours', { n: h }) + ' ' + m + T('unit.minuteShort', { n: m });
    if (h) return T('chart.hours', { n: h });
    return m + ' ' + T('unit.minute', { n: m });
  };
  /* Etiqueta exacta desde minutos: 45 min / 1h 45m / 2h 15m. Nunca redondea. */
  const fmtMin = (mins) => fmtDur((Math.max(0, Math.round(mins || 0))) * 60);
  const blockMin = (b) => Math.max(0, toMin(b && b.end) - toMin(b && b.start));
  const fmtClock = (ms, ceil) => {
    const s = Math.max(0, ceil ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return h ? h + ':' + pad(m) + ':' + pad(x) : pad(m) + ':' + pad(x);
  };

  let storageOk = true;
  /* No se prueba localStorage para decidir si el guardado funciona: la fuente
     de verdad es IndexedDB. */
  /* Se activa cuando migrate() rellena las flashcards vacías del modo demo.
     load() lo usa para guardar el estado restaurado en el acto. */
  let demoCardsInjected = false;

  function defaultSettings() {
    return {
      scale: { preset: '0-12', type: 'numeric', max: 12, pass: 6, letters: ['F', 'D', 'C', 'B', 'A'] },
      pomo: { work: 25, short: 5, long: 15, every: 4 },
      /* 0 = meta diaria automática (promedio de las metas semanales). */
      dailyGoalMin: 0
    };
  }

  function defaults() {
    return {
      v: 3,
      sample: false,
      subjects: [],
      units: [],
      blocks: [],
      exams: [],
      grades: [],
      flashcards: [],
      /* Etapa 2: banco de preguntas tipo test e historial de simulacros. */
      questions: [],
      quizHistory: [],
      log: {},
      activeProgram: null,
      settings: defaultSettings(),
      timer: { mode: 'pomo', phase: 'work', status: 'idle', sid: null, startedAt: null, acc: 0, logged: 0, count: 0, seen: 0, session: {} },
      ui: { tab: 'estudio', selDay: dayIdx(new Date()), min: window.innerWidth < 700, cfg: false, pos: null, timerOpen: false, cardSid: null, recoverSeen: [] }
    };
  }

  /* Unidades guardadas dentro de la propia materia (subject.units / tasks /
     syllabus). Se normalizan aquí para que el temario, el dominio por unidad y
     los desplegables vean siempre exactamente las mismas opciones. */
  function unitEntryFrom(x, sid) {
    if (x == null) return null;
    if (typeof x === 'string' || typeof x === 'number') {
      const name = String(x).trim();
      return name ? { name: name.slice(0, 120), hours: 0, done: false } : null;
    }
    if (typeof x !== 'object') return null;
    const name = String(x.name || x.title || x.topic || x.label || x.text || '').trim();
    if (!name) return null;
    if (x.sid && String(x.sid) !== String(sid)) return null;
    const out = {
      id: String(x.id || '').slice(0, 80),
      name: name.slice(0, 120),
      hours: clamp(Number(x.hours != null ? x.hours : x.weeklyHours) || 0, 0, 80),
      done: !!(x.done != null ? x.done : x.completed)
    };
    if (x.demoKey) out.demoKey = String(x.demoKey).slice(0, 120);
    return out;
  }
  function subjectUnitEntries(s) {
    if (!s) return [];
    const out = [];
    [s.units, s.tasks, s.syllabus].forEach(group => {
      if (Array.isArray(group)) {
        group.forEach(x => { const e = unitEntryFrom(x, s.id); if (e) out.push(e); });
      } else if (group && typeof group === 'object') {
        const nested = group.units || group.topics || group.tasks || group.items;
        if (Array.isArray(nested)) nested.forEach(x => { const e = unitEntryFrom(x, s.id); if (e) out.push(e); });
      }
    });
    return out;
  }
  /* Id estable para temas que sólo existen dentro de la materia. */
  function textUnitId(sid, name) {
    const str = String(sid || '') + '|' + normSampleText(name);
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return 'vu-' + h.toString(36);
  }
  function sampleSubjectKey(x) {
    if (!x) return null;
    const key = demoKeyOf(x);
    if (key && key.indexOf('sample.subject.') === 0) return key;
    const n = normSampleText(x.name);
    if (!n) return null;
    return (sampleAliases().subjects || {})[n] || null;
  }
  /* Temas reales de las materias demo. Los completados se eligieron para que
     el avance guardado (45 %, 30 %, 60 %) siga teniendo sentido: 2/4, 1/4 y
     2/4 respectivamente. */
  const DEMO_UNITS_BY_SUBJECT = {
    'sample.subject.econ': [
      ['sample.unit.econ.concepts', true], ['sample.unit.econ.supply', true],
      ['sample.unit.econ.market', false], ['sample.unit.econ.policy', false]
    ],
    'sample.subject.writing': [
      ['sample.unit.writing.structure', true], ['sample.unit.writing.arguments', false],
      ['sample.unit.writing.style', false], ['sample.unit.writing.review', false]
    ],
    'sample.subject.history': [
      ['sample.unit.history.causes', true], ['sample.unit.history.process', true],
      ['sample.unit.history.sources', false], ['sample.unit.history.legacy', false]
    ],
    'sample.subject.stats': [
      ['sample.unit.stats.descriptive', true], ['sample.unit.stats.probability', false],
      ['sample.unit.stats.sampling', false], ['sample.unit.stats.inference', false]
    ]
  };

  /* Repara un estado guardado del Modo Demo: temas reales, tarjetas y banco de
     preguntas. Devuelve true cuando hubo cambios para persistirlos de inmediato.
     Nunca toca el contenido creado por la persona. */
  function demoData(s) {
    if (!s || !Array.isArray(s.subjects)) return false;
    if (!Array.isArray(s.units)) s.units = [];
    let changed = false;
    s.subjects.forEach(sj => {
      if (!sj) return;
      subjectUnitEntries(sj).forEach(e => {
        const byId = e.id && s.units.some(u => u && u.sid === sj.id && String(u.id) === e.id);
        const byName = s.units.some(u => u && u.sid === sj.id && normSampleText(u.name) === normSampleText(e.name));
        if (byId || byName) return;
        const u = {
          id: e.id || textUnitId(sj.id, e.name), sid: sj.id,
          name: e.name, hours: e.hours || 0, done: !!e.done
        };
        if (e.demoKey) u.demoKey = e.demoKey;
        s.units.push(u);
        changed = true;
      });
    });
    s.subjects.forEach(sj => {
      const key = sampleSubjectKey(sj);
      if (!key) return;
      const specs = DEMO_UNITS_BY_SUBJECT[key] || [];
      if (unitsBy(s, sj.id).length >= 3) return;
      specs.slice(0, 4).forEach(spec => {
        if (unitsBy(s, sj.id).length >= 4) return;
        const name = T(spec[0]);
        const exists = unitsBy(s, sj.id).some(u => u.demoKey === spec[0] || normSampleText(u.name) === normSampleText(name));
        if (exists) return;
        s.units.push({ id: uid(), demoKey: spec[0], sid: sj.id, name: name, hours: 1, done: !!spec[1] });
        changed = true;
      });
    });
    const isDemo = !!s.sample || s.subjects.some(x => {
      const key = sampleSubjectKey(x);
      return !!key && key.indexOf('sample.subject.') === 0;
    });
    if (!isDemo) return changed;
    if (!s.flashcards.length) {
      s.flashcards = sampleFlashcards(s.subjects, s.units);
      changed = changed || s.flashcards.length > 0;
    }
    if (!s.questions.length) {
      s.questions = sampleQuestions(s.subjects, s.units);
      changed = changed || s.questions.length > 0;
    }
    return changed;
  }

  function normalizeScale(scale) {
    const d = defaultSettings().scale;
    const s = Object.assign({}, d, scale || {});
    if (s.type === 'letter') {
      s.max = 4;
      s.pass = clamp(Number(s.pass) || 2, 0, 4);
      s.letters = Array.isArray(s.letters) && s.letters.length === 5 ? s.letters : d.letters.slice();
      s.preset = 'A-F';
    } else {
      s.type = 'numeric';
      s.max = Math.max(1, Number(s.max) || 12);
      s.pass = clamp(Number(s.pass) || 0, 0, s.max);
      const preset = SCALE_PRESETS.find(p => p.type === 'numeric' && p.max === s.max && p.pass === s.pass);
      s.preset = preset ? preset.id : 'custom';
      s.letters = d.letters.slice();
    }
    return s;
  }

  function migrate(o) {
    o = o || {};
    demoCardsInjected = false;
    const d = defaults();
    const s = Object.assign({}, d, o);
    /* El schema versionado lo controla esta app, no el archivo importado. */
    s.v = d.v;
    s.schemaVersion = SCHEMA_VERSION;
    s.settings = Object.assign({}, d.settings, o.settings || {});
    // Migrate legacy scale fields
    if (o.settings && (o.settings.scaleMax != null || o.settings.pass != null) && !o.settings.scale) {
      s.settings.scale = normalizeScale({ type: 'numeric', max: o.settings.scaleMax, pass: o.settings.pass, preset: 'custom' });
    } else {
      s.settings.scale = normalizeScale((o.settings && o.settings.scale) || s.settings.scale);
    }
    s.settings.pomo = Object.assign({}, d.settings.pomo, (o.settings && o.settings.pomo) || {});
    const dg = o.settings && o.settings.dailyGoalMin != null ? o.settings.dailyGoalMin : 0;
    s.settings.dailyGoalMin = clamp(Math.round(Number(dg) || 0), 0, 80 * 60);
    s.timer = Object.assign({}, d.timer, o.timer || {});
    if (!s.timer.session || typeof s.timer.session !== 'object') s.timer.session = {};
    s.ui = Object.assign({}, d.ui, o.ui || {});
    ['subjects', 'units', 'blocks', 'exams', 'grades', 'flashcards', 'questions', 'quizHistory'].forEach(k => { if (!Array.isArray(s[k])) s[k] = []; });
    // Recupera demoKey en ejemplos guardados por versiones que no lo tenían.
    backfillSampleKeys(s);
    if (!s.log || typeof s.log !== 'object') s.log = {};
    // Normalize subjects: goalMin es la fuente exacta; goal se mantiene en horas
    // para copias/formatos anteriores. Sin goalMin, goal se lee como horas.
    s.subjects = s.subjects.filter(Boolean).map(x => {
      const rawMin = x.goalMin != null ? Number(x.goalMin) : (Number(x.goal) || 0) * 60;
      const goalMin = clamp(Math.round(rawMin) || 0, 0, 80 * 60);
      return withDemo({
        id: String(x.id || uid()),
        name: String(x.name || T('default.subject')).slice(0, 60),
        color: String(x.color || COLORS[0]),
        goal: goalMin / 60,
        goalMin,
        progress: clamp(Number(x.progress) || 0, 0, 100)
      }, x);
    });
    const subIds = new Set(s.subjects.map(x => x.id));
    /* Un filtro guardado para una materia borrada se resetea a "Todas". */
    if (s.ui && !subIds.has(s.ui.cardSid)) s.ui.cardSid = null;
    if (s.ui && !Array.isArray(s.ui.recoverSeen)) s.ui.recoverSeen = [];
    // Normalize curriculum units (tareas/unidades importadas)
    s.units = s.units.filter(Boolean).map(x => withDemo({
      id: String(x.id || uid()),
      sid: subIds.has(x.sid) ? x.sid : null,
      name: String(x.name || T('curriculum.units.new')).slice(0, 120),
      hours: clamp(Number(x.hours) || 0, 0, 80),
      done: !!x.done
    }, x)).filter(x => x.sid);
    // Normalize active program (carrera activa importada)
    const ap = s.activeProgram;
    s.activeProgram = (ap && typeof ap === 'object' && ap.careerId)
      ? {
          country: String(ap.country || 'INTL').toUpperCase(),
          careerId: String(ap.careerId),
          careerLabel: String(ap.careerLabel || '').slice(0, 120),
          institution: String(ap.institution || '').slice(0, 120),
          institutionId: String(ap.institutionId || '').slice(0, 80),
          institutionSigla: String(ap.institutionSigla || '').slice(0, 40),
          sede: String(ap.sede || '').slice(0, 120),
          title: String(ap.title || '').slice(0, 120),
          period: String(ap.period || 'all'),
          periodLabel: String(ap.periodLabel || '').slice(0, 80),
          label: String(ap.label || '').slice(0, 180),
          importedAt: String(ap.importedAt || ''),
          subjectIds: Array.isArray(ap.subjectIds) ? ap.subjectIds.filter(id => subIds.has(id)) : []
        }
      : null;
    if (s.activeProgram && !s.activeProgram.label) {
      s.activeProgram.label = [
        s.activeProgram.careerLabel || s.activeProgram.title,
        s.activeProgram.institutionSigla || s.activeProgram.institution,
        s.activeProgram.periodLabel
      ].filter(Boolean).join(' · ');
    }
    s.blocks = s.blocks.filter(Boolean).map(b => withDemo({
      id: String(b.id || uid()), day: clamp(Number(b.day) || 0, 0, 6),
      start: normTime(b.start || '08:00'), end: normTime(b.end || '09:00'),
      sid: subIds.has(b.sid) ? b.sid : null, type: b.type === 'estudio' ? 'estudio' : 'clase',
      note: String(b.note || '').slice(0, 40)
    }, b));
    s.exams = s.exams.filter(Boolean).map(e => withDemo({
      id: String(e.id || uid()), sid: subIds.has(e.sid) ? e.sid : null,
      title: String(e.title || T('default.exam')).slice(0, 80),
      kind: ['Parcial', 'Examen', 'Entrega', 'Otro'].includes(e.kind) ? e.kind : 'Examen',
      date: isRealYmd(e.date) ? String(e.date) : todayKey(), time: String(e.time || '')
    }, e));
    s.grades = s.grades.filter(Boolean).map(g => withDemo({
      id: String(g.id || uid()), sid: subIds.has(g.sid) ? g.sid : null,
      name: String(g.name || T('grades.defaultName')).slice(0, 60),
      score: clamp(Number(g.score) || 0, 0, s.settings.scale.max),
      weight: clamp(Number(g.weight) || 0, 0, 100)
    }, g)).filter(g => g.sid);
    // Normalize flashcards: cada tarjeta guarda su propia historia de repasos.
    const validDue = (v, fallback) => isRealYmd(v) ? String(v) : fallback;
    s.flashcards = s.flashcards.filter(Boolean).map(c => {
      const due = validDue(c.due, todayKey());
      const interval = clamp(Math.round(Number(c.interval) || 0), 0, 365);
      const history = Array.isArray(c.history) ? c.history.filter(Boolean).map(h => ({
        at: String(h.at || '').slice(0, 40),
        grade: ['hard', 'good', 'easy'].indexOf(h.grade) >= 0 ? h.grade : 'good',
        interval: clamp(Math.round(Number(h.interval) || 0), 0, 365),
        due: validDue(h.due, due)
      })).slice(-200) : [];
      const base = {
        id: String(c.id || uid()),
        sid: subIds.has(c.sid) ? c.sid : null,
        unitId: String(c.unitId || '').slice(0, 80),
        front: String(c.front || T('modal.card.front')).slice(0, 300),
        back: String(c.back || '').slice(0, 500),
        createdAt: String(c.createdAt || new Date().toISOString()).slice(0, 40),
        due: due, interval: interval,
        ease: clamp(Number(c.ease) || 2.5, 1.3, 3),
        reps: clamp(Math.round(Number(c.reps) || 0), 0, 10000),
        lapses: clamp(Math.round(Number(c.lapses) || 0), 0, 10000),
        lastReview: String(c.lastReview || '').slice(0, 40),
        history: history
      };
      const out = withDemo(base, c, ['flashcards', 'front', 'demoKey']);
      return withDemo(out, c, ['flashcards', 'back', 'demoBackKey']);
    }).filter(c => c.sid);
    /* Repara primero los datos de ejemplo: así las preguntas de muestra
       encuentran las unidades recién creadas y apuntan a temas reales. */
    demoCardsInjected = demoData(s);
    /* Etapa 2: banco de preguntas e historial de simulacros. */
    s.questions = normalizeQuestions(s.questions, subIds, s.units);
    s.quizHistory = normalizeQuizHistory(s.quizHistory, subIds);
    // Clean log
    const cleanLog = {};
    Object.keys(s.log).forEach(k => {
      if (!isRealYmd(k) || typeof s.log[k] !== 'object') return;
      const row = {};
      Object.keys(s.log[k]).forEach(sid => { if (subIds.has(sid) && Number(s.log[k][sid]) > 0) row[sid] = Number(s.log[k][sid]); });
      if (Object.keys(row).length) cleanLog[k] = row;
    });
    s.log = cleanLog;
    return s;
  }

  function load() {
    /* Migracion automatica localStorage -> IndexedDB (una sola vez). */
    initIDB();
    if (!storageOk) return null;
    try {
      let parsed = memoryState;
      if (!parsed && !initPromise) {
        let raw = localStorage.getItem(KEY);
        if (!raw) raw = localStorage.getItem(LEGACY_KEY);
        if (raw) parsed = JSON.parse(raw);
      }
      if (!parsed) return null;
      if (parsed.app === 'studyflow' && parsed.data) parsed = parsed.data;
      const state = migrate(parsed);
      /* Persiste apenas se inyectan las tarjetas demo: así mantienen sus ids
         e historial y no se regeneran en cada arranque. */
      if (demoCardsInjected) save(state);
      return state;
    } catch (e) { return null; }
  }

  function save(state, opts) {
    state.schemaVersion = SCHEMA_VERSION;
    memoryState = state;
    /* Escritura principal directa en IndexedDB; localStorage no participa. */
    const writes = Promise.all([writeIDB(state), mirrorQuizData(state)]);
    const settled = writes.then(function () {
      /* Sólo se cierra un error previo cuando AMBAS escrituras confirmaron. */
      clearStorageError(); storageOk = true;
      return true;
    }, function (e) {
      idbFailed = true; storageOk = false;
      if (!lastStorageError) emitStorageError(e, 'IndexedDB (guardado)');
      throw e;
    });
    lastSavePromise = settled;
    /* Las llamadas históricas ignoran el resultado: consume el rechazo para no
       generar unhandled rejection sin cambiar la API síncrona. */
    settled.catch(function () {});
    if (opts && opts.wait) return settled;
    return persistStatus();
  }
  function savePromise() { return lastSavePromise; }

  /* Seis tarjetas traducibles vinculadas a las materias de ejemplo. Se usan
     al crear el demo y al reparar un estado demo que llegó sin flashcards. */
  function sampleFlashcards(subjects, units) {
    const list = Array.isArray(subjects) ? subjects : [];
    const unitList = Array.isArray(units) ? units : [];
    const sidFor = (subjectKey) => {
      const found = list.find(x => x && demoKeyOf(x) === subjectKey);
      if (found) return found.id;
      /* Si la materia se renombró y perdió demoKey, se reconoce por su texto
         original en cualquiera de los idiomas de ejemplo. */
      let names = [];
      SAMPLE_LANGS.forEach(lang => {
        let v;
        try { v = I ? I.raw(subjectKey, lang) : null; } catch (e) { v = null; }
        if (typeof v === 'string' && v !== subjectKey) names.push(normSampleText(v));
      });
      const byText = list.find(x => x && names.indexOf(normSampleText(x.name)) >= 0);
      return byText ? byText.id : null;
    };
    const t = new Date();
    /* Cuatro vencidas hoy/ayer y dos ya dominadas, acordes al parcial de
       Economía que viene en 6 días. */
    const fc = (subjectKey, unitKey, qk, ak, off, interval, reps, lapses) => {
      const sid = sidFor(subjectKey);
      if (!sid) return null;
      const unit = unitList.find(u => u && u.sid === sid && demoKeyOf(u) === unitKey);
      const reviewed = interval > 0;
      const at = reviewed ? new Date(Date.now() - Math.max(1, off) * 86400000).toISOString() : '';
      const due = ymd(addDays(t, off));
      return {
        id: uid(), sid, unitId: unit ? unit.id : '', demoKey: qk, demoBackKey: ak,
        front: T(qk), back: T(ak), createdAt: new Date().toISOString(),
        due, interval, ease: 2.5, reps, lapses, lastReview: at,
        history: reviewed ? [{ at, grade: lapses ? 'hard' : 'good', interval, due }] : []
      };
    };
    return [
      fc('sample.subject.econ', 'sample.unit.econ.supply', 'sample.card.econ.supply.q', 'sample.card.econ.supply.a', 6, 8, 3, 0),
      fc('sample.subject.econ', 'sample.unit.econ.supply', 'sample.card.econ.elasticity.q', 'sample.card.econ.elasticity.a', 0, 1, 1, 1),
      fc('sample.subject.writing', 'sample.unit.writing.arguments', 'sample.card.writing.argument.q', 'sample.card.writing.argument.a', 9, 12, 4, 0),
      fc('sample.subject.writing', 'sample.unit.writing.arguments', 'sample.card.writing.coherence.q', 'sample.card.writing.coherence.a', 0, 0, 0, 0),
      fc('sample.subject.history', 'sample.unit.history.causes', 'sample.card.history.causes.q', 'sample.card.history.causes.a', -1, 3, 2, 1),
      fc('sample.subject.stats', 'sample.unit.stats.descriptive', 'sample.card.stats.mean.q', 'sample.card.stats.mean.a', 0, 2, 2, 0)
    ].filter(Boolean);
  }

  /* ---------- Etapa 2: banco de preguntas y simulacros ---------- */

  function normalizeQuestions(list, subIds, units) {
    const unitIds = new Set((units || []).filter(Boolean).map(u => String(u.id)));
    return (list || []).filter(Boolean).map(q => {
      const sid = subIds.has(q.sid) ? q.sid : null;
      const uidUnit = unitIds.has(q.unitId) ? q.unitId : '';
      const rawOptions = Array.isArray(q.options) ? q.options : [];
      const options = [0, 1, 2, 3].map(i => String(rawOptions[i] == null ? '' : rawOptions[i]).trim().slice(0, 300));
      const answer = clamp(Math.round(Number(q.answer) || 0), 0, 3);
      const demoOptionKeys = Array.isArray(q.demoOptionKeys)
        ? q.demoOptionKeys.map(k => (typeof k === 'string' && k ? k.slice(0, 120) : null)) : null;
      const base = {
        id: String(q.id || uid()), sid: sid,
        unitId: (units || []).some(u => u.id === uidUnit && u.sid === sid) ? uidUnit : '',
        text: String(q.text || '').trim().slice(0, 500),
        options: options, answer: answer,
        createdAt: String(q.createdAt || new Date().toISOString()).slice(0, 40),
        demoOptionKeys: demoOptionKeys,
        fromCards: !!q.fromCards
      };
      return base.text && options.every(Boolean) ? withDemo(base, q) : null;
    }).filter(Boolean);
  }

  /* Devuelve la pregunta normalizada o null cuando no es aprovechable. */
  function normalizeQuestion(q, subIds, units) {
    if (!q || typeof q !== 'object') return null;
    const sid = subIds.has(q.sid) ? q.sid : null;
    if (!sid) return null;
    const out = normalizeQuestions([q], subIds, units)[0];
    return out && out.text && out.options.every(Boolean) ? out : null;
  }

  function normalizeQuizHistory(list, subIds) {
    return (list || []).filter(Boolean).map(r => {
      const sid = subIds.has(r.sid) ? r.sid : null;
      const total = clamp(Math.round(Number(r.total) || 0), 0, 5000);
      const correct = clamp(Math.round(Number(r.correct) || 0), 0, total);
      const answers = Array.isArray(r.answers) ? r.answers.slice(-500).filter(Boolean).map(a => ({
        qid: String(a.qid || ''), unitId: a.unitId ? String(a.unitId).slice(0, 80) : '',
        chosen: a.chosen == null || a.chosen === '' ? -1 : clamp(Math.round(Number(a.chosen) || 0), -1, 3),
        answer: clamp(Math.round(Number(a.answer) || 0), 0, 3),
        ok: !!a.ok
      })) : [];
      return {
        id: String(r.id || uid()), sid: sid, unitId: r.unitId ? String(r.unitId).slice(0, 80) : '',
        at: String(r.at || new Date().toISOString()).slice(0, 40),
        minutes: clamp(Math.round(Number(r.minutes) || 10), 1, 180),
        total: total, correct: correct, wrong: total - correct,
        percent: clamp(Math.round(Number(r.percent) || (total ? correct / total * 100 : 0)), 0, 100),
        score: clamp(Number(r.score) || 0, 0, 1000),
        grade: String(r.grade || '').slice(0, 20),
        pass: !!r.pass,
        scale: r.scale && typeof r.scale === 'object'
          ? { type: r.scale.type === 'letter' ? 'letter' : 'numeric', max: clamp(Number(r.scale.max) || 12, 1, 1000), pass: clamp(Number(r.scale.pass) || 0, 0, 1000) }
          : null,
        answers: answers
      };
    }).filter(r => r.sid && r.total > 0).slice(-100);
  }

  function newQuestion(sid, unitId, text, options, answer) {
    return {
      id: uid(), sid: sid || null, unitId: unitId || '',
      text: String(text || '').trim().slice(0, 500),
      options: [0, 1, 2, 3].map(i => String((options || [])[i] || '').trim().slice(0, 300)),
      answer: clamp(Math.round(Number(answer) || 0), 0, 3),
      createdAt: new Date().toISOString(), demoOptionKeys: null
    };
  }

  /* Generación instantánea de simulacros desde flashcards. El frente es el
     enunciado, el reverso la respuesta correcta y tres reversos distintos de
     otras tarjetas las distractoras. Sólo se usa cuando hay pocas preguntas
     manuales: el banco escrito por la persona nunca se sobrescribe. */
  const AUTO_QUIZ_MIN_MANUAL = 4;
  const AUTO_QUIZ_MAX_GENERATED = 12;
  function shuffled(arr) {
    const a = (arr || []).slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function isManualQuestion(q) {
    return !!(q && !q.demoKey && !q.fromCards);
  }
  /* Arma preguntas de cuatro opciones. En la importación se prefieren las
     distractoras de la propia materia; en el simulacro se mantiene el orden
     aleatorio global de siempre. `cards` llega filtrado (sin enunciados ya
     presentes en el banco). */
  function buildQuestionsFromCards(state, sid, cards, limit, markFromCards, preferOwn) {
    const all = (state.flashcards || []).filter(c => c && String(c.back || '').trim());
    const pool = preferOwn
      ? all.filter(c => c.sid === sid).concat(all.filter(c => c.sid !== sid))
      : all;
    const out = [];
    const seen = new Set();
    (cards || []).forEach(card => {
      if (out.length >= limit) return;
      const front = String(card.front || '').trim().slice(0, 500);
      const fk = normSampleText(front);
      if (!fk || seen.has(fk)) return;
      const right = String(card.back || '').trim().slice(0, 300);
      const used = Object.create(null);
      used[normSampleText(right)] = true;
      const distractors = [];
      shuffled(pool.filter(c => c.id !== card.id)).forEach(c => {
        if (distractors.length >= 3) return;
        const text = String(c.back || '').trim().slice(0, 300);
        const k = normSampleText(text);
        if (!text || !k || used[k]) return;
        used[k] = true;
        distractors.push(text);
      });
      if (distractors.length < 3) return;
      const answer = Math.floor(Math.random() * 4);
      const options = distractors.slice();
      options.splice(answer, 0, right);
      const q = newQuestion(sid, card.unitId, front, options, answer);
      /* En el simulacro se marcan como generadas; al importarlas al banco son
         preguntas normales, editables y eliminables como cualquier otra. */
      if (markFromCards) { q.fromCards = true; q.cardId = String(card.id || ''); }
      seen.add(fk);
      out.push(q);
    });
    return out;
  }
  function generateQuestionsFromCards(state, sid, opts) {
    if (!state || !sid) return [];
    const own = cardsBy(state, sid).filter(c => c && String(c.front || '').trim() && String(c.back || '').trim());
    const minManual = opts && Number.isFinite(opts.minManual) ? opts.minManual : AUTO_QUIZ_MIN_MANUAL;
    const manual = (state.questions || []).filter(q => q && q.sid === sid && isManualQuestion(q)).length;
    if (manual >= minManual) return [];
    const limit = Math.min(own.length, clamp(Math.round((opts && opts.limit) || AUTO_QUIZ_MAX_GENERATED), 1, 100));
    const seen = new Set((state.questions || []).filter(q => q.sid === sid).map(q => normSampleText(q.text)));
    const pending = shuffled(own).filter(c => !seen.has(normSampleText(String(c.front || '').trim())));
    return buildQuestionsFromCards(state, sid, pending, limit, true, false);
  }
  /* Convierte las flashcards de una materia en preguntas guardadas en el banco.
     Devuelve el motivo cuando no hay nada que importar para avisar sin fallos:
     'few' (menos de dos tarjetas), 'all' (ya importadas) u 'options' (faltan
     respuestas distintas para completar cuatro opciones). */
  function importQuestionsFromCards(state, sid) {
    if (!state || !sid) return { added: 0, reason: 'few', total: 0 };
    const own = cardsBy(state, sid).filter(c => c && String(c.front || '').trim() && String(c.back || '').trim());
    if (own.length < 2) return { added: 0, reason: 'few', total: own.length };
    const seen = new Set((state.questions || []).filter(q => q.sid === sid).map(q => normSampleText(q.text)));
    const pending = own.filter(c => !seen.has(normSampleText(String(c.front || '').trim())));
    if (!pending.length) return { added: 0, reason: 'all', total: own.length };
    const generated = buildQuestionsFromCards(state, sid, pending, pending.length, false, true);
    if (!generated.length) return { added: 0, reason: 'options', total: own.length };
    if (!Array.isArray(state.questions)) state.questions = [];
    generated.forEach(q => {
      state.questions.push(q);
      seen.add(normSampleText(q.text));
    });
    return { added: generated.length, reason: 'ok', total: own.length };
  }

  /* Cinco preguntas traducibles, repartidas entre las cuatro materias demo.
     Varias quedan asociadas a una unidad para que el dominio por tema tenga
     componente de simulacro desde el primer arranque. */
  function sampleQuestions(subjects, units) {
    const list = Array.isArray(subjects) ? subjects : [];
    const unitList = Array.isArray(units) ? units : [];
    const sidFor = (subjectKey) => {
      const found = list.find(x => x && demoKeyOf(x) === subjectKey);
      if (found) return found.id;
      let names = [];
      SAMPLE_LANGS.forEach(lang => {
        let v;
        try { v = I ? I.raw(subjectKey, lang) : null; } catch (e) { v = null; }
        if (typeof v === 'string' && v !== subjectKey) names.push(normSampleText(v));
      });
      const byText = list.find(x => x && names.indexOf(normSampleText(x.name)) >= 0);
      return byText ? byText.id : null;
    };
    const uidFor = (sid, unitKey) => {
      const found = unitList.find(u => u && u.sid === sid && demoKeyOf(u) === unitKey);
      return found ? found.id : '';
    };
    const mk = (subjectKey, unitKey, slug, correct) => {
      const sid = sidFor(subjectKey);
      if (!sid) return null;
      const keys = ['q', 'o1', 'o2', 'o3', 'o4'].map(sfx => 'sample.q.' + slug + '.' + sfx);
      return {
        id: uid(), sid: sid, unitId: uidFor(sid, unitKey),
        text: T(keys[0]),
        options: keys.slice(1).map(k => T(k)),
        answer: correct,
        createdAt: new Date().toISOString(),
        demoKey: keys[0], demoOptionKeys: keys.slice(1)
      };
    };
    return [
      mk('sample.subject.econ', 'sample.unit.econ.supply', 'econ.supply', 0),
      mk('sample.subject.econ', 'sample.unit.econ.policy', 'econ.policy', 2),
      mk('sample.subject.writing', 'sample.unit.writing.arguments', 'writing.argument', 0),
      mk('sample.subject.history', 'sample.unit.history.causes', 'history.causes', 3),
      mk('sample.subject.stats', 'sample.unit.stats.descriptive', 'stats.mean', 2)
    ].filter(Boolean);
  }

  /** Nota obtenida en un simulacro, expresada en la escala configurada. */
  function quizScore(correct, total, scale) {
    const n = Math.max(0, Math.round(total || 0));
    const c = clamp(Math.round(correct || 0), 0, n);
    const percent = n ? Math.round(c / n * 100) : 0;
    const sc = normalizeScale(scale);
    const score = sc.type === 'letter'
      ? clamp(Math.round(percent / 100 * 4), 0, 4)
      : Math.round(percent / 100 * sc.max * 100) / 100;
    return {
      correct: c, wrong: n - c, percent: percent, score: score,
      grade: formatGrade(score, sc), pass: score >= sc.pass,
      scale: { type: sc.type, max: sc.max, pass: sc.pass }
    };
  }

  function finishQuiz(state, record) {
    if (!state || !record) return null;
    if (!Array.isArray(state.quizHistory)) state.quizHistory = [];
    state.quizHistory.push(record);
    state.quizHistory = state.quizHistory.slice(-100);
    return record;
  }

  /* Dominio de una unidad: combinación de temario completado, dominio de sus
     flashcards y aciertos en simulacros. Los componentes ausentes no penalizan;
     sus pesos se redistribuyen entre los disponibles. */
  function unitMastery(state, sid, unitId) {
    const out = { pct: 0, parts: { tasks: null, cards: null, quiz: null }, answers: 0 };
    if (!state || !unitId) return out;
    const unit = unitsBy(state, sid).find(u => u && u.id === unitId);
    if (unit) out.parts.tasks = unit.done ? 100 : 0;
    const cards = cardsBy(state, sid).filter(c => c.unitId === unitId);
    if (cards.length) {
      const mastered = cards.filter(c => c.reps >= 2 && c.interval >= 7 && c.lapses <= 1).length;
      out.parts.cards = Math.round(mastered / cards.length * 100);
    }
    let correct = 0, total = 0;
    (state.quizHistory || []).forEach(r => {
      if (!r || r.sid !== sid) return;
      (r.answers || []).forEach(a => {
        if (!a || a.unitId !== unitId) return;
        total++; if (a.ok) correct++;
      });
    });
    out.answers = total;
    if (total) out.parts.quiz = Math.round(correct / total * 100);
    const weights = { tasks: 0.25, cards: 0.35, quiz: 0.40 };
    let sum = 0, wsum = 0;
    Object.keys(weights).forEach(k => {
      if (out.parts[k] == null) return;
      sum += out.parts[k] * weights[k]; wsum += weights[k];
    });
    out.pct = wsum ? clamp(Math.round(sum / wsum), 0, 100) : 0;
    return out;
  }

  function sampleState() {
    const s = defaults();
    s.sample = true;
    const t = new Date();
    /* Cada texto de ejemplo se guarda con su demoKey: el valor visible es el
       idioma actual, pero puede recalcularse cuando cambie el selector. */
    const mk = (key, color, goalMin, progress) => ({
      id: uid(), demoKey: key, name: T(key), color, goal: goalMin / 60, goalMin, progress
    });
    const a = mk('sample.subject.econ', COLORS[0], 300, 45);
    const b = mk('sample.subject.writing', COLORS[3], 240, 30);
    const c = mk('sample.subject.history', COLORS[2], 240, 60);
    const d = mk('sample.subject.stats', COLORS[4], 180, 15);
    s.subjects = [a, b, c, d];
    const bl = (day, start, end, sid, type, note, key) => Object.assign({
      id: uid(), day, start: normTime(start), end: normTime(end), sid, type, note: note || ''
    }, key ? { demoKey: key } : {});
    s.blocks = [
      bl(0, '08:15', '09:00', a.id, 'clase', T('sample.room'), 'sample.room'), bl(0, '18:30', '20:45', b.id, 'estudio'),
      bl(1, '10:00', '12:00', b.id, 'clase'), bl(1, '18:00', '19:00', d.id, 'estudio'),
      bl(2, '08:00', '10:00', a.id, 'clase', T('sample.room'), 'sample.room'), bl(2, '16:00', '17:30', c.id, 'estudio'),
      bl(3, '10:00', '12:00', c.id, 'clase'), bl(3, '14:00', '16:00', d.id, 'clase'),
      bl(4, '09:00', '11:00', d.id, 'clase'), bl(5, '10:00', '12:00', a.id, 'estudio')
    ];
    const un = (sid, key, hours, done) => ({
      id: uid(), demoKey: key, sid, name: T(key), hours, done
    });
    s.units = [
      un(a.id, 'sample.unit.econ.concepts', 1.25, true),
      un(a.id, 'sample.unit.econ.supply', 1.25, true),
      un(a.id, 'sample.unit.econ.market', 1.25, false),
      un(a.id, 'sample.unit.econ.policy', 1.25, false),
      un(b.id, 'sample.unit.writing.structure', 1, true),
      un(b.id, 'sample.unit.writing.arguments', 1, false),
      un(b.id, 'sample.unit.writing.style', 1, false),
      un(b.id, 'sample.unit.writing.review', 1, false),
      un(c.id, 'sample.unit.history.causes', 1, true),
      un(c.id, 'sample.unit.history.process', 1, true),
      un(c.id, 'sample.unit.history.sources', 1, false),
      un(c.id, 'sample.unit.history.legacy', 1, false),
      un(d.id, 'sample.unit.stats.descriptive', 0.75, true),
      un(d.id, 'sample.unit.stats.probability', 0.75, false),
      un(d.id, 'sample.unit.stats.sampling', 0.75, false),
      un(d.id, 'sample.unit.stats.inference', 0.75, false)
    ];
    const ex = (sid, key, kind, off, time) => ({
      id: uid(), demoKey: key, sid, title: T(key), kind, date: ymd(addDays(t, off)), time: time || ''
    });
    s.exams = [
      ex(a.id, 'sample.exam.midterm', 'Parcial', 6, '09:00'),
      ex(b.id, 'sample.exam.delivery', 'Entrega', 13),
      ex(c.id, 'sample.exam.unit', 'Examen', 21, '14:00'),
      ex(d.id, 'sample.exam.midterm', 'Parcial', 34),
      ex(a.id, 'sample.exam.reading', 'Otro', -5)
    ];
    const g = (sid, key, score, weight) => ({ id: uid(), demoKey: key, sid, name: T(key), score, weight });
    s.grades = [
      g(a.id, 'sample.grade.midterm', 9, 30), g(a.id, 'sample.grade.task', 10, 10),
      g(b.id, 'sample.grade.test', 7, 25), g(b.id, 'sample.grade.essay', 8, 15),
      g(c.id, 'sample.grade.midterm', 5, 30), g(d.id, 'sample.grade.practical', 6, 20)
    ];
    s.flashcards = sampleFlashcards(s.subjects, s.units);
    s.questions = sampleQuestions(s.subjects, s.units);
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 1; i <= 13; i++) {
      if (rnd() < 0.2) continue;
      const k = ymd(addDays(t, -i));
      s.log[k] = {};
      s.subjects.forEach(x => { if (rnd() < 0.6) s.log[k][x.id] = Math.round(20 + rnd() * 80) * 60; });
    }
    s.timer.sid = a.id;
    return s;
  }

  function sub(state, id) { return state.subjects.find(x => x.id === id) || null; }
  function unitsBy(state, sid) {
    if (!state || !Array.isArray(state.units)) return [];
    const list = state.units.filter(x => x && x.sid === sid);
    const s = sub(state, sid);
    if (!s) return list;
    /* Temas que aún viven sólo dentro de la materia también son unidades
       válidas para el temario, el dominio y los desplegables. */
    const ids = new Set(list.map(u => String(u.id)));
    const names = new Set(list.map(u => normSampleText(u.name)));
    subjectUnitEntries(s).forEach(e => {
      const nameKey = normSampleText(e.name);
      if (!nameKey) return;
      if (e.id && ids.has(String(e.id))) return;
      if (names.has(nameKey)) return;
      const u = {
        id: e.id || textUnitId(sid, e.name), sid: sid,
        name: e.name, hours: e.hours || 0, done: !!e.done
      };
      if (e.demoKey) u.demoKey = e.demoKey;
      list.push(u); ids.add(u.id); names.add(nameKey);
    });
    return list;
  }
  function unitStats(state, sid) {
    const list = unitsBy(state, sid);
    return { total: list.length, done: list.filter(x => x.done).length };
  }
  function syncProgress(state, sid) {
    const s = sub(state, sid);
    if (!s) return;
    const st = unitStats(state, sid);
    s.progress = st.total ? Math.round((st.done / st.total) * 100) : s.progress;
  }

  /* ---- Flashcards: repetición espaciada simple (SM-2 simplificado) ---- */

  function cardsBy(state, sid) {
    if (!state || !Array.isArray(state.flashcards)) return [];
    return sid ? state.flashcards.filter(c => c.sid === sid) : state.flashcards.slice();
  }
  function dueCards(state, sid) {
    const k = todayKey();
    return cardsBy(state, sid).filter(c => c.due <= k).sort((a, b) => a.due.localeCompare(b.due));
  }
  function newCard(sid, front, back, unitId) {
    const now = new Date().toISOString();
    return {
      id: uid(), sid: sid || null, unitId: unitId || '',
      front: String(front || '').trim().slice(0, 300),
      back: String(back || '').trim().slice(0, 500),
      createdAt: now, due: todayKey(), interval: 0, ease: 2.5,
      reps: 0, lapses: 0, lastReview: '', history: []
    };
  }
  /* Califica un repaso y devuelve la misma tarjeta con su próxima fecha. */
  function scheduleCard(card, grade, now) {
    if (!card) return card;
    now = now || new Date();
    const g = ['hard', 'good', 'easy'].indexOf(grade) >= 0 ? grade : 'good';
    const reps = clamp(Math.round(Number(card.reps) || 0), 0, 10000);
    let interval = clamp(Math.round(Number(card.interval) || 0), 0, 365);
    let ease = clamp(Number(card.ease) || 2.5, 1.3, 3);
    let lapses = clamp(Math.round(Number(card.lapses) || 0), 0, 10000);
    if (g === 'hard') {
      ease = clamp(ease - 0.2, 1.3, 3); lapses++;
      interval = reps <= 0 ? 1 : Math.max(1, Math.round(interval * 1.2));
    } else if (g === 'good') {
      interval = reps <= 0 ? 1 : reps === 1 ? 3 : Math.max(2, Math.round(interval * ease));
    } else {
      ease = clamp(ease + 0.15, 1.3, 3);
      interval = reps <= 0 ? 3 : reps === 1 ? 6 : Math.max(4, Math.round(interval * ease * 1.3));
    }
    interval = clamp(interval, 1, 365);
    const at = now.toISOString(), due = ymd(addDays(now, interval));
    card.reps = reps + 1; card.lapses = lapses; card.ease = ease;
    card.interval = interval; card.due = due; card.lastReview = at;
    if (!Array.isArray(card.history)) card.history = [];
    card.history.push({ at, grade: g, interval, due });
    card.history = card.history.slice(-200);
    return card;
  }
  /* pct === null cuando la materia no tiene tarjetas (no penaliza el examen). */
  function cardStats(state, sid) {
    const list = cardsBy(state, sid), k = todayKey();
    const due = list.filter(c => c.due <= k).length;
    const mastered = list.filter(c => c.reps >= 2 && c.interval >= 7 && c.lapses <= 1).length;
    return {
      total: list.length, due: due, mastered: mastered,
      pct: list.length ? Math.round(mastered / list.length * 100) : null
    };
  }
  function addLog(state, sid, sec, key) {
    key = key || todayKey();
    if (!sid || !sec) return;
    state.log[key] = state.log[key] || {};
    state.log[key][sid] = (state.log[key][sid] || 0) + sec;
  }
  function daySec(state, k) { const r = state.log[k]; return r ? Object.values(r).reduce((a, b) => a + b, 0) : 0; }
  function totalSec(state, sid) { let s = 0; for (const k in state.log) s += (state.log[k][sid] || 0); return s; }
  function weekDates() { const t = new Date(); const m = addDays(t, -dayIdx(t)); return [0, 1, 2, 3, 4, 5, 6].map(i => ymd(addDays(m, i))); }
  function secBy(state, sid, ds) { return ds.reduce((a, k) => a + ((state.log[k] && state.log[k][sid]) || 0), 0); }
  function streak(state) {
    let n = 0, d = new Date();
    if (daySec(state, ymd(d)) < 60) d = addDays(d, -1);
    while (daySec(state, ymd(d)) >= 60) { n++; d = addDays(d, -1); }
    return n;
  }

  function formatGrade(score, scale) {
    if (scale.type === 'letter') {
      const idx = clamp(Math.round(score), 0, 4);
      return scale.letters[idx] || 'F';
    }
    return num(score, 2);
  }

  function formatScaleMax(scale) { return scale.type === 'letter' ? 'A' : num(scale.max); }
  function formatScalePass(scale) { return scale.type === 'letter' ? (scale.letters[scale.pass] || 'C') : num(scale.pass); }

  function exportJSON(state) {
    return JSON.stringify({
      app: 'StudyFlow',
      appId: 'studyflow',
      schemaVersion: SCHEMA_VERSION,
      exportDate: new Date().toISOString().slice(0, 10),
      exportedAt: new Date().toISOString(),
      data: state
    }, null, 2);
  }

  /* Valida origen/estructura antes de reemplazar el estado actual. */
  function validateBackup(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) {
      return { ok: false, msgText: 'El archivo no contiene un respaldo válido.' };
    }
    if (o.app && String(o.app).toLowerCase() !== 'studyflow') {
      return { ok: false, msgText: 'Este respaldo pertenece a otra aplicación y no se importará.' };
    }
    if (o.appId && String(o.appId).toLowerCase() !== 'studyflow') {
      return { ok: false, msgText: 'Este respaldo pertenece a otra aplicación y no se importará.' };
    }
    const sv = o.schemaVersion == null ? 1 : Number(o.schemaVersion);
    if (!isFinite(sv) || sv < 1 || sv > SCHEMA_VERSION) {
      return { ok: false, msgText: 'La versión de esquema del respaldo no es compatible.' };
    }
    const data = (o.data && typeof o.data === 'object') ? o.data : o;
    if (!Array.isArray(data.subjects)) {
      return { ok: false, msgText: 'El respaldo está incompleto: no contiene materias válidas.' };
    }
    let bad = false;
    ['units', 'blocks', 'exams', 'grades', 'flashcards', 'questions', 'quizHistory'].forEach(function (k) {
      if (data[k] !== undefined && !Array.isArray(data[k])) bad = true;
    });
    /* Etapa 2: además del tipo de sección, se comprueba la forma mínima de
       preguntas y resultados para no importar un banco inutilizable. */
    if (Array.isArray(data.questions) && data.questions.some(function (q) {
      return !q || typeof q !== 'object' || typeof q.text !== 'string' || !Array.isArray(q.options);
    })) bad = true;
    if (Array.isArray(data.quizHistory) && data.quizHistory.some(function (r) {
      return !r || typeof r !== 'object' || !Array.isArray(r.answers) || typeof r.total !== 'number';
    })) bad = true;
    if (bad) return { ok: false, msgText: 'El respaldo está dañado: algunas secciones no son válidas.' };
    if (data.log !== undefined && (typeof data.log !== 'object' || Array.isArray(data.log))) {
      return { ok: false, msgText: 'El respaldo está dañado: el registro de horas no es válido.' };
    }
    /* Las fechas imposibles (p. ej. 2026-02-30) se rechazan antes de
       reemplazar el estado actual; migrate() las normalizaría en silencio.
       Un campo ausente o vacío cuenta como "sin fecha" y migrate lo completa. */
    const badDate = (v) => v !== undefined && v !== null && v !== '' && !isRealYmd(v);
    const impossibleDate =
      (Array.isArray(data.exams) && data.exams.some(function (e) { return e && badDate(e.date); })) ||
      (Array.isArray(data.flashcards) && data.flashcards.some(function (c) {
        return c && (badDate(c.due) || (Array.isArray(c.history) && c.history.some(function (h) {
          return h && badDate(h.due);
        })));
      })) ||
      (data.log && Object.keys(data.log).some(function (k) { return !isRealYmd(k); }));
    if (impossibleDate) return { ok: false, msgText: 'El respaldo contiene fechas imposibles.' };
    return { ok: true, data: data, version: sv };
  }

  function csvEscape(v) {
    const s = String(v == null ? '' : v);
    /* Neutraliza fórmulas en Excel/Sheets sin tocar el dato en memoria ni en
       IndexedDB: el apóstrofe sólo viaja en el archivo exportado. */
    const safe = typeof v === 'string' && /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
    return /[",\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
  }

  function exportCSV(state) {
    const lines = [];
    const push = (section, row) => lines.push([section].concat(row).map(csvEscape).join(','));
    lines.push('section,id,subject,date,name,value,weight,type,start,end,note');
    state.subjects.forEach(s => push(T('csv.section.subject'), [s.id, s.name, '', '', s.goalMin, s.progress, s.color, '', '', '']));
    state.units.forEach(u => {
      const sb = sub(state, u.sid);
      push(T('csv.section.unit'), [u.id, sb ? sb.name : '', '', u.name, u.done ? 1 : 0, u.hours, '', '', '', '']);
    });
    state.grades.forEach(g => {
      const sb = sub(state, g.sid);
      push(T('csv.section.grade'), [g.id, sb ? sb.name : '', '', g.name, g.score, g.weight, state.settings.scale.type, '', '', '']);
    });
    Object.keys(state.log).sort().forEach(date => {
      Object.keys(state.log[date]).forEach(sid => {
        const sb = sub(state, sid);
        push(T('csv.section.log'), ['', sb ? sb.name : sid, date, '', Math.round(state.log[date][sid] / 60), '', T('unit.minute'), '', '', '']);
      });
    });
    state.exams.forEach(e => {
      const sb = sub(state, e.sid);
      push(T('csv.section.exam'), [e.id, sb ? sb.name : '', e.date, e.title, '', '', e.kind, e.time, '', '']);
    });
    state.blocks.forEach(b => {
      const sb = sub(state, b.sid);
      push(T('csv.section.block'), [b.id, sb ? sb.name : '', '', '', '', '', b.type, b.start, b.end, T('days.short')[b.day] + (b.note ? ' ' + b.note : '')]);
    });
    /* El historial completo viaja en el JSON; el CSV resume cada tarjeta. */
    (state.flashcards || []).forEach(f => {
      const sb = sub(state, f.sid);
      push(T('csv.section.card'), [f.id, sb ? sb.name : '', f.due, f.front, f.back, f.reps, T('csv.section.card'), '', '', f.interval + 'd']);
    });
    return lines.join('\n');
  }

  /* Los días/meses se leen como arreglos; si el diccionario todavía no está
     registrado, I.t devuelve la clave como texto. Nunca propagar ese valor. */
  function dayNames(key, fallback) {
    const v = I ? I.t(key) : null;
    return Array.isArray(v) && v.length === 7 ? v : fallback;
  }

  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  window.SFStore = {
    KEY, LEGACY_KEY, COLORS, SCALE_PRESETS,
    get DAYS() { return dayNames('days.short', DAYS); },
    get DAYS_LONG() { return dayNames('days.long', DAYS_LONG); },
    get MONTHS() { return dayNames('months.short', MONTHS); },
    get MONTHS_LONG() { return dayNames('months.long', MONTHS_LONG); },
    $, $$, esc, uid, pad, ymd, parseYmd, isRealYmd, todayKey, addDays, dayIdx, clamp, fnum, num,
    toMin, normTime, fmtDur, fmtMin, blockMin, fmtClock,
    storageOk: () => storageOk, setStorageOk: (v) => { storageOk = v; },
    defaults, defaultSettings, normalizeScale, migrate, load, save, savePromise, sampleState, localizeSample,
    demoData, sub, unitsBy, unitStats, syncProgress,
    cardsBy, dueCards, newCard, scheduleCard, cardStats,
    addLog, daySec, totalSec, weekDates, secBy, streak,
    /* Etapa 2: banco de preguntas, simulacros y dominio por unidad */
    newQuestion, generateQuestionsFromCards, importQuestionsFromCards,
    sampleQuestions, quizScore, finishQuiz, unitMastery,
    formatGrade, formatScaleMax, formatScalePass,
    exportJSON, exportCSV, downloadFile, validateBackup,
    /* Etapa 1: almacenamiento durable y sin limite de 5 MB */
    DB_NAME, SCHEMA_VERSION, whenReady,
    isIndexedDBReady: () => idbReady && !idbFailed,
    /* Escritura confirmada (save(estado, { wait: true })) y borrado total. */
    clearAllStorage,
    /* Fallo real de persistencia: callback y evento `onStorageError`. */
    STORAGE_ERROR_MESSAGE,
    get onStorageError() { return storageErrorHandler; },
    set onStorageError(fn) { storageErrorHandler = typeof fn === 'function' ? fn : null; },
    lastStorageError: () => lastStorageError,
    isStorageHealthy: persistStatus,
    putFile, getFile, listFiles, deleteFile,
    /* Etapa 2: espejo dedicado en IndexedDB (banco + historial) */
    STORE_QUESTIONS, STORE_QUIZZES, mirrorQuizData, listQuizData
  };
})();