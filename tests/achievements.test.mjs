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
