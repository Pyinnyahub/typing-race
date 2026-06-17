# TypingRace /dev

A single-file, zero-dependency typing trainer that helps you **practice typing and learn to code at the same time** — built for the AI-engineering path.

🎮 **Play it live:** https://pyinnyahub.github.io/typing-race/

## Features

- **Code lessons** — type real, idiomatic code snippets character by character (symbols, indentation, `Enter` for new lines; indentation auto-skips). The run **finishes the moment you complete the snippet** — no waiting for a timer.
- **269 lessons** across **Python, SQL, Bash, TypeScript, JavaScript**, each at **Beginner → Intermediate → Advanced**, pedagogically ordered, every lesson with a one-line explanation.
- **Lesson menu** — pick a language, browse a clean scrollable list of numbered lessons by level, and jump straight in.
- **Step-by-step flow** — **Previous / Try Again / Next** navigation that crosses level boundaries (Beginner → Intermediate → Advanced), plus an **All · in order** run.
- **Learn while you type** — a concept banner names what each snippet teaches; click it for an explanation.
- **Race modes** — a **Mix all** code race and an **English words** race, timed (15s / 30s / 60s / 120s).
- **Best scores** saved per lesson / level / race in your browser's `localStorage`.
- **Progress dashboard** — day streak, lessons completed per language, best WPM, runs, days played.
- **Run your code** — for Python / JavaScript / SQL lessons, edit the snippet and **run it live in the browser** (Pyodide / a sandboxed Worker / sql.js, all lazy-loaded) to see real output.
- **Spaced repetition** — completed lessons are scheduled for review at growing intervals (1 → 2 → 4 → 8 → 16 → 32 days); a **🔁 Review** button surfaces what's due.
- **⌨ Weak-key drill** — the app tracks the characters you miss most and generates a drill dense in exactly those keys (keybr-style).
- **👻 Ghost pacer** — optionally race your own best pace, with a live in-stream ghost marker and an ahead/behind indicator (SpeedTyper-style).
- **✎ Your own code** — paste any snippet, pick a language, and practice typing it; it's remembered locally and supports Edit & run (SpeedCoder-style).

## Run it

It's a single HTML file with no build step and no dependencies. Either:

- Open `index.html` directly in any browser, **or**
- Serve it: `python3 -m http.server` then visit `http://localhost:8000`.

## Privacy

**This app collects nothing.** There are no accounts, no servers, no analytics, and no tracking. Everything you type stays in your browser, and your best scores are stored only in your own browser's `localStorage`. Clearing your browser data removes them. Nothing ever leaves your device.

## Tech

Plain HTML + CSS + vanilla JavaScript. No frameworks, no backend, no dependencies — works offline.

## Contributing

Lessons live in the `<script type="application/json" id="curriculumData">` block in `index.html` (each lesson is `{title, code, explain}`). Contributions of new lessons are welcome under the content license below.

## License

- **Code** — [MIT](LICENSE).
- **Lesson content** (titles, code snippets, explanations) — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

See [LICENSE](LICENSE) for details.
