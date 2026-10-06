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
 {id:'tricks-50',name:'空中芭蕾',desc:'空中特技累计 50 次',reward:120,check:(s,t)=>t.tricks>=50},
 {id:'escort-1',name:'护送起步',desc:'完成第一次护送',reward:100,check:(s,t)=>t.escortsDone>=1},
 {id:'ghost-beat',name:'胜过幽灵',desc:'在幽灵竞速中跑赢你自己的幽灵',reward:120,check:(s,t)=>t.raceWins>=1}
];
export class AchievementSystem{
 constructor(sim){this.sim=sim;this.unlocked=new Set();this.clock=0;this.onunlock=null;}
 get complete(){return this.unlocked.size>=ACHIEVEMENTS.length;}
 load(saved){if(saved&&Array.isArray(saved.achievements))for(const id of saved.achievements)if(ACHIEVEMENTS.some(a=>a.id===id))this.unlocked.add(id);}
 tick(dt){this.clock+=dt;if(this.clock<.1)return;this.clock=0;this.checkAll();}
 checkAll(){const fresh=[];for(const a of ACHIEVEMENTS){if(this.unlocked.has(a.id))continue;try{if(a.check(this.sim,this.sim.stats||{})){this.unlocked.add(a.id);fresh.push(a);}}catch(e){console.warn('成就检查异常',a.id,e);}}if(fresh.length){for(const a of fresh)this.sim.style+=a.reward;if(this.onunlock)this.onunlock(fresh);}return fresh;}
}
