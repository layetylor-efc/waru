'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const read = p => fs.readFileSync(path.join(root,p),'utf8');
let html = read('src/template.html')
  .replace('/*__CSS__*/',()=>read('src/style.css'))
  .replace('/*__CORE__*/',()=>read('src/core.js'))
  .replace('/*__APP__*/',()=>read('src/app.js'));
for (const [token,p] of [['__COVER__','assets/key-visual.png'],['__ATLAS__','assets/chip-atlas.png']]) {
  html = html.replace(token,()=> 'data:image/png;base64,'+fs.readFileSync(path.join(root,p)).toString('base64'));
}
fs.writeFileSync(path.join(root,'index.html'),html);
const portable=html.replace(/<link rel="(?:manifest|icon|apple-touch-icon)"[^>]+>\n/g,'');
fs.writeFileSync(path.join(root,'CAT_DROP_GUARDIAN_v1.0.html'),portable);
console.log(`Built CAT DROP GUARDIAN v1.0.0 (${Buffer.byteLength(html)} bytes)`);
