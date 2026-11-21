const drawers = [
  ['Draft', 'Drafts', 'drafts'],
  ['Template', 'Templates', 'templates'],
  ['Slack', 'Slack posts', 'posts'],
  ['Call note', 'Call notes', 'calls']
];

export default function cabinet(items, ui) {
  const sections = drawers.map(([kind, name, slug]) => ({
    kind, name, slug, files: items.filter(item => item.kind === kind)
  })).filter(group => group.files.length);

  function folder({ name, slug, files }) {
    return `<section class="cab-folder cab-${slug}" id="cab-${slug}">
      <h2 class="cab-tab">${name}</h2>
      <div class="cab-stack">${files.map((item, index) => `<article class="cab-card">
        <div class="cab-dateline"><span>${ui.esc(item.kind)}</span><time>${ui.date(item)}</time></div>
        <h3>${ui.entry(item)}</h3>
        ${(index === 0 && item.description) ? `<p>${ui.esc(item.description)}</p>` : ''}
      </article>`).join('')}</div></section>`;
  }
  return `<div class="cabinet">
    <header class="cab-head"><div class="cab-wordmark"><span class="cab-mark" aria-hidden="true">a</span> Alejo Acelas</div><span>AI uplift consultant</span></header>
    <div class="cab-interior"><div class="cab-cover"><h1>Card <i>catalogue.</i></h1>
      <p>My working drafts, reusable prompts and notes on helping people use AI at work.</p></div>
    <nav class="cab-index" aria-label="Jump to a drawer">${sections.map(s => `<a href="#cab-${s.slug}">${s.name} <small>${s.files.length}</small></a>`).join('')}</nav>
    <div class="cab-shelves">${sections.map(folder).join('')}</div></div>
  </div>`;
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
.cab-index { border-block:1px solid #a39f8c; display:flex; flex-wrap:wrap; gap:8px 32px; padding:11px 1px; font:13px/1.4 ui-monospace,monospace; }
.cab-index a { text-decoration:none; color:inherit; }
.cab-index a:hover { text-decoration:underline; }
.cab-index small { color:#615d4a; font-size:11px; vertical-align:super; }
.cab-shelves { padding:33px 0 0; display:grid; grid-template-columns:1fr 1fr; align-items:start; gap:37px 32px; }
.cab-folder { --stock:#c9cdac; --tab:#d9ddbc; scroll-margin:76px; min-width:0; padding:0 0 9px; background:transparent; }
.cab-templates { --stock:#d8bc94; --tab:#e9cfa8; }
.cab-posts { --stock:#b6c3bd; --tab:#c5d3ce; }
.cab-calls { --stock:#d0b4ab; --tab:#e1c6bd; }
.cab-tab { width:fit-content; min-width:129px; padding:8px 26px 7px 15px; margin:0 0 -1px 0; background:var(--tab); border:1px solid #99937b; border-bottom:none; border-radius:8px 13px 0 0; position:relative; z-index:1; transform:skewX(-5deg); transform-origin:left bottom; font:700 15px/1.25 ui-monospace,monospace; }
.cab-stack { background:linear-gradient(170deg,var(--tab),var(--stock)); border:1px solid #99937b; border-radius:0 8px 8px 8px; padding:11px 12px 15px; box-shadow:0 2px 0 -1px #a8a389,0 5px 0 -3px #b7b094,0 9px 15px -12px #544b32; }
.cab-card { position:relative; padding:13px 16px 15px 28px; background:var(--paper); border:1px solid #beb8a4; border-radius:2px; box-shadow:0 2px 1px -1px #918a71; }
.cab-card + .cab-card { margin-top:5px; }
.cab-card::before { content:""; position:absolute; left:9px; top:18px; width:6px; height:6px; border-radius:50%; background:var(--stock); box-shadow:inset 0 1px 1px #817c69; }
.cab-dateline { display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #cab6a3; padding:0 0 4px; color:#665f51; font:10px/1.4 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.09em; }
.cab-card h3 { margin:9px 0 0; font:normal clamp(18px,2.0vw,27px)/1.13 Georgia,serif; letter-spacing:-.03em; }
.cab-card h3 :is(button,a) { appearance:none; background:none; border:0; padding:0; font:inherit; color:inherit; text-align:left; text-decoration:none; cursor:pointer; letter-spacing:inherit; }
.cab-card h3 :is(button,a)::after { content:""; position:absolute; inset:0; }
.cab-card:focus-within,.cab-card:hover { outline:1px solid #746f56; background:#fffdf7; }
.cab-card h3 :is(button,a):hover { text-decoration:underline; text-underline-offset:3px; }
.cab-card p { margin:8px 0 0; color:#595548; font:14px/1.45 Georgia,serif; }
@media(max-width:700px) {
 .cab-head { padding-inline:18px; }
 .cab-cover { display:block; }
 .cab-cover h1 { font-size:clamp(49px,12.9vw,85px); }
 .cab-cover p { margin:15px 0 0; max-width:40ch; }
 .cab-interior { padding-top:28px; }
 .cab-index { gap:9px 17px; font-size:12px; }
 .cab-shelves { grid-template-columns:1fr; gap:18px; padding-top:24px; }
}
`;
