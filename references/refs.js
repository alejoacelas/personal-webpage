// The references collection. Add an entry, then run `node references/capture.mjs <id>`.
// `note` holds what Alejo likes about the reference.
window.REFS = [
  {
    id: 'works-in-progress',
    name: 'Works in Progress',
    note: '',
    pages: [
      { label: 'Home', url: 'https://worksinprogress.co/' },
      { label: 'Article', url: 'https://worksinprogress.co/issue/the-forgotten-formula-for-lovable-cities/' },
    ],
  },
  {
    id: 'forethought',
    name: 'Forethought',
    note: '',
    pages: [
      { label: 'Home', url: 'https://www.forethought.org/' },
      { label: 'Research piece', url: 'https://www.forethought.org/research/better-futures' },
      { label: 'Person', url: 'https://www.forethought.org/people/william-macaskill' },
    ],
  },
  {
    id: 'curius',
    name: 'Curius',
    note: '',
    pages: [{ label: 'Home', url: 'https://curius.app/' }],
  },
  {
    id: 'owid-data-insights',
    name: 'Our World in Data — Data Insights',
    note: '',
    pages: [{ label: 'Data insight', url: 'https://ourworldindata.org/data-insights/solar-and-wind-power-have-grown-quickly-in-poland-but-coal-still-dominates' }],
  },
  {
    id: 'metr-notes',
    name: 'METR Notes',
    note: 'Looks rough and unpolished, which signals work in progress.',
    pages: [
      { label: 'Notes index', url: 'https://metr.org/notes/' },
      { label: 'Note', url: 'https://metr.org/notes/2026-07-22-economics-of-recursive-self-improvement/' },
    ],
  },
  {
    id: 'google-docs',
    name: 'Google Docs',
    note: '',
    pages: [{ label: 'Doc (needs a public doc link)', url: 'https://docs.google.com/' }],
  },
];
