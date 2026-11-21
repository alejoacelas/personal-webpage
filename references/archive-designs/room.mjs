export default function readingRoom(items, ui) {
  const glyphs = {Draft: '¶', Template: '▦', Slack: '#', 'Call note': '“'};
  const rows = items.map((item, index) => `
    <button type="button" class="room-row" data-room-row="${index}" aria-controls="room-text-${index}"${index === 0 ? ' aria-current="true"' : ''}>
      <span class="room-glyph" aria-hidden="true">${glyphs[item.kind] || '·'}</span>
      <span class="room-row-text"><span class="room-row-caption">${ui.esc(item.kind)}<span class="room-dot">/</span>${ui.esc(ui.date(item))}</span><span class="room-row-title">${ui.esc(item.title)}</span></span>
    </button>`).join('');
  const articles = items.map((item, index) => `
    <article class="room-text" id="room-text-${index}" aria-labelledby="room-title-${index}"${index === 0 ? '' : ' hidden'}>
      <div class="room-folio"><span>${ui.esc(item.kind)}</span><span>${ui.esc(ui.date(item))}</span></div>
      <h1 id="room-title-${index}">${ui.esc(item.title)}</h1>
      <div class="room-copy">${ui.read(item)}</div>
    </article>`).join('');
  return `<main class="reading-room">
    <header class="room-mast"><div class="room-identity"><i class="room-book" aria-hidden="true"></i><strong>Alejo Acelas</strong></div><span>Independent AI uplift consultant</span></header>
    <div class="room-frame">
      <aside class="room-index" aria-label="Reading room contents">
        <div class="room-index-heading"><h2>Contents</h2><span>${items.length} entries</span></div>
        <div class="room-rows">${rows}</div>
      </aside>
      <section class="room-pane" aria-label="Selected reading">
        <header class="room-deskbar">
          <span class="room-roomname">Reading room</span><button type="button" class="room-contents" aria-expanded="false">☰ &nbsp; Contents</button>
          <div class="room-paging">
            <span class="room-position" aria-live="polite">1 / ${items.length}</span>
            <button type="button" data-room-step="-1" aria-label="Previous entry" disabled>←</button>
            <button type="button" data-room-step="1" aria-label="Next entry"${items.length <= 1 ? ' disabled' : ''}>→</button>
          </div>
        </header>
        <div class="room-page">${articles}</div>
      </section>
    </div>
  </main>`;
}

export function init() {
  const root = document.querySelector('.reading-room');
  const rows = [...root.querySelectorAll('[data-room-row]')];
  const articles = [...root.querySelectorAll('.room-text')];
  const steps = [...root.querySelectorAll('[data-room-step]')];
  const contents = root.querySelector('.room-contents');
  const pane = root.querySelector('.room-page');
  let selected = 0;

  function showContents(open) {
    root.classList.toggle('room-list-open', open);
    contents.setAttribute('aria-expanded', String(open));
    if (open) rows[selected]?.focus({ preventScroll: true });
  }
  function select(index, focusIndex = false) {
    if (!rows[index]) return;
    rows[selected].removeAttribute('aria-current');
    articles[selected].hidden = true;
    selected = index;
    rows[index].setAttribute('aria-current', 'true');
    articles[index].hidden = false;
    root.querySelector('.room-position').textContent = `${index + 1} / ${rows.length}`;
    for (const step of steps) step.disabled = !rows[index + Number(step.dataset.roomStep)];
    pane.scrollTop = 0;
    const viewingList = root.classList.contains('room-list-open');
    if (!focusIndex) showContents(false);
    if (viewingList && !focusIndex) contents.focus({ preventScroll: true });
    if (focusIndex) rows[index].focus();
    if (!matchMedia('(max-width: 720px)').matches) {
      const list = root.querySelector('.room-rows');
      const row = rows[index].getBoundingClientRect();
      const bounds = list.getBoundingClientRect();
      if (row.bottom > bounds.bottom) list.scrollTop += row.bottom - bounds.bottom;
      if (row.top < bounds.top) list.scrollTop -= bounds.top - row.top;
    }
  }
  rows.forEach((row, index) => row.addEventListener('click', () => select(index)));
  steps.forEach(step => step.addEventListener('click', () => select(selected + Number(step.dataset.roomStep))));
  contents.addEventListener('click', () => showContents(!root.classList.contains('room-list-open')));
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && root.classList.contains('room-list-open')) {
      showContents(false);
      contents.focus();
    }
    if (!event.target.closest('[data-room-row]')) return;
    const offsets = {ArrowUp: -1, ArrowDown: 1};
    if (Object.hasOwn(offsets, event.key)) {
      event.preventDefault();
      select(selected + offsets[event.key], true);
    }
  });
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
`;
