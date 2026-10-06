import { V, add, sub, length, color } from './engine3d.js?v=20261006town';

export const shopId = shop => shop.b.i + ',' + shop.b.j;
export const TOWN_PALETTES = [
  { id: 'birthday', name: '邻里珊瑚', hex: '#ed897b', source: '完成生日花束委托' },
  { id: 'record', name: '唱片天蓝', hex: '#72b8d9', source: '完成旧唱片委托' },
  { id: 'postcard', name: '湖畔珍珠', hex: '#c6ddd2', source: '完成湖畔明信片委托' },
  { id: 'cards3', name: '薄荷绿', hex: '#78c4a4', source: '收藏 3 张纪念卡' },
  { id: 'cards10', name: '落日橙', hex: '#efa365', source: '收藏 10 张纪念卡' },
  { id: 'cardsAll', name: '小镇鎏金', hex: '#d6bd77', source: '收藏全部店铺纪念卡' }
];

// Authored town stories use stable IDs; physics, NPC positions and menus are transient.
export class TownLife {
  constructor(sim) {
    this.sim = sim;
    this.souvenirs = new Set();
    this.milestones = new Set();
    this.tracked = null;
    const definitions = [
      { id: 'birthday', name: '一束生日花', giverName: '阿杰', giverShop: '星环便利店', shop: '满天星花房', item: '小花束',
        story: '阿杰想给奶奶一个生日惊喜，请你帮忙取一束花。', thanks: '奶奶一定会喜欢！谢谢你把这个小惊喜带回来。' },
      { id: 'record', name: '找回旧日旋律', giverName: '卢卡', giverShop: '河岸汉堡店', shop: '晚风唱片行', item: '爵士唱片',
        story: '卢卡想在店里的聚会上播放老爵士，唱片行刚好有货。', thanks: '就是这段旋律！下次路过，来听我们的街坊音乐会吧。' },
      { id: 'postcard', name: '寄往远方的湖光', giverName: '小林', giverShop: '织光服装店', photo: true,
        story: '小林想给远方的朋友寄一张湖畔明信片，请你拍下湖边风景。', thanks: '湖光真漂亮，朋友一定能从照片里感受到小镇的温柔。' }
    ];
    this.quests = definitions.map(def => {
      const index = sim.world.shops.findIndex(s => s.name === def.giverShop);
      const giver = sim.civilians[index * 2];
      giver.name = def.giverName;
      giver.questId = def.id;
      giver.line = def.story;
      return { ...def, giver, targetShop: sim.world.shops.find(s => s.name === def.shop), stage: 'available' };
    });
    this.lake = sim.world.places.find(p => p.name === '湖畔观景园').p;
  }

  get questsEnabled() { return this.sim.options.citizens && this.sim.options.events; }

  nearbyGiver() {
    if (this.sim.interior || !this.questsEnabled) return null;
    return this.quests.find(q => length(sub(add(q.giver.p, V(0, 1.6, 0)), this.sim.p)) < 7)?.giver || null;
  }

  interact() {
    const giver = this.nearbyGiver();
    if (!giver) return false;
    const q = this.quests.find(q => q.id === giver.questId);
    giver.react = 5;
    this.sim.stats.citizenTalks++;
    if (q.stage === 'available') {
      q.stage = q.photo ? 'photo' : 'pickup';
      this.track('quest', q.id);
      this.sim.notify(q.giverName + '：' + q.story + ' · 已接下委托，导航已更新。');
    } else if (q.stage === 'deliver') {
      q.stage = 'done';
      if (this.tracked?.kind === 'quest' && this.tracked.id === q.id) this.clearTracking();
      this.sim.reward(180, '完成委托：' + q.name);
      this.sim.notify(q.giverName + '：' + q.thanks + ' · 解锁「' + TOWN_PALETTES.find(p => p.id === q.id).name + '」配色。');
    } else this.sim.notify(q.giverName + '：' + (q.stage === 'done' ? q.thanks : q.photo ? '到湖畔观景园开启拍照模式，保存一张湖边照片，再回来找我。' : '去' + q.shop + '领取「' + q.item + '」，再回来找我。'));
    return true;
  }

  onShopAction(shop, action) {
    for (const q of this.quests) if (q.stage === 'pickup' && q.targetShop === shop && shop.menu?.[action] === q.item) {
      q.stage = 'deliver';
      this.sim.notify('已为' + q.giverName + '取到' + q.item + ' · 回到居民身边按互动交付。');
    }
  }

  onPhoto(position, outside = true) {
    if (!outside || length(sub(position, this.lake)) > 65) return false;
    const q = this.quests.find(q => q.id === 'postcard');
    if (q.stage !== 'photo') return false;
    q.stage = 'deliver';
    this.sim.notify('湖畔照片已收进明信片 · 回去交给小林吧。');
    return true;
  }

  collectSouvenir(shop) {
    if (this.sim.interior?.shop !== shop) return false;
    const id = shopId(shop);
    if (this.souvenirs.has(id)) return false;
    this.souvenirs.add(id);
    this.sim.inventory.add(shop.name + '纪念卡');
    this.sim.notify('收藏「' + shop.name + '」纪念卡 · ' + this.souvenirs.size + ' / ' + this.sim.world.shops.length);
    for (const [count, reward] of [[3, 100], [10, 150], [this.sim.world.shops.length, 500]]) {
      if (this.souvenirs.size >= count && !this.milestones.has(count)) {
        this.milestones.add(count);
        const palette = TOWN_PALETTES.find(p => p.id === (count === 3 ? 'cards3' : count === 10 ? 'cards10' : 'cardsAll'));
        this.sim.reward(reward, '收藏里程碑：' + count + ' 张纪念卡 · 解锁「' + palette.name + '」');
      }
    }
    return true;
  }

  paletteUnlocked(id) {
    if (this.quests.some(q => q.id === id && q.stage === 'done')) return true;
    const count = { cards3: 3, cards10: 10, cardsAll: this.sim.world.shops.length }[id];
    return count !== undefined && this.milestones.has(count);
  }

  applyPalette(id) {
    const palette = TOWN_PALETTES.find(p => p.id === id);
    if (!palette || !this.paletteUnlocked(id)) return false;
    this.sim.customSuitColor = color(palette.hex);
    this.sim.notify('已换上「' + palette.name + '」配色。');
    return true;
  }

  track(kind, id) {
    const valid = kind === 'quest' ? this.quests.some(q => q.id === id && q.stage !== 'done') :
      kind === 'shop' ? this.sim.world.shops.some(s => shopId(s) === id) :
      kind === 'event' ? this.sim.events.some(e => e.name === id && e.state !== 'done') :
      kind === 'backpack' ? Number.isInteger(id) && this.sim.backpacks[id] && !this.sim.backpacks[id].found : false;
    if (!valid) return false;
    this.tracked = { kind, id };
    return true;
  }

  clearTracking() { this.tracked = null; }

  navigationTarget() {
    const sim = this.sim;
    if (sim.race) return { p: sim.race.points[sim.race.index], mapP: sim.race.points[sim.race.index], label: '竞速光环 ' + (sim.race.index + 1), hint: '穿过蓝色光环 · 竞速优先导航' };
    if (sim.escort) return { p: sim.escort.dest, mapP: sim.escort.dest, label: sim.escort.destName, hint: '带着邻居前往目的地 · 护送优先导航' };
    const t = this.tracked;
    if (!t) return null;
    let p, label, hint, shop;
    if (t.kind === 'quest') {
      const q = this.quests.find(q => q.id === t.id);
      if (!q || q.stage === 'done') { this.clearTracking(); return null; }
      if (!this.questsEnabled) return null;
      if (q.stage === 'pickup') { shop = q.targetShop; p = shop.door; label = q.shop; hint = '进店领取「' + q.item + '」'; }
      else if (q.stage === 'photo') { p = this.lake; label = '湖畔观景园'; hint = '开启拍照模式并保存照片'; }
      else { p = add(q.giver.p, V(0, 1.6, 0)); label = q.giverName + ' · ' + q.name; hint = q.stage === 'available' ? '靠近居民按互动接下委托' : '靠近居民按互动交付'; }
    } else if (t.kind === 'shop') {
      shop = sim.world.shops.find(s => shopId(s) === t.id);
      if (!shop) { this.clearTracking(); return null; }
      p = shop.door; label = shop.name; hint = '进店互动，领取店铺纪念卡';
    } else if (t.kind === 'event') {
      const e = sim.events.find(e => e.name === t.id);
      if (!e || e.state === 'done') { this.clearTracking(); return null; }
      if (!sim.options.events) return null;
      p = e.p; label = e.name; hint = '靠近活动地点参与事件';
    } else if (t.kind === 'backpack') {
      const b = sim.backpacks[t.id];
      if (!b || b.found) { this.clearTracking(); return null; }
      p = b.p; label = '旧背包 ' + (t.id + 1); hint = '靠近背包按互动收集';
    }
    if (!p) return null;
    const mapP = p;
    if (sim.interior) {
      const here = shop === sim.interior.shop;
      p = here ? V(11, 1.6, -15) : V(0, 1.6, 24);
      hint = here ? hint + ' · 按互动打开店铺菜单' : '先离开店铺，再前往目标';
    }
    return { p, mapP, label, hint };
  }

  snapshot() {
    return { quests: this.quests.map(q => ({ id: q.id, stage: q.stage })), souvenirs: [...this.souvenirs], milestones: [...this.milestones], tracked: this.tracked && { ...this.tracked } };
  }

  restore(saved) {
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;
    if (Array.isArray(saved.quests)) for (const q of this.quests) {
      const stage = saved.quests.find(row => row?.id === q.id)?.stage;
      if (['available', q.photo ? 'photo' : 'pickup', 'deliver', 'done'].includes(stage)) q.stage = stage;
    }
    const ids = new Set(this.sim.world.shops.map(shopId));
    if (Array.isArray(saved.souvenirs)) this.souvenirs = new Set(saved.souvenirs.filter(id => ids.has(id)));
    // A milestone already earned on reload must never grant its score twice.
    this.milestones = new Set([3, 10, this.sim.world.shops.length].filter(n => this.souvenirs.size >= n));
    if (saved.tracked && typeof saved.tracked === 'object') this.track(saved.tracked.kind, saved.tracked.id);
  }
}

export function makeTownMarkers(g, sim) {
  if (!sim.interior && sim.townLife.questsEnabled) for (const q of sim.townLife.quests) {
    if (q.stage === 'done' || length(sub(q.giver.p, sim.p)) > 100) continue;
    const p = q.giver.p, c = q.stage === 'deliver' ? color('#a9efc6') : color('#f6d493');
    g.sphere(p.x, p.y + 4.2 + Math.sin(sim.time * 3) * .15, p.z, .35, c);
    g.cone(p.x, p.y + 3.4, p.z, .25, .55, c);
  }
  const target = sim.townLife.navigationTarget();
  if (!target || sim.race || sim.escort || length(sub(target.p, sim.p)) > 220) return;
  const p = target.p, c = color('#f6d493');
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, b = (i + 1) / 16 * Math.PI * 2;
    g.limb(add(p, V(Math.cos(a) * 2.4, .15, Math.sin(a) * 2.4)), add(p, V(Math.cos(b) * 2.4, .15, Math.sin(b) * 2.4)), .06, c);
  }
}
