# Carpet

A local-first "notch" utility for Mac. Copy an article and it offers to keep
it; drag a file or image onto the notch and it's saved instantly. Everything
lives on your machine, and an optional local AI (via [Ollama](https://ollama.com))
lets you search your Carpet by meaning instead of exact text — "find that
article about the early Facebook engineer" instead of remembering a name.

## How it works

- **A small pill sits at the top-center of your screen**, right where the
  MacBook notch is. It's always there, always on top.
- **Copy text or a link** anywhere and a "Keep this?" prompt appears on the
  notch for 3 seconds. Click Keep, or ignore it and it's discarded — nothing
  is saved without you saying so.
- **Drag a file, image, or document onto the notch** and it's copied into
  your local Carpet library immediately.
- **Click the notch** (or press `Cmd+Shift+L`) to open the Library — a
  searchable grid of everything you've saved.
- Everything is stored under
  `~/Library/Application Support/Carpet/` as plain JSON + copied files. No
  network calls happen unless you enable local AI, and even then it only
  talks to `localhost`.

## Local AI (optional, recommended)

Carpet never bundles or downloads a model itself — that's what made the
previous prototype too large to fit in git. Instead it talks to
[Ollama](https://ollama.com), which you install once, separately:

```bash
brew install ollama
ollama serve            # or just open the Ollama app once, it runs in the background

ollama pull nomic-embed-text   # powers semantic search
ollama pull moondream          # describes images you drop in, so they're searchable
ollama pull llama3.2           # answers questions in the Library's "Ask" box
```

If Ollama isn't running, or a model isn't pulled, Carpet falls back to plain
keyword search automatically — nothing breaks, you just lose the "search by
vague memory" and "ask a question" features until it's available. You can
change the base URL or model names from the gear icon in the Library window.

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

- Drag-and-drop and the exact notch alignment (the pill's size sits close to
  a 14"/16" MacBook Pro notch, but hasn't been pixel-tuned against real
  hardware) will likely need a pass of manual tweaking on your actual
  machine — this was built and compiled in a Linux sandbox with no display,
  so the notch geometry, drag targeting, and macOS permission prompts
  (Accessibility, for reading the frontmost app name) haven't been visually
  verified. If it doesn't perfectly line up on your Mac, the sizes to
  tweak live in `src/main/index.js` (`NOTCH_SIZES`).
- The first time it reads clipboard/frontmost-app info, macOS may prompt for
  permissions — grant them in System Settings → Privacy & Security.
