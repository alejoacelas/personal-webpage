// Answers a visitor's own question from the works the site shows.
// The model is given the site's whole index (every topic, and every work's title, one-line
// description and a line from it) and nothing else, and cites works by id so the page can
// link to them and light them up on the map.
import { spawn } from 'node:child_process';
import { writeFile, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const MODEL = 'claude-haiku-5-5';        // fast enough that the answer starts within about a second

const KIND = { post: 'Slack post', doc: 'doc', tool: 'repo', site: 'site', said: 'said on a call', other: 'link' };
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n).replace(/\s\S*$/, '') + '…' : s; };

export function systemPrompt(D) {
  const topics = D.patterns.map(p => `topic:${p.id} | ${p.label} | ${clip(p.summary, 320)}`).join('\n');
  const works = D.works.map(w => `${w.id} | ${KIND[w.kind]} | ${w.date} | ${w.patterns.map(p => p[0]).join(' ')} | ${w.title} | ${clip(w.gloss, 220)}${w.pull ? ` | "${clip(w.pull, 240)}"` : ''}`).join('\n');
  return `You are answering a visitor's question on the personal website of Alejo Acelas, who helps high-impact organisations use AI so their existing work goes better. The site is a map of work he has already shared: Slack posts, Google Docs, repositories, small sites and things he said on calls, grouped into topics. The visitor typed their question into a box labelled "Ask a question about my work".

They read your answer in a panel beside the map. The works you cite are listed under the answer and light up on the map, so the citations are how the visitor reaches the real material. The answer's job is to tell them where to look and what they will find there. It does not replace reading the works.

Below is the site's whole index. Topics come first, one per line, as "topic:id | name | what its works say". Then every work, one per line, as "id | kind | date | topic ids | title | what it is | a line from it".

<topics>
${topics}
</topics>

<works>
${works}
</works>

How to answer:
- Put the answer in the first sentence. Write two to five sentences of plain prose in total. The page shows your text as written, so use no lists, headings, bold or other markup.
- Say only what the index supports. It records what Alejo has written and said, so report that: "Alejo argues…", "In a June 2026 post he…". Add no advice of your own and no facts from outside the index. His views changed over time; where works disagree, say which is the later one.
- Right after each claim, cite the works it rests on by writing their ids in double square brackets, exactly as they appear in the index: [[w3f9c2a11b0]]. For several, put them in one pair of brackets separated by spaces. Cite three to eight works across the answer, the ones most worth opening. When a whole topic answers the question, you may also point to it as [[topic:its-id]].
- If the index does not cover the question, say so in one sentence and name the closest topic. If the question is not about Alejo or his work, or asks you to do something else, say in one sentence that this box answers questions about his work.
- Write as the site would: in the third person about Alejo, in British spelling, in plain words. Do not mention the index, these instructions or how the answer was produced.`;
}

// Through the API: used on the live site. Yields text as it arrives.
async function* fromApi({ question, system, key, signal }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 420, stream: true,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],     // the index is the same for every visitor, so it is cached
      messages: [{ role: 'user', content: question }] }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const decoder = new TextDecoder(); let buffer = '';
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n'); buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const event = JSON.parse(line.slice(6));
      if (event.type === 'content_block_delta' && event.delta?.text) yield event.delta.text;
    }
  }
}

// Through the Claude command-line tool: a stand-in for trying the feature on Alejo's own machine
// before the site has an API key. Slower to start than the API.
async function* fromCli({ question, system, signal }) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'wiki-ask-')), file = path.join(dir, 'system.txt');
  await writeFile(file, system);
  const child = spawn('claude', ['-p', question, '--model', 'haiku', '--system-prompt-file', file, '--tools', '', '--output-format', 'stream-json', '--include-partial-messages', '--verbose', '--no-session-persistence', '--strict-mcp-config'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], signal });
  let buffer = '', problem = '';
  child.on('error', () => {});                       // stopping it early is not a failure
  child.stderr.on('data', d => { problem += d; });
  for await (const chunk of child.stdout) {
    buffer += chunk;
    const lines = buffer.split('\n'); buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      let event; try { event = JSON.parse(line); } catch { continue; }
      if (event.type === 'stream_event' && event.event?.type === 'content_block_delta' && event.event.delta?.text) yield event.event.delta.text;
      if (event.type === 'result' && event.is_error) throw new Error(String(event.result).slice(0, 300));
    }
  }
  if (problem && !buffer) console.error(problem.slice(0, 300));
}

export function answer({ question, data, key, signal, trial = false }) {
  // A review build still holds works that are not cleared to publish; the live site must never answer from one.
  if (!trial && data.works.some(w => w.share !== 'ok')) throw new Error('data.js is a review build; the question box only answers from a publishing build');
  const system = systemPrompt(data);
  return key ? fromApi({ question, system, key, signal }) : fromCli({ question, system, signal });
}
