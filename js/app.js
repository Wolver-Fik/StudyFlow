/* StudyFlow - app.js */
(function () {
  'use strict';
  const SFS = window.SFStore;
  const SFC = window.SFCurricula;
  const I = window.StudyI18n;
  const L = (key, vars) => I.t(key, vars);
  const C = (base, n, vars) => I.count(base, n, vars);
  /* Etapa 3: topes de renderizado y etiqueta local para "Ver más". */
  const MORE_LABELS = { es: 'Ver más', en: 'Show more', pt: 'Ver mais', fr: 'Voir plus', it: 'Mostra altro', de: 'Mehr anzeigen', ru: 'Показать ещё', ja: 'もっと見る' };
  const moreLabel = n => (MORE_LABELS[I.current && I.current()] || MORE_LABELS.en) + ' (' + n + ')';
  const {
    COLORS, SCALE_PRESETS,
    $, $$, esc, uid, pad, ymd, parseYmd, todayKey, addDays, dayIdx, clamp, fnum, num,
    toMin, normTime, fmtMin, blockMin, fmtClock,
    defaults, normalizeScale, load, save, sampleState,
    sub, unitsBy, unitStats, syncProgress,
    cardsBy, dueCards, newCard, scheduleCard, cardStats,
    newQuestion, generateQuestionsFromCards, importQuestionsFromCards,
    quizScore, finishQuiz, unitMastery,
    addLog, daySec, totalSec, weekDates, secBy, streak,
    formatGrade, formatScaleMax, formatScalePass, exportJSON, exportCSV, downloadFile
  } = SFS;

  /* Duración legible: "2h" / "1h 45m" / "45 min". Nunca redondea a horas. */
  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
    if (h && m) return L('chart.hours', { n: h }) + ' ' + m + L('unit.minuteShort', { n: m });
    if (h) return L('chart.hours', { n: h });
    return m + ' ' + L('unit.minute', { n: m });
  }

  /* goalMin es la fuente exacta de la meta semanal; goal se mantiene en horas
     sólo para copias antiguas. */
  function goalMinOf(s) {
    if (!s) return 0;
    const raw = s.goalMin != null ? Number(s.goalMin) : (Number(s.goal) || 0) * 60;
    return clamp(Math.round(raw) || 0, 0, 80 * 60);
  }
  function setGoalMin(s, mins) {
    if (!s) return;
    s.goalMin = clamp(Math.round(mins) || 0, 0, 80 * 60);
    s.goal = s.goalMin / 60;
  }
  function dailyGoalSec() {
    const explicit = clamp(Math.round(Number(S.settings.dailyGoalMin) || 0), 0, 80 * 60);
    if (explicit) return explicit * 60;
    const weekly = S.subjects.reduce((a, s) => a + goalMinOf(s) * 60, 0);
    return weekly ? weekly / 7 : 0;
  }
  function hoursMinutesInput(mins, hId, mId) {
    const m = clamp(Math.round(mins) || 0, 0, 80 * 60);
    return '<div class="row2">' +
      '<label class="field"><span>' + L('settings.hours') + '</span><input id="' + hId + '" type="number" inputmode="numeric" min="0" max="80" step="1" value="' + Math.floor(m / 60) + '"></label>' +
      '<label class="field"><span>' + L('settings.minutes') + '</span><input id="' + mId + '" type="number" inputmode="numeric" min="0" max="59" step="1" value="' + (m % 60) + '"></label></div>';
  }
  function readHoursMinutes(hId, mId) {
    const a = $('#' + hId), b = $('#' + mId);
    const h = a ? clamp(Math.round(fnum(a.value)) || 0, 0, 80) : 0;
    const m = b ? clamp(Math.round(fnum(b.value)) || 0, 0, 59) : 0;
    return h * 60 + m;
  }

  const D = {
    short: () => I.t('days.short'),
    long: () => I.t('days.long'),
    mon: () => I.t('months.short'),
    monLong: () => I.t('months.long')
  };

  /* El panel es arrastrable en escritorio, pero en móvil debe quedar anclado
     al viewport: una posición guardada en otro dispositivo puede dejarlo
     fuera de pantalla. 768px cubre el iPhone 14 (390px) y tabletas estrechas. */
  const COMPACT_MQ = '(max-width: 768px)';
  function isCompact() {
    return !!(window.matchMedia && window.matchMedia(COMPACT_MQ).matches);
  }
  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  let S = null;
  let modal = null;
  let sliding = false;
  let twNote = '';
  let tickN = 0;
  let drag = null;
  let unitDraft = null;
  let unitSubjectId = null;
  const closedG = new Set();

  /* Sesión de repaso: sólo vive en memoria, así que no ensucia el respaldo. */
  let cardQueue = [];
  let cardIndex = 0;
  let cardFlipped = false;
  const cardGrades = [];

  /* Etapa 2: el simulacro vive en memoria (como el repaso de tarjetas).
     El resultado ya corregido sí se persiste en el historial del estado. */
  let quizOverlay = null;      // 'bank' | 'setup' | 'exam' | 'result' | 'history'
  let quizBankSid = null;
  let quizHistorySid = null;
  let quizSetup = null;        // { sid, unitId, minutes, count }
  let exam = null;             // sesión en curso
  let examTimer = null;
  let lastResult = null;
  let bankReturnSid = null;
  /* Preguntas generadas al vuelo desde tarjetas: no se guardan en el banco,
     pero viven en memoria durante la sesión para que el repaso de falladas
     pueda seguir encontrándolas. */
  let autoQuizzes = Object.create(null);

  const svgIcon = (d, stroke) => '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" ' + (stroke ? 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"' : 'fill="currentColor"') + '>' + d + '</svg>';
  const ic = {
    play: svgIcon('<path d="M8 5.5v13l10-6.5z"/>'),
    pause: svgIcon('<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>'),
    skip: svgIcon('<path d="M5 6l8 6-8 6zM15 6h2v12h-2z"/>'),
    stop: svgIcon('<rect x="6" y="6" width="12" height="12" rx="1.5"/>'),
    min: svgIcon('<path d="M5 12h14"/>', 1),
    expand: svgIcon('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>', 1),
    sliders: svgIcon('<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h9M17 18h3"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="18" r="2"/>', 1),
    x: svgIcon('<path d="M6 6l12 12M18 6 6 18"/>', 1),
    clock: svgIcon('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>', 1),
    book: svgIcon('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/>', 1),
    check: svgIcon('<path d="m5 12.5 4.5 4.5L19 7"/>', 1),
    plus: svgIcon('<path d="M12 5v14M5 12h14"/>', 1),
    trash: svgIcon('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>', 1),
    reset: svgIcon('<path d="M20 11a8 8 0 1 1-2.34-5.66M20 4v6h-6"/>', 1),
    save: svgIcon('<path d="M5 4h11l3 3v13H5zM8 4v6h8V4M8 20v-6h8v6"/>', 1)
  };

  function ringSVG(pct, size, stroke, color, label, value, subLabel) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const p = clamp(pct || 0, 0, 100);
    const off = c - (p / 100) * c;
    const style = color ? ' style="stroke:' + color + '"' : '';
    return '<div class="ring-wrap" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">' +
      '<circle class="ring-bg" cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + r + '" stroke-width="' + stroke + '"></circle>' +
      '<circle class="ring-fg"' + style + ' cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + r + '" stroke-width="' + stroke + '" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '"></circle>' +
      '</svg>' +
      '<div class="ring-center"><div class="ring-value">' + esc(value) + '</div>' + (label ? '<div class="ring-label">' + esc(label) + '</div>' : '') + (subLabel ? '<div class="ring-label" style="opacity:.7">' + esc(subLabel) + '</div>' : '') + '</div></div>';
  }

  function kpiRing(pct, color, value, label) {
    const size = 72, stroke = 7, r = (size - stroke) / 2, c = 2 * Math.PI * r, p = clamp(pct || 0, 0, 100), off = c - (p / 100) * c;
    return '<div class="kpi-ring"><svg viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">' +
      '<circle class="ring-bg" cx="36" cy="36" r="' + r + '"></circle>' +
      '<circle class="ring-fg" style="stroke:' + color + '" cx="36" cy="36" r="' + r + '" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '"></circle>' +
      '</svg><div class="ring-center"><div class="ring-value">' + esc(value) + '</div>' + (label ? '<div class="ring-label">' + esc(label) + '</div>' : '') + '</div></div>';
  }

  function ensureTimerSubject() {
    const t = S.timer;
    if (!t.sid || !sub(S, t.sid)) {
      if (t.status !== 'idle') resetTimer();
      t.sid = S.subjects[0] ? S.subjects[0].id : null;
    }
  }

  function T() { return S.timer; }
  function phaseLenMs(t) { const p = S.settings.pomo; return (t.phase === 'work' ? p.work : t.phase === 'short' ? p.short : p.long) * 60000; }
  function elapsedMs(t, now) { return t.acc + (t.status === 'running' ? (now || Date.now()) - t.startedAt : 0); }
  function counts(t) { return t.mode === 'free' || t.phase === 'work'; }

  function commit(now) {
    const t = T();
    if (!t.sid || !counts(t)) return;
    now = now || Date.now();
    let el = elapsedMs(t, now);
    if (t.mode === 'pomo') el = Math.min(el, phaseLenMs(t));
    const d = Math.floor((el - t.logged) / 1000);
    if (d > 0) {
      const key = ymd(new Date(now));
      addLog(S, t.sid, d, key);
      t.logged += d * 1000;
      t.session = t.session || {};
      t.session[t.sid] = t.session[t.sid] || {};
      t.session[t.sid][key] = (t.session[t.sid][key] || 0) + d;
    }
  }

  /* Tiempo registrado desde que se abrió la sesión activa (para "Guardar"). */
  function sessionSeconds() {
    const t = T(), session = t.session || {};
    let total = 0;
    for (const sid in session) for (const key in session[sid]) total += session[sid][key] || 0;
    return total;
  }

  /* "Descartar" revierte exactamente lo que esta sesión había sumado al log. */
  function rollbackSession() {
    const t = T(), session = t.session || {};
    for (const sid in session) {
      for (const key in session[sid]) {
        const sec = session[sid][key] || 0;
        const row = S.log[key];
        if (!row || row[sid] == null) continue;
        row[sid] = Math.max(0, row[sid] - sec);
        if (!row[sid]) delete row[sid];
        if (!Object.keys(row).length) delete S.log[key];
      }
    }
    t.session = {};
  }

  function resetTimer() {
    const t = T();
    Object.assign(t, { phase: 'work', status: 'idle', startedAt: null, acc: 0, logged: 0, count: 0, session: {} });
    twNote = '';
    wake(false);
  }

  function nextPhase() {
    const t = T(), p = S.settings.pomo;
    if (t.phase === 'work') { t.count++; t.phase = (t.count % p.every === 0) ? 'long' : 'short'; }
    else t.phase = 'work';
    t.acc = 0; t.logged = 0; t.startedAt = null; t.status = 'idle';
  }

  let actx = null;
  function unlockAudio() { try { if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (C) actx = new C(); } if (actx && actx.state === 'suspended') actx.resume(); } catch (e) {} }
  function beep() {
    try {
      if (actx) {
        const t0 = actx.currentTime;
        [0, 0.28, 0.56].forEach((o, i) => {
          const os = actx.createOscillator(), g = actx.createGain();
          os.type = 'sine'; os.frequency.value = i === 2 ? 880 : 660;
          g.gain.setValueAtTime(0.0001, t0 + o); g.gain.exponentialRampToValueAtTime(0.18, t0 + o + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + o + 0.22);
          os.connect(g); g.connect(actx.destination); os.start(t0 + o); os.stop(t0 + o + 0.25);
        });
      }
    } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate([180, 80, 180]); } catch (e) {}
  }

  let wl = null;
  async function wake(on) {
    try {
      if (on) { if (!wl && navigator.wakeLock) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } }
      else if (wl) { const w = wl; wl = null; await w.release(); }
    } catch (e) { wl = null; }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S && T().status === 'running') wake(true); });

  function finishPhase() {
    const t = T();
    const wasWork = t.phase === 'work';
    nextPhase();
    twNote = wasWork
      ? L('timer.focusDone', { kind: L(t.phase === 'long' ? 'timer.breakLong' : 'timer.breakShort') })
      : L('timer.breakDone');
    wake(false); beep();
  }

  function startT() { const t = T(); t.status = 'running'; t.startedAt = Date.now(); t.seen = t.startedAt; twNote = ''; wake(true); save(S); renderWidget(); revealTimer(); tick(); }
  function pauseT() { const t = T(); commit(); t.acc = elapsedMs(t); t.startedAt = null; t.status = 'paused'; wake(false); save(S); renderWidget(); refreshLive(); }
  function toggleT() { unlockAudio(); const t = T(); if (!t.sid) { subjectModal(); return; } if (t.status === 'running') pauseT(); else startT(); }
  function closeTimerPanel() {
    S.ui.timerOpen = false; S.ui.min = false; S.ui.pos = null;
  }
  function endT() {
    commit();
    const saved = sessionSeconds();
    resetTimer(); closeTimerPanel();
    save(S); renderWidget(); renderView();
    if (saved) toast(L('timer.saved', { dur: fmtDur(saved) }));
  }
  function discardT() {
    commit(); rollbackSession();
    resetTimer(); closeTimerPanel();
    save(S); renderWidget(); renderView();
    toast(L('timer.discarded'));
  }
  function resetT() {
    commit(); resetTimer();
    save(S); renderWidget(); renderView();
  }
  function skipT() { commit(); nextPhase(); twNote = ''; wake(false); save(S); renderWidget(); renderView(); }
  function setSubject(sid) { const t = T(); commit(); t.sid = sid; save(S); renderWidget(); }
  function setMode(m) { const t = T(); if (t.mode === m) return; commit(); resetTimer(); t.mode = m; save(S); renderWidget(); renderView(); }
  function tick() {
    const t = T(), now = Date.now(); tickN++;
    /* El simulacro se cierra solo al agotar el tiempo, aunque el panel de
       enfoque esté detenido. Su propio intervalo actualiza la cuenta. */
    if (exam && quizOverlay === 'exam' && now >= exam.endsAt) { finishExam(true); return; }
    if (t.status === 'running') {
      t.seen = now;
      if (t.mode === 'pomo' && elapsedMs(t, now) >= phaseLenMs(t)) {
        commit(now); finishPhase(); save(S); renderWidget(); refreshLive(); return;
      }
      commit(now);
      if (tickN % 5 === 0) save(S);
      if (tickN % 15 === 0) refreshLive();
    }
    if (tickN % 60 === 0 && S.ui.tab === 'agenda' && !modal) renderView();
    updateWidgetTime();
  }

  function refreshLive() { if (S && !sliding && !modal) renderView(); }

  // Timer widget
  function twEl() { return $('#tw'); }
  function clockText() { const t = T(), el = elapsedMs(t); return t.mode === 'pomo' ? fmtClock(phaseLenMs(t) - el, true) : fmtClock(el, false); }
  function phaseText() {
    const t = T(), p = S.settings.pomo;
    if (t.mode === 'free') return L(t.status === 'running' ? 'timer.freeRunning' : 'timer.freeIdle');
    if (t.phase === 'work') return L('timer.focus', { n: (t.count % p.every) + 1, total: p.every });
    return L(t.phase === 'short' ? 'timer.shortBreak' : 'timer.longBreak');
  }

  function updateWidgetTime() {
    const t = T(), c = clockText();
    const a = $('#tClock'), b = $('#tMiniClock'), p = $('#tTrack'), ph = $('#tPhase'), td = $('#tToday');
    if (a) a.textContent = c;
    if (b) b.textContent = c;
    if (p && t.mode === 'pomo') p.style.width = clamp(elapsedMs(t) / phaseLenMs(t) * 100, 0, 100) + '%';
    if (ph) ph.textContent = phaseText();
    if (td && t.sid) { const k = todayKey(); td.textContent = L('timer.todayIn', { dur: fmtDur((S.log[k] && S.log[k][t.sid]) || 0) }); }
    document.title = t.status === 'running' ? c + ' · StudyFlow' : 'StudyFlow';
  }

  function setTimerBodyClasses(open, mini) {
    document.body.classList.toggle('timer-open', !!open);
    document.body.classList.toggle('timer-mini', !!open && !!mini);
  }

  function applyPos() {
    const tw = twEl();
    if (!tw) return;
    /* En móvil se descarta cualquier posición arrastrada previamente: el CSS
       fija top:auto/bottom con !important y el inline style sólo estorbaría. */
    if (isCompact()) {
      if (S.ui.pos) S.ui.pos = null;
      tw.style.left = ''; tw.style.top = ''; tw.style.right = ''; tw.style.bottom = '';
      return;
    }
    const pos = S.ui.pos;
    if (!pos) { tw.style.left = ''; tw.style.top = ''; tw.style.right = ''; tw.style.bottom = ''; return; }
    const x = clamp(pos.x, 8, Math.max(8, window.innerWidth - tw.offsetWidth - 8));
    const y = clamp(pos.y, 8, Math.max(8, window.innerHeight - tw.offsetHeight - 8));
    tw.style.left = x + 'px'; tw.style.top = y + 'px'; tw.style.right = 'auto'; tw.style.bottom = 'auto';
  }

  /* Garantiza que el panel esté dentro del viewport tras iniciar una sesión. */
  function revealTimer() {
    const tw = twEl();
    if (!tw || tw.hidden) return;
    if (isCompact() && S.ui.pos) { S.ui.pos = null; applyPos(); }
    const r = tw.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const visible = r.width > 0 && r.height > 0 &&
      r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1;
    if (visible) return;
    try {
      tw.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
    } catch (e) {
      try { tw.scrollIntoView(); } catch (x) {}
    }
  }

  function renderWidget() {
    const tw = twEl(); const t = T(); const s = sub(S, t.sid);
    if (!S.ui.timerOpen) {
      tw.hidden = true; tw.innerHTML = '';
      setTimerBodyClasses(false, false);
      document.title = 'StudyFlow';
      return;
    }
    tw.hidden = false;
    setTimerBodyClasses(true, S.ui.min);
    const color = s ? s.color : 'var(--accent)';
    const running = t.status === 'running';
    tw.className = 'tw' + (S.ui.min ? ' mini' : '');
    tw.style.setProperty('--c', color);
    const mainIcon = running ? ic.pause : ic.play;
    const mainLabel = L(running ? 'timer.pause' : (t.status === 'paused' ? 'timer.resume' : 'timer.start'));

    if (S.ui.min) {
      tw.innerHTML = '<div class="tw-mini">' +
        '<span class="dot" style="background:' + esc(color) + '"></span>' +
        '<span class="tw-mini-time" id="tMiniClock" title="' + esc(s ? s.name : L('timer.title')) + '">' + clockText() + '</span>' +
        '<button type="button" class="icon-btn round" data-act="twToggle" aria-label="' + esc(mainLabel) + '">' + mainIcon + '</button>' +
        '<button type="button" class="icon-btn" data-act="twMin" aria-label="' + esc(L('timer.expand')) + '">' + ic.expand + '</button></div>';
    } else {
      const active = s
        ? '<div class="tw-active"><span class="tw-active-kicker">' + esc(L('timer.subjectAria')) + '</span>' +
          '<span class="tw-active-name"><i class="dot" style="background:' + esc(color) + '"></i>' + esc(s.name) + '</span></div>'
        : '<div class="tw-note">' + esc(L('timer.noSubject')) + '</div>';
      const sel = S.subjects.length
        ? '<label class="tw-subject"><span class="sr-only">' + esc(L('timer.subjectAria')) + '</span><select id="tSub">' +
          S.subjects.map(x => '<option value="' + esc(x.id) + '"' + (x.id === t.sid ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></label>'
        : '';
      const cfg = S.ui.cfg && t.mode === 'pomo'
        ? '<div class="tw-cfg"><div class="cfg-grid">' +
          [['work', 'timer.cfgWork'], ['short', 'timer.cfgShort'], ['long', 'timer.cfgLong'], ['every', 'timer.cfgEvery']].map(r =>
            '<label>' + esc(L(r[1])) + '<input type="number" min="1" max="180" inputmode="numeric" data-pomo="' + r[0] + '" value="' + S.settings.pomo[r[0]] + '"></label>'
          ).join('') + '</div></div>' : '';
      const pomoLabel = esc(L('timer.pomodoro') + ' · ' + S.settings.pomo.work + ' ' + L('unit.minute'));
      tw.innerHTML = '<div class="tw-head" data-drag><span class="tw-title">' + esc(L('timer.title')) + '</span><div class="tw-head-actions">' +
        '<button type="button" class="icon-btn" data-act="twCfg" aria-label="' + esc(L('timer.settingsAria')) + '">' + ic.sliders + '</button>' +
        (t.mode === 'pomo' ? '<button type="button" class="icon-btn" data-act="twSkip" aria-label="' + esc(L('timer.skip')) + '">' + ic.skip + '</button>' : '') +
        '<button type="button" class="icon-btn" data-act="twMin" aria-label="' + esc(L('timer.minimize')) + '">' + ic.min + '</button>' +
        '</div></div>' +
        '<div class="tw-body">' +
        '<div class="tw-mode"><button type="button" data-act="twMode" data-mode="pomo" class="' + (t.mode === 'pomo' ? 'on' : '') + '">' + pomoLabel + '</button>' +
        '<button type="button" data-act="twMode" data-mode="free" class="' + (t.mode === 'free' ? 'on' : '') + '">' + esc(L('timer.freeMode')) + '</button></div>' +
        active +
        '<div class="tw-phase" id="tPhase">' + esc(phaseText()) + '</div>' +
        '<div class="tw-time" id="tClock" aria-live="off">' + clockText() + '</div>' +
        (t.mode === 'pomo' ? '<div class="tw-track"><i id="tTrack" style="width:0"></i></div>' : '') +
        sel +
        '<div class="tw-controls">' +
        '<button type="button" class="btn pri tw-toggle" data-act="twToggle"' + (S.subjects.length ? '' : ' disabled') + '>' + mainIcon + '<span>' + esc(mainLabel) + '</span></button>' +
        '<button type="button" class="btn" data-act="twReset" aria-label="' + esc(L('timer.restart')) + '">' + ic.reset + '<span>' + esc(L('timer.restart')) + '</span></button>' +
        '<button type="button" class="btn tw-save" data-act="twEnd" aria-label="' + esc(L('timer.saveFinish')) + '">' + ic.save + '<span>' + esc(L('timer.saveFinish')) + '</span></button>' +
        '<button type="button" class="btn ghost tw-discard" data-act="twDiscard" aria-label="' + esc(L('timer.discard')) + '">' + ic.x + '<span>' + esc(L('timer.discard')) + '</span></button>' +
        '</div>' +
        '<div class="tw-note" id="tToday"></div>' +
        '<div class="tw-note">' + esc(twNote) + '</div>' +
        cfg + '</div>';
    }
    applyPos();
    updateWidgetTime();
  }
  function initDrag() {
    const tw = twEl();
    tw.addEventListener('pointerdown', (e) => {
      if (isCompact()) return;
      if (!e.target.closest('[data-drag]') || e.target.closest('button,select,input,a')) return;
      const r = tw.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId };
      tw.classList.add('dragging');
      try { tw.setPointerCapture(e.pointerId); } catch (x) {}
    });
    tw.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const x = clamp(e.clientX - drag.dx, 8, Math.max(8, window.innerWidth - tw.offsetWidth - 8));
      const y = clamp(e.clientY - drag.dy, 8, Math.max(8, window.innerHeight - tw.offsetHeight - 8));
      S.ui.pos = { x, y };
      applyPos();
    });
    const endDrag = (e) => { if (drag && (!e || e.pointerId === drag.id)) { drag = null; tw.classList.remove('dragging'); save(S); } };
    tw.addEventListener('pointerup', endDrag);
    tw.addEventListener('pointercancel', endDrag);
    window.addEventListener('resize', () => { if (S) applyPos(); });
  }

  // Header
  function renderTabs() {
    const tabs = [
      ['estudio', 'tabs.study'], ['agenda', 'tabs.agenda'],
      ['notas', 'tabs.notes'], ['flashcards', 'tabs.cards'], ['configuracion', 'tabs.settings']
    ];
    $('#tabs').innerHTML = tabs.map(t => '<button class="tab" role="tab" data-act="tab" data-tab="' + t[0] + '" aria-selected="' + (S.ui.tab === t[0]) + '" aria-controls="view">' + L(t[1]) + '</button>').join('');
    const d = new Date();
    $('#dateLine').textContent = I.date(d, { weekday: 'long', day: 'numeric', month: 'long' });
    I.apply();
  }

  function renderNotice() {
    let h = '';
    if (!SFS.storageOk()) h += '<div class="notice warn"><p>' + L('notice.storageHtml') + '</p></div>';
    if (S.sample) h += '<div class="notice"><p>' + L('notice.demoHtml') + '</p><div class="notice-actions"><button class="btn sm ghost" data-act="keepSample">' + L('notice.keep') + '</button><button class="btn sm pri" data-act="clearSample" data-confirm="' + L('notice.clearConfirm') + '">' + L('notice.clear') + '</button></div></div>';
    $('#notice').innerHTML = h;
  }

  function programLabel(p) {
    if (!p) return '';
    return p.label || [p.careerLabel || p.title, p.institutionSigla || p.institution, p.periodLabel]
      .filter(Boolean).join(' · ');
  }

  function toast(message) {
    let el = $('#sfToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sfToast'; el.className = 'toast'; el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { if (el) el.classList.remove('show'); }, 4200);
  }

  function renderView() {
    const v = $('#view');
    const panes = [
      ['estudio', viewEstudio], ['agenda', viewAgenda],
      ['notas', viewNotas], ['flashcards', viewFlashcards], ['configuracion', viewConfiguracion]
    ];
    /* [hidden] + display:none !important garantiza un cambio limpio de pestaña. */
    v.innerHTML = panes.map(p =>
      '<div class="view-pane" data-pane="' + p[0] + '"' + (S.ui.tab === p[0] ? '' : ' hidden') + '>' + p[1]() + '</div>'
    ).join('');
  }

  function renderAll() { renderTabs(); renderNotice(); renderView(); renderWidget(); bindConfig(); }
  function afterChange() { ensureTimerSubject(); resetAutoQuizzes(); save(S); renderAll(); }

  // Exam / next session helpers
  function kindText(kind) {
    const map = { 'Parcial': 'partial', 'Examen': 'exam', 'Entrega': 'delivery', 'Otro': 'other' };
    return L('exam.kind.' + (map[kind] || 'other'));
  }

  function examState(e) {
    const now = new Date();
    const d = parseYmd(e.date);
    const t0 = parseYmd(todayKey());
    const days = Math.round((d - t0) / 86400000);
    let target = d, hasT = false;
    if (e.time && /^\d\d:\d\d$/.test(e.time)) { const hm = e.time.split(':').map(Number); target = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hm[0], hm[1]); hasT = true; }
    const ms = target - now;
    const past = hasT ? ms < 0 : days < 0;
    let big, unit;
    if (past) {
      const ago = (hasT && days === 0) ? 0 : Math.abs(days);
      big = ago === 0 ? L('exam.today') : String(ago);
      unit = ago === 0 ? L('exam.ago.zero') : C('exam.ago', ago);
    } else if (days === 0) {
      big = L('exam.today');
      unit = hasT ? L('exam.todayTime', { dur: fmtDur(ms / 1000) }) : L('exam.todayIs');
    } else { big = String(days); unit = C('exam.days', days); }
    return { days, ms, target, past, big, unit, cls: past ? 'past' : days <= 2 ? 'bad' : days <= 7 ? 'warn' : '' };
  }

  function nextExam() {
    let best = null;
    S.exams.forEach(e => { const st = examState(e); if (!st.past && (!best || st.target < best.st.target)) best = { e, st }; });
    return best;
  }

  function nextStudyBlock() {
    const now = new Date();
    const today = dayIdx(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let best = null;
    for (let off = 0; off < 7; off++) {
      const di = (today + off) % 7;
      const blocks = S.blocks.filter(b => b.day === di).sort((a, b) => a.start.localeCompare(b.start));
      for (const b of blocks) {
        if (off === 0 && toMin(b.start) <= nowMin) continue;
        const dt = addDays(now, off);
        const hm = b.start.split(':').map(Number);
        dt.setHours(hm[0], hm[1], 0, 0);
        if (!best || dt < best.dt) best = { b, dt, off };
      }
      if (best) break;
    }
    return best;
  }
  /* ---- Recuperación de bloques perdidos ----
     Los bloques son plantillas semanales: un "bloque perdido" es una franja de
     estudio de un día anterior sin tiempo registrado para esa materia. */
  function missedStudyBlocks() {
    const now = new Date();
    const seen = Array.isArray(S.ui.recoverSeen) ? S.ui.recoverSeen : [];
    const out = [];
    for (let back = 1; back <= 3; back++) {
      const dt = addDays(now, -back);
      const k = ymd(dt), di = dayIdx(dt);
      S.blocks.filter(b => b.type === 'estudio' && b.day === di).forEach(b => {
        if (out.some(x => x.b.id === b.id)) return;
        const key = k + '|' + b.id;
        if (seen.indexOf(key) >= 0) return;
        const logged = b.sid ? ((S.log[k] && S.log[k][b.sid]) || 0) : 0;
        const need = blockMin(b) * 60;
        if (logged >= need * 0.5) return;
        out.push({ b, key, date: k, day: D.short()[di], missing: Math.max(0, need - logged) });
      });
    }
    return out;
  }

  function suggestSlot(b) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const dur = Math.max(30, blockMin(b));
    for (let off = 0; off < 7; off++) {
      const di = (dayIdx(now) + off) % 7;
      const dayBlocks = S.blocks.filter(x => x.day === di);
      for (let st = 8 * 60; st <= 21 * 60; st += 30) {
        if (off === 0 && st <= nowMin + 15) continue;
        const en = st + dur;
        if (en > 22 * 60) continue;
        if (dayBlocks.some(x => toMin(x.start) < en && toMin(x.end) > st)) continue;
        const dt = addDays(now, off);
        return {
          day: di, date: ymd(dt), off,
          start: pad(Math.floor(st / 60)) + ':' + pad(st % 60),
          end: pad(Math.floor(en / 60)) + ':' + pad(en % 60)
        };
      }
    }
    return null;
  }

  function recoveryNoticeHTML() {
    const missed = missedStudyBlocks();
    if (!missed.length) return '';
    const b = missed[0].b;
    const slot = suggestSlot(b);
    const sb = sub(S, b.sid);
    const when = slot
      ? (slot.off === 0 ? L('hero.today') : slot.off === 1 ? L('hero.tomorrow') : D.long()[slot.day]) + ', ' + slot.start
      : L('recovery.noSlot');
    const text = C('recovery.text', missed.length, {
      day: slot ? D.long()[slot.day] : '—', time: slot ? slot.start : '—'
    });
    const detail = L('recovery.detail', {
      subject: sb ? sb.name : (b.note || L('agenda.noSubject')),
      duration: fmtMin(blockMin(b))
    });
    let actions = '<button class="btn sm" data-act="tab" data-tab="agenda">' + L('action.viewAgenda') + '</button>';
    if (slot) actions += '<button class="btn sm pri" data-act="recoverBlock" data-id="' + b.id + '">' + L('recovery.suggest') + '</button>';
    actions += '<button class="btn sm ghost" data-act="dismissRecovery" data-key="' + esc(missed[0].key) + '">' + L('action.close') + '</button>';
    return '<div class="notice warn recovery-notice"><div class="recovery-copy">' +
      '<p><strong>' + L('recovery.title') + '</strong></p><p>' + text + '</p>' +
      '<p class="muted">' + esc(detail) + (slot ? ' · ' + esc(when) : '') + '</p></div>' +
      '<div class="notice-actions">' + actions + '</div></div>';
  }

  /* ---- Indicador de preparación de exámenes ----
     Combina temario, tiempo semanal, dominio de flashcards y días restantes.
     Es orientativo: no promete una nota, sólo ordena dónde conviene reforzar. */
  function examPrep(e) {
    const s = sub(S, e.sid);
    const syllabus = s ? clamp(Number(s.progress) || 0, 0, 100) : 0;
    const goal = goalMinOf(s) * 60;
    const studied = s ? secBy(S, s.id, weekDates()) : 0;
    const hours = goal ? clamp(Math.round(studied / goal * 100), 0, 100) : (studied > 0 ? 100 : 0);
    const cs = e.sid ? cardStats(S, e.sid) : { pct: null };
    const cards = cs.pct == null ? syllabus : cs.pct;
    const days = examState(e).days;
    const base = 0.4 * syllabus + 0.3 * hours + 0.3 * cards;
    const pct = clamp(Math.round(base + (days > 14 ? 8 : days < 3 ? -5 : 0)), 0, 100);
    const level = pct >= 80 ? 'ready' : pct >= 50 ? 'track' : 'low';
    return {
      pct: pct, level: level,
      label: L('exam.prep.' + (level === 'ready' ? 'ready' : level === 'track' ? 'onTrack' : 'reinforce')),
      detail: L('exam.prep.detail', { a: syllabus, b: hours, c: cs.pct == null ? '—' : cards })
    };
  }

  function fmtShortDate(d) {
    return d.getDate() + ' ' + D.mon()[d.getMonth()];
  }

  // Estudio view
  function viewEstudio() {
    const wk = weekDates(), tk = todayKey();
    const ts = daySec(S, tk);
    const ws = S.subjects.reduce((a, s) => a + secBy(S, s.id, wk), 0);
    const dailyGoal = dailyGoalSec();
    const dayPct = dailyGoal ? clamp((ts / dailyGoal) * 100, 0, 100) : (ts > 0 ? 100 : 0);
    const nx = nextExam();
    const st = streak(S);
    const nb = nextStudyBlock();

    // Next up hero
    let heroTitle = L('hero.nextSession');
    let heroSub = L('hero.emptySub');
    let heroMeta = '<span class="badge">' + L('hero.noAgenda') + '</span>';
    let heroAction = '<button class="btn pri" data-act="newSubject">' + L('action.newSubject') + '</button>' +
      '<button class="btn ghost" data-act="curriculum">' + ic.book + '<span>' + L('action.importCareer') + '</span></button>';
    let heroColor = 'var(--accent)';
    let heroProgress = 0;
    let heroRingLabel = L('hero.dailyGoal');

    if (nb) {
      const sb = sub(S, nb.b.sid);
      heroTitle = sb ? sb.name : (nb.b.note || L('hero.studySession'));
      const when = nb.off === 0 ? L('hero.today') : nb.off === 1 ? L('hero.tomorrow') : D.long()[nb.b.day];
      heroSub = L('hero.scheduled', {
        kind: L(nb.b.type === 'estudio' ? 'hero.studySession' : 'hero.class'),
        when: when, time: nb.b.start
      });
      heroMeta = '<span class="badge accent">' + when + ' · ' + nb.b.start + '–' + nb.b.end + ' · ' + fmtMin(blockMin(nb.b)) + '</span>' + (sb ? '<span class="badge"><span class="dot" style="background:' + sb.color + '"></span>' + esc(sb.name) + '</span>' : '');
      heroAction = sb ? '<button type="button" class="btn pri" data-act="studySubject" data-id="' + sb.id + '">' + L('action.startSession') + '</button><button class="btn ghost" data-act="tab" data-tab="agenda">' + L('action.viewAgenda') + '</button>' : '<button class="btn pri" data-act="tab" data-tab="agenda">' + L('action.viewAgenda') + '</button>';
      heroColor = sb ? sb.color : 'var(--accent)';
      heroProgress = sb ? (sb.progress || 0) : dayPct;
      heroRingLabel = sb ? L('hero.syllabus') : L('hero.dailyGoal');
    } else if (S.subjects.length) {
      const focus = S.subjects.slice().sort((a, b) => goalMinOf(b) - goalMinOf(a) || a.progress - b.progress)[0];
      heroTitle = focus.name;
      heroSub = L('hero.resumeSub');
      heroMeta = '<span class="badge accent">' + L('hero.suggested') + '</span><span class="badge">' + L('hero.syllabusPercent', { n: focus.progress || 0 }) + '</span>';
      heroAction = '<button type="button" class="btn pri" data-act="studySubject" data-id="' + focus.id + '">' + L('action.startSession') + '</button><button class="btn ghost" data-act="manualTime" data-id="' + focus.id + '">' + L('action.logTime') + '</button>';
      heroColor = focus.color;
      heroProgress = focus.progress || 0;
      heroRingLabel = L('hero.syllabus');
    }

    const hero = '<section class="hero">' +
      '<div class="panel hero-main" style="--c:' + heroColor + '">' +
        '<div class="hero-copy">' +
          '<div class="eyebrow hero-kicker">' + L('hero.nextUp') + '</div>' +
          '<h2 class="hero-title">' + esc(heroTitle) + '</h2>' +
          '<p class="hero-sub">' + esc(heroSub) + '</p>' +
          '<div class="hero-meta">' + heroMeta + '</div>' +
          '<div class="hero-actions">' + heroAction + '</div>' +
        '</div>' +
        '<div class="hero-ring">' + ringSVG(heroProgress, 168, 10, heroColor, heroRingLabel, Math.round(heroProgress) + '%') + '</div>' +
      '</div>' +
      '<div class="panel" style="padding:18px;display:flex;flex-direction:column;gap:14px;justify-content:center">' +
        '<div class="eyebrow">' + L('hero.daySummary') + '</div>' +
        '<div style="font:400 40px/1 var(--serif);font-variant-numeric:tabular-nums">' + fmtDur(ts) + '</div>' +
        '<div class="muted" style="font-size:14px">' + L('hero.studiedToday') + (dailyGoal ? ' · ' + L('hero.dailyTarget', { goal: fmtDur(dailyGoal) }) : '') + '</div>' +
        '<div class="bar warm"><i style="width:' + dayPct + '%"></i></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<span class="badge">' + C('hero.subjects', S.subjects.length) + '</span>' +
          '<span class="badge">' + L('hero.weekTotal', { d: fmtDur(ws) }) + '</span>' +
        '</div>' +
      '</div>' +
    '</section>';

    // KPIs
    const nxPrep = nx ? examPrep(nx.e) : null;
    const examPct = nxPrep ? nxPrep.pct : 0;
    const streakPct = clamp((st / 7) * 100, 0, 100);
    const todayKpiPct = dailyGoal ? clamp((ts / dailyGoal) * 100, 0, 100) : (ts > 0 ? 100 : 0);
    const kpis = '<section class="kpi-grid">' +
      '<div class="panel kpi">' + kpiRing(streakPct, 'var(--accent)', String(st), C('kpi.day', st)) +
        '<div class="kpi-body"><div class="kpi-title">' + L('kpi.streak') + '</div><div class="kpi-value">' + C('kpi.day', st) + '</div><div class="kpi-sub">' + L(st ? 'kpi.streakOn' : 'kpi.streakStart') + '</div></div></div>' +
      '<div class="panel kpi">' + kpiRing(todayKpiPct, 'var(--sage)', Math.round(todayKpiPct) + '%', L('kpi.today')) +
        '<div class="kpi-body"><div class="kpi-title">' + L('kpi.todayTime') + '</div><div class="kpi-value">' + fmtDur(ts) + '</div><div class="kpi-sub">' + (dailyGoal ? L('kpi.goal', { goal: fmtDur(dailyGoal) }) : L('kpi.noGoal')) + '</div></div></div>' +
      '<div class="panel kpi">' + kpiRing(examPct, nxPrep ? (nx.st.days <= 2 ? 'var(--bad)' : nx.st.days <= 7 ? 'var(--warn)' : 'var(--accent)') : '#333', nx ? examPct + '%' : '—', nxPrep ? L('exam.prep') : L('kpi.exam')) +
        '<div class="kpi-body"><div class="kpi-title">' + L('kpi.nextExam') + '</div><div class="kpi-value">' + (nx ? (nx.st.days === 0 ? L('kpi.todayShort') : C('exam.days', nx.st.days)) : '—') + '</div><div class="kpi-sub">' + (nx ? esc(nx.e.title) + (nxPrep ? ' · <span class="tag">' + esc(nxPrep.label) + '</span>' : '') : L('kpi.noDates')) + '</div></div></div>' +
    '</section>' +
    recoveryNoticeHTML();

    const avgP = S.subjects.length ? Math.round(S.subjects.reduce((a, s) => a + (s.progress || 0), 0) / S.subjects.length) : 0;
    const subjectCards = S.subjects.length
      ? '<div class="cards">' + S.subjects.map(subjectCard).join('') + '<button class="add-tile" data-act="newSubject">' + L('action.newSubject') + '</button></div>'
      : '<div class="empty"><p>' + L('subject.empty') + '</p><button class="btn pri" data-act="newSubject">' + L('action.newSubject') + '</button></div>';

    const legend = S.subjects.map(s => '<span><i class="dot" style="background:' + s.color + '"></i>' + esc(s.name) + '</span>').join('');

    const activeBadge = S.activeProgram
      ? '<span class="badge accent curr-active-chip">' + L('curriculum.active') + ': ' + esc(programLabel(S.activeProgram) || S.activeProgram.careerId) + '</span>'
      : '';
    const subjectToolbar = '<div class="section-toolbar">' +
      '<button class="btn sm pri" data-act="newSubject">' + L('action.newSubject') + '</button>' +
      '<button class="btn sm ghost" data-act="curriculum">' + ic.book + '<span>' + L('action.importCareer') + '</span></button>' +
      '<button class="btn sm" data-act="mockExam">' + L('action.mockExam') + '</button>' +
      '<button class="btn sm ghost" data-act="examHistory">' + L('action.examHistory') + '</button>' + activeBadge + '</div>';

    return hero + kpis +
      '<section class="section"><div class="section-head"><h2>' + L('section.subjects') + '</h2><span class="muted" style="font-size:13px">' + (S.subjects.length ? L('section.avgProgress', { n: avgP }) : '') + '</span></div>' + subjectToolbar + subjectCards + '</section>' +
      '<section class="section"><div class="section-head"><h2>' + L('section.last14') + '</h2><div class="chart-legend">' + legend + '</div></div><div class="panel chart-panel">' + chartHTML() + '</div></section>';
  }

  /* Dominio por unidad: temario completado + flashcards + aciertos en
     simulacros. Se calcula en SFStore para que la misma regla alimente las
     barras y cualquier otro indicador de la app. */
  function masteryHTML(s) {
    const rows = unitsBy(S, s.id);
    const body = rows.length ? rows.map(u => {
      const m = unitMastery(S, s.id, u.id);
      const color = m.pct >= 80 ? 'var(--sage)' : m.pct >= 50 ? 'var(--accent)' : 'var(--bad)';
      const parts = [];
      if (m.parts.tasks != null) parts.push(L('mastery.task') + ' ' + m.parts.tasks + '%');
      if (m.parts.cards != null) parts.push(L('mastery.cards') + ' ' + m.parts.cards + '%');
      if (m.parts.quiz != null) parts.push(L('mastery.quiz') + ' ' + m.parts.quiz + '%');
      return '<div class="mastery-row">' +
        '<div class="metric-row"><span class="metric-label mastery-name">' + esc(u.name) + '</span>' +
        '<span class="metric-val mastery-pct"><strong>' + m.pct + '%</strong></span></div>' +
        '<div class="bar mastery-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + m.pct + '" aria-label="' + L('mastery.aria', { name: esc(u.name) }) + '">' +
        '<i style="width:' + m.pct + '%;background:' + color + '"></i></div>' +
        (parts.length ? '<div class="mastery-parts">' + esc(parts.join(' · ')) + '</div>' : '') +
        '</div>';
    }).join('') : '<p class="muted unit-empty">' + L('mastery.noUnits') + '</p>';
    return '<details class="mastery-details"><summary>' +
      '<span>' + L('section.mastery') + '</span><span class="muted">' + L('mastery.subtitle') + '</span>' +
      '</summary><div class="mastery-list">' + body + '</div></details>';
  }

  function subjectCard(s) {
    const wk = weekDates();
    const w = secBy(S, s.id, wk);
    const goalS = goalMinOf(s) * 60;
    const pct = goalS ? Math.min(100, w / goalS * 100) : 0;
    const done = goalS && w >= goalS;
    const us = unitStats(S, s.id);
    const unitLine = '<div class="card-units">' +
      '<span class="card-units-count">' + L('curriculum.units.progress', { a: us.done, b: us.total }) + '</span>' +
      '<button class="link-btn" data-act="units" data-id="' + s.id + '">' + L('curriculum.units.manage') + '</button></div>';
    const nq = (S.questions || []).filter(q => q.sid === s.id).length;
    const nqz = (S.quizHistory || []).filter(r => r.sid === s.id).length;
    const bankLine = '<div class="card-units quiz-line">' +
      '<span class="card-units-count">' + L('quiz.bank.count', { n: nq }) + ' · ' + L('quiz.history.count', { n: nqz }) + '</span>' +
      '<button class="link-btn" data-act="questionBank" data-id="' + s.id + '">' + L('action.questionBank') + '</button></div>';
    return '<article class="card" style="--c:' + s.color + '">' +
      '<div class="card-head"><h3 class="card-title"><span class="dot" style="background:' + s.color + '"></span><span>' + esc(s.name) + '</span></h3>' +
      '<button class="btn ghost sm" data-act="editSubject" data-id="' + s.id + '">' + L('subject.edit') + '</button></div>' +
      '<div class="card-meta">' +
        '<div><div class="metric-row"><span class="metric-label">' + L('subject.thisWeek') + '</span><span class="metric-val"><strong>' + fmtDur(w) + '</strong>' + (goalS ? ' / ' + fmtMin(goalMinOf(s)) : '') + '</span></div>' +
        '<div class="bar"><i style="width:' + pct + '%;background:' + s.color + '"></i></div>' + (done ? '<div class="ok-msg">' + L('subject.goalDone') + '</div>' : '') + '</div>' +
        '<div><div class="metric-row"><label class="metric-label" for="pg-' + s.id + '">' + L('subject.syllabus') + '</label><span class="metric-val" id="pv-' + s.id + '"><strong>' + (s.progress || 0) + '%</strong></span></div>' +
        '<input type="range" class="range" id="pg-' + s.id + '" data-id="' + s.id + '" min="0" max="100" step="5" value="' + (s.progress || 0) + '" aria-label="' + L('subject.progressAria', { name: esc(s.name) }) + '"></div>' +
        '<div class="metric-row" style="margin:0"><span class="metric-label">' + L('subject.total') + '</span><span class="metric-val"><strong>' + fmtDur(totalSec(S, s.id)) + '</strong></span></div>' +
      '</div>' +
      unitLine + bankLine + masteryHTML(s) +
      '<div class="card-footer">' +
        '<button class="btn sm" data-act="manualTime" data-id="' + s.id + '">' + L('action.logTime') + '</button>' +
        '<button class="btn sm" data-act="mockExam" data-id="' + s.id + '">' + L('action.mockExam') + '</button>' +
        '<button type="button" class="btn sm pri" data-act="studySubject" data-id="' + s.id + '">' + L('action.startSession') + '</button></div>' +
    '</article>';
  }

  function chartHTML() {
    const days = []; for (let i = 13; i >= 0; i--) days.push(addDays(new Date(), -i));
    const keys = days.map(ymd);
    const tot = keys.map(k => daySec(S, k));
    const maxH = Math.max(1, Math.ceil(Math.max.apply(null, tot.concat([0])) / 3600));
    const step = maxH <= 4 ? 1 : maxH <= 8 ? 2 : maxH <= 16 ? 4 : 8;
    const top = Math.max(step, Math.ceil(maxH / step) * step);
    let grid = '';
    for (let v = 0; v <= top; v += step) grid += '<div class="chart-grid" style="bottom:' + (v / top * 100) + '%"><span>' + L('chart.hours', { n: v }) + '</span></div>';
    const cols = keys.map((k, i) => {
      const r = S.log[k] || {};
      const segs = S.subjects.filter(s => r[s.id] > 0).map(s => {
        const h = (r[s.id] / 3600 / top * 100);
        return '<div class="chart-seg" style="--c:' + s.color + ';height:' + h + '%" title="' + esc(s.name + ': ' + fmtDur(r[s.id])) + '"></div>';
      }).join('');
      const tip = L('chart.tip', {
        day: D.short()[dayIdx(days[i])],
        date: I.date(days[i], { day: 'numeric', month: 'short' }),
        duration: fmtDur(tot[i] || 0)
      });
      return '<div class="chart-col" title="' + esc(tip) + '" aria-label="' + esc(tip) + '">' + segs + '</div>';
    }).join('');
    const xl = days.map((d, i) => '<span class="' + (i === 13 ? 'today' : '') + '">' + d.getDate() + '</span>').join('');
    return '<div class="chart-wrap" role="img" aria-label="' + L('chart.aria') + '">' + grid + '<div class="chart-bars">' + cols + '</div></div><div class="chart-x">' + xl + '</div>';
  }
  // Agenda view
  function viewAgenda() {
    const td = dayIdx(new Date());
    const sel = clamp(S.ui.selDay, 0, 6);
    const by = [0,1,2,3,4,5,6].map(i => S.blocks.filter(b => b.day === i).sort((a,b) => a.start.localeCompare(b.start)));
    const mins = type => S.blocks.filter(b => b.type === type).reduce((a,b) => a + blockMin(b), 0) * 60;
    const goal = S.subjects.reduce((a,s) => a + goalMinOf(s), 0);

    const chips = '<div class="chips" role="group" aria-label="' + L('agenda.selectDay') + '">' +
      D.short().map((d,i) => '<button class="chip ' + (i===td?'today':'') + '" data-act="selDay" data-day="' + i + '" aria-pressed="' + (i===sel) + '">' + d + '</button>').join('') +
      '</div>';

    const week = '<div class="week">' + by.map((bl,i) => {
      const total = bl.reduce((a,b) => a + blockMin(b), 0) * 60;
      const blocks = bl.map(b => {
        const sb = sub(S, b.sid);
        const color = sb ? sb.color : 'var(--muted)';
        return '<button class="block ' + b.type + '" data-act="editBlock" data-id="' + b.id + '" style="--c:' + color + '">' +
          '<span class="block-time">' + b.start + ' – ' + b.end + ' · ' + fmtMin(blockMin(b)) + '</span>' +
          '<span class="block-name">' + esc(sb ? sb.name : (b.note || L('agenda.noSubject'))) + '</span>' +
          '<span class="block-kind">' + L(b.type === 'estudio' ? 'agenda.study' : 'agenda.class') + (b.note && sb ? ' · ' + esc(b.note) : '') + '</span></button>';
      }).join('');
      return '<section class="day ' + (i===sel?'is-selected':'') + ' ' + (i===td?'today':'') + '">' +
        '<div class="day-head"><span class="day-name">' + D.short()[i] + '</span><span class="day-time">' + (total ? fmtDur(total) : '') + '</span></div>' +
        blocks + '<button class="add-slot" data-act="newBlock" data-day="' + i + '">' + L('agenda.addBlock') + '</button></section>';
    }).join('') + '</div>';

    const ups = S.exams.map(e => ({ e, st: examState(e) }));
    const next = ups.filter(x => !x.st.past).sort((a,b) => a.st.target - b.st.target);
    const past = ups.filter(x => x.st.past).sort((a,b) => b.st.target - a.st.target);
    const exams = (next.length ? '<div class="exam-list">' + next.map(x => examRow(x.e)).join('') + '</div>' : '<div class="empty"><p>' + L('agenda.noExams') + '</p></div>') +
      (past.length ? '<details class="past-details"><summary>' + L('agenda.past', { n: past.length }) + '</summary><div class="exam-list">' + past.map(x => examRow(x.e)).join('') + '</div></details>' : '');

    return recoveryNoticeHTML() +
      '<section class="section"><div class="section-head"><h2>' + L('section.weekly') + '</h2><button class="btn sm" data-act="newBlock">' + L('section.newBlock') + '</button></div>' + chips + week +
      '<p class="agenda-summary">' + L('agenda.summary', {
        classes: fmtDur(mins('clase')),
        study: fmtDur(mins('estudio')),
        goal: goal ? L('agenda.goal', { goal: fmtMin(goal) }) : ''
      }) + '</p></section>' +
      '<section class="section"><div class="section-head"><h2>' + L('section.exams') + '</h2><button class="btn sm" data-act="newExam">' + L('section.newDate') + '</button></div>' +
      '<p class="settings-hint">' + L('exam.prep.note') + '</p>' + exams + '</section>';
  }

  function examRow(e) {
    const st = examState(e);
    const sb = sub(S, e.sid);
    const d = parseYmd(e.date);
    const prep = examPrep(e);
    return '<button class="exam ' + st.cls + '" data-act="editExam" data-id="' + e.id + '">' +
      '<div class="exam-count"><div><strong>' + esc(st.big) + '</strong><span>' + esc(st.unit) + '</span></div></div>' +
      '<div><div class="exam-title">' + esc(e.title) + '</div>' +
      '<div class="prep-line" title="' + esc(prep.detail) + '"><div class="bar prep-' + prep.level + '"><i style="width:' + prep.pct + '%"></i></div>' +
      '<span class="prep-label ' + prep.level + '">' + esc(prep.label) + ' · ' + prep.pct + '%</span></div>' +
      '<div class="exam-meta">' +
      '<span class="tag">' + esc(kindText(e.kind)) + '</span>' +
      (sb ? '<span><span class="dot" style="background:' + sb.color + ';vertical-align:middle;margin-right:4px"></span>' + esc(sb.name) + '</span>' : '') +
      '<span>' + D.short()[dayIdx(d)] + ' ' + fmtShortDate(d) + (e.time ? ' · ' + esc(e.time) : '') + '</span>' +
      '</div></div></button>';
  }
  // Notas view
  function subjAvg(sid) {
    const g = S.grades.filter(x => x.sid === sid);
    if (!g.length) return null;
    const w = g.filter(x => x.weight > 0);
    if (w.length) {
      const ws = w.reduce((a,x) => a + x.weight, 0);
      return { avg: w.reduce((a,x) => a + x.score * x.weight, 0) / ws, wsum: ws, n: g.length, weighted: true };
    }
    return { avg: g.reduce((a,x) => a + x.score, 0) / g.length, wsum: 0, n: g.length, weighted: false };
  }
  function avgColor(a) { return a.avg >= S.settings.scale.pass ? 'var(--sage)' : (a.weighted && a.wsum < 100 ? 'var(--warn)' : 'var(--bad)'); }
  function gradeBar(avg, color) {
    const m = S.settings.scale.max, p = S.settings.scale.pass;
    const pct = clamp(avg / m * 100, 0, 100);
    const pp = clamp(p / m * 100, 0, 100);
    return '<div class="bar" style="position:relative;overflow:visible"><i style="width:' + pct + '%;background:' + color + '"></i><span style="position:absolute;left:' + pp + '%;top:-3px;bottom:-3px;width:2px;background:rgba(240,236,228,.45);border-radius:2px"></span></div>';
  }
  function neededText(sid) {
    const g = S.grades.filter(x => x.sid === sid && x.weight > 0);
    if (!g.length) return '';
    const ws = g.reduce((a,x) => a + x.weight, 0);
    if (ws >= 100) return '';
    const pts = g.reduce((a,x) => a + x.score * x.weight, 0), rem = 100 - ws, p = S.settings.scale.pass, x = (p * 100 - pts) / rem;
    const pass = formatScalePass(S.settings.scale), score = S.settings.scale.type === 'letter' ? formatGrade(x, S.settings.scale) : num(x, 1);
    if (x <= 0) return L('grades.need.reached', { pass: pass });
    if (x > S.settings.scale.max) return L('grades.need.impossible', { rem: num(rem, 1), pass: pass });
    if (S.settings.scale.type === 'letter') return L('grades.need.letter', { score: score, rem: num(rem, 1) });
    return L('grades.need.numeric', { score: score, rem: num(rem, 1) });
  }

  function viewNotas() {
    const scale = S.settings.scale;
    const info = S.subjects.map(s => ({ s, a: subjAvg(s.id) }));
    const withA = info.filter(x => x.a);
    const gen = withA.length ? withA.reduce((t,x) => t + x.a.avg, 0) / withA.length : null;
    const above = withA.filter(x => x.a.avg >= scale.pass).length;
    const genPct = gen == null ? 0 : clamp(gen / scale.max * 100, 0, 100);
    const genColor = gen == null ? 'var(--muted)' : gen >= scale.pass ? 'var(--sage)' : 'var(--warn)';

    const overview = '<div class="panel grade-overview">' +
      '<div>' +
        '<div class="eyebrow" style="margin-bottom:10px">' + L('grades.overview') + '</div>' +
        (gen == null
          ? '<div class="muted" style="font-size:15px">' + L('grades.first') + '</div>'
          : '<div class="grade-big" style="color:' + genColor + '">' + formatGrade(gen, scale) + '<small>/ ' + formatScaleMax(scale) + '</small></div>' +
            '<div style="margin-top:14px;max-width:420px">' + gradeBar(gen, genColor) + '</div>' +
            '<p class="grade-sub">' + L('grades.subjectsAtLeast', { a: above, b: withA.length, scale: esc(scaleLabel(scale)) }) + '</p>') +
        '<div style="margin-top:14px"><button class="btn sm ghost" data-act="scale">' + L('grades.configure') + '</button></div>' +
      '</div>' +
      '<div>' + ringSVG(genPct, 132, 10, genColor, L('grades.average'), gen == null ? '—' : (scale.type === 'letter' ? formatGrade(gen, scale) : num(gen,1))) + '</div>' +
    '</div>';

    if (!S.subjects.length) return '<section class="section"><div class="section-head"><h2>' + L('section.notes') + '</h2></div>' + overview + '<div class="empty"><p>' + L('grades.noSubjects') + '</p><button class="btn pri" data-act="newSubject">' + L('action.newSubject') + '</button></div></section>';

    const list = info.map(x => {
      const s = x.s, a = x.a;
      const gs = S.grades.filter(g => g.sid === s.id);
      const rows = gs.map(g => '<button class="grade-row" data-act="editGrade" data-id="' + g.id + '">' +
        '<span class="grade-row-name">' + esc(g.name) + '</span>' +
        '<span class="grade-row-score">' + formatGrade(g.score, scale) + ' <span class="muted">/ ' + formatScaleMax(scale) + '</span></span>' +
        '<span class="grade-row-meta">' + (g.weight > 0 ? L('grades.weight', { n: num(g.weight,1) }) : L('grades.noWeight')) + '</span></button>').join('');
      const nt = neededText(s.id);
      const open = !closedG.has(s.id);
      const color = a ? avgColor(a) : 'var(--muted)';
      return '<details class="grade-subject" data-gid="' + s.id + '"' + (open ? ' open' : '') + '>' +
        '<summary><span class="grade-name"><span class="dot" style="background:' + s.color + '"></span><span>' + esc(s.name) + '</span></span>' +
        '<span class="grade-bar">' + (a ? gradeBar(a.avg, s.color) : '<span class="muted" style="font-size:13px">' + L('grades.noGrades') + '</span>') + '</span>' +
        '<span class="grade-avg" style="color:' + color + '">' + (a ? formatGrade(a.avg, scale) : '—') + '</span></summary>' +
        '<div class="grade-body">' + (rows || '<p class="grade-note">' + L('grades.noGrades') + '</p>') +
        (a && a.weighted ? '<p class="grade-note">' + L('grades.evaluated', { n: num(a.wsum,1) }) + (nt ? ' ' + nt : '') + '</p>' : (a ? '<p class="grade-note">' + L('grades.simple') + '</p>' : '')) +
        (a && a.wsum > 100 ? '<p class="grade-warn">' + L('grades.overWeight') + '</p>' : '') +
        '<div style="margin-top:12px"><button class="btn sm" data-act="newGrade" data-sid="' + s.id + '">' + L('section.newGrade') + '</button></div></div></details>';
    }).join('');

    return '<section class="section"><div class="section-head"><h2>' + L('section.notes') + '</h2><button class="btn sm" data-act="newGrade">' + L('section.newGrade') + '</button></div>' + overview + '<div class="grade-list">' + list + '</div></section>';
  }

  function scaleLabel(scale) {
    if (scale.type === 'letter') return L('grades.scaleLetter', { pass: formatScalePass(scale) });
    return L('grades.scaleNumeric', { max: num(scale.max), pass: num(scale.pass) });
  }

  // Flashcards
  function cardDueBadge() {
    return dueCards(S).length
      ? '<span class="badge accent">' + C('fc.due', dueCards(S).length) + '</span>'
      : '<span class="badge">' + L('fc.noDue') + '</span>';
  }

  function cardRow(c) {
    const sb = sub(S, c.sid);
    const mastered = c.reps >= 2 && c.interval >= 7 && c.lapses <= 1;
    const due = c.due <= todayKey();
    const status = mastered ? L('fc.mastered') : due ? L('fc.due.one') : L('fc.nextReview', { d: fmtShortDate(parseYmd(c.due)) });
    return '<article class="card fc-card" style="--c:' + (sb ? sb.color : 'var(--muted)') + '">' +
      '<div class="fc-card-top"><span class="tag">' + esc(sb ? sb.name : L('exam.prep.noSubject')) + '</span>' +
      '<span class="badge' + (mastered ? ' good' : due ? ' accent' : '') + '">' + esc(status) + '</span></div>' +
      '<div class="fc-face"><span class="eyebrow">' + L('fc.study.question') + '</span><p>' + esc(c.front) + '</p></div>' +
      '<div class="fc-face answer"><span class="eyebrow">' + L('fc.study.answer') + '</span><p>' + esc(c.back) + '</p></div>' +
      '<div class="card-footer">' +
        '<button class="btn sm" data-act="editCard" data-id="' + c.id + '">' + L('action.edit') + '</button>' +
        '<button class="btn sm pri" data-act="reviewOne" data-id="' + c.id + '">' + L('action.review') + '</button></div>' +
      (c.lastReview ? '<div class="fc-footnote">' + esc(L('fc.lastReview', { d: fmtShortDate(parseYmd(c.lastReview.slice(0, 10))) })) + '</div>' : '') +
      '</article>';
  }

  function flashcardStudyHTML() {
    const c = S.flashcards.find(x => x.id === cardQueue[cardIndex]);
    if (!c) {
      return '<section class="section"><div class="panel fc-done">' +
        '<div class="fc-done-icon">' + ic.check + '</div>' +
        '<h2 class="section-title">' + L('fc.study.done') + '</h2>' +
        '<p class="muted">' + L('fc.study.doneSub', { n: cardGrades.length, left: dueCards(S).length }) + '</p>' +
        '<div class="fc-done-actions"><button class="btn pri" data-act="exitCards">' + L('action.backToCards') + '</button>' +
        '<button class="btn ghost" data-act="reviewCards" data-sid="' + (S.ui.cardSid || '') + '">' + L('action.review') + '</button></div>' +
        '</div></section>';
    }
    const sb = sub(S, c.sid);
    return '<section class="section"><div class="section-head"><h2>' + L('fc.study.title') + '</h2>' +
      '<button class="btn sm ghost" data-act="exitCards">' + L('action.backToCards') + '</button></div>' +
      '<div class="fc-study" style="--c:' + (sb ? sb.color : 'var(--accent)') + '">' +
        '<div class="fc-progress"><span class="tnum">' + L('fc.study.progress', { a: cardIndex + 1, b: cardQueue.length }) + '</span>' +
        '<div class="bar"><i style="width:' + (cardIndex / cardQueue.length * 100) + '%"></i></div></div>' +
        '<button type="button" class="fc-flip' + (cardFlipped ? ' flipped' : '') + '" data-act="flipCard" aria-label="' + L('fc.study.tap') + '">' +
          '<div class="fc-side front"><span class="eyebrow">' + L('fc.study.question') + '</span>' +
            '<p>' + esc(c.front) + '</p><span class="fc-hint">' + L('fc.study.tap') + '</span></div>' +
          '<div class="fc-side back"><span class="eyebrow">' + L('fc.study.answer') + '</span>' +
            '<p>' + esc(c.back) + '</p></div></button>' +
        (cardFlipped
          ? '<div class="fc-grades">' +
              ['hard', 'good', 'easy'].map(g => '<button type="button" class="btn fc-grade ' + g + '" data-act="gradeCard" data-grade="' + g + '">' +
                '<strong>' + L('fc.grade.' + g) + '</strong><span>' + L('fc.grade.' + g + 'Hint') + '</span></button>').join('') +
              '</div>'
          : '') +
        '<p class="settings-hint">' + esc(L('fc.nextReview', { d: fmtShortDate(parseYmd(c.due)) })) + '</p>' +
      '</div></section>';
  }

  function resetCardSession() {
    cardQueue = []; cardIndex = 0; cardFlipped = false; cardGrades.length = 0;
  }

  function startCards(ids) {
    resetCardSession();
    cardQueue = ids.slice();
    if (S.ui.tab !== 'flashcards') setTab('flashcards'); else renderView();
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (e) {}
  }

  function viewFlashcards() {
    if (cardQueue.length) return flashcardStudyHTML();
    if (!S.subjects.length) {
      return '<section class="section"><div class="empty"><p>' + L('fc.subjectsRequired') + '</p>' +
        '<button class="btn pri" data-act="newSubject">' + L('action.newSubject') + '</button></div></section>';
    }
    const sid = S.ui.cardSid && sub(S, S.ui.cardSid) ? S.ui.cardSid : null;
    const list = cardsBy(S, sid).slice().sort((a, b) => a.due.localeCompare(b.due));
    const st = cardStats(S, sid);
    const chips = '<div class="chips" role="group">' +
      '<button class="chip ' + (sid ? '' : 'today') + '" data-act="cardFilter" data-sid="" aria-pressed="' + (!sid) + '">' + L('fc.all') + '</button>' +
      S.subjects.map(s => '<button class="chip" data-act="cardFilter" data-sid="' + s.id + '" aria-pressed="' + (sid === s.id) + '">' +
        '<span class="dot" style="background:' + s.color + '"></span>' + esc(s.name) + '</button>').join('') + '</div>';
    const summary = '<div class="fc-summary">' +
      '<span class="badge">' + C('fc.count', st.total) + '</span>' +
      '<span class="badge accent">' + C('fc.due', st.due) + '</span>' +
      '<span class="badge">' + L('fc.mastered') + ': ' + st.mastered + '</span></div>';
    const toolbar = '<div class="section-toolbar"><button class="btn sm pri" data-act="newCard">' + L('action.newCard') + '</button>' +
      '<button class="btn sm" data-act="reviewCards" data-sid="' + (sid || '') + '">' + L('action.review') + '</button>' + cardDueBadge() + '</div>';
    const firstCards = list.slice(0, 60).map(cardRow).join('');
    const restCards = list.slice(60).map(cardRow).join('');
    const cards = list.length
      ? '<div class="cards fc-grid">' + firstCards + '</div>' +
        (restCards ? '<details class="show-more"><summary class="btn sm">' + esc(moreLabel(list.length - 60)) + '</summary><div class="cards fc-grid">' + restCards + '</div></details>' : '')
      : '<div class="empty"><p>' + L('fc.empty') + '</p><button class="btn pri" data-act="newCard">' + L('action.newCard') + '</button></div>';
    return '<section class="section"><div class="section-head"><h2>' + L('section.flashcards') + '</h2>' +
      '<span class="muted" style="font-size:13px">' + L('fc.subtitle') + '</span></div>' +
      chips + summary + toolbar + cards + '</section>';
  }
  // Modals
  function openModal(title, body, opts) {
    opts = opts || {};
    closeModal();
    closeQuizOverlay();
    $('#modalRoot').innerHTML = '<div class="overlay" data-act="overlay"><div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<div class="sheet-head"><h2>' + esc(title) + '</h2><button class="icon-btn" data-act="closeModal" aria-label="' + L('action.close') + '">' + ic.x + '</button></div>' +
      '<form id="mForm" novalidate><div class="sheet-body"><div class="form">' + body + '<div class="form-error" id="fErr" role="alert" hidden></div></div></div>' +
      '<div class="sheet-foot">' + (opts.del ? '<button type="button" class="btn danger" data-act="modalDel" data-confirm="' + L('action.confirmDelete') + '">' + L('action.delete') + '</button>' : '<span></span>') +
      '<div class="sheet-actions"><button type="button" class="btn ghost" data-act="closeModal">' + L('action.cancel') + '</button><button type="submit" class="btn pri">' + esc(opts.submit || L('action.save')) + '</button></div></div></form></div></div>';
    modal = { onDelete: opts.onDelete, prev: document.activeElement };
    const form = $('#mForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const r = opts.onSubmit ? opts.onSubmit(fd, form) : null;
      if (r && (r.error || r.cancelled)) {
        if (r.error) { const el = $('#fErr'); el.textContent = r.error; el.hidden = false; }
        return;
      }
      closeModal();
    });
    setTimeout(() => { const f = form.querySelector('input:not([type=radio]):not([type=hidden]),select,textarea'); if (f) f.focus(); }, 30);
  }
  function closeModal() {
    if (!modal) return;
    const p = modal.prev; modal = null; $('#modalRoot').innerHTML = '';
    try { if (p && p.isConnected) p.focus(); } catch (e) {}
    /* Al cerrar el editor de preguntas se vuelve al banco de origen. */
    if (bankReturnSid) { const sid = bankReturnSid; bankReturnSid = null; setTimeout(() => renderBank(sid), 0); }
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (modal) closeModal();
    else if (quizOverlay) closeQuizOverlay();
  });

  function subOpts(sel, none) {
    return (none ? '<option value="">' + L('modal.noSubject') + '</option>' : '') + S.subjects.map(s => '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
  }
  function unitOpts(sid, selected, none, firstLabel) {
    const list = unitsBy(S, sid);
    return (none ? '<option value="">' + esc(firstLabel || L('quiz.modal.unit.all')) + '</option>' : '') +
      list.map(u => '<option value="' + u.id + '"' + (u.id === selected ? ' selected' : '') + '>' + esc(u.name) + '</option>').join('');
  }
  function needSubject() { if (S.subjects.length) return true; subjectModal(); return false; }

  function subjectModal(id) {
    const s = id ? sub(S, id) : null;
    const used = S.subjects.map(x => x.color);
    const col = s ? s.color : (COLORS.find(c => used.indexOf(c) < 0) || COLORS[S.subjects.length % COLORS.length]);
    openModal(L(s ? 'modal.subject.edit' : 'modal.subject.new'),
      '<label class="field"><span>' + L('modal.subject.name') + '</span><input name="name" maxlength="60" value="' + esc(s ? s.name : '') + '" placeholder="' + L('modal.subject.namePh') + '" autocomplete="off"></label>' +
      '<div class="field"><span>' + L('modal.subject.color') + '</span><div class="swatches">' + COLORS.map(c => '<label class="swatch"><input type="radio" name="color" value="' + c + '"' + (c===col?' checked':'') + '><span style="--c:' + c + '"></span></label>').join('') + '</div></div>' +
      '<div class="field"><span>' + L('modal.subject.goal') + '</span>' + hoursMinutesInput(goalMinOf(s), 'sgH', 'sgM') + '</div>' +
      '<p class="settings-hint">' + L('modal.subject.goalHint') + '</p>',
      { del: !!s, submit: L(s ? 'action.save' : 'action.add'),
        onSubmit(fd) {
          const name = String(fd.get('name') || '').trim();
          if (!name) return { error: L('modal.subject.nameRequired') };
          const goal = readHoursMinutes('sgH', 'sgM');
          const color = fd.get('color') || col;
          if (s) {
            /* Editar el nombre propio congela el texto: deja de ser demo. */
            if (name !== s.name) delete s.demoKey;
            s.name = name; s.color = color; setGoalMin(s, goal);
          }
          else S.subjects.push({ id: uid(), name, color, goal: goal / 60, goalMin: goal, progress: 0 });
          afterChange();
        },
        onDelete() {
          const k = id;
          if (T().sid === k) resetTimer();
          S.subjects = S.subjects.filter(x => x.id !== k);
          S.blocks = S.blocks.filter(x => x.sid !== k);
          S.exams = S.exams.filter(x => x.sid !== k);
          S.grades = S.grades.filter(x => x.sid !== k);
          S.units = S.units.filter(x => x.sid !== k);
          S.flashcards = S.flashcards.filter(x => x.sid !== k);
          S.questions = (S.questions || []).filter(x => x.sid !== k);
          S.quizHistory = (S.quizHistory || []).filter(x => x.sid !== k);
          if (quizOverlay) closeQuizOverlay();
          if (S.activeProgram) S.activeProgram.subjectIds = S.activeProgram.subjectIds.filter(id => id !== k);
          for (const d in S.log) { delete S.log[d][k]; if (!Object.keys(S.log[d]).length) delete S.log[d]; }
          afterChange();
        }
      });
  }
  function blockModal(id, day) {
    const b = id ? S.blocks.find(x => x.id === id) : null;
    const d = b ? b.day : (day != null ? day : S.ui.selDay);
    const refreshDur = () => {
      const el = $('#bdur'), st = $('#bstart'), en = $('#bend');
      if (!el || !st || !en) return;
      const m = toMin(en.value) - toMin(st.value);
      el.textContent = m > 0 ? L('modal.block.duration', { d: fmtMin(m) }) : L('modal.block.timeError');
      el.classList.toggle('invalid', !(m > 0));
    };
    openModal(L(b ? 'modal.block.edit' : 'modal.block.new'),
      '<div class="field"><span>' + L('modal.block.type') + '</span><div class="seg"><label><input type="radio" name="type" value="clase"' + (!b||b.type==='clase'?' checked':'') + '><span>' + L('agenda.class') + '</span></label><label><input type="radio" name="type" value="estudio"' + (b&&b.type==='estudio'?' checked':'') + '><span>' + L('agenda.study') + '</span></label></div></div>' +
      '<label class="field"><span>' + L('modal.block.day') + '</span><select name="day">' + D.long().map((n,i)=>'<option value="' + i + '"' + (i===d?' selected':'') + '>' + n.charAt(0).toUpperCase()+n.slice(1) + '</option>').join('') + '</select></label>' +
      '<div class="row2"><label class="field"><span>' + L('modal.block.from') + '</span><input type="time" step="60" name="start" id="bstart" value="' + (b?b.start:'08:00') + '"></label><label class="field"><span>' + L('modal.block.to') + '</span><input type="time" step="60" name="end" id="bend" value="' + (b?b.end:'10:00') + '"></label></div>' +
      '<p class="duration-preview" id="bdur" aria-live="polite"></p>' +
      '<label class="field"><span>' + L('modal.block.subject') + '</span><select name="sid">' + subOpts(b?b.sid:(S.subjects[0]&&S.subjects[0].id), true) + '</select></label>' +
      '<label class="field"><span>' + L('modal.block.note') + '</span><input name="note" maxlength="40" value="' + esc(b?b.note:'') + '" autocomplete="off"></label>',
      { del: !!b, submit: L(b ? 'action.save' : 'action.add'),
        onSubmit(fd) {
          const st = normTime(fd.get('start') || '08:00'), en = normTime(fd.get('end') || '10:00');
          if (toMin(en) <= toMin(st)) return { error: L('modal.block.timeError') };
          const v = { day:+fd.get('day'), start:st, end:en, sid: fd.get('sid')||null, type: fd.get('type')||'clase', note: String(fd.get('note')||'').trim() };
          if (b) {
            if (v.note !== b.note) delete b.demoKey;
            Object.assign(b, v);
          } else S.blocks.push(Object.assign({ id: uid() }, v));
          S.ui.selDay = v.day; afterChange();
        },
        onDelete() { S.blocks = S.blocks.filter(x => x.id !== id); afterChange(); }
      });
    const ds = $('#bstart'), de = $('#bend');
    if (ds && de) { ds.addEventListener('input', refreshDur); de.addEventListener('input', refreshDur); refreshDur(); }
  }

  function examModal(id) {
    const e = id ? S.exams.find(x => x.id === id) : null;
    openModal(L(e ? 'modal.exam.edit' : 'modal.exam.new'),
      '<label class="field"><span>' + L('modal.exam.title') + '</span><input name="title" maxlength="80" value="' + esc(e?e.title:'') + '" placeholder="' + L('modal.exam.titlePh') + '" autocomplete="off"></label>' +
      '<div class="row2"><label class="field"><span>' + L('modal.exam.kind') + '</span><select name="kind">' + ['Parcial','Examen','Entrega','Otro'].map(k=>'<option value="' + k + '"' + (e&&e.kind===k?' selected':'') + '>' + kindText(k) + '</option>').join('') + '</select></label>' +
      '<label class="field"><span>' + L('modal.block.subject') + '</span><select name="sid">' + subOpts(e?e.sid:null, true) + '</select></label></div>' +
      '<div class="row2"><label class="field"><span>' + L('modal.exam.date') + '</span><input type="date" name="date" value="' + (e?e.date:'') + '"></label><label class="field"><span>' + L('modal.exam.time') + '</span><input type="time" name="time" value="' + (e?e.time:'') + '"></label></div>',
      { del: !!e, submit: L(e ? 'action.save' : 'action.add'),
        onSubmit(fd) {
          const title = String(fd.get('title')||'').trim(), date = fd.get('date');
          if (!title) return { error: L('modal.exam.titleRequired') };
          if (!date) return { error: L('modal.exam.dateRequired') };
          const v = { title, kind: fd.get('kind'), sid: fd.get('sid')||null, date, time: fd.get('time')||'' };
          if (e) {
            if (title !== e.title) delete e.demoKey;
            Object.assign(e, v);
          } else S.exams.push(Object.assign({ id: uid() }, v));
          afterChange();
        },
        onDelete() { S.exams = S.exams.filter(x => x.id !== id); afterChange(); }
      });
  }

  function gradeModal(id, sid) {
    const g = id ? S.grades.find(x => x.id === id) : null;
    const scale = S.settings.scale;
    const scoreField = scale.type === 'letter'
      ? '<label class="field"><span>' + L('modal.grade.scoreLetter') + '</span><select name="score">' + scale.letters.map((l,i)=>'<option value="' + i + '"' + (g && Math.round(g.score)===i ? ' selected':'') + '>' + l + '</option>').join('') + '</select></label>'
      : '<label class="field"><span>' + L('modal.grade.score', { max: num(scale.max) }) + '</span><input name="score" type="number" inputmode="decimal" step="any" min="0" max="' + scale.max + '" value="' + (g?g.score:'') + '"></label>';
    openModal(L(g ? 'modal.grade.edit' : 'modal.grade.new'),
      '<label class="field"><span>' + L('modal.block.subject') + '</span><select name="sid">' + subOpts(g?g.sid:sid) + '</select></label>' +
      '<label class="field"><span>' + L('modal.grade.assessment') + '</span><input name="name" maxlength="60" value="' + esc(g?g.name:'') + '" placeholder="' + L('sample.grade.midterm') + '" autocomplete="off"></label>' +
      '<div class="row2">' + scoreField + '<label class="field"><span>' + L('modal.grade.weight') + '</span><input name="weight" type="number" inputmode="decimal" step="any" min="0" max="100" value="' + (g?g.weight:'') + '"></label></div>',
      { del: !!g, submit: L(g ? 'action.save' : 'action.add'),
        onSubmit(fd) {
          const sc = fnum(fd.get('score'));
          const w = fd.get('weight') === '' ? 0 : fnum(fd.get('weight'));
          if (isNaN(sc) || sc < 0 || sc > scale.max) return { error: L('modal.grade.validation', { max: formatScaleMax(scale) }) };
          if (isNaN(w) || w < 0 || w > 100) return { error: L('modal.grade.weightRange') };
          const v = { sid: fd.get('sid'), name: String(fd.get('name')||'').trim() || L('grades.defaultName'), score: sc, weight: w };
          if (g) {
            if (v.name !== g.name) delete g.demoKey;
            Object.assign(g, v);
          } else S.grades.push(Object.assign({ id: uid() }, v));
          afterChange();
        },
        onDelete() { S.grades = S.grades.filter(x => x.id !== id); afterChange(); }
      });
  }
  function cardModal(id, sid) {
    const c = id ? S.flashcards.find(x => x.id === id) : null;
    const first = c ? c.sid : (sid || S.ui.cardSid || (S.subjects[0] && S.subjects[0].id));
    openModal(L(c ? 'modal.card.edit' : 'modal.card.new'),
      '<label class="field"><span>' + L('modal.card.subject') + '</span><select name="sid">' + subOpts(first) + '</select></label>' +
      '<label class="field"><span>' + L('mastery.unit') + '</span><select id="cardUnit" name="unitId">' + unitOpts(first, c ? c.unitId : '', true, L('quiz.modal.q.none')) + '</select></label>' +
      '<label class="field"><span>' + L('modal.card.front') + '</span><textarea name="front" rows="3" maxlength="300" placeholder="' + L('modal.card.frontPh') + '">' + esc(c ? c.front : '') + '</textarea></label>' +
      '<label class="field"><span>' + L('modal.card.back') + '</span><textarea name="back" rows="3" maxlength="500" placeholder="' + L('modal.card.backPh') + '">' + esc(c ? c.back : '') + '</textarea></label>',
      { del: !!c, submit: L(c ? 'action.save' : 'action.add'),
        onSubmit(fd) {
          const front = String(fd.get('front') || '').trim(), back = String(fd.get('back') || '').trim();
          if (!front || !back) return { error: L('modal.card.required') };
          const v = { sid: fd.get('sid'), unitId: fd.get('unitId') || '', front, back };
          if (c) {
            if (front !== c.front) delete c.demoKey;
            if (back !== c.back) delete c.demoBackKey;
            Object.assign(c, v);
          } else S.flashcards.push(Object.assign(newCard(v.sid, front, back, v.unitId), v));
          afterChange();
        },
        onDelete() { S.flashcards = S.flashcards.filter(x => x.id !== id); afterChange(); }
      });
    const sidSel = $('#mForm select[name="sid"]');
    if (sidSel) sidSel.addEventListener('change', () => {
      const sel = $('#cardUnit');
      if (sel) sel.innerHTML = unitOpts(sidSel.value, '', true, L('quiz.modal.q.none'));
    });
  }

  /* ---------- Etapa 2: banco de preguntas y simulacro cronometrado ---------- */

  function clearExamTimer() {
    if (examTimer) { clearInterval(examTimer); examTimer = null; }
  }
  function closeQuizOverlay() {
    clearExamTimer();
    quizOverlay = null;
    lastResult = null;
    const root = $('#modalRoot');
    if (root) root.innerHTML = '';
  }
  function openQuizOverlay(kind) {
    closeModal();
    closeQuizOverlay();
    quizOverlay = kind;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function resetAutoQuizzes() { autoQuizzes = Object.create(null); }
  function autoPool(sid) {
    if (!sid) return [];
    if (!Object.prototype.hasOwnProperty.call(autoQuizzes, sid)) {
      autoQuizzes[sid] = generateQuestionsFromCards(S, sid);
    }
    return autoQuizzes[sid] || [];
  }
  /* Banco escrito por la persona + preguntas generadas desde sus tarjetas. */
  function quizPoolFor(sid, unitId) {
    const bank = (S.questions || []).filter(q => q.sid === sid && (!unitId || q.unitId === unitId));
    const auto = autoPool(sid).filter(q => !unitId || q.unitId === unitId);
    const seen = Object.create(null);
    return bank.concat(auto).filter(q => {
      const k = String(q.text || '').trim().toLowerCase();
      if (!k || seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }
  function quizById(id) {
    const own = (S.questions || []).find(q => q.id === id);
    if (own) return own;
    for (const sid in autoQuizzes) {
      const found = (autoQuizzes[sid] || []).find(q => q.id === id);
      if (found) return found;
    }
    return null;
  }
  function fmtClockShort(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  }

  function renderBank(sid) {
    const s = sub(S, sid);
    if (!s) { closeQuizOverlay(); return; }
    quizBankSid = sid; quizOverlay = 'bank';
    const all = (S.questions || []).filter(q => q.sid === sid);
    const cards = all.map(q => {
      const u = unitsBy(S, sid).find(x => x.id === q.unitId);
      return '<div class="qz-row' + (q.demoKey ? ' is-demo' : '') + '">' +
        '<div class="qz-row-main"><span class="qz-row-text">' + esc(q.text) + '</span>' +
        '<span class="qz-row-meta">' + (u ? esc(u.name) : L('quiz.modal.q.none')) + ' · ' + esc(q.options[q.answer] || '') + '</span></div>' +
        '<div class="qz-row-actions">' +
        '<button class="icon-btn" data-act="editQuestion" data-id="' + q.id + '" aria-label="' + L('action.edit') + '">' + ic.sliders + '</button>' +
        '<button class="icon-btn" data-act="deleteQuestion" data-id="' + q.id + '" data-confirm="' + L('quiz.bank.deleteConfirm') + '" aria-label="' + L('action.delete') + '">' + ic.trash + '</button>' +
        '</div></div>';
    });
    const first = cards.slice(0, 50).join('');
    const rest = cards.slice(50).join('');
    const rows = cards.length ? first + (rest ? '<details class="show-more"><summary class="btn sm">' + esc(moreLabel(cards.length - 50)) + '</summary>' + rest + '</details>' : '') : '<p class="muted unit-empty">' + L('quiz.bank.empty') + '</p>';
    $('#modalRoot').innerHTML = '<div class="overlay" data-act="quizOverlay">' +
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(s.name + ' · ' + L('action.questionBank')) + '">' +
      '<div class="sheet-head"><h2>' + esc(L('action.questionBank') + ' · ' + s.name) + '</h2>' +
      '<button class="icon-btn" data-act="closeQuizOverlay" aria-label="' + L('action.close') + '">' + ic.x + '</button></div>' +
      '<div class="sheet-body"><p class="muted curr-intro">' + L('quiz.bank.subtitle') + '</p>' +
      '<div class="qz-list">' + rows + '</div></div>' +
      '<div class="sheet-foot"><span class="badge">' + L('quiz.bank.count', { n: all.length }) + '</span>' +
      '<div class="sheet-actions">' +
      '<button class="btn sm" data-act="examHistory" data-id="' + sid + '">' + L('action.examHistory') + '</button>' +
      '<button class="btn sm" data-act="mockExam" data-id="' + sid + '">' + L('action.mockExam') + '</button>' +
      '<button class="btn sm" data-act="generateFromCards" data-id="' + sid + '">' + L('action.generateFromCards') + '</button>' +
      '<button class="btn sm pri" data-act="newQuestion" data-id="' + sid + '">' + L('action.newQuestion') + '</button>' +
      '</div></div></div></div>';
  }

  /* Importa las flashcards de la materia al banco persistido y refresca el
     modal en el acto para que se vean, editen o eliminen ahí mismo. */
  function importFromCards(sid) {
    sid = sid || quizBankSid;
    if (!sub(S, sid)) return;
    const r = importQuestionsFromCards(S, sid);
    if (!r.added) {
      const key = r.reason === 'few' ? 'quiz.bank.generateFew'
        : r.reason === 'all' ? 'quiz.bank.generateAll'
        : 'quiz.bank.generateNoOptions';
      toast(L(key));
      return;
    }
    afterChange();
    renderBank(sid);
    toast(C('quiz.bank.generated', r.added));
  }

  function questionModal(id, sid) {
    const q = id ? quizById(id) : null;
    const first = q ? q.sid : (sid || S.ui.cardSid || (S.subjects[0] && S.subjects[0].id));
    if (!first) { subjectModal(); return; }
    openModal(L(q ? 'quiz.modal.q.edit' : 'quiz.modal.q.new'),
      '<label class="field"><span>' + L('quiz.modal.q.subject') + '</span><select name="sid">' + subOpts(first) + '</select></label>' +
      '<label class="field"><span>' + L('quiz.modal.q.unit') + '</span><select id="qUnit" name="unitId">' + unitOpts(first, q ? q.unitId : '', true, L('quiz.modal.unit.all')) + '</select></label>' +
      '<label class="field"><span>' + L('quiz.modal.q.text') + '</span><textarea name="text" rows="3" maxlength="500" placeholder="' + L('quiz.modal.q.textPh') + '">' + esc(q ? q.text : '') + '</textarea></label>' +
      [0, 1, 2, 3].map(i => '<label class="field"><span>' + L('quiz.modal.q.option') + ' ' + 'ABCD'[i] + '</span>' +
        '<input name="o' + i + '" maxlength="300" placeholder="' + L('quiz.modal.q.optionPh') + '" value="' + esc(q ? (q.options[i] || '') : '') + '"></label>').join('') +
      '<label class="field"><span>' + L('quiz.modal.q.correct') + '</span><select name="answer">' +
      [0, 1, 2, 3].map(i => '<option value="' + i + '"' + ((q ? q.answer : 0) === i ? ' selected' : '') + '>' + 'ABCD'[i] + '</option>').join('') + '</select></label>',
      { del: !!q, submit: L(q ? 'action.save' : 'action.add'),
        onSubmit(fd) {
          const text = String(fd.get('text') || '').trim();
          const options = [0, 1, 2, 3].map(i => String(fd.get('o' + i) || '').trim());
          const answer = clamp(Math.round(fnum(fd.get('answer'))) || 0, 0, 3);
          if (!text) return { error: L('quiz.modal.q.required') };
          if (options.some(o => !o)) return { error: L('quiz.modal.q.optionsRequired') };
          const next = { sid: fd.get('sid'), unitId: fd.get('unitId') || '', text, options, answer };
          if (q) {
            if (text !== q.text) delete q.demoKey;
            if (options.join('|') !== (q.options || []).join('|')) q.demoOptionKeys = null;
            Object.assign(q, next);
          } else S.questions.push(Object.assign(newQuestion(next.sid, next.unitId, text, options, answer), next));
          bankReturnSid = null;
          afterChange();
          /* openModal cierra el formulario justo después de onSubmit. */
          setTimeout(() => renderBank(next.sid), 0);
        },
        onDelete() {
          const owner = q ? q.sid : sid;
          S.questions = (S.questions || []).filter(x => x.id !== id);
          save(S); renderView(); renderBank(owner);
        }
      });
    bankReturnSid = q ? q.sid : (sid || first);
    const sidSel = $('#mForm select[name="sid"]');
    if (sidSel) sidSel.addEventListener('change', () => {
      const sel = $('#qUnit');
      if (sel) sel.innerHTML = unitOpts(sidSel.value, '', true, L('quiz.modal.unit.all'));
    });
  }

  function setupModal(sid) {
    if (!S.subjects.length) { if (needSubject()) toast(L('quiz.modal.exam.noQuestions')); return; }
    const first = sid && sub(S, sid) ? sid : S.ui.cardSid || S.subjects[0].id;
    const available = quizPoolFor(first, '');
    quizSetup = { sid: first, unitId: '', minutes: 10, count: Math.min(10, available.length) };
    openModal(L('quiz.modal.exam.title'),
      '<label class="field"><span>' + L('quiz.modal.exam.subject') + '</span><select id="qzSid" name="sid">' + subOpts(first) + '</select></label>' +
      '<label class="field"><span>' + L('quiz.modal.exam.unit') + '</span><select id="qzUnit" name="unitId">' + unitOpts(first, '', true, L('quiz.modal.unit.all')) + '</select></label>' +
      '<div class="row2">' +
      '<label class="field"><span>' + L('quiz.modal.exam.duration') + '</span><select name="minutes">' +
      [10, 20, 30].map(m => '<option value="' + m + '"' + (m === 10 ? ' selected' : '') + '>' + m + ' ' + L('unit.minute') + '</option>').join('') + '</select></label>' +
      '<label class="field"><span>' + L('quiz.modal.exam.count') + '</span><input id="qzCount" type="number" inputmode="numeric" min="1" max="100" value="' + Math.max(1, available.length) + '"></label></div>' +
      '<p class="settings-hint">' + L('quiz.modal.exam.hint', { n: available.length }) + '</p>',
      { submit: L('quiz.modal.exam.start'),
        onSubmit(fd) {
          const sid2 = fd.get('sid') || first;
          const pool = quizPoolFor(sid2, fd.get('unitId'));
          if (!pool.length) return { error: L('quiz.modal.exam.noQuestions') };
          const want = clamp(Math.round(fnum($('#qzCount') ? $('#qzCount').value : pool.length)) || pool.length, 1, pool.length);
          startExam(sid2, fd.get('unitId') || '', clamp(Math.round(fnum(fd.get('minutes'))) || 10, 1, 180), pool, want);
        }
      });
    const refreshCount = () => {
      const pool = quizPoolFor(sidSel.value, unitSel.value);
      const input = $('#qzCount');
      if (input) { input.max = Math.max(1, pool.length); input.value = Math.max(1, Math.min(pool.length, +(input.value || pool.length))); }
    };
    const sidSel = $('#qzSid'), unitSel = $('#qzUnit');
    if (sidSel) sidSel.addEventListener('change', () => {
      if (unitSel) unitSel.innerHTML = unitOpts(sidSel.value, '', true, L('quiz.modal.unit.all'));
      refreshCount();
    });
    if (unitSel) unitSel.addEventListener('change', refreshCount);
  }

  function startExam(sid, unitId, minutes, pool, count) {
    closeModal(); closeQuizOverlay();
    const list = shuffle(pool).slice(0, Math.max(1, count || pool.length));
    if (!list.length) { toast(L('quiz.modal.exam.noQuestions')); return; }
    exam = {
      sid: sid, unitId: unitId || '', minutes: minutes,
      endsAt: Date.now() + minutes * 60000,
      questions: list, answers: {}, index: 0, total: list.length
    };
    quizOverlay = 'exam';
    renderExam();
    clearExamTimer();
    examTimer = setInterval(tickExam, 1000);
  }

  function readExamChoice() {
    if (!exam) return;
    const q = exam.questions[exam.index];
    if (!q) return;
    const checked = $('#modalRoot input[name="qzAns"]:checked');
    if (checked) exam.answers[q.id] = +checked.value;
  }

  function renderExam() {
    if (!exam) { closeQuizOverlay(); return; }
    quizOverlay = 'exam';
    const q = exam.questions[exam.index];
    const chosen = exam.answers[q.id];
    const opts = q.options.map((text, i) =>
      '<label class="qz-option' + (chosen === i ? ' picked' : '') + '">' +
      '<input type="radio" name="qzAns" value="' + i + '"' + (chosen === i ? ' checked' : '') + '>' +
      '<span class="qz-opt-letter">' + 'ABCD'[i] + '</span><span class="qz-opt-text">' + esc(text) + '</span></label>').join('');
    const left = Math.max(0, exam.endsAt - Date.now());
    $('#modalRoot').innerHTML = '<div class="overlay" data-act="quizOverlay"><div class="sheet qz-sheet" role="dialog" aria-modal="true" aria-label="' + L('quiz.exam.title') + '">' +
      '<div class="sheet-head"><div><h2>' + L('quiz.exam.title') + '</h2>' +
      '<span class="qz-exam-meta">' + esc((sub(S, exam.sid) || {}).name || '') + '</span></div>' +
      '<button class="icon-btn qz-clock" id="qzClock" aria-label="' + L('quiz.exam.time') + '">' + fmtClockShort(left) + '</button></div>' +
      '<div class="sheet-body"><div class="qz-exam-progress">' +
      '<span class="tnum">' + L('quiz.exam.progress', { a: exam.index + 1, b: exam.total }) + '</span>' +
      '<div class="bar"><i id="qzBar" style="width:' + (exam.index / exam.total * 100) + '%"></i></div></div>' +
      '<div class="qz-question"><span class="eyebrow">' + L('quiz.exam.question') + '</span>' +
      '<p>' + esc(q.text) + '</p></div>' +
      '<div class="qz-options" role="radiogroup" aria-label="' + L('quiz.exam.choose') + '">' + opts + '</div></div>' +
      '<div class="sheet-foot"><button class="btn ghost" data-act="closeQuizOverlay" data-confirm="' + L('quiz.exam.leaveConfirm') + '">' + L('action.close') + '</button>' +
      '<div class="sheet-actions">' +
      '<button class="btn sm" data-act="qzPrev"' + (exam.index ? '' : ' disabled') + '>' + L('quiz.exam.prev') + '</button>' +
      (exam.index + 1 < exam.total
        ? '<button class="btn sm pri" data-act="qzNext">' + L('quiz.exam.next') + '</button>'
        : '<button class="btn sm pri" data-act="qzFinish" data-confirm="' + L('quiz.exam.finishConfirm') + '">' + L('quiz.exam.finish') + '</button>') +
      '</div></div></div></div>';
  }

  function tickExam() {
    if (!exam || quizOverlay !== 'exam') { clearExamTimer(); return; }
    const left = exam.endsAt - Date.now();
    const clock = $('#qzClock');
    if (clock) {
      clock.textContent = fmtClockShort(left);
      clock.classList.toggle('urgent', left <= 60000);
    }
    const bar = $('#qzBar');
    if (bar) bar.style.width = (100 - clamp(left / (exam.minutes * 60000) * 100, 0, 100)) + '%';
    if (left <= 0) finishExam(true);
  }

  function finishExam(auto) {
    if (!exam) return;
    readExamChoice();
    clearExamTimer();
    const answers = exam.questions.map(q => {
      const chosen = exam.answers[q.id] == null ? -1 : exam.answers[q.id];
      return { qid: q.id, unitId: q.unitId || '', chosen: chosen, answer: q.answer, ok: chosen === q.answer };
    });
    const sc = quizScore(answers.filter(a => a.ok).length, answers.length, S.settings.scale);
    const rec = {
      id: uid(), sid: exam.sid, unitId: exam.unitId || '', at: new Date().toISOString(),
      minutes: exam.minutes, total: answers.length, correct: sc.correct, wrong: sc.wrong,
      percent: sc.percent, score: sc.score, grade: sc.grade, pass: sc.pass,
      scale: sc.scale, answers: answers, auto: !!auto
    };
    finishQuiz(S, rec);
    save(S); renderView();
    exam = null;
    renderResult(rec);
    if (auto) toast(L('quiz.exam.timeUp'));
  }

  function answerText(q, i) {
    return q && q.options && q.options[i] != null ? q.options[i] : '—';
  }
  function missedHTML(rec) {
    return rec.answers.filter(a => !a.ok).map(a => {
      const q = quizById(a.qid);
      return '<div class="qz-review-item missed">' +
        '<p class="qz-review-q">' + esc(q ? q.text : (a.qid || '')) + '</p>' +
        '<p class="qz-review-line bad"><span>' + L('quiz.review.yourAnswer') + '</span> ' + esc(answerText(q, a.chosen)) + '</p>' +
        '<p class="qz-review-line good"><span>' + L('quiz.review.rightAnswer') + '</span> ' + esc(answerText(q, a.answer)) + '</p>' +
        '</div>';
    }).join('');
  }
  function renderResult(rec) {
    if (!rec) { closeQuizOverlay(); return; }
    lastResult = rec; quizOverlay = 'result';
    const missed = rec.answers.filter(a => !a.ok);
    $('#modalRoot').innerHTML = '<div class="overlay" data-act="quizOverlay"><div class="sheet qz-sheet" role="dialog" aria-modal="true" aria-label="' + L('quiz.result.title') + '">' +
      '<div class="sheet-head"><h2>' + L('quiz.result.title') + '</h2>' +
      '<button class="icon-btn" data-act="closeQuizOverlay" aria-label="' + L('action.close') + '">' + ic.x + '</button></div>' +
      '<div class="sheet-body"><div class="qz-result-hero' + (rec.pass ? ' pass' : ' fail') + '">' +
      '<span class="eyebrow">' + (rec.pass ? L('quiz.result.pass') : L('quiz.result.fail')) + '</span>' +
      '<div class="qz-result-score">' + esc(rec.grade) + '</div>' +
      '<p class="muted">' + L('quiz.result.score', { score: num(rec.score, 2), max: formatScaleMax(rec.scale || S.settings.scale), percent: rec.percent }) + '</p>' +
      '</div><div class="qz-stats">' +
      '<span class="badge good">' + L('quiz.result.correct') + ': ' + rec.correct + '</span>' +
      '<span class="badge">' + L('quiz.result.wrong') + ': ' + rec.wrong + '</span>' +
      '<span class="badge">' + L('quiz.exam.time') + ': ' + rec.minutes + ' ' + L('unit.minute') + '</span></div>' +
      (missed.length
        ? '<h3 class="qz-subtitle">' + L('quiz.result.missed') + '</h3><div class="qz-review-list">' + missedHTML(rec) + '</div>'
        : '<p class="ok-msg">' + L('quiz.result.perfect') + '</p>') +
      '</div><div class="sheet-foot"><button class="btn ghost" data-act="examHistory" data-id="' + rec.sid + '">' + L('action.examHistory') + '</button>' +
      '<div class="sheet-actions">' +
      (missed.length ? '<button class="btn sm" data-act="qzRetryMissed">' + L('action.retryMissed') + '</button>' : '') +
      '<button class="btn sm pri" data-act="closeQuizOverlay">' + L('action.close') + '</button></div></div></div></div>';
  }

  function renderHistory(sid) {
    const s = sid && sub(S, sid) ? sub(S, sid) : null;
    quizHistorySid = s ? s.id : null; quizOverlay = 'history';
    const list = (S.quizHistory || []).filter(r => !s || r.sid === s.id).slice().reverse();
    const cards = list.map(r => {
      const when = r.at ? fmtShortDate(parseYmd(r.at.slice(0, 10))) : '';
      return '<details class="qz-history-row"><summary>' +
        '<span class="qz-history-main"><strong>' + esc(r.grade) + '</strong>' +
        '<span class="qz-history-meta">' + esc(when) + ' · ' + r.minutes + ' ' + L('unit.minute') + ' · ' + r.correct + '/' + r.total + '</span></span>' +
        '<span class="badge' + (r.pass ? ' good' : '') + '">' + r.percent + '%</span></summary>' +
        '<div class="qz-history-body">' + (missedHTML(r) || '<p class="muted">' + L('quiz.result.perfect') + '</p>') + '</div></details>';
    });
    const first = cards.slice(0, 50).join('');
    const rest = cards.slice(50).join('');
    const rows = cards.length ? first + (rest ? '<details class="show-more"><summary class="btn sm">' + esc(moreLabel(cards.length - 50)) + '</summary>' + rest + '</details>' : '') : '<p class="muted unit-empty">' + L('quiz.history.empty') + '</p>';
    $('#modalRoot').innerHTML = '<div class="overlay" data-act="quizOverlay"><div class="sheet qz-sheet" role="dialog" aria-modal="true" aria-label="' + L('quiz.history.title') + '">' +
      '<div class="sheet-head"><h2>' + L('quiz.history.title') + (s ? ' · ' + esc(s.name) : '') + '</h2>' +
      '<button class="icon-btn" data-act="closeQuizOverlay" aria-label="' + L('action.close') + '">' + ic.x + '</button></div>' +
      '<div class="sheet-body"><p class="muted curr-intro">' + L('quiz.history.sub') + '</p><div class="qz-list">' + rows + '</div></div>' +
      '<div class="sheet-foot"><span></span><div class="sheet-actions">' +
      '<button class="btn sm pri" data-act="closeQuizOverlay">' + L('action.close') + '</button></div></div></div></div>';
  }

  function rerenderQuizOverlay() {
    const kind = quizOverlay;
    if (!kind) return;
    if (kind === 'bank') renderBank(quizBankSid);
    else if (kind === 'history') renderHistory(quizHistorySid);
    else if (kind === 'exam') renderExam();
    else if (kind === 'result') renderResult(lastResult);
  }

  function manualModal(sid) {
    openModal(L('modal.time.title'),
      '<label class="field"><span>' + L('modal.block.subject') + '</span><select name="sid">' + subOpts(sid) + '</select></label>' +
      '<div class="row2"><label class="field"><span>' + L('modal.time.date') + '</span><input type="date" name="date" value="' + todayKey() + '" max="' + todayKey() + '"></label><label class="field"><span>' + L('modal.time.minutes') + '</span><input type="number" name="min" inputmode="numeric" min="1" max="720" value="30"></label></div>',
      { submit: L('modal.time.submit'),
        onSubmit(fd) {
          const mn = Math.round(fnum(fd.get('min')));
          const d = fd.get('date') || todayKey();
          if (isNaN(mn) || mn < 1 || mn > 720) return { error: L('modal.time.range') };
          if (d > todayKey()) return { error: L('modal.time.future') };
          addLog(S, fd.get('sid'), mn * 60, d);
          save(S); renderView(); renderWidget();
        }
      });
  }

  function scaleModal() {
    const scale = S.settings.scale;
    const presetBtns = SCALE_PRESETS.map(p => '<button type="button" class="btn sm ' + (scale.preset === p.id ? 'pri' : '') + '" data-act="preset" data-preset="' + p.id + '">' + p.label + '</button>').join('');
    openModal(L('scale.title'),
      '<div class="field"><span>' + L('scale.presets') + '</span><div class="preset-row">' + presetBtns + '</div></div>' +
      '<div class="row2"><label class="field"><span>' + L('scale.type') + '</span><select name="type" id="scType"><option value="numeric"' + (scale.type==='numeric'?' selected':'') + '>' + L('scale.numeric') + '</option><option value="letter"' + (scale.type==='letter'?' selected':'') + '>' + L('scale.letters') + '</option></select></label>' +
      '<label class="field" id="scPresetWrap"><span>' + L('scale.preset') + '</span><select name="preset" id="scPreset"><option value="custom">' + L('scale.custom') + '</option>' + SCALE_PRESETS.filter(p=>p.type==='numeric').map(p=>'<option value="' + p.id + '"' + (scale.preset===p.id?' selected':'') + '>' + p.label + '</option>').join('') + '</select></label></div>' +
      '<div class="row2" id="scNumeric"><label class="field"><span>' + L('scale.max') + '</span><input id="scMax" name="max" type="number" inputmode="decimal" min="1" step="any" value="' + scale.max + '"></label><label class="field"><span>' + L('scale.pass') + '</span><input id="scPass" name="pass" type="number" inputmode="decimal" min="0" step="any" value="' + scale.pass + '"></label></div>' +
      '<label class="field" id="scLetter"' + (scale.type==='letter'?'':' hidden') + '><span>' + L('scale.pass') + '</span><select name="passLetter" id="scPassLetter">' + ['F','D','C','B','A'].map((l,i)=>'<option value="' + i + '"' + (Math.round(scale.pass)===i?' selected':'') + '>' + l + '</option>').join('') + '</select></label>' +
      '<p class="muted" style="font-size:13px;margin:0">' + L('scale.note') + '</p>',
      { submit: L('scale.submit'),
        onSubmit(fd) {
          const type = fd.get('type') === 'letter' ? 'letter' : 'numeric';
          let next;
          if (type === 'letter') {
            next = normalizeScale({ type: 'letter', pass: clamp(Number(fd.get('passLetter')) || 2, 0, 4) });
          } else {
            const mx = fnum(fd.get('max')), ps = fnum(fd.get('pass'));
            if (isNaN(mx) || mx < 1) return { error: L('scale.validation.max') };
            if (isNaN(ps) || ps < 0 || ps > mx) return { error: L('scale.validation.pass') };
            next = normalizeScale({ type: 'numeric', max: mx, pass: ps });
          }
          S.settings.scale = next;
          save(S); renderView();
        }
      });
    bindScaleModal();
  }

  function bindScaleModal() {
    const typeSel = $('#scType'), maxIn = $('#scMax'), passIn = $('#scPass'), passLetter = $('#scPassLetter');
    const numeric = $('#scNumeric'), letter = $('#scLetter');
    function sync() {
      const isLetter = typeSel.value === 'letter';
      numeric.hidden = isLetter; letter.hidden = !isLetter;
    }
    if (typeSel) { typeSel.addEventListener('change', sync); sync(); }
    $('#mForm').addEventListener('click', (e) => {
      const p = e.target.closest('[data-act="preset"]');
      if (!p) return;
      const preset = SCALE_PRESETS.find(x => x.id === p.dataset.preset);
      if (!preset) return;
      typeSel.value = preset.type;
      if (preset.type === 'letter') { passLetter.value = String(preset.pass); }
      else { maxIn.value = preset.max; passIn.value = preset.pass; }
      sync();
      $$('#mForm [data-act="preset"]').forEach(b => b.classList.toggle('pri', b === p));
    });
  }
  function viewConfiguracion() {
    const p = S.settings.pomo || {};
    const daily = S.settings.dailyGoalMin || 0;
    return '<div class="settings-grid">' +
      '<section class="settings-card">' +
        '<span class="eyebrow">01 / ' + L('settings.goalEyebrow') + '</span>' +
        '<h3>' + L('settings.goalTitle') + '</h3>' +
        '<p class="settings-desc">' + L('settings.goalDesc') + '</p>' +
        '<form id="cfgGoal">' +
          hoursMinutesInput(daily, 'dgH', 'dgM') +
          '<p class="settings-hint">' + L('settings.dailyHint') + '</p>' +
          '<p class="duration-preview" id="dgPrev" aria-live="polite"></p>' +
          '<div class="row2">' +
            '<label class="field"><span>' + L('settings.pomoWork') + '</span><input id="pw" type="number" min="1" max="180" step="1" value="' + (p.work || 25) + '"></label>' +
            '<label class="field"><span>' + L('settings.pomoShort') + '</span><input id="ps" type="number" min="1" max="60" step="1" value="' + (p.short || 5) + '"></label>' +
          '</div>' +
          '<div class="row2">' +
            '<label class="field"><span>' + L('settings.pomoLong') + '</span><input id="pl" type="number" min="1" max="120" step="1" value="' + (p.long || 15) + '"></label>' +
            '<label class="field"><span>' + L('settings.pomoEvery') + '</span><input id="pe" type="number" min="2" max="12" step="1" value="' + (p.every || 4) + '"></label>' +
          '</div>' +
          '<button class="btn pri" type="submit">' + L('action.save') + '</button>' +
        '</form>' +
      '</section>' +
      '<section class="settings-card">' +
        '<span class="eyebrow">02 / ' + L('settings.backupEyebrow') + '</span>' +
        '<h3>' + L('settings.backupTitle') + '</h3>' +
        '<p class="settings-desc">' + L('settings.backupDesc') + '</p>' +
        '<div class="settings-actions"><button class="btn sm" data-act="exportJSON">' + L('backup.json') + '</button><button class="btn sm" data-act="exportCSV">' + L('backup.csv') + '</button></div>' +
        '<button class="btn sm pri" data-act="importBackup">' + L('settings.importJSON') + '</button>' +
        '<p class="settings-hint">' + L('settings.offline') + '</p>' +
      '</section>' +
      '<section class="settings-card danger-card">' +
        '<span class="eyebrow">03 / ' + L('settings.resetEyebrow') + '</span>' +
        '<h3>' + L('settings.resetTitle') + '</h3>' +
        '<p class="settings-desc">' + L('settings.resetDesc') + '</p>' +
        '<p class="settings-hint">' + L('settings.resetHint') + '</p>' +
        '<button class="btn danger" data-act="resetAll">' + L('backup.resetAll') + '</button>' +
      '</section>' +
    '</div>';
  }

  function bindConfig() {
    const h = $('#dgH'), m = $('#dgM'), prev = $('#dgPrev');
    const upd = () => {
      if (!prev || !h || !m) return;
      const mins = readHoursMinutes('dgH', 'dgM');
      prev.textContent = mins ? L('settings.dailyPreview', { d: fmtMin(mins) }) : L('settings.dailyAuto');
      prev.classList.remove('invalid');
    };
    if (h) h.addEventListener('input', upd);
    if (m) m.addEventListener('input', upd);
    upd();
    const form = $('#cfgGoal');
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      S.settings.dailyGoalMin = readHoursMinutes('dgH', 'dgM');
      const g = S.settings.pomo;
      g.work = clamp(Math.round(fnum($('#pw').value)) || 25, 1, 180);
      g.short = clamp(Math.round(fnum($('#ps').value)) || 5, 1, 60);
      g.long = clamp(Math.round(fnum($('#pl').value)) || 15, 1, 120);
      g.every = clamp(Math.round(fnum($('#pe').value)) || 4, 2, 12);
      afterChange();
      toast(L('settings.saved'));
    });
  }

  function importModal() {
    openModal(L('settings.importJSON'),
      '<label class="field"><span>' + L('backup.restoreArea') + '</span><textarea id="imIn" name="paste" placeholder="' + L('backup.restorePh') + '"></textarea></label>' +
      '<label class="field"><span>' + L('settings.importFile') + '</span><input id="imFile" type="file" accept=".json,application/json"></label>',
      { submit: L('backup.submit'),
        onSubmit(fd, form) {
          const txt = String(fd.get('paste') || '').trim();
          if (!txt) return { error: L('backup.empty') };
          let o;
          try { o = JSON.parse(txt); } catch (e) { return { error: L('backup.invalid') }; }
          /* Respaldo temporal en memoria: si la validacion falla, no se toca nada. */
          const safety = S ? JSON.stringify(S) : null;
          let check;
          try { check = SFS.validateBackup ? SFS.validateBackup(o) : { ok: true, data: o }; }
          catch (e) { return { error: e && e.message ? e.message : L('backup.format') }; }
          if (!check.ok) return { error: check.msgText || L('backup.format') };
          try {
            resetTimer();
            S = SFS.migrate(check.data);
            S.timer.status = 'idle'; S.timer.startedAt = null; S.timer.acc = 0; S.timer.logged = 0;
            closeTimerPanel();
            afterChange();
            toast(L('settings.importDone'));
          } catch (e) {
            if (safety) { S = JSON.parse(safety); save(S); renderAll(); }
            return { error: 'No se pudo importar el respaldo; tus datos siguen intactos.' };
          }
        }
      });
    const file = $('#imFile');
    if (file) file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => { const ta = $('#imIn'); if (ta) { ta.value = String(r.result || ''); ta.dispatchEvent(new Event('input', { bubbles: true })); } };
      r.readAsText(f);
    });
  }

  /* ---- Importador de planes de estudio por país y carrera ---- */

  function countryOptions(selected) {
    if (!SFC) return '';
    return SFC.countries().map(c =>
      '<option value="' + c.code + '"' + (c.code === selected ? ' selected' : '') + '>' + c.flag + ' ' + esc(c.name) + '</option>'
    ).join('');
  }

  function careerOptions(code, selected) {
    if (!SFC) return '';
    return SFC.careers(code).map(c =>
      '<option value="' + c.id + '"' + (c.id === selected ? ' selected' : '') + '>' + esc(c.label) + ' — ' + esc(c.title) + '</option>'
    ).join('');
  }

  function institutionText(x) {
    if (!x) return '';
    if (x.id === 'other') return x.name;
    return [x.sigla, x.name].filter(Boolean).join(' · ');
  }

  function institutionOptions(code, careerId, selected) {
    if (!SFC) return '';
    const groups = [
      ['pub', 'curriculum.institution.groupPublic'],
      ['priv', 'curriculum.institution.groupPrivate'],
      ['onl', 'curriculum.institution.groupOnline'],
      ['other', 'curriculum.institution.groupOther']
    ];
    const list = SFC.institutions(code, careerId);
    let html = '<option value="">' + L('curriculum.institution.select') + '</option>';
    groups.forEach(g => {
      const rows = list.filter(x => x.kind === g[0]);
      if (!rows.length) return;
      html += '<optgroup label="' + esc(L(g[1])) + '">' + rows.map(x => {
        const title = x.sede ? institutionText(x) + ' — ' + x.sede : institutionText(x);
        return '<option value="' + x.id + '"' + (x.id === selected ? ' selected' : '') + '>' + esc(title) + '</option>';
      }).join('') + '</optgroup>';
    });
    return html;
  }

  function periodOptions(code, careerId, institutionId, selected) {
    if (!SFC) return '';
    const all = '<option value="all"' + (selected === 'all' ? ' selected' : '') + '>' + L('curriculum.period.all') + '</option>';
    return all + SFC.periods(code, careerId).map(p =>
      '<option value="' + p.id + '"' + (p.id === selected ? ' selected' : '') + '>' + esc(p.label) + '</option>'
    ).join('');
  }

  function detectSourceText(d) {
    if (!d) return L('curriculum.detectedDefault');
    if (d.source === 'ip') return L('curriculum.detectedIp');
    if (d.source === 'manual') return L('curriculum.detectedManual');
    if (d.source === 'locale-offline') return L('curriculum.detectedOffline');
    return L('curriculum.detectedLocale');
  }

  function planItems(code, careerId, periodId, institutionId) {
    if (!SFC) return [];
    if (periodId === 'all') return SFC.allSubjects(code, careerId);
    const p = SFC.periods(code, careerId).filter(x => x.id === periodId)[0];
    if (!p) return [];
    return p.subjects.map(x => Object.assign({}, x, { period: p.label, periodId: p.id }));
  }

  function currentPeriodLabel(code, careerId, periodId, institutionId) {
    if (!SFC) return '';
    if (periodId === 'all') return L('curriculum.period.all');
    const p = SFC.periods(code, careerId).filter(x => x.id === periodId)[0];
    return p ? p.label : '';
  }

  function activeProgramLabel(code, careerId, periodId, inst) {
    return [
      SFC.career(code, careerId).label,
      inst.id === 'other' ? inst.name : (inst.sigla || inst.name),
      currentPeriodLabel(code, careerId, periodId, inst.id)
    ].filter(Boolean).join(' · ');
  }

  function renderCurriculumPreview() {
    const box = $('#currPreview');
    if (!box || !SFC) return;
    const code = $('#currCountry').value;
    const careerId = $('#currCareer').value;
    const institutionId = $('#currInstitution').value;
    const periodId = $('#currPeriod').value;
    const info = SFC.career(code, careerId);
    const inst = institutionId ? SFC.institution(code, careerId, institutionId) : null;
    const items = planItems(code, careerId, periodId, institutionId);
    const units = items.reduce((a, x) => a + x.units.length, 0);
    const rows = items.map(x =>
      '<div class="preview-subject"><span class="dot" style="background:' + x.color + '"></span>' +
      '<div class="preview-subject-copy"><strong>' + esc(x.name) + '</strong>' +
      '<span class="muted">' + esc(x.period || '') + ' · ' + L('curriculum.hours', { n: x.hours }) + '</span>' +
      '<div class="preview-units">' + x.units.map(u => '<span>' + esc(u) + '</span>').join('') + '</div></div></div>'
    ).join('');
    const instLine = inst ? institutionText(inst) + (inst.sede ? ' — ' + inst.sede : '') : L('curriculum.institution.select');
    box.innerHTML = '<div class="curr-program-line">' + esc(info.title) + '<span class="muted"> · ' + esc(instLine) + '</span></div>' +
      '<div class="preview-head"><span class="eyebrow">' + L('curriculum.preview') + '</span>' +
      '<span class="badge">' + L('curriculum.preview.subjects', { n: items.length, u: units }) + '</span></div>' +
      (rows ? '<div class="preview-list">' + rows + '</div>' : '<p class="muted">' + L('curriculum.noSubjects') + '</p>');
  }

  function fillInstitutionSteps(code, careerId, preferred) {
    if (!SFC) return null;
    const list = SFC.institutions(code, careerId);
    const chosen = list.some(x => x.id === preferred) ? preferred : '';
    const sel = $('#currInstitution');
    if (sel) {
      sel.innerHTML = institutionOptions(code, careerId, chosen);
      sel.value = chosen;
    }
    return chosen ? SFC.institution(code, careerId, chosen) : null;
  }

  function fillPeriodSteps(code, careerId, institutionId, preferred) {
    if (!SFC) return;
    const sel = $('#currPeriod');
    if (!sel) return;
    const list = SFC.periods(code, careerId);
    const chosen = preferred && list.some(x => x.id === preferred) ? preferred : 'all';
    sel.innerHTML = periodOptions(code, careerId, institutionId, chosen);
    sel.value = chosen;
  }

  function fillCareerSteps(code, preferredCareer, preferredInstitution) {
    if (!SFC) return;
    const list = SFC.careers(code);
    const chosen = list.some(x => x.id === preferredCareer) ? preferredCareer : list[0].id;
    const careerSel = $('#currCareer');
    if (careerSel) {
      careerSel.innerHTML = careerOptions(code, chosen);
      careerSel.value = chosen;
    }
    fillInstitutionSteps(code, chosen, preferredInstitution);
    fillPeriodSteps(code, chosen, $('#currInstitution') ? $('#currInstitution').value : '', 'all');
    renderCurriculumPreview();
  }

  function bindCurriculumModal() {
    const countrySel = $('#currCountry'), careerSel = $('#currCareer');
    const instSel = $('#currInstitution'), periodSel = $('#currPeriod');
    if (countrySel) countrySel.addEventListener('change', () => {
      bindCurriculumModal.manual = true;
      if (SFC) SFC.setCountry(countrySel.value);
      fillCareerSteps(countrySel.value, careerSel.value, null);
      const note = $('#currDetect');
      if (note) note.textContent = detectSourceText(SFC ? SFC.cachedCountry() : null);
    });
    if (careerSel) careerSel.addEventListener('change', () => {
      fillInstitutionSteps(countrySel.value, careerSel.value, null);
      fillPeriodSteps(countrySel.value, careerSel.value, instSel.value, 'all');
      renderCurriculumPreview();
    });
    if (instSel) instSel.addEventListener('change', () => {
      fillPeriodSteps(countrySel.value, careerSel.value, instSel.value, periodSel.value);
      renderCurriculumPreview();
    });
    if (periodSel) periodSel.addEventListener('change', renderCurriculumPreview);
  }

  function preferredInstitutionFor(code, careerId) {
    const ap = S.activeProgram;
    return ap && ap.country === code && ap.careerId === careerId ? (ap.institutionId || '') : '';
  }

  function curriculumModal() {
    if (!SFC) { toast(L('curriculum.error')); return; }
    bindCurriculumModal.manual = false;
    const cached = SFC.cachedCountry();
    const initial = cached ? cached.code : SFC.localeCode(navigator.language || navigator.userLanguage || '');
    openModal(L('curriculum.title'),
      '<p class="muted curr-intro">' + L('curriculum.desc') + '</p>' +
      '<div class="curr-steps">' +
        '<label class="field curr-step"><span><i class="curr-step-n">1</i>' + L('curriculum.step1') + '</span><select name="country" id="currCountry">' + countryOptions(initial) + '</select></label>' +
        '<label class="field curr-step"><span><i class="curr-step-n">2</i>' + L('curriculum.step2') + '</span><select name="career" id="currCareer"></select></label>' +
        '<label class="field curr-step"><span><i class="curr-step-n">3</i>' + L('curriculum.step3') + '</span><select name="institution" id="currInstitution"></select></label>' +
        '<label class="field curr-step"><span><i class="curr-step-n">4</i>' + L('curriculum.step4') + '</span><select name="period" id="currPeriod"></select></label>' +
      '</div>' +
      '<p class="curr-detect" id="currDetect">' + detectSourceText(cached) + '</p>' +
      '<div class="curr-preview" id="currPreview"></div>' +
      '<p class="curr-offline">' + ic.check + '<span>' + L('curriculum.offlineReady') + '</span></p>',
      { submit: L('curriculum.import'),
        onSubmit(fd) {
          const code = String(fd.get('country') || 'INTL');
          const careerId = String(fd.get('career') || 'systems');
          const institutionId = String(fd.get('institution') || '');
          const periodId = String(fd.get('period') || 'all');
          if (!institutionId) return { error: L('curriculum.institution.required') };
          const items = planItems(code, careerId, periodId, institutionId);
          if (!items.length) return { error: L('curriculum.noSubjects') };
          const info = SFC.career(code, careerId);
          const inst = SFC.institution(code, careerId, institutionId);
          const label = activeProgramLabel(code, careerId, periodId, inst);
          if (S.activeProgram && (
            S.activeProgram.country !== code ||
            S.activeProgram.careerId !== careerId ||
            (S.activeProgram.institutionId || '') !== institutionId ||
            S.activeProgram.period !== periodId
          )) {
            if (!window.confirm(L('curriculum.replaceConfirm'))) return { cancelled: true };
          }
          const subjectIds = [];
          let newUnits = 0;
          items.forEach(item => {
            let subject = S.subjects.find(x => x.name.toLowerCase() === item.name.toLowerCase());
            if (!subject) {
              subject = { id: uid(), name: item.name, color: item.color, goal: item.hours, goalMin: Math.round(item.hours * 60), progress: 0 };
              S.subjects.push(subject);
            } else {
              /* Al importar un plan, esa materia deja de ser texto de ejemplo. */
              delete subject.demoKey;
              subject.color = item.color;
              setGoalMin(subject, Math.round(item.hours * 60));
            }
            subjectIds.push(subject.id);
            item.units.forEach(name => {
              const exists = S.units.some(u => u.sid === subject.id && u.name.toLowerCase() === name.toLowerCase());
              if (!exists) { S.units.push({ id: uid(), sid: subject.id, name, hours: item.hours, done: false }); newUnits++; }
            });
          });
          S.activeProgram = {
            country: code, careerId, careerLabel: info.label,
            institution: inst.name, institutionId: inst.id, institutionSigla: inst.sigla,
            sede: inst.sede, title: info.title,
            period: periodId, periodLabel: currentPeriodLabel(code, careerId, periodId, institutionId),
            label: label, importedAt: new Date().toISOString(), subjectIds
          };
          S.sample = false;
          afterChange();
          toast(L('curriculum.imported', { n: items.length, u: newUnits }) + ' · ' + label);
        }
      });
    $('#currCountry').value = initial;
    const apInitial = S.activeProgram;
    const preferredCareer = apInitial && apInitial.country === initial ? apInitial.careerId : null;
    fillCareerSteps(initial, preferredCareer, preferredInstitutionFor(initial, preferredCareer));
    bindCurriculumModal();
    const note = $('#currDetect');
    if (!cached) {
      note.textContent = L('curriculum.country.detect');
      SFC.detectCountry().then(d => {
        if (!note.isConnected || bindCurriculumModal.manual) return;
        $('#currCountry').value = d.code;
        note.textContent = detectSourceText(d) + (d.code === 'INTL' ? '' : ' · ' + SFC.country(d.code).name);
        fillCareerSteps(d.code, $('#currCareer').value, preferredInstitutionFor(d.code, $('#currCareer').value));
      }).catch(() => {
        if (note.isConnected) note.textContent = detectSourceText(SFC.cachedCountry());
      });
    } else {
      note.textContent = detectSourceText(cached) + (cached.code === 'INTL' ? '' : ' · ' + SFC.country(cached.code).name);
    }
  }

  /* ---- Tareas / unidades editables por materia ---- */

  function collectUnitNames() {
    if (!unitDraft) return;
    $$('#unitList [data-unit-name]').forEach(input => {
      const i = +input.dataset.unitName;
      if (unitDraft[i]) unitDraft[i].name = input.value.trim();
    });
  }

  function renderUnitRows() {
    const box = $('#unitList');
    if (!box || !unitDraft) return;
    box.innerHTML = unitDraft.map((u, i) =>
      '<div class="unit-row">' +
        '<label class="unit-check"><input type="checkbox" data-unit-done="' + i + '"' + (u.done ? ' checked' : '') + ' aria-label="' + L('curriculum.units.done') + '"></label>' +
        '<input class="unit-name" data-unit-name="' + i + '" maxlength="120" value="' + esc(u.name) + '">' +
        '<button type="button" class="icon-btn" data-act="unitRemove" data-index="' + i + '" aria-label="' + L('curriculum.units.remove') + '">' + ic.trash + '</button>' +
      '</div>'
    ).join('') || '<p class="muted unit-empty">' + L('curriculum.units.none') + '</p>';
  }

  function unitsModal(sid) {
    const s = sub(S, sid);
    if (!s) return;
    unitSubjectId = sid;
    unitDraft = unitsBy(S, sid).map(u => Object.assign({}, u));
    openModal(L('curriculum.units') + ' · ' + s.name,
      '<p class="muted curr-intro">' + L('curriculum.units.desc') + '</p>' +
      '<div class="unit-list" id="unitList"></div>' +
      '<div class="unit-add"><input id="unitNew" name="newUnit" maxlength="120" placeholder="' + L('curriculum.units.addPh') + '" data-i18n-ph="curriculum.units.addPh">' +
      '<button type="button" class="btn sm" data-act="unitAdd">' + ic.plus + '<span>' + L('curriculum.units.add') + '</span></button></div>',
      { submit: L('action.save'),
        onSubmit(fd) {
          collectUnitNames();
          if (unitDraft.some(u => !u.name)) return { error: L('curriculum.units.required') };
          const fresh = String(fd.get('newUnit') || '').trim();
          if (fresh) unitDraft.push({ id: uid(), sid, name: fresh.slice(0, 120), hours: goalMinOf(s) / 60, done: false });
          const original = new Map(S.units.filter(u => u.sid === sid).map(u => [u.id, u]));
          S.units = S.units.filter(u => u.sid !== sid).concat(unitDraft.map(u => {
            const next = Object.assign({}, u, { sid });
            const old = original.get(u.id);
            /* Una tarea renombrada pasa a ser contenido del usuario. */
            if (old && old.demoKey && u.name !== old.name) delete next.demoKey;
            return next;
          }));
          syncProgress(S, sid);
          unitDraft = null; unitSubjectId = null;
          afterChange();
        }
      });
    renderUnitRows();
    $('#mForm').addEventListener('change', (e) => {
      if (e.target.matches('[data-unit-done]') && unitDraft) {
        const u = unitDraft[+e.target.dataset.unitDone];
        if (u) u.done = e.target.checked;
      }
    });
  }

  const TABS = ['estudio', 'agenda', 'notas', 'flashcards', 'configuracion'];

  // Actions
  function setTab(t) {
    S.ui.tab = t; save(S);
    try { if (location.hash !== '#' + t) location.hash = t; } catch (e) {}
    renderTabs(); renderView(); bindConfig(); window.scrollTo({ top: 0, behavior: 'auto' });
  }

  const A = {
    tab(el) { setTab(el.dataset.tab); },
    curriculum() { curriculumModal(); },
    units(el) { unitsModal(el.dataset.id); },
    unitAdd() {
      if (!unitDraft) return;
      collectUnitNames();
      const input = $('#unitNew');
      const name = input ? String(input.value || '').trim() : '';
      if (!name) return;
      unitDraft.push({ id: uid(), sid: unitSubjectId, name: name.slice(0, 120), hours: 0, done: false });
      input.value = '';
      renderUnitRows();
    },
    unitRemove(el) {
      if (!unitDraft) return;
      collectUnitNames();
      unitDraft.splice(+el.dataset.index, 1);
      renderUnitRows();
    },
    newSubject() { subjectModal(); },
    editSubject(el) { subjectModal(el.dataset.id); },
    studySubject(el) {
      unlockAudio();
      const t = T();
      if (t.sid !== el.dataset.id) { commit(); t.sid = el.dataset.id; }
      /* El panel se abre expandido y anclado dentro del viewport (también en iOS). */
      S.ui.timerOpen = true; S.ui.min = false; S.ui.pos = null;
      if (t.status !== 'running') startT();
      else { save(S); renderWidget(); revealTimer(); }
    },
    manualTime(el) { manualModal(el.dataset.id); },
    newBlock(el) { blockModal(null, el.dataset.day != null ? +el.dataset.day : null); },
    editBlock(el) { blockModal(el.dataset.id); },
    newExam() { examModal(); },
    editExam(el) { examModal(el.dataset.id); },
    newGrade(el) { if (needSubject()) gradeModal(null, el.dataset.sid); },
    editGrade(el) { gradeModal(el.dataset.id); },
    newCard() { if (needSubject()) cardModal(); },
    editCard(el) { cardModal(el.dataset.id); },
    questionBank(el) { renderBank(el.dataset.id); },
    newQuestion(el) { questionModal(null, el.dataset.id); },
    generateFromCards(el) { importFromCards(el.dataset.id || quizBankSid); },
    editQuestion(el) { questionModal(el.dataset.id); },
    deleteQuestion(el) {
      const q = quizById(el.dataset.id);
      const owner = q ? q.sid : quizBankSid;
      S.questions = (S.questions || []).filter(x => x.id !== el.dataset.id);
      save(S); renderView(); renderBank(owner);
      toast(L('quiz.bank.deleted'));
    },
    mockExam(el) { setupModal(el.dataset.id || null); },
    examHistory(el) { renderHistory(el.dataset.id || null); },
    closeQuizOverlay() { closeQuizOverlay(); },
    quizOverlay(el, e) { if (e.target === el) closeQuizOverlay(); },
    qzPrev() { if (!exam || !exam.index) return; readExamChoice(); exam.index--; renderExam(); },
    qzNext() { if (!exam || exam.index + 1 >= exam.total) return; readExamChoice(); exam.index++; renderExam(); },
    qzFinish() { if (exam) finishExam(false); },
    qzRetryMissed() {
      if (!lastResult) return;
      const ids = lastResult.answers.filter(a => !a.ok).map(a => a.qid);
      const pool = ids.map(quizById).filter(Boolean);
      if (pool.length) startExam(lastResult.sid, lastResult.unitId, lastResult.minutes, pool, pool.length);
    },
    cardFilter(el) { S.ui.cardSid = el.dataset.sid || null; save(S); renderView(); },
    reviewCards(el) {
      const ids = dueCards(S, el.dataset.sid || null).map(c => c.id);
      if (!ids.length) { toast(L('fc.noDue')); return; }
      startCards(ids);
    },
    reviewOne(el) { startCards([el.dataset.id]); },
    flipCard() { cardFlipped = !cardFlipped; renderView(); },
    gradeCard(el) {
      const c = S.flashcards.find(x => x.id === cardQueue[cardIndex]);
      if (!c) return;
      scheduleCard(c, el.dataset.grade);
      cardGrades.push(el.dataset.grade);
      cardIndex++; cardFlipped = false;
      save(S); renderView();
    },
    exitCards() { resetCardSession(); renderView(); },
    recoverBlock(el) {
      const b = S.blocks.find(x => x.id === el.dataset.id);
      if (!b) return;
      const keys = missedStudyBlocks().filter(x => x.b.id === b.id).map(x => x.key);
      const slot = suggestSlot(b);
      if (!slot) { toast(L('recovery.noSlot')); return; }
      b.day = slot.day; b.start = slot.start; b.end = slot.end;
      const seen = Array.isArray(S.ui.recoverSeen) ? S.ui.recoverSeen : (S.ui.recoverSeen = []);
      keys.forEach(k => { if (seen.indexOf(k) < 0) seen.push(k); });
      S.ui.selDay = slot.day;
      afterChange();
      toast(L('recovery.done', { day: D.long()[slot.day], time: slot.start }));
    },
    dismissRecovery(el) {
      const seen = Array.isArray(S.ui.recoverSeen) ? S.ui.recoverSeen : (S.ui.recoverSeen = []);
      if (seen.indexOf(el.dataset.key) < 0) seen.push(el.dataset.key);
      save(S); renderAll();
    },
    scale() { scaleModal(); },
    importBackup() { importModal(); },
    exportJSON() { downloadFile(L('backup.file.json'), exportJSON(S), 'application/json'); },
    exportCSV() { downloadFile(L('backup.file.csv'), exportCSV(S), 'text/csv;charset=utf-8'); },
    selDay(el) { S.ui.selDay = +el.dataset.day; save(S); renderView(); },
    keepSample() { S.sample = false; save(S); renderNotice(); },
    clearSample() {
      resetTimer(); const ui = S.ui, settings = S.settings;
      S = defaults(); S.ui = ui; S.settings = settings; S.timer.status = 'idle';
      S.ui.cardSid = null; S.ui.recoverSeen = []; resetCardSession();
      closeQuizOverlay(); quizBankSid = null; quizHistorySid = null;
      closeTimerPanel(); afterChange();
    },
    resetAll() {
      if (!window.confirm(L('backup.resetAllConfirm'))) return;
      closeModal();
      wake(false);
      S = defaults();
      S.ui.timerOpen = false; S.ui.min = false; S.ui.pos = null;
      try { localStorage.removeItem(SFS.LEGACY_KEY); } catch (e) {}
      closedG.clear(); unitDraft = null; resetCardSession();
      closeQuizOverlay(); quizBankSid = null; quizHistorySid = null;
      save(S); renderAll();
      toast(L('backup.resetAllDone'));
    },
    twMin() { S.ui.min = !S.ui.min; S.ui.pos = null; save(S); renderWidget(); revealTimer(); },
    twCfg() { S.ui.cfg = !S.ui.cfg; save(S); renderWidget(); },
    twMode(el) { setMode(el.dataset.mode); },
    twToggle() { toggleT(); },
    twSkip() { skipT(); },
    twReset() { resetT(); },
    twEnd() { endT(); },
    twDiscard() { discardT(); },
    closeModal() { closeModal(); },
    overlay(el, e) { if (e.target === el) closeModal(); },
    modalDel() { const fn = modal && modal.onDelete; closeModal(); if (fn) fn(); }
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'overlay' && e.target !== el) return;
    if (el.dataset.confirm && el.dataset.armed !== '1') {
      el.dataset.armed = '1'; el.dataset.orig = el.textContent; el.textContent = el.dataset.confirm;
      setTimeout(() => { if (el.isConnected) { el.dataset.armed = ''; el.textContent = el.dataset.orig; } }, 3200);
      return;
    }
    if (A[act]) A[act](el, e);
  });

  document.addEventListener('input', (e) => {
    if (e.target.matches('.range')) {
      sliding = true;
      const s = sub(S, e.target.dataset.id);
      if (s) { s.progress = clamp(+e.target.value, 0, 100); const o = document.getElementById('pv-' + s.id); if (o) o.innerHTML = '<strong>' + s.progress + '%</strong>'; }
    }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('.range')) { sliding = false; save(S); renderView(); }
    else if (t.id === 'tSub') setSubject(t.value);
    else if (t.matches('[data-pomo]')) {
      const k = t.dataset.pomo; const v = clamp(Math.round(fnum(t.value)) || 1, 1, 180);
      S.settings.pomo[k] = v; t.value = v; save(S); updateWidgetTime();
    }
    else if (t.name === 'qzAns' && exam) {
      readExamChoice();
      $$('#modalRoot .qz-option').forEach(label => label.classList.toggle('picked', label.contains(t)));
    }
  });
  document.addEventListener('toggle', (e) => {
    const d = e.target;
    if (d.matches && d.matches('details.grade-subject')) { if (d.open) closedG.delete(d.dataset.gid); else closedG.add(d.dataset.gid); }
  }, true);
  window.addEventListener('hashchange', () => {
    const h = (location.hash || '').replace('#', '');
    if (TABS.indexOf(h) >= 0 && h !== S.ui.tab) { S.ui.tab = h; save(S); renderTabs(); renderView(); bindConfig(); }
  });
  window.addEventListener('pagehide', () => { if (S) { if (T().status === 'running') { T().seen = Date.now(); commit(); } save(S); } });
  // Language switching and offline updates
  I.onChange(() => {
    if (!S) return;
    if (SFS.localizeSample && SFS.localizeSample(S)) save(S);
    resetAutoQuizzes();
    renderAll();
    rerenderQuizOverlay();
  });

  const SW_VERSION = 'studyflow-v1.3.2';
  let reloading = false;

  /* Pregunta al worker activo su versión. Un worker anterior no entiende el
     mensaje, por lo que no responde y se descarta como obsoleto. */
  function swVersion(controller) {
    return new Promise((resolve) => {
      if (!controller) { resolve(null); return; }
      let done = false;
      const finish = (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
      const timer = setTimeout(() => finish(null), 900);
      try {
        const ch = new MessageChannel();
        ch.port1.onmessage = (e) => finish(e.data && e.data.version ? e.data.version : null);
        controller.postMessage({ type: 'VERSION' }, [ch.port2]);
      } catch (e) { finish(null); }
    });
  }

  async function refreshServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const regs = await navigator.serviceWorker.getRegistrations();

      /* Preguntar a CADA worker activo (no sólo al controlador): un worker
         anterior puede estar registrado y sirviendo caché sin controlar
         todavía esta pestaña. Si no entiende VERSION o responde otra
         versión, se desregistra y se recarga una sola vez. */
      let stale = false;
      for (const reg of regs) {
        if (!reg.active) continue;
        const version = await swVersion(reg.active);
        if (version !== SW_VERSION) { stale = true; break; }
      }
      if (stale && !reloading) {
        reloading = true;
        await Promise.all(regs.map(r => r.unregister().catch(() => {})));
        window.location.reload();
        return;
      }

      const valid = /\/(?:sw\.js)(?:\?|$)/;
      await Promise.all(regs.filter(r => {
        const url = (r.active && r.active.scriptURL) || (r.waiting && r.waiting.scriptURL) || (r.installing && r.installing.scriptURL) || '';
        return url && !valid.test(url);
      }).map(r => r.unregister().catch(() => {})));

      const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      await reg.update().catch(() => {});
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
      if (reg.installing) reg.installing.postMessage('SKIP_WAITING');
    } catch (e) {
      console.warn('[StudyFlow] No se pudo actualizar el service worker:', e);
    }
  }

  navigator.serviceWorker && navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  window.addEventListener('load', refreshServiceWorker);

  // Init
  function init() {
    try {
      if (!I || !SFS) throw new Error('Faltan módulos StudyI18n o SFStore: revisá las rutas de js/i18n.js y js/storage.js.');
      I.init();
      S = load();
      /* No se persiste el demo hasta confirmar que IndexedDB no tiene datos
         reales: hacerlo ahora taparia la migracion asincrona. */
      const freshBoot = !S;
      if (!S) S = sampleState();
      /* Estado guardado en otro idioma: lo sincroniza con el selector actual. */
      if (!freshBoot && SFS.localizeSample && SFS.localizeSample(S)) save(S);
      ensureTimerSubject();
      const t = T();
      if (t.status !== 'idle') {
        S.ui.timerOpen = true;
        /* En móvil un temporizador activo se muestra siempre expandido y anclado. */
        if (isCompact()) { S.ui.min = false; S.ui.pos = null; }
      }
      if (t.status === 'running') {
        const seen = t.seen || t.startedAt;
        if (seen && Date.now() - seen > 3 * 3600 * 1000) { t.acc += Math.max(0, seen - t.startedAt); t.startedAt = null; t.status = 'paused'; }
      }
      const h = (location.hash || '').replace('#', '');
      if (TABS.indexOf(h) >= 0) S.ui.tab = h;
      initDrag();
      renderAll();
      revealTimer();
      /* La migracion a IndexedDB es asincrona: solo se refleja si cambio
         el estado persistido, sin pisar lo que el usuario ya ve en pantalla. */
      if (SFS.whenReady) SFS.whenReady().then(function () {
        const fresh = load();
        if (!fresh) {
          if (freshBoot) {
            if (SFS.localizeSample && SFS.localizeSample(S)) save(S);
            else save(S);
          }
          return;
        }
        if (JSON.stringify(fresh) === JSON.stringify(S)) return;
        S = fresh;
        renderAll();
      }).then(function () {
        /* Los stores dedicados ('questions' y 'quizHistory') son un respaldo
           del banco y del historial por si el sobre 'state' quedó desfasado. */
        if (!SFS.listQuizData) return;
        return SFS.listQuizData().then(function (d) {
          if (!d) return;
          let changed = false;
          if ((!S.questions || !S.questions.length) && d.questions && d.questions.length) {
            S.questions = d.questions; changed = true;
          }
          if ((!S.quizHistory || !S.quizHistory.length) && d.quizHistory && d.quizHistory.length) {
            S.quizHistory = d.quizHistory; changed = true;
          }
          if (changed) { save(S); renderAll(); }
        });
      }).catch(function () {});
      if (T().status === 'running') wake(true);
      setInterval(tick, 1000);
    } catch (e) {
      console.error('[StudyFlow] Error al inicializar la interfaz:', e);
      const view = document.getElementById('view');
      if (view) view.innerHTML = '<div class="empty"><p>' + esc(e && e.message ? e.message : String(e)) + '</p></div>';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
