# 幽灵竞速 + 护送任务 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 摆荡竞速录制/重放幽灵 + 市民护送任务，成就注册表扩到 20。

**Architecture:** 全部玩法状态挂在 `Adventure`（录制数组、`raceGhost`、`escort` 状态机、跟随插值），渲染进现有 `makeAdventure`，持久化扩展 features.js 现有存档对象，HUD 用新增 `#escortStatus` 元素。spec：`docs/superpowers/specs/2026-10-06-ghost-escort-design.md`。

**Tech Stack:** 原生 ES Module，无依赖；测试 `node tests/achievements.test.mjs`。

## Global Constraints

- 缓存版本号：本计划起统一为 `?v=20261006ghost`（Task 4 统一替换；T2/T3 新 import 若有则直接写新版本号，本计划无新 import 文件）。
- `raceGhost` 样本上限 3000；坐标 1 位小数。
- 护送只受 `options.citizens` 门控（观光预设关市民即无护送）。
- 既有测试只允许按 Task 1 明示修改两处 fixture/断言，其余行不动。
- 代码风格：压缩单行；提交信息英文祈使句。

---

### Task 1: 成就注册表 18→20 与测试 fixtures

**Files:**
- Modify: `achievements.js`（ACHIEVEMENTS 末尾追加 2 项）
- Modify: `tests/achievements.test.mjs`（长度断言、两处 stats fixture）

**Interfaces:**
- Produces: `ACHIEVEMENTS.length===20`；checks 读取 `stats.escortsDone`/`stats.raceWins`（Task 2/3 会在 Adventure.stats 上提供）。

- [ ] **Step 1: 修改既有测试（这是本任务唯一的"测试先行"——断言先于实现变化即红）**

在 `tests/achievements.test.mjs` 中做三处修改：
1. `assert.equal(ACHIEVEMENTS.length,18,'应有 18 个成就');` → `assert.equal(ACHIEVEMENTS.length,20,'应有 20 个成就');`
2. `assert.equal(new Set(ACHIEVEMENTS.map(a=>a.id)).size,18,'成就 id 不得重复');` → `.size,20,`
3. fullSim.stats 追加两字段：`stats:{websFired:9,citizenTalks:10,maxSpeed:130,perfectDodges:3,tricks:50}}` → `stats:{websFired:9,citizenTalks:10,maxSpeed:130,perfectDodges:3,tricks:50,raceWins:1,escortsDone:1}}`；emptySim.stats 同样追加：`stats:{websFired:0,citizenTalks:0,maxSpeed:0,perfectDodges:0,tricks:0}}` → `stats:{websFired:0,citizenTalks:0,maxSpeed:0,perfectDodges:0,tricks:0,raceWins:0,escortsDone:0}}`

- [ ] **Step 2: 运行确认失败**

Run: `node tests/achievements.test.mjs`
Expected: FAIL — `应有 20 个成就`（实际 18）。

- [ ] **Step 3: achievements.js 追加两项**

找到 ` {id:'tricks-50',name:'空中芭蕾',desc:'空中特技累计 50 次',reward:120,check:(s,t)=>t.tricks>=50}` 在其后新增一行：

```js
 {id:'escort-1',name:'护送起步',desc:'完成第一次护送',reward:100,check:(s,t)=>t.escortsDone>=1},
 {id:'ghost-beat',name:'胜过幽灵',desc:'在幽灵竞速中跑赢你自己的幽灵',reward:120,check:(s,t)=>t.raceWins>=1}
```

- [ ] **Step 4: 运行测试确认通过**（奖励和断言是 `ACHIEVEMENTS.reduce` 动态计算，自动适配 2450）

Run: `node tests/achievements.test.mjs`
Expected: 全部通过。

- [ ] **Step 5: 提交**

```bash
git add achievements.js tests/achievements.test.mjs
git commit -m "Add escort and ghost-race achievements to registry"
```

---

### Task 2: 幽灵竞速（录制/重放/结算/渲染/持久化）

**Files:**
- Modify: `adventure.js`（构造函数、startRace、race 结算块、makeAdventure）
- Modify: `features.js`（persist + load 的 raceGhost 字段）
- Modify: `tests/achievements.test.mjs`（追加 ghost 测试块）

**Interfaces:**
- Consumes: Task 1 的 `ghost-beat` 成就（读 `stats.raceWins`）。
- Produces: `sim.raceGhost={time,samples:[[x,y,z]...]}`（持久化）、`sim.ghostPos`（渲染用 V）、`sim.raceGhostRec`（会话内录制数组）；features.js 存档新增 `raceGhost` 字段。

- [ ] **Step 1: 追加失败测试到 tests 末尾**

```js
// --- ghost race: recording, finish, replay, beating the ghost ---
const worldG=createWorld();const simG=new Adventure(worldG);
simG.startRace();
assert.ok(simG.race,'竞速应开始');assert.deepEqual(simG.raceGhostRec,[],'开赛应建空录制');
const inG={forward:1,right:0,jump:false,webLeft:false,webRight:false,attack:false,climb:false};
for(let i=0;i<90;i++)simG.update(1/60,inG,i*0.01);
assert.ok(simG.raceGhostRec.length>=10,'录制应产生样本');
simG.race.index=simG.race.points.length-1;
simG.p={x:simG.race.points[simG.race.index].x,y:simG.race.points[simG.race.index].y,z:simG.race.points[simG.race.index].z};
simG.update(1/60,inG,0);
assert.ok(simG.raceGhost&&simG.raceGhost.samples.length>=10,'冲线应记录幽灵');
assert.equal(simG.raceGhostRec,null,'冲线后录制应清空');
assert.ok(simG.raceBest!==null,'raceBest 应写入');
const firstGhostTime=simG.raceGhost.time;
simG.startRace();
assert.ok(simG.ghostPos,'有幽灵时开赛应初始化 ghostPos');
simG.race.index=simG.race.points.length-1;
simG.p={x:simG.race.points[simG.race.index].x,y:simG.race.points[simG.race.index].y,z:simG.race.points[simG.race.index].z};
simG.update(1/60,inG,0);
assert.ok(simG.stats.raceWins===1,'快于幽灵应记 raceWins');
assert.ok(simG.raceGhost.time<firstGhostTime,'新纪录应更新幽灵');
const checkGhost=ACHIEVEMENTS.find(a=>a.id==='ghost-beat');
assert.equal(checkGhost.check(simG,simG.stats),true,'ghost-beat 应达成');
console.log('ghost race test: pass');
```

- [ ] **Step 2: 运行确认失败**（`simG.startRace` 后 `raceGhostRec` 为 undefined → deepEqual 抛错）

Run: `node tests/achievements.test.mjs`

- [ ] **Step 3: adventure.js 五处修改**

3a. 构造函数——找到 `this.stats={playTime:0,flightDistance:0,maxSpeed:0,websFired:0,enemiesDefeated:0,citizenTalks:0,perfectDodges:0,tricks:0};this.noLandingDistance=0;}` 替换为：

```js
this.stats={playTime:0,flightDistance:0,maxSpeed:0,websFired:0,enemiesDefeated:0,citizenTalks:0,perfectDodges:0,tricks:0,raceWins:0,escortsDone:0};this.noLandingDistance=0;this.escort=null;this.escortCooldown=25;this.raceGhost=null;this.ghostPos=null;this.raceGhostRec=null;}
```

3b. startRace——找到 `this.race={points:bs.map(b=>V(b.x,b.h+8,b.z)),index:0,time:0};this.notify('摆荡计时开始！穿过蓝色光环，试试把冲刺与弹射接起来。');}` 替换为：

```js
this.race={points:bs.map(b=>V(b.x,b.h+8,b.z)),index:0,time:0};this.raceGhostRec=[];this.ghostPos=this.raceGhost&&this.raceGhost.samples.length?V(this.raceGhost.samples[0][0],this.raceGhost.samples[0][1],this.raceGhost.samples[0][2]):null;this.notify('摆荡计时开始！穿过蓝色光环，试试把冲刺与弹射接起来。'+(this.raceGhost?'（青色幽灵是你的旧纪录）':''));}
```

3c. race 结算块——找到：

```js
if(this.race){this.race.time+=dt;if(length(sub(this.p,this.race.points[this.race.index]))<13){this.race.index++;if(this.race.index===this.race.points.length){const time=this.race.time;this.raceBest=this.raceBest===null?time:Math.min(time,this.raceBest);this.reward(120,'完成摆荡赛道：'+time.toFixed(1)+' 秒');this.race=null;}else this.notify('通过光环 '+this.race.index+' / 8');}}
```

替换为：

```js
if(this.race){this.race.time+=dt;if(this.raceGhostRec&&this.raceGhostRec.length<3000&&Math.floor(this.race.time*10)>Math.floor((this.race.time-dt)*10))this.raceGhostRec.push([Math.round(this.p.x*10)/10,Math.round(this.p.y*10)/10,Math.round(this.p.z*10)/10]);if(this.raceGhost&&this.ghostPos&&this.raceGhost.samples.length){const gp=this.raceGhost.samples[Math.min(Math.floor(this.race.time*10),this.raceGhost.samples.length-1)];this.ghostPos=V(gp[0],gp[1],gp[2]);}if(length(sub(this.p,this.race.points[this.race.index]))<13){this.race.index++;if(this.race.index===this.race.points.length){const time=this.race.time,beat=!!(this.raceGhost&&time<this.raceGhost.time);this.raceBest=this.raceBest===null?time:Math.min(time,this.raceBest);if(!this.raceGhost||beat){this.raceGhost={time,samples:this.raceGhostRec||[]};this.notify(beat?'胜过幽灵！新纪录 '+time.toFixed(1)+' 秒，幽灵已更新。':'幽灵已记录：'+time.toFixed(1)+' 秒。再跑一次，试着赢过它！');}else this.notify('完成赛道：'+time.toFixed(1)+' 秒 · 幽灵 '+this.raceGhost.time.toFixed(1)+' 秒还是快些。');if(beat)this.stats.raceWins++;this.reward(120,'完成摆荡赛道');this.ghostPos=null;this.raceGhostRec=null;this.race=null;}else this.notify('通过光环 '+this.race.index+' / 8');}}
```

3d. makeAdventure 幽灵渲染——找到 `if(sim.race){const p=sim.race.points[sim.race.index];` 在其前插入一行：

```js
if(sim.race&&sim.ghostPos)person(g,sim.ghostPos,color('#7ee2ff'),0,false,sim.race.time);
```

3e. features.js persist——找到 `keys,achievements:[...achievements.unlocked],stats:{...sim.stats}}))` 替换为：

```js
keys,achievements:[...achievements.unlocked],stats:{...sim.stats},raceGhost:sim.raceGhost||null}))
```

features.js load——找到 `if(Array.isArray(saved.backpacks))sim.backpacks.forEach((b,i)=>b.found=!!saved.backpacks[i]);` 在其后插入：

```js
if(saved.raceGhost&&saved.raceGhost.time>0&&Array.isArray(saved.raceGhost.samples))sim.raceGhost={time:Number(saved.raceGhost.time)||0,samples:saved.raceGhost.samples.filter(a=>Array.isArray(a)&&a.length===3).slice(0,3000)};
```

- [ ] **Step 4: 运行测试确认通过 + 语法**

Run: `node tests/achievements.test.mjs && node --check adventure.js && node --check features.js`
Expected: 全绿（含 `ghost race test: pass`）。

- [ ] **Step 5: 提交**

```bash
git add adventure.js features.js tests/achievements.test.mjs
git commit -m "Record and replay ghost runs in swing time trials"
```

---

### Task 3: 护送任务（状态机/跟随/渲染/HUD）

**Files:**
- Modify: `adventure.js`（startEscort/stopEscort/interactActivity/enterShop/stopRest/市民 AI 守卫/update 护送块/makeAdventure 渲染）
- Modify: `index.html`（#escortStatus 元素）
- Modify: `game3d.js`（updateHUD 护送行 + stopRest 动态文案）
- Modify: `features.js`（stopRest hidden 条件）
- Modify: `style.css`（#escortStatus 样式，末尾追加）
- Modify: `tests/achievements.test.mjs`（追加 escort 测试块）

**Interfaces:**
- Consumes: Task 2 的构造函数字段（escort/escortCooldown）、`stats.escortsDone`。
- Produces: `sim.startEscort(c)`/`sim.stopEscort(silent)`；DOM `#escortStatus`。

- [ ] **Step 1: 追加失败测试到 tests 末尾**

```js
// --- escort state machine: follow, deliver, fail, request spawn ---
const worldE=createWorld();const simE=new Adventure(worldE);
const cit=simE.civilians[0];
simE.startEscort(cit);
assert.ok(simE.escort&&simE.escort.timeLeft>89&&simE.escort.timeLeft<=90,'护送应开始且计时 90 秒');
assert.equal(cit.escortRequest,false,'接单应清除请求标记');
const destE=simE.escort.dest;
const inE={forward:0,right:0,jump:false,webLeft:false,webRight:false,attack:false,climb:false};
simE.p={x:destE.x,y:1.6,z:destE.z};
for(let i=0;i<180;i++)simE.update(1/60,inE,0);
assert.equal(simE.escort,null,'到达目的地应完成护送');
assert.equal(simE.stats.escortsDone,1,'完成应计数');
assert.ok(Math.hypot(cit.home.x-destE.x,cit.home.z-destE.z)<1,'市民新家应设在目的地');
simE.startEscort(simE.civilians[1]);
simE.escort.timeLeft=0.05;
simE.update(1/60,inE,0);
assert.equal(simE.escort,null,'超时应失败');
assert.ok(simE.escortCooldown>0,'失败后应进入冷却');
simE.escortCooldown=0.01;
simE.update(1/60,inE,0);
assert.ok(simE.civilians.some(c=>c.escortRequest),'冷却结束应生成新请求');
const checkEscort=ACHIEVEMENTS.find(a=>a.id==='escort-1');
assert.equal(checkEscort.check(simE,simE.stats),true,'escort-1 应达成');
console.log('escort test: pass');
```

- [ ] **Step 2: 运行确认失败**（startEscort 不是函数）

Run: `node tests/achievements.test.mjs`

- [ ] **Step 3: adventure.js 七处修改**

3a. 两个新方法——找到 `stopRest(){` 在其前插入一行：

```js
 startEscort(c){const near=this.world.shops.map(s=>({s,d:Math.hypot(s.door.x-c.p.x,s.door.z-c.p.z)})).filter(q=>q.d>200&&q.d<650),pool=near.length?near:this.world.shops.map(s=>({s})),pick=pool[Math.floor(Math.random()*pool.length)].s,dest=V(pick.door.x,1.6,pick.door.z+2);this.escort={citizen:c,dest,destName:pick.name,timeLeft:90};c.escortRequest=false;this.notify('护送开始：送'+(c.name||'邻居')+'到'+pick.name+' · 90 秒，带着 TA 一起飞过去。');return true;}
 stopEscort(silent=false){if(!this.escort)return false;const c=this.escort.citizen;this.escort=null;this.escortCooldown=30;if(!silent)this.notify('已放弃护送，'+(c.name||'邻居')+'自己回去了。');return true;}
```

3b. stopRest 优先取消护送——找到 `stopRest(){if(this.hanging){` 替换为：

```js
stopRest(){if(this.escort){this.stopEscort();return;}if(this.hanging){
```

3c. enterShop 取消护送——找到 `enterShop(shop){this.stopRest();super.enterShop(shop);}` 替换为：

```js
enterShop(shop){this.stopEscort(true);this.stopRest();super.enterShop(shop);}
```

3d. 市民 AI 守卫——找到 `for(const c of this.civilians){c.react=Math.max(0,c.react-elapsed);if(c.react||Math.hypot(` 替换为：

```js
for(const c of this.civilians){c.react=Math.max(0,c.react-elapsed);if(this.escort&&c===this.escort.citizen)continue;if(c.react||Math.hypot(
```

3e. update 护送块——找到市民 AI 块结尾 `if(!firstWall(add(c.p,V(0,1.6,0)),add(next,V(0,1.6,0)),nearbySolids))c.p=next;}}` 在其后插入：

```js
if(this.escort){const e=this.escort;e.timeLeft-=dt;const c=e.citizen;c.p=add(c.p,mul(sub(this.p,c.p),1-Math.exp(-8*dt)));if(length(sub(c.p,e.dest))<11){this.stats.escortsDone++;c.home={...e.dest};this.reward(120,'护送完成：'+e.destName);this.notify('把'+(c.name||'邻居')+'送到了'+e.destName+'！');this.escort=null;this.escortCooldown=45;}else if(e.timeLeft<=0){this.notify('没能在时间内送到，'+(c.name||'邻居')+'自己回去了。');this.escort=null;this.escortCooldown=45;}}else if(!this.interior&&this.options.citizens){this.escortCooldown-=dt;if(this.escortCooldown<=0){const c=this.civilians[Math.floor(Math.random()*this.civilians.length)];if(!c.escortRequest){c.escortRequest=true;this.notify('有邻居需要护送：找头顶亮着感叹号的市民，按互动接下委托。');}this.escortCooldown=30;}}
```

3f. interactActivity 接单分支——找到 `const citizen=this.options.citizens&&this.civilians.find(c=>length(sub(add(c.p,V(0,1.6,0)),this.p))<7);if(!citizen)return false;citizen.react=5;` 替换为：

```js
const citizen=this.options.citizens&&this.civilians.find(c=>length(sub(add(c.p,V(0,1.6,0)),this.p))<7);if(!citizen)return false;if(citizen.escortRequest&&!this.escort){this.startEscort(citizen);return true;}citizen.react=5;
```

3g. makeAdventure 渲染——找到 `for(const b of sim.backpacks)if(!b.found&&length(sub(b.p,sim.p))<150){` 在其前插入一行：

```js
if(!sim.escort&&sim.options.citizens)for(const c of sim.civilians)if(c.escortRequest&&length(sub(c.p,sim.p))<120){const bob=Math.sin(sim.time*4)*.2;g.cone(c.p.x,c.p.y+3.1+bob,c.p.z,.3,.7,neon);g.limb(add(c.p,V(0,3+bob,0)),add(c.p,V(0,4.1+bob,0)),.09,neon);}
if(sim.escort){g.limb(add(sim.p,V(0,1,0)),sim.escort.citizen.p,.05,sim.customWeb);const p=sim.escort.dest;for(let i=0;i<20;i++){const a=i/20*Math.PI*2,b=(i+1)/20*Math.PI*2;g.limb(add(p,V(Math.cos(a)*11,Math.sin(a)*11,0)),add(p,V(Math.cos(b)*11,Math.sin(b)*11,0)),.16,neon);}}
```

- [ ] **Step 4: index.html / game3d.js / features.js / style.css**

4a. index.html——找到 `<div id="bindStatus" hidden></div>` 替换为：

```html
<div id="bindStatus" hidden></div><div id="escortStatus" hidden></div>
```

4b. game3d.js updateHUD——找到 `$('climbStatus').hidden=!sim.climbing;if(sim.climbing)$('climbStatus').textContent=sim.ceilingCrawl?'倒挂爬行 · 摇杆移动':'攀墙中 · 摇杆向上 / 下，左右移动';` 在其后插入：

```js
const escortNow=sim.escort;$('escortStatus').hidden=!escortNow;if(escortNow)$('escortStatus').textContent='护送中 · 送'+(escortNow.citizen.name||'邻居')+'到'+escortNow.destName+' · '+Math.ceil(escortNow.timeLeft)+' 秒';$('stopRest').textContent=sim.escort?'放弃护送':'起身 / 收回蛛丝';
```

4c. features.js——找到 `$('stopRest').hidden=!sim.resting&&!sim.hanging;` 替换为：

```js
$('stopRest').hidden=!sim.resting&&!sim.hanging&&!sim.escort;
```

4d. style.css 末尾追加：

```css
#escortStatus{position:absolute;top:170px;left:50%;transform:translateX(-50%);padding:8px 15px;border-radius:20px;background:#5a4a2fd9;border:1px solid #ffd98a;color:#ffe9c2;font-size:12px;z-index:4;pointer-events:none}@media(max-width:600px){#escortStatus{top:275px;font-size:10px}}
```

- [ ] **Step 5: 运行测试 + 语法检查**

Run: `node tests/achievements.test.mjs && for f in adventure.js game3d.js features.js; do node --check $f; done`
Expected: 全绿（含 `escort test: pass`）。

- [ ] **Step 6: 提交**

```bash
git add adventure.js index.html game3d.js features.js style.css tests/achievements.test.mjs
git commit -m "Add citizen escort missions with follow AI and delivery rings"
```

---

### Task 4: README + 版本号统一 + 全量验证

**Files:**
- Modify: `README.md`、全部含 `?v=20261006achv` 的文件（index.html、collision.js、game3d.js、world3d.js、adventure.js、features.js、hero-pose.js、settings.js、town-details.js、achievements.js 无需——自身无版本引用，但 features/game3d 引用它时要改）

**Interfaces:** 无新接口；产出可部署状态。

- [ ] **Step 1: 版本号替换**

```bash
sed -i '' 's/20261006achv/20261006ghost/g' index.html collision.js game3d.js world3d.js adventure.js features.js hero-pose.js settings.js town-details.js
grep -l '20261006achv' *.js index.html 2>/dev/null || echo "no stale refs"
```

Expected: `no stale refs`。

- [ ] **Step 2: README 增补**——在「马卡龙街景与角色美化」章节之前插入新章节：

```markdown
## 幽灵竞速与护送（2026-10-06）

摆荡计时赛会录制你的路线：创造纪录后，下次竞速会有一个青色幽灵按旧纪录同步重跑，赢过它刷新纪录，成就「胜过幽灵」解锁。街头偶尔会出现头顶亮感叹号的市民，靠近按互动接下护送，带着 TA（蛛丝系绳跟随）在 90 秒内飞进目的地金色光环即可完成，中途可点「放弃护送」。新增成就「护送起步」，成就总数 20。
```

- [ ] **Step 3: 全量验证**

```bash
for f in *.js; do node --check "$f" || echo "FAIL $f"; done
node tests/achievements.test.mjs
node --input-type=module -e "import {readFileSync,existsSync} from 'fs';let bad=0,refs=0;for(const f of ['index.html','achievements.js','adventure.js','collision.js','engine3d.js','features.js','game3d.js','hero-pose.js','settings.js','settings-model.js','town-catalog.js','town-details.js','world3d.js']){const t=readFileSync(f,'utf8');for(const m of t.matchAll(/'\.\/([a-z0-9-]+\.js)\?v=([^']+)'/g)){refs++;if(!existsSync(m[1])||m[2]!=='20261006ghost')bad++;}for(const m of t.matchAll(/(?:src|href)=\"([a-z0-9.-]+\.(?:js|css))\?v=([^\"]+)\"/g)){refs++;if(!existsSync(m[1])||m[2]!=='20261006ghost')bad++;}}console.log('refs',refs,'bad',bad);if(bad)process.exit(1);"
```

Expected: 语法全过、测试 5 组全绿、`bad 0`。

- [ ] **Step 4: 提交（不推送，推送由终审合并后统一进行）**

```bash
git add -A -- ':!.superpowers'
git commit -m "Bump cache version for ghost-escort release and update README"
```

（注意排除 `.superpowers` 草稿目录；仓库无 .gitignore。）

---

## 计划自审记录

- **Spec 覆盖**：录制/重放/结算/持久化（T2）✓ 护送状态机/跟随/渲染/HUD/放弃与连带取消（T3）✓ 成就 20 + fixtures（T1）✓ README/版本号/验证（T4）✓ 冒烟由控制器执行（预写 raceGhost 存档看幽灵、护送全流程、手记 x/20）。
- **类型一致性**：`startEscort(c)/stopEscort(silent)`、`escort={citizen,dest,destName,timeLeft}`、`raceGhost={time,samples}`、stats 字段 `raceWins/escortsDone` 在各任务与 spec 一致；DOM id `escortStatus` 在 T3 的 index.html（结构）与 game3d.js（读写）一致。
- **已知取舍**：幽灵重放在样本耗尽时定格于末样本（竞速时长超旧纪录即必败，可接受）；护送跟随无碰撞检测（市民贴着英雄飞，渲染上有系绳解释）；`escort` 块位于 rest 早退之前，休息时计时继续（与竞速计时同语义）。
- **风险备注**：T2 测试用「瞬移到最后光环」制造冲线，依赖 race.time 尚小 → 第二次竞速必然判 `beat`，属于测试构造而非玩法缺陷；updateHUD 的 `$('escortStatus')` 依赖 T3 的 index.html 改动，两者同任务落地。

## 执行修正记录（控制器批准）

1. Task 3 测试超时值 0.05→0.01：0.05 扣一帧(1/60)后仍为正，超时分支永不触发。
2. Task 3 修复轮：`skill()` 不再经 `stopRest()` 清休息态（改为直接 `this.resting=false;this.hanging=null;`）——否则护送中释放任何技能都会立即弃单，护送玩法不可用；`stopRest()` 本体与其余调用点（teleport/visitShop/enterShop/startRace）保持取消护送语义。
3. 终审修复轮：护送失败/放弃时市民送回 `home`（与"自己回去了"提示一致，避免市民滞留屋顶/半空）；`stopRest` 护送分支不再提前 return（弃单同时脱离休息/倒挂）；`startEscort` 增加进行中守卫；请求标记距离判定改 `Math.hypot` 免分配；`raceGhost` 载入校验样本值 `Number.isFinite`；`interactActivity`/`nearbyActivity` 优先匹配 `escortRequest` 市民（接单可发现性）；`#escortStatus` 移动端 top 285px 并补 `max-height:520px` 横屏规则。
