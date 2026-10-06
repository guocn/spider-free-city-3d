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
import { shopId, TOWN_PALETTES } from '../town-life.js';

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
  let photoBlob = null, drawCount = 0;
  function listen(name, handler) {
    if (!listeners.has(name)) listeners.set(name, []);
    listeners.get(name).push(handler);
  }
  function dispatch(name) { for (const handler of listeners.get(name) || []) handler(); }
  const classes = { add() {}, remove() {}, toggle() {} };
  function element() {
    const node = { style: {}, dataset: {}, classList: classes, children: [],
      appendChild(child) { this.children.push(child); }, append() {}, replaceChildren() {},
      setAttribute() {}, addEventListener() {}, querySelector() { return element(); }, click() {},
      toBlob(callback) { callback(photoBlob); },
      getContext() { return { clearRect() {}, drawImage() { drawCount++; } }; } };
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
  global('innerWidth', 1280); global('innerHeight', 800);
  global('URL', { createObjectURL: () => 'blob:test', revokeObjectURL() {} });
  global('setTimeout', callback => { callback(); return 0; });
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
  doc.getElementById('journalButton').onclick();
  assert.equal(feature.active, 'journal');
  assert.equal(doc.getElementById('townQuestList').children.length, 3);
  assert.equal(doc.getElementById('collectionList').children.length, world.shops.length);
  feature.close();
  const postcard = sim.townLife.quests.find(q => q.id === 'postcard');
  postcard.stage = 'photo'; sim.p = { ...sim.townLife.lake };
  doc.getElementById('photoSave').onclick(); feature.tick(1 / 60, 0);
  assert.equal(drawCount, 0, 'capture waits until the render has finished');
  feature.afterRender();
  assert.equal(postcard.stage, 'photo', 'failed PNG encoding must not complete the quest');
  photoBlob = {}; doc.getElementById('photoSave').onclick(); feature.afterRender();
  assert.equal(postcard.stage, 'deliver');
  saved = JSON.parse(storage.get('spider-neon-adventure'));
  assert.equal(saved.town.quests.find(q => q.id === 'postcard').stage, 'deliver');
});

function townAdventure() {
  const sim = fresh();
  sim.applyOptions({ ...sim.options, citizens: true, events: true });
  return sim;
}
function talkTo(sim, quest) {
  sim.p = V(quest.giver.p.x, 1.6, quest.giver.p.z + 4);
  return sim.interactActivity();
}

for (const id of ['birthday', 'record']) test(`${id} quest requires acceptance, the right shop item and delivery`, () => {
  const sim = townAdventure(), life = sim.townLife, q = life.quests.find(q => q.id === id);
  life.onShopAction(q.targetShop, 0);
  assert.equal(q.stage, 'available', 'buying before accepting is not a completed step');
  sim.p = V(800, 1.6, 800);
  assert.equal(life.interact(), false);
  talkTo(sim, q);
  assert.equal(q.stage, 'pickup');
  assert.deepEqual(life.tracked, { kind: 'quest', id });
  assert.equal(life.navigationTarget().label, q.shop);
  sim.enterShop(q.targetShop);
  sim.shopAction(1);
  assert.equal(q.stage, 'pickup');
  sim.shopAction(0);
  assert.equal(q.stage, 'deliver');
  assert.ok(sim.inventory.has(q.item));
  assert.equal(life.navigationTarget().hint, '先离开店铺，再前往目标');
  sim.exitShop();
  assert.equal(life.navigationTarget().label, q.giverName + ' · ' + q.name);
  talkTo(sim, q);
  assert.equal(q.stage, 'done');
  assert.equal(sim.style, 180);
  assert.equal(life.tracked, null);
  assert.ok(life.applyPalette(id));
  assert.equal(sim.customSuitColor.length, 3);
  talkTo(sim, q);
  assert.equal(sim.style, 180, 'completed dialogue cannot repeat rewards');
});

test('postcard quest accepts a saved outdoor lake photo only once', () => {
  const sim = townAdventure(), life = sim.townLife, q = life.quests.find(q => q.id === 'postcard');
  assert.equal(life.onPhoto(life.lake), false);
  talkTo(sim, q);
  assert.equal(q.stage, 'photo');
  assert.equal(life.onPhoto(V(0, 1.6, 0)), false);
  assert.equal(life.onPhoto(life.lake, false), false);
  assert.equal(life.onPhoto(V(life.lake.x, 150, life.lake.z)), false);
  assert.equal(life.onPhoto(life.lake), true);
  assert.equal(life.onPhoto(life.lake), false);
  talkTo(sim, q);
  assert.equal(q.stage, 'done');
  assert.equal(sim.style, 180);
  assert.ok(life.paletteUnlocked('postcard'));
});

test('disabled citizens or events suspend quest interaction and navigation', () => {
  const sim = townAdventure(), q = sim.townLife.quests[0];
  sim.townLife.track('quest', q.id);
  sim.p = V(q.giver.p.x, 1.6, q.giver.p.z + 4);
  for (const key of ['citizens', 'events']) {
    sim.applyOptions({ ...sim.options, [key]: false });
    assert.equal(sim.townLife.interact(), false);
    assert.equal(sim.townLife.navigationTarget(), null);
    assert.equal(q.stage, 'available');
    sim.applyOptions({ ...sim.options, [key]: true });
  }
  assert.ok(sim.townLife.navigationTarget());
});

test('all shop cards are unique, require entry, and award each milestone once', () => {
  const sim = fresh(), life = sim.townLife;
  assert.equal(life.collectSouvenir(sim.world.shops[0]), false);
  for (const shop of sim.world.shops) {
    sim.enterShop(shop);
    assert.ok(life.collectSouvenir(shop));
    assert.equal(life.collectSouvenir(shop), false);
    sim.exitShop();
  }
  assert.equal(life.souvenirs.size, 67);
  assert.equal(sim.visited.size, 67);
  assert.equal(sim.style, 750);
  assert.deepEqual([...life.milestones], [3, 10, 67]);
  for (const id of ['cards3', 'cards10', 'cardsAll']) assert.ok(life.paletteUnlocked(id));
  assert.equal(life.applyPalette('birthday'), false);
  assert.equal(life.applyPalette('unknown'), false);
});

test('town progress restores partial stories, cards, palettes and tracking without reward duplication', () => {
  const sim = townAdventure(), life = sim.townLife;
  life.quests[0].stage = 'done'; life.quests[1].stage = 'deliver'; life.quests[2].stage = 'photo';
  for (const shop of sim.world.shops.slice(0, 3)) { sim.enterShop(shop); life.collectSouvenir(shop); sim.exitShop(); }
  life.track('quest', 'record');
  const saved = JSON.parse(JSON.stringify(snapshotProgress(sim, DEFAULT_KEYS))), restored = townAdventure();
  restoreProgress(restored, saved);
  assert.deepEqual(restored.townLife.snapshot(), life.snapshot());
  assert.equal(restored.style, 100);
  assert.ok(restored.townLife.paletteUnlocked('birthday'));
  assert.ok(restored.townLife.paletteUnlocked('cards3'));
  restored.enterShop(restored.world.shops[3]); restored.townLife.collectSouvenir(restored.world.shops[3]);
  assert.equal(restored.style, 100);
});

test('legacy and malformed town saves preserve safe defaults and cannot unlock invalid cosmetics', () => {
  const sim = townAdventure(), life = sim.townLife;
  for (const row of [undefined, null, [], 'town']) assert.doesNotThrow(() => life.restore(row));
  life.restore({ quests: [null, { id: 'birthday', stage: 'photo' }, { id: 'postcard', stage: 'pickup' }],
    souvenirs: [null, 'unknown', shopId(sim.world.shops[0]), shopId(sim.world.shops[0])], milestones: [3, 10, 67],
    tracked: { kind: 'event', id: 'unknown' } });
  assert.equal(life.souvenirs.size, 1);
  assert.equal(life.milestones.size, 0);
  assert.equal(life.tracked, null);
  assert.ok(life.quests.every(q => q.stage === 'available'));
  assert.ok(TOWN_PALETTES.every(p => !life.paletteUnlocked(p.id)));
});

test('navigation follows interior coordinates and gives race and escort priority', () => {
  const sim = townAdventure(), life = sim.townLife, shop = sim.world.shops[0];
  life.track('shop', shopId(shop));
  assert.deepEqual(life.navigationTarget().p, shop.door);
  sim.enterShop(shop);
  assert.deepEqual(life.navigationTarget().p, V(11, 1.6, -15));
  assert.deepEqual(life.navigationTarget().mapP, shop.door);
  sim.exitShop(); sim.enterShop(sim.world.shops[1]);
  assert.deepEqual(life.navigationTarget().p, V(0, 1.6, 24));
  sim.exitShop(); sim.startRace();
  assert.deepEqual(life.navigationTarget().p, sim.race.points[0]);
  assert.equal(life.tracked.kind, 'shop');
  sim.cancelRace(); sim.escort = { dest: V(44, 1.6, 77), destName: '护送终点' };
  assert.equal(life.navigationTarget().label, '护送终点');
  sim.escort = null;
  assert.equal(life.navigationTarget().label, shop.name);
});

test('completed events and found backpacks clear tracking while invalid targets are rejected', () => {
  const sim = townAdventure(), life = sim.townLife;
  assert.equal(life.track('unknown', 'x'), false);
  assert.equal(life.track('backpack', -1), false);
  assert.ok(life.track('event', sim.events[0].name));
  sim.events[0].state = 'done';
  assert.equal(life.navigationTarget(), null);
  assert.ok(life.track('backpack', 0));
  sim.backpacks[0].found = true;
  assert.equal(life.navigationTarget(), null);
  assert.equal(life.tracked, null);
});
