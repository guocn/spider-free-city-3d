import { V, add, sub, length } from './engine3d.js?v=20261006town';
import { shopId, TOWN_PALETTES } from './town-life.js?v=20261006town';

export function installTownJournal(sim, callbacks) {
  const $ = id => document.getElementById(id), life = sim.townLife;
  const tabs = ['tasks', 'collection', 'profile', 'challenges'];
  let selected = 'tasks';
  function select(id) {
    selected = id;
    for (const key of tabs) {
      $('journal-' + key).hidden = key !== id;
      $('journal-tab-' + key).setAttribute('aria-selected', String(key === id));
      $('journal-tab-' + key).tabIndex = key === id ? 0 : -1;
    }
  }
  for (const id of tabs) $('journal-tab-' + id).onclick = () => select(id);
  $('journalTabs').onkeydown = e => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    select(tabs[(tabs.indexOf(selected) + (e.key === 'ArrowLeft' ? 3 : 1)) % 4]);
    $('journal-tab-' + selected).focus();
  };
  select(selected);
  function button(label, action, disabled = false) {
    const b = document.createElement('button');
    b.textContent = label; b.onclick = action; b.disabled = disabled;
    return b;
  }
  function track(kind, id) {
    life.track(kind, id); callbacks.persist(); render();
    callbacks.toast('已追踪目标，关闭手记后可查看方向和距离。');
  }
  function travel(kind, id, p) {
    life.track(kind, id); sim.travelTo(p); callbacks.resetCamera(); callbacks.close();
  }
  $('clearTracking').onclick = () => { life.clearTracking(); callbacks.persist(); render(); };
  $('trackBackpack').onclick = () => {
    const origin = sim.interior ? sim.interior.shop.door : sim.p;
    const candidates = sim.backpacks.map((b, id) => ({ b, id })).filter(row => !row.b.found)
      .sort((a, b) => length(sub(a.b.p, origin)) - length(sub(b.b.p, origin)));
    if (candidates.length) track('backpack', candidates[0].id);
  };
  $('collectionSearch').oninput = renderCollection;
  $('collectionFilter').onchange = renderCollection;

  function renderCollection() {
    const query = ($('collectionSearch').value || '').trim().toLowerCase();
    const filter = $('collectionFilter').value || 'all';
    $('collectionSummary').textContent = '探店印章 ' + sim.visited.size + ' / ' + sim.world.shops.length + ' · 纪念卡 ' + life.souvenirs.size + ' / ' + sim.world.shops.length;
    $('collectionList').replaceChildren();
    const shops = sim.world.shops.filter(s => (!query || [s.name, s.category, s.street].join(' ').toLowerCase().includes(query)) &&
      (filter !== 'unvisited' || !sim.visited.has(shopId(s))) && (filter !== 'uncollected' || !life.souvenirs.has(shopId(s))));
    $('collectionResult').textContent = shops.length + ' 家店符合筛选';
    for (const shop of shops) {
      const id = shopId(shop), visited = sim.visited.has(id), collected = life.souvenirs.has(id);
      const card = document.createElement('article'); card.className = 'collection-card' + (collected ? ' collected' : '');
      const heading = document.createElement('b'); heading.textContent = shop.name;
      const info = document.createElement('small'); info.textContent = shop.category + ' · ' + shop.street;
      const stamp = document.createElement('span'); stamp.className = 'collection-stamp'; stamp.textContent = (visited ? '✓ 已探店' : '待探店') + ' / ' + (collected ? '✓ 纪念卡已收藏' : '待领取纪念卡');
      const actions = document.createElement('div'); actions.className = 'town-actions';
      actions.append(button('追踪店铺', () => track('shop', id)), button('前往店门', () => travel('shop', id, add(shop.door, V(0, 0, 4)))));
      card.append(heading, info, stamp, actions); $('collectionList').appendChild(card);
    }
    $('paletteGrid').replaceChildren();
    for (const p of TOWN_PALETTES) {
      const unlocked = life.paletteUnlocked(p.id), card = document.createElement('div'); card.className = 'palette-card';
      const swatch = document.createElement('i'); swatch.style.background = p.hex;
      const name = document.createElement('b'); name.textContent = p.name;
      const hint = document.createElement('small'); hint.textContent = p.source;
      card.append(swatch, name, hint, button(unlocked ? '换上配色' : '尚未解锁', () => {
        if (life.applyPalette(p.id)) { callbacks.saveAppearance(); callbacks.persist(); callbacks.toast('已换上「' + p.name + '」配色。'); }
      }, !unlocked));
      $('paletteGrid').appendChild(card);
    }
  }

  function render() {
    const target = life.navigationTarget();
    $('trackingSummary').textContent = target ? '正在导航：' + target.label + ' · ' + target.hint : life.tracked ? '委托导航已暂停，请开启市民与事件设置。' : '选择一个委托、店铺或背包，金色标记会指引你的路线。';
    $('clearTracking').hidden = !life.tracked;
    $('townQuestHint').textContent = life.questsEnabled ? '找到店外头顶亮着金色标记的居民，按互动接下委托。' : '开启设置中的「市民路人 AI」和「城市突发事件」后，可以接下居民委托。';
    $('townQuestList').replaceChildren();
    for (const q of life.quests) {
      const card = document.createElement('article'); card.className = 'quest-card' + (q.stage === 'done' ? ' done' : '');
      const heading = document.createElement('b'); heading.textContent = q.name + (q.stage === 'done' ? ' ✓' : '');
      const story = document.createElement('p'); story.textContent = q.giverName + ' · ' + q.giverShop + '店外：' + q.story;
      const steps = document.createElement('ol'); steps.className = 'quest-steps';
      const current = { available: 0, pickup: 1, photo: 1, deliver: 2, done: 3 }[q.stage];
      [ '和' + q.giverName + '交谈', q.photo ? '保存一张湖畔照片' : '到' + q.shop + '领取' + q.item, '回到居民身边交付' ].forEach((text, i) => {
        const step = document.createElement('li'); step.textContent = (i < current ? '✓ ' : '') + text;
        if (i === current) step.className = 'current'; steps.appendChild(step);
      });
      const reward = document.createElement('small'); reward.textContent = '奖励：180 风格 + ' + TOWN_PALETTES.find(p => p.id === q.id).name + '配色';
      const actions = document.createElement('div'); actions.className = 'town-actions';
      actions.append(button('追踪委托', () => track('quest', q.id), q.stage === 'done' || !life.questsEnabled),
        button('前往居民', () => travel('quest', q.id, add(q.giver.p, V(0, 1.6, 4))), !life.questsEnabled));
      card.append(heading, story, steps, reward, actions); $('townQuestList').appendChild(card);
    }
    $('eventList').replaceChildren();
    for (const e of sim.options.events ? sim.events : []) {
      const row = document.createElement('article'); row.className = 'event-card';
      const heading = document.createElement('b'); heading.textContent = e.name + (e.state === 'done' ? ' ✓' : '');
      const story = document.createElement('small'); story.textContent = e.story;
      const actions = document.createElement('div'); actions.className = 'town-actions';
      actions.append(button('追踪事件', () => track('event', e.name), e.state === 'done'), button('前往附近', () => travel('event', e.name, add(e.p, V(0, 0, 8)))));
      row.append(heading, story, actions); $('eventList').appendChild(row);
    }
    $('trackBackpack').disabled = sim.backpacks.every(b => b.found);
    renderCollection();
  }

  function updateNavigation(yaw) {
    const target = life.navigationTarget();
    $('navigationHUD').hidden = !target;
    if (!target) return;
    const delta = sub(target.p, sim.p), distance = length(delta);
    const right = delta.x * Math.cos(yaw) - delta.z * Math.sin(yaw), forward = -delta.x * Math.sin(yaw) - delta.z * Math.cos(yaw);
    $('navigationArrow').style.transform = 'rotate(' + Math.atan2(right, forward) + 'rad)';
    $('navigationName').textContent = target.label;
    $('navigationDistance').textContent = Math.round(distance) + ' m';
    $('navigationHint').textContent = target.hint;
  }

  function drawNavigation(renderer, visible) {
    const target = life.navigationTarget(), node = $('navigationMarker');
    const screen = target ? renderer.project(add(target.p, V(0, 4, 0))) : null;
    node.hidden = !(visible && target && length(sub(target.p, sim.p)) < 240 && screen?.visible);
    if (!node.hidden) {
      node.textContent = '◆ ' + target.label; node.style.left = screen.x + 'px'; node.style.top = screen.y + 'px';
    }
  }
  return { render, updateNavigation, drawNavigation };
}
