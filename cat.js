/**
 * PomodoroCat — a self-contained cat companion component.
 *
 * Drop-in reusable on any page:
 *   <script src="cat.js" defer></script>
 *   <script> window.addEventListener('load', () => PomodoroCat.mount()); </script>
 *
 * API:
 *   PomodoroCat.mount({ color, zIndex, root })  → { el, setColor, destroy }
 *   PomodoroCat.setColor('default'|'black'|'white'|'transparent')
 *   PomodoroCat.el                               → the mounted element
 */
(() => {
  'use strict';

  const STYLES_ID = 'pcat-styles';
  const FLIP_CLASS = 'pcat-flip';

  const CSS = `
/* the color palette lives on the root so EVERY child can use it —
   the zzz svg and the meow bubble sit outside the cat svg, and a
   var() they can't see would silently fall back to inherited color
   (invisible white-on-white text on dark backgrounds) */
.pcat {
  position: fixed;
  left: 0;
  bottom: 5px;
  width: 150px;
  height: 92px;
  pointer-events: none;
  --fur: #e9a35d;
  --fur-dark: #c47a34;
  --fur-light: #f6dcae;
  --cat-line: #3a2619;
  --inner-ear: #f5a3a3;
  --eye: #2b1a14;
  --nose: #e9768a;
}
.pcat[data-color="black"] {
  --fur: #43434b;
  --fur-dark: #2c2c33;
  --fur-light: #6a6a74;
  --cat-line: #17171b;
  --inner-ear: #6d5a63;
  --eye: #a8e063;
  --nose: #d67f92;
}
.pcat[data-color="white"] {
  --fur: #faf7f0;
  --fur-dark: #e6ddcd;
  --fur-light: #ffffff;
  --cat-line: #948a7d;
  --inner-ear: #f5b8b8;
  --eye: #4a3f36;
  --nose: #e9768a;
}
.pcat[data-color="transparent"] { display: none; }

.pcat svg.pcat-cat {
  display: block;
  overflow: visible;
  pointer-events: auto;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.pcat.pcat-flip svg.pcat-cat { transform: scaleX(-1); }

.pcat svg.pcat-cat * { stroke: var(--cat-line); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.pcat svg.pcat-cat .pcat-fur { fill: var(--fur); }
.pcat svg.pcat-cat .pcat-patch, .pcat svg.pcat-cat .pcat-sock { fill: var(--fur-light); stroke: none; }
.pcat svg.pcat-cat .pcat-tail-outline { stroke-width: 12; fill: none; stroke: var(--cat-line); stroke-linecap: round; }
.pcat svg.pcat-cat .pcat-tail-fur { stroke-width: 7; fill: none; stroke: var(--fur); stroke-linecap: round; }
.pcat svg.pcat-cat .pcat-tail-tip { stroke-width: 7; fill: none; stroke: var(--fur-light); stroke-linecap: round; }
.pcat svg.pcat-cat .pcat-stripe { stroke: var(--fur-dark); stroke-width: 3.5; stroke-linecap: butt; fill: none; }
.pcat svg.pcat-cat .pcat-inner-ear { fill: var(--inner-ear); stroke: none; }
.pcat svg.pcat-cat .pcat-pupil { fill: var(--eye); stroke: none; }
.pcat svg.pcat-cat .pcat-shine { fill: #fff; stroke: none; }
.pcat svg.pcat-cat .pcat-nose { fill: var(--nose); stroke: none; }
.pcat svg.pcat-cat .pcat-mouth { stroke-width: 1.6; fill: none; transition: opacity 0.2s; }
.pcat svg.pcat-cat .pcat-mouth-open { opacity: 0; fill: var(--inner-ear); stroke-width: 1.6; transition: opacity 0.2s; }
.pcat svg.pcat-cat .pcat-whisker { stroke-width: 1.5; fill: none; }
.pcat svg.pcat-cat .pcat-toe { stroke-width: 1.5; fill: none; }

/* Precise origins to prevent bounding box shifts */
.pcat-rig    { transform-origin: 75px 82px; transition: transform .45s ease-in-out; }
.pcat-torso  { transform-origin: 72px 78px; transition: transform .45s ease-in-out; }
.pcat-head   { transform-origin: 105px 40px; transition: transform .45s ease-in-out; }
.pcat-breath { transform-origin: 72px 78px; }
.pcat-tail   { transform-origin: 42px 62px; transition: transform .45s ease-in-out; }
.pcat-tailsway { transform-origin: 42px 62px; animation: pcat-wag 2.4s ease-in-out infinite alternate; }

.pcat-face, .pcat-leg, .pcat-eye, .pcat-earR, .pcat-earL { transform-box: fill-box; }
.pcat-leg    { transform-origin: 50% 10%; transition: opacity .3s; }
.pcat-face   { transform-origin: 60% 50%; }

/* Randomized blinking */
.pcat-eye    { transform-origin: center; animation: pcat-blink 12s infinite; animation-delay: var(--blink-delay, 0s); }
/* Both ears twitch */
.pcat-earR   { transform-origin: 20% 100%; animation: pcat-twitch 6s ease-in-out infinite; }
.pcat-earL   { transform-origin: 80% 100%; animation: pcat-twitch 6s ease-in-out infinite 0.5s; }

/* walking */
.pcat[data-state="walk"] .pcat-rig    { animation: pcat-bob .5s ease-in-out infinite alternate; }
.pcat[data-state="walk"] .pcat-torso  { animation: pcat-bodybob .5s ease-in-out infinite alternate; }
.pcat[data-state="walk"] .pcat-head   { animation: pcat-headbob .5s ease-in-out infinite alternate; }
.pcat[data-state="walk"] .pcat-leg1,
.pcat[data-state="walk"] .pcat-leg4   { animation: pcat-step .5s ease-in-out infinite alternate; }
.pcat[data-state="walk"] .pcat-leg2,
.pcat[data-state="walk"] .pcat-leg3   { animation: pcat-step .5s ease-in-out infinite alternate-reverse; }
.pcat[data-state="walk"] .pcat-tailsway { animation-duration: 1.1s; }

/* sitting upright */
.pcat-tucked { opacity: 0; transition: opacity .3s; }
.pcat[data-state="sit"] .pcat-leg { opacity: 0; }
.pcat[data-state="sit"] .pcat-tucked { opacity: 1; }
.pcat[data-state="sit"] .pcat-torso { transform: translateY(8px) scaleY(.9); }
.pcat[data-state="sit"] .pcat-head  { transform: translate(-2px, 6px); }
.pcat[data-state="sit"] .pcat-tail  { transform: translate(5px, 14px) rotate(-15deg); }
.pcat[data-state="sit"] .pcat-tailsway { animation: pcat-swish 2.2s ease-in-out infinite alternate; }

/* curled up asleep */
.pcat[data-state="sleep"] .pcat-leg { opacity: 0; }
.pcat[data-state="sleep"] .pcat-tucked { opacity: 1; }
.pcat[data-state="sleep"] .pcat-torso { transform: translateY(11px) scaleY(.85); }
.pcat[data-state="sleep"] .pcat-head  { transform: translate(-8px, 16px) rotate(4deg); }
.pcat[data-state="sleep"] .pcat-tail  { transform: translate(14px, 14px) rotate(35deg); }
.pcat[data-state="sleep"] .pcat-tailsway { animation: pcat-swish 3s ease-in-out infinite alternate; }
.pcat[data-state="sleep"] .pcat-eye { animation: none; transform: scaleY(.12); }

/* meow interaction */
.pcat[data-state="meow"] .pcat-torso { transform: scale(1.02, 0.95); transition: transform 0.2s; }
.pcat[data-state="meow"] .pcat-head  { transform: translateY(-4px) rotate(-4deg); transition: transform 0.2s; }
.pcat[data-state="meow"] .pcat-mouth { opacity: 0; }
.pcat[data-state="meow"] .pcat-mouth-open { opacity: 1; }
.pcat[data-state="meow"] .pcat-meow-bubble { opacity: 1; transform: translateY(0); }

/* resting behaviours */
.pcat[data-state="sit"] .pcat-breath,
.pcat[data-state="sleep"] .pcat-breath { animation: pcat-breathe 3.4s ease-in-out infinite alternate; }
.pcat[data-state="sit"] .pcat-face,
.pcat[data-state="sleep"] .pcat-face { animation: pcat-look 7s ease-in-out infinite; }

/* playing */
.pcat[data-state="play"] .pcat-rig { animation: pcat-hop .6s ease-in-out infinite; }
.pcat[data-state="play"] .pcat-tailsway { animation-duration: .35s; }

/* SVG Zzz */
.pcat-zzz {
  position: absolute;
  left: 110px;
  top: -12px;
  width: 40px;
  height: 40px;
  opacity: 0;
  pointer-events: none;
}
.pcat-zzz path {
  stroke: var(--cat-line, #3a2619);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}
.pcat.pcat-flip .pcat-zzz { left: 16px; }
.pcat[data-state="sleep"] .pcat-zzz { animation: pcat-float 2.6s ease-out infinite; }

/* Meow Speech Bubble — properly spaced out and above the head */
.pcat-meow-bubble {
  position: absolute;
  left: 75px;
  top: -38px;
  background: #fff;
  color: var(--cat-line, #3a2619);
  border: 2px solid var(--cat-line, #3a2619);
  border-radius: 10px;
  padding: 4px 10px;
  font-size: 13px;
  font-weight: 800;
  opacity: 0;
  transform: translateY(5px);
  transition: opacity .2s ease-out, transform .2s ease-out;
  font-family: system-ui, sans-serif;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  z-index: 10;
}
.pcat.pcat-flip .pcat-meow-bubble { left: 15px; }

/* Ball */
.pcat-ball {
  display: none;
  position: absolute;
  right: 20px;
  bottom: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #ff9db0, #d63f5c);
  border: 2px solid #3a2619;
  transform-origin: center bottom;
}
.pcat.pcat-flip .pcat-ball { right: auto; left: 20px; }
.pcat[data-state="play"] .pcat-ball { display: block; animation: pcat-bounce .6s ease-in-out infinite; }

/* Keyframes */
@keyframes pcat-step     { from { transform: rotate(-22deg); } to { transform: rotate(22deg); } }
@keyframes pcat-bob      { 0%, 100% { transform: translateY(1.5px); } 50% { transform: translateY(0); } }
@keyframes pcat-bodybob  { 0%, 100% { transform: scale(1.02, 0.98); } 50% { transform: scale(0.98, 1.02); } }
@keyframes pcat-headbob  { 0%, 100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-1px) rotate(2deg); } }

@keyframes pcat-hop      {
  0%, 100% { transform: translate(0, 0) scale(1.05, 0.95); }
  15%, 85% { transform: translate(0, 0) scale(0.95, 1.05); }
  50%      { transform: translate(12px, -20px) scale(1, 1) rotate(4deg); }
}
@keyframes pcat-bounce   {
  0%, 100% { transform: translateY(0) scale(1.1, 0.9); }
  15%, 85% { transform: translateY(-4px) scale(0.95, 1.05); }
  50%      { transform: translateY(-28px) scale(1, 1); }
}

@keyframes pcat-wag      { from { transform: rotate(-8deg); } to { transform: rotate(10deg); } }
@keyframes pcat-swish    { from { transform: rotate(-4deg); } to { transform: rotate(7deg); } }
@keyframes pcat-blink    {
  0%, 26%, 28%, 56%, 58%, 60%, 86%, 88%, 100% { transform: scaleY(1); }
  27%, 57%, 59%, 87% { transform: scaleY(0.1); }
}
@keyframes pcat-twitch   { 0%, 86%, 100% { transform: rotate(0); } 89% { transform: rotate(-16deg); } 92% { transform: rotate(7deg); } 95% { transform: rotate(0); } }
@keyframes pcat-breathe  { from { transform: scale(1, 1); } to { transform: scale(1.02, 1.05); } }
@keyframes pcat-look     { 0%, 78%, 100% { transform: rotate(0); } 83% { transform: rotate(2.5deg); } 90% { transform: rotate(-2deg); } }
@keyframes pcat-float    {
  0%   { opacity: 0;  transform: translate(0, 8px) scale(.8); }
  30%  { opacity: 1; }
  100% { opacity: 0;  transform: translate(12px, -24px) scale(1.2); }
}

@media (prefers-reduced-motion: reduce) {
  .pcat, .pcat * { animation: none !important; transition: none !important; }
}
`;

  const SVG = `
<svg class="pcat-cat" viewBox="0 0 150 92" width="150" height="92" aria-hidden="true">
  <g class="pcat-rig">

    <!-- Plush Thick Tail anchored at base (42, 62) -->
    <g class="pcat-tail">
      <g class="pcat-tailsway">
        <path class="pcat-tail-outline" d="M 42 62 C 10 65 -5 30 15 15" />
        <path class="pcat-tail-fur" d="M 42 62 C 10 65 -5 30 15 15" />
        <path class="pcat-tail-tip" d="M 42 62 C 10 65 -5 30 15 15" pathLength="100" stroke-dasharray="35 100" stroke-dashoffset="-65" />
      </g>
    </g>

    <!-- Far Legs (Back L1, Front L2) -->
    <g class="pcat-leg pcat-leg1">
      <path class="pcat-fur" d="M 47 62 C 47 70 46 78 48 82 A 4 3 0 0 0 56 82 C 58 78 57 70 57 62"/>
      <path class="pcat-sock" d="M 47.6 76 Q 52 74 56.4 76 C 57 78 57 80 56 82 A 4 3 0 0 1 48 82 C 47 80 47 78 47.6 76 Z"/>
      <path class="pcat-toe" d="M 50.5 79.5 L 50.5 82 M 53.5 79.5 L 53.5 82"/>
    </g>
    <g class="pcat-leg pcat-leg2">
      <path class="pcat-fur" d="M 77 62 C 77 70 76 78 78 82 A 4 3 0 0 0 86 82 C 88 78 87 70 87 62"/>
      <path class="pcat-sock" d="M 77.6 76 Q 82 74 86.4 76 C 87 78 87 80 86 82 A 4 3 0 0 1 78 82 C 77 80 77 78 77.6 76 Z"/>
      <path class="pcat-toe" d="M 80.5 79.5 L 80.5 82 M 83.5 79.5 L 83.5 82"/>
    </g>

    <!-- Torso: Bread Loaf shape -->
    <g class="pcat-torso">
      <g class="pcat-breath">
        <path class="pcat-fur" d="M 40 55 C 40 40 48 36 65 36 L 80 36 C 98 36 106 42 106 55 C 106 70 98 78 80 78 L 60 78 C 45 78 40 72 40 55 Z" />
        <path class="pcat-patch" d="M 41 52 C 41 65 48 74 58 78 C 68 78 70 65 64 50 C 58 40 45 40 41 52 Z" />
        <path class="pcat-stripe" d="M 60 36 Q 58 45 59 50 M 72 36 Q 72 45 74 50 M 84 36 Q 86 45 88 49 M 44 42 Q 50 42 54 46" />

        <!-- Tucked paws -->
        <g class="pcat-tucked">
          <path class="pcat-fur" d="M 48 70 C 48 64 60 64 64 70 C 66 75 60 78 56 78 C 52 78 48 75 48 70 Z" />
          <path class="pcat-sock" d="M 48 70 Q 56 68 64 70 C 66 75 60 78 56 78 C 52 78 48 75 48 70 Z" />
        </g>
        <g class="pcat-tucked">
          <path class="pcat-fur" d="M 85 70 C 85 64 99 64 103 70 C 105 76 99 79 94 79 C 89 79 85 76 85 70 Z" />
          <path class="pcat-sock" d="M 85 70 Q 94 68 103 70 C 105 76 99 79 94 79 C 89 79 85 76 85 70 Z" />
        </g>
      </g>
    </g>

    <!-- Near Legs (Back L3, Front L4) -->
    <g class="pcat-leg pcat-leg3">
      <path class="pcat-fur" d="M 63 62 C 63 70 62 78 64 82 A 4 3 0 0 0 72 82 C 74 78 73 70 73 62"/>
      <path class="pcat-sock" d="M 63.6 76 Q 68 74 72.4 76 C 73 78 73 80 72 82 A 4 3 0 0 1 64 82 C 63 80 63 78 63.6 76 Z"/>
      <path class="pcat-toe" d="M 66.5 79.5 L 66.5 82 M 69.5 79.5 L 69.5 82"/>
    </g>
    <g class="pcat-leg pcat-leg4">
      <path class="pcat-fur" d="M 93 62 C 93 70 92 78 94 82 A 4 3 0 0 0 102 82 C 104 78 103 70 103 62"/>
      <path class="pcat-sock" d="M 93.6 76 Q 98 74 102.4 76 C 103 78 103 80 102 82 A 4 3 0 0 1 94 82 C 93 80 93 78 93.6 76 Z"/>
      <path class="pcat-toe" d="M 96.5 79.5 L 96.5 82 M 99.5 79.5 L 99.5 82"/>
    </g>

    <!-- Head -->
    <g class="pcat-head">
      <g class="pcat-face">

        <!-- Left Back Ear -->
        <g class="pcat-earL">
          <path class="pcat-fur" d="M 82 24 L 75 4 C 85 4 94 10 96 16 Z" />
          <path class="pcat-inner-ear" d="M 82 20 L 77 7 C 83 7 89 11 91 16 Z" />
        </g>

        <!-- Main Head Shape -->
        <path class="pcat-fur" d="M 105 12 C 128 12 134 25 134 40 C 134 54 122 62 105 62 C 88 62 76 54 76 40 C 76 25 82 12 105 12 Z" />

        <!-- Right Front Ear -->
        <g class="pcat-earR">
          <path class="pcat-fur" d="M 114 15 L 135 4 C 135 14 130 22 128 26 Z" />
          <path class="pcat-inner-ear" d="M 116 16 L 131 7 C 131 14 128 19 126 23 Z" />
        </g>

        <!-- Big Eyes with Dual Highlights -->
        <g class="pcat-eye">
          <circle class="pcat-pupil" cx="88" cy="40" r="5.5" />
          <circle class="pcat-shine" cx="89.5" cy="38" r="2" />
          <circle class="pcat-shine" cx="86" cy="42" r="1" />
        </g>
        <g class="pcat-eye">
          <circle class="pcat-pupil" cx="122" cy="40" r="5.5" />
          <circle class="pcat-shine" cx="123.5" cy="38" r="2" />
          <circle class="pcat-shine" cx="120" cy="42" r="1" />
        </g>

        <!-- Small Nose -->
        <path class="pcat-nose" d="M 103 45 L 107 45 L 105 48 Z" stroke="var(--nose)" stroke-width="1.5" stroke-linejoin="round" />

        <!-- 'ω' Mouth & Meow State -->
        <path class="pcat-mouth" d="M 101 47 Q 103 51 105 47 Q 107 51 109 47" />
        <path class="pcat-mouth-open" d="M 101 47 Q 105 54 109 47 Z" />

        <!-- Whiskers -->
        <path class="pcat-whisker" d="M 80 40 L 66 38 M 78 44 L 64 44 M 80 48 L 66 50" />
        <path class="pcat-whisker" d="M 130 40 L 144 38 M 132 44 L 146 44 M 130 48 L 144 50" />
      </g>
    </g>
  </g>
</svg>`;

  let instance = null;

  const injectStyles = () => {
    if (document.getElementById(STYLES_ID)) return;
    const tag = document.createElement('style');
    tag.id = STYLES_ID;
    tag.textContent = CSS;
    document.head.appendChild(tag);
  };

  const mount = ({ color = 'default', zIndex = 2, root = document.body } = {}) => {
    injectStyles();
    if (instance) instance.destroy();

    const el = document.createElement('div');
    el.className = 'pcat';
    el.dataset.state = 'walk';
    el.dataset.color = color;
    el.style.zIndex = String(zIndex);
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--blink-delay', `-${Math.random() * 12}s`);

    el.innerHTML = `
      <svg class="pcat-zzz" viewBox="0 0 40 40">
        <path d="M 8 24 L 18 24 L 8 34 L 18 34" />
        <path d="M 22 10 L 28 10 L 22 18 L 28 18" />
      </svg>
      <div class="pcat-meow-bubble">Meow!</div>
      <span class="pcat-ball"></span>
      ${SVG}
    `;

    /* ---------- behaviour ---------- */
    const MIN_X = 30;
    // layout viewport width (not window.innerWidth, which Firefox's
    // fingerprinting protection rounds and warns about)
    const reach = () => Math.max(MIN_X, document.documentElement.clientWidth - 180);
    // translateX instead of `left` keeps the walk on the compositor
    const moveTo = (x) => { el.style.transform = `translateX(${x}px)`; };
    const currentX = () => {
      const t = getComputedStyle(el).transform;
      return t === 'none' ? 0 : new DOMMatrixReadOnly(t).m41;
    };
    let catX = MIN_X + Math.random() * (reach() - MIN_X);
    let last = '';
    let pending = 0;

    moveTo(catX);
    root.appendChild(el);
    void el.offsetWidth;

    const setState = (s) => { el.dataset.state = s; last = s; };

    const stopWalking = () => {
      if (el.dataset.state !== 'walk') return;
      catX = currentX();
      el.style.transition = 'none';
      moveTo(catX);
    };

    const walk = () => {
      const to = MIN_X + Math.random() * (reach() - MIN_X);
      const t = Math.max(Math.abs(to - catX) / 55, 0.6);
      el.classList.toggle(FLIP_CLASS, to < catX);
      el.style.transition = `transform ${t}s linear`;
      setState('walk');
      catX = to;
      moveTo(catX);
      pending = setTimeout(next, t * 1000 + 200);
    };

    const rest = (state, min, max) => {
      stopWalking();
      setState(state);
      pending = setTimeout(next, min + Math.random() * (max - min));
    };

    const next = () => {
      const pool = ['walk', 'walk', 'sit', 'sleep', 'play'].filter((s) => s === 'walk' || s !== last);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (pick === 'walk') walk();
      else if (pick === 'sit') rest('sit', 6000, 12000);
      else if (pick === 'sleep') rest('sleep', 9000, 18000);
      else rest('play', 4000, 7000);
    };

    const svgCat = el.querySelector('svg.pcat-cat');
    svgCat.addEventListener('click', () => {
      if (el.dataset.state === 'meow') return;
      stopWalking();
      clearTimeout(pending);
      setState('meow');
      pending = setTimeout(next, 1500);
    });

    const onResize = () => {
      catX = Math.min(catX, reach());
      el.style.transition = 'none';
      moveTo(catX);
    };
    addEventListener('resize', onResize);

    const api = {
      el,
      setColor(c) { el.dataset.color = c; },
      destroy() {
        clearTimeout(pending);
        removeEventListener('resize', onResize);
        el.remove();
        if (instance === api) instance = null;
      },
    };
    instance = api;

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setState('sleep');
    } else {
      next();
    }
    return api;
  };

  window.PomodoroCat = {
    mount,
    setColor(c) { instance?.setColor(c); },
    get el() { return instance?.el ?? null; },
  };
})();
