# 幽灵竞速 + 护送任务 设计

日期：2026-10-06 · 状态：已批准（用户指示跳过交互确认，直接实施）
上游：路线图第 ② 站（docs/superpowers/specs/2026-10-06-achievements-stats-design.md 结尾的路线图）

## 目标

1. **幽灵竞速**：摆荡计时赛录制玩家路线；产生纪录后，后续竞速中一个半透明"幽灵"按纪录同步重跑，击败幽灵成为新的循环目标。
2. **护送任务**：市民头顶亮起标记时按互动接下护送，带着 TA（网系跟随）在 90 秒内飞到目标店铺门口的光环，完成得风格分。
3. **成就扩展**：注册表 18→20（`escort-1` 护送起步 100 分、`ghost-beat` 胜过幽灵 120 分），验证"新功能零成本接入成就"。

## 幽灵竞速

- **录制**：`startRace()` 时建 `raceGhostRec=[]`；竞速中（`update` 的 race 块）每当 `floor(race.time*10)` 跨档，push `[x,y,z]`（各保留 1 位小数），上限 3000 样本（300 秒）。
- **重放**：有 `raceGhost` 时，`ghostPos` 每帧取 `samples[min(floor(time*10), len-1)]`；`makeAdventure` 用现有 `person()` 以青色 `#7ee2ff` 绘制幽灵。
- **结算**：冲线时若 `!raceGhost || time<raceGhost.time` → `raceGhost={time,samples}` 并更新（首存文案"幽灵已记录"，胜过文案"胜过幽灵！"且 `stats.raceWins++`）；否则提示幽灵仍领先。`raceBest` 逻辑不变。
- **持久化**：features.js persist 增加 `raceGhost`；load 时校验 `time>0`、samples 为 3 元数组、截断 3000。
- 清理：冲线或放弃后 `ghostPos=null`、`raceGhostRec=null`（`startRace` 重建）。

## 护送任务

- **状态机**（Adventure 新字段：`escort=null|{citizen,dest,destName,timeLeft}`、`escortCooldown=25` 秒）：
  - 生成：`!escort && !interior && options.citizens` 时冷却递减，归零随机挑一名市民置 `escortRequest=true` 并 toast 提示，冷却重置 30 秒。
  - 接单：`interactActivity()` 市民分支最前——市民有 `escortRequest` 且无进行中护送 → `startEscort(c)`：随机选距市民 200~650 的店铺为目的地（无候选则全城随机兜底），`timeLeft=90`。
  - 跟随：护送中市民每帧向玩家插值（`1-exp(-8dt)`），渲染蛛丝系绳（玩家手→市民）；市民 AI 跳过被护送者。
  - 完成：市民距 `dest` <11 → `stats.escortsDone++`、风格 +120、市民 `home` 改为目的地、冷却 45 秒。
  - 失败：`timeLeft<=0` → 提示、冷却 45 秒。
  - 放弃：`#stopRest` 按钮扩展为护送中显示"放弃护送"（features.js hidden 条件 + game3d.js 动态文案）；`stopRest()` 优先走 `stopEscort()`。
  - 连带：`enterShop` 时静默取消护送（`stopEscort(true)`）；`startRace` 经 `stopRest()` 同样取消。
- **渲染**（makeAdventure）：请求市民头顶弹跳感叹号（锥+棒，neon 色，120 距离内）；护送中目的地画 11 半径 neon 光环（复用竞速环画法）。
- **HUD**：新元素 `#escortStatus`（index.html，bindStatus 之后），updateHUD 每 100ms 更新"护送中 · 送XX到YY · N 秒"。

## 成就（+2，共 20）

| id | 名称 | 条件 | 奖励 |
|---|---|---|---|
| `escort-1` | 护送起步 | `stats.escortsDone>=1` | 100 |
| `ghost-beat` | 胜过幽灵 | `stats.raceWins>=1` | 120 |

stats 新增 `raceWins`、`escortsDone` 两字段（持久化循环按 `sim.stats` 键自动适配，老存档缺字段补 0）。

## 测试

1. 成就 fixtures 更新（18→20、stats 补字段、奖励和动态断言自动适配）。
2. 幽灵：竞速中样本增长；制造冲线 → `raceGhost` 落库字段、`raceBest` 更新；二次竞速 `ghostPos` 从样本初始化并随时间推进；刻意快于幽灵 → `raceWins>=1` 且 `ghost-beat` 达成。
3. 护送：`startEscort` 后 `timeLeft` 递减、市民向玩家收敛（玩家传送至目的地 → 数秒内完成 → `escortsDone=1`）；超时失败路径；冷却后自动生成 `escortRequest`。
4. 浏览器冒烟：预写含 raceGhost 的存档开竞速可见幽灵；击发护送请求→接单→护送 HUD→（瞬移至目的地）完成 toast；手记成就显示 x/20。
5. 惯例：`node --check` 全过、模块引用版本统一 `?v=20261006ghost`、README 增补说明。

## 非目标

不做竞速路线编辑器、不做多人幽灵分享、不做护送中断AI（市民不会中途反悔）、不给幽灵做透明度（渲染器无 alpha，用纯色区分）、不做手动选目的地。
