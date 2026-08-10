# Lateral Notes Extraction

Date: 2026-05-14

## Reference

Source inspected: https://notes.andymatuschak.org/

Key implementation cues from the rendered page:

- Fixed white header, 44px-ish minimum height, light bottom border.
- Page background `#fafafc`; note panes use white backgrounds.
- Desktop notes are horizontally arranged fixed-width columns, about 625px wide.
- Columns use sticky positioning while the horizontal scroller moves, leaving narrow vertical labels for obscured notes.
- Note content uses system UI typography, 17px body text, 24px line height, 28px note titles, blue internal links, purple visited links.
- Links to notes append a pane instead of replacing the current page; already-open note links are highlighted.
- Backlinks live in a pale footer panel inside each note.

## Local Extraction

Moved the inactive note-stack implementation out of production `src/` into `lateral-notes/` as a standalone Vite app:

- `lateral-notes/src/App.jsx` owns the note stack, hash navigation, horizontal scroll geometry, and hover preview state.
- `lateral-notes/src/NotePane.jsx`, `HoverPreview.jsx`, and `notes.js` keep the existing content model and renderer.
- `lateral-notes/src/styles.css` is now Andy-inspired instead of inheriting the personal homepage palette.
- `lateral-notes/package.json` and `lateral-notes/vite.config.js` make the folder movable into a separate project.

Production `src/App.jsx` now renders only the personal landing page, and `src/styles.css` no longer contains the note stack CSS.

## Verification

- `yarn build`
- `yarn notes:build`
- Opened `http://127.0.0.1:3074/`
- Browser smoke test: opened default note, clicked "How I work", verified URL hash changed to `#about-these-notes/how-i-work`.
- Browser console check after favicon fix: 0 errors, 0 warnings.
