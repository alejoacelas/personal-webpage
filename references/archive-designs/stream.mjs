const monthName = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' });
const monthYear = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const weekday = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' });

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
  const months = new Map();
  for (const item of items) {
    const key = item.date.slice(0, 7);
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(item);
  }
  const monthsHtml = [...months].map(([key, group]) => {
    const date = new Date(group[0].date);
    return `<section id="stream-${key}" class="stream-month"><h2>${monthYear.format(date)}</h2>
    <ol>${group.map((item, index) => {
      const day = new Date(item.date);
      const highlighted = item === items[0] || item.kind === 'Template' && !group.slice(0, index).some(other => other.kind === 'Template');
      return `<li class="${highlighted ? 'stream-highlight' : ''}">
        <time datetime="${ui.esc(item.date)}"><b>${String(day.getUTCDate()).padStart(2,'0')}</b><small>${weekday.format(day)}</small></time>
        <div class="stream-item"><div class="stream-kind">${ui.esc(item.kind)}</div>
        <h3>${ui.entry(item)}</h3><p>${ui.esc(item.description)}</p></div></li>`;
    }).join('')}</ol></section>`;
  }).join('');
  return `<div class="stream-page">
    <aside class="stream-rail"><div class="stream-byline"><span class="stream-signal" aria-hidden="true"></span>Alejo Acelas</div>
      <h1>Work<span>stream.</span></h1>
      <p class="stream-intro">I’m an AI uplift consultant. Here’s what I’ve been working on, as it happens.</p>
      ${activity(items)}
      <nav class="stream-nav" aria-label="Jump to month">${[...months].map(([key,group]) =>
        `<a href="#stream-${key}"><span>${monthName.format(new Date(group[0].date))} ${key.slice(0,4)}</span><small>${group.length}</small></a>`).join('')}</nav>
    </aside><div class="stream-river">${monthsHtml}</div></div>`;
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
.stream-nav { display:grid; max-width:260px; }
.stream-nav a { display:flex; align-items:center; justify-content:space-between; padding:8px 0; text-decoration:none; color:var(--paper); font-size:13px; border-bottom:1px solid #687bce; }
.stream-nav small { color:var(--signal); }
.stream-page :is(a,button):hover { color:var(--signal); text-decoration:underline; text-underline-offset:.16em; }
.stream-page :is(a,button):focus-visible { outline:2px solid var(--signal); outline-offset:4px; }
.stream-month { scroll-margin-top:72px; }
.stream-month h2 { margin:0; padding:0 0 12px; border-bottom:1px solid #8999e2; color:var(--signal); font-weight:500; text-transform:uppercase; letter-spacing:.11em; font-size:12px; }
.stream-month + .stream-month { margin-top:38px; }
.stream-month ol { margin:0; padding:0; list-style:none; }
.stream-month li { position:relative; display:grid; grid-template-columns:56px minmax(0,1fr); gap:23px; }
.stream-month time { padding-top:27px; color:var(--muted); display:flex; align-items:flex-start; flex-direction:column; }
.stream-month time b { font-size:26px; font-weight:400; line-height:1.05; letter-spacing:-.06em; font-variant-numeric:tabular-nums; }
.stream-month time small { text-transform:uppercase; font-size:10px; margin-top:3px; }
.stream-item { border-left:1px solid #8999e2; padding:26px 0 26px 27px; position:relative; border-bottom:1px solid #4459b7; }
.stream-item:before { content:""; position:absolute; width:7px; height:7px; background:#adc0ff; border-radius:100%; top:32px; left:-4px; }
.stream-kind { color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.1em; }
.stream-page h3 { font:500 clamp(21px,2.3vw,33px)/1.1 Arial,sans-serif; letter-spacing:-.045em; margin:6px 0; overflow-wrap:anywhere; }
.stream-page h3 :is(button,a) { display:inline; padding:0; margin:0; color:inherit; background:none; border:0; cursor:pointer; text-align:left; font:inherit; letter-spacing:inherit; }
.stream-item p { margin:8px 0 0; color:var(--muted); max-width:54ch; line-height:1.5; font-size:15px; }
.stream-highlight .stream-item:before { width:11px; height:11px; left:-6px; background:var(--signal); box-shadow:0 0 0 4px #5265c8; }
.stream-highlight h3 { color:var(--signal); font-size:clamp(29px,3.4vw,48px); }
@media(max-width:760px) { .stream-page { display:block; padding:30px 20px 70px; } .stream-rail { position:static; } .stream-page h1 { margin:28px 0 14px; font-size:clamp(52px,13vw,87px); } .stream-page h1 span { display:inline; } .stream-intro { max-width:38ch; } .stream-nav { display:flex; flex-wrap:wrap; gap:15px; max-width:none; } .stream-nav a { gap:8px; } .stream-pulse { margin:17px 0 7px; } .stream-pulse>div { height:27px; } .stream-river { margin-top:30px; } .stream-month li { grid-template-columns:36px minmax(0,1fr); gap:12px; } .stream-item { padding:22px 0 22px 18px; } }
`;
