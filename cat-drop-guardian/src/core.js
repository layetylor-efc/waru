(function (root) {
  'use strict';
  const COLS = 6, ROWS = 8, MAX_HP = 200;
  const TYPES = [
    { name: '三毛猫', role: '攻撃', color: '#ff8b92', hp: 50, damage: 18, interval: 0.85 },
    { name: '白猫', role: '回復', color: '#8ef4bc', hp: 40, damage: 4, interval: 1.6 },
    { name: '黒猫', role: 'シールド', color: '#8ab9ff', hp: 100, damage: 8, interval: 1.1 },
    { name: '茶トラ', role: '範囲攻撃', color: '#ffc37b', hp: 45, damage: 14, interval: 1.35 }
  ];
  const OFFSETS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const finite = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
  function findMatches(board) {
    const cells = new Set();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const type = board[y][x];
      if (type < 0) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const run = [];
        let cx = x, cy = y;
        while (cx < COLS && cy < ROWS && board[cy][cx] === type) { run.push(cy * COLS + cx); cx += dx; cy += dy; }
        if (run.length >= 3) run.forEach(c => cells.add(c));
      }
    }
    return [...cells];
  }
  function collapse(board) {
    for (let x = 0; x < COLS; x++) {
      const column = board.map(row => row[x]).filter(v => v >= 0);
      for (let y = ROWS - 1; y >= 0; y--) board[y][x] = column.length ? column.pop() : -1;
    }
  }
  class Game {
    constructor(seed = Date.now(), mode = 'normal') {
      this.version = 1; this.seed = seed >>> 0 || 7; this.mode = mode === 'relaxed' ? 'relaxed' : 'normal';
      this.board = emptyBoard();
      this.board[7] = [0, 0, 1, 1, 2, 2];
      this.board[6] = [0, -1, -1, -1, -1, 3];
      this.active = null; this.next = [0, 3]; this.queue = []; this.bag = [];
      this.phase = 'playing'; this.hp = MAX_HP; this.shield = 0; this.sp = 0;
      this.score = 0; this.chain = 0; this.maxChain = 0; this.matched = 0; this.kills = 0;
      this.wave = 1; this.spawned = 0; this.waveTotal = 5; this.spawnTimer = 6;
      this.waveBreak = 0; this.time = 0; this.fallTimer = 0;
      this.resolveTimer = 0; this.matches = []; this.enemies = []; this.units = [];
      this.events = []; this.id = 0; this.dropCount = 0; this.skillCount = 0;
      this.spawnPiece();
    }
    random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
    cat() {
      if (!this.bag.length) {
        this.bag = [0, 0, 1, 1, 2, 2, 3, 3];
        for (let i = this.bag.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]; }
      }
      return this.bag.pop();
    }
    emit(type, data = {}) { this.events.push({ type, ...data }); if (this.events.length > 80) this.events.shift(); }
    cells(piece = this.active) {
      if (!piece) return [];
      const [dx, dy] = OFFSETS[piece.rot];
      return [{ x: piece.x, y: piece.y, type: piece.cats[0] }, { x: piece.x + dx, y: piece.y + dy, type: piece.cats[1] }];
    }
    fits(piece) { return this.cells(piece).every(c => c.x >= 0 && c.x < COLS && c.y >= -1 && c.y < ROWS && (c.y < 0 || this.board[c.y][c.x] < 0)); }
    spawnPiece() {
      if (this.phase !== 'playing') return;
      this.active = { x: 2, y: 1, rot: 0, cats: this.next.slice() };
      this.next = [this.cat(), this.cat()]; this.fallTimer = 0; this.chain = 0;
      if (!this.fits(this.active)) this.finish(false, '猫チップが天井に届きました');
    }
    move(dx) {
      if (!this.active || this.phase !== 'playing') return false;
      const p = { ...this.active, x: this.active.x + dx };
      if (!this.fits(p)) return false;
      this.active = p; return true;
    }
    moveTo(x) {
      if (!Number.isInteger(x) || x < 0 || x >= COLS || !this.active) return false;
      let moved = false;
      while (this.active.x !== x) { if (!this.move(Math.sign(x - this.active.x))) break; moved = true; }
      return moved;
    }
    rotate() {
      if (!this.active || this.phase !== 'playing') return false;
      for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1]]) {
        const p = { ...this.active, x: this.active.x + dx, y: this.active.y + dy, rot: (this.active.rot + 1) % 4 };
        if (this.fits(p)) { this.active = p; this.emit('rotate'); return true; }
      }
      return false;
    }
    ghost() {
      if (!this.active) return null;
      const p = { ...this.active };
      while (this.fits({ ...p, y: p.y + 1 })) p.y++;
      return p;
    }
    down() {
      if (!this.active || this.phase !== 'playing') return false;
      if (this.fits({ ...this.active, y: this.active.y + 1 })) { this.active.y++; return true; }
      this.lock(); return false;
    }
    drop() {
      if (!this.active || this.phase !== 'playing') return false;
      this.active = this.ghost(); this.lock(); this.emit('drop'); return true;
    }
    lock() {
      const cells = this.cells();
      if (cells.some(c => c.y < 0)) { this.finish(false, '猫チップが天井に届きました'); return; }
      cells.forEach(c => { this.board[c.y][c.x] = c.type; });
      this.active = null; this.dropCount++; collapse(this.board);
      this.chain = 0; this.checkMatches(); this.emit('checkpoint');
    }
    checkMatches() {
      this.matches = findMatches(this.board);
      if (this.matches.length) {
        this.chain++; this.maxChain = Math.max(this.maxChain, this.chain); this.resolveTimer = 0.36;
        this.emit('match', { cells: this.matches.slice(), chain: this.chain });
      } else { this.resolveTimer = 0; this.spawnPiece(); }
    }
    resolveMatches() {
      const counts = [0, 0, 0, 0];
      this.matches.forEach(i => { const y = Math.floor(i / COLS), x = i % COLS; counts[this.board[y][x]]++; this.board[y][x] = -1; });
      const n = this.matches.length;
      this.score += n * 100 * this.chain; this.matched += n; this.sp = Math.min(100, this.sp + n * 5 + (this.chain - 1) * 8);
      counts.forEach((n, type) => { if (n) this.summon(type, n, this.chain); });
      this.matches = []; collapse(this.board); this.checkMatches(); this.emit('checkpoint');
    }
    summon(type, count = 3, chain = 1) {
      const power = Math.min(2.5, 1 + Math.max(0, count - 3) * 0.2 + (chain - 1) * 0.25);
      const existing = this.units.find(u => u.type === type && u.hp > 0);
      if (existing) { existing.hp = Math.min(existing.maxHp, existing.hp + TYPES[type].hp * 0.65); existing.life = 42; existing.power = Math.min(3, Math.max(power, existing.power + 0.12)); }
      else this.units.push({ id: ++this.id, type, x: 320, hp: TYPES[type].hp * power, maxHp: TYPES[type].hp * power, power, life: 42, cooldown: 0.4, frame: 0 });
      if (type === 1) this.hp = Math.min(MAX_HP, this.hp + Math.round(18 * power));
      if (type === 2) this.shield = Math.min(100, this.shield + Math.round(25 * power));
      this.emit('summon', { cat: type, power });
    }
    skill() {
      if (this.phase !== 'playing' || this.sp < 100 || this.resolveTimer > 0) return false;
      this.sp = 0; this.skillCount++; this.hp = Math.min(MAX_HP, this.hp + 30);
      this.enemies.forEach(e => { e.hp -= 65; }); this.collectDefeated();
      const counts = [0, 0, 0, 0];
      for (let y = ROWS - 2; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (this.board[y][x] >= 0) { counts[this.board[y][x]]++; this.board[y][x] = -1; }
      counts.forEach((n, type) => { if (n) this.summon(type, Math.max(3, n), 1); });
      collapse(this.board); this.score += 300; this.emit('skill'); this.emit('checkpoint');
      return true;
    }
    spawnEnemy() {
      const boss = this.wave === 5 && this.spawned === this.waveTotal - 1;
      const type = boss ? 1 : (this.wave < 2 ? 0 : Math.floor(this.random() * Math.min(4, this.wave)));
      const easy = this.mode === 'relaxed' ? 0.7 : 1;
      const hp = (boss ? 290 : 32 + this.wave * 7 + (type === 1 ? 24 : 0)) * easy;
      this.enemies.push({ id: ++this.id, type, boss, x: 25, hp, maxHp: hp, speed: boss ? 7 : (type === 2 ? 17 : 10 + this.wave * 0.7), damage: (boss ? 16 : 4 + this.wave) * easy, cooldown: 1, revived: false });
      this.spawned++; this.emit('enemy', { boss });
    }
    collectDefeated() {
      for (const e of this.enemies) if (e.hp <= 0 && e.type === 3 && !e.revived && !e.boss) { e.hp = e.maxHp * 0.35; e.revived = true; this.emit('revive', { x: e.x }); }
      const dead = this.enemies.filter(e => e.hp <= 0);
      dead.forEach(e => { this.kills++; this.score += e.boss ? 1800 : 150; this.emit('defeat', { x: e.x, boss: e.boss }); });
      this.enemies = this.enemies.filter(e => e.hp > 0);
    }
    hurtCastle(damage) {
      const absorbed = Math.min(this.shield, damage); this.shield -= absorbed; this.hp = Math.max(0, this.hp - (damage - absorbed)); this.emit('hurt');
      if (this.hp <= 0) this.finish(false, '猫の城のHPがなくなりました');
    }
    combat(dt) {
      for (const u of this.units) {
        u.life -= dt; u.cooldown = Math.max(0, u.cooldown - dt); u.frame += dt;
        if (u.hp <= 0 || u.life <= 0) continue;
        const target = this.enemies.filter(e => e.hp > 0).sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
        if (u.type === 1) {
          if (u.cooldown <= 0) {
            this.hp = Math.min(MAX_HP, this.hp + 3 * u.power);
            this.units.forEach(a => { if (a.hp > 0) a.hp = Math.min(a.maxHp, a.hp + 6 * u.power); });
            u.cooldown = 2.6; this.emit('heal', { x: u.x });
          }
          u.x += Math.sign(290 - u.x) * Math.min(Math.abs(290 - u.x), dt * 15);
        } else if (target) {
          const range = u.type === 3 ? 110 : 39;
          if (Math.abs(target.x - u.x) > range) u.x += Math.sign(target.x - u.x) * dt * 26;
          else if (u.cooldown <= 0) {
            const victims = u.type === 3 ? this.enemies.filter(e => Math.abs(e.x - target.x) <= 65) : [target];
            victims.forEach(e => { e.hp -= TYPES[u.type].damage * u.power * (e.type === 1 ? 0.8 : 1); });
            u.cooldown = TYPES[u.type].interval; this.emit('attack', { x: u.x, to: target.x, cat: u.type });
            if (u.type === 2) this.shield = Math.min(100, this.shield + 2 * u.power);
          }
        } else u.x += Math.sign(240 + u.type * 15 - u.x) * Math.min(Math.abs(240 + u.type * 15 - u.x), dt * 15);
        u.x = Math.max(36, Math.min(320, u.x));
      }
      this.collectDefeated();
      for (const e of this.enemies) {
        e.cooldown = Math.max(0, e.cooldown - dt);
        const target = this.units.filter(u => u.hp > 0 && u.life > 0 && Math.abs(u.x - e.x) < 38).sort((a, b) => (b.type === 2) - (a.type === 2))[0];
        if (target) {
          if (e.cooldown <= 0) { target.hp -= e.damage; e.cooldown = 1.3; this.emit('enemyAttack', { x: target.x }); }
        } else if (e.x < 341) e.x = Math.min(341, e.x + e.speed * dt);
        else if (e.cooldown <= 0) { this.hurtCastle(e.damage); e.cooldown = 1.4; }
      }
      this.units = this.units.filter(u => u.hp > 0 && u.life > 0);
    }
    tick(dt) {
      if (this.phase !== 'playing' || !finite(dt, 0, 0.1)) return;
      this.time += dt;
      if (this.resolveTimer > 0) { this.resolveTimer -= dt; if (this.resolveTimer <= 0) this.resolveMatches(); }
      else if (this.active) {
        this.fallTimer += dt;
        const interval = this.mode === 'relaxed' ? 1.55 : Math.max(0.57, 1.16 - this.wave * 0.09);
        if (this.fallTimer >= interval) { this.fallTimer = 0; this.down(); }
      }
      if (this.phase !== 'playing') return;
      this.combat(dt);
      if (this.phase !== 'playing') return;
      if (this.spawned < this.waveTotal) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) { this.spawnEnemy(); this.spawnTimer = Math.max(3.3, 6.1 - this.wave * 0.45); }
      } else if (!this.enemies.length) {
        if (!this.waveBreak) { this.waveBreak = 3; this.emit('waveClear', { wave: this.wave }); this.score += 500; }
        this.waveBreak -= dt;
        if (this.waveBreak <= 0) {
          if (this.wave === 5) this.finish(true, 'すべての猫を守り抜きました');
          else { this.wave++; this.waveTotal = this.wave === 5 ? 8 : 3 + this.wave * 2; this.spawned = 0; this.spawnTimer = 2; this.waveBreak = 0; this.hp = Math.min(MAX_HP, this.hp + 12); this.emit('wave', { wave: this.wave }); }
        }
      }
    }
    finish(won, reason) {
      if (this.phase !== 'playing') return;
      this.phase = won ? 'won' : 'lost'; this.reason = reason; this.active = null;
      this.emit('end', { won, reason });
    }
    serialize() { const value = { ...this }; delete value.events; return JSON.parse(JSON.stringify(value)); }
    static restore(s) {
      try {
        if (!s || s.version !== 1 || s.phase !== 'playing' || !['normal', 'relaxed'].includes(s.mode)) return null;
        if (!Array.isArray(s.board) || s.board.length !== ROWS || s.board.some(r => !Array.isArray(r) || r.length !== COLS || r.some(v => !Number.isInteger(v) || v < -1 || v > 3))) return null;
        for (const [key, lo, hi] of [['hp', 0.01, MAX_HP], ['shield', 0, 100], ['sp', 0, 100], ['score', 0, 1e9], ['wave', 1, 5], ['spawned', 0, 20], ['waveTotal', 1, 20], ['time', 0, 1e7], ['seed', 0, 4294967295], ['id', 0, 1e8], ['spawnTimer', -1, 10], ['waveBreak', -0.1, 3], ['fallTimer', 0, 2], ['resolveTimer', -0.1, 1], ['chain', 0, 30], ['maxChain', 0, 30], ['matched', 0, 1e7], ['kills', 0, 200], ['dropCount', 0, 1e6], ['skillCount', 0, 1e6]]) if (!finite(s[key], lo, hi)) return null;
        for (const key of ['wave', 'spawned', 'waveTotal', 'seed', 'id', 'chain', 'maxChain', 'matched', 'kills', 'dropCount', 'skillCount']) if (!Number.isInteger(s[key])) return null;
        if (s.spawned > s.waveTotal || s.waveTotal !== (s.wave === 1 ? 5 : s.wave === 5 ? 8 : 3 + s.wave * 2)) return null;
        for (const key of ['next', 'bag']) if (!Array.isArray(s[key]) || s[key].length > 8 || s[key].some(v => !Number.isInteger(v) || v < 0 || v > 3)) return null;
        if (s.next.length !== 2 || !Array.isArray(s.matches) || s.matches.some(v => !Number.isInteger(v) || v < 0 || v >= ROWS * COLS || s.board[Math.floor(v / COLS)][v % COLS] < 0)) return null;
        if (s.matches.length > 48 || new Set(s.matches).size !== s.matches.length || (s.resolveTimer > 0) !== (s.matches.length > 0)) return null;
        if (!Array.isArray(s.enemies) || s.enemies.length > 20 || !Array.isArray(s.units) || s.units.length > 4) return null;
        if (s.units.some(u => !Number.isInteger(u.type) || u.type < 0 || u.type > 3 || !finite(u.x, 36, 320) || !finite(u.hp, 0.01, 400) || !finite(u.maxHp, 1, 400) || u.hp > u.maxHp || !finite(u.power, 1, 3) || !finite(u.cooldown, -100, 3) || !finite(u.life, 0, 42) || !finite(u.frame, 0, 1e7))) return null;
        if (s.enemies.some(e => !Number.isInteger(e.type) || e.type < 0 || e.type > 3 || !finite(e.x, 25, 341) || !finite(e.hp, 0.01, 300) || !finite(e.maxHp, 1, 300) || e.hp > e.maxHp || !finite(e.speed, 1, 30) || !finite(e.damage, 1, 20) || !finite(e.cooldown, -100, 3) || typeof e.boss !== 'boolean' || typeof e.revived !== 'boolean')) return null;
        const game = new Game(1, s.mode);
        const allowed = Object.keys(game).filter(k => k !== 'events');
        for (const key of allowed) if (key in s) game[key] = JSON.parse(JSON.stringify(s[key]));
        game.events = [];
        if (game.active) {
          const p = game.active;
          if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || !Number.isInteger(p.rot) || p.rot < 0 || p.rot > 3 || !Array.isArray(p.cats) || p.cats.length !== 2 || p.cats.some(v => !Number.isInteger(v) || v < 0 || v > 3) || !game.fits(p)) return null;
        } else if (!game.matches.length) return null;
        return game;
      } catch { return null; }
    }
  }
  const api = { Game, TYPES, COLS, ROWS, MAX_HP, findMatches, collapse, emptyBoard };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CatDrop = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
