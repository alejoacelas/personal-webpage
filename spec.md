Build me a single-page personal website in HTML/CSS/JS with the following aesthetic and structure. Make it production-quality, visually stunning, and deployable as a static site.

## Aesthetic: "Concrete Poetry"
The entire site is TYPOGRAPHY AND NOTHING ELSE. No images, no shapes, no icons, no colored backgrounds. Just words — arranged spatially, scaled dramatically, overlapping, rotating, flowing across the screen. Inspired by concrete poetry, experimental typography, Emigre magazine, Wolfgang Weingart, and the idea that text itself is a visual medium. The site is the artwork. Every pixel is a letter.

### Visual References:
- Concrete poetry by Eugen Gomringer, Augusto de Campos, and the Noigandres group
- Wolfgang Weingart's deconstructed Swiss typography
- Emigre magazine layouts from the 1990s
- Robert Massin's typographic interpretation of "The Bald Soprano"
- Typographic posters by Neville Brody and David Carson
- The feeling of magnetic poetry on a fridge — words as physical, movable objects

### Color Palette:
- STRICTLY monochrome.
- Option A (default): Black text (#000000) on white background (#FFFFFF)
- Some text at very low opacity (0.03-0.08) creating ghost layers behind primary content
- Some text inverted (white on a black text-block)
- The ONLY color on the entire site: a single word or phrase in red (#CC0000) that appears once. Just once. This is the thesis statement. Everything else is black and white.

### Typography:
This site uses MANY fonts deliberately — each serves a role:
- "Space Mono" — for code-like, systematic text (skill labels, tags)
- "Playfair Display" — for dramatic, emotional statements (manifesto lines)
- "Inter" or "Helvetica Neue" — for readable body text (project descriptions)
- "Bebas Neue" — for massive, architectural display text (name, section headers)
- "Caveat" — for handwritten, personal moments (asides, notes to the reader)
- The interplay between these fonts IS the visual design. Treat font choice like color choice.
- Text sizes range from 8px (barely readable fine print) to 25vw (letters as architecture)

### Layout Philosophy:
- There is NO conventional layout. No cards, no sections with backgrounds, no containers.
- The page is a single continuous canvas where text is placed SPATIALLY — words have x,y coordinates, rotations, and scales.
- Text overlaps. Text runs vertically. Text curves. Text clusters and disperses.
- White space is used aggressively — some viewports are nearly empty with a single word; others are dense and layered.
- The scroll experience should feel like walking through a typographic landscape — sometimes intimate (small text you lean in to read), sometimes overwhelming (text so large you can only see a few letters).
- On mobile, the compositions simplify but maintain spatial play — text still overlaps, rotates, and scales.

### Sections (as Typographic Compositions):

1. **The Name as Architecture**
   - "ALEJANDRO" in Bebas Neue at approximately 25vw font size, filling the viewport width
   - The letters are spaced apart, and BETWEEN each letter, in tiny 10px Inter text, are words that describe you: between A and L: "economist", between L and E: "builder", between E and J: "consultant", etc.
   - Below the name, in Caveat (handwritten), offset to the right: "from bogotá, working on things that matter"
   - The name should feel monumental — like you're standing at the base of a building looking up at the letters
   - On scroll, the large letters slowly drift apart (parallax at different speeds), revealing more of the small text between them

2. **The Manifesto as Landscape**
   - A viewport-height section where your beliefs are scattered across the screen at different sizes, angles, and opacities:
     - "BIOSECURITY" in large Bebas Neue, rotated -5°, upper left
     - "is the most neglected" in medium Playfair Display italic, center
     - "EXISTENTIAL RISK" in large Bebas Neue, lower right, overlapping "is the most neglected"
     - "of our time." in small Inter, tucked under "EXISTENTIAL RISK"
   - A second belief assembled similarly:
     - "open source tools" in medium Space Mono, scattered center-left
     - "CAN MAKE THE WORLD" in large Bebas Neue running vertically along the right edge
     - "safer" in Caveat, small, gentle, near the bottom center
   - The third belief: this is the ONE red text on the entire site.
     - "I WORK IN THE GAP" in Bebas Neue, medium-large, centered, in #CC0000
     - Surrounding it, in very low opacity (0.05) black text, repeating: "between capability and governance" over and over, creating a texture
   - On scroll, these elements should have subtle parallax — different layers moving at different speeds, creating depth

3. **The Work as Conversation**
   - Project information presented as an overlapping, layered typographic collage:
   - "THE WORK" in Bebas Neue, huge (20vw), very low opacity (0.04), positioned as a background watermark
   - **Cliver**: 
     - "CLIVER" in bold Inter, 8vw, positioned left of center
     - Below and overlapping: "open-source KYC for DNA synthesis" in Playfair Display italic, smaller
     - Below that: "making it harder to misuse biology" in Space Mono, even smaller
     - Tags scattered nearby at angles: "biosecurity" "open source" "AI" in tiny Space Mono
   - **Frontiers Evals**:
     - Positioned to the right and slightly below Cliver, creating visual dialogue
     - "FRONTIERS EVALS" in bold Inter
     - "what can frontier AI actually do?" in Playfair italic
     - "evaluation · safety · research" in Space Mono, running vertically
   - **ML4Good**:
     - "ML4GOOD" overlapping from the left
     - "machine learning × latin america × impact" flowing in a curved text path
   - **EU AI Act Advisory**:
     - Placed lower, more isolated
     - "POLICY" in huge Bebas Neue, very low opacity, with "making governance technical" in readable Inter overlaid
   - The projects should feel like a CONVERSATION between text blocks — overlapping, responding to each other, creating visual rhythm

4. **The Path as Concrete Poem**
   - Your career timeline presented as a literal poem shape:
   - The text forms a visual pattern — perhaps a downward staircase, a spiral, or a branching tree shape
   - Each line is a moment:
 age 16: discovered effective altruism
   and the world split into before and after
     universidad de los andes
       economics because it was the closest thing to
         understanding everything
           oxford: group houses, late nights, community
             the feeling of being in the right room
               bogotá: home again but different now
                 building cliver
                   teaching ML4Good
                     writing about AI safety
                       and wondering if it's enough
   - This should be rendered with each line progressively indented, in Playfair Display italic, medium size
   - The lines appear one at a time on scroll, building the poem as you descend
   - In Caveat, at the very end, slightly offset: "(it's never enough. you do it anyway.)"

5. **Current State as Magnetic Poetry**
   - A viewport where words and short phrases are scattered across the screen like magnets on a fridge:
   - Words include: "customer development" "cold outreach" "DNA synthesis" "Cliver" "improv" "anime" "loneliness" "ambition" "Bogotá" "2 AM" "one more email" "is this working?" "keep going"
   - Each word is in a different font, size, and slight rotation — but all black and white
   - On hover, words REARRANGE — they drift to new positions, creating new readings and juxtapositions
   - Some words are in bold Inter (professional), some in Caveat (personal), some in Space Mono (technical) — the font choice reveals the category without labels
   - One word is upside down. One is barely visible. One is very large. The composition feels alive and unsettled.

6. **Contact as Whitespace**
   - After the density of the previous sections, this viewport is almost entirely empty white space
   - Dead center, in small Inter (14px), simply:
 alejandro@[email]
 github.com/[handle]
   - Above it, in tiny Caveat (11px), barely there: "say hello"
   - Below it, in Bebas Neue, medium, with wide letter-spacing: "BOGOTÁ, COLOMBIA"
   - The emptiness after all that density should feel like a deep exhale

### Interactions & Animation:
- Parallax is essential — text layers at different depths moving at different scroll speeds
- Text in Section 4 (the poem) appears line by line as user scrolls, building progressively
- Magnetic poetry words in Section 5 drift on hover (use JS for randomized position transitions)
- Very subtle: some background text (the low-opacity layers) drifts continuously, very slowly (CSS animation, infinite, linear)
- NO flashy transitions. Movement should feel like text breathing — slow, organic, continuous
- On mobile, reduce overlapping layers but maintain the spatial irregularity — text should still be placed unexpectedly, not in neat stacks
- Consider a subtle text cursor trail effect — as the mouse moves, tiny words appear briefly in its wake and fade (optional, only if performant)

### Technical:
- Single index.html with embedded CSS and JS
- Heavy use of CSS positioning (absolute within relative containers for each composition)
- CSS transforms for rotation and scale
- Google Fonts CDN for all fonts
- Intersection Observer for scroll-triggered reveals
- Vanilla JS for the magnetic poetry interaction (randomized transforms on hover)
- Use CSS custom properties for easy font-size and position adjustments
- The code should be organized by section/composition for easy editing
- Responsive: use vw/vh units extensively, with media queries to simplify compositions on small screens
- Performance: keep DOM elements reasonable, use CSS for animations where possible, JS only where needed

### The Feeling:
This site should make someone stop and READ — not scan, not skim, but actually engage with words as visual, physical, spatial objects. It says: "I think in language. I build with ideas. And I'm willing to show you the mess of how those ideas live in my head." It's intellectual, personal, and unafraid. The craft of the typography makes it art, not chaos.
