const featuredIds = ['159tncXDj-lS8zy40YB8WEuJWCkc8ov19duwgv7kOkBg','1xuLpOdGa2b470lAIqMPMwg36wm1INq0PQy0TIhRABDk'];
const pageSize = 6;
const monthFormat = new Intl.DateTimeFormat('en-GB', {year:'numeric',month:'long',timeZone:'UTC'});

export default function cabinet(items, ui) {
  const featured = featuredIds.map(id => items.find(item => item.id === id)).filter(Boolean);
  const kinds = [...new Set(items.map(item => item.kind))].sort();
  const months = [...new Set(items.map(item => item.date.slice(0,7)))].sort().reverse();
  return `<div class="cabinet">
    <header class="cab-head"><div class="cab-wordmark"><span class="cab-mark" aria-hidden="true">a</span> Alejo Acelas</div><span>AI uplift consultant</span></header>
    <div class="cab-interior"><div class="cab-cover"><h1>Card <i>catalogue.</i></h1>
      <p>My working drafts, reusable prompts and notes on helping people use AI at work.</p></div>
    <div class="cab-workspace">
    ${featured.length ? `<aside class="cab-feature"><h2>Try these tools</h2>${featured.map(i => `<article class="cab-tool"><div class="cab-dateline">Reusable prompt</div><h3>${ui.entry(i)}</h3><p>${ui.esc(i.description)}</p></article>`).join('')}</aside>` : ''}
    <section class="cab-finder"><h2 class="cab-tab">Find an item</h2><div class="cab-stack">
      <div class="cab-controls">
        <label class="cab-search">Search the catalogue<input type="search" placeholder="Title, subject or phrase" autocomplete="off"></label>
        <label>Type<select id="cab-kind"><option value="">All types</option>${kinds.map(v => `<option>${ui.esc(v)}</option>`).join('')}</select></label>
        <label>Month<select id="cab-month"><option value="">All months</option>${months.map(v => `<option value="${ui.esc(v)}">${monthFormat.format(new Date(v+'-01'))}</option>`).join('')}</select></label>
      </div>
      <div class="cab-status"><span aria-live="polite"></span><button type="button" class="cab-reset">Clear filters</button></div>
      <div class="cab-results"></div>
      <nav class="cab-pager" aria-label="Result pages"><button type="button" data-step="-1">← Previous</button><button type="button" data-step="1">Next →</button></nav>
    </div></section></div></div></div>`;
}

export function init(items, ui) {
  const panel = document.querySelector('.cab-finder');
  const search = panel.querySelector('input');
  const kind = panel.querySelector('#cab-kind');
  const month = panel.querySelector('#cab-month');
  const reset = panel.querySelector('.cab-reset');
  const pager = panel.querySelector('.cab-pager');
  const previous = pager.querySelector('[data-step="-1"]');
  const next = pager.querySelector('[data-step="1"]');
  let page = 0;
  function update() {
    const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = items.filter(i => {
      const text = [i.title,i.topic,i.body,i.description].join(' ').toLowerCase();
      return (!kind.value || kind.value === i.kind) && (!month.value || i.date.startsWith(month.value)) && words.every(w => text.includes(w));
    });
    const start = page * pageSize;
    const slice = matches.slice(start, start+pageSize);
    panel.querySelector('.cab-status span').textContent = matches.length ? `${start+1}–${start+slice.length} of ${matches.length} items` : 'No matching items';
    reset.hidden = !search.value && !kind.value && !month.value;
    panel.querySelector('.cab-results').innerHTML = slice.map(i => `<article class="cab-result"><div class="cab-dateline">${ui.meta(i)}</div><h3>${ui.entry(i)}</h3></article>`).join('');
    pager.hidden = matches.length <= pageSize;
    previous.disabled = page === 0;
    next.disabled = start+pageSize >= matches.length;
  }
  function filter() { page=0; update(); }
  search.addEventListener('input',filter);
  kind.addEventListener('change',filter);
  month.addEventListener('change',filter);
  reset.onclick = () => { search.value=''; kind.value=''; month.value=''; filter(); search.focus(); };
  pager.onclick = event => {
    const button=event.target.closest('[data-step]');
    if (!button || button.disabled) return;
    page += Number(button.dataset.step); update();
    const first=panel.querySelector('.cab-result button');
    first?.focus();
  };
  update();
}
export const css = `
.cabinet { --ink:#272a20; --wood:#484e36; --paper:#fffaf0; color:var(--ink); background:#eae5d6; min-height:100vh; font-family:Georgia,serif; }
.cabinet * { box-sizing:border-box; }
.cab-head { color:#fcf9ed; background:var(--wood); min-height:61px; display:flex; align-items:center; justify-content:space-between; gap:20px; padding:12px max(5vw,calc((100vw - 1180px)/2)); border-bottom:4px double #acb093; font:13px/1.4 ui-monospace,monospace; }
.cab-wordmark { display:flex; align-items:center; gap:11px; font:600 20px/1 Georgia,serif; }
.cab-mark { display:grid; place-items:center; border:1px solid #f5efce; border-radius:50%; height:32px; width:32px; font:italic 29px/.8 Georgia,serif; padding-bottom:5px; }
.cab-interior { max-width:1280px; margin:auto; padding:44px clamp(18px,5vw,66px) 90px; }
.cab-cover { display:flex; align-items:flex-end; justify-content:space-between; gap:35px; padding:0 0 26px; }
.cab-cover h1 { font:normal clamp(60px,8.6vw,124px)/.93 Georgia,serif; letter-spacing:-.075em; margin:0; }
.cab-cover h1 i { font-weight:normal; }
.cab-cover p { font:16px/1.42 Georgia,serif; max-width:24ch; margin:0 0 4px; }
 .cab-workspace { border-top:1px solid #a39f8c; padding-top:30px; display:flex; gap:clamp(24px,5vw,80px); align-items:flex-start; }
.cab-feature { flex:0 0 30%; }
.cab-feature h2 { font:italic 30px/1.05 Georgia,serif; margin:0 0 15px; letter-spacing:-.04em; }
.cab-tool { background:var(--paper); padding:18px 18px 20px; border:1px solid #c7c1ae; border-top:4px solid #a7ac8e; box-shadow:2px 3px #d6d0be; margin:0 0 13px; }
.cab-tool h3 { font:normal 26px/1.08 Georgia,serif; letter-spacing:-.04em; margin:13px 0 6px; }
.cab-tool p { font:15px/1.45 Georgia,serif; color:#5e5c4f; margin:8px 0 0; }
.cab-finder { flex:1; min-width:0; }
.cab-tab { width:fit-content; padding:7px 22px 6px 14px; margin:0 0 -1px; border:1px solid #99937b; border-bottom:none; border-radius:7px 10px 0 0; background:#d9ddbc; font:600 15px ui-monospace,monospace; position:relative; }
.cab-stack { background:#d9ddbc; padding:14px; border:1px solid #99937b; border-radius:0 8px 8px 8px; box-shadow:0 3px 0 -1px #aba78e; }
.cab-controls { display:grid; grid-template-columns:minmax(0,1.8fr) minmax(80px,1fr) minmax(95px,1fr); gap:8px; }
.cab-controls label { display:grid; gap:5px; font:11px/1.2 ui-monospace,monospace; color:#464c39; }
.cab-controls :is(input,select) { width:100%; min-width:0; background:#fffcf3; color:#23261d; border:1px solid #939880; border-radius:3px; padding:8px; font:14px/1.2 system-ui,sans-serif; min-height:36px; }
.cab-status,.cab-pager { display:flex; justify-content:space-between; align-items:center; gap:8px; font:12px/1.4 ui-monospace,monospace; }
.cab-status { min-height:43px; }
.cab-pager { margin-top:12px; }
.cab-status button,.cab-pager button { background:transparent; color:inherit; border:1px solid #92977f; border-radius:3px; padding:4px 7px; font:inherit; }
.cabinet [hidden] { display:none; }
.cabinet button:disabled { opacity:.4; cursor:default; }
.cabinet button:not(:disabled):hover { text-decoration:underline; }
.cab-result { background:var(--paper); padding:11px 15px 12px 27px; position:relative; border:1px solid #b6b29b; box-shadow:0 1px 1px #b6b6a1; }
.cab-result + .cab-result { margin-top:4px; }
.cab-result:before { content:""; width:6px; height:6px; background:#c9cdac; box-shadow:inset 0 1px 1px #817c69; border-radius:50%; position:absolute; left:9px; top:14px; }
.cab-result h3 { margin:6px 0 0; font:400 19px/1.2 Georgia,serif; letter-spacing:-.025em; }
.cab-dateline { padding-bottom:4px; border-bottom:1px solid #d7c9b1; font:10px/1.25 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.07em; color:#5e6153; }
@media(max-width:720px) {
 .cab-head { padding-inline:18px; }
 .cab-cover { display:block; } .cab-cover h1 { font-size:clamp(49px,12.9vw,85px); }
 .cab-cover p { max-width:40ch; margin:10px 0 0; }
 .cab-interior { padding-top:26px; }
 .cab-workspace { flex-direction:column; gap:24px; }
 .cab-feature,.cab-finder { width:100%; } .cab-finder { order:-1; }
 .cab-controls { grid-template-columns:1fr 1fr; } .cab-search { grid-column:1/-1; }
}
`;
