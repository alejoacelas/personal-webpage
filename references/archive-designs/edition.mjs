// Public-domain U.S. Army photograph. Source: Wikimedia Commons,
// File:Glen_Beck_and_Betty_Snyder_program_the_ENIAC_in_building_328_at_the_Ballistic_Research_Laboratory.jpg
const sections = [
  ['Template', 'The tool shelf'],
  ['Slack', 'Community dispatches'],
  ['Draft', 'Working papers'],
  ['Call note', 'In conversation'],
];

function story(item, ui, summary = true) {
  return `<article class="ed-story"><div class="ed-label">${ui.meta(item)}</div>
    <h3>${ui.entry(item)}</h3>${summary ? `<p>${ui.esc(item.description)}</p>` : ''}</article>`;
}

export default function edition(items, ui) {
  const lead = items.find(i => i.kind === 'Draft') || items[0];
  const dispatch = items.find(i => i.kind === 'Slack' && i !== lead);
  const note = items.find(i => i.kind === 'Call note' && i !== lead);
  const inside = items.filter(i => ![lead, dispatch, note].includes(i));
  const date = lead && new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }).format(new Date(items[0].date));
  return `<div class="ed-page">
    <header class="ed-mast"><div class="ed-dateline"><span>Alejo Acelas</span><span>${date || ''}</span></div>
    <h1>The Uplift Review</h1>
    <div class="ed-subline"><span>Notes from an AI uplift consultant</span><span>${items.length} contributions</span></div></header>
    ${lead ? `<div class="ed-front">
      <article class="ed-lead"><div class="ed-label">Lead ${ui.esc(lead.kind.toLowerCase())}</div>
        <h2>${ui.entry(lead)}</h2><p>${ui.esc(lead.description)}</p>
        <figure><img src="/edition-eniac.webp" width="800" height="611" alt="Two ENIAC operators at a wall of switches and cables.">
        <figcaption>Programming the ENIAC at the Ballistic Research Laboratory. <span>U.S. Army</span></figcaption></figure>
      </article><aside class="ed-frontside">
      ${dispatch ? `<section><h2>From Slack</h2>${story(dispatch, ui)}</section>` : ''}
      ${note ? `<section class="ed-quote"><h2>From a call</h2><p>${ui.esc(note.body)}</p><h3>${ui.entry(note)}</h3></section>` : ''}
      </aside></div>` : ''}
    ${sections.map(([kind, heading]) => {
      const rows = inside.filter(i => i.kind === kind);
      if (!rows.length) return '';
      return `<section class="ed-section"><div class="ed-section-heading"><h2>${heading}</h2><span>${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}</span></div>
        <div class="ed-grid">${rows.map(i=>story(i,ui)).join('')}</div></section>`;
    }).join('')}
  </div>`;
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
`;
