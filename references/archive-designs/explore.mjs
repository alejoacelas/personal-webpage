import {items as base,ui} from './archive.mjs';
import {renderMap} from './spatial.mjs';
const [catalogue,added,sources]=await Promise.all(['atlas-taxonomy.json','atlas-extra.json','atlas-sources.json'].map(async name=>{
 const r=await fetch('/'+name);if(!r.ok)throw Error('Could not load '+name);return r.json();
}));
const items=[...base.map(i=>({...i,...catalogue.items[i.id]})),...sources,...added].sort((a,b)=>b.date.localeCompare(a.date));
const regions=catalogue.regions, byId=new Map(items.map(i=>[i.id,i]));
const $=s=>document.querySelector(s), esc=ui.esc;
const phone=matchMedia('(max-width:650px)');
function sizeSearch(){ $('#query').placeholder=phone.matches?'Search':'Search the archive'; }
phone.addEventListener('change',sizeSearch);sizeSearch();
const info={
 workflows:'Find a recurring task and decide whether it is worth automating.',
 agents:'Give an agent a clear task, follow its progress, and know when to step in.',
 tools:'Find working tools, integrations, and examples you can try.',
 learning:'Explore how people get started with AI and turn practice into a habit.',
 community:'Find questions, conversations, and experiments from the AI uplift community.'
};
function href(mode,...parts){return '#'+[mode,...parts].map(encodeURIComponent).join('/')}
function itemPath(i,mode){return href(mode,'entry',i.id)}
function connections(item){
 const direct=new Set(item.related||[]);
 const tags=new Set(item.tags||[]);
 return items.filter(i=>i.id!==item.id).map(i=>{
  const shared=(i.tags||[]).filter(t=>tags.has(t));
  const linked=direct.has(i.id)||(i.related||[]).includes(item.id);
  const same=i.region===item.region&&i.subtopic===item.subtopic;
  const score=(linked?20:0)+shared.length*4+(same?3:0);
  return {i,score,reason:shared.length?shared.slice(0,2).join(' · '):same?regions.find(r=>r.id===i.region)?.subjects.find(s=>s.id===i.subtopic)?.label:'Related reading'};
 }).filter(p=>p.score>0).sort((a,b)=>b.score-a.score||b.i.date.localeCompare(a.i.date));
}
let currentMode='terrain',parts=[],observer,focus=null;
function navigate(url){if(url===location.hash)return;location.hash=url}
function render(){
 const [m,...p]=location.hash.slice(1).split('/').map(decodeURIComponent);
 currentMode=m==='orbits'?'orbits':'terrain';parts=p;const mode=currentMode;
 const entry=p[0]==='entry'?byId.get(p[1]):null;
 const region=regions.find(r=>r.id===(entry?.region||p[0]));
 const sub=region?.subjects.find(s=>s.id===(entry?.subtopic||p[1]));
 const query=p[0]==='find'?p[1]||'':'';
 const group=items.filter(i=>(!region||i.region===region.id)&&(!sub||i.subtopic===sub.id));
 const related=entry?connections(entry):[];
 const previous=entry&&byId.get(history.state?.fromEntry);
 const results=query?items.filter(i=>query.toLowerCase().trim().split(/\s+/).every(w=>[i.title,i.description,i.body,i.kind,...(i.tags||[])].join(' ').toLowerCase().includes(w))):entry?related.map(a=>a.i):group;
 const all=href(mode),parent=entry?href(mode,region.id,sub.id):sub?href(mode,region.id):all;
 const crumbs=[['Atlas',all],...(region?[[region.label,href(mode,region.id)]]:[]),...(sub?[[sub.label,href(mode,region.id,sub.id)]]:[])];
 $('#trail').innerHTML=crumbs.map(([s,h])=>`<a href="${esc(h)}">${esc(s)}</a>`).join(' / ')+(entry?' / Reading':query?' / Search':'');
 const heading=entry?.title||(query?'Search results':sub?.label||region?.label||'Work atlas');
 $('#title').textContent=heading;document.title=heading+' · Alejo Acelas';
 $('#intro').textContent=entry?ui.meta(entry):query?results.length+' matches for “'+query+'”':sub?group.length+' entries':region?info[region.id]:'I help people use AI at work. Explore the projects, prompts, and conversations behind it.';
 $('#query').value=query;document.body.classList.toggle('dark',mode==='orbits');
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
 const link=(url,label)=>`<a class="source" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
 const reading=$('#reading');reading.hidden=!entry;
 if(entry){
  const body=esc(entry.body||entry.description).replaceAll('\\n','\n');
  reading.innerHTML=(previous?`<a class="came-from" href="${esc(itemPath(previous,mode))}">← From ${esc(previous.title)}</a>`:'')+(entry.kind==='Call excerpt'?`<blockquote>${body}</blockquote>`:`<p>${body}</p>`)+
   (entry.url?link(entry.url,entry.kind==='Repository'?'View repository':'Open Google Doc'):'')+
   (entry.links||[]).map(l=>'<p>'+link(l.url,l.label)+'</p>').join('')+'<h2 class="continuation">Explore from here</h2>';
 }
 const leaf=!!(sub||entry||query);
 const nodes=leaf?results.slice(0,12).map(i=>({id:i.id,label:i.title,color:regions.find(r=>r.id===i.region)?.color,count:1,kind:'item'})):
  (region?region.subjects:regions).map(s=>({id:s.id,label:s.label,color:region?.color||s.color,kind:region?'topic':'region',count:group.filter(i=>(region?i.subtopic:i.region)===s.id).length})).filter(s=>s.count);
 $('#map').hidden=!nodes.length;
 if(nodes.length)renderMap($('#map'),{mode,nodes,level:entry?'item':sub?'topic':region?'region':'overview',focus,
  onSelect:id=>{focus=id;navigate(leaf?itemPath(byId.get(id),mode):region?href(mode,region.id,id):href(mode,id))},onUp:(region||query)?()=>navigate(parent):undefined});
 $('#directory h2').textContent=entry?'Connected entries':query?'Matches':region?'All '+group.length+' entries':'Where to begin';
 const list=(!region&&!entry&&!query)?['159tncXDj-lS8zy40YB8WEuJWCkc8ov19duwgv7kOkBg','1793963939.881499','1795189660.321559'].map(id=>byId.get(id)).filter(Boolean):results;
 let end=0;const rows=$('#rows');rows.replaceChildren();observer?.disconnect();
 function append(){const next=list.slice(end,end+16);end+=next.length;
  rows.insertAdjacentHTML('beforeend',next.map(i=>`<a href="${esc(itemPath(i,mode))}"><small>${esc(i.kind)}</small><span><strong>${esc(i.title)}</strong><em>${esc((entry?related.find(x=>x.i===i)?.reason+' · ':'')+i.description)}</em></span><span>↗</span></a>`).join(''));$('#more').hidden=end>=list.length;
 }
 append();if(!list.length)rows.innerHTML='<p class="empty">No matching entries.</p>';
 $('#more').onclick=append;
 observer=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)&&end<list.length)append()});observer.observe($('#more'));
 window.scrollTo(0,0);
}
document.querySelector('form').onsubmit=e=>{e.preventDefault();const value=$('#query').value.trim();if(value)navigate(href(currentMode,'find',value))};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>navigate(href(b.dataset.mode,...parts)));
window.addEventListener('hashchange',event=>{
 const before=new URL(event.oldURL).hash.slice(1).split('/');
 const after=location.hash.slice(1).split('/');
 if(after[1]==='entry' && before[1]==='entry' && history.state==null){
   const fromEntry=before[2]===after[2]?null:decodeURIComponent(before[2]);
   if(fromEntry)history.replaceState({fromEntry},'');
 }
 render();
});render();
