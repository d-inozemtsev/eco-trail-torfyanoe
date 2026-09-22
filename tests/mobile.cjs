/** End-to-end mobile checks. Starts its own server and needs a Playwright browser. */
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "..");
const base = "http://127.0.0.1:8765";
const server = spawn(
  process.env.PYTHON || "python3",
  ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8765"],
  { cwd: root, stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
(async () => {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(base + "/healthz")).ok) break;
    } catch {}
    await sleep(150);
  }
  const route = await (await fetch(base + "/api/route")).json();
  browser = await chromium.launch({
    headless: true,
    ...(process.env.QA_CHROMIUM_PATH
      ? {
          executablePath: process.env.QA_CHROMIUM_PATH,
          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        }
      : {}),
  });
  let checks = 0;
  for (const width of [320, 390, 430]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
      serviceWorkers: "block",
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (request) => request.abort()); // App must survive blocked SDK and images.
    await page.goto(base);
    await page.waitForSelector(".hero");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    checks++;
    for (const station of route.stations.filter((s) => s.status === "active")) {
      await page.goto(`${base}/#station/${station.id}`);
      await page.waitForSelector("[data-block]");
      for (const block of station.blocks) {
        const section = page.locator(`[data-block="${block.id}"]`);
        await section.waitFor({ state: "visible" });
        if (block.type === "choice" || block.type === "profile_choice")
          await section.locator('[data-action="choice"]').first().click();
        if (block.type === "observation")
          await section.locator('[data-action="observe"]').first().click();
        if (block.type === "visual_quiz") {
          await section.locator('[data-action="visual"]').first().click();
          await section.locator('[data-action="submit-visual"]').click();
        }
        if (block.type === "checklist") {
          await section.locator('[data-action="check"]').first().click();
          if (block.photo && width === 390) {
            await section
              .locator("input[type=file]")
              .first()
              .setInputFiles({
                name: "find.png",
                mimeType: "image/png",
                buffer: Buffer.from(
                  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=",
                  "base64",
                ),
              });
            await section
              .locator("[data-photo-preview]")
              .first()
              .waitFor({ state: "visible" });
            checks++;
          }
        }
        if (block.type === "true_false") {
          for (let i = 0; i < block.questions.length; i++)
            await section
              .locator(
                `[data-action="truth"][data-index="${i}"][data-value="false"]`,
              )
              .click();
        }
        if (block.type === "ship_builder") {
          await section.locator('[data-action="test-ship"]').click();
          assert.match(
            await section.locator("[data-ship-feedback]").innerText(),
            /Можно читать дальше прямо сейчас/,
          );
          checks++;
          await section.locator('[data-action="solve-ship"]').click();
          assert.match(
            await section.locator("[data-ship-feedback]").innerText(),
            /Рабочий пример/,
          );
          checks++;
          await section.locator('[data-action="reset-ship"]').click();
          await section.locator('[data-part="engine"]').tap();
          await section.locator('[data-slot="hold-stern"]').tap();
          assert.equal(
            await section.locator('[data-slot="hold-stern"] b').innerText(),
            "ДВ",
          );
          checks++;
        }
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `overflow ${width} ${station.id} ${block.id}`,
        );
        checks++;
        if (block.next_block_id)
          await section.locator('[data-action="next"]:visible').last().click();
        else await section.locator('[data-action="finish"]').click();
      }
      await page.waitForSelector(".completion");
    }
    await page.locator('[data-action="result"]').click();
    await page.waitForSelector(".result");
    assert.match(await page.locator(".score-card").innerText(), /5 ответов/);
    checks++;
    const resultTitle = await page.locator(".result h1").innerText();
    await page.reload();
    await page.waitForSelector(".result");
    assert.equal(await page.locator(".result h1").innerText(), resultTitle);
    checks++;
    if (width === 390) {
      await page.screenshot({
        path: path.join(root, "docs/result-mobile.png"),
        fullPage: true,
      });
      await page.goto(base);
      await page.waitForSelector(".hero");
      await page.screenshot({
        path: path.join(root, "docs/home-mobile.png"),
        fullPage: true,
      });
    }
    assert.deepEqual(errors, []);
    checks++;
    await context.close();
  }
  // Blocked persistence should not stop rendering or progression.
  const limited = await browser.newContext({ serviceWorkers: "block" }),
    limitedPage = await limited.newPage();
  await limitedPage.route("https://**/*", (r) => r.abort());
  await limitedPage.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await limitedPage.goto(base + "/#station/lake-layers");
  await limitedPage.locator('[data-action="choice"]').first().click();
  assert.match(
    await limitedPage.locator("#notice").innerText(),
    /не разрешил сохранить/,
  );
  checks++;
  await limited.close();
  // Service worker: once installed, a full offline reload still opens route/content.
  const offline = await browser.newContext(),
    page = await offline.newPage();
  await page.route("https://**/*", (r) => r.abort());
  await page.goto(base);
  await page.waitForSelector(".hero");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForSelector(".hero");
  await offline.setOffline(true);
  await page.goto(base + "/#station/dragonfly-worlds");
  await page.waitForSelector('[data-block="watch"]');
  checks++;
  await offline.close();
  console.log(
    `PASS: ${checks} checks; complete journeys at 320/390/430px; reload, photo, storage failure, offline.`,
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    server.kill();
  });
