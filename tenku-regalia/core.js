export const VERSION = '0.4.2';
export const CHARACTERS = [
 {id:0,name:'女神 セレス',short:'セレス',role:'蒼空の女神',color:'#7de9ff',hp:1.12,shot:1,fire:1,skill:1.30,speed:1,desc:'高いHPと強力な晶撃。初めての冒険にも。'},
 {id:1,name:'FATE LOG〜レイ',short:'レイ',role:'運命の観測者',color:'#c0b4ff',hp:.92,shot:1.35,fire:1.13,skill:1.05,speed:1.05,desc:'一発の威力が高い精密射撃。運命を撃ち抜く。'},
 {id:2,name:'AI曲芸師',short:'AI曲芸師',role:'星を操る魔導師',color:'#6bffd0',hp:.95,shot:.80,fire:1.18,skill:1.10,speed:1.04,desc:'2方向ショットで群れを迎撃。魔法のカードを展開。'},
 {id:3,name:'緑の少年',short:'緑の少年',role:'翠風の双銃士',color:'#b0fb73',hp:.90,shot:.83,fire:.70,skill:.85,speed:1.22,desc:'素早い移動と高速連射。翠風とともに駆ける。'}
];
export const STAGES = [
  {id:1,name:'旅立ちの日',sub:'はじまりの空域',target:80,difficulty:1,color:'#36d4ff'},
  {id:2,name:'雲のかけら',sub:'風渡る回廊',target:110,difficulty:1.2,color:'#7af4db'},
  {id:3,name:'空の見張り台',sub:'ラピス防衛戦',target:150,difficulty:1.4,color:'#65a6ff'},
  {id:4,name:'風渡る回廊',sub:'クリスタルの決戦',target:190,difficulty:1.65,color:'#d78cff'},
  {id:5,name:'天空の試練',sub:'天空の最終試練',target:90,difficulty:1.85,boss:true,color:'#c68cff'}
];
// Difficulty 3 retains the previous baseline. Bullet speed stays 20% at all levels.
export const DIFFICULTIES = [
  {level:1,name:'とてもやさしい',hp:.55,damage:.40,density:.65},
  {level:2,name:'やさしい',hp:.75,damage:.65,density:.80},
  {level:3,name:'標準',hp:1,damage:1,density:1},
  {level:4,name:'やや難しい',hp:1.35,damage:1.15,density:1.08},
  {level:5,name:'難しい',hp:1.80,damage:1.35,density:1.16},
  {level:6,name:'激ムズ',hp:2.40,damage:1.60,density:1.24},
  {level:7,name:'修羅',hp:3.20,damage:1.90,density:1.35},
  {level:8,name:'極限',hp:4.20,damage:2.30,density:1.45}
];
export const ENEMY_BULLET_SPEED = 170 * .20;
// HEX BREATH BOMB: short-lived wave; collisions are gameplay-side, independent of rendering.
export const HEX_BOMB = Object.freeze({mp:60,cooldown:12,duration:1.16,invulnerability:1.25,damageScale:1.65,bulletScore:12});
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const defaultSave=()=>({schema:1,selectedHero:0,summonCount:0,summonHistory:[],fragments:[0,0,0,0],gold:500,gems:0,xp:0,unlocked:1,bestCombo:0,totalKills:0,towerBest:0,clears:{},upgrades:{attack:0,hp:0,fire:0,skill:0},claims:[],settings:{sound:true,music:true,shake:true,vibration:true,quality:'low',autoFire:true,difficulty:3},lastStage:1});
const integer=(v,a,b,fallback)=>Number.isFinite(v)?clamp(Math.floor(v),a,b):fallback;
export function sanitizeSave(raw){
  if(!raw||raw.schema!==1)throw new Error('このゲームのバックアップではありません');
  const s=defaultSave();s.selectedHero=integer(raw.selectedHero,0,3,0);s.summonCount=integer(raw.summonCount,0,999999,0);s.summonHistory=Array.isArray(raw.summonHistory)?raw.summonHistory.filter(n=>Number.isInteger(n)&&n>=0&&n<4).slice(0,12):[];s.fragments=CHARACTERS.map((_,i)=>integer(raw.fragments?.[i],0,99999,0));
  for(const k of ['gold','gems','xp','bestCombo','totalKills','towerBest'])s[k]=integer(raw[k],0,999999999,s[k]);
  s.unlocked=integer(raw.unlocked,1,5,1);s.lastStage=integer(raw.lastStage,1,s.unlocked,1);
  for(const k of Object.keys(s.upgrades))s.upgrades[k]=integer(raw.upgrades?.[k],0,10,0);
  for(const k of ['sound','music','shake','vibration','autoFire'])if(typeof raw.settings?.[k]==='boolean')s.settings[k]=raw.settings[k];
  s.settings.quality=raw.settings?.quality==='high'?'high':'low';
  s.settings.difficulty=integer(raw.settings?.difficulty,1,8,3);
  for(let i=1;i<=5;i++){const c=raw.clears?.[i];if(c&&Number.isFinite(c.stars))s.clears[i]={stars:integer(c.stars,1,3,1),time:clamp(Number(c.time)||999,0,99999),score:integer(c.score,0,999999999,0)};}
  s.claims=Array.isArray(raw.claims)?[...new Set(raw.claims.filter(x=>['first','combo','hunter'].includes(x)))]:[];
  return s;
}
export function stats(save){const u=save.upgrades,c=CHARACTERS[save.selectedHero||0],f=Math.floor((save.fragments?.[c.id]||0)/5);return{hp:Math.round((320+u.hp*45)*c.hp),shot:Math.round((20+u.attack*3+f*2)*c.shot),slash:Math.round((68+u.attack*10)*c.shot),fireInterval:Math.max(.038,(.102-u.fire*.0038)*c.fire),skill:Math.round((145+u.skill*22)*c.skill),speed:c.speed};}
export function upgradeCost(level){return level>=10?Infinity:180+level*140;}
export function buyUpgrade(s,key){if(!Object.hasOwn(s.upgrades,key))return false;const cost=upgradeCost(s.upgrades[key]);if(s.gold<cost)return false;s.gold-=cost;s.upgrades[key]++;return true;}
export function commitResult(save,result){
  if(result.committed)return false;result.committed=true;
  save.totalKills+=result.kills;save.bestCombo=Math.max(save.bestCombo,result.maxCombo);
  const first=result.win&&result.mode!=='tower'&&!save.clears[result.stage];
  result.gold=(result.win?100:30)+result.kills*3+(first?200:0);result.gems=first?30:0;
  save.gold+=result.gold;save.gems+=result.gems;save.xp+=result.kills*3+(result.win?100:0);
  if(result.mode==='tower')save.towerBest=Math.max(save.towerBest,result.score);
  else if(result.win){const prev=save.clears[result.stage];save.clears[result.stage]={stars:Math.max(prev?.stars||0,result.stars),time:Math.min(prev?.time??Infinity,result.time),score:Math.max(prev?.score||0,result.score)};save.unlocked=Math.max(save.unlocked,Math.min(5,result.stage+1));}
  return true;
}
export class Game {
  constructor({stage=1,mode='quest',save=defaultSave(),height=768,seed=Date.now()}={}){
    this.stage=STAGES[stage-1]||STAGES[0];this.mode=mode;this.save=save;this.character=CHARACTERS[save.selectedHero||0];this.stats=stats(save);this.challenge=DIFFICULTIES[integer(save.settings?.difficulty,1,8,3)-1];this.W=432;this.H=height;this.groundY=Math.floor(height*.67);this.seed=seed>>>0;
    this.player={x:136,y:this.groundY,flightY:this.groundY,jumpTime:0,vy:0,facing:1,hp:this.stats.hp,mp:100,invuln:0,dash:0,dashCd:0,shotCd:0,slashCd:0,skillCd:0,skill2Cd:0,bombCd:0,attackAnim:0,chain:0,chainTimer:0,run:0,overdrive:0,shotTime:0};
    this.enemies=[];this.bullets=[];this.hostile=[];this.pickups=[];this.hexBomb=null;this.events=[];this.presses=new Set();this.time=0;this.combo=0;this.comboTimer=0;this.maxCombo=0;this.kills=0;this.score=0;this.rage=0;this.spawnTimer=.1;this.cam=0;this.hitstop=0;this.finished=false;this.bossSpawned=false;this.bossKilled=false;this.nextId=1;this.damageTaken=0;this.maxEnemies=0;this.maxBullets=0;this.chainKills=0;this.killClock=0;this.player.flightY=clamp(height*.60,this.flightBounds().top,this.flightBounds().bottom);this.player.y=this.player.flightY;
  }
  random(){let t=this.seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
  event(type,data={}){if(this.events.length<200)this.events.push({type,...data});}
  press(action){this.presses.add(action);}
  flightBounds(){return{left:58,right:this.W-58,top:Math.min(228,this.H*.40),bottom:Math.max(Math.min(228,this.H*.40),this.H-204)};}
  bossAnchor(){const height=Math.min(this.H*.65,568),width=height*2/3,x=this.W-width+16,y=this.H*.125;return{x:x+width*.54,y:y+height*.60,h:height*.34,r:width*.19,rect:{x,y,width,height}};}
  resize(h){const ratio=h/this.H;this.H=h;this.groundY=Math.floor(h*.67);const b=this.flightBounds();this.player.flightY=clamp(this.player.flightY*ratio,b.top,b.bottom);this.player.y=this.player.flightY;for(const e of this.enemies){if(e.type==='boss')Object.assign(e,this.bossAnchor());else{e.y*=ratio;e.baseY*=ratio;}}for(const e of [...this.bullets,...this.hostile,...this.pickups])e.y*=ratio;}
  target(){const locked=this.enemies.find(e=>e.id===this.aimId&&!e.dead&&e.x>=8&&e.x<=this.W-8);if(locked)return locked;let best=null,dist=Infinity;for(const e of this.enemies){if(e.dead||e.x<this.cam+8||e.x>this.cam+this.W-8)continue;const dx=e.x-this.player.x,dy=e.y-e.h*.45-(this.player.y-58);const d=dx*dx+dy*dy;if(d<dist&&Math.abs(dx)<540){best=e;dist=d;}}this.aimId=best?.id;return best;}
  spawn(type,atX){
    if(this.enemies.length>=34)return;
    const p=this.player,d=this.mode==='tower'?1+this.time/95:this.stage.difficulty,r=this.random();
    type=type||((r<.5)?'slime':r<.78?'wing':'knight');
    const boss=type==='boss',wing=type==='wing';const h=boss?this.bossAnchor().h:wing?40:type==='knight'?76:43;
    const hp=(boss?3000:wing?42:type==='knight'?125:52)*(boss?1:Math.min(1.8,d))*this.challenge.hp;
    const side=this.random()<.83?1:-1;
    const x=boss?this.bossAnchor().x:(atX??(side>0?this.W+30+this.random()*120:-35-this.random()*70));
    const flight=this.flightBounds(),spawnY=flight.top+20+this.random()*Math.max(20,flight.bottom-flight.top-25);
    const e={id:this.nextId++,type,x,y:boss?this.bossAnchor().y:spawnY,baseY:spawnY,h,r:boss?this.bossAnchor().r:wing?20:type==='knight'?24:22,hp,maxHp:hp,speed:boss?0:wing?65+this.random()*30:48+this.random()*40,phase:this.random()*6,shootCd:boss?1.8:2.5+this.random()*2,flash:0,stun:0,knockback:0,dead:false};
    this.enemies.push(e);this.event('spawn',{x:e.x,y:e.y,boss});return e;
  }
  shoot(){
    const p=this.player,t=this.target();let a=t?Math.atan2(t.y-t.h*.45-(p.y-58),t.x-p.x):p.facing===1?0:Math.PI;
    if(t)p.facing=t.x>=p.x?1:-1;
    const count=p.overdrive>0?3:this.character.id===2?2:1;
    for(let i=0;i<count;i++){if(this.bullets.length>=110)break;const ang=a+(i-(count-1)/2)*.105;this.bullets.push({x:p.x+p.facing*20,y:p.y-57,vx:Math.cos(ang)*880,vy:Math.sin(ang)*880,life:.78,damage:this.stats.shot*(p.overdrive>0?1.35:1),kind:'shot',trail:0});}
    p.shotCd=this.stats.fireInterval*(p.overdrive>0?.68:1);this.event('shot',{x:p.x+p.facing*28,y:p.y-58});
  }
  slash(){
    const p=this.player;p.chain=p.chainTimer>0?(p.chain+1)%3:0;p.chainTimer=.85;p.slashCd=p.chain===2?.37:.23;p.attackAnim=.21;
    const t=this.target();if(t&&Math.abs(t.x-p.x)<155)p.facing=t.x>=p.x?1:-1;
    this.event('slash',{x:p.x,y:p.y-46,facing:p.facing,chain:p.chain});let hit=false;
    for(const e of this.enemies){const dx=e.x-p.x,dy=e.y-e.h*.5-(p.y-45);if(!e.dead&&Math.abs(dx)<(p.chain===2?158:125)&&dx*p.facing>-38&&Math.abs(dy)<115){e.knockback=e.type==='boss'?0:(Math.sign(dx)||p.facing)*(p.chain===2?650:430);e.stun=p.chain===2?.38:.28;this.hit(e,this.stats.slash*(p.chain===2?1.6:1),'slash');hit=true;}}
    if(hit){this.hitstop=.024;this.event('impact',{strength:2});}
  }
  skill(){const p=this.player;if(p.mp<20||p.skillCd>0)return false;p.mp-=20;p.skillCd=4.6;p.invuln=Math.max(p.invuln,.35);p.attackAnim=.4;
    this.event('skill',{x:p.x,y:p.y-48});for(const e of this.enemies){if(!e.dead&&Math.abs(e.x-p.x)<245&&e.x>this.cam&&e.x<this.cam+this.W){this.hit(e,this.stats.skill,'skill');e.stun=.7;}}this.hitstop=.045;return true;}
  skill2(){const p=this.player;if(p.mp<30||p.skill2Cd>0)return false;p.mp-=30;p.skill2Cd=7;p.invuln=Math.max(p.invuln,.5);this.hostile=[];this.event('skill',{x:p.x,y:p.y-48,gold:true});for(const e of this.enemies)if(!e.dead&&e.x>-10&&e.x<this.W+10)this.hit(e,this.stats.skill*1.35,'skill');this.hitstop=.045;return true;}
  // A single expanding hex wave; no repeated damage on the same enemy per bomb.
  hexBombAttack(){
    const p=this.player;
    if(p.mp<HEX_BOMB.mp||p.bombCd>0||this.hexBomb||this.finished)return false;
    p.mp-=HEX_BOMB.mp;p.bombCd=HEX_BOMB.cooldown;
    p.invuln=Math.max(p.invuln,HEX_BOMB.invulnerability);
    const x=p.x,y=p.y-55;
    this.hexBomb={x,y,age:0,radius:0,maxRadius:Math.hypot(Math.max(x,this.W-x),Math.max(y,this.H-y))+36,hitIds:new Set(),cleared:0};
    this.event('hexBomb',{x,y});return true;
  }
  advanceHexBomb(dt){
    const wave=this.hexBomb;if(!wave)return;
    wave.age+=dt;
    const progress=clamp(wave.age/HEX_BOMB.duration,0,1);
    wave.radius=Math.max(38,wave.maxRadius*(1-(1-progress)*(1-progress)));
    const rr=wave.radius;
    // Remove bullets before their player collision test: no false damage in the blast.
    let cleared=0;
    for(const b of this.hostile){if(b.life<=0)continue;const dx=b.x-wave.x,dy=b.y-wave.y;if(dx*dx+dy*dy<=(rr+(b.r||5))**2){b.life=0;cleared++;}}
    if(cleared){wave.cleared+=cleared;this.score+=cleared*HEX_BOMB.bulletScore;this.event('hexClear',{count:cleared,x:wave.x,y:wave.y});}
    for(const e of this.enemies){
      if(e.dead||wave.hitIds.has(e.id))continue;
      const dy=e.y-e.h*.5-wave.y,dx=e.x-wave.x;
      if(dx*dx+dy*dy<=(rr+e.r)**2){wave.hitIds.add(e.id);this.hit(e,this.stats.skill*HEX_BOMB.damageScale,'hexBomb');e.stun=Math.max(e.stun,.35);}
    }
    if(progress>=1)this.hexBomb=null;
  }
  burst(){if(this.rage<100)return false;this.rage=0;this.player.overdrive=6;this.player.invuln=.7;this.player.mp=Math.min(100,this.player.mp+35);for(const e of this.enemies){if(!e.dead&&Math.abs(e.x-this.player.x)<300&&e.x>this.cam&&e.x<this.cam+this.W)this.hit(e,this.stats.skill*.7,'skill');}this.event('burst');this.hitstop=.06;return true;}
  hit(e,damage,kind){
    if(e.dead)return;const critical=this.random()<.13;const dealt=Math.round(damage*(critical?1.65:1));e.hp-=dealt;e.flash=.09;
    this.combo++;this.comboTimer=3.8;this.maxCombo=Math.max(this.maxCombo,this.combo);this.rage=clamp(this.rage+1.5,0,100);
    this.event('hit',{x:e.x,y:e.y-e.h*.55,damage:dealt,critical,kind,combo:this.combo});
    if([10,25,50,100,200,300].includes(this.combo))this.event('milestone',{combo:this.combo});
    if(e.hp<=0){e.dead=true;this.kills++;this.rage=clamp(this.rage+5,0,100);this.score+=Math.round((e.type==='boss'?4000:e.type==='knight'?150:100)*(1+Math.min(4,this.combo/40)));this.chainKills=this.killClock>0?this.chainKills+1:1;this.killClock=.65;this.event('kill',{x:e.x,y:e.y-e.h*.45,enemyType:e.type,chain:this.chainKills,kind,footY:e.y,vx:e.knockback||0,h:e.h,r:e.r,phase:e.phase,maxHp:e.maxHp});
      if(e.type==='boss'){this.bossKilled=true;this.event('bossDefeated');}
      if(this.kills%12===0)this.pickups.push({x:e.x,y:e.y-30,type:'heal',life:12});
      else if(this.kills%5===0)this.pickups.push({x:e.x,y:e.y-30,type:'mana',life:10});
    }
  }
  hurt(dmg){const p=this.player;if(p.invuln>0||p.dash>0)return false;const d=Math.round(dmg*this.challenge.damage);p.hp=Math.max(0,p.hp-d);p.invuln=.82;this.damageTaken+=d;this.event('hurt',{damage:d});if(p.hp<=0)this.finish(false);return true;}
  finish(win){if(this.finished)return;this.finished=true;this.result={win,difficulty:this.challenge.level,mode:this.mode,stage:this.stage.id,time:this.time,kills:this.kills,maxCombo:this.maxCombo,score:this.score,hp:this.player.hp,damageTaken:this.damageTaken,stars:win?1+(this.player.hp>=this.stats.hp*.3?1:0)+(this.time<=90?1:0):0};this.event('finish',{result:this.result});}
  step(dt,input={}){
    if(this.finished)return;dt=clamp(dt,0,1/30);if(this.hitstop>0){this.hitstop=Math.max(0,this.hitstop-dt);return;}
    this.time+=dt;const p=this.player;for(const k of ['invuln','dash','dashCd','shotCd','slashCd','skillCd','skill2Cd','bombCd','attackAnim','chainTimer','overdrive'])p[k]=Math.max(0,p[k]-dt);
    p.mp=clamp(p.mp+dt*4.5,0,100);this.killClock=Math.max(0,this.killClock-dt);this.comboTimer-=dt;if(this.comboTimer<=0)this.combo=0;
    p.shotTime=input.shoot?p.shotTime+dt:0;
    let mx=clamp(Number(input.move)||0,-1,1),my=clamp(Number(input.moveY)||0,-1,1);const length=Math.hypot(mx,my);if(length>1){mx/=length;my/=length;}
    if(mx&&p.dash<=0)p.facing=mx>0?1:-1;
    if(this.presses.has('jump')&&p.jumpTime<=0){p.jumpTime=.65;p.invuln=Math.max(p.invuln,.28);this.event('jump');}
    if(this.presses.has('dash')&&p.dashCd<=0){p.dash=.19;p.dashCd=.9;p.dashX=mx||(!my?p.facing:0);p.dashY=my;p.invuln=Math.max(p.invuln,.25);this.event('dash',{x:p.x,y:p.y});}
    if(this.presses.has('skill'))this.skill();if(this.presses.has('skill2'))this.skill2();if(this.presses.has('burst'))this.burst();if(this.presses.has('bomb'))this.hexBombAttack();this.presses.clear();
    const bounds=this.flightBounds();
    if(p.dash>0){p.x+=p.dashX*600*dt;p.flightY+=p.dashY*600*dt;}
    else if(input.dragTarget){const dx=input.dragTarget.x-p.x,dy=input.dragTarget.y-p.flightY,dist=Math.hypot(dx,dy),amount=Math.min(dist,490*dt);if(dist>.5){p.x+=dx/dist*amount;p.flightY+=dy/dist*amount;mx=dx/dist;my=dy/dist;if(Math.abs(mx)>.3)p.facing=mx>0?1:-1;}}
    else{p.x+=mx*188*this.stats.speed*dt;p.flightY+=my*188*this.stats.speed*dt;}
    p.x=clamp(p.x,bounds.left,bounds.right);p.flightY=clamp(p.flightY,bounds.top,bounds.bottom);p.run+=Math.hypot(mx,my)*dt;
    p.jumpTime=Math.max(0,p.jumpTime-dt);const lift=p.jumpTime>0?Math.sin((.65-p.jumpTime)/.65*Math.PI)*58:0;p.y=Math.max(bounds.top,p.flightY-lift);p.vy=0;this.cam=0;
    if(input.shoot&&p.shotCd<=0)this.shoot();if(input.slash&&p.slashCd<=0)this.slash();
    this.spawnTimer-=dt;if(this.spawnTimer<=0){const baseCount=this.mode==='tower'?5+Math.floor(this.time/25):4+this.stage.id,count=Math.max(2,Math.round(baseCount*this.challenge.density));for(let i=0;i<count;i++)this.spawn();this.spawnTimer=Math.max(.58,1.08-(this.mode==='tower'?this.time/230:this.stage.id*.045));}
    if(this.stage.boss&&this.mode!=='tower'&&!this.bossSpawned&&this.kills>=this.stage.target&&this.enemies.length<34){this.bossSpawned=true;this.spawn('boss');this.event('boss');}
    for(const e of this.enemies){if(e.dead)continue;if(e.type==='boss'){Object.assign(e,this.bossAnchor());e.knockback=0;}if(e.type!=='boss'&&Math.abs(e.knockback)>1){e.x=clamp(e.x+e.knockback*dt,-110,this.W+130);e.knockback*=Math.exp(-7*dt);}else e.knockback=0;e.flash=Math.max(0,e.flash-dt);e.stun=Math.max(0,e.stun-dt);e.phase+=dt*3;const dir=p.x>e.x?1:-1;const dx=Math.abs(p.x-e.x);if(e.type!=='boss'&&e.stun<=0){if(dx>18)e.x+=dir*e.speed*dt;const desired=clamp(p.y-25,150,this.H-185);e.baseY+=(desired-e.baseY)*dt*.22;if(e.type!=='wing')e.y=e.baseY;}
      if(e.type==='wing')e.y=e.baseY+Math.sin(e.phase)*28;
      e.shootCd-=dt;if((e.type==='knight'||e.type==='boss')&&e.shootCd<=0&&dx<540){const count=e.type==='boss'?7:1;const aim=Math.atan2(p.y-50-(e.y-e.h*.5),p.x-e.x);for(let i=0;i<count;i++){const a=aim+(i-(count-1)/2)*.22;if(this.hostile.length<70)this.hostile.push({x:e.x,y:e.y-e.h*.5,vx:Math.cos(a)*ENEMY_BULLET_SPEED,vy:Math.sin(a)*ENEMY_BULLET_SPEED,life:20,r:e.type==='boss'?8:5});}e.shootCd=e.type==='boss'?1.8:3.6;this.event('enemyShot',{x:e.x,y:e.y-e.h*.5});}
      if(e.type!=='boss'&&dx<e.r+16&&Math.abs((p.y-42)-(e.y-e.h*.5))<e.h*.5+28)this.hurt(e.type==='boss'?35:18*this.stage.difficulty);
    }
    this.advanceHexBomb(dt);
    for(const b of this.bullets){b.px=b.x;b.py=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
      for(const e of this.enemies){if(e.dead||b.life<=0||e.x<this.cam-12||e.x>this.cam+this.W+12)continue;const ex=e.x,ey=e.y-e.h*.5;const vx=b.x-b.px,vy=b.y-b.py;const t=clamp(((ex-b.px)*vx+(ey-b.py)*vy)/(vx*vx+vy*vy||1),0,1);if(Math.abs(ex-(b.px+vx*t))<e.r+8&&Math.abs(ey-(b.py+vy*t))<e.h*.5+6){this.hit(e,b.damage,'shot');b.life=0;break;}}
    }
    for(const b of this.hostile){if(b.life<=0)continue;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(Math.abs(b.x-p.x)<18+b.r&&b.y>p.y-85&&b.y<p.y+2){this.hurt(15*this.stage.difficulty);b.life=0;}}
    for(const item of this.pickups){item.life-=dt;const dx=p.x-item.x,dy=p.y-40-item.y,dist=Math.hypot(dx,dy);if(dist<220){item.x+=dx*dt*7;item.y+=dy*dt*7;}if(dist<26){if(item.type==='heal')p.hp=clamp(p.hp+38,0,this.stats.hp);else p.mp=clamp(p.mp+24,0,100);item.life=0;this.event('pickup',{kind:item.type});}}
    this.enemies=this.enemies.filter(e=>!e.dead);this.bullets=this.bullets.filter(b=>b.life>0);this.hostile=this.hostile.filter(b=>b.life>0&&b.y<this.H&&b.y>-60);this.pickups=this.pickups.filter(b=>b.life>0).slice(-24);
    this.maxEnemies=Math.max(this.maxEnemies,this.enemies.length);this.maxBullets=Math.max(this.maxBullets,this.bullets.length+this.hostile.length);
    if(!this.finished){if(this.mode==='tower'){if(this.time>=90)this.finish(true);}else if(this.stage.boss?this.bossKilled:this.kills>=this.stage.target)this.finish(true);}
  }
}
