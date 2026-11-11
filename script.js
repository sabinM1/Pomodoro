(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const fmt = (n) => String(Math.round(n * 100) / 100); // 1.5 → "1.5", not "1.500"

  const DEFAULTS = { study: 25, short: 5, long: 15, sound: 'harp', bg: 'night', cat: 'default' };
  // lower bound is 1 second (1/60 min) so "0:02" gives a two-second timer; cfg stays in minutes
  const LIMITS = { study: [1 / 60, 180], short: [1 / 60, 60], long: [1 / 60, 120] };
  const LABEL = { study: 'Focus', short: 'Short break', long: 'Long break' };
  const CAT_COLORS = ['default', 'black', 'white', 'transparent'];
  const LIMIT_KEYS = Object.keys(LIMITS);

  // dark flags measured from the centre of each image (where the clock sits);
  // only a fallback for browsers that block canvas reads (e.g. file://)
  const BACKGROUNDS = [
    { name: 'starry', dark: true },
    { name: 'earth',  dark: false },
    { name: 'peaks',  dark: true },
    { name: 'forest', dark: true },
    { name: 'shore',  dark: true },
    { name: 'field',  dark: false },
    { name: 'night',  dark: true },
    { name: 'dunes',  dark: false },
    { name: 'lake',   dark: false },
    { name: 'meadow', dark: false },
    { name: 'winter', dark: false },
    { name: 'moon',   dark: true },
  ];
  const BG_DIR = 'assets/backgrounds';

  /* ---------- Cookies ---------- */
  const setCookie = (k, v) => {
    document.cookie = `pomo_${k}=${encodeURIComponent(v)}; max-age=31536000; path=/; SameSite=Lax`;
  };
  const getCookie = (k) => {
    const m = document.cookie.match(new RegExp(`(?:^|; )pomo_${k}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  };
  const restore = (k, isValid) => {
    const v = getCookie(k);
    return v && isValid(v) ? v : null;
  };

  const cfg = { ...DEFAULTS };
  for (const k of LIMIT_KEYS) {
    const n = parseFloat(getCookie(k));
    if (Number.isFinite(n)) cfg[k] = clamp(n, ...LIMITS[k]);
  }
  cfg.sound = restore('sound', (v) => $(`#sound option[value="${v}"]`)) || cfg.sound;
  cfg.bg = restore('bg', (v) => BACKGROUNDS.some((b) => b.name === v)) || cfg.bg;
  cfg.cat = restore('cat', (v) => CAT_COLORS.includes(v)) || cfg.cat;

  /* ---------- Sounds (synthesised with the Web Audio API, so no files to license) ---------- */
  // each note: [frequency, start offset (s), duration (s), wave type, volume, optional end frequency]
  const bell = (f, parts) => parts.map(([r, v, d]) => [f * r, 0, d, 'sine', v]);
  const SOUNDS = {
    bell:  bell(660, [[1, .5, 2.6], [2.76, .22, 1.8], [5.4, .12, 1.0], [8.93, .06, .6]]),
    gong:  bell(110, [[1, .6, 4.5], [1.5, .3, 3.5], [2.57, .2, 2.5], [3.9, .1, 1.5]]),
    chime: [[784, 0, 1.4, 'sine', .35], [988, .2, 1.4, 'sine', .35], [1319, .4, 1.8, 'sine', .35]],
    harp:  [523, 659, 784, 1047].map((f, i) => [f, i * .14, 1.2, 'triangle', .3]),
    wood:  [[900, 0, .12, 'triangle', .7, 450], [900, .35, .12, 'triangle', .7, 450]],
    beep:  [0, .25, .5].map((at) => [880, at, .14, 'square', .12]),
  };

  let ctx;
  const audio = () => {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  const note = (c, [freq, at, dur, type, vol, to]) => {
    const t = c.currentTime + at;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  };

  const play = (name, rounds = 1) => {
    const c = audio();
    for (let r = 0; r < rounds; r++) {
      SOUNDS[name].forEach(([f, at, ...rest]) => note(c, [f, at + r * 2.6, ...rest]));
    }
  };

  /* ---------- Timer ---------- */
  const timeEl = $('#time');
  const toggleBtn = $('#toggle');
  const modeBtns = document.querySelectorAll('.mode');
  const suggestBtn = $('#suggest');
  const suggestNote = $('#suggest-note');
  const tipEl = $('#tip');
  const faviconEl = document.querySelector('link[rel="icon"]');

  let mode = 'study';
  let remaining = Math.round(cfg.study * 60);
  let running = false;
  let endAt = 0;
  let intervalId = null;
  let done = 0; // finished focus sessions (every 4th break becomes a long one)
  let editing = false;

  const secs = () => cfg[mode] * 60;

  const setFavicon = (emoji) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${emoji}</text></svg>`;
    faviconEl.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
  };

  const render = () => {
    const m = String(Math.floor(remaining / 60)).padStart(2, '0');
    const s = String(remaining % 60).padStart(2, '0');
    timeEl.textContent = `${m}:${s}`;
    document.title = `${m}:${s} · ${LABEL[mode]}`;

    modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    toggleBtn.textContent = running ? 'Pause' : remaining < secs() ? 'Resume' : 'Start';

    // 🗿 only while focus is actually counting down, 🌴 the rest of the time
    setFavicon(running && mode === 'study' ? '🗿' : '🌴');

    suggestBtn.hidden = running || mode === 'study';
    tipEl.hidden = running || editing;
  };

  const update = (k, n) => {
    cfg[k] = clamp(Number.isFinite(n) ? n : cfg[k], ...LIMITS[k]);
    setCookie(k, cfg[k]);
    if (!running && k === mode) remaining = Math.round(secs());
    render();
  };

  const stop = () => {
    clearInterval(intervalId);
    running = false;
  };

  const setMode = (m) => {
    stop();
    mode = m;
    remaining = Math.round(secs());
    render();
  };

  // starts (or restarts) the current period; also used by the auto-flow below
  const begin = () => {
    audio(); // first call happens inside a click so the browser allows sound later
    endAt = Date.now() + remaining * 1000;
    running = true;
    intervalId = setInterval(tick, 250);
    render();
  };

  // auto-flow: focus → short break → focus → … and after every 4th finished
  // focus round the long break, then back to focus, until the user pauses
  const finish = () => {
    stop();
    play(cfg.sound, 2);
    if (mode === 'study') done++;
    setMode(mode === 'study' ? (done % 4 === 0 ? 'long' : 'short') : 'study');
    begin();
  };

  const tick = () => {
    remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    render();
    if (remaining === 0) finish();
  };

  toggleBtn.addEventListener('click', () => {
    if (running) {
      tick();
      stop();
      render();
      return;
    }
    begin();
  });

  // background tabs throttle timers; catch up as soon as the tab is visible again
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && running) tick();
  });

  $('#reset').addEventListener('click', () => setMode(mode));
  // double-click restores the factory durations (25 / 5 / 15); the single-click
  // handler above still fires first, but update() then fixes the values
  $('#reset').addEventListener('dblclick', () => {
    LIMIT_KEYS.forEach((k) => update(k, DEFAULTS[k]));
  });
  modeBtns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  /* ---------- Inline editing of the clock ---------- */
  // accepts "12" minutes, "12:30" minutes-and-seconds, "0:02" for two seconds
  // or "1.5" decimal minutes; Enter or clicking away commits, Escape cancels
  const parseMinutes = (text) => {
    const parts = text.trim().match(/^(\d{1,3}):([0-5]?\d)$/);
    if (parts) return Number(parts[1]) + Number(parts[2]) / 60;
    const n = parseFloat(text);
    return Number.isFinite(n) ? n : NaN;
  };

  timeEl.addEventListener('dblclick', () => {
    if (running || editing) return;
    editing = true;
    timeEl.contentEditable = 'true';
    timeEl.focus();
    const range = document.createRange();
    range.selectNodeContents(timeEl);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });

  timeEl.addEventListener('keydown', (e) => {
    if (!editing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      timeEl.blur();
    } else if (e.key === 'Escape') {
      timeEl.dataset.cancel = '1';
      timeEl.blur();
    }
  });

  timeEl.addEventListener('blur', () => {
    if (!editing) return;
    editing = false;
    timeEl.contentEditable = 'false';
    if (timeEl.dataset.cancel) {
      delete timeEl.dataset.cancel;
    } else {
      const minutes = parseMinutes(timeEl.textContent);
      if (Number.isFinite(minutes)) update(mode, minutes);
    }
    render();
  });

  /* ---------- Settings ---------- */
  const dialog = $('#settings');
  $('#open-settings').addEventListener('click', () => dialog.showModal());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  // break lengths scale with the focus time instead of dwarfing it:
  //   short = max(1 min, 20% of focus)
  //   long  = max(3 min, 3 × short, 50% of focus)
  // both rounded to the nearest 15 s, so 25 min focus still gives the classic 5/15
  const round15 = (s) => Math.round(s / 15) * 15;
  let noteTimer = null;
  suggestBtn.addEventListener('click', () => {
    const focus = cfg.study * 60;
    const shortSecs = round15(Math.max(60, focus * 0.2));
    const longSecs = round15(Math.max(Math.max(180, shortSecs * 3), focus * 0.5));
    update('short', shortSecs / 60);
    update('long', longSecs / 60);
    suggestNote.textContent = `${fmt(shortSecs / 60)} / ${fmt(longSecs / 60)} min`;
    suggestNote.hidden = false;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { suggestNote.hidden = true; }, 4000);
  });

  const soundSelect = $('#sound');
  soundSelect.value = cfg.sound;
  soundSelect.addEventListener('change', () => {
    cfg.sound = soundSelect.value;
    setCookie('sound', cfg.sound);
    play(cfg.sound);
  });
  $('#preview').addEventListener('click', () => play(cfg.sound));

  /* ---------- Fullscreen ---------- */
  const fsBtn = $('#fullscreen');
  const docEl = document.documentElement;
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;

  // keep the icon honest — Esc / F11 also leave fullscreen and fire a change event
  const fsSync = () => {
    fsBtn.dataset.active = String(!!fsElement());
    fsBtn.title = fsElement() ? 'Exit fullscreen' : 'Fullscreen';
  };
  document.addEventListener('fullscreenchange', fsSync);
  document.addEventListener('webkitfullscreenchange', fsSync);
  fsSync();

  fsBtn.addEventListener('click', () => {
    if (fsElement()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else if (docEl.requestFullscreen) {
      docEl.requestFullscreen().catch(() => {}); // browser said no — nothing to recover from
    } else if (docEl.webkitRequestFullscreen) {
      docEl.webkitRequestFullscreen();
    }
  });

  /* ---------- Backgrounds ---------- */
  // white text on dark photos, black text on bright ones; the halo shadows
  // in style.css cover the muddy middle where both struggle
  const pickTheme = (L) => (L < .45 ? 'dark' : 'light');

  // sample the centre band of the picture — that's where the clock sits
  const sample = async (img) => {
    const w = img.naturalWidth, h = img.naturalHeight;
    const crop = [w * .2, h * .28, w * .6, h * .34];
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 12;
    const g = canvas.getContext('2d');
    // decode and downscale off the main thread; plain drawImage is the fallback
    if (window.createImageBitmap) {
      const bmp = await createImageBitmap(img, ...crop, { resizeWidth: 16, resizeHeight: 12, resizeQuality: 'low' });
      g.drawImage(bmp, 0, 0);
      bmp.close();
    } else {
      g.drawImage(img, ...crop, 0, 0, 16, 12);
    }
    const px = g.getImageData(0, 0, 16, 12).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) {
      sum += .2126 * px[i] + .7152 * px[i + 1] + .0722 * px[i + 2];
    }
    document.body.dataset.theme = pickTheme(sum / (px.length / 4) / 255);
  };

  const applyBg = (name) => {
    document.body.dataset.bg = name;
    $(`input[name="bg"][value="${name}"]`).checked = true;
    // sensible guess from the build-time measurement, refined below
    document.body.dataset.theme =
      BACKGROUNDS.find((b) => b.name === name)?.dark ? 'dark' : 'light';

    const img = new Image();
    // canvas read blocked (file://): the fallback above stands
    img.onload = () => sample(img).catch(() => {});
    img.src = `${BG_DIR}/${name}.webp`;
  };

  applyBg(cfg.bg);
  document.querySelectorAll('input[name="bg"]').forEach((r) =>
    r.addEventListener('change', () => {
      cfg.bg = r.value;
      applyBg(cfg.bg);
      setCookie('bg', cfg.bg);
    })
  );

  render();

  /* ---------- Cat (reusable component, see cat.js) ---------- */
  const catApi = window.PomodoroCat ? window.PomodoroCat.mount({ color: cfg.cat }) : null;
  const catSelect = $('#cat-color');
  catSelect.value = cfg.cat;
  catSelect.addEventListener('change', () => {
    cfg.cat = catSelect.value;
    catApi?.setColor(cfg.cat);
    setCookie('cat', cfg.cat);
  });
})();
