# 成就 + 统计系统 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为蜘蛛侠 3D 游戏实现 18 个成就（里程碑+技巧挑战）与持久化统计页，全达成解锁「午夜鎏金」战衣。

**Architecture:** 声明式成就注册表（新模块 `achievements.js`，零 DOM 依赖，纯函数 check）+ `Adventure` 上的 `sim.stats` 累加器；`features.js` 负责存档、toast、音效与手记渲染；检查以 10Hz 在 `features.tick()` 内轮询。spec 见 `docs/superpowers/specs/2026-10-06-achievements-stats-design.md`。

**Tech Stack:** 原生 ES Module，无任何依赖；测试用 `node:assert` 裸脚本（`node tests/achievements.test.mjs`）。

## Global Constraints

- 缓存版本号：本期统一为 `?v=20261006achv`（当前代码为 `20261006savefix`，最后一个任务统一替换）。
- 测试期间新模块 import 一律先写 `?v=20261006achv`（与最终版本一致，避免 Task 5 再改 features/game3d 的 import 行）。
- `achievements.js` 与 `tests/` 不碰 DOM；浏览器专用代码只进 `features.js`/`game3d.js`。
- 代码风格：跟随仓库现有压缩单行风格。
- 提交信息：英文祈使句首行（仓库惯例），不加 Co-authored-by。
- 成就奖励直接 `sim.style+=reward`；`style-5000` 判定含奖励分（预期自反馈，单调无环）。
- 所有用户可见文案为中文，不引入多语言机制。

---

### Task 1: 成就注册表模块 `achievements.js`（TDD）

**Files:**
- Create: `achievements.js`
- Create: `tests/achievements.test.mjs`

**Interfaces:**
- Produces: `ACHIEVEMENTS`（18 项数组，每项 `{id,name,desc,reward,check(sim,stats)}`）、`ULTIMATE_SUIT`（`{name:'午夜鎏金',red:'#2b2d42',blue:'#c9a227'}`）、`AchievementSystem` 类（`load(saved)`、`tick(dt)`、`checkAll()` 返回新达成数组、getter `complete`、可写属性 `onunlock`）。
- 依赖：无 import（纯模块）。

- [ ] **Step 1: 写失败测试**

创建 `tests/achievements.test.mjs`：

```js
import assert from 'node:assert/strict';
import {ACHIEVEMENTS,AchievementSystem,ULTIMATE_SUIT} from '../achievements.js';

const fullSim={ropes:[{},{}],combo:5,noLandingDistance:1000,style:5000,stuntChallenge:{score:600},
 world:{bosses:[{dead:true},{dead:true},{dead:true}],shops:new Array(67)},
 visited:new Set(Array.from({length:67},(_,i)=>String(i))),
 backpacks:[{found:true},{found:true},{found:true},{found:true},{found:true}],
 photos:new Set([1,2,3,4]),events:Array.from({length:7},()=>({state:'done'})),
 stats:{websFired:9,citizenTalks:10,maxSpeed:130,perfectDodges:3,tricks:50}};
const emptySim={ropes:[],combo:0,noLandingDistance:0,style:0,stuntChallenge:null,
 world:{bosses:[{dead:false},{dead:false},{dead:false}],shops:new Array(67)},
 visited:new Set(),backpacks:[{found:false}],photos:new Set(),events:[{state:'ready'}],
 stats:{websFired:0,citizenTalks:0,maxSpeed:0,perfectDodges:0,tricks:0}};

assert.equal(ACHIEVEMENTS.length,18,'应有 18 个成就');
assert.equal(new Set(ACHIEVEMENTS.map(a=>a.id)).size,18,'成就 id 不得重复');
for(const a of ACHIEVEMENTS){
 assert.equal(typeof a.reward,'number');
 assert.equal(a.check(fullSim,fullSim.stats),true,a.id+' 应在满足状态达成');
 assert.equal(a.check(emptySim,emptySim.stats),false,a.id+' 不应在空状态达成');
}
const sys=new AchievementSystem(fullSim);
const fresh=sys.checkAll();
assert.equal(fresh.length,18,'首次全检应全部达成');
assert.equal(sys.complete,true);
const styleAfter=fullSim.style;
assert.equal(styleAfter,5000+ACHIEVEMENTS.reduce((n,a)=>n+a.reward,0),'奖励风格分应已入账');
assert.equal(sys.checkAll().length,0,'重复检查不得重复发奖');
const sys2=new AchievementSystem(emptySim);
sys2.load({achievements:['first-swing','nope-not-real']});
assert.deepEqual([...sys2.unlocked],['first-swing'],'load 应忽略未知 id');
assert.equal(ULTIMATE_SUIT.name,'午夜鎏金');
console.log('achievements unit tests: all pass');
```

- [ ] **Step 2: 运行确认失败**

Run: `node tests/achievements.test.mjs`
Expected: FAIL — `Cannot find module '.../achievements.js'`

- [ ] **Step 3: 实现 `achievements.js`**

```js
// Declarative achievement registry: pure checks, no DOM. features.js drives ticking and toasts.
export const ULTIMATE_SUIT={name:'午夜鎏金',red:'#2b2d42',blue:'#c9a227'};
export const ACHIEVEMENTS=[
 {id:'first-swing',name:'初次摆荡',desc:'第一次用蛛丝挂上建筑',reward:50,check:(s,t)=>t.websFired>0},
 {id:'double-web',name:'双手齐发',desc:'两只手同时挂住建筑',reward:80,check:s=>!!s.ropes[0]&&!!s.ropes[1]},
 {id:'first-boss',name:'初战告捷',desc:'击败任意一个 Boss',reward:100,check:s=>s.world.bosses.some(b=>b.dead)},
 {id:'all-bosses',name:'城市守护者',desc:'三个 Boss 全部击败',reward:200,check:s=>s.world.bosses.every(b=>b.dead)},
 {id:'shopper-5',name:'街区常客',desc:'逛店 5 家',reward:50,check:s=>s.visited.size>=5},
 {id:'shopper-20',name:'探店达人',desc:'逛店 20 家',reward:100,check:s=>s.visited.size>=20},
 {id:'shopper-67',name:'小镇活地图',desc:'逛遍小镇全部 67 家店',reward:300,check:s=>s.visited.size>=s.world.shops.length},
 {id:'backpacks-5',name:'记忆收藏家',desc:'找齐 5 个屋顶背包',reward:100,check:s=>s.backpacks.every(b=>b.found)},
 {id:'photos-4',name:'城市摄影师',desc:'打卡全部 4 个地标',reward:100,check:s=>s.photos.size>=4},
 {id:'events-7',name:'邻里英雄',desc:'完成全部 7 个城市事件',reward:200,check:s=>s.events.every(e=>e.state==='done')},
 {id:'citizens-10',name:'社区之友',desc:'与 10 位市民交谈',reward:80,check:(s,t)=>t.citizenTalks>=10},
 {id:'style-5000',name:'风格传奇',desc:'累计风格分达到 5000',reward:150,check:s=>s.style>=5000},
 {id:'no-landing-1000',name:'一气呵成',desc:'单次不落地飞行 1000 距离',reward:150,check:s=>s.noLandingDistance>=1000},
 {id:'speed-120',name:'音速穿行',desc:'飞行速度达到 120',reward:100,check:(s,t)=>t.maxSpeed>=120},
 {id:'combo-5',name:'连击大师',desc:'连击达到 ×5',reward:100,check:s=>s.combo>=5},
 {id:'stunt-600',name:'特技之星',desc:'特技评分挑战单场 600 分',reward:150,check:s=>!!s.stuntChallenge&&s.stuntChallenge.score>=600},
 {id:'perfect-dodge-3',name:'蜘蛛感应',desc:'完美闪避累计 3 次',reward:100,check:(s,t)=>t.perfectDodges>=3},
 {id:'tricks-50',name:'空中芭蕾',desc:'空中特技累计 50 次',reward:120,check:(s,t)=>t.tricks>=50}
];
export class AchievementSystem{
 constructor(sim){this.sim=sim;this.unlocked=new Set();this.clock=0;this.onunlock=null;}
 get complete(){return this.unlocked.size>=ACHIEVEMENTS.length;}
 load(saved){if(saved&&Array.isArray(saved.achievements))for(const id of saved.achievements)if(ACHIEVEMENTS.some(a=>a.id===id))this.unlocked.add(id);}
 tick(dt){this.clock+=dt;if(this.clock<.1)return;this.clock=0;this.checkAll();}
 checkAll(){const fresh=[];for(const a of ACHIEVEMENTS){if(this.unlocked.has(a.id))continue;try{if(a.check(this.sim,this.sim.stats||{})){this.unlocked.add(a.id);fresh.push(a);}}catch(e){console.warn('成就检查异常',a.id,e);}}if(fresh.length){for(const a of fresh)this.sim.style+=a.reward;if(this.onunlock)this.onunlock(fresh);}return fresh;}
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node tests/achievements.test.mjs`
Expected: `achievements unit tests: all pass`

- [ ] **Step 5: 提交**

```bash
git add achievements.js tests/achievements.test.mjs
git commit -m "Add declarative achievement registry with pure checks"
```

---

### Task 2: 统计累加器与击杀计数（adventure.js / world3d.js，TDD）

**Files:**
- Modify: `adventure.js`（构造函数、update、attach/attack/skill/interactActivity 多处）
- Modify: `world3d.js:23`（Simulation.notify 之后加 countKill）、`world3d.js:55`（击杀点）
- Modify: `tests/achievements.test.mjs`（追加集成测试）

**Interfaces:**
- Consumes: Task 1 的 `ACHIEVEMENTS`/`AchievementSystem`（测试用）。
- Produces: `sim.stats = {playTime,flightDistance,maxSpeed,websFired,enemiesDefeated,citizenTalks,perfectDodges,tricks}`（全数字，初始 0）、`sim.noLandingDistance`（会话内临时）、`sim.countKill()`（Simulation 方法，安全无 stats 时跳过）。

- [ ] **Step 1: 追加失败测试到 `tests/achievements.test.mjs` 末尾**

```js
// --- integration: stats accumulate in the real simulation ---
const {createWorld} = await import('../world3d.js');
const {Adventure} = await import('../adventure.js');
const world=createWorld();
const sim=new Adventure(world);
assert.equal(sim.stats.playTime,0,'Adventure 应初始化 stats');
const input={forward:1,right:0,jump:false,webLeft:true,webRight:false,attack:false,climb:false};
for(let i=0;i<240;i++)sim.update(1/120,input,i*0.01);
assert.ok(sim.stats.playTime>1.9,'playTime 应累计 240 帧');
assert.ok(sim.stats.websFired>=1,'持住左手蛛丝应至少成功挂丝一次');
assert.ok(sim.stats.flightDistance>0,'起飞后应累计飞行距离');
assert.ok(sim.stats.maxSpeed>0,'应有速度记录');
const live=new AchievementSystem(sim);
const got=live.checkAll();
assert.ok(got.some(a=>a.id==='first-swing'),'首摆成就应达成');
console.log('achievements integration test: pass');
```

- [ ] **Step 2: 运行确认失败**

Run: `node tests/achievements.test.mjs`
Expected: FAIL — `sim.stats` 为 undefined（`assert.equal(sim.stats.playTime,0)` 抛 TypeError）

- [ ] **Step 3: 修改 `adventure.js`**

3a. 构造函数——Adventure 构造函数（adventure.js 第 7 行）以事件数组 push 结尾：`.map(e=>({...e,kind:'conflict',state:'ready',progress:0,need:2})));}`，在该结尾处追加 stats 字段（注意：`this.inventory` 由 world3d.js 的 Simulation 构造函数设置，Adventure 无需重复；执行时子代理已发现并经确认修正此锚点）：

```js
this.inventory=new Set();this.stats={playTime:0,flightDistance:0,maxSpeed:0,websFired:0,enemiesDefeated:0,citizenTalks:0,perfectDodges:0,tricks:0};this.noLandingDistance=0;}
```

（执行版：在 Adventure 构造函数结尾追加 `this.stats={playTime:0,flightDistance:0,maxSpeed:0,websFired:0,enemiesDefeated:0,citizenTalks:0,perfectDodges:0,tricks:0};this.noLandingDistance=0;}`；上方案例代码保留 inventory 行仅适用于 world3d.js 的 Simulation 构造函数上下文。）

3b. `update()` 开头——找到 `update(dt,input,yaw){if(this.grounded)this.airAttachCount=0;this.weatherClock+=dt;` 替换为：

```js
update(dt,input,yaw){if(this.grounded)this.airAttachCount=0;this.stats.playTime+=dt;this.weatherClock+=dt;
```

3c. 包裹 `super.update`——找到：

```js
const wasGrounded=this.grounded;super.update(dt,input,yaw);updateHeroPose(this,dt);
```

替换为：

```js
const wasGrounded=this.grounded,airPos={...this.p};super.update(dt,input,yaw);updateHeroPose(this,dt);const airStep=length(sub(this.p,airPos));if(this.grounded)this.noLandingDistance=0;else if(airStep<=50){this.stats.flightDistance+=airStep;this.noLandingDistance+=airStep;}if(Math.hypot(this.v.x,this.v.z)>this.stats.maxSpeed)this.stats.maxSpeed=Math.hypot(this.v.x,this.v.z);
```

（`length`/`sub` 已在文件头部 import，无需新增。）

3d. `attach()`——找到 `const ok=super.attach(side,yaw,quiet);if(ok)this.airAttachCount++;return ok;` 替换为：

```js
const ok=super.attach(side,yaw,quiet);if(ok){this.airAttachCount++;this.stats.websFired++;}return ok;
```

3e. `attack()`——找到 `super.attack();}`（Adventure.attack 结尾）替换为：

```js
const cool=this.attackCool;super.attack();if(cool<=0)this.stats.websFired++;}
```

3f. `skill()` 五处：
- zip：找到 `this.cooldowns.zip=2;this.notify('定点弹射！');` → `this.cooldowns.zip=2;this.stats.websFired++;this.notify('定点弹射！');`
- trick：找到 `this.cooldowns.trick=1.02;this.v.y+=2.5;` → `this.cooldowns.trick=1.02;this.stats.tricks++;this.v.y+=2.5;`
- dodge：找到 `if(perfect){this.slowTime=.6;this.reward(40,'完美闪避 · 蜘蛛感应');}` → `if(perfect){this.slowTime=.6;this.stats.perfectDodges++;this.reward(40,'完美闪避 · 蜘蛛感应');}`
- bind：找到 `this.cooldowns.bind=1.25;this.notify('捆缚蛛丝已发射！');` → `this.cooldowns.bind=1.25;this.stats.websFired++;this.notify('捆缚蛛丝已发射！');`
- 轻重击击杀：找到 `if(target.hp===0){target.dead=true;this.reward(25,'连招击败'+target.name);}` → `if(target.hp===0){target.dead=true;this.stats.enemiesDefeated++;this.reward(25,'连招击败'+target.name);}`
- 范围网迈尔斯电杀：找到 `if(b.hp===0)b.dead=true;}` → `if(b.hp===0){b.dead=true;this.stats.enemiesDefeated++;}}`

3g. `interactActivity()` 市民分支——找到 `citizen.react=5;this.notify((citizen.name||'邻居')+'：'+citizen.line);return true;` 替换为：

```js
citizen.react=5;this.stats.citizenTalks++;this.notify((citizen.name||'邻居')+'：'+citizen.line);return true;
```

- [ ] **Step 4: 修改 `world3d.js`**

4a. 在 `notify(text){this.messages.push(text);}` 之后新增一行：

```js
 countKill(){if(this.stats)this.stats.enemiesDefeated++;}
```

4b. 弹丸击杀点——找到 `if(boss.hp===0){boss.dead=true;this.burst(boss.p,boss.color,35);` 替换为：

```js
if(boss.hp===0){boss.dead=true;this.countKill();this.burst(boss.p,boss.color,35);
```

- [ ] **Step 5: 运行测试确认通过**

Run: `node tests/achievements.test.mjs`
Expected: `achievements unit tests: all pass` + `achievements integration test: pass`

- [ ] **Step 6: 回归（世界与物理未被破坏）**

Run: `node --input-type=module -e "import {createWorld} from './world3d.js';import {Adventure} from './adventure.js';const w=createWorld();const s=new Adventure(w);const i={forward:1,right:0,jump:false,webLeft:true,webRight:false,attack:false,climb:false};for(let k=0;k<240;k++)s.update(1/120,i,k*0.01);console.log('regression ok',s.stats);"
Expected: `regression ok` 且 stats 各字段为有限数字。

- [ ] **Step 7: 提交**

```bash
git add adventure.js world3d.js tests/achievements.test.mjs
git commit -m "Track gameplay stats and kill counts for achievements"
```

---

### Task 3: features.js 接线（存档/toast/音效/轮询）+ 成就音效

**Files:**
- Modify: `features.js`（import、存档 load/persist、onunlock、tick、journal 渲染）
- Modify: `settings.js:33`（CityAudio 新增 achievement() 方法，放在 effect() 之后）

**Interfaces:**
- Consumes: `AchievementSystem`/`ACHIEVEMENTS`（Task 1）、`sim.stats`（Task 2）、`callbacks.toast`（game3d 已传入）、`settingsUI.audio`（现有返回值）。
- Produces: `sim.achievements`（AchievementSystem 实例，Task 4 的 game3d/adventure 读取 `sim.achievements.complete`）；存档对象新增 `achievements:[id...]` 与 `stats:{...}`。

- [ ] **Step 1: settings.js 加音效方法**

找到 `effect(action){this.start();this.tone('effects',...450,.13,'triangle');}` 整行，在其后新增：

```js
 achievement(){this.tone('effects',880,.15,'triangle');setTimeout(()=>this.tone('effects',1318.5,.3,'triangle'),110);}
```

- [ ] **Step 2: features.js 头部 import**

找到：

```js
import{installSettings,DEFAULT_KEYS}from'./settings.js?v=20261006savefix';
```

在其后新增一行：

```js
import{AchievementSystem,ACHIEVEMENTS}from'./achievements.js?v=20261006achv';
```

- [ ] **Step 3: 构造成就系统并恢复存档**

找到 try 块结尾 `catch{}function persist(){`，把 `catch{}` 替换为：

```js
catch{}const achievements=sim.achievements=new AchievementSystem(sim);achievements.load(saved);if(saved&&saved.stats&&sim.stats)for(const k in sim.stats)if(typeof sim.stats[k]==='number')sim.stats[k]=Number(saved.stats[k])||0;
function persist(){
```

注意：`saved` 可能是 null（`JSON.parse(...||'null')`），`achievements.load(null)` 安全。

- [ ] **Step 4: persist() 写入新字段**

找到：

```js
localStorage.setItem('spider-neon-adventure',JSON.stringify({character:sim.character,difficulty:sim.difficulty,style:sim.style,raceBest:sim.raceBest,visited:[...sim.visited],backpacks:sim.backpacks.map(b=>b.found),keys}));
```

替换为：

```js
localStorage.setItem('spider-neon-adventure',JSON.stringify({character:sim.character,difficulty:sim.difficulty,style:sim.style,raceBest:sim.raceBest,visited:[...sim.visited],backpacks:sim.backpacks.map(b=>b.found),keys,achievements:[...achievements.unlocked],stats:{...sim.stats}}));
```

- [ ] **Step 5: 挂接达成回调（settingsUI 创建之后）**

找到：

```js
const settingsUI=installSettings(sim,keys,{...callbacks,labels:...});
```

（整行以 `labels:()=>{` 结尾。）在该行之后新增：

```js
 achievements.onunlock=fresh=>{callbacks.toast('🏆 成就达成：'+fresh.map(a=>a.name).join('、')+' · 风格 +'+fresh.reduce((n,a)=>n+a.reward,0));settingsUI.audio.achievement();persist();};
```

- [ ] **Step 6: tick() 里轮询**

找到 `tick(dt,t){saveTime+=dt;` 替换为：

```js
tick(dt,t){achievements.tick(dt);saveTime+=dt;
```

- [ ] **Step 7: journal() 渲染履历与成就**

找到 `$('journalStats').textContent='风格 '+sim.style+' · 救援 '+events+' / '+sim.events.length+' · 背包 '+sim.backpacks.filter(b=>b.found).length+' / 5 · 地标照片 '+sim.photos.size+' / 4';` 替换为：

```js
const st=sim.stats||{},dur=Math.floor((st.playTime||0)/60),sec=Math.floor((st.playTime||0)%60);const journalStats=$('journalStats');journalStats.replaceChildren();for(const [k,v] of [['游玩时长',dur+' 分 '+sec+' 秒'],['风格',sim.style],['摆荡距离',Math.round(st.flightDistance||0)],['最高速度',Math.round(st.maxSpeed||0)],['蛛丝发射',st.websFired||0],['击败敌人',st.enemiesDefeated||0],['市民交谈',st.citizenTalks||0],['完美闪避',st.perfectDodges||0],['空中特技',st.tricks||0],['救援',events+' / '+sim.events.length],['背包',sim.backpacks.filter(b=>b.found).length+' / 5'],['地标照片',sim.photos.size+' / 4'],['成就',achievements.unlocked.size+' / '+ACHIEVEMENTS.length]]){const tile=document.createElement('div');tile.innerHTML='<b>'+v+'</b><small>'+k+'</small>';journalStats.appendChild(tile);}
const achievementList=$('achievementList');achievementList.replaceChildren();for(const a of ACHIEVEMENTS){const done=achievements.unlocked.has(a.id),row=document.createElement('div');row.className='achievement'+(done?' done':'');row.innerHTML='<b>'+(done?'✓ ':'')+a.name+'</b><small>'+(done?'风格 +'+a.reward:a.desc)+'</small>';achievementList.appendChild(row);}const ultimate=document.createElement('div');ultimate.className='ultimate'+(achievements.complete?' done':'');ultimate.textContent=achievements.complete?'👑 城市传奇 · 午夜鎏金战衣已在织光服装店备好':'？？？ 织光服装店的镇店战衣，等待达成全部成就的城市传奇。';achievementList.appendChild(ultimate);
```

（全部为静态字符串拼接，无用户输入，无 XSS 面。）

- [ ] **Step 8: 验证**

Run: `for f in features.js settings.js; do node --check $f; done && node tests/achievements.test.mjs`
Expected: 无语法错误 + 全部测试通过（features.js 是浏览器模块，只做语法检查；运行时行为在 Task 5 冒烟验证）。

- [ ] **Step 9: 提交**

```bash
git add features.js settings.js
git commit -m "Wire achievement system into saves, toasts, audio and journal"
```

---

### Task 4: 手记 UI 结构样式 + 「午夜鎏金」战衣

**Files:**
- Modify: `index.html:13`（journalOverlay：journalStats 改 div、新增 achievementList）
- Modify: `style.css`（文件末尾追加区块样式 + 移动端适配）
- Modify: `game3d.js`（openShopMenu 第 6 选项 + import ULTIMATE_SUIT）
- Modify: `adventure.js`（shopAction type1 处理 action===5）

**Interfaces:**
- Consumes: `sim.achievements.complete`（Task 3 产出）、`ULTIMATE_SUIT`（Task 1）、DOM id `journalStats`/`achievementList`（Task 3 journal() 写入）。
- Produces: 服装店 type1 第 6 个按钮（action===5），`shopAction(5)` 设置 `sim.suit={red:'#2b2d42',blue:'#c9a227'}` 与 `sim.suitType=5`。

- [ ] **Step 1: index.html**

找到（journalOverlay 一行内）：

```html
<p id="storyText"></p><p id="journalStats"></p>
```

替换为：

```html
<p id="storyText"></p><div id="journalStats" class="stats-grid"></div>
```

同文件找到 `<div id="eventList"></div>` 替换为：

```html
<div id="eventList"></div><div id="achievementList"></div>
```

- [ ] **Step 2: style.css 末尾追加**

```css
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}.stats-grid div{background:#142b41;border:1px solid #4b708444;border-radius:10px;padding:10px 6px;text-align:center}.stats-grid b{display:block;font-size:15px;color:#dff3ff}.stats-grid small{font-size:10px;color:#9ec9df}#achievementList{display:grid;gap:7px;margin:14px 0}#achievementList .achievement{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:10px 13px;border-radius:10px;background:#122a40;border:1px solid #3a5c7433;font-size:12px}#achievementList .achievement b{font-weight:500}#achievementList .achievement small{color:#8fb4ca;text-align:right}#achievementList .achievement.done{background:#1d4a3a;border-color:#5fd3a055}#achievementList .achievement.done small{color:#9fe3c4}#achievementList .ultimate{padding:12px 13px;border-radius:10px;text-align:center;background:#241d3f;border:1px solid #c9a22766;font-size:12px;color:#c5b98a}#achievementList .ultimate.done{color:#f0df9a;border-color:#c9a227;box-shadow:0 0 18px #c9a22733}@media(max-width:600px){.stats-grid{grid-template-columns:repeat(3,1fr)}}
```

- [ ] **Step 3: game3d.js 服装店第 6 项**

3a. 头部 import——找到 `import{installFeatures}from'./features.js?v=20261006savefix';` 在其后新增：

```js
import{ULTIMATE_SUIT}from'./achievements.js?v=20261006achv';
```

3b. openShopMenu——找到 `$('shopItems').replaceChildren();names.forEach((name,i)=>{` 在其前插入一行：

```js
const ultimate=sim.achievements&&sim.achievements.complete;if(shop.type===1&&ultimate){names=[...names,ULTIMATE_SUIT.name+'战衣'];notes[shop.type]=[...notes[shop.type],'全成就限定 · 城市传奇专属'];}
```

3c. 禁用条件放行第 6 项——找到 `if(shop.type===1&&!sim.options.unlockSuits&&i>=3&&sim.style<(i===3?120:300))button.disabled=true;` 替换为：

```js
if(shop.type===1&&!sim.options.unlockSuits&&i>=3&&i<5&&sim.style<(i===3?120:300))button.disabled=true;
```

- [ ] **Step 4: adventure.js shopAction 处理 action 5**

找到：

```js
shopAction(action){if(this.interior?.shop.type===1){if(!this.options.unlockSuits&&(action===3&&this.style<120||action===4&&this.style<300)){this.notify('多做特技和城市事件，攒风格分数解锁这套战衣。');return;}this.suitType=action;
```

替换为：

```js
shopAction(action){if(this.interior?.shop.type===1){if(action===5){if(!(this.achievements&&this.achievements.complete)){this.notify('达成全部成就后，这件战衣会为你点亮。');return;}this.suitType=5;this.suit={red:color('#2b2d42'),blue:color('#c9a227')};this.notify('午夜鎏金：属于城市传奇的专属战衣。');return;}if(!this.options.unlockSuits&&(action===3&&this.style<120||action===4&&this.style<300)){this.notify('多做特技和城市事件，攒风格分数解锁这套战衣。');return;}this.suitType=action;
```

（`color` 已在 adventure.js 头部 import。）

- [ ] **Step 5: 战衣逻辑 Node 验证（追加到 tests/achievements.test.mjs 末尾）**

```js
// --- ultimate suit gating in shopAction ---
const world2=createWorld();const sim2=new Adventure(world2);
sim2.interior={shop:{type:1,name:'织光服装店'}};
sim2.shopAction(5);
assert.ok(sim2.suitType!==5,'未全达成时不得解锁午夜鎏金');
sim2.achievements={complete:true};
sim2.shopAction(5);
assert.equal(sim2.suitType,5,'全达成后应解锁');
assert.equal(Array.isArray(sim2.suit.red),true,'suit.red 应为 color() 返回的数组');
assert.ok(Math.abs(sim2.suit.blue[0]-0xc9/255)<.01,'鎏金红分量应为 #c9/255');
console.log('ultimate suit test: pass');
```

（注：`sim.suit` 的值是 `color()` 返回的 `[r,g,b]` 数组；此测试直接以 `sim2.achievements={complete:true}` 模拟全达成，无需真跑 18 个成就。）

- [ ] **Step 6: 运行全部测试**

Run: `node --check game3d.js && node --check adventure.js && node tests/achievements.test.mjs`
Expected: 语法通过 + 全部测试通过（含 ultimate suit test）。

- [ ] **Step 7: 提交**

```bash
git add index.html style.css game3d.js adventure.js tests/achievements.test.mjs
git commit -m "Add journal achievement UI and ultimate midnight-gold suit"
```

---

### Task 5: 版本号统一 + 全量验证 + 浏览器冒烟 + 推送

**Files:**
- Modify: 全部含 `?v=20261006savefix` 的文件（index.html、collision.js、game3d.js、world3d.js、adventure.js、features.js、hero-pose.js、settings.js、town-catalog.js、town-details.js）
- Modify: `README.md`（文件说明处补一行 achievements.js）

**Interfaces:**
- Consumes: Task 1-4 全部产出。
- Produces: 可部署的最终状态，远程 main 更新。

- [ ] **Step 1: 版本号替换**

```bash
sed -i '' 's/20261006savefix/20261006achv/g' index.html collision.js game3d.js world3d.js adventure.js features.js hero-pose.js settings.js town-catalog.js town-details.js
grep -c '20261006savefix' *.js index.html | grep -v ':0' || echo "no stale refs"
```

Expected: `no stale refs`（Task 3/4 新写的 `20261006achv` import 本就不含旧串）。

- [ ] **Step 2: README 补一行**

在「文件说明」列表 `- style.css：...` 之后加：

```markdown
- `achievements.js`：成就定义与检查器（纯逻辑，可在 Node 中测试）。
```

- [ ] **Step 3: 全量验证**

```bash
for f in *.js; do node --check "$f" || echo "FAIL $f"; done
node tests/achievements.test.mjs
node --input-type=module -e "import {readFileSync,existsSync} from 'fs';let bad=0,refs=0;for(const f of ['index.html','adventure.js','collision.js','engine3d.js','features.js','game3d.js','hero-pose.js','settings.js','settings-model.js','town-catalog.js','town-details.js','world3d.js','achievements.js']){const t=readFileSync(f,'utf8');for(const m of t.matchAll(/'\.\/([a-z0-9-]+\.js)\?v=([^']+)'/g)){refs++;if(!existsSync(m[1])||m[2]!=='20261006achv')bad++;}for(const m of t.matchAll(/(?:src|href)=\"([a-z0-9.-]+\.(?:js|css))\?v=([^\"]+)\"/g)){refs++;if(!existsSync(m[1])||m[2]!=='20261006achv')bad++;}}console.log('refs',refs,'bad',bad);if(bad)process.exit(1);"
```

Expected: 语法全过、测试全绿、`bad 0`。

- [ ] **Step 4: 浏览器冒烟（control-browser 技能）**

1. `python3 -m http.server 8378` 启动本地服务。
2. 打开 `http://localhost:8378/index.html`，确认启动画面渲染。
3. `evaluate` 写入模拟存档：`localStorage.setItem('spider-neon-adventure', JSON.stringify({style:4600,achievements:['first-swing','shopper-5'],stats:{playTime:95,flightDistance:800,maxSpeed:66,websFired:4,enemiesDefeated:1,citizenTalks:2,perfectDodges:1,tricks:6},visited:['0,3'],backpacks:[]}))`，刷新。
4. 点「城市任务」打开手记，断言：履历网格出现「游玩时长 1 分 35 秒」「成就 2 / 18」，成就列表 18 行 + 终极提示行。
5. 点「继续探索」进入游戏，确认无报错、HUD 正常。
6. 结束后关闭标签页并停掉服务器。

- [ ] **Step 5: 提交并推送**

```bash
git add -A
git commit -m "Bump cache version for achievements release and update README"
git push origin main
```

- [ ] **Step 6: 汇报**

向用户报告：推送的 commit 范围、18 成就名单、验证结果（Node 测试输出 + 冒烟截图说明）、以及后续路线图第 2 站（幽灵竞速/护送）的衔接点。

---

## 计划自审记录

- **Spec 覆盖**：18 成就（Task 1）✓ 统计 8 项+累加点（Task 2）✓ 存档扩展/老档兼容（Task 3）✓ toast+音效+10Hz 轮询（Task 3）✓ 手记 UI（Task 3/4/5 html+css）✓ 午夜鎏金（Task 4）✓ 版本号/README（Task 5）✓ 测试四类（Task 1/2/4 Node + Task 5 冒烟）✓
- **占位符**：Task 4 Step 5 初稿有一行误导性断言，已在步骤内给出替换代码并标注；无 TBD/TODO。
- **类型一致性**：`AchievementSystem(sim)/load/tick/checkAll/complete/onunlock`、`sim.stats` 八字段、`sim.achievements`、`ULTIMATE_SUIT` 在各任务间签名一致；DOM id `journalStats`/`achievementList` 在 Task 3（写入方）与 Task 4（结构方）一致。
- **风险备注**：`attack()` 计数用 `attackCool<=0` 预检镜像了 `Simulation.attack` 的冷却门，语义一致；`shopAction(5)` 在 `unlockSuits` 开启时仍要求全成就（设计如此，限定即限定）。
