// Re-sorts the entries the search bar found, by how well each answers the visitor's question.
// The browser ranks by matching words, which is instant but literal. This asks Jev, a model that
// returns scores and writes no text, to judge each of the top entries against the question in one
// request (OpenRouter's Decisions API). It typically answers in a few hundred milliseconds and
// costs about a hundredth of a cent. Only the question and published titles and one-line
// descriptions are sent, and the titles come from the server's own copy, never from the browser.
export const MODEL = 'typesafe/jev-1.14';
const LEVELS = ['Unrelated to the question', 'On the same broad subject but does not address the question', 'Addresses part of the question', 'Directly answers the question'];

// `works` maps an id to { title, gloss }. Returns { scores: { id: 0..3 }, ms, cost }.
export async function rank({ question, ids, works, key, signal }) {
  question = String(question || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const entries = [...new Set(ids)].slice(0, 30).filter(id => works.has(id));
  if (question.length < 3 || !entries.length) return { scores: {}, ms: 0, cost: 0 };
  const questions = Object.fromEntries(entries.map((id, n) => [`e${n}`, {
    type: 'score',
    instructions: `How well would this entry from Alejo Acelas's site answer the visitor's question? Entry: "${works.get(id).title}". ${works.get(id).gloss}`,
    criteria: LEVELS,
  }]));
  const started = performance.now();
  const res = await fetch('https://openrouter.ai/api/alpha/decisions', {
    method: 'POST', signal,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, state: `A visitor to a personal website about helping organisations use AI typed this into its search box: "${question}"`, questions }),
  });
  if (!res.ok) throw new Error(`Decisions API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const scores = Object.fromEntries(entries.map((id, n) => [id, body.answers?.[`e${n}`]?.score]).filter(x => typeof x[1] === 'number'));
  return { scores, ms: Math.round(performance.now() - started), cost: body.usage?.cost ?? 0 };
}

// A publishing build only: a review build still holds works that are not cleared to leave this machine.
export function publishedWorks(data) {
  if (data.works.some(w => w.share !== 'ok')) return null;
  return new Map(data.works.map(w => [w.id, { title: w.title, gloss: w.gloss }]));
}
