const monthYear = new Intl.DateTimeFormat('en', { month:'long', year:'numeric', timeZone:'UTC' });
const shortMonth = new Intl.DateTimeFormat('en', { month:'short', timeZone:'UTC' });
const weeklyPicks = [
  '1aBy72YNPTikWAfX2o5ikWAnGOzKI8qLaT_iZJDN3tPE',
  '159tncXDj-lS8zy40YB8WEuJWCkc8ov19duwgv7kOkBg',
  '1793963939.881499',
];
const pageSize = 5;

function monthsOf(items) {
  const months = new Map();
  for (const item of items) {
    const key = item.date.slice(0,7);
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(item);
  }
  return months;
}

function calendar(key, group) {
  const first = new Date(key + '-01T00:00:00Z');
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth()+1, 0)).getUTCDate();
  const offset = (first.getUTCDay()+6)%7;
  const weeks = Array.from({length:Math.ceil((offset+last)/7)}, (_,i)=>({
    start:Math.max(1, i*7-offset+1), end:Math.min(last,(i+1)*7-offset), cells:[], items:[]
  }));
  for (let n=1; n<=last; n++) weeks[Math.floor((offset+n-1)/7)].cells.push({day:n,count:0});
  for (const item of group) {
    const day = Number(item.date.slice(8,10));
    const week = weeks[Math.floor((offset+day-1)/7)];
    week.cells[day-week.start].count++;
    week.items.push(item);
  }
  return {weeks, offset};
}
function activity(items) {
  if (!items.length) return '';
  const lastDay = Date.parse(items[0].date.slice(0, 10));
  const days = Array(42).fill(0);
  for (const item of items) {
    const age = Math.round((lastDay - Date.parse(item.date.slice(0, 10))) / 86400000);
    if (age >= 0 && age < days.length) days[days.length - age - 1]++;
  }
  const max = Math.max(...days);
  return `<figure class="stream-pulse"><div aria-hidden="true">${days.map(n =>
    `<i style="--size:${n ? 15 + 80 * n / max : 4}%"></i>`).join('')}</div>
    <figcaption>Posts per day <span>Last six weeks</span></figcaption></figure>`;
}

export default function stream(items, ui) {
  if (!items.length) return '<p>No entries yet.</p>';
  const months = monthsOf(items);
  return `<div class="stream-page"><aside class="stream-rail"><div class="stream-byline"><span class="stream-signal" aria-hidden="true"></span>Alejo Acelas</div>
    <h1>Work<span>stream.</span></h1><p class="stream-intro">An AI uplift consultant’s working week, in drafts, tools and conversations.</p>
    ${activity(items)}</aside><section class="stream-river">
    <div class="stream-controls"><label for="stream-month">Browse by week</label><select id="stream-month">
    ${[...months].map(([key,group])=>`<option value="${ui.esc(key)}">${monthYear.format(new Date(group[0].date))} (${group.length})</option>`).join('')}</select></div>
    <div class="stream-calendar"></div><div class="stream-digest"></div></section></div>`;
}

export function init(items, ui) {
  if (!items.length) return;
  const root = document.querySelector('.stream-page');
  const selector = root.querySelector('select');
  const months = monthsOf(items);
  let weeks, offset, selected, page = 0;
  function changeMonth() {
    ({weeks, offset} = calendar(selector.value, months.get(selector.value)));
    selected = weeks.findLastIndex(w=>w.items.length);
    page = 0;
    const month = monthYear.format(new Date(selector.value+'-01'));
    root.querySelector('.stream-calendar').innerHTML = `<div class="stream-days" aria-hidden="true">${['M','T','W','T','F','S','S'].map(day=>`<span>${day}</span>`).join('')}<span>Entries</span></div>`+
      weeks.map((week,i)=>{
        const label = `${week.start}–${week.end} ${month}, ${week.items.length} entries`;
        return `<button type="button" data-week="${i}" aria-label="${label}" ${week.items.length ? '' : 'disabled'}>
          ${week.cells.map((cell,j)=>`<span class="${cell.count?'active':''}" ${j===0 && i===0 ? `style="grid-column-start:${offset+1}"` : ''}>${cell.day}</span>`).join('')}
          <b>${week.items.length}</b></button>`;
      }).join('');
    renderWeek();
  }
  function renderWeek() {
    for (const button of root.querySelectorAll('[data-week]')) button.setAttribute('aria-pressed', String(Number(button.dataset.week)===selected));
    const {items:entries,start,end} = weeks[selected];
    const lead = weeklyPicks.map(id=>entries.find(i=>i.id===id)).find(Boolean) || entries[0];
    const rest = entries.filter(i=>i!==lead);
    const span = start===end ? start : start+'–'+end;
    const month = shortMonth.format(new Date(selector.value+'-01'));
    root.querySelector('.stream-digest').innerHTML = `<div class="stream-weekline"><strong>${span} ${month}</strong><span>${entries.length} ${entries.length===1?'entry':'entries'}</span></div>
      <article class="stream-lead"><div class="stream-eyebrow">Weekly highlight · ${ui.esc(lead.kind)}</div><h2>${ui.entry(lead)}</h2><p>${ui.esc(lead.description)}</p></article>
      ${rest.length ? `<section class="stream-others"><h3>Also this week</h3>${rest.slice(page*pageSize,(page+1)*pageSize).map(item=>`<article><span>${ui.date(item)} · ${ui.esc(item.kind)}</span><h4>${ui.entry(item)}</h4></article>`).join('')}
      ${rest.length>pageSize ? `<nav class="stream-pager" aria-label="Weekly entries"><button data-page="-1" ${page===0?'disabled':''}>← Previous</button><span>${page+1} / ${Math.ceil(rest.length/pageSize)}</span><button data-page="1" ${(page+1)*pageSize>=rest.length?'disabled':''}>Next →</button></nav>` : ''}</section>` : ''}`;
  }
  selector.onchange=changeMonth;
  root.addEventListener('click', e=>{
    const week=e.target.closest('[data-week]'), pager=e.target.closest('[data-page]');
    if(week) { selected=Number(week.dataset.week); page=0; renderWeek(); }
    if(pager) { page+=Number(pager.dataset.page); renderWeek(); root.querySelector('.stream-pager button:not([disabled])')?.focus(); }
  });
  changeMonth();
}
export const css = `
body:has(.stream-page) { background:#2137a4; }
.stream-page { --signal:#ffed78; --paper:#fffaf1; --muted:#d8dffb; min-height:100vh; color:var(--paper); background:#2137a4; font:16px/1.5 Arial,sans-serif; display:grid; grid-template-columns:minmax(225px,.75fr) minmax(0,1.8fr); gap:clamp(36px,6vw,96px); max-width:1400px; margin:0 auto; padding:clamp(36px,5vw,82px) clamp(24px,6vw,100px) 100px; }
.stream-page * { box-sizing:border-box; }
.stream-rail { align-self:start; position:sticky; top:32px; }
.stream-byline,.stream-kind,.stream-month h2,.stream-nav,.stream-pulse figcaption,.stream-month time small { font-family:ui-monospace,"Courier New",monospace; }
.stream-byline { color:var(--signal); display:flex; align-items:center; gap:12px; font-size:13px; }
.stream-signal { display:inline-block; width:10px; height:10px; background:var(--signal); border-radius:100%; box-shadow:0 0 0 4px #4358bd; }
.stream-page h1 { font:normal clamp(64px,7.8vw,120px)/.85 Arial,sans-serif; letter-spacing:-.085em; margin:48px 0 24px; color:var(--paper); }
.stream-page h1 span { display:block; color:var(--signal); }
.stream-intro { max-width:24ch; color:var(--muted); margin:0; font-size:16px; }
.stream-pulse { margin:32px 0 19px; max-width:260px; }
.stream-pulse>div { height:47px; display:flex; align-items:end; gap:2px; }
.stream-pulse i { display:block; flex:1; height:var(--size); background:var(--signal); min-width:1px; }
.stream-pulse figcaption { border-top:1px solid #8b9be3; padding:6px 0; color:var(--muted); font-size:10px; display:flex; justify-content:space-between; }
.stream-page :is(a,button):hover { color:var(--signal); text-decoration:underline; text-underline-offset:.16em; }
.stream-page :is(a,button):focus-visible { outline:2px solid var(--signal); outline-offset:4px; }
.stream-controls,.stream-weekline,.stream-pager { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.stream-controls label,.stream-weekline,.stream-eyebrow,.stream-others h3,.stream-others article span,.stream-calendar,.stream-pager { font:12px/1.5 ui-monospace,monospace; }
.stream-controls label,.stream-eyebrow,.stream-others h3 { text-transform:uppercase; letter-spacing:.09em; }
.stream-controls select { max-width:65%; background:#182c90; color:var(--paper); font:14px Arial,sans-serif; border:1px solid #8999e2; border-radius:4px; padding:6px; }
.stream-calendar { margin:13px 0 24px; font-variant-numeric:tabular-nums; }
.stream-calendar button,.stream-days { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)) 55px; align-items:center; width:100%; text-align:center; }
.stream-calendar button { background:none; color:var(--muted); border:1px solid transparent; border-bottom-color:#6275c4; margin:0; padding:2px 0; height:28px; font:inherit; }
.stream-calendar button[aria-pressed=true] { background:var(--signal); border-radius:3px; color:#182b77; }
.stream-calendar button[aria-pressed=false]:not(:disabled):hover { background:#3e54b8; color:white; }
.stream-calendar button:disabled { opacity:.52; cursor:default; }
.stream-days { color:var(--muted); font-size:10px; padding:3px 0; }
.stream-calendar .active { font-weight:700; text-decoration:underline; text-underline-offset:2px; }
.stream-calendar b { grid-column:8; border-left:1px solid currentColor; }
.stream-weekline { color:var(--signal); margin-bottom:10px; }
.stream-weekline strong { font:500 22px Arial,sans-serif; letter-spacing:-.045em; }
.stream-lead { color:#182b77; background:var(--signal); border-radius:2px; padding:clamp(20px,3vw,40px); }
.stream-lead h2 { font:500 clamp(30px,4.2vw,64px)/.99 Arial,sans-serif; letter-spacing:-.065em; margin:14px 0 12px; overflow-wrap:anywhere; }
.stream-lead p { max-width:48ch; margin:0; font:clamp(15px,1.4vw,21px)/1.4 Arial,sans-serif; }
.stream-lead button.entry:hover { color:#182b77; }
.stream-lead button:focus-visible { outline-color:#182b77; }
.stream-others h3 { margin:24px 0 8px; color:var(--muted); }
.stream-others article { display:grid; grid-template-columns:minmax(100px,.55fr) minmax(0,1.5fr); align-items:baseline; gap:14px; border-top:1px solid #6176c8; padding:12px 0; }
.stream-others article span { color:var(--muted); font-size:11px; }
.stream-others h4 { font:normal clamp(18px,1.8vw,27px)/1.15 Arial,sans-serif; letter-spacing:-.035em; margin:0; }
.stream-pager button { background:transparent; border:1px solid #8999e2; padding:5px 8px; color:var(--paper); }
.stream-pager button:disabled { opacity:.5; }
@media(max-width:760px) { .stream-page { display:block; padding:24px 18px 60px; } .stream-rail { position:static; } .stream-page h1 { margin:23px 0 12px; font-size:clamp(51px,13vw,80px); } .stream-page h1 span { display:inline; } .stream-intro { max-width:40ch; } .stream-pulse { margin:12px 0; } .stream-pulse>div { height:20px; } .stream-river { margin-top:22px; } .stream-others article { grid-template-columns:1fr; gap:4px; } }
`;
