// Persistent progress is separate from transient physics and open menus.
export function snapshotProgress(sim, keys) {
  return {
    version: 1,
    character: sim.character,
    difficulty: sim.difficulty,
    style: sim.style,
    raceBest: sim.raceBest,
    raceGhost: sim.raceGhost || null,
    visited: [...sim.visited],
    backpacks: sim.backpacks.map(b => b.found),
    photos: [...sim.photos],
    events: sim.events.map(e => ({ name: e.name, state: e.state, progress: e.progress })),
    bosses: sim.world.bosses.map(b => ({ type: b.type, hp: b.hp, dead: b.dead })),
    suitType: sim.suitType,
    suit: sim.suit,
    inventory: [...sim.inventory],
    keys: { ...keys },
    achievements: [...sim.achievements.unlocked],
    stats: { ...sim.stats }
  };
}

const validColor = c => Array.isArray(c) && c.length === 3 &&
  c.every(n => Number.isFinite(n) && n >= 0 && n <= 3);

export function restoreProgress(sim, saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;
  if (['peter', 'gwen', 'miles'].includes(saved.character)) sim.character = saved.character;
  if (['easy', 'normal', 'hard'].includes(saved.difficulty)) sim.difficulty = saved.difficulty;
  if (Number.isFinite(saved.style)) sim.style = Math.max(0, Math.min(100000, saved.style));
  if (Number.isFinite(saved.raceBest) && saved.raceBest > 0) sim.raceBest = saved.raceBest;
  if (Array.isArray(saved.visited)) {
    const shops = new Set(sim.world.shops.map(s => s.b.i + ',' + s.b.j));
    sim.visited = new Set(saved.visited.filter(id => shops.has(id)));
  }
  if (Array.isArray(saved.backpacks)) sim.backpacks.forEach((b, i) => {
    b.found = saved.backpacks[i] === true;
  });
  if (Array.isArray(saved.photos)) sim.photos = new Set(saved.photos.filter(id =>
    Number.isInteger(id) && id >= 0 && id < sim.world.districts.length));
  if (Array.isArray(saved.inventory)) sim.inventory = new Set(saved.inventory.filter(item =>
    typeof item === 'string' && item.length > 0));
  if (Array.isArray(saved.events)) for (const event of sim.events) {
    const row = saved.events.find(e => e && e.name === event.name);
    if (!row) continue;
    if (row.state === 'done') {
      event.state = 'done';
      event.progress = event.need;
    } else if (['rescue', 'fire', 'conflict'].includes(event.kind) &&
               Number.isFinite(row.progress)) {
      event.progress = Math.max(0, Math.min(event.need, Math.floor(row.progress)));
      event.state = event.progress >= event.need ? 'done' : event.progress > 0 ? 'active' : 'ready';
    }
    // Unfinished combat starts ready: its transient enemies are not in the save.
  }
  if (Array.isArray(saved.bosses)) for (const boss of sim.world.bosses) {
    const row = saved.bosses.find(b => b && b.type === boss.type);
    if (!row) continue;
    if (typeof row.dead === 'boolean') boss.dead = row.dead;
    if (boss.dead) boss.hp = 0;
    else if (Number.isFinite(row.hp)) boss.hp = Math.max(1, Math.min(boss.max, row.hp));
  }
  if (Number.isInteger(saved.suitType) && saved.suitType >= 0 && saved.suitType <= 5 &&
      (saved.suit === null || validColor(saved.suit?.red) && validColor(saved.suit?.blue))) {
    sim.suitType = saved.suitType;
    sim.suit = saved.suit === null ? null : {
      red: [...saved.suit.red], blue: [...saved.suit.blue]
    };
  }
  if (saved.stats && typeof saved.stats === 'object') for (const key in sim.stats) {
    if (Number.isFinite(saved.stats[key]) && saved.stats[key] >= 0) sim.stats[key] = saved.stats[key];
  }
  const ghost = saved.raceGhost;
  if (ghost && Number.isFinite(ghost.time) && ghost.time > 0 && Array.isArray(ghost.samples)) {
    const samples = ghost.samples.filter(a =>
      Array.isArray(a) && a.length === 3 && a.every(Number.isFinite)).slice(0, 3000);
    if (samples.length) sim.raceGhost = { time: ghost.time, samples };
  }
}
