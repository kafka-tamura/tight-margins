# Tight Margins — Carousel Builder

LinkedIn carousel builder enforcing the Tight Margins design system.

## Features

- **7 slide templates**: Cover (Corridor), Single Concept, Comparison, Framework/Diagram, Punchline, Data/Evidence, Closing CTA
- **3 guided sequences**: The Argument, The Hot Take, The Case Study
- **Design constraints enforced**: Character limits, 6–12 slide range, locked Cover/CTA positions, no images, no custom colors
- **Canvas rendering**: Pixel-perfect 1080×1080 output with ruled lines, red margin line, and spec-accurate typography
- **PDF export**: Multi-page PDF ready for LinkedIn upload

## Local Development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173/tight-margins/`

## Deploy to GitHub Pages

### One-time setup

1. Push this repo to GitHub
2. Go to **Settings → Pages → Source** → select **GitHub Actions**
3. Edit `vite.config.js` — set `base` to match your repo name:
   ```js
   base: '/your-repo-name/',
   ```
4. Push to `main` — the workflow auto-builds and deploys

### Custom domain

If using a custom domain, set `base: '/'` in `vite.config.js` and add a `CNAME` file in the `public/` folder.

## Design System

- **Palette**: Paper `#F0EDEA`, Ink `#2A2A2A`, Red `#C83232`, Dark `#333333`, Grey `#D0CCC8`
- **Fonts**: Inter Tight (headlines), Newsreader (body), JetBrains Mono (callouts/data)
- **Canvas**: 1080×1080px, red margin line at x=144, content starts x=176
- **Cover**: Corridor treatment — dark bands at 0–280px and 800–1080px, lit channel center
- **CTA**: Full dark background, margin line at 0.6 opacity

## Build

```bash
npm run build    # outputs to dist/
npm run preview  # preview production build locally
```
