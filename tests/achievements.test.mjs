import assert from 'node:assert/strict';
import {ACHIEVEMENTS,AchievementSystem,ULTIMATE_SUIT} from '../achievements.js';

const fullSim={ropes:[{},{}],combo:5,noLandingDistance:1000,style:5000,stuntChallenge:{score:600},
 world:{bosses:[{dead:true},{dead:true},{dead:true}],shops:new Array(67)},
 visited:new Set(Array.from({length:67},(_,i)=>String(i))),
 backpacks:[{found:true},{found:true},{found:true},{found:true},{found:true}],
 photos:new Set([1,2,3,4]),events:Array.from({length:7},()=>({state:'done'})),
 stats:{websFired:9,citizenTalks:10,maxSpeed:130,perfectDodges:3,tricks:50,raceWins:1,escortsDone:1}};
const emptySim={ropes:[],combo:0,noLandingDistance:0,style:0,stuntChallenge:null,
 world:{bosses:[{dead:false},{dead:false},{dead:false}],shops:new Array(67)},
 visited:new Set(),backpacks:[{found:false}],photos:new Set(),events:[{state:'ready'}],
 stats:{websFired:0,citizenTalks:0,maxSpeed:0,perfectDodges:0,tricks:0,raceWins:0,escortsDone:0}};

assert.equal(ACHIEVEMENTS.length,20,'应有 20 个成就');
assert.equal(new Set(ACHIEVEMENTS.map(a=>a.id)).size,20,'成就 id 不得重复');
for(const a of ACHIEVEMENTS){
 assert.equal(typeof a.reward,'number');
 assert.equal(a.check(fullSim,fullSim.stats),true,a.id+' 应在满足状态达成');
 assert.equal(a.check(emptySim,emptySim.stats),false,a.id+' 不应在空状态达成');
}
const sys=new AchievementSystem(fullSim);
const fresh=sys.checkAll();
assert.equal(fresh.length,20,'首次全检应全部达成');
assert.equal(sys.complete,true);
const styleAfter=fullSim.style;
assert.equal(styleAfter,5000+ACHIEVEMENTS.reduce((n,a)=>n+a.reward,0),'奖励风格分应已入账');
assert.equal(sys.checkAll().length,0,'重复检查不得重复发奖');
const sys2=new AchievementSystem(emptySim);
sys2.load({achievements:['first-swing','nope-not-real']});
assert.deepEqual([...sys2.unlocked],['first-swing'],'load 应忽略未知 id');
assert.equal(ULTIMATE_SUIT.name,'午夜鎏金');
console.log('achievements unit tests: all pass');

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

// --- save roundtrip: persist shape restores unlocked set; legacy/garbage saves load without throwing ---
const persistShape={achievements:[...sys.unlocked],stats:{...fullSim.stats}};
const rt=new AchievementSystem(fullSim);rt.load(persistShape);
assert.equal(rt.unlocked.size,20,'persist 形状的存档应恢复全部成就');
const rtLegacy=new AchievementSystem(emptySim);rtLegacy.load(null);
assert.equal(rtLegacy.unlocked.size,0,'null 存档应安全得到空成就集');
const rtGarbage=new AchievementSystem(emptySim);rtGarbage.load({achievements:'garbage',stats:42});
assert.equal(rtGarbage.unlocked.size,0,'畸形存档不得抛异常且为空集');
console.log('save roundtrip test: pass');

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
simE.escort.timeLeft=0.01;
simE.update(1/60,inE,0);
assert.equal(simE.escort,null,'超时应失败');
assert.ok(simE.escortCooldown>0,'失败后应进入冷却');
assert.ok(Math.hypot(simE.civilians[1].home.x-simE.civilians[1].p.x,simE.civilians[1].home.z-simE.civilians[1].p.z)<1,'失败后市民应被送回原地');
assert.equal(simE.stats.escortsDone,1,'超时不得计入完成');
simE.escortCooldown=0.01;
simE.update(1/60,inE,0);
assert.ok(simE.civilians.some(c=>c.escortRequest),'冷却结束应生成新请求');
const checkEscort=ACHIEVEMENTS.find(a=>a.id==='escort-1');
assert.equal(checkEscort.check(simE,simE.stats),true,'escort-1 应达成');
console.log('escort test: pass');
