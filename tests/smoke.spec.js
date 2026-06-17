// @ts-check
const { test, expect } = require("@playwright/test");
const path = require("path");

const FILE = "file://" + path.resolve(__dirname, "..", "index.html");

// Drive the typing engine by reading the caret's expected glyph and dispatching
// the matching keydown, until the run finishes. Returns true if results showed.
async function autotype(page) {
  return page.evaluate(async () => {
    const cap = document.getElementById("capture");
    const press = (k) => cap.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
    for (let i = 0; i < 2000; i++) {
      const c = document.getElementById("crt");
      if (!c) break;
      const ch = c.textContent;
      press(ch === "↵" ? "Enter" : ch);
      if (!document.getElementById("resultPanel").classList.contains("hidden")) return true;
    }
    return !document.getElementById("resultPanel").classList.contains("hidden");
  });
}

test("loads with no console or page errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto(FILE);
  await expect(page.locator("#setupPanel")).toBeVisible();
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});

test("curriculum parses and the menu lists lessons", async ({ page }) => {
  await page.goto(FILE);
  await page.click("#startBtn"); // code + Python -> lesson menu
  await expect(page.locator("#menuPanel")).toBeVisible();
  const count = await page.locator("#menuList [data-lesson]").count();
  expect(count).toBeGreaterThan(10); // "all" + many lessons
});

test("a lesson completes and shows the results nav", async ({ page }) => {
  await page.goto(FILE);
  await page.click("#startBtn");
  await page.click('#menuList [data-lesson="0"]');
  await expect(page.locator("#gamePanel")).toBeVisible();
  expect(await autotype(page)).toBe(true);
  await expect(page.locator("#resultPanel")).toBeVisible();
  await expect(page.locator("#navWrap")).toBeVisible(); // Previous / Try Again / Next
  await expect(page.locator("#menuBtn")).toBeVisible();
});

test("Next advances to the following lesson", async ({ page }) => {
  await page.goto(FILE);
  await page.click("#startBtn");
  await page.click('#menuList [data-lesson="0"]');
  await autotype(page);
  await page.click("#nextBtn");
  await expect(page.locator("#gamePanel")).toBeVisible();
  await expect(page.locator("#conceptName")).toContainText("Lesson 2");
});

test("English mode is a timed race", async ({ page }) => {
  await page.goto(FILE);
  await page.click('#modes [data-mode="english"]');
  await expect(page.locator("#timeWrap")).toBeVisible();
  await page.click("#startBtn");
  await expect(page.locator("#gamePanel")).toBeVisible();
  await expect(page.locator("#hudTime")).toHaveText("30"); // countdown, not count-up
});

test("Enter/Esc on the menu do not launch a game", async ({ page }) => {
  await page.goto(FILE);
  await page.click("#startBtn"); // menu open
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.locator("#menuPanel")).toBeVisible();
  await expect(page.locator("#gamePanel")).toBeHidden();
});

test("completing a lesson records progress (streak + done mark)", async ({ page }) => {
  await page.goto(FILE);
  await page.click("#startBtn");
  await page.click('#menuList [data-lesson="0"]');
  await autotype(page);
  await expect(page.locator("#resultPanel")).toBeVisible();
  // back to setup via the menu's Languages button
  await page.click("#menuBtn");
  await expect(page.locator('#menuList .lesson-item[data-lesson="0"]')).toHaveClass(/done/);
  await page.click("#menuHome");
  await expect(page.locator("#setupPanel")).toBeVisible();
  await expect(page.locator("#streakBadge")).toBeVisible();
});

test("output box shows for a lesson that prints", async ({ page }) => {
  await page.goto(FILE);
  // find the Python beginner "Print output" lesson index, play it, expect the output box
  const i = await page.evaluate(() => {
    const C = JSON.parse(document.getElementById("curriculumData").textContent);
    return C.python.beginner.findIndex((l) => l.title === "Print output");
  });
  await page.click("#startBtn");
  await page.click(`#menuList [data-lesson="${i}"]`);
  await autotype(page);
  await expect(page.locator("#outBox")).toBeVisible();
  await expect(page.locator("#outPre")).toHaveText("Hello, world!");
});

test("output box hidden for a definition-only lesson", async ({ page }) => {
  await page.goto(FILE);
  const i = await page.evaluate(() => {
    const C = JSON.parse(document.getElementById("curriculumData").textContent);
    return C.typescript.beginner.findIndex((l) => !l.output);
  });
  await page.click('#langs [data-lang="typescript"]');
  await page.click("#startBtn");
  await page.click(`#menuList [data-lesson="${i}"]`);
  await autotype(page);
  await expect(page.locator("#resultPanel")).toBeVisible();
  await expect(page.locator("#outBox")).toBeHidden();
});

test("playground runs edited JavaScript live", async ({ page }) => {
  await page.goto(FILE);
  const i = await page.evaluate(() => {
    const C = JSON.parse(document.getElementById("curriculumData").textContent);
    return C.javascript.beginner.findIndex((l) => l.title === "console.log output");
  });
  await page.click('#langs [data-lang="javascript"]');
  await page.click("#startBtn");
  await page.click(`#menuList [data-lesson="${i}"]`);
  await autotype(page);
  await expect(page.locator("#editRunBtn")).toBeVisible();
  await page.click("#editRunBtn");
  await expect(page.locator("#playPanel")).toBeVisible();
  await page.fill("#playCode", 'console.log("hi", 2 + 2)');
  await page.click("#runBtn");
  await expect(page.locator("#playOut")).toHaveText("hi 4");
  await page.click("#playBack");
  await expect(page.locator("#resultPanel")).toBeVisible();
});

test("Edit & run is hidden for Bash (no in-browser runtime)", async ({ page }) => {
  await page.goto(FILE);
  await page.click('#langs [data-lang="bash"]');
  await page.click("#startBtn");
  await page.click('#menuList [data-lesson="0"]');
  await autotype(page);
  await expect(page.locator("#resultPanel")).toBeVisible();
  await expect(page.locator("#editRunBtn")).toBeHidden();
});

test("spaced repetition: completion schedules a card and review session runs", async ({ page }) => {
  await page.goto(FILE);
  await page.click("#startBtn");
  await page.click('#menuList [data-lesson="0"]');
  await autotype(page);
  const card = await page.evaluate(() => JSON.parse(localStorage.getItem("typingRaceStats_v1")).srs["python|beginner|0"]);
  expect(card).toBeTruthy();
  expect(card.box).toBeGreaterThanOrEqual(1); // a clean pass advances the box
  // make a card overdue, reload, run the review session
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("typingRaceStats_v1"));
    s.srs["python|beginner|1"] = { box: 0, interval: 1, due: "2000-01-01", acc: 80 };
    localStorage.setItem("typingRaceStats_v1", JSON.stringify(s));
  });
  await page.reload();
  await expect(page.locator("#reviewBtn")).toBeVisible();
  await expect(page.locator("#reviewBtn")).toContainText("Review (");
  await page.click("#reviewBtn");
  await expect(page.locator("#gamePanel")).toBeVisible();
  await autotype(page);
  await expect(page.locator("#resultHint")).toContainText("Review 1 /");
  await page.click("#nextBtn"); // only one due -> finishes -> setup
  await expect(page.locator("#setupPanel")).toBeVisible();
});

test("Home button returns to setup from results", async ({ page }) => {
  await page.goto(FILE);
  await page.click("#startBtn");
  await page.click('#menuList [data-lesson="0"]');
  await autotype(page);
  await expect(page.locator("#resultPanel")).toBeVisible();
  await page.click("#homeBtn");
  await expect(page.locator("#setupPanel")).toBeVisible();
});

test("clicking the title returns home mid-game", async ({ page }) => {
  await page.goto(FILE);
  await page.click("#startBtn");
  await page.click('#menuList [data-lesson="0"]');
  await expect(page.locator("#gamePanel")).toBeVisible();
  await page.click("#homeLink");
  await expect(page.locator("#setupPanel")).toBeVisible();
  await expect(page.locator("#gamePanel")).toBeHidden();
});

test("progress dashboard opens with stats", async ({ page }) => {
  await page.goto(FILE);
  await page.click("#progressBtn");
  await expect(page.locator("#statsPanel")).toBeVisible();
  await expect(page.locator("#statsBody .stat-card")).toHaveCount(6);
  await expect(page.locator("#statsBody .pbar-row")).toHaveCount(5); // one per language
});

// Seed the stats blob, then reload so the app picks it up from localStorage.
async function seedStats(page, patch) {
  await page.goto(FILE);
  await page.evaluate((p) => {
    const s = JSON.parse(localStorage.getItem("typingRaceStats_v1") || "{}");
    Object.assign(s, p);
    localStorage.setItem("typingRaceStats_v1", JSON.stringify(s));
  }, patch);
  await page.reload();
}

test("weak-key drill: dashboard chips + drill button launch a timed drill", async ({ page }) => {
  await seedStats(page, { keys: { "{": { miss: 5, total: 10 }, "}": { miss: 4, total: 10 }, ";": { miss: 6, total: 12 } } });
  await expect(page.locator("#drillBtn")).toBeVisible(); // 3 weak keys -> setup shortcut shows
  await page.click("#progressBtn");
  await expect(page.locator("#statsBody .key-chip")).toHaveCount(3);
  await page.click("#weakDrillBtn");
  await expect(page.locator("#gamePanel")).toBeVisible();
  await expect(page.locator("#hudTime")).toHaveText("30"); // drill is a timed run
  await expect(page.locator("#gameHint")).toContainText("miss");
});

test("drill button is hidden without enough weak-key data", async ({ page }) => {
  await page.goto(FILE);
  await expect(page.locator("#drillBtn")).toBeHidden();
});

test("ghost pacer toggle persists and shows a vs-best HUD when a best exists", async ({ page }) => {
  await page.goto(FILE);
  await page.click("#ghostBtn");
  await expect(page.locator("#ghostBtn")).toContainText("On");
  await expect(page.locator("#ghostBtn")).toHaveClass(/on/);
  await page.reload();
  await expect(page.locator("#ghostBtn")).toContainText("On"); // remembered
  // a best for python beginner lesson 0 makes the ghost active for that run
  await page.evaluate(() => localStorage.setItem("typingRaceDevBest_code_python_beginner_L0", "40"));
  await page.click("#startBtn");
  await page.click('#menuList [data-lesson="0"]');
  await expect(page.locator("#gamePanel")).toBeVisible();
  await expect(page.locator("#hudGhostWrap")).toBeVisible();
});

test("ghost HUD stays hidden when no best exists yet", async ({ page }) => {
  await page.goto(FILE);
  await page.click("#ghostBtn"); // on, but no stored best for this lesson
  await page.click("#startBtn");
  await page.click('#menuList [data-lesson="0"]');
  await expect(page.locator("#gamePanel")).toBeVisible();
  await expect(page.locator("#hudGhostWrap")).toBeHidden();
});

test("own-code mode: paste, practice, edit & run, and remember it", async ({ page }) => {
  await page.goto(FILE);
  await page.click('#modes [data-mode="custom"]');
  await expect(page.locator("#langWrap")).toBeHidden();
  await page.click("#startBtn");
  await expect(page.locator("#customPanel")).toBeVisible();
  await page.click('#customLangs [data-clang="javascript"]');
  await page.fill("#customCode", 'console.log("hi")');
  await page.click("#customStart");
  await expect(page.locator("#gamePanel")).toBeVisible();
  await expect(page.locator("#conceptName")).toContainText("Your code");
  expect(await autotype(page)).toBe(true);
  await expect(page.locator("#resultPanel")).toBeVisible();
  await expect(page.locator("#resBest")).toContainText("Your code");
  await expect(page.locator("#editRunBtn")).toBeVisible(); // JS is runnable
  // remembered across reloads
  await page.reload();
  await page.click('#modes [data-mode="custom"]');
  await page.click("#startBtn");
  await expect(page.locator("#customCode")).toHaveValue('console.log("hi")');
});

test("own-code Edit & run executes the pasted JavaScript", async ({ page }) => {
  await page.goto(FILE);
  await page.click('#modes [data-mode="custom"]');
  await page.click("#startBtn");
  await page.click('#customLangs [data-clang="javascript"]');
  await page.fill("#customCode", 'console.log(2 + 5)');
  await page.click("#customStart");
  await autotype(page);
  await page.click("#editRunBtn");
  await expect(page.locator("#playPanel")).toBeVisible();
  await page.click("#runBtn");
  await expect(page.locator("#playOut")).toHaveText("7");
});

test("backspace + retype counts a key once (no weak-key double-count)", async ({ page }) => {
  await page.goto(FILE);
  await page.click('#modes [data-mode="custom"]');
  await page.click("#startBtn");
  await page.fill("#customCode", "xy");
  await page.click("#customStart");
  await page.evaluate(() => {
    const cap = document.getElementById("capture");
    const k = (key) => cap.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    k("z"); k("Backspace"); k("x"); k("y"); // fumble, correct, finish
  });
  await expect(page.locator("#resultPanel")).toBeVisible();
  const keys = await page.evaluate(() => JSON.parse(localStorage.getItem("typingRaceStats_v1")).keys);
  expect(keys["x"]).toEqual({ miss: 0, total: 1 }); // committed once, final state is correct
  expect(keys["y"]).toEqual({ miss: 0, total: 1 });
});

test("drill/custom runs do not inflate the global Best WPM", async ({ page }) => {
  await seedStats(page, { bestWpm: 7 });
  await page.click('#modes [data-mode="custom"]');
  await page.click("#startBtn");
  await page.fill("#customCode", "ab");
  await page.click("#customStart");
  await autotype(page);
  await expect(page.locator("#resultPanel")).toBeVisible();
  const best = await page.evaluate(() => JSON.parse(localStorage.getItem("typingRaceStats_v1")).bestWpm);
  expect(best).toBe(7); // a custom run must not change the headline Best WPM
});

test("own-code result says 'Practice again', not 'Race again'", async ({ page }) => {
  await page.goto(FILE);
  await page.click('#modes [data-mode="custom"]');
  await page.click("#startBtn");
  await page.fill("#customCode", "ab");
  await page.click("#customStart");
  await autotype(page);
  await expect(page.locator("#againBtn")).toContainText("Practice again");
});

test("Next button label resets after a review session", async ({ page }) => {
  await seedStats(page, { srs: { "python|beginner|1": { box: 0, interval: 1, due: "2000-01-01", acc: 80 } } });
  await page.click("#reviewBtn");
  await autotype(page);
  await expect(page.locator("#nextBtn")).toContainText("Finish review");
  await page.click("#nextBtn"); // finishes review -> setup
  await expect(page.locator("#setupPanel")).toBeVisible();
  await page.click("#startBtn");
  await page.click('#menuList [data-lesson="0"]'); // a non-last single lesson
  await autotype(page);
  await expect(page.locator("#nextBtn")).toContainText("Next");
  await expect(page.locator("#nextBtn")).not.toContainText("Finish review");
});
