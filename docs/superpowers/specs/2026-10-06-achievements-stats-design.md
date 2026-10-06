# 成就 + 统计系统设计（蜘蛛侠 · 自由之城）

日期：2026-10-06 · 状态：待用户审阅

## 背景与目标

游戏已有丰富玩法（摆荡、Boss、逛店、事件、竞速、拍照），但缺少跨系统的目标感和长期进度呈现。本设计新增：

1. **成就系统**：18 个成就（里程碑 12 + 技巧挑战 6），达成时弹窗提示并奖励风格分；全部达成解锁终极奖励。
2. **蜘蛛履历（统计页）**：在城市手记中集中展示累计游玩数据。

设计原则：声明式成就注册表（方案 A）——所有成就为纯数据定义 + 纯函数判定，中央检查器以 10Hz 轮询。新增成就 = 新增一行数据，不改玩法代码；判定逻辑可在 Node 中直接测试，延续仓库现有的 Node 验证习惯。

## 架构

### 新模块 `achievements.js`（零 DOM 依赖）

```js
// 成就定义（纯数据 + 纯函数）
export const ACHIEVEMENTS = [
  { id:'first-swing', name:'初次摆荡', desc:'第一次用蛛丝挂上建筑', reward:50,
    check:(s,t)=>t.websFired>0 }, // 示意；完整名单见下文
  ...
];
export const ULTIMATE = { suit:{name:'午夜鎏金', red:'#2b2d42', blue:'#c9a227'} };

// 检查器：由 features.js 驱动
export class AchievementSystem {
  constructor(sim){ this.sim=sim; this.unlocked=new Set(); this.accumulator=0; }
  load(saved){...}                 // 从存档恢复已达成列表
  tick(dt){...}                    // 累计到 0.1s 批量检查未达成项
  checkAll(){...}                  // 遍历未达成成就，check(sim, sim.stats) 为真则达成
  onUnlock(a){...}                 // 加风格分、toast、音效、立即存档；返回达成列表供测试
}
```

- 每个成就 `check(sim, stats)` 只读 `sim` 现有状态和 `sim.stats` 累计值，**不写任何状态**。
- `checkAll()` 内每个 check 单独 try/catch：单个成就异常只跳过该项并 `console.warn`，不影响游戏帧循环。
- 达成顺序按数组定义顺序，同一次检查最多达成全部满足项（允许一次弹多个，toast 依次显示）。

### 统计器 `sim.stats`

`Adventure` 构造函数初始化，`update()` 中累加。持久化字段：

| 字段 | 含义 | 累加点 |
|---|---|---|
| `playTime` | 累计游玩秒数 | `Adventure.update()` 每次 `+= dt` |
| `flightDistance` | 累计空中移动距离 | `super.update()` 前后位置差，`!grounded` 且单帧位移 ≤50（超过视为传送/倒挂换位，不计入）时累加 |
| `maxSpeed` | 历史最高水平速度 | `update` 末尾 `Math.hypot(v.x,v.z)` 取最大 |
| `websFired` | 蛛丝发射次数 | `attach()` 成功、`attack()`/`bind`/`zip` 各发射点 +1 |
| `enemiesDefeated` | 击败敌人数 | 各击杀点调用 `countKill()` 辅助（Boss 弹丸击杀、轻重击、范围网迈尔斯电击、环境投掷） |
| `citizenTalks` | 市民交谈次数 | `interactActivity()` 市民分支 |
| `perfectDodges` | 完美闪避次数 | `skill('dodge')` 完美分支 |
| `tricks` | 空中特技次数 | `skill('trick')` |

会话内临时值（不持久化）：`noLandingDistance`（单次不落地距离，落地清零，只在空中累加）。

## 成就名单（18 个）

### 里程碑（12）

| id | 名称 | 达成条件 | 奖励 |
|---|---|---|---|
| `first-swing` | 初次摆荡 | 首次蛛丝挂上建筑 | 50 |
| `double-web` | 双手齐发 | 两只手同时挂住 | 80 |
| `first-boss` | 初战告捷 | 击败任意 Boss | 100 |
| `all-bosses` | 城市守护者 | 三个 Boss 全部击败 | 200 |
| `shopper-5` | 街区常客 | 逛店 5 家 | 50 |
| `shopper-20` | 探店达人 | 逛店 20 家 | 100 |
| `shopper-67` | 小镇活地图 | 逛店全部 67 家 | 300 |
| `backpacks-5` | 记忆收藏家 | 找齐 5 个背包 | 100 |
| `photos-4` | 城市摄影师 | 打卡全部 4 个地标 | 100 |
| `events-7` | 邻里英雄 | 完成 7 个城市事件 | 200 |
| `citizens-10` | 社区之友 | 与 10 位市民交谈 | 80 |
| `style-5000` | 风格传奇 | 累计风格分 5000（含成就奖励） | 150 |

### 技巧挑战（6）

| id | 名称 | 达成条件 | 奖励 |
|---|---|---|---|
| `no-landing-1000` | 一气呵成 | 单次不落地飞行 1000 距离 | 150 |
| `speed-120` | 音速穿行 | 水平速度达到 120 | 100 |
| `combo-5` | 连击大师 | 连击达到 ×5 | 100 |
| `stunt-600` | 特技之星 | 特技评分挑战单场 600 分 | 150 |
| `perfect-dodge-3` | 蜘蛛感应 | 完美闪避累计 3 次 | 100 |
| `tricks-50` | 空中芭蕾 | 空中特技累计 50 次 | 120 |

成就奖励合计 2230 风格分，直接计入 `sim.style`（会助推 120/300 分战衣解锁，属预期效果）。

### 终极大奖

18 个全部达成后：

- 服装店（织光）新增第 6 个选项「午夜鎏金」战衣（深藏蓝 `#2b2d42` + 鎏金 `#c9a227`），免费试穿、离店保留，不占风格门槛；
- 手记成就页点亮「城市传奇」徽章。

解锁判定实时由 `unlocked.size===ACHIEVEMENTS.length` 推导，不额外存档。

## 数据流与存档

扩展现有 `spider-neon-adventure` 存档（`features.js` persist/load）：

```js
{ character, difficulty, style, raceBest, visited, backpacks, keys,
  achievements:['first-swing',...],        // 新增
  stats:{ playTime, flightDistance, maxSpeed, websFired,
          enemiesDefeated, citizenTalks, perfectDodges, tricks } // 新增
}
```

- 老存档缺字段 → `load()` 按空列表/全 0 默认初始化（与现有 `raceBest` 容错一致），无迁移。
- 达成瞬间立即 `persist()`（不等 5 秒周期），防刷新丢失。
- localStorage 写入失败沿用现有 try/catch + toast 提示。

## 触发与提示

- `AchievementSystem.tick(dt)` 挂在 `features.tick()`（每帧调用，内部累计 0.1s 才真正检查）。
- 达成时：`toast('🏆 成就达成：' + 名称 + ' · 风格 +' + reward)`（复用现有 toast，多个成就排队显示最后一条即可）；
- `CityAudio` 新增 `achievement()` 方法：上行双音（880Hz → 1320Hz 三角波，各 0.15s），走 `effects` 总线受音量设置控制。

## UI：城市手记改造

- `journalStats` 单行文案升级为「蜘蛛履历」网格：游玩时长（x 分 x 秒）、摆荡总距离、最高速度、蛛丝发射、击败敌人、市民交谈、完美闪避、空中特技、成就 x/18。
- 新增「成就」区块：18 个条目列表——已达成的显示名称 + 奖励分（高亮）；未达成的显示名称 + 描述（灰化，描述即攻略提示）。终极奖励未解锁时在列表尾部显示「？？？：达成全部成就后，织光服装店会有新衣」。文案复用 `journalOverlay` 现有结构，仅加一个容器 div，样式在 `style.css` 补一个区块。

## 错误处理

- 单个 check 抛异常：捕获、跳过、`console.warn`，不阻断其余成就与游戏。
- `sim.stats` 字段缺失（老存档/异常）：读取时逐字段 `Number()||0` 兜底。
- 成就奖励加风格分与 `style-5000` 判定存在自反馈（达成后 style 增长），单调递增无死循环风险。

## 测试计划

1. **Node 单元**：每个成就的 check 用构造的 sim/stats 状态断言真假（不需要跑物理）。
2. **Node 集成**：`createWorld + Adventure` 跑 240 帧带输入模拟，断言 stats 累加合理（websFired>0、flightDistance>0、maxSpeed>0）且 `first-swing` 达成。
3. **存档往返**：模拟 persist 对象 → load → unlocked/stats 恢复一致；老格式（无新字段）load 不抛异常。
4. **浏览器冒烟**：本地服务器打开游戏，预写含成就的存档 → 刷新 → 手记页显示成就与履历 → 进游戏确认 HUD 正常（沿用本次修复的验证方法）。
5. 仓库惯例：全部文件 `node --check`、模块 `?v=` 版本号统一升级（`20261006achv`）、22 处模块引用一致性检查。

## 涉及文件

| 文件 | 改动 | 量级 |
|---|---|---|
| `achievements.js` | 新建：18 成就定义 + AchievementSystem + ULTIMATE | ~120 行 |
| `adventure.js` | stats 初始化 + update 累加 + 各发射/击杀/互动点 +1 | ~25 行 |
| `features.js` | 存档扩展、AchievementSystem 接线、手记渲染、音效方法调用 | ~50 行 |
| `settings.js` | CityAudio.achievement() 方法 | ~3 行 |
| `game3d.js` | openShopMenu 服装店第 6 项（午夜鎏金） | ~5 行 |
| `index.html` / `style.css` | 手记履历 + 成就区块结构样式 | ~30 行 |
| 全部 js/html | 版本号 `?v=` → `20261006achv` | 替换 |

## 非目标（本期不做）

- 不做独立成就面板 overlay（手记陈列 + toast 足够，YAGNI）；
- 不做成就点数/等级体系；
- 不为尚未实现的犯罪热度、护送等预写成就（但注册表结构保证未来零成本接入）;
- 不做文案多语言。

## 验收标准

1. 达成任一成就：toast + 专属音效 + 存档立即写入，刷新后不丢失；
2. 18 成就 + 终极奖励按名单表行为正确（含灰化/高亮状态）；
3. 蜘蛛履历各项数值随游玩增长，刷新后累计；
4. 老存档（无新字段）加载不报错、行为不变；
5. 全部达成后织光服装店出现「午夜鎏金」并可穿着离店；
6. Node 回归（单元 + 集成 + 存档往返）全绿，`node --check` 全过，模块引用版本一致；
7. 浏览器冒烟测试通过（启动、成就模拟触发、手册显示）。
