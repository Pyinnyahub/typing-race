# TypingRace /dev

A single-file, zero-dependency typing trainer that helps you **practice typing and learn to code at the same time** — built for the AI-engineering path.

🎮 **Live demo:** _enable GitHub Pages, then your URL appears here_

## Features

- **Code mode** — type real, idiomatic code snippets character by character (symbols, indentation, `Enter` for new lines, indentation auto-skips).
- **Languages** — Python, SQL, Bash, TypeScript, JavaScript, plus a *Mix all* option.
- **Levels** — Beginner → Intermediate → Advanced, so you grow with the material.
- **Learn while you type** — a concept banner shows what each snippet teaches; click it for a one-line explanation.
- **Live stats** — countdown timer, WPM, accuracy, and character count.
- **English words mode** — classic timed word race for pure speed practice.
- **Best scores** saved per language + level in `localStorage`.
- Time options: 15s / 30s / 60s / 120s.

## Run it

It's a single HTML file with no build step and no dependencies. Either:

- Open `index.html` directly in any browser, **or**
- Serve it: `python3 -m http.server` then visit `http://localhost:8000`.

## Tech

Plain HTML + CSS + vanilla JavaScript. No frameworks, no backend — works offline.

## License

MIT
