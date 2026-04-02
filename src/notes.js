// Notes about who I am and how I work.
// Each note: id, title, summary, content (with [[id|label]] links), links[], backlinks[] (computed).

const notes = {
  'what-im-like': {
    id: 'what-im-like',
    title: 'What I\'m Like',
    summary: 'Fast learner, candid, enthusiastic — I\'ll probably answer your 11pm message.',
    content: `I'm a **fast learner**. I pick things up quickly and I'm not afraid of jumping into areas where I don't have deep expertise — that's how I ended up going from economics to ML research to biosecurity to AI policy.

I'm **responsive**. If you message me at 11pm, I'll probably answer. I like the feeling of being the person who shows up.

I'm **candid**. I'd rather tell you what I actually think than say something comfortable. This has gotten me in trouble occasionally, but mostly it builds trust fast.

I'm **enthusiastic**. When something excites me, you'll know. I commit quickly and care deeply — sometimes about things others find niche.

I'm not great at slow-cooking anything. Short deadlines, clear deliverables, fast feedback loops — that's where I thrive. Give me a week and a clear problem over a quarter and a vague mandate.

See also: [[how-i-work|How I work]]`,
    links: ['how-i-work'],
  },

  'how-i-work': {
    id: 'how-i-work',
    title: 'How I Work',
    summary: 'Bootcamps, policy drafts, and building things — what I\'ve done as evidence of what I can do.',
    content: `Here's what I've done, as evidence of what I can do:

- **Ran AI safety bootcamps** throughout Latin America (ML4Good, 6 editions, ~10 participants each). Recruited teams, designed curricula, taught the material. This is where I learned to motivate people at speed.

- **Drafted policy recommendations** for the EU AI Act Code of Practice. Writing that had to be precise, useful, and survive review by people who disagreed with each other.

- **Built things with code** — including [this website](/) and tools for [Cliver](https://cliver.bio). I'm not a traditional software engineer, but I can build things that work.

- **Co-founded Cliver**. Technical co-founder means: system design, paper writing, user research, and a lot of learning on the fly.

The common thread: I like problems that are important, tractable, and a little bit scary. I don't need permission to start something, and I don't need hand-holding to finish it.

See also: [[what-im-like|What I'm like]] · [[whats-next|What's next]]`,
    links: ['what-im-like', 'whats-next'],
  },

  'whats-next': {
    id: 'whats-next',
    title: 'What\'s Next',
    summary: 'Current focus areas and where Cliver is heading.',
    content: `Right now I'm focused on **Cliver** and the broader question of how to make DNA synthesis screening actually work at scale.

**Current priorities:**

- **KYC red-teaming** — Testing how well the customer verification system holds up against adversarial actors. If it's going to matter, it needs to work when someone is trying to get around it.

- **Vouching and reference systems** — Investigating whether peer vouching can complement automated screening. Some trust signals are hard for AI to assess alone.

- **Provider best practices** — Working with synthesis companies to figure out what "good enough" screening actually looks like in practice.

Beyond Cliver, I'm interested in how AI tools can help small teams do biosecurity work that used to require large organizations. The leverage is enormous if the tools are good.

See also: [[how-i-work|How I work]]`,
    links: ['how-i-work'],
  },
}

// Compute backlinks
Object.values(notes).forEach(note => {
  note.backlinks = []
})
Object.values(notes).forEach(note => {
  note.links.forEach(targetId => {
    if (notes[targetId] && !notes[targetId].backlinks.includes(note.id)) {
      notes[targetId].backlinks.push(note.id)
    }
  })
})

export default notes
