const paths = [
  {title:'Find your first AI project', intro:'Start with the work you actually do. These three pieces take you from spotting a bottleneck to mapping a process.',ids:['1793704230.839999','159tncXDj-lS8zy40YB8WEuJWCkc8ov19duwgv7kOkBg','1xuLpOdGa2b470lAIqMPMwg36wm1INq0PQy0TIhRABDk']},
  {title:'Get an agent back on track',intro:'Try a prompt, see how it behaves on real work, then consider the cost of juggling several agents.',ids:['1793963939.881499','testing-prompts','1794907853.133389']}
];
function volumes(items) {
  const byId = new Map(items.map(i=>[i.id,i]));
  const editions = paths.map(p=>({...p,group:'Guided reading',entries:p.ids.map(id=>byId.get(id)).filter(Boolean)})).filter(p=>p.entries.length);
  const months=new Map();
  for(const item of items) {
    const key=item.date.slice(0,7);
    if(!months.has(key)) months.set(key,[]);
    months.get(key).push(item);
  }
  for(const [key,entries] of months) {
    const title=new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(key+'-01'));
    editions.push({title,group:'Full archive by month',intro:'Every entry from '+title+', newest first.',entries});
  }
  return editions;
}
export default function readingRoom(items,ui) {
 const books=volumes(items);
 return `<div class="reading-room">
   <header class="room-mast"><div class="room-identity"><i class="room-book" aria-hidden="true"></i><strong>Alejo Acelas</strong></div><span>Independent AI uplift consultant</span></header>
   <div class="room-shelf"><label for="room-volume">Choose a reading path or month</label><select id="room-volume">${['Guided reading','Full archive by month'].map(group=>`<optgroup label="${group}">${books.map((v,k)=>v.group===group?`<option value="${k}">${ui.esc(v.title)} (${v.entries.length})</option>`:'').join('')}</optgroup>`).join('')}</select></div>
   <div class="room-frame"><aside class="room-index"><div class="room-index-heading"><h2>Contents</h2></div><div class="room-rows"></div></aside>
   <section class="room-pane"><header class="room-deskbar"><span class="room-roomname">Reading room</span><button class="room-contents" aria-expanded="false">Contents</button><div class="room-paging"><span class="room-position" aria-live="polite"></span><button data-step="-1" aria-label="Previous reading">←</button><button data-step="1" aria-label="Next reading">→</button></div></header><div class="room-page"></div></section></div></div>`;
}
export function init(items,ui){
 const books=volumes(items), root=document.querySelector('.reading-room');
 const pick=s=>root.querySelector(s), volume=pick('#room-volume'), list=pick('.room-rows'), page=pick('.room-page'), contents=pick('.room-contents');
 let index=0;
 function toggle(open){root.classList.toggle('room-list-open',open);contents.setAttribute('aria-expanded',String(open));}
 function render(){
   const book=books[Number(volume.value)], item=book.entries[index];
   const start=Math.floor(index/8)*8;
   list.innerHTML=`<div class="room-chapter"><small>${ui.esc(book.group)}</small><h3>${ui.esc(book.title)}</h3><p>${ui.esc(book.intro)}</p></div>`+
    book.entries.slice(start,start+8).map((i,k)=>`<button class="room-row" data-row="${start+k}" ${start+k===index?'aria-current="true"':''}><span class="room-glyph">${start+k+1}</span><span class="room-row-text"><span class="room-row-caption">${ui.meta(i)}</span><span class="room-row-title">${ui.esc(i.title)}</span></span></button>`).join('');
   if(book.entries.length>8) list.innerHTML+=`<div class="room-batch"><button data-row="${start-8}" ${start===0?'disabled':''}>← Previous 8</button><button data-row="${start+8}" ${start+8>=book.entries.length?'disabled':''}>Next 8 →</button></div>`;
   page.innerHTML=`<article class="room-text"><div class="room-folio">${ui.esc(book.title)} <span>${ui.meta(item)}</span></div><h1>${ui.esc(item.title)}</h1><div class="room-copy">${ui.read(item)}</div></article>`;
   pick('.room-position').textContent=(index+1)+' / '+book.entries.length;
   pick('[data-step="-1"]').disabled=index===0;pick('[data-step="1"]').disabled=index===book.entries.length-1;page.scrollTop=0;
 }
 function select(next,focusList=false){index=next;render();if(focusList)list.querySelector('[aria-current]')?.focus();else{toggle(false);if(matchMedia('(max-width:720px)').matches) contents.focus()}}
 volume.onchange=()=>{index=0;toggle(false);render()};
 root.addEventListener('click',e=>{const row=e.target.closest('[data-row]'),step=e.target.closest('[data-step]');if(row)select(Number(row.dataset.row));if(step)select(index+Number(step.dataset.step))});
 contents.onclick=()=>{const open=!root.classList.contains('room-list-open');toggle(open);if(open)list.querySelector('[aria-current]')?.focus()};
 root.addEventListener('keydown',e=>{if(e.key==='Escape'){toggle(false);contents.focus();return}if(!e.target.closest('.room-row'))return;const offset={ArrowUp:-1,ArrowDown:1}[e.key];if(offset&&books[Number(volume.value)].entries[index+offset]){e.preventDefault();select(index+offset,true)}});
 render();
}
export const css = `
body:has(.reading-room){margin:0;background:#101719;color:#eae6dc}
.reading-room,.reading-room *{box-sizing:border-box}
.reading-room{--ink:#101719;--panel:#172022;--line:#374040;--muted:#a6b0a9;--ivory:#ede9de;--gold:#dfc183;color:var(--ivory);background:var(--ink);min-height:100svh;padding:0 clamp(16px,4vw,68px) 28px;font:15px/1.45 system-ui,-apple-system,sans-serif;color-scheme:dark}
.reading-room button{color:inherit;background:none;font:inherit;cursor:pointer;border:0}
.reading-room [hidden]{display:none!important}
.reading-room button:focus-visible,.reading-room a:focus-visible{outline:2px solid var(--gold);outline-offset:-3px}
.room-mast{max-width:1550px;height:91px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:16px}
.room-identity{display:flex;align-items:center;gap:15px}
.room-identity strong{font:normal 24px/1 Georgia,serif;letter-spacing:-.045em}
.room-mast>span{color:#bcc3bb;font-size:13px}
.room-book{display:block;width:25px;height:22px;position:relative;transform:rotate(-8deg)}
.room-book:before,.room-book:after{content:'';position:absolute;inset:3px 13px 1px 0;border:1.5px solid var(--gold);border-radius:1px 4px 0 0;transform:skewY(15deg);box-shadow:0 3px var(--ink),0 4px var(--gold)}
.room-book:after{inset:3px 0 1px 13px;transform:skewY(-15deg);border-radius:4px 1px 0 0}
.room-frame{display:grid;grid-template-columns:clamp(250px,30%,420px) minmax(0,1fr);max-width:1550px;margin:auto;height:clamp(520px,calc(100svh - 133px),1100px);border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--panel);box-shadow:0 16px 42px #060c0c55}
.room-index,.room-pane{min-height:0;min-width:0;display:flex;flex-direction:column}
.room-index{border-right:1px solid var(--line);background:#161e20}
.room-index-heading,.room-deskbar{min-height:63px;padding:0 23px;display:flex;gap:12px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}
.room-index-heading h2{margin:0;font:normal 25px/1 Georgia,serif;letter-spacing:-.045em}
.room-index-heading>span,.room-position,.room-row-caption,.room-folio,.room-roomname{font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.025em}
.room-index-heading>span,.room-position,.room-row-caption{color:var(--muted)}
.room-rows,.room-page{overflow:auto;scrollbar-color:#414b45 transparent;scrollbar-width:thin;overscroll-behavior:contain}
.reading-room .room-row{width:100%;position:relative;display:grid;grid-template-columns:22px minmax(0,1fr);gap:11px;align-items:start;text-align:left;padding:16px 22px;border-bottom:1px solid #30393a;color:#d5dad2}
.room-row:hover{background:#202c2d}
.reading-room .room-row[aria-current]{background:#293231;color:#f6eacb;box-shadow:inset 3px 0 var(--gold)}
.room-row-text{min-width:0}
.room-row-caption,.room-row-title{display:block}
.room-dot{margin:0 7px;color:#778078}
.room-row-title{font-size:15px;font-weight:510;line-height:1.29;margin-top:4px;overflow-wrap:anywhere}
.room-glyph{font:normal 20px/1 Georgia,serif;text-align:center;color:#91a198;padding-top:5px}
.room-row[aria-current] .room-glyph{color:var(--gold)}
.room-pane{background:radial-gradient(ellipse at 85% 0%,#29332e 0%,transparent 56%),#1d2727}
.room-deskbar{padding-inline:clamp(18px,3vw,46px);background:#1c2525aa}
.room-roomname,.room-folio{text-transform:uppercase;letter-spacing:.17em}
.room-roomname{color:#c4cbbf}
.room-paging{display:flex;align-items:center;gap:5px}
.room-position{margin-right:9px;font-variant-numeric:tabular-nums}
.room-paging button{border:1px solid #4e5851;border-radius:50%;width:32px;height:32px;display:grid;place-items:center;font:19px/1 Georgia,serif}
.room-paging button:disabled{opacity:.35;cursor:default}
.room-paging button:enabled:hover,.room-contents:hover{background:#344039}
.room-contents{display:none}
.room-page{flex:1;padding:clamp(35px,6vw,85px) clamp(24px,5.5vw,96px) 50px}
.room-text{max-width:720px;margin:auto}
.room-folio{display:flex;align-items:center;gap:12px;flex-wrap:wrap;color:var(--gold);font-size:10px}
.room-folio:before{content:'';width:33px;height:1px;background:var(--gold)}
.room-folio span+span{color:#c1c5b8;border-left:1px solid #6f7970;padding-left:12px}
.room-text h1{font:normal clamp(36px,5.7vw,94px)/1.01 Georgia,'Times New Roman',serif;letter-spacing:-.063em;text-wrap:balance;overflow-wrap:anywhere;margin:.42em 0 .38em;color:#f2eddf}
.room-copy{border-top:1px solid #65706577;padding-top:clamp(16px,2.5vw,36px);font:normal clamp(17px,1.7vw,23px)/1.58 Georgia,'Times New Roman',serif;color:#d0d4c8;overflow-wrap:anywhere}
.room-copy :is(p,blockquote){margin:0 0 1em}
.room-copy a{color:#f0d59c;text-underline-offset:.22em;text-decoration-thickness:1px}
.room-copy a:hover{color:white}
@media(max-width:720px){
.reading-room{padding:0 12px 18px}
.room-mast{height:70px}
.room-mast>span{font-size:11px;text-align:right;max-width:120px}
.room-frame{position:relative;display:block;height:calc(100svh - 92px);min-height:420px}
.room-pane{height:100%}
.room-page{padding:38px 22px}
.room-text h1{font-size:clamp(36px,10vw,70px)}
.room-index{display:none;position:absolute;z-index:2;inset:54px 0 0;border:0}
.room-list-open .room-index{display:flex}
.room-index-heading{min-height:48px}
.room-roomname{display:none}
.room-contents{display:block;font-size:14px;padding:6px 8px;margin-left:-8px;border-radius:4px}
.room-deskbar{min-height:54px;padding:0 15px}
}

.room-shelf{max-width:1550px;margin:0 auto 14px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.room-shelf label,.room-chapter small{font:12px/1.4 ui-monospace,monospace;color:#cbbd9b}
.room-shelf select{max-width:100%;padding:8px 12px;background:#26302e;color:#fff3d8;border:1px solid #646b5d;border-radius:4px}
.room-chapter{padding:20px 21px;border-bottom:1px solid var(--line)}
.room-chapter h3{margin:6px 0;font:normal 25px/1.15 Georgia,serif;color:#ffedbf}
.room-chapter p{font-size:14px;margin:0;color:#c6cbbf}
.room-frame{height:clamp(510px,calc(100svh - 185px),1050px)}
.room-batch{display:flex;justify-content:space-between;padding:12px;font-size:13px}.room-batch button:disabled{opacity:.35}
@media(max-width:720px){.room-shelf{gap:5px}.room-shelf label{width:100%}.room-frame{height:calc(100svh - 162px)}}
`;
