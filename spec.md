Build me a single-page personal website in HTML/CSS/JS with the following aesthetic and structure. Make it production-quality, visually stunning, and deployable as a static site.

## Aesthetic: "Caravaggio.exe"
Full Baroque chiaroscuro translated to web. The page is DARK — almost entirely black — and content emerges from the void like figures in a Caravaggio painting, lit by a single harsh directional light source from the upper left. Everything feels carved from shadow. The mood is reverent, intense, and heavy with meaning. Like descending into a crypt and finding something extraordinary on the walls.

### Visual References:
- Caravaggio's "The Calling of Saint Matthew" — the way light cuts across the darkness and illuminates only what matters
- Caravaggio's "Judith Beheading Holofernes" — the dramatic warm spotlight against absolute black
- Rembrandt's self-portraits — faces emerging from darkness
- Baroque church interiors — gold catching candlelight in vast dark spaces
- The film "Barry Lyndon" by Kubrick — scenes lit only by candlelight

### Color Palette:
- Absolute black: #000000 (the dominant "color" — at least 60-70% of any viewport)
- Deep void black: #0A0705 (warm black, for areas that aren't pure void)
- Light source warm gold: #FFD6A0 (the "spotlight" — warm, golden, like candlelight or late afternoon sun through a window)
- Bright gold: #FFC46B (for the most intensely lit text and elements)
- Deep brown shadow: #1A0E00 (the penumbra — the edge of the light)
- Blood accent: #3A0A0A (used very sparingly — a thin line, a background hint, a single word)
- Flesh/parchment: #E8D5B7 (for body text in lit areas — warm, human, like old paper)

### Light System (CRITICAL):
The entire visual identity depends on simulating a DIRECTIONAL LIGHT SOURCE from the upper-left.
- Implement this with layered CSS radial and linear gradients
- Each section has a "pool of light" — a radial gradient from warm gold to transparent, positioned upper-left of the content area
- Text and elements within the pool are fully visible; those at the edges fade into shadow
- The light should feel PHYSICAL — you should almost sense its warmth
- Between sections, there is NO light — just black. Scrolling between sections should feel like walking between pools of light in a dark gallery.
- The light pools should have a very subtle flicker effect (CSS animation oscillating opacity between 0.95 and 1.0 at random intervals) to simulate candlelight

### Typography:
- Primary: "Cormorant Garamond" from Google Fonts — elegant, high-contrast serif that looks carved
- Headers in Cormorant Garamond Bold or SemiBold, relatively large
- Body in Cormorant Garamond Regular, generous line-height (1.7-1.8)
- Small labels in "Cormorant SC" (small caps) with wide letter-spacing
- Text color should be the parchment tone (#E8D5B7) where lit, fading to near-invisible in the shadows
- Some text should be in the bright gold (#FFC46B) — reserved for the most important words, like gold leaf on a manuscript
- NO sans-serif fonts anywhere. Everything is classical.
- Pull quotes in large italic Cormorant — 3-4vw — like inscriptions

### Layout & Sections:

1. **The Void / Hero**
   - The page opens in COMPLETE darkness. Pure #000000 for a full viewport height.
   - After a moment (or on scroll), a pool of warm light slowly fades in from the upper left, revealing:
   - "ALEJANDRO" in Cormorant Garamond Bold, large (8-10vw), in bright gold (#FFC46B)
   - Below it, in small caps Cormorant, parchment-colored: "AI CONSULTANT · ECONOMIST · BUILDER"
   - Below that, in italic Cormorant, smaller: "I work on problems that matter before most people realize they're problems."
   - The light pool illuminates only the text — the rest of the viewport remains black
   - The light should have soft, realistic falloff — bright at center, warm penumbra, then void
   - Subtle: the faintest suggestion of floating dust particles in the light beam (tiny dots, very low opacity, drifting slowly — canvas or CSS animation)
   - The overall effect: a name emerging from darkness, like a painting being unveiled

2. **The Crypt Wall / Manifesto**
   - Scroll past a full viewport of pure black (the passage between rooms)
   - A new light pool reveals text that appears CARVED into the wall:
   - Implement a subtle embossed/engraved text effect using text-shadow: light source from upper-left means shadow falls lower-right
   - Three statements, stacked vertically with generous spacing:
     - "Biosecurity is the most neglected existential risk of our time."
     - "Open-source tools can make the world meaningfully safer."
     - "The gap between AI capability and AI governance grows every day."
   - Each statement is in large Cormorant italic, parchment-colored, emerging from darkness
   - Below all three, in bright gold, slightly larger: "I work in that gap."
   - The gold text should have a very subtle glow (text-shadow with gold, blurred)
   - A single thin line in blood red (#3A0A0A) runs horizontally below the manifesto, barely visible — like dried blood on stone

3. **The Gallery / Projects**
   - Each project gets its own "room" — a full viewport of blackness with a pool of light revealing content
   - The light source angle shifts slightly per project (upper-left for first, more centered for second, etc.) to create variety while maintaining the chiaroscuro feel
   
   - **Room I: Cliver**
     - Project number "I" in huge faded gold (20vw, opacity 0.08) in the background
     - "CLIVER" in Cormorant Bold, bright gold
     - Description in parchment italic: "An open-source AI tool for Know Your Customer screening in DNA synthesis. Making it harder to misuse biology."
     - Tags in small caps: "BIOSECURITY · OPEN SOURCE · AI"
     - The text is framed by a subtle golden border — thin, elegant, like a gilt frame — that emerges from darkness
     - The frame should have a warm glow (box-shadow in gold)

   - **Room II: Frontiers Evals**
     - "II" as the background number
     - "FRONTIERS EVALS" in gold
     - "Research on evaluating frontier AI systems for dangerous capabilities."
     - Tags: "AI SAFETY · RESEARCH · EVALUATION"

   - **Room III: ML4Good**
     - "III" background
     - "ML4GOOD" in gold
     - "Teaching machine learning for social impact across Latin America."
     - Tags: "EDUCATION · ML · LATIN AMERICA"

   - **Room IV: EU AI Act**
     - "IV" background — Roman numerals reinforce the classical feel
     - "EUROPEAN AI ACT ADVISORY" in gold
     - "Providing technical input to shape AI governance in Europe."
     - Tags: "POLICY · GOVERNANCE · EUROPE"
   
   - Between each room: at least 50vh of pure black scroll space. The darkness between projects is part of the experience.

4. **The Chronicle / Background**
   - A single, long section with a warm light pool that's wider than previous ones — more ambient, like a lit chapel
   - Your story told in narrative paragraphs, Cormorant Regular, parchment color
   - Key moments highlighted in bright gold:
     - "At sixteen" — discovering EA
     - "At university" — economics, co-founding the EA chapter
     - "In Oxford" — research, community, the group house
     - "In Bogotá" — home, building, teaching
   - These gold-highlighted phrases catch the eye first, creating a readable skeleton even if someone doesn't read every word
   - The section has a very subtle warm gradient at the edges — deep brown penumbra suggesting the walls of a room

5. **The Altar / Current Focus**
   - A small, intensely lit section — the tightest, brightest light pool on the page
   - "RIGHT NOW" in Cormorant SC, gold, with a glow
   - Content in a gold-bordered box (the "reliquary"):
     - "Building Cliver. Customer development. Convincing the world that DNA screening matters."
     - "Teaching ML4Good across Latin America."
     - "Writing. Thinking. Sending one more cold email."
   - The box should feel precious — thin gold border with subtle glow, generous padding, centered in the light
   - This section is small and bright after the larger darker sections — it focuses attention

6. **The Exit / Contact**
   - The light pool dims to its softest — barely there, like embers
   - In the near-darkness, faintly visible:
     - Email address in parchment
     - GitHub in parchment
   - Below, in Cormorant italic, slightly brighter: "I'm always interested in talking to people who take these problems seriously."
   - Below that, in small parchment caps: "BOGOTÁ, COLOMBIA"
   - The page ends by the light SLOWLY FADING OUT completely over the last 100px of scroll — returning to the void
   - The last thing visible before total black: a single period. "."

### Interactions & Animation:
- Light pools fade in as sections enter the viewport (Intersection Observer with opacity transitions)
- The DARK GAPS between sections are critical — do not skip them. The user must scroll through darkness.
- Dust particles in the hero: implement with a lightweight canvas overlay — 20-30 tiny dots (1-2px, opacity 0.1-0.3, warm gold color) drifting very slowly in random directions within the light pool area
- Candlelight flicker: CSS animation on the light gradient layers — subtle opacity oscillation (0.93-1.0) with randomized keyframes
- Gold text glow: text-shadow with 2-3 layered gold shadows at different blur radii
- Embossed text effect in manifesto: text-shadow simulating top-left light source (light color offset upper-left, dark color offset lower-right)
- Frame reveal in project rooms: the gold border draws itself (animated border using CSS) when the section enters view
- Scroll behavior should be smooth but NOT snap-scrolling — let the user control their pace through the darkness
- All animations are SLOW. Nothing moves fast. This is a cathedral, not a nightclub.
- On mobile: light pools simplify (fewer layered gradients) but maintain the darkness-to-light rhythm

### Technical:
- Single index.html with embedded or cleanly separated CSS/JS
- HEAVY use of CSS gradients — radial-gradient for light pools, layered for depth
- CSS custom properties for all colors (easy to adjust warmth, intensity)
- Canvas element for dust particles (positioned over the hero, pointer-events: none)
- Google Fonts CDN for Cormorant Garamond
- Intersection Observer for scroll-triggered light reveals
- CSS animations for flicker and glow effects
- NO frameworks — vanilla HTML/CSS/JS
- Test in dark rooms — this site should look incredible with the lights off
- Responsive: on mobile, light pools center (instead of upper-left bias) and text scales down, but black space between sections remains proportional
- Code well-commented, organized by "room"/section

### The Feeling:
This site should make someone hold their breath. The darkness isn't empty — it's full of weight and reverence. The light doesn't decorate — it REVEALS. Each scroll through blackness builds anticipation. Each illuminated section feels earned, like you walked through a dark corridor to find it. It says: "The things I work on live in darkness — not because they're hidden, but because most people haven't looked yet. I'm here with a light."
