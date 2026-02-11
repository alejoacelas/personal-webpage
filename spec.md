Build me a single-page personal website in HTML/CSS/JS with the following aesthetic and structure. Make it production-quality, visually stunning, and deployable as a static site.

## Aesthetic: "Main Character Energy" — Cowboy Bebop meets anime portfolio
The vibe is Cowboy Bebop's retro-futuristic, jazz-noir visual language applied to a personal site. Think: the title cards, the end cards, the warm saturated color palette, the effortless cool of the show's graphic design. My career is presented as episode arcs. The energy is "my life is a story worth watching" — maximalist, deeply personal, but executed with so much style it becomes undeniable.

### Visual References from Cowboy Bebop:
- The bold, flat-color title cards with heavy typography
- The split-screen compositions and diagonal cuts
- The warm, smoky color palette — sunset oranges, deep reds, moody blues, cigarette-smoke grays
- The sans-serif bold typography mixed with handwritten/script elements
- The jazz-influenced rhythm — some sections dense and fast, others spacious and melancholic
- The "See You Space Cowboy..." end card energy
- Session title cards (e.g., "Session #1: Asteroid Blues")

### Color palette:
- Primary background: deep navy/space blue (#1A1A2E) alternating with warm rust (#8B3A3A)
- Accent 1: sunset orange (#E07B39)
- Accent 2: golden yellow (#D4A843)  
- Accent 3: smoky lavender (#7B6D8D)
- Text: warm cream (#F0E6D3) on dark backgrounds, deep navy on light sections
- Occasional electric blue (#4A90D9) for interactive elements
- Black (#0D0D0D) for high-contrast moments

### Typography:
- Primary headers: A bold, condensed sans-serif — "Bebas Neue" or "Oswald" from Google Fonts (this captures the Bebop title card feel)
- Session/episode titles: Same font but HUGE, like 15-20vw, used as background/decorative elements
- Body text: "Space Grotesk" or "IBM Plex Sans" — slightly retro-futuristic feel
- Occasional cursive/script accent font for "See you space cowboy" style moments — "Caveat" or "Sacramento"
- Numbers should be prominent and stylized throughout

### Layout & Sections:

1. **Cold Open / Hero**
   - No name at first. Start with a full-screen section in deep navy with a single line in large condensed type:
     "3... 2... 1... LET'S JAM."
   - This fades/transitions (like a smash cut) into my name: "ALEJANDRO" in massive bold condensed type, filling the width of the screen
   - Below it, in script font: "ai consultant, economist, builder of things that matter"
   - The background should have a subtle animated gradient — shifting slowly between deep navy and dark rust, like a sunset in space
   - Maybe a few thin diagonal lines cutting across the screen as decorative elements (Bebop's graphic design uses these a lot)

2. **Session Guide / Episode Select**
   - Header styled like a Bebop title card: "SESSIONS" in huge condensed type with a colored bar behind it
   - Each major life/career arc is an "episode" presented as a card/row:
     - **Session #1: "The Economist Who Looked Up"** — Discovering EA at 16, university, early career
     - **Session #2: "Oxford Blues"** — Living in Oxford, group houses, the EA community chapter
     - **Session #3: "Bogotá Calling"** — Return to Colombia, building ML4Good, EA Bogotá
     - **Session #4: "Know Your Customer"** — Building Cliver, biosecurity, cold outreach, startup grind
     - **Session #5: "The Frontier"** — Current work on AI evals, safety research, what's next
   - Each session card has:
     - Session number in huge faded background type
     - Episode title in bold condensed font
     - A one-line synopsis in body text
     - A color accent unique to each session (orange, yellow, blue, red, lavender)
     - On hover: the card expands or a diagonal wipe reveals more detail
   - Clicking/scrolling into a session shows a longer narrative paragraph about that arc

3. **Character Profile Card**
   - Styled exactly like an anime character introduction screen
   - A split-screen layout: left side has a stylized silhouette or geometric avatar (not a photo — keep it abstract/cool), right side has stats
   - Stats presented in a retro-futuristic UI style:
     - Name: Alejandro
     - Base: Bogotá, Colombia
     - Class: AI Consultant / Economist
     - Affiliation: Effective Altruism
     - Skills: [presented as a visual bar chart or radar chart with categories like "Machine Learning", "Biosecurity", "Policy", "Economics", "Community Building"]
     - Status: "Currently grinding customer development"
   - The whole thing should have scan-lines or a subtle CRT monitor effect
   - Color scheme: orange and cream on dark navy

4. **The Work / Bounty Board**
   - Header: "BOUNTY BOARD" in title card style (a reference to Bebop's bounty hunter premise)
   - Projects presented as "bounties" — wanted-poster style cards:
     - **Cliver** — "WANTED: A world where DNA synthesis can't be weaponized. Reward: Safer biology."
     - **Frontiers Evals** — "WANTED: Understanding what frontier AI can really do. Reward: Better governance."
     - **ML4Good** — "WANTED: ML talent across Latin America. Reward: Impact at scale."
     - **EU AI Act Advisory** — "WANTED: Technical clarity in AI regulation. Reward: Policy that works."
   - Each card has a bold border, the project name in large type, and the playful bounty description
   - Tags/tech stack in small caps at the bottom of each card

5. **Interlude: The Fridge**
   - A fun, personal section — a "what's on my mind" space
   - Styled like a corkboard or fridge with pinned notes
   - Items like: "Currently watching: [anime]", "Currently reading: [book]", "Currently avoiding: [task]", "Improv class count: [n]"
   - Handwritten/script font for the notes
   - Warm, slightly lighter background — like a break between intense sessions
   - This section makes the site feel human and lived-in

6. **End Card / Contact**
   - Full-screen navy background
   - In large script font, centered: "See You Space Cowboy..."
   - Below it, after a pause/scroll: my email and GitHub in clean sans-serif
   - A single line in small text: "Bogotá, Colombia · Always looking for the next session"
   - The ellipsis should blink or pulse very subtly

### Interactions & Animation:
- Bold, confident transitions — diagonal wipes, smash cuts, slide-ins from the sides
- Session cards should have punchy hover effects (color shifts, scale, diagonal reveal)
- Text in the hero should animate in with purpose — not gentle fades but CUTS, like title cards
- The character profile section could have a fake "loading" or "scanning" animation when it enters viewport
- Scroll-triggered animations throughout, but they should feel RHYTHMIC — like jazz timing. Some fast, some slow.
- The diagonal line motifs from Bebop should appear as decorative elements between sections
- A subtle grain/noise texture overlay on the whole page (CSS filter or SVG) to give it that analog, cel-animation warmth

### Technical:
- Single index.html with embedded CSS and JS (or cleanly separated files)
- Fully responsive — the bold typography should scale dramatically between mobile and desktop
- Google Fonts CDN for typography
- No heavy frameworks — vanilla HTML/CSS/JS. CSS animations and Intersection Observer for scroll triggers.
- The grain texture can be a CSS pseudo-element with an SVG noise filter
- Make the code clean and well-commented so I can easily swap content

### The Feeling:
Someone visits this site and thinks: "This person has main character energy and the talent to back it up." It should feel like opening credits to something you want to keep watching. Cool, warm, confident, a little melancholic, and deeply stylish. The craftsmanship should make the boldness feel earned.
