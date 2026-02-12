Build me a single-page personal website in HTML/CSS/JS with the following aesthetic and structure. Make it production-quality, visually stunning, and deployable as a static site.

## Aesthetic: "Tableaux Vivants"

Full Baroque drama translated to web — but this time the page isn't just lit, it's INHABITED. Every section is a scene with figures, gestures, and visual tension. CSS-rendered human silhouettes, hands, and bodies emerge from darkness alongside the text. The page scrolls like walking through a gallery of dramatic paintings — each viewport is a tableau with composition, not just words in a spotlight.

Think: if Caravaggio made websites, there would be HANDS reaching out of the darkness, figures turning toward light, bodies in motion. The text is part of the scene, not the whole scene.

### Visual References:
- Caravaggio's "The Calling of Saint Matthew" — a hand pointing through light into darkness
- Caravaggio's "Judith Beheading Holofernes" — figures frozen in violent action
- Caravaggio's "Narcissus" — a figure leaning over, reflected
- Bernini's sculptures — bodies caught mid-gesture, fabric in motion
- Baroque ceiling paintings — figures falling/ascending through space

### Color Palette (same as before, it works):
- Absolute black: #000000 (dominant)
- Deep void black: #0A0705
- Warm gold light: #FFD6A0
- Bright gold: #FFC46B
- Deep brown shadow: #1A0E00
- Blood accent: #3A0A0A
- Flesh/parchment: #E8D5B7

### The Figures (CRITICAL NEW ELEMENT):
Each section features CSS/SVG silhouettes of human forms — rendered as solid shapes in warm gold or parchment tones against pure black. These are NOT illustrations or clip-art — they are dramatic, minimal, high-contrast silhouettes that feel carved from light.

Implementation approach:
- Use inline SVG `<path>` elements for each figure (hand-crafted paths, not imported images)
- Figures are rendered in warm gold (#FFD6A0) with soft glow (filter: drop-shadow in gold)
- They are positioned as part of the section composition — they have SPATIAL relationships with the text
- Some figures animate subtly on scroll reveal (slight translate, opacity fade, or scale)
- The figures should feel like they're emerging FROM the darkness — partial visibility, edges dissolving into black via gradient masks

### Typography:
- Same as before: Cormorant Garamond + Cormorant SC
- But now text is COMPOSED with figures — text wraps around hands, sits beside figures, flows beneath reaching arms
- Pull quotes are large and positioned dramatically within scenes

### Layout & Sections:

1. **The Calling / Hero**
   - SCENE: A large SVG hand extends from the left edge of the viewport, fingers pointing right toward the name. The hand is lit in warm gold, emerging from darkness. This references "The Calling of Saint Matthew" — the hand of God/fate pointing.
   - "ALEJANDRO" sits where the finger points, in bright gold
   - Below: subtitle and tagline in parchment, positioned as if caught in the light cast by the hand
   - The hand has a subtle glow around it (CSS filter drop-shadow)
   - On scroll reveal: the hand slides in slightly from the left (transform: translateX) while the name fades in
   - Dust particles drift in the light between the hand and the name
   - The composition should feel like a PAINTING — the hand on the left third, the text on the right two-thirds

2. **The Witness / Manifesto**
   - SCENE: A figure (head and shoulders silhouette) faces the text from the right side of the viewport, as if reading the manifesto carved on a wall. The figure is in parchment color, semi-transparent at the edges.
   - The three manifesto statements are stacked on the left, with the embossed/carved text treatment
   - "I work in that gap." in bright gold, positioned between the figure and the statements — as if the figure is SAYING it
   - The figure creates compositional balance — text on left, observer on right
   - Blood-red line runs below, connecting the two sides

3. **The Gallery / Projects**
   Each project room has its own dramatic figure/gesture:

   - **Room I: Cliver** — A pair of hands cupped together (as if holding/protecting something fragile — biology, life). The hands are in the upper portion, the project text below, as if the hands are offering the project to the viewer. Tags: "BIOSECURITY · OPEN SOURCE · AI"

   - **Room II: Frontiers Evals** — A figure holding up a lantern or torch (arm extended upward, light radiating from the top). The project text sits in the pool of light below the torch. This represents illuminating dangerous capabilities. Tags: "AI SAFETY · RESEARCH · EVALUATION"

   - **Room III: ML4Good** — Multiple smaller silhouettes (3-4 figures) standing together, suggesting a classroom or gathering. The project text is centered below them. Teaching, community. Tags: "EDUCATION · ML · LATIN AMERICA"

   - **Room IV: EU AI Act** — A figure seated at a desk or table, leaning forward (the scholar/advisor posture). The project text flanks the figure. Governance, deliberation. Tags: "POLICY · GOVERNANCE · EUROPE"

   - Gold frames still animate around each project, but now they frame the ENTIRE composition (figure + text)
   - Between rooms: 50vh+ of pure black

4. **The Chronicle / Background**
   - SCENE: A long winding path or staircase rendered as a vertical SVG element on the left side — abstract, geometric, suggesting a journey/descent. Each "At sixteen" / "At university" / "In Oxford" / "In Bogotá" paragraph sits at a different level of the staircase.
   - The staircase is rendered in thin gold lines, barely visible
   - As the user scrolls, each paragraph fades in at its step
   - Gold-highlighted phrases remain the navigational skeleton

5. **The Altar / Current Focus**
   - SCENE: Two hands reaching toward each other from opposite sides of the viewport (Sistine Chapel ceiling reference — the Creation of Adam). Between the hands, the "RIGHT NOW" content sits in its reliquary box.
   - The gap between the fingertips is where the content lives — intense light pools here
   - The hands have the brightest glow on the page — this is the moment of creation/action
   - The reliquary box content is the same

6. **The Exit / Contact**
   - SCENE: A single figure walking away, receding into darkness — shown from behind, getting smaller/more transparent toward the bottom of the viewport
   - Contact info is positioned above the figure, as if the figure is leaving it behind
   - "I'm always interested in talking to people who take these problems seriously." sits as a parting inscription
   - As the user scrolls to the very bottom, the figure and text fade to complete black
   - Final period "." remains longest before disappearing

### Interactions & Animation:
- All previous animations remain (flicker, dust, frame-draw, scroll reveals)
- NEW: Figures animate on reveal — slight translations (10-20px), opacity fades, or subtle scale changes
- NEW: Parallax-lite — figures move at a slightly different scroll rate than text (use transform: translateY with a scroll multiplier via JS, very subtle — 0.05-0.1x)
- All figure animations are SLOW (1.5-2.5s transitions)
- Figures that are partially off-screen should feel like they extend beyond the viewport — use overflow:hidden on sections, but let figures be positioned partly outside

### Technical:
- Single index.html, embedded CSS/JS, no frameworks
- SVG paths for all figures — inline, not external files
- Each figure's `<path>` data should create recognizable human silhouettes (hands, torsos, profiles) using clean Bezier curves
- CSS `filter: drop-shadow()` for figure glow
- CSS `mask-image: linear-gradient()` on figures to dissolve edges into darkness
- Intersection Observer for all reveals
- Scroll-linked parallax via a single `requestAnimationFrame` scroll handler
- Google Fonts CDN for Cormorant Garamond
- Responsive: on mobile, figures scale down and reposition (some may shift to above/below text instead of beside it)
- Code organized by scene/tableau

### The Feeling:
This site should feel like walking through a living gallery. The figures aren't decoration — they're co-inhabitants of the page, frozen mid-gesture, telling a story alongside the text. The darkness isn't empty anymore — there are BODIES in it, caught in pools of light, reaching, observing, creating, departing. It says: "This work is human. It has hands. It moves."
