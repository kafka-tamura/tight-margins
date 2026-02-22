# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tight Margins** is a LinkedIn carousel builder that enforces a strict design system. It's a single-page React application that generates pixel-perfect 1080×1080px slides following specific typographic and layout constraints, then exports them as a multi-page PDF for LinkedIn upload.

The design philosophy: constraints as creative fuel. No images, no custom colors, locked templates, enforced character limits.

## Commands

```bash
# Development
npm install                # Install dependencies
npm run dev               # Start dev server at http://localhost:5173/tight-margins/

# Production
npm run build             # Build for production → dist/
npm run preview           # Preview production build locally
```

## Architecture

### Single-File Structure

The entire application lives in a single React component (`src/App.jsx`, ~1000 lines) organized into sections:

1. **Design System Constants** (`C` object): Colors, dimensions, spacing rules
2. **Template Definitions** (`TEMPLATES` object): 7 slide types with field configurations
3. **Sequence Patterns** (`SEQUENCES` object): 3 guided carousel blueprints
4. **Canvas Drawing Helpers**: Functions for rendering ruled lines, margin lines, text wrapping, emphasis
5. **Slide Renderers** (`renderers` object): Canvas drawing logic for each template type
6. **React Components**: `SlideCanvas`, `FieldEditor`, main `App`
7. **PDF Export**: jsPDF-based multi-page export

### Core Design System (`C` constant)

All dimensions, colors, and spacing are centralized in the `C` object (lines 7-24):
- **Canvas**: Always 1080×1080px
- **Red margin line**: x=144px (visible design signature)
- **Content zone**: x=176 to x=1016
- **Cover slide**: "Corridor" layout with dark bands at 0-280px and 800-1080px
- **Ruled lines**: Horizontal guides every 32px starting at y=64
- **Color palette**: Paper (`#F0EDEA`), Ink (`#2A2A2A`), Red (`#C83232`), Dark (`#333333`), Grey (`#D0CCC8`)

### Template System

Each template has:
- A render function in the `renderers` object
- Field definitions with character limits and placeholders
- Specific typographic treatment (Inter Tight for headlines, Newsreader for body, JetBrains Mono for data)

The 7 templates:
1. **Cover (Corridor)**: Dark bands, central lit channel, red margin line at x=280
2. **Single Concept**: Headline + body with optional emphasis (bold+underline)
3. **Comparison**: Two-column layout with optional VS label
4. **Framework/Diagram**: Grid of labeled boxes (up to 8)
5. **Punchline**: Vertically centered text with optional red emphasis
6. **Data/Evidence**: Large data point + context + source
7. **Closing CTA**: Full dark background, subscription call-to-action

### Sequence Patterns

Three pre-built carousel flows in `SEQUENCES`:
- **The Argument** (8-10 slides): Frameworks and structured insights
- **The Hot Take** (6-8 slides): Provocative claim with sharp observation
- **The Case Study** (8-12 slides): Real-world decision analysis

Each sequence has locked positions for Cover (always first) and CTA (always last).

### Canvas Rendering

All slides render to HTML5 `<canvas>` elements at 1080×1080px resolution:
- `SlideCanvas` component manages canvas lifecycle via `useEffect`
- Each template renderer receives `(ctx, data, slideNum)`
- Text rendering uses custom wrapText and drawTextWithEmphasis helpers
- Font loading from Google Fonts (see `index.html`)

### PDF Export (`exportPDF` function, lines 570-602)

- Creates offscreen canvas at 2x scale (2160×2160px) for quality
- Renders each slide with appropriate renderer
- Uses jsPDF to create multi-page PDF at 540×540pt (effective 288 DPI)
- Excludes slide numbers from cover, CTA, and punchline templates

### State Management

Plain React `useState`:
- `slides`: Array of `{template, locked, note, data}` objects
- `selectedIdx`: Current slide being edited
- `previewMode`: Boolean for preview vs. editor view
- `canvasSize`: Responsive canvas display size
- Auto-saves to localStorage under key `tm-carousel`

### Design Constraints (Enforced in UI)

- Carousel must be 6-12 slides
- Cover always at position 0 (locked)
- CTA always at last position (locked)
- Character limits on all text fields
- Cover and CTA cannot change templates
- Slides 2 through n-1 can be reordered

## Key Implementation Details

### Canvas Text Rendering

`wrapText(ctx, text, x, y, maxWidth, lineHeight)` (lines 166-185):
- Word-by-word measurement for line breaking
- Returns line count for vertical spacing calculations

`drawTextWithEmphasis(ctx, text, emphasisWord, x, y, maxWidth, lineHeight, emphColor)` (lines 187-243):
- Detects emphasis words (case-insensitive, punctuation-tolerant)
- Renders emphasized words in bold with underline
- Used in Single Concept template for body text

### Font Loading

All fonts loaded via Google Fonts in `index.html`:
- Inter Tight (weights: 400, 500, 600, 700, 800, 900)
- JetBrains Mono (weights: 400, 500, 700)
- Newsreader (optical sizing, weights: 400, 500, 600, italic variants)

Canvas renderers assume fonts are loaded. No explicit font load detection.

### Deployment Configuration

GitHub Pages deployment:
- Set `base: '/tight-margins/'` in `vite.config.js` (or `'/'` for custom domain)
- Public folder contains `.nojekyll` to bypass Jekyll processing
- Build output goes to `dist/`

## Common Modifications

### Adding a New Template

1. Add template definition to `TEMPLATES` object with field specs
2. Implement renderer function in `renderers` object
3. Add template key to dropdown filter (lines 957-959) if it should be user-selectable

### Adjusting Design System

All visual constants live in the `C` object (lines 7-24). Changes propagate automatically to all renderers.

### Changing Canvas Resolution

- Update `C.slide` constant (currently 1080)
- Adjust PDF export `scale` factor and `pageSize` calculation (lines 571-583) to maintain DPI

### Modifying Character Limits

Edit `max` values in `TEMPLATES` field definitions. Limits are enforced in `FieldEditor` component with visual feedback.

## Testing Notes

No automated tests. Manual testing workflow:
1. Run `npm run dev`
2. Select a sequence or start custom
3. Fill fields, verify canvas renders correctly
4. Use Preview mode to navigate full carousel
5. Export PDF and verify output quality/layout
