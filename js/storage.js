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
    ['exams', 'title'], ['grades', 'name']
  ];
  function demoKeyOf(x) {
    return x && typeof x.demoKey === 'string' && x.demoKey ? x.demoKey : null;
  }
  function demoText(x) {
    const key = demoKeyOf(x);
    if (!key || !I) return null;
    const v = T(key);
    return typeof v === 'string' && v !== key ? v : null;
  }
  function withDemo(out, x) {
    const key = demoKeyOf(x);
    return key ? Object.assign(out, { demoKey: key }) : out;
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
        if (!item || demoKeyOf(item)) return;
        const n = normSampleText(item[pair[1]]);
        const key = (map && map[n]) || aliases.all[n];
        if (key) { item.demoKey = key; changed = true; }
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
        const text = demoText(item);
        if (text != null && item[pair[1]] !== text) {
          item[pair[1]] = text;
          changed = true;
        }
      });
    });
    return changed;
  }

  const KEY = 'studyflow-v1';
  const LEGACY_KEY = 'panel-estudio-v1';
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
  try { localStorage.setItem('__sf_test', '1'); localStorage.removeItem('__sf_test'); } catch (e) { storageOk = false; }

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
      log: {},
      activeProgram: null,
      settings: defaultSettings(),
      timer: { mode: 'pomo', phase: 'work', status: 'idle', sid: null, startedAt: null, acc: 0, logged: 0, count: 0, seen: 0, session: {} },
      ui: { tab: 'estudio', selDay: dayIdx(new Date()), min: window.innerWidth < 700, cfg: false, pos: null, timerOpen: false }
    };
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
    const d = defaults();
    const s = Object.assign({}, d, o);
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
    ['subjects', 'units', 'blocks', 'exams', 'grades'].forEach(k => { if (!Array.isArray(s[k])) s[k] = []; });
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
      date: String(e.date || todayKey()), time: String(e.time || '')
    }, e));
    s.grades = s.grades.filter(Boolean).map(g => withDemo({
      id: String(g.id || uid()), sid: subIds.has(g.sid) ? g.sid : null,
      name: String(g.name || T('grades.defaultName')).slice(0, 60),
      score: clamp(Number(g.score) || 0, 0, s.settings.scale.max),
      weight: clamp(Number(g.weight) || 0, 0, 100)
    }, g)).filter(g => g.sid);
    // Clean log
    const cleanLog = {};
    Object.keys(s.log).forEach(k => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || typeof s.log[k] !== 'object') return;
      const row = {};
      Object.keys(s.log[k]).forEach(sid => { if (subIds.has(sid) && Number(s.log[k][sid]) > 0) row[sid] = Number(s.log[k][sid]); });
      if (Object.keys(row).length) cleanLog[k] = row;
    });
    s.log = cleanLog;
    return s;
  }

  function load() {
    if (!storageOk) return null;
    try {
      let raw = localStorage.getItem(KEY);
      if (!raw) raw = localStorage.getItem(LEGACY_KEY);
      return raw ? migrate(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }

  function save(state) {
    if (!storageOk) return false;
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { storageOk = false; return false; }
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
  function unitsBy(state, sid) { return state.units.filter(x => x.sid === sid); }
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
    return JSON.stringify(state, null, 2);
  }

  function csvEscape(v) {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
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
    $, $$, esc, uid, pad, ymd, parseYmd, todayKey, addDays, dayIdx, clamp, fnum, num,
    toMin, normTime, fmtDur, fmtMin, blockMin, fmtClock,
    storageOk: () => storageOk, setStorageOk: (v) => { storageOk = v; },
    defaults, defaultSettings, normalizeScale, migrate, load, save, sampleState, localizeSample,
    sub, unitsBy, unitStats, syncProgress, addLog, daySec, totalSec, weekDates, secBy, streak,
    formatGrade, formatScaleMax, formatScalePass,
    exportJSON, exportCSV, downloadFile
  };
})();