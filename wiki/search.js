// Ranked word search over the works, shared by the page (as window.Search) and by the text search
// endpoint that agents can call (as a Node module). Every work is scored by how well the words match
// its title, the questions it answers, its topics and its text; rarer words count for more.
(function (root) {
  const STOP = new Set('a an and are as at be been by can do does did for from has have he him his how i if in is it its me my of on or our should so some that the their them there they this to was we were what when where which who why will with would you your about alejo acelas'.split(' '));
  const stem = t => t.length > 3 ? t.replace(/(ies|ing|ers|ed|es|er|s)$/, '').replace(/e$/, '') : t;
  const terms = text => (String(text).toLowerCase().match(/[a-z0-9]+/g) || []).filter(t => !STOP.has(t)).map(stem);

  // works: the works to search; topics: the topics to search; topicLabel: id → name, for a work's own topics.
  function build(works, topics, topicLabel) {
    const docs = [], seen = new Map();
    const add = (kind, item, fields) => {
      const tf = new Map();
      for (const [text, weight] of fields) for (const t of terms(text)) tf.set(t, Math.min(6, (tf.get(t) || 0) + weight));
      for (const t of tf.keys()) seen.set(t, (seen.get(t) || 0) + 1);
      docs.push({ kind, item, tf });
    };
    for (const w of works) add('work', w, [[w.title, 3], [(w.asks || []).join(' '), 2.5], [(w.words || []).join(' '), 2.5], [(w.mentions || []).join(' '), 2], [w.patterns.map(p => topicLabel(p[0]) || '').join(' '), 1.5], [w.gloss, 1.5], [w.pull, 1], [w.search, .5]]);
    for (const p of topics) add('topic', p, [[p.label, 3], [p.summary, 1.2]]);
    const idf = new Map([...seen].map(([t, n]) => [t, Math.log(1 + docs.length / n)])), vocab = [...seen.keys()];

    return function search(text) {
      const q = terms(text); if (!q.length) return { works: [], topics: [] };
      // While someone is still typing, the last word also matches words that start with it.
      const open = /[a-z0-9]$/i.test(text) ? q.at(-1) : null;
      const starts = open && open.length >= 2 ? vocab.filter(t => t !== open && t.startsWith(open)).slice(0, 40) : [];
      const out = { works: [], topics: [] };
      for (const d of docs) {
        let score = 0, hit = 0;
        for (const t of q) {
          let f = d.tf.get(t) || 0, weight = idf.get(t) || 0;
          if (!f && t === open) for (const s of starts) if (d.tf.has(s)) { f = d.tf.get(s) * .7; weight = idf.get(s); break; }
          if (f) { hit++; score += weight * f / (f + 1.2); }
        }
        if (!hit) continue;
        score *= (hit / q.length) ** 1.6;                        // matching most of the question beats matching one word well
        (d.kind === 'work' ? out.works : out.topics).push({ score, [d.kind === 'work' ? 'w' : 'p']: d.item });
      }
      out.works.sort((a, b) => b.score - a.score); out.topics.sort((a, b) => b.score - a.score);
      const best = out.works[0]?.score || 0;
      out.works = out.works.filter(x => x.score > best * .22);
      out.topics = out.topics.filter(x => x.score > (out.topics[0]?.score || 0) * .45).map(x => x.p);
      return out;
    };
  }
  root.Search = { build, terms };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Search;
})(typeof window !== 'undefined' ? window : globalThis);
