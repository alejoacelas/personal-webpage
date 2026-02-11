Build me a single-page personal website in HTML/CSS/JS with the following aesthetic and structure. Make it production-quality, visually stunning, and deployable as a static site.

## Aesthetic: "Shrine to the Work"
The vibe is a dark, reverent, almost ritualistic museum. Think: a dimly lit gallery where each project is a sacred artifact on a pedestal. The energy is earnest, intense, and unapologetic — "I am building something important and I know it."

### Color palette:
- Background: near-black (#0A0A0A) with very subtle warm undertones
- Primary accent: rich gold (#C9A84C) used sparingly — borders, highlights, hover states
- Secondary: warm off-white (#E8E0D0) for body text
- Tertiary: deep burgundy (#4A1525) for subtle section dividers or background gradients
- Occasional amber glow effects on hover

### Typography:
- Headers: A serif font with presence — use "Playfair Display" from Google Fonts
- Body: Clean, readable — "Inter" or "Source Sans Pro"
- Occasional use of small caps and generous letter-spacing for labels (like "PROJECT 01", "MANIFESTO")
- Large, dramatic pull quotes in italic serif

### Layout & Sections:

1. **Opening / Hero**
   - My name: "Alejandro" in large, gold, serif type — centered, with a slow fade-in
   - Subtitle underneath in small caps: "AI CONSULTANT · ECONOMIST · BUILDER"
   - A single sentence in elegant italic below: "I work on problems that matter before most people realize they're problems."
   - Very minimal — lots of black space. The name should feel like it's floating in a void.
   - Subtle ambient particle animation in the background (tiny gold dots drifting slowly, like dust in a spotlight)

2. **Manifesto Section**
   - Header: "WHAT I BELIEVE" in small caps, gold, with a thin gold line extending left and right
   - 3-4 short, bold statements presented one at a time as the user scrolls, each taking up significant vertical space. Use large serif italic text centered on screen. Examples:
     - "Biosecurity is the most neglected existential risk of our time."
     - "Open-source tools can make the world meaningfully safer."
     - "The gap between AI capability and AI governance is growing every day. I work in that gap."
   - These should feel like inscriptions on a wall.

3. **Projects as Artifacts**
   - Header: "THE WORK" in small caps
   - Each project gets a full-viewport section with:
     - A project number in large, faded gold type in the background ("01", "02", etc.)
     - Project name in large serif
     - A 2-3 sentence description in body text
     - A thin gold border framing the content, with subtle glow on scroll-into-view
     - Tags/labels at the bottom in small caps (e.g., "BIOSECURITY · OPEN SOURCE · AI")
   - Projects to include (use placeholder descriptions I'll fill in later):
     - **Cliver** — "An open-source AI tool for Know Your Customer screening in DNA synthesis. Making it harder to misuse biology."
     - **Frontiers Evals** — "Research on evaluating frontier AI systems for dangerous capabilities."
     - **ML4Good** — "Teaching machine learning for social impact across Latin America."
     - **European AI Act Advisory** — "Providing technical input to shape AI governance in Europe."
   - Transition between projects should feel ceremonial — smooth scroll-snapping or slow fade transitions

4. **Background / Bio**
   - Header: "THE PATH" 
   - A timeline-style section but NOT a typical resume timeline. Instead, present it as a narrative:
     - Short paragraphs in elegant body text, with years highlighted in gold
     - Cover: Discovered EA at 16, economist background, Oxford chapter, current work in Bogotá
   - This section can have a slightly warmer background — very subtle dark burgundy gradient

5. **Current Focus**
   - Header: "RIGHT NOW"
   - A short, living section that lists 2-3 things I'm currently focused on
   - Styled like a museum placard — bordered box, small caps label, clean text inside
   - Placeholder: "Customer development for Cliver. Cold outreach. Validating market demand with DNA synthesis providers."

6. **Contact / Closing**
   - Minimal. Just: email, GitHub, and a line like "I'm always interested in talking to people who take these problems seriously."
   - Gold text on black. No social media icons — just clean text links.
   - The page should end with generous black space, like walking out of a gallery into the dark.

### Interactions & Animation:
- Smooth scroll behavior throughout
- Elements fade/slide in gently as they enter the viewport (use Intersection Observer)
- Gold elements should have a very subtle shimmer or glow on hover
- The ambient particle effect in the hero can be done with a lightweight canvas animation
- Keep it performant — no heavy libraries. Vanilla JS or minimal dependencies.
- The overall feeling should be SLOW and DELIBERATE. Nothing should move fast.

### Technical:
- Single index.html file with embedded CSS and JS (or separate files, your call for cleanliness)
- Fully responsive — should look stunning on mobile too
- Use Google Fonts CDN for typography
- No frameworks needed — vanilla HTML/CSS/JS
- Make the code clean and well-commented so I can easily modify content later

The overall effect should make someone feel like they've walked into a space that takes itself seriously. It should be intense, beautiful, and a little intimidating — but never pretentious. The craftsmanship should justify the confidence.
