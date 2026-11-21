const docs = await fetch('/documents.json').then(r => r.json());
const feed = await fetch('/feed.json').then(r => r.json());
const postInfo = {
  '1795189660.321559': ['Checking a research paper with AI', 'Tools for research', 'An open-source toolkit for checking papers, fetching PDFs and reading linked datasets.'],
  '1794907853.133389': ['What makes switching between agents hard?', 'Working with agents', 'Switching between agent sessions feels different from checking an inbox. I’m trying to understand why.'],
  '1794902411.285989': ['What can’t your AI reach?', 'Using AI at work', 'A question for finding useful integrations, from a second inbox to specialised software.'],
  '1794830400.390989': ['What makes a Slack channel worth joining?', 'Thinking about AI', 'A question for people in the AI uplift community about where they like to talk.'],
  '1793963939.881499': ['Ask the model to restate your intent', 'Working with agents', 'A prompt I use when the model follows my instructions but misses what I’m trying to do.'],
  '1793704230.839999': ['What stops you getting more out of AI?', 'Using AI at work', 'Is the bottleneck ideas, know-how, motivation, or something else?']
};
const docTopics = {
  '1aBy72YNPTikWAfX2o5ikWAnGOzKI8qLaT_iZJDN3tPE':'Thinking about AI',
  '1Wy-mFv1J0J56rziT3QBcxoM7EaI00JX21bEwUhBOlbc':'Working with agents',
  '159tncXDj-lS8zy40YB8WEuJWCkc8ov19duwgv7kOkBg':'Using AI at work',
  '1xuLpOdGa2b470lAIqMPMwg36wm1INq0PQy0TIhRABDk':'Using AI at work',
  '1OgM0T1_WPyntA5j1cmZ6_abO-WFFNrbtSGNZEwi7eiI':'Tools for research'
};
const callBody = 'I try prompts on my own transcripts first. I want to see what comes back and how often the AI stops to ask me a question.';
export const items = [
  ...docs.map(d => {
    const id = new URL(d.url).pathname.split('/')[3];
    return {...d, id, topic:docTopics[id] || 'Using AI at work', body:d.description, links:[]};
  }),
  ...feed.posts.map(p => {
    const [title,topic,description] = postInfo[p.ts] || [p.text.split(/[.!?]\s/)[0], 'Using AI at work', p.text.split('\n')[0]];
    return {id:p.ts, title, topic, description, body:p.text, links:p.links, url:'', kind:'Slack', date:new Date(Number(p.ts)*1000).toISOString().slice(0,10)};
  }),
  {id:'testing-prompts', title:'How I test a prompt', kind:'Call note', date:'2026-11-20', topic:'Working with agents', description:callBody, body:callBody, url:'', links:[]}
].sort((a,b)=>b.date.localeCompare(a.date));
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = i => new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(i.date));
function anchor(url,label) {
  if(new URL(url).protocol!=='https:') throw Error('Unsupported source URL');
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
}
function read(i) {
  let rest=i.body, html='';
  for(const {url,label} of i.links){
    const at=rest.indexOf(label);
    if(at<0) continue;
    html+=esc(rest.slice(0,at))+anchor(url,label);
    rest=rest.slice(at+label.length);
  }
  return '<div class="source-prose">'+(html+esc(rest)).split(/\n\s*\n/).map(p=>'<p>'+p.replaceAll('\n','<br>')+'</p>').join('')+'</div>'+(i.url?'<p class="source-link">'+anchor(i.url,'Open Google Doc')+'</p>':'');
}
export const ui = {esc,date,read,meta:i=>esc(i.kind)+' · '+date(i),entry:(i,label=i.title)=>`<button type="button" class="entry" data-read="${esc(i.id)}">${esc(label)}</button>`};
