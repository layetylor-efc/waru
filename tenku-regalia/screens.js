import {CHARACTERS,STAGES,stats} from './core.js';

const fmt=n=>Math.round(n).toLocaleString('ja-JP');
export const screenFiles={title:'06-3176.webp',home:'07-3174.webp',quests:'02-3170.webp',hero:'09-3171.webp',summon:'summon.webp',victory:'04-3178.webp',skills:'03-3179.webp',tower:'08-3173.webp'};
const pos=(x,y,w,h)=>`left:${x}%;top:${y}%;width:${w}%;height:${h}%`;
const box=(x,y,w,h,html,cls='')=>`<div class="skin-box ${cls}" style="${pos(x,y,w,h)}">${html}</div>`;
const hit=(x,y,w,h,label,action,cls='')=>`<button class="skin-hit ${cls}" style="${pos(x,y,w,h)}" aria-label="${label}" title="${label}" ${action}><span class="sr-only">${label}</span></button>`;
const off=(x,y,w,h,label)=>`<button class="skin-block" style="${pos(x,y,w,h)}" disabled aria-label="${label}・未実装"><span>未実装</span></button>`;
const plate=(x,y,w,h,html,cls='')=>box(x,y,w,h,html,`ornate ${cls}`);
const btn=(x,y,w,h,html,action,cls='')=>`<button class="skin-button ornate ${cls}" style="${pos(x,y,w,h)}" ${action}>${html}</button>`;
const frame=(name,content)=>`<section class="reference-screen" aria-label="${name}"><img class="reference-art" src="assets/screens/${screenFiles[name]}" alt="">${content}</section>`;
const portrait=(art,id,cls='')=>`<img class="character-art ${cls}" src="${art.characters[id].portrait}" alt="${CHARACTERS[id].name}">`;
const wallet=save=>`<span>◉ ${fmt(save.gold)}</span><span>◆ ${fmt(save.gems)}</span>`;
function playerBar(save,art){const c=CHARACTERS[save.selectedHero],s=stats(save);return box(1,0.6,98,7.4,`<button class="mini-portrait" data-route="hero">${portrait(art,c.id)}</button><div class="mini-hp"><b>${c.short} <small>Lv.${1+Math.floor(save.xp/450)}</small></b><div class="skin-hp">HP ${s.hp} / ${s.hp}</div><div class="skin-mp">MP 100 / 100</div></div><div class="skin-wallet">${wallet(save)}</div><button class="mini-settings" data-route="settings" aria-label="設定">⚙</button>`,'player-bar');}
function commonTop(save){return box(43,1,36,6,wallet(save),'currency-bar')+hit(79.5,1,8,7,'設定','data-route="settings"')+off(88,1,6,7,'図鑑')+off(94,1,6,7,'実績');}
function bottomNav(){return hit(0,89.5,18,10.5,'ホーム','data-route="home"')+hit(18,89.5,16,10.5,'キャラステータス','data-route="hero"')+hit(34,89.5,16,10.5,'4人から選択','data-choose')+hit(50,89.5,16,10.5,'クエスト','data-route="quests"')+hit(66,89.5,16,10.5,'召喚','data-route="summon"')+hit(82,89.5,18,10.5,'メニュー','data-route="settings"');}

export function titleScreen(save,art){return frame('title',playerBar(save,art)
 +plate(20,32,60,3.5,'SHOOTING ・ 4 HEROES','subtitle')
 +off(79,7.5,10,5.5,'お知らせ')+off(90,7.5,10,5.5,'プレゼント')
+hit(18,68.5,63,10,'スタート','data-route="home"','start-pulse')
 +hit(30,80,40,6,'続きから','data-continue')
 +hit(6,89,21,10,'キャラクター選択','data-choose')
 +off(27,89,21,10,'図鑑')
 +off(50,89,21,10,'ミッション')
 +hit(74,89,23,10,'設定','data-route="settings"')
 +plate(18,65,64,3.2,`選択中：${CHARACTERS[save.selectedHero].name}`,'selected-caption')
 +box(3,98,94,1.7,'v0.4.2 ・ オフライン','version-note'));
}
export function homeScreen(save,art){return frame('home',playerBar(save,art)
 +off(87,8,13,8,'ミッション')+off(87,16,13,8,'メール')+off(87,24,13,8,'プレゼント')
 +off(1,16,38,11,'期間限定イベント')+off(2,51.5,23,5,'ショップ')
 +hit(27,48.8,19,5.6,'鍛冶屋・強化','data-upgrades')
 +off(77,51.5,21,5.3,'ギルド')
 +hit(79,64,21,6,'クエスト','data-route="quests"')
 +btn(23,83,54,5.3,`${CHARACTERS[save.selectedHero].name}　⌄`,'data-choose','hero-name-button')
 +bottomNav());}

export function questScreen(save,selected,art){const stage=STAGES[selected-1];let content=commonTop(save)
 +hit(0,0,41,8,'天空王都へ戻る','data-route="home"')
 +off(26,9.6,25,5.8,'サイドクエスト')+off(51.5,9.6,25,5.8,'デイリーミッション')+off(77,9.6,22,5.8,'報酬受取')
 +plate(49,16.8,42,4.2,`1-${selected}　${stage.name}`,'quest-heading')
 +plate(50,21.1,25,2.8,save.clears[selected]?'★'.repeat(save.clears[selected].stars)+'☆'.repeat(3-save.clears[selected].stars):'☆☆☆','quest-stars');
 const y=[20.5,32.8,45.3,57.3,69.4],h=[11.8,11.8,11.7,11.7,11.7];
 for(let i=0;i<5;i++){const locked=i+1>save.unlocked;content+=hit(1.7,y[i],44,h[i],STAGES[i].name,`data-select="${i+1}" ${locked?'disabled':''}`,`${locked?'quest-disabled':''} ${selected===i+1?'quest-active':''}`);content+=plate(29,y[i]+.6,15,2.4,locked?'🔒':save.clears[i+1]?'★'.repeat(save.clears[i+1].stars):'☆☆☆','small-stars');}
 content+=off(1.7,82.2,44,15.4,'第2章以降')
 +plate(50,54.1,46.5,5.6,`<div>討伐目標 <b>${stage.target}体${stage.boss?' ＋ BOSS':''}</b></div><small>スタミナ消費なし</small>`,'quest-summary')
 +plate(50,70.4,46.5,8,`<small>初回クリア報酬</small><div>◉ +200　 ◆ +30</div><small>討伐報酬はリザルトで加算</small>`,'quest-summary')
 +plate(50,79.5,46.5,10.8,`<label>難易度 <select data-setting="difficulty" aria-label="難易度">${Array.from({length:8},(_,i)=>`<option value="${i+1}" ${save.settings.difficulty===i+1?'selected':''}>${i+1} / 8</option>`).join('')}</select></label><button class="tiny-choice" data-choose>${CHARACTERS[save.selectedHero].name}　変更</button>`,'quest-summary')
 +hit(48,91.3,50,6.1,'クエストに出発',`data-start="${selected}"`)
 +btn(3,97.6,39,2.3,'‹ 天空王都へ','data-route="home"','small-back');
 return frame('quests',content);
}

export function statusScreen(save,art){const c=CHARACTERS[save.selectedHero],s=stats(save),level=1+Math.floor(save.xp/450);return frame('hero',commonTop(save)
 +hit(1,0,42,8,'ホームへ','data-route="home"')
 +off(0,11.6,22,4.5,'装備変更')+off(0,16,22,4.2,'スキルツリー')+off(0,20.4,22,4.2,'進化・覚醒')+off(0,25,22,3.9,'ストーリー')
 +(c.id?box(1,29.4,51,47,`${portrait(art,c.id)}<span>${c.role}</span>`,'character-stage'):box(2,71.8,43,4.1,'女神 セレス','character-label'))
 +plate(55,10.5,42,7.5,`<strong>${c.name}</strong><small>${c.role}</small><span class="stars">★★★★★</span>`,'status-identity')
 +plate(55,18.4,41,3.5,`Lv. ${level} <span>EXP ${save.xp}</span>`,'status-level')
 +plate(55,22,41,14.6,`<div>♥ HP <b>${s.hp}</b></div><div>◆ MP <b>100</b></div><div>⚔ 射撃 <b>${s.shot}</b></div><div>◇ 連射 <b>${(1/s.fireInterval).toFixed(1)}/秒</b></div><div>✦ 晶撃 <b>${s.skill}</b></div><div>➤ 速度 <b>${Math.round(s.speed*100)}%</b></div>`,'status-numbers')
 +plate(55,37.4,41,8.7,`<small>キャラクター特性</small><p>${c.desc}</p>`,'status-desc')
 +off(49,48.5,50,28.8,'装備')+off(29,78.3,70,13.3,'クリスタル装備')
 +btn(1,78,27,13,`${portrait(art,c.id)}<span>4人から選択</span>`,'data-choose','character-switch')
 +hit(1,93,18,6.5,'戻る','data-route="home"')
 +hit(21,93,20,6.5,'強化','data-upgrades')
 +off(41,93,20,6.5,'進化')+off(61,93,20,6.5,'スキルツリー')+off(81,93,18,6.5,'限界突破')
 +hit(1,34,7,7,'前のキャラ','data-cycle="-1"')+hit(47,34,7,7,'次のキャラ','data-cycle="1"')
 +btn(4,66.8,23,3.8,'キャラ変更','data-choose','small-back'));
}

export function summonScreen(save,art){return frame('summon',box(37,1.5,42,4.8,wallet(save),'currency-bar')
 +hit(82,1,8,6,'召喚確率','data-rates')+hit(91,1,9,6,'召喚履歴','data-summon-history')
 +plate(1,9.5,25,5.3,'無料召喚','summon-tab')+off(1,15.9,25,4.5,'通常召喚')+off(1,20.7,25,4.5,'友情召喚')+off(1,25.6,25,4.4,'チケット召喚')
 +off(2,41.8,6,4.8,'前の召喚')+off(91,41.8,7,4.8,'次の召喚')
 +plate(8,67.8,85,7,`<strong>星の記憶を、仲間の力に。</strong><small>4人は最初から選択できます。記憶片5個で射撃強化。</small>`,'summon-banner')
 +btn(29,79,33,7.4,'1回召喚<small>無料 ・ 記憶片 ×1</small>','data-summon','summon-once')
 +off(63,77,36,10,'10連召喚')
 +plate(28,89.1,21,7.3,`召喚回数<br><b>${save.summonCount}</b>`,'summon-count')
 +btn(57,93,21,4.7,'キャラ詳細','data-route="hero"','small-back')
 +btn(80,93,19,4.7,'ホーム','data-route="home"','small-back'));
}

export function characterChoices(save,art){return `<div class="eyebrow">CHOOSE YOUR HERO</div><h2>空を翔ける、4人の力</h2><div class="character-grid">${CHARACTERS.map(c=>`<button class="character-card ${save.selectedHero===c.id?'selected':''}" data-character="${c.id}" style="--hero-color:${c.color}">${portrait(art,c.id)}<strong>${c.name}</strong><small>${c.role}</small><p>${c.desc}</p><span>${save.selectedHero===c.id?'✓ 選択中':'このキャラを選ぶ'}</span></button>`).join('')}</div><button class="secondary" data-close>閉じる</button>`;}

export function summonResult(save,id,art){const c=CHARACTERS[id],fragments=save.fragments[id];return `<div class="summon-reveal"><div class="eyebrow">STAR MEMORY</div><h2>星の記憶が共鳴した</h2>${portrait(art,id)}<h3>${c.name}</h3><div class="result-stars">✦ ✦ ✦</div><p>記憶片 ＋1　<small>所持 ${fragments} 個</small><br>射撃ボーナス ＋${Math.floor(fragments/5)*2}</p><button class="primary blue" data-character="${id}">このキャラを選ぶ</button><button class="secondary" data-route="summon">召喚へ戻る</button></div>`;}

export function resultScreen(r,save,art){const c=CHARACTERS[save.selectedHero],next=r.win?Math.min(5,r.stage+1):r.stage;return frame('victory',
 (c.id?box(0,19,47,55,portrait(art,c.id),'result-character'): '')
 +plate(16,2,82,22,`<div class="victory-word">${r.win?'VICTORY':'RETRY'}</div><div class="result-stars">${r.win?'★'.repeat(r.stars)+'☆'.repeat(3-r.stars):'☆ ☆ ☆'}</div>`,'victory-top')
 +plate(49,29,48,40,`<h3>1-${r.stage} ${STAGES[r.stage-1].name}</h3><p>${r.win?'天空を照らす、新たな一歩。':'強化して、もう一度空へ。'}</p><div>クリアタイム<b>${Math.floor(r.time/60)}:${String(Math.floor(r.time%60)).padStart(2,'0')}</b></div><div>最大コンボ<b>${r.maxCombo}</b></div><div>撃破数<b>${r.kills}</b></div><div>スコア<b>${fmt(r.score)}</b></div><div>難易度<b>${r.difficulty} / 8</b></div><div>獲得コイン<b>＋${fmt(r.gold)}</b></div><div>クリスタル<b>＋${r.gems}</b></div>`,'victory-stats')
 +plate(3,70.5,94,15.5,`${portrait(art,c.id)}<div><strong>${c.name}</strong><p>Lv.${1+Math.floor(save.xp/450)} ・ EXP ${save.xp}</p><small>${r.win?'報酬を受け取り、進行を保存しました。':'今回の戦闘報酬を保存しました。'}</small></div>`,'victory-reward')
 +btn(5,88.4,42,6.7,'↻ リトライ',`data-start="${r.stage}"`)
 +btn(52,88.4,43,6.7,r.win&&r.stage<5?'次へ ❯':'クエストへ',r.win&&r.stage<5?`data-start="${next}"`:'data-route="quests"','gold')
 +btn(20,96,60,3.3,'天空王都へ戻る','data-route="home"','small-back'));
}
