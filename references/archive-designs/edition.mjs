// The ENIAC photograph is a public-domain U.S. Army image, reproduced from
// Wikimedia Commons, File:Glen_Beck_and_Betty_Snyder_program_the_ENIAC_in_building_328_at_the_Ballistic_Research_Laboratory.jpg.
const picks = {
  '2026-11': ['1aBy72YNPTikWAfX2o5ikWAnGOzKI8qLaT_iZJDN3tPE', '1Wy-mFv1J0J56rziT3QBcxoM7EaI00JX21bEwUhBOlbc', 'testing-prompts'],
  '2026-10': ['1OgM0T1_WPyntA5j1cmZ6_abO-WFFNrbtSGNZEwi7eiI'],
};
const monthName = new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
const pageSize = 8;

function issuesOf(items) {
  const issues=new Map();
  for(const item of items) {
    const key=item.date.slice(0,7);
    if(!issues.has(key)) issues.set(key,[]);
    issues.get(key).push(item);
  }
  return issues;
}

export default function edition(items,ui) {
  if (!items.length) return '<p>No issues yet.</p>';
  return `<div class="ed-page"><header class="ed-mast"><div class="ed-dateline"><span>Alejo Acelas</span><span>AI uplift consultant</span></div>
    <h1>The Uplift Review</h1><div class="ed-subline"><label for="ed-issue">Monthly edition</label><select id="ed-issue">
    ${[...issuesOf(items)].map(([key,rows])=>`<option value="${ui.esc(key)}">${monthName.format(new Date(rows[0].date))}</option>`).join('')}</select>
    <button type="button" class="ed-index-link">Issue contents ↓</button></div></header><div class="ed-layout"></div></div>`;
}

export function init(items,ui) {
  if (!items.length) return;
  const root=document.querySelector('.ed-page');
  const selector=root.querySelector('#ed-issue');
  const issues=issuesOf(items);
  let issue, page = 0;
  function renderIndex() {
    const kind=root.querySelector('#ed-type').value;
    const entries=issue.filter(item=>!kind||item.kind===kind);
    root.querySelector('.ed-list').innerHTML = entries.slice(page*pageSize,(page+1)*pageSize).map(item=>`
      <li><span>${ui.date(item)}</span><strong>${ui.entry(item)}</strong><small>${ui.esc(item.kind)}</small></li>`).join('');
    root.querySelector('.ed-total').textContent=entries.length+' '+(entries.length===1?'entry':'entries');
    root.querySelector('.ed-pager').innerHTML = entries.length<=pageSize ? '' :
      `<button data-page="-1" ${page===0?'disabled':''}>← Previous</button><span>Page ${page+1} of ${Math.ceil(entries.length/pageSize)}</span><button data-page="1" ${(page+1)*pageSize>=entries.length?'disabled':''}>Next →</button>`;
  }
  function renderIssue() {
    issue=issues.get(selector.value);
    page=0;
    const selected=(picks[selector.value] || []).map(id=>issue.find(item=>item.id===id)).filter(Boolean);
    const lead=selected[0] || issue[0];
    const feature=selected[1] || issue.find(item=>item!==lead && item.kind!==lead.kind) || issue.find(item=>item!==lead);
    const side=selected[2] || issue.find(item=>item!==lead && item!==feature && item.kind==='Call note') || issue.find(item=>item!==lead && item!==feature);
    root.querySelector('.ed-layout').innerHTML = `<div class="ed-front ${feature?'':'ed-solo'}">
      <article class="ed-lead"><div class="ed-label">Cover story · ${ui.esc(lead.kind)}</div><h2>${ui.entry(lead)}</h2><p>${ui.esc(lead.description)}</p>
      ${lead.id===picks['2026-11'][0] ? `<figure><img src="/edition-eniac.webp" width="800" height="611" alt="Two ENIAC operators at a wall of switches and cables.">
      <figcaption>Programming the ENIAC at the Ballistic Research Laboratory. <span>U.S. Army</span></figcaption></figure>` : ''}</article>
      ${feature ? `<aside class="ed-frontside"><section><h2>${feature.kind==='Template'?'A tool to try':'The feature'}</h2><article class="ed-story"><div class="ed-label">${ui.meta(feature)}</div>
      <h3>${ui.entry(feature)}</h3><p>${ui.esc(feature.description)}</p></article></section>
      ${side ? `<section class="ed-quote"><h2>${side.kind==='Call note'?'From a call':'Also inside'}</h2><p>${ui.esc(side.description)}</p><h3>${ui.entry(side)}</h3></section>` : ''}</aside>` : ''}</div>
      <details class="ed-section ed-index"><summary><span>Issue contents</span><i>${issue.length} ${issue.length===1?'entry':'entries'}</i></summary>
      <div class="ed-index-tools"><label>Show <select id="ed-type"><option value="">All formats</option>${[...new Set(issue.map(i=>i.kind))].sort().map(kind=>`<option>${ui.esc(kind)}</option>`).join('')}</select></label><span class="ed-total"></span></div>
      <ol class="ed-list"></ol><nav class="ed-pager" aria-label="Contents pages"></nav></details>`;
    root.querySelector('#ed-type').onchange=()=>{page=0;renderIndex()};
    renderIndex();
  }
  root.querySelector('.ed-index-link').onclick=()=>{
    const index=root.querySelector('.ed-index');
    index.open=true;
    index.querySelector('summary').focus();
    index.scrollIntoView({block:'start'});
  };
  root.addEventListener('click',e=>{
    const pager=e.target.closest('[data-page]');
    if(pager){ page+=Number(pager.dataset.page);renderIndex();root.querySelector('.ed-pager button:not([disabled])')?.focus(); }
  });
  selector.onchange=renderIssue;
  renderIssue();
}
export const css = `
body:has(.ed-page) { background:#f6f1e5; }
.ed-page { --ink:#231e19; --rust:#943719; --rule:#c7ba9f; color:var(--ink); max-width:1380px; margin:auto; padding:32px clamp(22px,5.5vw,90px) 90px; font:17px/1.5 Georgia,"Times New Roman",serif; background:#f6f1e5; }
.ed-page button.entry { display:inline; font:inherit; line-height:inherit; letter-spacing:inherit; color:inherit; background:none; border:0; text-align:inherit; padding:0; cursor:pointer; }
.ed-page button.entry:hover { color:var(--rust); text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:.1em; }
.ed-page button.entry:focus-visible { outline:2px solid var(--rust); outline-offset:3px; }
.ed-dateline,.ed-subline,.ed-label,.ed-page figcaption,.ed-section-heading span { font:12px/1.4 Arial,sans-serif; }
.ed-dateline,.ed-subline,.ed-section-heading { display:flex; align-items:baseline; justify-content:space-between; gap:14px; }
.ed-dateline { padding:7px 0; border-top:4px solid var(--ink); border-bottom:1px solid var(--ink); text-transform:uppercase; letter-spacing:.12em; font-size:11px; }
.ed-mast h1 { font:600 clamp(48px,9.5vw,148px)/.96 Georgia,"Times New Roman",serif; letter-spacing:-.086em; text-align:center; margin:12px 0 17px; }
.ed-subline { padding:7px 0; border-top:1px solid var(--ink); border-bottom:4px double var(--ink); }
.ed-subline span:first-child { font:italic 16px Georgia,serif; }
.ed-front { display:grid; grid-template-columns:minmax(0,2.15fr) minmax(0,1fr); gap:clamp(18px,3.5vw,56px); padding:28px 0 25px; }
.ed-frontside { border-left:1px solid var(--rule); padding-left:clamp(16px,2.5vw,38px); }
.ed-label { color:var(--rust); text-transform:uppercase; letter-spacing:.12em; font-size:10px; font-weight:700; }
.ed-lead h2 { font:normal clamp(39px,5.6vw,88px)/.95 Georgia,serif; margin:7px 0 12px; letter-spacing:-.065em; }
.ed-lead>p { margin:0 0 16px; max-width:50ch; font:italic clamp(17px,1.65vw,25px)/1.3 Georgia,serif; }
.ed-page figure { margin:0; }
.ed-page figure img { width:100%; display:block; height:clamp(190px,22vw,335px); object-fit:cover; object-position:center 48%; background:#dfd2b8; mix-blend-mode:multiply; }
.ed-page figcaption { display:flex; justify-content:space-between; gap:12px; padding:5px 0; font-size:10px; color:#594f40; }
.ed-page figcaption span { white-space:nowrap; }
.ed-frontside h2 { font:italic normal 23px/1.15 Georgia,serif; margin:0 0 16px; padding-bottom:6px; border-bottom:1px solid var(--ink); }
.ed-frontside section + section { margin-top:26px; }
.ed-story h3 { font:normal clamp(23px,2.1vw,33px)/1.04 Georgia,serif; letter-spacing:-.045em; margin:7px 0; }
.ed-story p { margin:6px 0 0; font-size:16px; line-height:1.42; }
.ed-quote>p { font:italic clamp(21px,2.2vw,34px)/1.16 Georgia,serif; margin:0 0 10px; letter-spacing:-.035em; color:var(--rust); }
.ed-quote h3 { font:600 12px Arial,sans-serif; text-decoration:underline; text-underline-offset:3px; }
.ed-section { border-top:3px double var(--ink); margin:0 0 28px; }
.ed-section-heading { border-bottom:1px solid var(--rule); padding:7px 0; margin-bottom:12px; }
.ed-section-heading h2 { font:italic normal clamp(26px,3.4vw,46px)/1.1 Georgia,serif; letter-spacing:-.045em; margin:0; }
.ed-section-heading span { color:#625444; }
.ed-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); column-gap:24px; row-gap:20px; }
.ed-grid .ed-story { padding:4px 0 4px 17px; border-left:1px solid var(--rule); }
.ed-grid .ed-story:nth-child(3n+1) { padding-left:0; border-left:0; }
@media(max-width:700px) {
 .ed-page { padding:20px 16px 60px; }
 .ed-dateline { font-size:9px; }
 .ed-mast h1 { font-size:clamp(42px,10.1vw,73px); letter-spacing:-.08em; margin:14px 0; }
 .ed-subline { font-size:10px; }
 .ed-subline span:first-child { font-size:13px; }
 .ed-front { display:block; padding:22px 0; }
 .ed-page figure img { height:clamp(180px,53vw,300px); }
 .ed-frontside { border:0; padding:0; margin-top:18px; display:grid; grid-template-columns:1fr 1fr; gap:16px; }
 .ed-frontside h2 { font-size:18px; margin-bottom:8px; }
 .ed-frontside .ed-story h3 { font-size:22px; }
 .ed-frontside section + section { margin:0; }
 .ed-frontside p { font-size:15px; }
 .ed-quote>p { font-size:19px; }
 .ed-grid { grid-template-columns:1fr; gap:0; }
 .ed-grid .ed-story,.ed-grid .ed-story:nth-child(3n+1) { border-left:0; padding:12px 0; border-bottom:1px solid var(--rule); }
 .ed-section-heading { margin-bottom:0; }
}
@media(max-width:365px) { .ed-frontside { display:block; } .ed-frontside section + section { margin-top:16px; } }
.ed-subline { justify-content:flex-start;align-items:center; }
.ed-subline label { font:italic 15px Georgia,serif; }
.ed-subline select,.ed-index-tools select { color:var(--ink); background:transparent; font:600 13px Arial,sans-serif; border:0; border-bottom:1px solid var(--rule); padding:5px 0; }
.ed-subline .ed-index-link { margin-left:auto; background:var(--ink); color:#fbf7e9; border:0; padding:7px 10px; font:12px Arial,sans-serif; }
.ed-index summary { cursor:pointer; padding:12px 0; border-bottom:1px solid var(--ink); }
.ed-index summary span { font:italic normal 32px/1 Georgia,serif; letter-spacing:-.05em; }
.ed-index summary i { float:right; font:12px/2 Arial,sans-serif; }
.ed-index-tools,.ed-pager { display:flex; align-items:center; gap:12px; font:13px Arial,sans-serif; padding:11px 0; }
.ed-index-tools { justify-content:space-between; }
.ed-list { list-style:none; padding:0; margin:0; }
.ed-list li { border-top:1px solid var(--rule); display:grid; grid-template-columns:95px minmax(0,1fr) 70px; gap:10px; align-items:baseline; padding:9px 0; }
.ed-list li :is(span,small) { font:11px Arial,sans-serif; color:#615747; }
.ed-list li small { text-align:right; }
.ed-list strong { font:normal 21px/1.15 Georgia,serif; }
.ed-pager button { background:transparent; border:1px solid var(--rule); color:var(--ink); padding:5px 10px; }
.ed-pager button:disabled { opacity:.5; }
.ed-solo { grid-template-columns:minmax(0,1fr); }
.ed-index-link:hover,.ed-index summary:hover,.ed-pager button:hover { text-decoration:underline; }
@media(max-width:700px) { .ed-subline { gap:6px; flex-wrap:wrap; } .ed-subline label { font-size:13px; } .ed-subline select { font-size:12px; } .ed-list li { grid-template-columns:1fr auto; gap:3px; } .ed-list li strong { grid-column:1/-1; grid-row:2; } .ed-list li small { grid-column:2; grid-row:1; } .ed-index summary span { font-size:25px; } }
`;
