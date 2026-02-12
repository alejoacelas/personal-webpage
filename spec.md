Build me a single-page personal website in HTML/CSS/JS with the following aesthetic and structure. Make it production-quality, visually stunning, and deployable as a static site.

## Aesthetic: "Suprematist CV"
Inspired by Kazimir Malevich, El Lissitzky, and Russian Constructivist graphic design. The site is a living geometric composition — hard-edged shapes (rectangles, circles, triangles) in primary colors floating on a white field, with content living INSIDE the shapes. It should feel like a Suprematist painting that you can read. No photographs, no gradients, no rounded corners, no softness. Just geometry, color, and conviction.

### Visual References:
- Malevich's "Suprematist Composition" paintings — floating rectangles and shapes on white
- El Lissitzky's "Beat the Whites with the Red Wedge" — dynamic diagonal compositions
- Constructivist propaganda posters — bold type, geometric layouts, diagonal energy
- The confidence of shapes that don't need to explain themselves

### Color Palette:
- Background: pure white (#FFFFFF) or very light warm gray (#F5F3EF)
- Red: strong, flat red (#D62828) — the dominant accent
- Black: true black (#000000) — for primary text and key shapes
- Blue: deep ultramarine (#1D3557) — secondary shapes
- Yellow: warm, assertive (#F4A100) — tertiary accent
- NO other colors. The constraint is the point.

### Typography:
- Primary: "Inter" or "Space Grotesk" in bold/black weight — clean, geometric, modern sans-serif
- All section labels in ALL CAPS with wide letter-spacing (0.2-0.3em)
- Some text rotated 90° and placed along the vertical edges of shapes
- Numbers should be large and prominent — used decoratively (like "01", "02" in huge faded type)
- NO serif fonts. Everything is constructed, not calligraphed.
- Text sizes should be extreme — either very large (headers) or quite small (body), with little in between

### Layout Philosophy:
- The page has NO conventional sections stacked vertically. Instead, it's a series of COMPOSITIONS — each viewport is a deliberate arrangement of shapes containing content.
- Shapes overlap, intersect, and create tension. A red rectangle might partially cover a black circle. Text flows around and inside these collisions.
- The grid is intentionally broken. Shapes are placed at angles (15°, 30°, 45° rotations). Some text runs vertically.
- Generous white space is critical — the shapes need room to breathe and the white space IS part of the composition.
- On scroll, new compositions assemble — shapes slide, rotate, or scale into position.

### Sections (as Compositions):

1. **Composition I: Identity**
   - A large black rectangle (roughly 40vw × 25vh), rotated about 5°, positioned upper-left of center
   - Inside it, in white text: "ALEJANDRO" in massive bold type, and below it in smaller caps: "AI CONSULTANT · ECONOMIST · BUILDER"
   - A red circle (about 15vw diameter) overlapping the bottom-right corner of the rectangle
   - Inside the red circle, in white, very small text: "BOGOTÁ, COLOMBIA"
   - A thin blue line (2px) running diagonally from upper right to lower left across the entire viewport, behind everything
   - A small yellow triangle in the lower right, containing nothing — purely compositional
   - On scroll-in: the rectangle slides in from the left, the circle from the bottom, the line draws itself

2. **Composition II: Manifesto**
   - Header: "WHAT I BELIEVE" in black, rotated 90° and pinned to the left edge of the viewport
   - Three statements, each inside its own shape:
     - A tall red rectangle (vertical, ~15vw × 40vh): "Biosecurity is the most neglected existential risk of our time."
     - A blue square (~20vw × 20vw), overlapping the red: "Open-source tools can make the world meaningfully safer."
     - A black circle (~18vw diameter), overlapping both: "The gap between AI capability and AI governance grows every day. I work in that gap."
   - Text inside each shape is white, centered, with generous padding
   - The shapes should create a dynamic cluster — not aligned, not symmetric, but BALANCED in the way a painting is balanced
   - A yellow horizontal line bisects the viewport behind the shapes

3. **Composition III: The Work**
   - "THE WORK" in huge faded gray type (like 20vw font size, opacity 0.08) as a background element
   - Four project blocks, each a different shape:
     - **Cliver**: Red rectangle, ~30vw wide, slight rotation. Contains project name in large bold white type, description below in smaller text: "An open-source AI tool for KYC screening in DNA synthesis. Making it harder to misuse biology." Tags at the bottom: "BIOSECURITY · OPEN SOURCE · AI"
     - **Frontiers Evals**: Black rectangle, overlapping Cliver slightly. "Research on evaluating frontier AI systems for dangerous capabilities." Tags: "AI SAFETY · RESEARCH · EVALUATION"
     - **ML4Good**: Blue square. "Teaching machine learning for social impact across Latin America." Tags: "EDUCATION · ML · LATIN AMERICA"
     - **EU AI Act Advisory**: Yellow rectangle with black text (the exception). "Providing technical input to shape AI governance in Europe." Tags: "POLICY · GOVERNANCE · EUROPE"
   - Each shape enters the viewport from a different direction on scroll
   - On hover, shapes lift slightly (translateZ / scale) and other shapes recede in opacity

4. **Composition IV: The Path**
   - A timeline, but NOT conventional. Instead:
   - A long diagonal red line running from upper-left to lower-right across the viewport (this is the "timeline")
   - Key moments are placed as small shapes ALONG this diagonal:
     - A small black circle at the top: "AGE 16 — DISCOVERED EA" (text beside it, rotated to follow the diagonal)
     - A small blue rectangle further down: "UNIVERSIDAD DE LOS ANDES — ECONOMICS"
     - A small red square: "OXFORD — GROUP HOUSES, COMMUNITY, RESEARCH"
     - A small yellow triangle: "BOGOTÁ — CLIVER, ML4GOOD, CONSULTING"
     - A larger black circle at the bottom: "NOW"
   - All text follows the diagonal angle, creating a unified compositional flow
   - The diagonal line draws itself on scroll

5. **Composition V: Now**
   - "RIGHT NOW" in black caps, centered
   - A single large red rectangle, centered, containing:
     - Current focus items in white text, cleanly stacked:
     - "Building Cliver. Customer development. Cold outreach."
     - "Teaching ML4Good bootcamps."
     - "Writing about AI safety."
   - The rectangle is the only element — stark, isolated, demanding attention
   - A single thin black circle surrounds it at a distance, like an orbit

6. **Composition VI: Contact**
   - Almost empty viewport — maximum white space
   - A small black square in the exact center containing:
     - Email address in white
     - GitHub link in white
   - Below the square, in small black text: "I reduce complex problems to their essential forms."
   - A tiny red dot in the upper right corner and a tiny blue dot in the lower left — the composition in its most minimal state
   - The page ends.

### Interactions & Animation:
- Shapes should animate into position on scroll — sliding, rotating, scaling. Use Intersection Observer.
- Animations should be MECHANICAL, not organic. Linear or ease-in-out timing, no bouncing, no wobble. These are geometric objects, they move with precision.
- On hover, shapes respond subtly — slight scale increase (1.02), slight shadow, slight opacity change in neighboring shapes
- Some shapes should have very subtle continuous motion — a slow rotation (like 0.5° over 10 seconds, back and forth) to make the composition feel alive
- Cursor could change to a crosshair throughout the site (reinforcing the precision/construction metaphor)

### Technical:
- Single index.html file with embedded or cleanly separated CSS/JS
- Fully responsive — on mobile, compositions should simplify (less rotation, shapes stack more vertically) but maintain the aesthetic
- Google Fonts CDN
- Vanilla HTML/CSS/JS — use CSS transforms heavily for rotations and positioning
- CSS Grid or absolute positioning within relative containers for the compositions
- Intersection Observer API for scroll-triggered animations
- Make code clean and well-commented for easy content modification

### The Feeling:
Someone visits this site and feels like they're looking at a work of art that happens to contain a career. The geometric precision communicates intellectual rigor. The bold colors communicate courage. The white space communicates confidence — there's no need to fill every pixel. It says: "I see the essential structure of things. That is what I offer."
