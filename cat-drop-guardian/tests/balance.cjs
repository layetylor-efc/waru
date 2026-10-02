const {Game}=require('../src/core.js');
function choose(g){
 let best=null;
 for(let rot=0;rot<4;rot++)for(let col=0;col<6;col++){
  const h=Game.restore(g.serialize()); if(!h){require('node:fs').writeFileSync('qa/invalid-save.json',JSON.stringify(g.serialize(),null,2));throw Error('valid game could not be restored');}
  for(let i=0;i<rot;i++)h.rotate();h.moveTo(col);if(!h.active||h.active.x!==col)continue;h.drop();
  let cap=0;while(h.matches.length&&cap++<20)h.resolveMatches();
  if(h.phase!=='playing')continue;
  let height=0,neighbors=0,max=0;
  for(let x=0;x<6;x++){let top=h.board.findIndex(r=>r[x]>=0);const level=top<0?0:8-top;max=Math.max(max,level);height+=level*level;}
  for(let y=0;y<8;y++)for(let x=0;x<6;x++)if(h.board[y][x]>=0){if(x<5&&h.board[y][x]===h.board[y][x+1])neighbors++;if(y<7&&h.board[y][x]===h.board[y+1][x])neighbors++;}
  const score=(h.score-g.score)*.1-height*2-max*8+neighbors*6+(h.hp-g.hp)*.2+(h.shield-g.shield)*.1;
  if(!best||score>best.score)best={rot,col,score};
 }
 return best;
}
const results=[];
for(const mode of ['normal','relaxed'])for(let seed=1;seed<=10;seed++){
 const g=new Game(seed,mode);let next=0;
 for(let frame=0;frame<60*420&&g.phase==='playing';frame++){
  if(g.sp>=100)g.skill();
  if(g.active&&g.time>=next){const pick=choose(g);if(pick){for(let i=0;i<pick.rot;i++)g.rotate();g.moveTo(pick.col);g.drop();}else g.drop();next=g.time+1.25;}
  g.tick(1/60);g.events=[];
 }
 results.push({mode,seed,result:g.phase,time:Math.round(g.time),wave:g.wave,score:g.score,hp:Math.round(g.hp),matches:g.matched,drops:g.dropCount});
}
console.log(JSON.stringify({wins:results.filter(r=>r.result==='won').length,total:results.length,results},null,2));
if(results.some(r=>r.result!=='won'))process.exitCode=1;
