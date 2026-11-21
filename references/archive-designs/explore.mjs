import {items as originals, ui} from './archive.mjs';
import {landing} from './landing.mjs';

const {esc}=ui;
async function data(name) {
  const response=await fetch('/'+name+'.json');
  if(!response.ok) throw Error('Could not load '+name);
  return response.json();
}
const [annotations,projects,excerpts,connections]=await Promise.all(
  ['atlas-taxonomy','atlas-sources','atlas-extra','trail-links'].map(data)
);
const items=[...originals.map(item=>({...item,...annotations.items[item.id]})),...projects,...excerpts]
  .sort((a,b)=>b.date.localeCompare(a.date)||a.title.localeCompare(b.title));
const lookup=new Map(items.map(item=>[item.id,item]));
const view=document.querySelector('#view');
const allLink=document.querySelector('#all-link');
allLink.textContent='All '+items.length+' entries ↗';
const trailUrl=path=>'#read/'+path.map(encodeURIComponent).join('/');
const openLink=(id,label)=>`<a href="${esc(trailUrl([id]))}">${esc(label)}</a>`;
const storeKey='reading-trails.v1';
let visited=[];
try{visited=JSON.parse(sessionStorage.getItem(storeKey)||'[]')}catch{visited=[]}
visited=Array.isArray(visited)?visited.filter(path=>Array.isArray(path)&&path.length&&path.every(id=>lookup.has(id))):[];

function remember(path){
  if(visited.some(old=>old.length>=path.length&&path.every((id,n)=>id===old[n])))return;
  visited=visited.filter(old=>!old.every((id,n)=>id===path[n]));
  visited.push(path);
  try{sessionStorage.setItem(storeKey,JSON.stringify(visited))}catch{/* In-memory trails still work when storage is unavailable. */}
}

function tree(path){
  const root=new Map();
  for(const route of visited.filter(r=>r[0]===path[0])){
    let node=root;
    for(const id of route){
      if(!node.has(id))node.set(id,new Map());
      node=node.get(id);
    }
  }
  const current=trailUrl(path);
  function branches(nodes,prefix){
    return '<ol>'+[...nodes].map(([id,children])=>{
      const next=[...prefix,id],url=trailUrl(next),active=url===current;
      return `<li><a href="${esc(url)}" class="branch${active?' active':''}" ${active?'aria-current="page"':''}>${esc(lookup.get(id).title)}</a>${children.size?branches(children,next):''}</li>`;
    }).join('')+'</ol>';
  }
  return branches(root,[]);
}

function source(url,label){
  if(new URL(url).protocol!=='https:')throw Error('Expected HTTPS source');
  return `<a class="source" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
}
function body(item){
  let text=(item.body||item.description).replaceAll('\\n','\n'),html='',extra=[];
  for(const l of item.links||[]){
    const pos=text.indexOf(l.label),anchor=source(l.url,l.label);
    if(pos<0){extra.push(anchor);continue}
    html+=esc(text.slice(0,pos))+anchor;text=text.slice(pos+l.label.length);
  }
  html+=esc(text);
  html=html.split(/\n\s*\n/).map(paragraph=>{
    const groups=[];
    for(const line of paragraph.split('\n')){
      const quoted=line.startsWith('&gt; ');
      if(!groups.length||groups.at(-1).quoted!==quoted)groups.push({quoted,lines:[]});
      groups.at(-1).lines.push(quoted?line.slice(5):line);
    }
    return groups.map(({quoted,lines})=>{
      const paragraph='<p>'+lines.join('<br>')+'</p>';
      return quoted?'<blockquote>'+paragraph+'</blockquote>':paragraph;
    }).join('');
  }).join('');
  if(item.kind==='Call excerpt'||(item.kind==='Call note'&&item.body.startsWith('“')))html='<blockquote>'+html+'</blockquote>';
  if(item.url)extra.push(source(item.url,item.kind==='Repository'?'View repository':'Open Google Doc'));
  return html+extra.map(a=>'<p>'+a+'</p>').join('');
}

function reader(path){
  remember(path);
  const id=path.at(-1),item=lookup.get(id),links=connections[id];
  const forks=links.map(({to,reason})=>{
    const seen=path.indexOf(to);
    const next=seen===-1?[...path,to]:path.slice(0,seen+1);
    return `<a class="fork" href="${esc(trailUrl(next))}"><span class="reason">${esc(reason)}</span><strong>${esc(lookup.get(to).title)} ↗</strong></a>`;
  }).join('');
  return `<div class="workspace"><article class="reading"><p class="kicker">${ui.meta(item)}</p><h1>${esc(item.title)}</h1><a class="trail-jump" href="#trail-location">Your trail ↓</a><div class="body">${body(item)}</div><section class="forks"><h2>Follow a connection</h2>${forks}</section></article><aside class="trail" id="trail-location" tabindex="-1"><h2>Your trail</h2>${tree(path)}</aside></div>`;
}

function archive(query){
  view.innerHTML=`<section class="index"><h1>All entries</h1><label for="find">Search the archive</label><input id="find" type="search" placeholder="A phrase, a tool, a question…" value="${esc(query)}"><p id="count" aria-live="polite"></p><div class="results"></div></section>`;
  const find=document.querySelector('#find');
  function results(){
    const words=find.value.toLowerCase().trim().split(/\s+/);
    const hits=items.filter(i=>words.every(w=>[i.title,i.description,i.body,i.kind,...(i.tags||[])].join(' ').toLowerCase().includes(w)));
    document.querySelector('#count').textContent=hits.length?hits.length+' '+(hits.length===1?'entry':'entries'):'No matching entries';
    document.querySelector('.results').innerHTML=hits.map(i=>`<a href="${trailUrl([i.id])}"><small>${ui.meta(i)}</small><strong>${esc(i.title)}</strong></a>`).join('');
  }
  find.oninput=()=>{history.replaceState(null,'',find.value?'#all/'+encodeURIComponent(find.value):'#all');results()};
  results();
}
function render(moveFocus=false){
  const [page,...parts]=location.hash.slice(1).split('/').map(decodeURIComponent);
  let path=page==='read'?parts:[];
  if(['terrain','orbits'].includes(page)&&parts[0]==='entry'&&lookup.has(parts[1]))path=[parts[1]];
  const isReading=path.length&&path.every(id=>lookup.has(id));
  const title=isReading?lookup.get(path.at(-1)).title:page==='all'?'All entries':'AI uplift consultant';
  document.title=title+' · Alejo Acelas';
  if(page==='all')archive(parts.join('/'));
  else view.innerHTML=isReading?reader(path):landing(items,{esc,openLink});
  if(moveFocus)view.focus({preventScroll:true});
  window.scrollTo(0,0);
}
view.addEventListener('click',event=>{
  const jump=event.target.closest('.trail-jump');if(!jump)return;
  event.preventDefault();const node=document.querySelector('#trail-location');node.focus();node.scrollIntoView({block:'start'});
});
window.addEventListener('hashchange',()=>render(true));render();
