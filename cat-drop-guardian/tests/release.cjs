const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const original=CanvasRenderingContext2D.prototype.drawImage;window.__spriteRects=[];CanvasRenderingContext2D.prototype.drawImage=function(...args){if(this.canvas.id==='battle'&&args.length===9){const [,,,,,x,y,w,h]=args,m=this.getTransform();window.__spriteRects.push({x:x*m.a+m.e,y:y*m.d+m.f,w:w*m.a,h:h*m.d,cw:this.canvas.width,ch:this.canvas.height});if(window.__spriteRects.length>100)window.__spriteRects.shift();}return original.apply(this,args);};});
 await page.goto('http://127.0.0.1:8765/cat-drop-guardian/?qa');await page.click('#start');
 await page.evaluate(()=>{const g=__catQA.game;for(let i=0;i<4;i++){g.summon(i);g.units.find(u=>u.type===i).x=[167,315,215,265][i];}g.spawnEnemy();g.enemies[0].x=47;g.spawnEnemy();g.enemies[1].x=104;g.enemies[1].boss=true;g.enemies[1].type=1;__catQA.hud();__catQA.render();});
 const evidence=[];
 for(const [width,height]of[[320,568],[360,640],[390,844],[768,1024],[844,390]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(90);await page.evaluate(()=>{window.__spriteRects=[];__catQA.render();});
  const rects=await page.evaluate(()=>window.__spriteRects);
  assert.ok(rects.length>=6);assert.ok(rects.every(r=>Math.abs(r.w-r.h)<.001),'sprite aspect ratio');assert.ok(rects.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=r.cw+.1&&r.y+r.h<=r.ch+.1),'sprite containment');
  const feet=rects.slice(0,6).map(r=>r.y+r.h);assert.ok(Math.max(...feet)-Math.min(...feet)<.001,'common groundY');
  await page.screenshot({path:`qa/release-${width}x${height}.png`,fullPage:true});evidence.push({width,height,sprites:rects.length,aspect:'PASS',bounds:'PASS',groundY:'PASS'});
 }
 await page.goto('file://'+path.resolve(__dirname,'../CAT_DROP_GUARDIAN_v1.0.html')+'?qa');await page.click('#start');assert.equal(await page.evaluate(()=>__catQA.game.phase),'playing');
 await page.goto('http://127.0.0.1:8765/');await page.setViewportSize({width:320,height:700});
 const nav=await page.evaluate(()=>({width:document.documentElement.scrollWidth,sections:[...document.querySelectorAll('main>section')].map(e=>e.id),newLink:document.querySelector('#cat-drop-guardian .open-game').getAttribute('href'),download:document.querySelector('#cat-drop-guardian a[download]').getAttribute('href')}));
 assert.ok(nav.width<=320);assert.deepEqual(nav.sections,['tenku-game','neko-gravity','cat-drop-guardian']);assert.equal(nav.newLink,'./cat-drop-guardian/');assert.equal(nav.download,'./cat-drop-guardian/CAT_DROP_GUARDIAN_v1.0.html');
 await page.locator('#cat-drop-guardian').screenshot({path:'qa/site-entry.png'});assert.deepEqual(errors,[]);
 fs.writeFileSync('qa/release-results.json',JSON.stringify({evidence,nav,errors},null,2));console.log(JSON.stringify({spriteLayouts:evidence.length,portable:'PASS',siteEntry:'PASS',errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
