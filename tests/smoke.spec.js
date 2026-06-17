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
