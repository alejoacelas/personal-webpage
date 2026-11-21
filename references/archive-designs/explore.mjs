import {items as originals, ui} from './archive.mjs';
import {mountGraph} from './constellation.mjs';

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

const $=s=>document.querySelector(s);
const entryUrl=id=>'#entry/'+encodeURIComponent(id);
const ordered=[...items].sort((a,b)=>a.title.localeCompare(b.title));
let selected=null,needle='',matching=[],zoomToSearch=false;
$('#total').textContent=items.length+' entries';
$('#titles').innerHTML=ordered.map(i=>`<a href="${entryUrl(i.id)}"><small>${ui.meta(i)}</small><strong>${esc(i.title)}</strong></a>`).join('');
const graph=mountGraph($('#canvas'),{items,connections,onOpen:id=>{
  if(id===selected)graph.locate(id);
  else location.hash=entryUrl(id);
}});
function hideMatches(){ $('.matches').hidden=true }
function resetSearch(){needle='';$('#find').value='';graph.find(null);hideMatches()}
function route(){
  const [page,...ids]=location.hash.slice(1).split('/').map(decodeURIComponent);
  const id=page==='entry'||page==='read'?ids.at(-1):null;
  selected=lookup.has(id)?id:null;
  resetSearch();
  const item=lookup.get(selected);
  $('#reading').hidden=!item;
  graph.select(selected);
  if(!item){
    document.title='Alejo Acelas · Work index';
    if(page==='index'||page==='all'){$('#index').focus({preventScroll:true});$('#index').scrollIntoView()}
    else{window.scrollTo(0,0);requestAnimationFrame(()=>graph.fit())}
    return;
  }
  document.title=item.title+' · Alejo Acelas';
  $('#meta').textContent=ui.meta(item);
  $('#article').innerHTML=`<h2 class="reading-title" tabindex="-1">${esc(item.title)}</h2><div class="body">${body(item)}</div><section class="forks"><h3>Connected entries</h3>${connections[item.id].map(({to,reason})=>`<a class="fork" href="${entryUrl(to)}"><small>${esc(reason)}</small><strong>${esc(lookup.get(to).title)} ↗</strong></a>`).join('')}</section>`;
  window.scrollTo(0,0);$('#reading').scrollTop=0;
  $('.reading-title').focus({preventScroll:true});
  if(zoomToSearch){requestAnimationFrame(()=>graph.locate(item.id));zoomToSearch=false}
}
$('#locate').onclick=()=>{if(selected)graph.locate(selected)};
$('#close').onclick=()=>{location.hash='#home'};
$('#out').onclick=()=>graph.zoom(1/1.45);$('#in').onclick=()=>graph.zoom(1.45);$('#fit').onclick=()=>graph.fit();
function search(){
 needle=$('#find').value.trim().toLowerCase();
 if(!needle){resetSearch();return}
 matching=ordered.filter(i=>i.title.toLowerCase().includes(needle)||i.kind.toLowerCase().includes(needle));
 graph.find(matching.map(i=>i.id));
 $('.matches').innerHTML=matching.length?matching.map(i=>`<a href="${entryUrl(i.id)}">${esc(i.title)}</a>`).join(''):'<p>No matching titles</p>';
 $('.matches').hidden=false;
}
$('#find').oninput=search;$('#find').onfocus=()=>{if(needle)search()};
$('#find').onkeydown=e=>{if(e.key==='Enter'&&matching.length&&needle){e.preventDefault();zoomToSearch=true;location.hash=entryUrl(matching[0].id);if(matching[0].id===selected){graph.locate(selected);zoomToSearch=false;resetSearch()}}else if(e.key==='ArrowDown'){$('.matches a')?.focus();e.preventDefault()}};
document.addEventListener('click',e=>{if(!e.target.closest('.search'))hideMatches();const result=e.target.closest('.matches a');if(result){zoomToSearch=true;if(result.hash===location.hash&&selected){graph.locate(selected);zoomToSearch=false}resetSearch()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(needle){resetSearch();$('#find').focus()}else if(selected)location.hash='#home'}});
window.addEventListener('hashchange',route);route();
