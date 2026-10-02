/* Run against a local HTTP server. BROWSER_EXECUTABLE optionally selects Chromium. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.CAT_TEST_URL || 'http://127.0.0.1:8765/cat-drop-guardian/';
const out = path.resolve(process.env.CAT_QA_DIR || 'qa');
fs.mkdirSync(out,{recursive:true});
const checks=[];
const ok = (name,detail) => { checks.push({name,result:'PASS',detail}); console.log('PASS',name); };
(async()=>{
 const args={headless:true};
 if(process.env.BROWSER_EXECUTABLE){args.executablePath=process.env.BROWSER_EXECUTABLE;args.args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'];}
 const browser=await chromium.launch(args);
 try {
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true,acceptDownloads:true});
 const page=await context.newPage(),errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()]);});
 await page.goto(base+'?qa',{waitUntil:'networkidle'});
 await page.screenshot({path:path.join(out,'home-390.png'),fullPage:true});
 assert.equal(await page.locator('#home-art').getAttribute('data-ready'),'true');
 assert.equal(await page.locator('#key-visual').evaluate(el=>el.naturalWidth),864);ok('Title, original atlas and art load');
 await page.locator('#start').tap();
 assert.equal(await page.evaluate(()=>__catQA.game.phase),'playing');ok('Start by touch');
 await page.locator('[data-control="left"]').tap();await page.locator('[data-control="left"]').tap();
 assert.equal(await page.evaluate(()=>__catQA.game.active.x),0);
 await page.locator('[data-control="drop"]').tap();await page.waitForTimeout(520);
 assert.ok(await page.evaluate(()=>__catQA.game.units.some(u=>u.type===0)));ok('Touch move and first calico deployment');
 await page.screenshot({path:path.join(out,'game-390.png'),fullPage:true});
 await page.locator('#pause').tap();const before=await page.evaluate(()=>__catQA.game.time);await page.waitForTimeout(180);
 assert.equal(await page.evaluate(()=>__catQA.game.time),before);assert.equal(await page.evaluate(()=>__catQA.paused),true);ok('Pause freezes battle and puzzle');
 await page.locator('[data-action="resume"]').tap();await page.waitForTimeout(100);assert.ok(await page.evaluate(t=>__catQA.game.time>t,before));ok('Resume advances exactly once');
 await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>__catQA.game.dropCount),2);ok('Keyboard rotation, move, hard drop');
 await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));});assert.equal(await page.evaluate(()=>__catQA.paused),true);ok('Blur automatically pauses');
 await page.locator('[data-action="resume"]').tap();
 await page.evaluate(()=>{__catQA.game.sp=100;__catQA.hud();});await page.locator('#skill').tap();assert.equal(await page.evaluate(()=>__catQA.game.skillCount),1);assert.equal(await page.locator('#skill').isDisabled(),true);ok('Skill consumes SP once and disables button');
 await page.locator('#pause').tap();await page.locator('[data-action="retry"]').tap();await page.locator('[data-action="resume"]').tap();assert.equal(await page.evaluate(()=>__catQA.game.skillCount),1);ok('Cancel restart preserves progress');
 await page.evaluate(()=>__catQA.save());const score=await page.evaluate(()=>__catQA.game.score);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#continue').isVisible(),true);await page.locator('#continue').tap();assert.equal(await page.evaluate(()=>__catQA.game.score),score);ok('Reload and continue preserve progress');
 const r=await page.locator('#board').boundingBox();
 const touch=await context.newCDPSession(page);
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width*.4,y:r.y+40}]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+r.width*.4,y:r.y+110}]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForTimeout(450);assert.ok(await page.evaluate(()=>__catQA.game.dropCount>=3));ok('Down swipe drops a pair');
 for(const [width,height] of [[320,568],[360,640],[390,844],[768,1024],[844,390]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(80);
  const layout=await page.evaluate(()=>{const a=__catQA.layout(),r=document.querySelector('#game').getBoundingClientRect();const buttons=[...document.querySelectorAll('.controls button,#skill,#pause')].map(e=>{const z=e.getBoundingClientRect();return{x:z.x,y:z.y,w:z.width,h:z.height,b:z.bottom}});return{a,r:{width:r.width,height:r.height},buttons,scroll:document.documentElement.scrollWidth,vw:innerWidth,vh:innerHeight};});
  assert.ok(layout.scroll<=width+1,'no horizontal overflow');
  assert.ok(layout.a.board.x>=0&&layout.a.board.y>=0);assert.ok(layout.a.board.cell>=24);
  assert.ok(layout.buttons.every(b=>b.x>=0&&b.x+b.w<=width+1&&b.b<=height+1),JSON.stringify(layout));
  await page.screenshot({path:path.join(out,`game-${width}x${height}.png`),fullPage:true});ok(`Responsive ${width}×${height}`);
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{__catQA.game.hp=1;__catQA.game.shield=0;__catQA.game.hurtCastle(5);__catQA.events();});assert.match(await page.locator('#modal-title').textContent(),/もう一度/);assert.equal(await page.evaluate(()=>__catQA.game.phase),'lost');ok('Loss dialog and terminal state');
 await page.locator('[data-action="again"]').tap();assert.equal(await page.evaluate(()=>__catQA.game.score),0);assert.equal(await page.evaluate(()=>__catQA.game.hp),200);ok('Retry fully resets state');
 await page.evaluate(()=>{__catQA.game.wave=5;__catQA.game.finish(true,'すべての猫を守り抜きました');__catQA.events();});assert.match(await page.locator('#modal-title').textContent(),/守り抜いた/);await page.screenshot({path:path.join(out,'victory.png')});ok('Victory dialog');
 await page.locator('[data-action="home"]').tap();await page.locator('#mode-relaxed').tap();await page.locator('#start').tap();assert.equal(await page.evaluate(()=>__catQA.game.mode),'relaxed');ok('Practice difficulty is selected');
 await page.locator('#pause').tap();
 const downloadPromise=page.waitForEvent('download');await page.locator('[data-action="download"]').tap();const download=await downloadPromise;const portable=path.join(out,download.suggestedFilename());await download.saveAs(portable);
 const filePage=await context.newPage();await filePage.goto('file://'+portable+'?qa');await filePage.locator('#start').tap();assert.equal(await filePage.evaluate(()=>__catQA.game.phase),'playing');assert.equal(await filePage.locator('link[rel="manifest"]').count(),0);ok('Saved single HTML opens and plays via file://');await filePage.close();
 await page.goto(base+'?qa',{waitUntil:'networkidle'});await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload({waitUntil:'networkidle'});assert.ok(await page.evaluate(()=>navigator.serviceWorker.controller));
 await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#start').tap();assert.equal(await page.evaluate(()=>__catQA.game.phase),'playing');ok('Installed service worker allows offline reload and play');await context.setOffline(false);
 const origin=new URL(base).origin;assert.ok((await page.evaluate(()=>navigator.serviceWorker.getRegistrations().then(rs=>rs.map(r=>r.scope)))).every(s=>s===origin+'/cat-drop-guardian/'));ok('PWA scope does not affect neighboring games');
 await page.evaluate(()=>{__catQA.game.phase='lost';localStorage.setItem('cat-drop-guardian-v1','{"version":1,"board":null}');});await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#continue').isVisible(),false);await page.locator('#start').tap();assert.equal(await page.evaluate(()=>__catQA.game.phase),'playing');ok('Corrupt save falls back to a new game');
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);ok('No JavaScript exceptions or HTTP resource failures');
 await context.close();
 const blocked=await browser.newContext({viewport:{width:390,height:844}});await blocked.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('blocked','SecurityError')};Storage.prototype.getItem=function(){throw new DOMException('blocked','SecurityError')};});const bp=await blocked.newPage();await bp.goto(base+'?qa');await bp.click('#start');assert.equal(await bp.evaluate(()=>__catQA.game.phase),'playing');ok('Game remains playable when localStorage is blocked');await blocked.close();
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({checks,errors,failed},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(out,'browser-failure.txt'),e.stack);process.exitCode=1;});
