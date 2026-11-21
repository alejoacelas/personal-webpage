// The live site's endpoint for re-sorting search results (see wiki/rank.mjs).
// It reads titles and descriptions from the tracked publishing build, never from the request,
// so it can only be asked about works the site already shows.
// Needs OPENROUTER_API_KEY in the deployment's environment. Not yet exercised on Vercel.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { rank, publishedWorks } from '../wiki/rank.mjs';

let works;
function published() {
  if (works === undefined) {
    const text = readFileSync(path.join(process.cwd(), 'wiki/data.publish.js'), 'utf8');
    works = publishedWorks(JSON.parse(text.replace(/^window\.DATA = /, '').replace(/;\s*$/, '')));
  }
  return works;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const key = process.env.OPENROUTER_API_KEY, list = published();
  if (!key || !list) return res.status(409).end();
  const { question, ids } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  if (typeof question !== 'string' || !Array.isArray(ids) || ids.length > 40) return res.status(400).end();
  try {
    const out = await rank({ question, ids, works: list, key });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ scores: out.scores });
  } catch { return res.status(502).end(); }
}
