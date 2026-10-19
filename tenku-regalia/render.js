import {clamp,HEX_BOMB} from './core.js';
const TAU=Math.PI*2;
const loadImage=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('画像を読み込めません: '+src));i.src=src;});
export async function loadArt(){
  const [sky,boss,manifest]=await Promise.all([loadImage('assets/battle-backdrop.webp'),loadImage('assets/boss-lunael.webp'),fetch('assets/sprites/manifest.json').then(r=>r.json())]);
  const characters=await Promise.all(manifest.characters.map(async entry=>{
    const images=await Promise.all(entry.frames.map(f=>loadImage('assets/'+f.file)));
    const base=images.map(image=>({image,pivotX:192,foot:376,bounds:{minX:0,minY:0,maxX:384,maxY:376}}));
    return{frames:[base[0],base[0],base[3],base[1],base[1],base[2],base[1],base[1]],shots:[base[1],base[2],base[1],base[3]],portrait:images[0].src,scale:entry.scale};
  }));
  const art={sky,boss,characters,manifest,frames:characters[0].frames,shots:characters[0].shots,selected:0};
  art.setCharacter=id=>{art.selected=id;art.frames=characters[id].frames;art.shots=characters[id].shots;};return art;
}
export function drawHero(ctx,art,{x,y,frame=0,facing=1,scale=.285,alpha=1,stretch=1}){
  const f=art.frames[frame]||art.frames[0];ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.scale(facing*scale,scale*stretch);ctx.drawImage(f.image,-f.pivotX,-f.foot);ctx.restore();
  return{left:x-192*scale,right:x+192*scale,top:y-376*scale*stretch,bottom:y};
}
export function drawShotHero(ctx,art,{x,y,time,facing=1,alpha=1}){
  const f=art.shots[Math.floor(time*10)%art.shots.length];
  // One complete frame only: no crossfade, additive compositing, or frame rescaling.
  ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.scale(facing*.285,.285);ctx.drawImage(f.image,-f.pivotX,-f.foot);ctx.restore();
  return{left:x-54.72,right:x+54.72,top:y-107.16,bottom:y};
}
function poly(c,pts,fill,stroke){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function diamond(c,x,y,r,fill){poly(c,[[x,y-r],[x+r*.58,y],[x,y+r],[x-r*.58,y]],fill);}
export class Renderer{
  constructor(canvas,art,getSettings){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.art=art;this.getSettings=getSettings;this.particles=[];this.numbers=[];this.rings=[];this.slashes=[];this.shake=0;this.flash=0;this.heroBounds=null;this.frame=0;this.maxParticles=0;this.trails=[];this.trailClock=0;this.defeated=[];this.crystalFlashes=[];this.hexCells=[];this.resize(432,768);}
  resize(w,h){this.W=w;this.H=h;this.dpr=Math.min(this.getSettings().quality==='low'?2:2.5,window.devicePixelRatio||1);this.canvas.width=Math.round(w*this.dpr);this.canvas.height=Math.round(h*this.dpr);this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);this.ctx.imageSmoothingEnabled=true;this.ctx.imageSmoothingQuality='high';this.makeBackdrop();this.makeEnemies();this.makeHexGrid();}
  reset(){this.particles=[];this.numbers=[];this.rings=[];this.slashes=[];this.trails=[];this.defeated=[];this.crystalFlashes=[];this.shake=0;this.flash=0;}
  makePlatform(){const c=document.createElement('canvas');c.width=256;c.height=180;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,0,180);g.addColorStop(0,'#8c9d9f');g.addColorStop(.1,'#8795a0');g.addColorStop(.12,'#3c5367');g.addColorStop(1,'#092039');x.fillStyle=g;x.fillRect(0,12,256,168);x.fillStyle='#d9dab6';x.fillRect(0,6,256,9);x.fillStyle='#abcbad';x.fillRect(0,3,256,4);x.fillStyle='#438a80';x.fillRect(0,0,256,4);x.strokeStyle='#243d59';x.lineWidth=2;for(let y=20;y<180;y+=26){x.beginPath();x.moveTo(0,y);x.lineTo(256,y);x.stroke();for(let k=0;k<5;k++){const a=k*64+(y%52?32:0);x.beginPath();x.moveTo(a,y);x.lineTo(a,y+26);x.stroke();}}x.fillStyle='#6faf80';for(let i=0;i<12;i++){const px=(i*29)%256;x.fillRect(px,5,3,10+i%4*5);x.fillStyle=i%2?'#add1a0':'#528978';}this.platform=c;}
  makeHexGrid(){
    this.hexCells=[];
    const xStep=58,yStep=50;
    for(let row=0,y=0;y<this.H+25;row++,y+=yStep){
      for(let x=(row%2)*xStep*.5;x<this.W+25;x+=xStep)this.hexCells.push({x,y});
    }
  }
  drawHexBomb(c,g){
    const b=g.hexBomb;if(!b)return;
    const age=b.age,progress=clamp(age/HEX_BOMB.duration,0,1),r=b.radius;
    const low=this.getSettings().quality==='low';
    const color=g.character?.color||'#7de9ff',fade=Math.min(1,(1-progress)*2.7);
    c.save();c.globalCompositeOperation='lighter';
    c.strokeStyle=color;c.globalAlpha=.20*fade;c.lineWidth=13;c.beginPath();c.arc(b.x,b.y,r,0,TAU);c.stroke();
    c.strokeStyle='#eaffff';c.globalAlpha=.92*fade;c.lineWidth=2.6;c.beginPath();c.arc(b.x,b.y,r,0,TAU);c.stroke();
    // Hexes near the moving front only. Grid geometry is cached at resize time.
    const range=low?38:54;
    for(const h of this.hexCells){
      const dx=h.x-b.x,dy=h.y-b.y,dist=Math.hypot(dx,dy),diff=Math.abs(dist-r);
      if(diff>range)continue;
      c.globalAlpha=fade*(1-diff/range)*.88;
      c.strokeStyle=color;c.lineWidth=low?1.6:2.2;
      const size=low?18:21;
      c.beginPath();for(let j=0;j<6;j++){const a=Math.PI/3*j+Math.PI/6,x=h.x+size*Math.cos(a),y=h.y+size*Math.sin(a);if(!j)c.moveTo(x,y);else c.lineTo(x,y);}c.closePath();c.stroke();
    }
    c.restore();
  }
  particlesAt(x,y,n,color,speed=170,timeScale=1){const max=this.getSettings().quality==='low'?100:240;for(let i=0;i<n&&this.particles.length<max;i++){const a=Math.random()*TAU,v=speed*(.2+Math.random());this.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.2+Math.random()*.36,max:.56,r:1+Math.random()*2.5,color,timeScale});}this.maxParticles=Math.max(this.maxParticles,this.particles.length);}
  event(e){const low=this.getSettings().quality==='low';switch(e.type){
    case'hit':this.particlesAt(e.x,e.y,low?2:5,e.critical?'#fff0a6':'#93edff',120);if((e.kind!=='shot'||e.critical||e.combo%3===0)&&this.numbers.length<35)this.numbers.push({x:e.x,y:e.y,life:.55,text:String(e.damage),critical:e.critical});break;
    case'kill':this.particlesAt(e.x,e.y,low?7:16,e.enemyType==='wing'?'#d4b6ff':'#73f4ff',215);this.rings.push({x:e.x,y:e.y,r:10,life:.24,color:'#b6f6ff'});if(e.kind==='slash')this.defeated.push({type:e.enemyType,x:e.x,y:e.footY,h:e.h,r:e.r,phase:e.phase,flash:.1,hp:e.maxHp,maxHp:e.maxHp,vx:e.vx,vy:-65,life:.36});this.defeated=this.defeated.slice(-12);break;
    case'slash':this.slashes.push({...e,life:.2});break;
    case'skill':this.rings.push({x:e.x,y:e.y,r:10,life:.5,color:e.gold?'#ffe27b':'#affdff',big:true,timeScale:.2});this.particlesAt(e.x,e.y,low?15:60,'#b6f9ff',440,.2);this.crystalFlashes.push({life:.13});this.shake=4;break;
    case'hexBomb':this.flash=.22;this.particlesAt(e.x,e.y,low?8:22,'#9effff',160);break;
    case'burst':this.flash=.3;this.shake=5;break;
    case'impact':this.shake=Math.max(this.shake,e.strength);break;
    case'hurt':this.shake=5;break;
    case'land':this.particlesAt(e.x,e.y,6,'#e3edd4',90);break;
    case'bossDefeated':this.shake=6;this.flash=.25;break;
  }this.rings=this.rings.slice(-24);this.slashes=this.slashes.slice(-8);}
  effects(dt){this.flash=Math.max(0,this.flash-dt);this.shake=Math.max(0,this.shake-dt*25);for(const p of this.particles){const step=dt*(p.timeScale??1);p.life-=step;p.x+=p.vx*step;p.y+=p.vy*step;p.vy+=95*step;}this.particles=this.particles.filter(p=>p.life>0);for(const n of this.numbers){n.life-=dt;n.y-=dt*55;}this.numbers=this.numbers.filter(p=>p.life>0);for(const r of this.rings){const step=dt*(r.timeScale??1);r.life-=step;r.r+=step*(r.big?750:180);}this.rings=this.rings.filter(r=>r.life>0);for(const s of this.slashes)s.life-=dt;this.slashes=this.slashes.filter(s=>s.life>0);this.trails=this.trails.filter(t=>(t.life-=dt)>0);for(const e of this.defeated){e.life-=dt;e.x+=e.vx*dt;e.vx*=Math.exp(-3*dt);e.y+=e.vy*dt;e.vy+=160*dt;}this.defeated=this.defeated.filter(e=>e.life>0);this.crystalFlashes=this.crystalFlashes.filter(f=>(f.life-=dt*.2)>0);}
  enemyArt(c,e,t){
    c.save();c.translate(e.x,e.y);const bob=Math.sin(e.phase)*2,flip=e.type==='boss'?1:1;c.scale(flip,1);c.lineWidth=1.5;
    if(e.type==='slime'){c.fillStyle='#06264755';c.beginPath();c.ellipse(0,1,25,6,0,0,TAU);c.fill();const g=c.createRadialGradient(-8,-28,2,0,-18,28);g.addColorStop(0,e.flash>0?'#fff':'#a2f2ff');g.addColorStop(.5,'#40badd');g.addColorStop(1,'#3060b4');c.fillStyle=g;c.beginPath();c.moveTo(-22,0);c.bezierCurveTo(-31,-12,-13,-46-bob,1,-43-bob);c.bezierCurveTo(19,-39,26,-11,22,0);c.quadraticCurveTo(0,8,-22,0);c.fill();c.strokeStyle='#c6efff';c.stroke();c.fillStyle='#082f53';for(const x of [-7,9]){c.beginPath();c.ellipse(x,-17,2.9,5,0,0,TAU);c.fill();}c.fillStyle='#fff';c.beginPath();c.ellipse(-8,-30,6,3,-.4,0,TAU);c.fill();}
    else if(e.type==='wing'){const a=Math.sin(t*16+e.phase)*7;poly(c,[[-10,-18],[-37,-34-a],[-30,-8],[-15,-4]],'#7b63c1','#d2c3ff');poly(c,[[10,-18],[37,-34-a],[30,-8],[15,-4]],'#7b63c1','#d2c3ff');diamond(c,0,-20,20,e.flash>0?'#fff':'#607cce');diamond(c,-3,-22,12,'#afd7ff');c.fillStyle='#182349';c.beginPath();c.ellipse(1,-19,8,7,0,0,TAU);c.fill();c.fillStyle='#fff2b2';c.beginPath();c.ellipse(1,-19,3,5,0,0,TAU);c.fill();}
    else if(e.type==='knight'){c.strokeStyle='#708acb';c.lineWidth=6;c.beginPath();c.moveTo(-10,0);c.lineTo(-8,-25);c.moveTo(11,0);c.lineTo(8,-25);c.stroke();poly(c,[[-18,-50],[-13,-23],[0,-16],[15,-24],[19,-50]],e.flash>0?'#fff':'#285184','#8fdbff');diamond(c,0,-62,17,'#b8edff');poly(c,[[-13,-63],[0,-53],[15,-63],[8,-47],[-7,-47]],'#102b59','#91c2e9');c.fillStyle='#7affff';c.fillRect(-6,-57,13,3);c.strokeStyle='#bfdaed';c.lineWidth=3;c.beginPath();c.moveTo(23,-5);c.lineTo(26,-74);c.stroke();diamond(c,26,-77,16,'#7de5ff');poly(c,[[-27,-49],[-33,-27],[-21,-16],[-13,-35]],'#3665a3','#c1def1');}
    else{const glow=c.createRadialGradient(0,-80,3,0,-80,95);glow.addColorStop(0,'#d5b4ff55');glow.addColorStop(1,'#5735ab00');c.fillStyle=glow;c.fillRect(-100,-177,200,195);for(const dir of [-1,1]){c.save();c.scale(dir,1);poly(c,[[20,-96],[76,-131],[59,-77],[94,-85],[54,-42],[24,-32]],'#7965b4','#ddd2ff');diamond(c,75,-87,22,'#8cbeed');c.restore();}c.save();c.translate(0,-80);c.rotate(t*.5);c.strokeStyle='#dec299';c.lineWidth=2;c.beginPath();c.arc(0,0,55,0,TAU);c.stroke();for(let i=0;i<6;i++){c.rotate(TAU/6);diamond(c,0,55,10,'#f2dfad');}c.restore();diamond(c,0,-76,60,e.flash>0?'#fff':'#5948a2');diamond(c,-4,-82,44,'#c3a9ec');diamond(c,1,-89,23,'#eff0ff');c.fillStyle='#2c2151';c.fillRect(-13,-77,26,10);c.fillStyle='#ffaaff';c.fillRect(-10,-75,20,4);diamond(c,0,-29,22,'#83efff');}
    c.shadowBlur=0;if(e.hp<e.maxHp&&e.type!=='boss'){c.fillStyle='#081c3acc';c.fillRect(-23,-e.h-9,46,4);c.fillStyle='#fc91a7';c.fillRect(-23,-e.h-9,46*e.hp/e.maxHp,4);}c.restore();
  }
  makeBackdrop(){
    this.skyWidth=Math.ceil(this.art.sky.width*this.H/this.art.sky.height);
    const c=document.createElement('canvas');c.width=Math.ceil(this.skyWidth*this.dpr);c.height=Math.ceil(this.H*this.dpr);const x=c.getContext('2d',{alpha:false});x.scale(this.dpr,this.dpr);x.drawImage(this.art.sky,0,0,this.skyWidth,this.H);
    const tint=x.createLinearGradient(0,0,0,this.H);tint.addColorStop(0,'#080c3033');tint.addColorStop(.65,'#11123918');tint.addColorStop(1,'#050821bb');x.fillStyle=tint;x.fillRect(0,0,this.skyWidth,this.H);this.backdrop=c;
    const layer=(width,height)=>{const image=document.createElement('canvas');image.width=width*this.dpr;image.height=height*this.dpr;const ctx=image.getContext('2d');ctx.scale(this.dpr,this.dpr);return{image,ctx,width,height};};
    this.ruins=layer(760,this.H);const r=this.ruins.ctx;
    for(let i=0;i<7;i++){const px=i*119+35,py=this.H*(.33+(i%3)*.12),height=60+i%3*30;r.fillStyle='#171b4355';r.fillRect(px,py,16,height);poly(r,[[px-6,py],[px+8,py-37],[px+22,py]],'#31326177');r.fillStyle='#bba9d955';r.fillRect(px+5,py+14,4,12);poly(r,[[px-14,py+height],[px+35,py+height],[px+9,py+height+42]],'#12173566');}
    this.crystals=layer(620,this.H);const cr=this.crystals.ctx;for(let i=0;i<8;i++){const px=i*79+12,py=this.H*(.22+(i%5)*.12);cr.globalAlpha=.3;diamond(cr,px,py,7+i%3*5,'#b5a6ff');cr.globalAlpha=.65;diamond(cr,px-1,py-1,3+i%3*2,'#d8f7ff');}cr.globalAlpha=1;
    this.foreground=layer(880,this.H);const fg=this.foreground.ctx;fg.fillStyle='#11122bb3';for(let i=0;i<5;i++){const px=i*195,py=this.H*.91-(i%2)*20;fg.fillRect(px,py,60,this.H-py);fg.fillStyle='#524369b3';fg.fillRect(px-8,py-7,76,8);fg.fillStyle='#11122bb3';poly(fg,[[px+17,py],[px+25,py-42],[px+32,py]],'#24234199');}
  }
  layerOffsets(time){return{sky:time*.45,ruins:time*.90,crystals:time*1.50,foreground:time*2.40};}
  backdropDraw(c,g){
    const o=this.layerOffsets(g.time),width=this.skyWidth,base=width*.27,offset=(base+o.sky)%(width*2);
    // Mirrored repeats preserve continuity even during long tower sessions.
    for(let i=-2;i<3;i++){const left=i*width-offset;if(left>this.W||left+width<0)continue;c.save();if(i%2){c.translate(left+width,0);c.scale(-1,1);c.drawImage(this.backdrop,0,0,width,this.H);}else c.drawImage(this.backdrop,left,0,width,this.H);c.restore();}
    for(const key of ['ruins','crystals']){const layer=this[key],off=o[key]%layer.width;for(let x=-off;x<this.W;x+=layer.width)c.drawImage(layer.image,x,0,layer.width,layer.height);}
    this.bossRect=null;if(g.enemies.some(e=>e.type==='boss'&&!e.dead)){const rect=g.bossAnchor().rect;this.bossRect={...rect};c.drawImage(this.art.boss,rect.x,rect.y,rect.width,rect.height);}
    const layer=this.foreground,off=o.foreground%layer.width;for(let x=-off;x<this.W;x+=layer.width)c.drawImage(layer.image,x,0,layer.width,layer.height);
  }
  makeEnemies(){
    if(this.enemySpriteDpr===this.dpr)return;this.enemySpriteDpr=this.dpr;this.enemySprites=new Map();
    for(const type of ['slime','wing','knight']){
      const frames=type==='knight'?1:type==='boss'?12:8,w=type==='boss'?224:100,h=type==='boss'?210:110,foot=h-15;
      for(let f=0;f<frames;f++)for(let flash=0;flash<2;flash++){
        const c=document.createElement('canvas');c.width=w*this.dpr;c.height=h*this.dpr;const x=c.getContext('2d');x.scale(this.dpr,this.dpr);x.translate(w/2,foot);
        this.enemyArt(x,{x:0,y:0,type,phase:f/frames*TAU,flash,h:70,hp:1,maxHp:1},type==='boss'?f/frames*TAU*2:0);
        this.enemySprites.set(`${type}:${f}:${flash}`,{image:c,w,h,foot});
      }
    }
  }
  enemy(c,e,t){
    if(e.type==='boss')return;
    const count=e.type==='knight'?1:e.type==='boss'?12:8,phase=e.type==='boss'?t*.5:e.phase+(e.type==='wing'?t*16:0),frame=((Math.floor(phase/TAU*count)%count)+count)%count;
    const a=this.enemySprites.get(`${e.type}:${frame}:${e.flash>0?1:0}`);c.drawImage(a.image,e.x-a.w/2,e.y-a.foot,a.w,a.h);
    if(e.type!=='boss'&&!e.life){c.fillStyle='#081c3ae6';c.fillRect(e.x-24,e.y-e.h-10,48,6);c.fillStyle=e.hp/e.maxHp>.3?'#7debbc':'#ff7d93';c.fillRect(e.x-23,e.y-e.h-9,46*clamp(e.hp/e.maxHp,0,1),4);}
  }
  draw(g,dt=1/60,input={}){
    this.effects(dt);this.frame++;const c=this.ctx,w=this.W,h=this.H,t=g.time,p=g.player,gy=g.groundY;c.save();c.setTransform(this.dpr,0,0,this.dpr,0,0);
    this.backdropDraw(c,g);
    c.save();if(this.shake>0&&this.getSettings().shake)c.translate((Math.random()-.5)*this.shake,(Math.random()-.5)*this.shake*.6);
    c.translate(-g.cam,0);
    for(const item of g.pickups){c.save();c.translate(item.x,item.y+Math.sin(t*5)*3);diamond(c,0,0,10,item.type==='heal'?'#b5ffca':'#b0e9ff');c.fillStyle='#186779';c.font='bold 10px sans-serif';c.textAlign='center';c.fillText(item.type==='heal'?'+':'◆',0,3);c.restore();}
    for(const e of g.enemies)if(e.x>g.cam-100&&e.x<g.cam+w+100)this.enemy(c,e,t);
    for(const e of this.defeated){c.globalAlpha=clamp(e.life/.36,0,1);this.enemy(c,e,t);}c.globalAlpha=1;
    c.lineCap='round';c.strokeStyle=g.character?.color||'#a9faff';c.lineWidth=4;
    for(const b of g.bullets){c.beginPath();const a=Math.atan2(b.vy,b.vx);c.moveTo(b.x-Math.cos(a)*19,b.y-Math.sin(a)*19);c.lineTo(b.x,b.y);c.stroke();c.fillStyle='#fff';c.beginPath();c.arc(b.x,b.y,2.5,0,TAU);c.fill();}
    for(const b of g.hostile){c.fillStyle='#422866';c.beginPath();c.arc(b.x,b.y,b.r+3,0,TAU);c.fill();c.fillStyle='#ffb5ee';c.beginPath();c.arc(b.x,b.y,b.r,0,TAU);c.fill();c.fillStyle='#ffeaff';c.beginPath();c.arc(b.x-2,b.y-2,b.r*.37,0,TAU);c.fill();}
    const isAir=p.jumpTime>0;let frame=p.dash>0?6:p.attackAnim>0?(p.chain===1?5:4):isAir?3:Math.abs(input.move||0)>.1?1+Math.floor(p.run*11)%2:input.shoot?7:0;

    this.trailClock-=dt;if(p.dash>0&&this.trailClock<0){this.trailClock=.027;this.trails.push({x:p.x,y:p.y,facing:p.facing,frame,life:.17});}this.trails=this.trails.slice(-6);
    for(const trail of this.trails)drawHero(c,this.art,{...trail,scale:.285,alpha:trail.life*2});
    const alpha=p.invuln>0&&Math.floor(t*20)%2===0?.5:1,shooting=input.shoot&&p.dash<=0&&p.attackAnim<=0;
    this.heroBounds=shooting?drawShotHero(c,this.art,{x:p.x,y:p.y,time:p.shotTime,facing:p.facing,alpha}):drawHero(c,this.art,{x:p.x,y:p.y,frame,facing:p.facing,scale:.285,alpha,stretch:1});this.heroFrame=shooting?'shot':frame;
    if(p.overdrive>0){c.strokeStyle='#fff0a6bb';c.lineWidth=2;c.beginPath();c.ellipse(p.x,p.y-43,45+Math.sin(t*10)*4,70,0,0,TAU);c.stroke();if(this.frame%3===0)this.particlesAt(p.x,p.y-60,1,'#ffe1a0',70);}
    this.drawHexBomb(c,g);
    for(const a of this.slashes){c.save();c.translate(a.x,a.y);c.scale(a.facing,1);c.globalAlpha=a.life/.2;c.rotate(a.chain===1?-.8:a.chain===2?.2:-.3);c.strokeStyle='#50dfff';c.lineWidth=a.chain===2?16:11;c.beginPath();c.arc(10,0,a.chain===2?126:92,-1.2,1.15);c.stroke();c.strokeStyle='#efffff';c.lineWidth=4;c.beginPath();c.arc(10,0,a.chain===2?125:90,-1.2,1.05);c.stroke();c.restore();}
    for(const r of this.rings){c.globalAlpha=clamp(r.life*3,0,1);c.strokeStyle=r.color;c.lineWidth=r.big?7:2;c.beginPath();c.arc(r.x,r.y,r.r,0,TAU);c.stroke();}c.globalAlpha=1;
    for(const a of this.particles){c.globalAlpha=Math.min(1,a.life*4);c.fillStyle=a.color;c.fillRect(a.x-a.r,a.y-a.r,a.r*2,a.r*2);}c.globalAlpha=1;
    c.textAlign='center';for(const a of this.numbers){c.globalAlpha=Math.min(1,a.life*6);c.font=a.critical?'italic bold 19px sans-serif':'bold 14px sans-serif';c.lineWidth=3;c.strokeStyle='#152945';c.strokeText(a.text,a.x,a.y);c.fillStyle=a.critical?'#ffe38c':'#edfcff';c.fillText(a.text,a.x,a.y);}c.globalAlpha=1;
    c.restore();const crystalFlash=this.crystalFlashes.reduce((v,f)=>Math.max(v,f.life),0);if(crystalFlash>0){c.globalAlpha=Math.min(.18,crystalFlash*.9);c.fillStyle='#c7f5ff';c.fillRect(0,0,w,h);c.globalAlpha=1;}if(this.flash>0){c.globalAlpha=Math.min(.24,this.flash*.9);c.fillStyle='#c7f5ff';c.fillRect(0,0,w,h);c.globalAlpha=1;}
    c.restore();
  }
}
