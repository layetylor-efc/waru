(() => {
  'use strict';
  const { Game, TYPES, COLS, ROWS, MAX_HP } = CatDrop;
  const $ = id => document.getElementById(id);
  const atlas = $('atlas'), board = $('board'), battle = $('battle');
  const ctx = board.getContext('2d'), bctx = battle.getContext('2d');
  const SAVE = 'cat-drop-guardian-v1', BEST = 'cat-drop-guardian-best-v1', PREFS = 'cat-drop-guardian-prefs-v1';
  const FACE = [[30, 61, 152, 147], [219, 61, 153, 147], [412, 61, 149, 147], [592, 60, 157, 149]];
  const UNIT = [[0, 299, 195, 205], [196, 302, 192, 203], [391, 301, 192, 204], [587, 300, 182, 202]];
  const ENEMY = [[666, 822, 129, 115], [832, 822, 122, 115], [990, 822, 130, 115], [1152, 822, 126, 115]];
  const PALETTE = ['#ff9699', '#92e2b4', '#9dbeff', '#ffc778'];
  let game = null, paused = true, mode = 'normal', sound = false, audioContext, installedEvent;
  let effects = [], last = 0, accumulator = 0, hudClock = 0, saveClock = 0, boardSize, battleSize;
  let saved = null, best = { normal: 0, relaxed: 0 }, storageWarning = false, actionLock = 0;
  let noticeTimer, toastTimer, repeatTimer, holdTimeout, held = null, modalKind = '', closingToPlay = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function parse(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
  function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { if (!storageWarning) { storageWarning = true; notify('このブラウザでは記録を保存できません。プレイはできます。'); } return false; } }
  function remove(key) { try { localStorage.removeItem(key); } catch {} }
  function notify(text) { $('notice').textContent = text; $('notice').classList.add('show'); clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('notice').classList.remove('show'), 4300); }
  function toast(text) { $('battle-toast').textContent = text; $('battle-toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('battle-toast').classList.remove('show'), 1700); }
  function saveGame() { if (game && game.phase === 'playing') { saved = game.serialize(); store(SAVE, saved); } }
  function record() { if (!game) return; best[game.mode] = Math.max(best[game.mode] || 0, game.score); store(BEST, best); }
  function selectMode(value) {
    mode = value; for (const m of ['normal', 'relaxed']) { $('mode-' + m).classList.toggle('selected', m === mode); $('mode-' + m).setAttribute('aria-pressed', m === mode); }
    $('best').textContent = best[mode].toLocaleString('ja-JP'); store(PREFS, { mode, sound });
  }
  function round(c, x, y, w, h, radius, fill, stroke) {
    c.beginPath(); c.roundRect(x, y, Math.max(0, w), Math.max(0, h), radius);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
  }
  function imageRegion(c, source, x, y, w, h, alpha = 1) {
    if (!atlas.complete || !atlas.naturalWidth) return;
    c.save(); c.globalAlpha = alpha; c.drawImage(atlas, ...source, x, y, w, h); c.restore();
  }
  function face(c, type, x, y, size, alpha = 1) {
    c.save(); c.globalAlpha = alpha; c.beginPath(); c.roundRect(x, y, size, size, size * .17); c.clip();
    if (atlas.complete && atlas.naturalWidth) c.drawImage(atlas, ...FACE[type], x, y, size, size);
    else { c.fillStyle = PALETTE[type]; c.fillRect(x, y, size, size); c.fillStyle = '#17202e'; c.font = `${size * .45}px sans-serif`; c.textAlign = 'center'; c.fillText(['三','白','黒','茶'][type], x + size / 2, y + size * .66); }
    c.restore();
  }
  function resize() {
    if ($('game').hidden) return;
    for (const el of [board, battle]) {
      const r = el.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      if (!r.width || !r.height) continue;
      const width = Math.round(r.width * dpr), height = Math.round(r.height * dpr);
      if (el.width !== width || el.height !== height) { el.width = width; el.height = height; }
      const c = el.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const size = { w: r.width, h: r.height };
      if (el === board) { size.cell = Math.min((r.width - 8) / COLS, (r.height - 8) / ROWS); size.x = (r.width - size.cell * COLS) / 2; size.y = (r.height - size.cell * ROWS) / 2; boardSize = size; }
      else battleSize = size;
    }
    render();
  }
  function drawBoard() {
    if (!boardSize || !game) return;
    const { w, h, cell: s, x: ox, y: oy } = boardSize;
    ctx.clearRect(0, 0, w, h);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      round(ctx, ox + x * s + 1, oy + y * s + 1, s - 2, s - 2, 4, (x + y) % 2 ? '#172c4544' : '#18294325', '#9cc3e008');
      const type = game.board[y][x];
      if (type >= 0) {
        const matched = game.matches.includes(y * COLS + x);
        if (matched) { ctx.save(); ctx.shadowBlur = 15; ctx.shadowColor = PALETTE[type]; round(ctx, ox + x * s, oy + y * s, s, s, 7, PALETTE[type]); ctx.restore(); }
        face(ctx, type, ox + x * s + 2, oy + y * s + 2, s - 4, matched && !reduced ? .8 + Math.sin(game.time * 26) * .2 : 1);
      }
    }
    ctx.setLineDash([3, 4]); ctx.strokeStyle = '#f1a4b838'; ctx.beginPath(); ctx.moveTo(ox, oy + s); ctx.lineTo(ox + s * COLS, oy + s); ctx.stroke(); ctx.setLineDash([]);
    if (game.active) {
      const ghost = game.ghost();
      for (const c of game.cells(ghost)) if (c.y >= 0) { face(ctx, c.type, ox + c.x * s + 3, oy + c.y * s + 3, s - 6, .21); round(ctx, ox + c.x * s + 2, oy + c.y * s + 2, s - 4, s - 4, 6, null, '#9ef7e466'); }
      for (const c of game.cells()) if (c.y >= 0) { ctx.save(); ctx.shadowBlur = 11; ctx.shadowColor = '#adf8ec'; face(ctx, c.type, ox + c.x * s + 2, oy + c.y * s + 2, s - 4); ctx.restore(); round(ctx, ox + c.x * s + 1, oy + c.y * s + 1, s - 2, s - 2, 7, null, '#d7ffeecc'); }
    }
  }
  function castle(c, x, foot) {
    c.save(); c.translate(x, foot);
    c.shadowBlur = 9; c.shadowColor = '#75b6d966';
    round(c, -19, -53, 38, 53, 4, '#aacada');
    c.fillStyle = '#d2eced'; c.beginPath(); c.moveTo(-21, -42); c.lineTo(-20, -69); c.lineTo(-5, -57); c.lineTo(7, -57); c.lineTo(21, -69); c.lineTo(21, -42); c.closePath(); c.fill();
    c.shadowBlur = 0; c.fillStyle = '#102b46'; c.beginPath(); c.ellipse(-8, -47, 2, 3, 0, 0, Math.PI * 2); c.ellipse(9, -47, 2, 3, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#a57796'; c.beginPath(); c.moveTo(-2, -41); c.lineTo(5, -41); c.lineTo(1, -37); c.closePath(); c.fill();
    round(c, -8, -23, 16, 23, [8, 8, 0, 0], '#203d61');
    c.fillStyle = '#4f7d9f'; c.fillRect(-17, -20, 5, 8); c.fillRect(13, -20, 5, 8);
    if (game.shield > 0) { c.strokeStyle = '#95e1ffbb'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, -29, 29, 44, 0, Math.PI, Math.PI * 2); c.stroke(); }
    c.restore();
  }
  function drawBattle() {
    if (!battleSize || !game) return;
    const { w, h } = battleSize;
    const scale = w / 400, worldH = h / scale, groundY = worldH - 20;
    bctx.clearRect(0, 0, w, h); bctx.save(); bctx.scale(scale, scale);
    const gradient = bctx.createLinearGradient(0, 0, 0, worldH); gradient.addColorStop(0, '#152441'); gradient.addColorStop(.68, '#3e526e'); gradient.addColorStop(1, '#0f1f31'); bctx.fillStyle = gradient; bctx.fillRect(0, 0, 400, worldH);
    bctx.fillStyle = '#b1e3e927'; bctx.beginPath(); bctx.arc(315, Math.max(21, groundY * .25), 19, 0, Math.PI * 2); bctx.fill();
    for (let i = 0; i < 23; i++) {
      const x = i * 19 - 5, bh = 20 + ((i * 17) % 45); bctx.fillStyle = i % 3 ? '#172a47aa' : '#14293ddd'; bctx.fillRect(x, groundY - 11 - bh, 15, bh);
      for (let j = 0; j < 3; j++) { bctx.fillStyle = j % 2 ? '#8be1ff35' : '#ffd2e529'; bctx.fillRect(x + 4, groundY - 6 - bh + j * 9, 3, 4); }
    }
    bctx.fillStyle = '#142a3c'; bctx.fillRect(0, groundY, 400, 24); bctx.strokeStyle = '#8de7f16a'; bctx.beginPath(); bctx.moveTo(0, groundY); bctx.lineTo(400, groundY); bctx.stroke();
    bctx.strokeStyle = '#b0cbd611'; for (let i = 0; i < 400; i += 36) { bctx.beginPath(); bctx.moveTo(i, groundY + 1); bctx.lineTo(i - 17, worldH); bctx.stroke(); }
    castle(bctx, 372, groundY);
    const actors = [...game.enemies.map(e => ({ ...e, enemy: true })), ...game.units].sort((a,b) => a.x - b.x);
    for (const a of actors) {
      const size = Math.min(a.boss ? 62 : a.enemy ? 34 : 53, groundY - 24);
      const bounce = 0;
      bctx.save(); bctx.globalAlpha = .45; bctx.fillStyle = '#060e1b'; bctx.beginPath(); bctx.ellipse(a.x, groundY, size * .36, 3, 0, 0, Math.PI * 2); bctx.fill(); bctx.restore();
      // Every sprite uses its bottom centre as its origin. Canvas bounds are respected even at entry.
      const drawX = Math.max(size / 2 + 2, Math.min(398 - size / 2, a.x));
      bctx.save(); bctx.beginPath(); bctx.roundRect(drawX - size / 2, groundY - size + bounce, size, size, a.enemy ? 9 : 14); bctx.clip();
      imageRegion(bctx, a.enemy ? ENEMY[a.type] : UNIT[a.type], drawX - size / 2, groundY - size + bounce, size, size);
      bctx.restore();
      const by = groundY - size - 6 + bounce;
      round(bctx, drawX - size * .33, by, size * .66, 3, 2, '#0a1224');
      round(bctx, drawX - size * .33, by, size * .66 * Math.max(0, a.hp / a.maxHp), 3, 2, a.enemy ? '#ef8ab0' : PALETTE[a.type]);
      if (a.boss) { bctx.font = 'bold 7px system-ui'; bctx.textAlign = 'center'; bctx.fillStyle = '#ffd2eb'; bctx.fillText('BOSS', drawX, by - 4); }
    }
    for (const e of effects) {
      const alpha = Math.max(0, 1 - e.age / e.duration);
      bctx.save(); bctx.globalAlpha = alpha; bctx.lineWidth = 3;
      if (e.type === 'attack') { bctx.strokeStyle = PALETTE[e.cat]; bctx.shadowColor = PALETTE[e.cat]; bctx.shadowBlur = 9; bctx.beginPath(); if (e.cat === 3) bctx.arc(e.to, groundY - 26, 8 + e.age * 55, 0, Math.PI * 2); else { bctx.moveTo(e.x, groundY - 27); bctx.lineTo(e.to, groundY - 23); } bctx.stroke(); }
      if (e.type === 'heal') { bctx.font = 'bold 18px system-ui'; bctx.fillStyle = '#aeffd0'; bctx.textAlign = 'center'; bctx.fillText('+', e.x, groundY - 44 - e.age * 25); }
      if (e.type === 'defeat') { bctx.fillStyle = '#ffdec3'; for (let j = 0; j < 5; j++) { const t = j * 1.25; bctx.beginPath(); bctx.arc(e.x + Math.cos(t) * e.age * 35, groundY - 26 + Math.sin(t) * e.age * 35, 2, 0, Math.PI * 2); bctx.fill(); } }
      if (e.type === 'skill') { bctx.fillStyle = '#a1e4ff'; bctx.fillRect(0, 0, 400, worldH); }
      bctx.restore();
    }
    bctx.restore();
  }
  function render() { drawBoard(); drawBattle(); }
  function drawStatic() {
    document.querySelectorAll('[data-face]').forEach(el => face(el.getContext('2d'), Number(el.dataset.face), 0, 0, el.width));
    if ($('home-art').dataset.ready !== 'true' && atlas.complete && atlas.naturalWidth) { imageRegion($('home-art').getContext('2d'), [1065, 185, 470, 625], 0, 0, 864, 1100); $('home-art').dataset.ready = 'true'; }
    const p = $('portrait').getContext('2d'); imageRegion(p, [1086, 194, 365, 385], 0, 0, 180, 200);
    if (game) { const n = $('next').getContext('2d'); n.clearRect(0, 0, 160, 95); game.next.forEach((t,i) => face(n, t, 8 + i * 76, 12, 68)); }
  }
  function hud() {
    if (!game) return;
    $('score').textContent = game.score.toLocaleString('ja-JP'); $('wave').textContent = String(game.wave).padStart(2, '0');
    $('hp-text').textContent = `${Math.ceil(game.hp)} / ${MAX_HP}`; $('hp-bar').style.width = Math.max(0, game.hp / MAX_HP * 100) + '%';
    $('hp-bar').style.background = game.hp < 55 ? '#ef8c9d' : ''; $('shield-text').textContent = Math.floor(game.shield);
    $('sp-bar').style.width = game.sp + '%'; $('sp-text').textContent = `${Math.floor(game.sp)} / 100`;
    $('skill').disabled = paused || game.sp < 100 || game.phase !== 'playing' || game.resolveTimer > 0;
    $('skill-caption').textContent = game.sp >= 100 ? 'タップで発動' : 'SP 100で発動';
    $('max-chain').innerHTML = `${game.maxChain}<span>連鎖</span>`;
    $('chain').textContent = game.matches.length ? `${game.chain} CHAIN!` : '3匹そろえて出撃';
    $('enemy-count').textContent = `敵 ${game.spawned} / ${game.waveTotal}`;
    for (let t = 0; t < 4; t++) $('unit-' + t).classList.toggle('on', game.units.some(u => u.type === t));
    drawStatic();
  }
  function beep(kind) {
    if (!sound) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      const notes = { drop: [170], rotate: [340], match: [523, 659, 784], summon: [680], skill: [392, 523, 659, 1047], end: [523, 659, 784], hurt: [110] }[kind];
      if (!notes) return;
      notes.forEach((hz, i) => { const osc = audioContext.createOscillator(), gain = audioContext.createGain(), t = audioContext.currentTime + i * .07; osc.type = kind === 'hurt' ? 'triangle' : 'sine'; osc.frequency.value = hz; gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.045, t + .01); gain.gain.exponentialRampToValueAtTime(.001, t + .18); osc.connect(gain); gain.connect(audioContext.destination); osc.start(t); osc.stop(t + .2); });
    } catch { sound = false; syncSound(); }
  }
  function syncSound() { $('sound-state').textContent = sound ? 'ON' : 'OFF'; $('sound').setAttribute('aria-pressed', sound); $('sound').setAttribute('aria-label', `効果音を${sound ? 'オフ' : 'オン'}にする`); store(PREFS, { mode, sound }); }
  function events() {
    if (!game) return;
    const queue = game.events.splice(0);
    for (const e of queue) {
      if (['attack', 'heal', 'defeat', 'skill'].includes(e.type)) effects.push({ ...e, age: 0, duration: e.type === 'skill' ? .45 : .5 });
      beep(e.type);
      if (e.type === 'summon') { $('commander-line').textContent = [`三毛猫、攻撃をお願い！`, '白猫、みんなを回復して！', '黒猫、城を守って！', '茶トラ、まとめてお願い！'][e.cat]; }
      if (e.type === 'match' && e.chain > 1) toast(`${e.chain} CHAIN · 強化出撃！`);
      if (e.type === 'wave') toast(`WAVE ${e.wave} · ${e.wave === 5 ? '最終防衛線' : '敵が接近中'}`);
      if (e.type === 'waveClear') toast(`WAVE ${e.wave} CLEAR`);
      if (e.type === 'enemy' && e.boss) { toast('BOSS 接近！'); $('commander-line').textContent = '最後の敵だよ。みんな、力を合わせて！'; }
      if (e.type === 'skill') { toast('全員、出撃！'); $('commander-line').textContent = 'この街は、私たちが守る！'; }
      if (e.type === 'checkpoint') saveGame();
      if (e.type === 'end') { paused = true; stopHold(); saved = null; remove(SAVE); record(); showResult(); }
    }
    if (effects.length > 80) effects = effects.slice(-80);
  }
  function frame(t) {
    const dt = Math.min((t - (last || t)) / 1000, .1); last = t;
    if (game && !paused && game.phase === 'playing' && !$('game').hidden) {
      accumulator += dt;
      while (accumulator >= 1 / 60 && !paused) { game.tick(1 / 60); accumulator -= 1 / 60; events(); }
      for (const e of effects) e.age += dt;
      effects = effects.filter(e => e.age < e.duration);
      hudClock += dt; saveClock += dt;
      if (hudClock > .1) { hudClock = 0; hud(); }
      if (saveClock > 4) { saveClock = 0; saveGame(); }
    }
    if (!$('game').hidden) render();
    requestAnimationFrame(frame);
  }
  function action(type) {
    if (!game || paused || game.phase !== 'playing') return false;
    if ((type === 'drop' || type === 'skill') && performance.now() - actionLock < 170) return false;
    const methods = { left: () => game.move(-1), right: () => game.move(1), rotate: () => game.rotate(), drop: () => game.drop(), down: () => game.down(), skill: () => game.skill() };
    if (!methods[type]) return false;
    const result = methods[type]();
    if (type === 'drop' || type === 'skill') actionLock = performance.now();
    events(); hud(); render(); return result;
  }
  function stopHold() { clearTimeout(holdTimeout); clearInterval(repeatTimer); held = null; }
  document.querySelectorAll('[data-control]').forEach(button => {
    button.addEventListener('pointerdown', e => { e.preventDefault(); stopHold(); held = button.dataset.control; button.setPointerCapture(e.pointerId); action(held); if (held === 'left' || held === 'right') holdTimeout = setTimeout(() => { repeatTimer = setInterval(() => { if (held) action(held); }, 120); }, 290); });
    button.addEventListener('pointerup', stopHold); button.addEventListener('pointercancel', stopHold); button.addEventListener('lostpointercapture', stopHold);
    button.addEventListener('click', e => { if (e.detail === 0) action(button.dataset.control); });
  });
  let pointer = null;
  board.addEventListener('pointerdown', e => { if (paused || pointer) return; e.preventDefault(); board.setPointerCapture(e.pointerId); pointer = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
  board.addEventListener('pointerup', e => {
    if (!pointer || pointer.id !== e.pointerId) return;
    const start = pointer; pointer = null; if (paused) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.abs(dy) > 25 && Math.abs(dy) > Math.abs(dx)) action(dy > 0 ? 'drop' : 'rotate');
    else if (Math.abs(dx) > 25) action(dx > 0 ? 'right' : 'left');
    else if (boardSize) { const r = board.getBoundingClientRect(); const col = Math.floor((e.clientX - r.left - boardSize.x) / boardSize.cell); game.moveTo(col); render(); }
  });
  board.addEventListener('pointercancel', () => { pointer = null; });
  board.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', e => {
    if ($('game').hidden || $('modal').open) return;
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', x: 'rotate', X: 'rotate', ArrowDown: 'down', ' ': 'drop', s: 'skill', S: 'skill' };
    if (map[e.key]) { e.preventDefault(); if (e.repeat && ['rotate', 'drop', 'skill'].includes(map[e.key])) return; action(map[e.key]); }
    else if (['Escape', 'p', 'P'].includes(e.key)) { e.preventDefault(); showPause(); }
  });
  function closeModal(resume = true) {
    closingToPlay = resume; $('modal').close(); modalKind = '';
    if (resume && game && game.phase === 'playing' && !$('game').hidden) { paused = false; accumulator = 0; last = 0; hud(); }
  }
  function openModal(kind, title, body) {
    stopHold(); pointer = null; if (game && game.phase === 'playing') { paused = true; saveGame(); }
    closingToPlay = false; modalKind = kind;
    $('modal-content').innerHTML = `<div class="modal-eyebrow">CAT DROP GUARDIAN</div><h2 id="modal-title">${title}</h2>${body}`;
    if (!$('modal').open) $('modal').showModal();
    hud();
  }
  $('modal').addEventListener('cancel', e => { e.preventDefault(); if (modalKind === 'result') goHome(); else closeModal(true); });
  $('modal').addEventListener('close', () => { if (!closingToPlay && game && game.phase === 'playing') paused = true; });
  $('modal-content').addEventListener('click', e => {
    const a = e.target.closest('[data-action]')?.dataset.action;
    if (a === 'resume' || a === 'close') closeModal(true);
    if (a === 'home') goHome();
    if (a === 'retry') openModal('restart', '最初からやり直す？', '<p>いまの防衛を終了して、新しいゲームをはじめます。</p><button class="primary" data-action="confirm-retry">やり直す →</button><button class="secondary" data-action="resume">プレイに戻る</button>');
    if (a === 'confirm-retry') start(false);
    if (a === 'again') start(false);
    if (a === 'help') showHelp();
    if (a === 'share') share();
    if (a === 'download') download();
    if (a === 'art') openModal('art', 'CONCEPT ART', `<img src="${$('key-visual').src}" alt="提供されたゲーム画面の参考アート" style="display:block;width:100%;border-radius:10px"><button class="primary" data-action="help">遊び方に戻る</button>`);
  });
  function start(resume) {
    const candidate = resume ? Game.restore(saved || parse(SAVE)) : null;
    if (resume && !candidate) { saved = null; remove(SAVE); $('continue').hidden = true; notify('中断データを読み込めませんでした。新しくはじめられます。'); return; }
    closeModal(false); game = candidate || new Game(Date.now(), mode); mode = game.mode;
    paused = false; closingToPlay = true; effects = []; last = 0; accumulator = 0; saveClock = 0; actionLock = 0;
    $('home').hidden = true; $('game').hidden = false; $('commander-line').innerHTML = resume ? 'おかえり。<br>一緒に街を守ろう！' : 'まずは三毛猫を<br>左でそろえよう。';
    resize(); hud(); saveGame(); toast(resume ? '防衛を再開！' : `WAVE 1 · ${mode === 'relaxed' ? 'ゆっくり練習' : '防衛開始'}`);
  }
  function goHome() { saveGame(); record(); closeModal(false); paused = true; stopHold(); $('game').hidden = true; $('home').hidden = false; $('continue').hidden = !saved; selectMode(mode); }
  function showPause() {
    if (!game || game.phase !== 'playing') return;
    openModal('pause', 'ひと休みしよう。', '<p>パズルも戦闘も止まっています。<br>猫たちは、あなたの指示を待っています。</p><button class="primary" data-action="resume">防衛を再開 <b>→</b></button><button class="secondary" data-action="help">遊び方・猫の役割</button><div class="modal-foot"><button data-action="retry">やり直す</button><button data-action="home">タイトルへ</button></div><div class="modal-foot"><button data-action="download">HTMLを保存</button><button data-action="share">シェア ↗</button></div>');
  }
  function showHelp() {
    openModal('help', 'そろえて、出撃。', '<p>落ちてくる猫のペアを操作して、5回の襲撃から猫の城を守ろう。</p><ol class="help-steps"><li><b>同じ猫を、縦か横に3匹。</b>左右で移動、回転で並び方を変え、「落とす」で着地。薄く見える猫が着地点です。</li><li><b>そろった猫が、自動で戦う。</b>連鎖すると部隊が強化。同じ役割をそろえると、出撃中の猫を回復・強化できます。</li><li><b>SPが100になったら、全員出撃！</b>敵全体にダメージ＋城を回復。盤面の下2段も出撃させて、ピンチを切り抜けます。</li></ol><div class="role-grid"><div style="--c:#ff9fa1"><b>三毛猫 · 攻撃</b><span>目の前の敵を斬る</span></div><div style="--c:#a2edc2"><b>白猫 · 回復</b><span>仲間と城を回復</span></div><div style="--c:#a3caff"><b>黒猫 · シールド</b><span>城と前線を守る</span></div><div style="--c:#ffd191"><b>茶トラ · 範囲攻撃</b><span>固まった敵を爆破</span></div></div><p class="muted">列タップで移動／上スワイプで回転／下スワイプで落下。PCは←→・↑・Space。Escで停止。<br>城のHPが0、または出現位置まで猫が積み上がると防衛失敗。部隊は約42秒間出撃します。</p><button class="primary" data-action="close">わかった <b>→</b></button><div class="modal-foot"><button data-action="art">コンセプトアートを見る</button></div>');
  }
  function showResult() {
    const won = game.phase === 'won';
    openModal('result', won ? '猫の街を守り抜いた！' : 'もう一度、力を合わせよう。', `<p>${game.reason}<br>${won ? '司令官も猫たちも、あなたを誇りに思っています。' : '白猫で回復、黒猫で防御。次の一手が街の未来を変えます。'}</p><div class="result-score">${game.score.toLocaleString('ja-JP')}<small>${mode === 'relaxed' ? 'PRACTICE' : 'STANDARD'} · SCORE</small></div><div class="result-stats"><span><b>${game.wave}/5</b>ウェーブ</span><span><b>${game.maxChain}</b>最大連鎖</span><span><b>${game.kills}</b>敵撃破</span></div><button class="primary" data-action="again">もう一度遊ぶ <b>→</b></button><div class="modal-foot"><button data-action="home">タイトルへ</button><button data-action="share">結果をシェア ↗</button></div>`);
  }
  async function share() {
    const url = 'https://layetylor-efc.github.io/waru/cat-drop-guardian/';
    const text = game && game.phase !== 'playing' ? `CAT DROP GUARDIAN — ${game.score.toLocaleString('ja-JP')}点！猫の街を守ろう。` : 'そろえて、出撃。CAT DROP GUARDIANで猫の街を守ろう。';
    try { if (navigator.share) { await navigator.share({ title: 'CAT DROP GUARDIAN', text, url }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text + '\n' + url); notify('ゲームのURLをコピーしました。'); }
    catch { openModal('share', 'ゲームをシェア', `<p>このリンクを長押ししてコピーしてください。</p><a class="text-link" href="${url}">${url}</a><button class="primary" data-action="close">閉じる</button>`); }
  }
  function download() {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelector('#modal').removeAttribute('open'); clone.querySelector('#modal-content').innerHTML = '';
    clone.querySelector('#home').removeAttribute('hidden'); clone.querySelector('#game').setAttribute('hidden', '');
    clone.querySelectorAll('link[rel="manifest"],link[rel="icon"],link[rel="apple-touch-icon"]').forEach(el => el.remove());
    clone.querySelector('#notice').classList.remove('show'); clone.querySelector('#notice').textContent = '';
    clone.querySelector('#continue').setAttribute('hidden', ''); clone.querySelector('#home-art').removeAttribute('data-ready');
    const blob = new Blob(['<!doctype html>\n' + clone.outerHTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'CAT_DROP_GUARDIAN_v1.0.html'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); notify('HTMLを保存しました。ブラウザで開くと遊べます。');
  }
  $('start').onclick = () => start(false); $('continue').onclick = () => start(true);
  $('mode-normal').onclick = () => selectMode('normal'); $('mode-relaxed').onclick = () => selectMode('relaxed');
  $('home-help').onclick = showHelp; $('help-game').onclick = showHelp; $('pause').onclick = showPause; $('game-menu').onclick = showPause;
  $('skill').onclick = () => action('skill'); $('sound').onclick = () => { sound = !sound; syncSound(); if (sound) beep('match'); };
  $('share-home').onclick = share;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installedEvent = e; });
  $('install').onclick = async () => {
    if (installedEvent) { await installedEvent.prompt(); installedEvent = null; return; }
    openModal('install', 'ホーム画面からすぐ遊ぶ', '<p>Android：Chromeのメニューから「ホーム画面に追加」または「アプリをインストール」。<br><br>iPhone：Safariの共有メニューから「ホーム画面に追加」。</p><p class="muted">公開URLを一度オンラインで開いてください。HTMLファイルを直接開いた場合は、ブラウザでそのまま遊べます。</p><button class="primary" data-action="close">閉じる</button>');
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && game && !paused && game.phase === 'playing') showPause(); });
  window.addEventListener('blur', () => { stopHold(); if (game && !paused && game.phase === 'playing') showPause(); });
  window.addEventListener('pagehide', saveGame);
  new ResizeObserver(resize).observe($('game'));
  const loadedBest = parse(BEST); if (loadedBest) for (const m of ['normal', 'relaxed']) if (Number.isFinite(loadedBest[m]) && loadedBest[m] >= 0 && loadedBest[m] < 1e9) best[m] = Math.floor(loadedBest[m]);
  const prefs = parse(PREFS); if (prefs) { mode = prefs.mode === 'relaxed' ? 'relaxed' : 'normal'; sound = prefs.sound === true; }
  const rawSaved = parse(SAVE); if (Game.restore(rawSaved)) saved = rawSaved; else if (rawSaved) remove(SAVE);
  $('continue').hidden = !saved;
  $('unit-indicators').innerHTML = TYPES.map((t,i) => `<i id="unit-${i}" style="--cat-color:${t.color}" title="${t.name}"></i>`).join('');
  selectMode(mode); syncSound();
  if (atlas.complete) drawStatic(); else { atlas.addEventListener('load', () => { drawStatic(); render(); }); atlas.addEventListener('error', () => notify('画像を読み込めませんでした。再読み込みしてください。')); }
  requestAnimationFrame(frame);
  if ((location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {}));
  }
  // Test hooks are available only when explicitly requested by the local QA harness.
  if (new URLSearchParams(location.search).has('qa')) Object.defineProperty(window, '__catQA', { value: { get game() { return game; }, get paused() { return paused; }, start, action, render, hud, save: saveGame, events, setGame(g) { game = g; hud(); render(); }, layout() { return { board: boardSize, battle: battleSize }; } } });
})();
