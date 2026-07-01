# Carpet

A local-first capture panel for Mac, docked to the right edge of your screen.
Drag a file or image onto it and it's saved instantly; copy an article and it
offers to keep it. Everything lives on your machine, and an optional local AI
(via [Ollama](https://ollama.com)) lets you search your Carpet by meaning
instead of exact text — "find that article about the early Facebook engineer"
instead of remembering a name.

## How it works

- **A thin strip sits at the right edge of your screen**, always there,
  always on top. Hover over it (or drag something toward it) and it expands
  into a full board.
- **Drag any file or image from anywhere** — Finder, a browser, another app —
  toward the right edge, and the panel opens and accepts the drop immediately.
- **Copy text or a link** anywhere and the panel pops open with a "Keep this?"
  card for 3 seconds. Click Keep, or ignore it and it's discarded — nothing is
  saved without you saying so.
- **The board is a Pinterest-style masonry layout**: images at their natural
  aspect ratio, text/links/code as colored note cards, files as compact icon
  cards. Search narrows it instantly.
- Click the pin icon (or press `Cmd+Shift+L`) to keep the panel open instead
  of auto-collapsing when your mouse leaves.
- Everything is stored under `~/Library/Application Support/Carpet/` as plain
  JSON + copied files. No network calls happen unless you enable local AI, and
  even then it only talks to `localhost`.

## Local AI (optional, recommended)

Carpet never bundles or downloads a model itself — that's what made the
previous prototype too large to fit in git. Instead it talks to
[Ollama](https://ollama.com), which you install once, separately:

```bash
brew install ollama
ollama serve            # or just open the Ollama app once, it runs in the background

ollama pull nomic-embed-text   # powers semantic search
ollama pull moondream          # describes images you drop in, so they're searchable
ollama pull llama3.2           # answers questions in the "Ask" box
```

If Ollama isn't running, or a model isn't pulled, Carpet falls back to plain
keyword search automatically — nothing breaks, you just lose the "search by
vague memory" and "ask a question" features until it's available. You can
change the base URL or model names from the gear icon in the panel.

## Running it

```bash
npm install
npm run dev      # launches the app with hot reload
```

## Building the .dmg

```bash
npm run dist
```

This produces an unsigned `Carpet.dmg` in `dist/`. Since it isn't
notarized, the first launch will need a right-click → Open (or an
`xattr -cr /Applications/Carpet.app` if Gatekeeper blocks it outright).

## Notes on this build

- The panel's collapsed/expanded widths and hover-intent delays live in
  `src/main/index.js` (`COLLAPSED_WIDTH`, `EXPANDED_WIDTH`, the two
  `setTimeout` delays in the hover handlers) — tweak those if the reveal feels
  too eager or too sluggish on your actual hardware. This was built and
  compiled in a Linux sandbox with no display, so the exact feel hasn't been
  visually verified.
- The first time it reads clipboard/frontmost-app info, macOS may prompt for
  permissions — grant them in System Settings → Privacy & Security.
