// iPadOS / iOS dedicated touch controls, interactive throttle slider, and multi-touch cockpit UX
import { haptics } from './haptics.js';
import { tr } from '../i18n.js';

const $ = (id) => document.getElementById(id);

/** iPad Edition always enables touch UI (unless ?touch=0 is explicitly passed for debug) */
export function detectTouch() {
  const qs = new URLSearchParams(location.search).get('touch');
  if (qs === '0') return false;
  return true;
}

const COMPACT_MQ = '(max-width: 760px), (max-height: 520px)';
export const isCompact = () => window.matchMedia && matchMedia(COMPACT_MQ).matches;

export function initMobile(app) {
  const body = document.body;
  body.classList.add('ipad-app');
  const setTouch = (on) => body.classList.toggle('touch', on);
  setTouch(detectTouch());
  window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') setTouch(true); }, { passive: true });
  if (window.matchMedia) {
    window.matchMedia('(pointer: coarse)').addEventListener('change', () => setTouch(detectTouch()));
  }

  // Block page-level Safari/WKWebView pinch-zoom (Three.js OrbitControls handles 3D pinch zoom on canvas)
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  }

  // Interactive touch-draggable Throttle Slider (.hud-bottom .throttle)
  initTouchThrottleSlider(app);

  // Top-left iPad Cockpit navigation bar (1-tap ← VAB + ⏸ Pause/Menu)
  initPadCockpitNav(app);

  // phones: both flight HUD panels collapse into small icons (📊 telemetry / ⛽ stages & systems / ⚙️ options)
  const { tgOpt } = initHudToggles(app);

  // VAB specs panel toggle (compact screens)
  const statsBtn = $('btn-stats-toggle');
  if (statsBtn) {
    statsBtn.addEventListener('click', () => {
      const open = $('stats').classList.toggle('open');
      statsBtn.classList.toggle('on', open);
    });
  }

  // scene flag for CSS (e.g. landscape hint only during flight) + live state of touch buttons & vehicle joystick
  let sasBtn = null, optBtn = null, syncVehicleControls = null;
  const tick = () => {
    const inLaunch = !!app.launch && app.current === app.launch;
    body.classList.toggle('scene-launch', inLaunch);
    if (inLaunch && sasBtn) sasBtn.classList.toggle('on', !!app.launch.sas);
    if (syncVehicleControls) syncVehicleControls(inLaunch);
    const menuOpen = ($('menu') && !$('menu').classList.contains('hidden')) || ($('settings') && !$('settings').classList.contains('hidden'));
    if (tgOpt) tgOpt.classList.toggle('on', !!menuOpen);
    if (optBtn) optBtn.classList.toggle('on', !!menuOpen);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  ({ sasBtn, optBtn, syncVehicleControls } = buildFlightControls(app));
}

function initTouchThrottleSlider(app) {
  const thrWrap = document.querySelector('#launch-ui .hud-bottom .throttle');
  const thrBar = thrWrap && thrWrap.querySelector('.thr-bar');
  if (!thrWrap || !thrBar) return;
  let thrPtr = null;
  let lastDecile = -1;

  const setFromEvent = (e) => {
    const launch = app && app.launch;
    if (!launch || launch.missionSuccessStopped || launch.docked) return;
    const rect = thrBar.getBoundingClientRect();
    if (!rect.width) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    launch.throttle = pct;
    if (pct > 0.02 && launch.player && (launch.player.isPlane || launch.player.isBoat)) {
      launch.ignited = true;
      launch.player.engineOn = true;
    }
    const dec = Math.round(pct * 10);
    if (dec !== lastDecile) {
      lastDecile = dec;
      haptics.light();
    }
  };

  thrWrap.addEventListener('pointerdown', (e) => {
    if (thrPtr !== null) return;
    e.preventDefault();
    e.stopPropagation();
    thrPtr = e.pointerId;
    thrWrap.classList.add('dragging');
    try { thrWrap.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    setFromEvent(e);
  });
  thrWrap.addEventListener('pointermove', (e) => {
    if (e.pointerId !== thrPtr) return;
    e.preventDefault();
    e.stopPropagation();
    setFromEvent(e);
  });
  const endThr = (e) => {
    if (thrPtr === null || (e && e.pointerId !== undefined && e.pointerId !== thrPtr)) return;
    thrPtr = null;
    lastDecile = -1;
    thrWrap.classList.remove('dragging');
  };
  thrWrap.addEventListener('pointerup', endThr);
  thrWrap.addEventListener('pointercancel', endThr);
  thrWrap.addEventListener('lostpointercapture', endThr);
}

function initPadCockpitNav(app) {
  const root = $('launch-ui');
  if (!root || $('ipad-flight-nav')) return;
  const nav = document.createElement('div');
  nav.id = 'ipad-flight-nav';
  nav.className = 'ipad-flight-nav glass';
  nav.innerHTML = `
    <button type="button" class="ipad-nav-btn ipad-vab-btn" id="ipad-btn-vab">← <span id="ipad-lbl-vab">VAB</span></button>
    <button type="button" class="ipad-nav-btn ipad-pause-btn" id="ipad-btn-pause" aria-label="Menu">⏸</button>
  `;
  root.appendChild(nav);
  const vabBtn = nav.querySelector('#ipad-btn-vab');
  const pauseBtn = nav.querySelector('#ipad-btn-pause');
  if (vabBtn) {
    vabBtn.addEventListener('click', () => {
      haptics.light();
      if (app && typeof app.goBuild === 'function') app.goBuild();
    });
  }
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      haptics.light();
      if (app && typeof app.toggleMenu === 'function') app.toggleMenu();
    });
  }
}

/**
 * Compact screens: hide the two flight HUD panels behind icon buttons.
 * The Fire / Auto / Map / Warp buttons are moved out of the right panel into the icon row
 * so they stay reachable while the panel is hidden (and moved back on larger screens).
 */
function initHudToggles(app) {
  const root = $('launch-ui');
  const left = root && root.querySelector('.hud-left');
  const right = root && root.querySelector('.hud-right');
  const actions = right && right.querySelector('.hud-actions-grid');
  if (!left || !right || !actions) return {};
  const anchor = right.querySelector('.gpu-launch');   // original spot of the actions grid

  const mk = (cls, html) => { const d = document.createElement('div'); d.className = `hud-quick ${cls}`; d.innerHTML = html; root.appendChild(d); return d; };
  const qLeft = mk('left', '<button type="button" class="hud-tg" id="hud-tg-left" aria-label="Telemetry" title="Telemetry">📊</button>');
  const qRight = mk(
    'right',
    '<button type="button" class="hud-tg" id="hud-tg-right" aria-label="Stages & systems" title="Stages & Systems">⛽</button>' +
    '<button type="button" class="hud-tg" id="hud-tg-opt" aria-label="Options" title="Options / Menu (Esc)">⚙️</button>'
  );
  const tgLeft = qLeft.querySelector('#hud-tg-left');
  const tgRight = qRight.querySelector('#hud-tg-right');
  const tgOpt = qRight.querySelector('#hud-tg-opt');
  if (tgOpt) {
    tgOpt.addEventListener('click', () => {
      if (app && typeof app.toggleMenu === 'function') app.toggleMenu();
    });
  }

  // only one panel open at a time
  const pairs = [[tgLeft, left], [tgRight, right]];
  const bind = (btn, hud) => btn.addEventListener('click', () => {
    const on = !hud.classList.contains('shown');
    for (const [b, h] of pairs) { h.classList.remove('shown'); b.classList.remove('on'); }
    hud.classList.toggle('shown', on);
    btn.classList.toggle('on', on);
  });
  for (const [b, h] of pairs) bind(b, h);

  const place = () => {
    if (isCompact()) {
      if (actions.parentElement !== qRight) qRight.insertBefore(actions, tgRight);
    } else if (actions.parentElement !== right) {
      right.insertBefore(actions, anchor || null);
    }
  };
  place();
  if (window.matchMedia) matchMedia(COMPACT_MQ).addEventListener('change', place);
  return { tgOpt };
}

/**
 * On-screen flight buttons (touch only, shown via CSS):
 *  left  – attitude pad (W/A/S/D); centre button switches it to RCS translation (I/K/J/L + H/N) for docking
 *  right – throttle ▲▼ / MAX / 0, STAGE, SAS, SAS-mode, camera, legs/chute, time-warp, options menu
 * Hold buttons write straight into LaunchScene.keys (same as a held keyboard key);
 * tap buttons dispatch a synthetic keydown/keyup so every existing shortcut keeps a single code path.
 */
function buildFlightControls(app) {
  const root = $('launch-ui');
  if (!root) return {};
  const L = () => app.launch;
  const tap = (key, code = '') => {
    const o = { key, code, bubbles: true, cancelable: true };
    window.dispatchEvent(new KeyboardEvent('keydown', o));
    window.dispatchEvent(new KeyboardEvent('keyup', o));
  };

  const wrap = document.createElement('div');
  wrap.id = 'touch-ctl';
  wrap.innerHTML = `
    <div class="tc-pad" id="tc-pad">
      <button type="button" class="tc-btn tc-rcs-only" data-hold="h" data-pos="tl" aria-label="RCS up">⤒</button>
      <button type="button" class="tc-btn tc-arrow" data-hold="w" data-rcs="i" data-pos="t" aria-label="Pitch">▲</button>
      <span></span>
      <button type="button" class="tc-btn tc-arrow" data-hold="a" data-rcs="j" data-pos="l" aria-label="Left">◀</button>
      <button type="button" class="tc-btn tc-mid" id="tc-rcs" aria-label="RCS mode"><small>RCS</small></button>
      <button type="button" class="tc-btn tc-arrow" data-hold="d" data-rcs="l" data-pos="r" aria-label="Right">▶</button>
      <button type="button" class="tc-btn tc-rcs-only" data-hold="n" data-pos="bl" aria-label="RCS down">⤓</button>
      <button type="button" class="tc-btn tc-arrow" data-hold="s" data-rcs="k" data-pos="b" aria-label="Pitch back">▼</button>
      <span></span>
    </div>
    <div class="tc-joy" id="tc-joy" aria-label="Vehicle Joystick">
      <div class="tc-joy-ring">
        <span class="tc-joy-dir tc-joy-up" id="tc-joy-up">▲</span>
        <span class="tc-joy-dir tc-joy-down" id="tc-joy-down">▼</span>
        <span class="tc-joy-dir tc-joy-left" id="tc-joy-left">◀</span>
        <span class="tc-joy-dir tc-joy-right" id="tc-joy-right">▶</span>
      </div>
      <div class="tc-joy-stem" id="tc-joy-stem"></div>
      <div class="tc-joy-knob" id="tc-joy-knob">
        <span class="tc-joy-icon" id="tc-joy-icon">🚙</span>
      </div>
    </div>
    <button type="button" class="tc-btn tc-fire-thumb hidden" id="tc-fire" data-tap="v" aria-label="Fire Weapons">🔫<small>FIRE</small></button>
    <div class="tc-cluster">
      <button type="button" class="tc-btn" data-tap="," aria-label="Warp slower">⏪</button>
      <button type="button" class="tc-btn" data-tap="." aria-label="Warp faster">⏩</button>
      <button type="button" class="tc-btn" id="tc-opt" data-tap="Escape" aria-label="Options">⚙️<small>OPT</small></button>

      <button type="button" class="tc-btn" id="tc-sas" data-tap="r">🧭<small>SAS</small></button>
      <button type="button" class="tc-btn" data-tap="k">🎯<small>MODE</small></button>
      <button type="button" class="tc-btn" data-tap="c">🎥<small>CAM</small></button>

      <button type="button" class="tc-btn tc-thr" data-hold="shift">▲<small>THR</small></button>
      <button type="button" class="tc-btn tc-thr" data-tap="z"><small>MAX</small></button>
      <button type="button" class="tc-btn" data-tap="p">🪂<small>LEGS</small></button>

      <button type="button" class="tc-btn tc-thr" data-hold="control">▼<small>THR</small></button>
      <button type="button" class="tc-btn tc-thr" data-tap="x"><small>0%</small></button>
      <button type="button" class="tc-btn tc-stage" data-tap=" " data-code="Space">🚀<small>STAGE</small></button>
    </div>`;
  root.appendChild(wrap);

  const pad = wrap.querySelector('#tc-pad');
  const rcsBtn = wrap.querySelector('#tc-rcs');
  const joy = wrap.querySelector('#tc-joy');
  const joyKnob = wrap.querySelector('#tc-joy-knob');
  const joyStem = wrap.querySelector('#tc-joy-stem');
  const joyIcon = wrap.querySelector('#tc-joy-icon');
  const joyUp = wrap.querySelector('#tc-joy-up');
  const joyDown = wrap.querySelector('#tc-joy-down');
  const joyLeft = wrap.querySelector('#tc-joy-left');
  const joyRight = wrap.querySelector('#tc-joy-right');
  const keyOf = (btn) => (pad.classList.contains('rcs') && btn.dataset.rcs) || btn.dataset.hold;

  // Virtual 360° analog thumbstick for Rover, Boat & Airplane
  let joyPointerId = null;
  let lastJoyIcon = '';
  const resetJoy = () => {
    joyPointerId = null;
    if (L()) {
      L().joyX = 0;
      L().joyY = 0;
    }
    if (joy) joy.classList.remove('active');
    if (joyKnob) joyKnob.style.transform = 'translate3d(0px, 0px, 0)';
    if (joyStem) {
      joyStem.style.width = '0px';
      joyStem.style.opacity = '0';
    }
    if (joyUp) joyUp.classList.remove('lit');
    if (joyDown) joyDown.classList.remove('lit');
    if (joyLeft) joyLeft.classList.remove('lit');
    if (joyRight) joyRight.classList.remove('lit');
  };

  const updateJoyFromEvent = (e) => {
    const launch = L();
    if (!launch || !joy) return;
    const rect = joy.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const knobW = (joyKnob && joyKnob.offsetWidth) ? joyKnob.offsetWidth : rect.width * 0.23;
    const maxR = Math.max(24, (rect.width - knobW) * 0.5 - 8);
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxR);
    const kx = dist > 1e-4 ? (dx / dist) * clampedDist : 0;
    const ky = dist > 1e-4 ? (dy / dist) * clampedDist : 0;
    if (joyKnob) joyKnob.style.transform = `translate3d(${kx.toFixed(1)}px, ${ky.toFixed(1)}px, 0)`;
    if (joyStem) {
      joyStem.style.width = `${clampedDist.toFixed(1)}px`;
      joyStem.style.transform = `rotate(${Math.atan2(ky, kx).toFixed(3)}rad)`;
      joyStem.style.opacity = clampedDist > 4 ? '1' : '0';
    }
    const raw = dist / maxR;
    const dz = 0.08;
    let jx = 0, jy = 0;
    if (raw > dz && dist > 1e-4) {
      const mag = Math.min(1, (raw - dz) / (1 - dz));
      const ux = dx / dist;
      const uy = -dy / dist;
      const diagBoost = 1 / Math.max(0.76, Math.max(Math.abs(ux), Math.abs(uy)));
      jx = Math.max(-1, Math.min(1, ux * mag * diagBoost));
      jy = Math.max(-1, Math.min(1, uy * mag * diagBoost));
    }
    launch.joyX = jx;
    launch.joyY = jy;
    if (joyUp) joyUp.classList.toggle('lit', jy > 0.22);
    if (joyDown) joyDown.classList.toggle('lit', jy < -0.22);
    if (joyLeft) joyLeft.classList.toggle('lit', jx < -0.22);
    if (joyRight) joyRight.classList.toggle('lit', jx > 0.22);
  };

  if (joy) {
    joy.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!L() || joyPointerId !== null) return;
      joyPointerId = e.pointerId;
      try { joy.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      joy.classList.add('active');
      updateJoyFromEvent(e);
    });
    joy.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joyPointerId) return;
      e.preventDefault();
      e.stopPropagation();
      updateJoyFromEvent(e);
    });
    const onEnd = (e) => {
      if (joyPointerId === null || (e && e.pointerId !== undefined && e.pointerId !== joyPointerId)) return;
      resetJoy();
    };
    joy.addEventListener('pointerup', onEnd);
    joy.addEventListener('pointercancel', onEnd);
    joy.addEventListener('lostpointercapture', onEnd);
    joy.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    joy.addEventListener('touchmove', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
    joy.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', resetJoy);
    document.addEventListener('visibilitychange', () => { if (document.hidden) resetJoy(); });
  }

  const syncVehicleControls = (inLaunch) => {
    const launch = inLaunch ? L() : null;
    const P = launch ? launch.player : null;
    const isRover = !!P?.isRover;
    const isBoat = !!P?.isBoat;
    const isPlane = !!P?.isPlane;
    const useJoystick = isRover || isBoat || isPlane;
    wrap.classList.toggle('tc-joystick-mode', useJoystick);
    document.body.classList.toggle('joy-mode', useJoystick);
    document.body.classList.toggle('veh-rover', isRover);
    document.body.classList.toggle('veh-boat', isBoat);
    document.body.classList.toggle('veh-plane', isPlane);
    const fireBtn = wrap.querySelector('#tc-fire');
    if (fireBtn) {
      const hasWeapons = !!(launch?.rocket?.weapons?.length);
      fireBtn.classList.toggle('hidden', !hasWeapons);
    }
    const vabLbl = $('ipad-lbl-vab');
    if (vabLbl) vabLbl.textContent = tr('Xưởng', 'VAB');
    if (useJoystick && joyIcon) {
      const nextIcon = isPlane ? '✈️' : isBoat ? '🛥️' : '🚙';
      if (nextIcon !== lastJoyIcon) {
        lastJoyIcon = nextIcon;
        joyIcon.textContent = nextIcon;
      }
    } else if (!useJoystick && joyPointerId !== null) {
      resetJoy();
    }
  };

  // hold buttons (multi-touch safe: each finger is captured by its own button)
  wrap.querySelectorAll('[data-hold]').forEach((btn) => {
    let held = null;
    const release = () => {
      if (held && L()) L().keys[held] = false;
      held = null;
      btn.classList.remove('on');
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!L()) return;
      try { btn.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      release();
      held = keyOf(btn);
      L().keys[held] = true;
      btn.classList.add('on');
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  // tap buttons → synthetic keyboard shortcut
  wrap.querySelectorAll('[data-tap]').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => e.preventDefault());
    btn.addEventListener('click', () => tap(btn.dataset.tap, btn.dataset.code || ''));
  });

  rcsBtn.addEventListener('click', () => {
    const on = pad.classList.toggle('rcs');
    rcsBtn.classList.toggle('on', on);
  });

  return { sasBtn: wrap.querySelector('#tc-sas'), rcsBtn, optBtn: wrap.querySelector('#tc-opt'), syncVehicleControls };
}
