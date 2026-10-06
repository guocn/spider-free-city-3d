import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../world3d.js';
import { Adventure } from '../adventure.js';
import { V } from '../engine3d.js';
import { AchievementSystem } from '../achievements.js';
import { DEFAULT_KEYS } from '../settings-model.js';
import { snapshotProgress, restoreProgress } from '../progress.js';
import { PauseState } from '../pause-state.js';
import { installFeatures } from '../features.js';

const world = createWorld();
world.geometry.data = [];
const idle = { forward: 0, right: 0, jump: false, attack: false, climb: false };
function fresh() {
  const sim = new Adventure({ ...world, bosses: world.bosses.map(b => ({ ...b, p: { ...b.p } })) });
  sim.applyOptions({ ...sim.options, autoClimb: false, enemySpawn: false, bossChallenge: false, citizens: false });
  sim.achievements = new AchievementSystem(sim);
  return sim;
}
function projectile(p, damage = 12) {
  return { p: { ...p }, v: V(0, 0, 1), r: .4, life: 4, enemy: true, color: [1, 0, 0], damage };
}

test('a lethal volley clears all projectiles and subsequent frames keep running', () => {
  const sim = fresh();
  sim.p = V(0, 5, 0);
  sim.grounded = false;
  sim.hp = 1;
  sim.inv = 0;
  sim.shots = [projectile(V(100, 50, 100)), projectile(sim.p)];
  assert.doesNotThrow(() => sim.update(1 / 120, idle, 0));
  assert.equal(sim.hp, 100);
  assert.equal(sim.shots.length, 0);
  assert.ok(sim.inv > 0);
  assert.doesNotThrow(() => sim.update(1 / 120, idle, 0));
});

test('a nonlethal hit does not discard unrelated projectiles', () => {
  const sim = fresh();
  sim.p = V(0, 5, 0);
  sim.grounded = false;
  const other = projectile(V(100, 50, 100));
  sim.shots = [other, projectile(sim.p)];
  sim.update(1 / 120, idle, 0);
  assert.equal(sim.hp, 88);
  assert.deepEqual(sim.shots, [other]);
});

test('progress survives JSON serialization, including new and existing fields', () => {
  const sim = fresh();
  sim.character = 'miles';
  sim.difficulty = 'hard';
  sim.style = 850;
  sim.raceBest = 43.2;
  sim.raceGhost = { time: 43.2, samples: [[1, 2, 3], [4, 5, 6]] };
  sim.visited.add(world.shops[0].b.i + ',' + world.shops[0].b.j);
  sim.backpacks[1].found = true;
  sim.photos = new Set([0, 2]);
  sim.events[0].state = 'done';
  sim.events[0].progress = sim.events[0].need;
  sim.events[2].state = 'active';
  sim.events[2].progress = 1;
  sim.world.bosses[0].dead = true;
  sim.world.bosses[0].hp = 0;
  sim.world.bosses[1].hp = 100;
  sim.suitType = 3;
  sim.suit = { red: [.8, .2, .1], blue: [.1, .2, .3] };
  sim.inventory.add('城市明信片');
  sim.stats.websFired = 12;
  sim.achievements.unlocked.add('first-boss');
  const saved = JSON.parse(JSON.stringify(snapshotProgress(sim, DEFAULT_KEYS)));
  const restored = fresh();
  restoreProgress(restored, saved);
  restored.achievements.load(saved);
  for (const key of ['character', 'difficulty', 'style', 'raceBest', 'raceGhost', 'suitType', 'suit', 'stats']) {
    assert.deepEqual(restored[key], sim[key], key);
  }
  for (const key of ['visited', 'photos', 'inventory']) assert.deepEqual(restored[key], sim[key], key);
  assert.ok(restored.backpacks[1].found);
  assert.equal(restored.events[0].state, 'done');
  assert.equal(restored.events[2].progress, 1);
  assert.equal(restored.events[2].state, 'active');
  assert.equal(restored.world.bosses[0].dead, true);
  assert.equal(restored.world.bosses[0].hp, 0);
  assert.equal(restored.world.bosses[1].hp, 100);
  assert.ok(restored.achievements.unlocked.has('first-boss'));
  assert.equal(restored.achievements.checkAll().some(a => a.id === 'first-boss'), false);
});

test('old saves load without resetting their existing progress', () => {
  const sim = fresh();
  restoreProgress(sim, { character: 'gwen', style: 321, raceBest: 75,
    backpacks: [true], stats: { tricks: 5 }, raceGhost: { time: 75, samples: [[0, 20, 0]] } });
  assert.equal(sim.character, 'gwen');
  assert.equal(sim.style, 321);
  assert.equal(sim.raceBest, 75);
  assert.ok(sim.backpacks[0].found);
  assert.equal(sim.stats.tricks, 5);
  assert.equal(sim.suitType, 0);
  assert.equal(sim.photos.size, 0);
  assert.equal(sim.events[0].state, 'ready');
  assert.equal(sim.raceGhost.samples.length, 1);
});

test('malformed saved progress cannot poison physics or achievements', () => {
  const sim = fresh();
  for (const invalid of [null, [], 'text']) assert.doesNotThrow(() => restoreProgress(sim, invalid));
  restoreProgress(sim, { style: Infinity, raceBest: -1, photos: [0, 0, 9, -1, '1'],
    visited: ['unknown'], inventory: [null, '', '书签'], events: [null], bosses: [null],
    suitType: 3, suit: { red: [NaN, 0, 0], blue: [0, 0, 0] },
    stats: { maxSpeed: Infinity, tricks: -3 }, raceGhost: { time: Infinity, samples: [[0, 0, 0]] } });
  assert.equal(sim.style, 0);
  assert.equal(sim.raceBest, null);
  assert.deepEqual([...sim.photos], [0]);
  assert.equal(sim.visited.size, 0);
  assert.deepEqual([...sim.inventory], ['书签']);
  assert.equal(sim.suitType, 0);
  assert.equal(sim.stats.maxSpeed, 0);
  assert.equal(sim.stats.tricks, 0);
  assert.equal(sim.raceGhost, null);
});

test('unfinished combat restarts with enemies instead of completing for free', () => {
  const sim = fresh();
  restoreProgress(sim, { events: [{ name: sim.events[1].name, state: 'active', progress: 2 }] });
  assert.equal(sim.events[1].state, 'ready');
  sim.applyOptions({ ...sim.options, enemySpawn: true });
  sim.p = V(0, 1.6, 330);
  sim.update(1 / 120, idle, 0);
  assert.equal(sim.events[1].state, 'active');
  assert.equal(sim.enemies.filter(e => !e.dead).length, 3);
  assert.equal(sim.style, 0);
});

for (const [name, move] of [
  ['district teleport', s => s.teleport(1)],
  ['shop teleport', s => s.visitShop(0)],
  ['landmark or event teleport', s => s.travelTo(V(55, 1.6, 110))],
  ['shop entry', s => s.enterShop(s.world.shops[0])],
  ['respawn', s => s.respawn()],
  ['disabled race option', s => s.applyOptions({ ...s.options, race: false })]
]) test(`${name} cancels the race while retaining personal records`, () => {
  const sim = fresh();
  sim.raceBest = 100;
  sim.raceGhost = { time: 100, samples: [[0, 20, 0]] };
  const record = JSON.stringify(sim.raceGhost);
  sim.startRace();
  assert.ok(sim.race);
  move(sim);
  assert.equal(sim.race, null);
  assert.equal(sim.ghostPos, null);
  assert.equal(sim.raceGhostRec, null);
  assert.equal(sim.raceBest, 100);
  assert.equal(JSON.stringify(sim.raceGhost), record);
  assert.equal(sim.style, 0);
  assert.equal(sim.stats.raceWins, 0);
});

test('lethal damage during a race cancels it without stopping updates', () => {
  const sim = fresh();
  sim.startRace();
  sim.p = V(0, 5, 0);
  sim.grounded = false;
  sim.hp = 1;
  sim.inv = 0;
  sim.shots = [projectile(V(100, 50, 100)), projectile(sim.p)];
  assert.doesNotThrow(() => sim.update(1 / 120, idle, 0));
  assert.equal(sim.race, null);
  assert.equal(sim.hp, 100);
  assert.equal(sim.raceBest, null);
});

test('passing all checkpoints still awards a legitimate race result', () => {
  const sim = fresh();
  sim.startRace();
  const points = [...sim.race.points];
  for (const point of points) {
    sim.p = { ...point };
    sim.v = V();
    sim.grounded = false;
    sim.update(1 / 120, idle, 0);
  }
  assert.equal(sim.race, null);
  assert.ok(sim.raceBest > 0);
  assert.equal(sim.raceGhost.time, sim.raceBest);
  assert.equal(sim.style, 120);
});

for (const underlying of ['map', 'shop', 'pause']) test(`closing photo preserves the ${underlying} pause`, () => {
  const state = new PauseState();
  state.start();
  state.hold(underlying);
  state.hold('photo');
  state.release('photo');
  assert.equal(state.running, false);
  state.release(underlying);
  assert.equal(state.running, true);
});

test('a feature menu cannot start the game before the start button', () => {
  const state = new PauseState();
  state.hold('settings');
  state.release('settings');
  assert.equal(state.running, false);
  state.hold('map');
  state.start();
  assert.equal(state.running, false);
});

test('feature callbacks release only their own menu and lifecycle events save progress', t => {
  const originals = new Map();
  function global(key, value) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  t.after(() => { for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  } });
  const elements = new Map(), listeners = new Map(), storage = new Map();
  function listen(name, handler) {
    if (!listeners.has(name)) listeners.set(name, []);
    listeners.get(name).push(handler);
  }
  function dispatch(name) { for (const handler of listeners.get(name) || []) handler(); }
  const classes = { add() {}, remove() {}, toggle() {} };
  function element() {
    const node = { style: {}, dataset: {}, classList: classes, children: [],
      appendChild(child) { this.children.push(child); }, append() {}, replaceChildren() {},
      setAttribute() {}, addEventListener() {}, querySelector() { return element(); },
      getContext() { return { clearRect() {} }; } };
    Object.defineProperty(node, 'id', { set(value) { elements.set(value, node); } });
    return node;
  }
  const doc = { hidden: false, body: { classList: classes }, createElement: element,
    querySelectorAll() { return []; },
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    addEventListener: listen };
  global('document', doc);
  global('addEventListener', listen);
  global('localStorage', { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) });
  const sim = fresh(), state = new PauseState();
  state.start();
  state.hold('map');
  const feature = installFeatures(sim, element(), {
    toast() {}, photo() {}, skill() {}, resetCamera() {},
    freeze(name) { state.hold(name); }, resume(name) { state.release(name); }
  });
  doc.getElementById('photoButton').onclick();
  assert.equal(feature.active, 'photo');
  feature.close();
  assert.equal(state.running, false);
  assert.ok(state.has('map'));
  sim.photos.add(2);
  sim.inventory.add('城市明信片');
  dispatch('pagehide');
  let saved = JSON.parse(storage.get('spider-neon-adventure'));
  assert.deepEqual(saved.photos, [2]);
  assert.deepEqual(saved.inventory, ['城市明信片']);
  sim.events[0].state = 'done';
  doc.hidden = true;
  dispatch('visibilitychange');
  saved = JSON.parse(storage.get('spider-neon-adventure'));
  assert.equal(saved.events[0].state, 'done');
});
