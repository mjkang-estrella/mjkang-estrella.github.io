// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Collects console errors and uncaught exceptions for the life of a page so
 * every test can assert the page stayed clean.
 */
const trackErrors = (page) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
        if (message.type() === "error") {
            errors.push(`console: ${message.text()}`);
        }
    });
    return errors;
};

const expectHumanView = async (page) => {
    await expect(page.locator("body")).toHaveAttribute("data-portfolio-view", "human");
    await expect(page.locator(".machine-document")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator(".machine-document")).toBeHidden();
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator('[data-view-mode="human"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-view-mode="machine"]')).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".skip-link")).toHaveAttribute("href", "#main-content");
};

const expectMachineView = async (page) => {
    await expect(page.locator("body")).toHaveAttribute("data-portfolio-view", "machine");
    await expect(page.locator(".machine-document")).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator(".machine-document")).toBeVisible();
    await expect(page.locator("#main-content")).toBeHidden();
    await expect(page.locator('[data-view-mode="machine"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-view-mode="human"]')).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".skip-link")).toHaveAttribute("href", "#machine-content");
};

/** Waits until the mode switch's view transition and any reveal motion finish. */
const expectTransitionSettled = async (page) => {
    await page.waitForFunction(() => {
        let active = false;
        try {
            active = document.documentElement.matches(":active-view-transition");
        } catch (error) {
            // Older engines lack the pseudo-class; getAnimations() still covers them.
        }
        return !active && document.getAnimations().length === 0;
    });
};

/**
 * Counts document.startViewTransition() calls so tests can prove the animated
 * path is taken when motion is allowed and skipped when it is not.
 */
const countViewTransitions = (context) =>
    context.addInitScript(() => {
        window.__viewTransitions = 0;
        const original = document.startViewTransition;
        if (typeof original === "function") {
            document.startViewTransition = function (...args) {
                window.__viewTransitions += 1;
                return original.apply(this, args);
            };
        }
    });

test.describe("view mode toggle", () => {
    test("round-trips human -> machine -> human without errors", async ({ page, context }) => {
        await countViewTransitions(context);
        const errors = trackErrors(page);
        await page.goto("/");
        expect(await page.evaluate(() => typeof document.startViewTransition)).toBe("function");
        await expectHumanView(page);

        await page.getByRole("button", { name: "Machine", exact: true }).click();
        await expectMachineView(page);
        await expect(page).toHaveURL(/\?view=machine$/);
        await expectTransitionSettled(page);

        // The machine document must be rendered from the visible page.
        const machineText = await page.locator(".machine-document").innerText();
        const projectTitles = await page.locator(".project-title").allInnerTexts();
        expect(projectTitles.length).toBeGreaterThan(0);
        for (const title of projectTitles) {
            expect(machineText).toContain(title);
        }

        await page.getByRole("button", { name: "Human", exact: true }).click();
        await expectHumanView(page);
        await expect(page).not.toHaveURL(/view=/);
        await expectTransitionSettled(page);

        // Reveal elements near the top must be visible again after the round trip.
        await expect(page.locator("#profile-title")).toHaveClass(/is-visible/);
        await expect(page.locator("#profile-title")).toHaveCSS("opacity", "1");

        expect(await page.evaluate(() => window.__viewTransitions)).toBe(2);
        expect(errors).toEqual([]);
    });

    test("honours ?view=machine on load without persisting it", async ({ page }) => {
        const errors = trackErrors(page);
        await page.goto("/?view=machine");
        await expectMachineView(page);

        // A shared link must not change the visitor's stored preference.
        await page.goto("/");
        await expectHumanView(page);
        expect(errors).toEqual([]);
    });

    test("persists an explicit toggle across reloads", async ({ page }) => {
        const errors = trackErrors(page);
        await page.goto("/");
        await page.getByRole("button", { name: "Machine", exact: true }).click();
        await expectMachineView(page);

        await page.goto("/");
        await expectMachineView(page);

        await page.getByRole("button", { name: "Human", exact: true }).click();
        await expectHumanView(page);
        await page.goto("/");
        await expectHumanView(page);
        expect(errors).toEqual([]);
    });

    test("rapid double toggle settles in the last requested mode", async ({ page }) => {
        const errors = trackErrors(page);
        await page.goto("/");
        await page.getByRole("button", { name: "Machine", exact: true }).click();
        await page.getByRole("button", { name: "Human", exact: true }).click();
        await page.getByRole("button", { name: "Machine", exact: true }).click();
        await expectMachineView(page);
        await expectTransitionSettled(page);
        expect(errors).toEqual([]);
    });
});

test.describe("motion", () => {
    test("reveals hero on load and the rest on scroll", async ({ page }) => {
        const errors = trackErrors(page);
        await page.goto("/");
        await expect(page.locator("html")).toHaveClass(/has-motion/);

        for (const element of await page.locator(".header-content [data-reveal]").all()) {
            await expect(element).toHaveClass(/is-visible/);
        }

        // An instant jump (skip link, End key, scroll restoration) must not
        // strand elements that never intersected the viewport on the way.
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        for (const element of await page.locator("[data-reveal]:not([data-machine])").all()) {
            await expect(element).toHaveClass(/is-visible/);
            await expect(element).toHaveCSS("opacity", "1");
        }

        expect(errors).toEqual([]);
    });

    test("scroll progress tracks the document", async ({ page }) => {
        await page.goto("/");
        const readProgress = () =>
            page.evaluate(() =>
                parseFloat(
                    getComputedStyle(document.documentElement).getPropertyValue("--scroll-progress")
                )
            );
        expect(await readProgress()).toBe(0);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await expect.poll(readProgress).toBeCloseTo(1, 2);
    });

    test("reduced motion renders a static, fully visible page", async ({ browser }) => {
        const context = await browser.newContext({ reducedMotion: "reduce" });
        await countViewTransitions(context);
        const page = await context.newPage();
        const errors = trackErrors(page);
        await page.goto("/");

        await expect(page.locator("html")).not.toHaveClass(/has-motion/);
        const tokens = await page.evaluate(() => {
            const style = getComputedStyle(document.documentElement);
            return {
                scale: style.getPropertyValue("--motion-scale").trim(),
                page: style.getPropertyValue("--motion-page").trim(),
            };
        });
        expect(tokens).toEqual({ scale: "0", page: "0s" });

        for (const element of await page.locator("[data-reveal]:not([data-machine])").all()) {
            await expect(element).toHaveCSS("opacity", "1");
        }

        await page.getByRole("button", { name: "Machine", exact: true }).click();
        await expectMachineView(page);
        await page.getByRole("button", { name: "Human", exact: true }).click();
        await expectHumanView(page);
        for (const element of await page.locator("[data-reveal]:not([data-machine])").all()) {
            await expect(element).toHaveCSS("opacity", "1");
        }

        expect(await page.evaluate(() => window.__viewTransitions)).toBe(0);
        expect(errors).toEqual([]);
        await context.close();
    });
});

test.describe("phone layout", () => {
    test("Ask an AI replaces the view toggle, which returns in the machine view", async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await context.newPage();
        const errors = trackErrors(page);
        const askAi = page.locator(".ask-ai__trigger");
        const dock = page.locator(".mode-dock");

        await page.goto("/");
        await expect(askAi).toBeVisible();
        await expect(dock).toBeHidden();

        // A visitor who lands in the machine view still needs the way back,
        // and it must not sit under Ask an AI.
        await page.goto("/?view=machine");
        await expect(dock).toBeVisible();
        const [dockBox, askBox] = [await dock.boundingBox(), await askAi.boundingBox()];
        expect(dockBox.y).toBeGreaterThanOrEqual(askBox.y + askBox.height);

        await page.getByRole("button", { name: "Human", exact: true }).click();
        await expectHumanView(page);
        await expect(dock).toBeHidden();
        expect(errors).toEqual([]);
        await context.close();
    });
});

test.describe("sub-projects", () => {
    for (const path of [
        "/block-fighter/",
        "/jagyeokru/",
        "/jeonse/",
        "/retirement-calculator/",
        "/three-body-problem-simulation/",
    ]) {
        test(`${path} loads without errors`, async ({ page }) => {
            const errors = trackErrors(page);
            const response = await page.goto(path);
            expect(response?.status()).toBe(200);
            await expect(page.locator("body")).toBeVisible();
            // Give inline scripts a frame to run and throw if they are going to.
            await page.waitForTimeout(250);
            expect(errors.filter((e) => !/net::ERR|Failed to load resource/.test(e))).toEqual([]);
        });
    }
});

test.describe("project detail", () => {
    // Rent Calculator is same-origin (/jeonse/), so the embedded demo loads
    // without depending on the network.
    const cardFor = (page, id) => page.locator(`.project-card[data-project-id="${id}"]`);
    const dialogOf = (page) => page.locator("dialog.project-detail");

    const openProject = async (page, id) => {
        const card = cardFor(page, id);
        await card.scrollIntoViewIfNeeded();
        await card.click();
        const dialog = dialogOf(page);
        await expect(dialog).toBeVisible();
        return { card, dialog };
    };

    /** The embedded sub-page may log failed CDN requests when offline. */
    const withoutNetworkNoise = (errors) =>
        errors.filter((e) => !/net::ERR|Failed to load resource/.test(e));

    test("opens from a card click and closes with Escape", async ({ page, context }) => {
        const errors = trackErrors(page);
        await page.goto("/");
        const { card, dialog } = await openProject(page, "rent-calculator");

        await expect(dialog.getByRole("heading", { level: 2 })).toHaveText("Rent Calculator");
        await expect(page).toHaveURL(/\/#work\/rent-calculator$/);
        await expect(card).toHaveAttribute("aria-haspopup", "dialog");
        expect(context.pages()).toHaveLength(1);

        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(card).toBeFocused();
        await expect(page).not.toHaveURL(/#/);
        expect(errors).toEqual([]);
    });

    test("opens with Enter on a focused card", async ({ page }) => {
        await page.goto("/");
        const card = cardFor(page, "rent-calculator");
        await card.focus();
        await page.keyboard.press("Enter");
        await expect(dialogOf(page)).toBeVisible();
        await expect(page.getByRole("button", { name: "Close project details" })).toBeFocused();
    });

    test("closes on a backdrop click but not on a panel click", async ({ page }) => {
        await page.goto("/");
        const { dialog } = await openProject(page, "rent-calculator");

        await dialog.locator(".project-detail__pitch").click();
        await expect(dialog).toBeVisible();

        await page.mouse.click(10, 360);
        await expect(dialog).toBeHidden();
    });

    test("modifier and middle clicks keep native link behaviour", async ({ page, context }) => {
        await page.goto("/");
        const card = cardFor(page, "rent-calculator");
        await card.scrollIntoViewIfNeeded();

        // Window listeners run after the grid's delegated handler, so they see
        // whether it cancelled the browser's own new-tab behaviour.
        await page.evaluate(() => {
            window.__clicksPrevented = [];
            for (const type of ["click", "auxclick"]) {
                window.addEventListener(type, (event) =>
                    window.__clicksPrevented.push(event.defaultPrevented)
                );
            }
        });
        const newTabs = [];
        context.on("page", (tab) => newTabs.push(tab));

        await card.click({ modifiers: ["ControlOrMeta"] });
        await card.click({ button: "middle" });

        await expect.poll(() => newTabs.length).toBe(2);
        expect(await page.evaluate(() => window.__clicksPrevented)).toEqual([false, false]);
        await expect(dialogOf(page)).toBeHidden();
        await expect(page).not.toHaveURL(/#/);
    });

    test("runs the live demo inline on demand and tears it down", async ({ page }) => {
        const errors = trackErrors(page);
        await page.goto("/");
        const { dialog } = await openProject(page, "rent-calculator");
        const frame = dialog.locator("iframe.project-detail__frame");
        await expect(frame).toHaveCount(0);

        await dialog.getByRole("button", { name: "Try it here" }).click();
        await expect(frame).toHaveAttribute("src", "/jeonse/");
        await expect(frame).toHaveAttribute("title", "Rent Calculator live demo");
        await expect(page.frameLocator("iframe.project-detail__frame").locator("body")).toBeVisible();
        await expect(dialog.getByRole("button", { name: "Exit demo" })).toBeFocused();
        await expect(dialog.getByRole("button", { name: "Try it here" })).toBeHidden();

        await dialog.getByRole("button", { name: "Restart" }).click();
        await expect(frame).toHaveCount(1);

        await dialog.getByRole("button", { name: "Exit demo" }).click();
        await expect(frame).toHaveCount(0);
        await expect(dialog.getByRole("button", { name: "Try it here" })).toBeFocused();

        await dialog.getByRole("button", { name: "Try it here" }).click();
        await expect(frame).toHaveCount(1);
        await page.getByRole("button", { name: "Close project details" }).click();
        await expect(dialog).toBeHidden();
        await expect(page.locator("iframe")).toHaveCount(0);
        await expect(page).not.toHaveURL(/#/);
        expect(withoutNetworkNoise(errors)).toEqual([]);
    });

    test("a repository project links out instead of embedding", async ({ page }) => {
        await page.goto("/");
        const { dialog } = await openProject(page, "poincare-lean");

        await expect(dialog.locator("[data-project-detail-try]")).toHaveCount(0);
        const cta = dialog.locator(".project-detail__cta");
        await expect(cta).toHaveAttribute("href", "https://github.com/mjkang-estrella/poincare-lean");
        await expect(cta).toHaveAttribute("target", "_blank");
        await expect(cta).toHaveAttribute("rel", "noopener noreferrer");
    });

    test("a #work/ deep link opens on load and closing leaves a clean URL", async ({ page }) => {
        const errors = trackErrors(page);
        await page.goto("/#work/rent-calculator");
        const dialog = dialogOf(page);
        await expect(dialog).toBeVisible();
        const historyLength = await page.evaluate(() => history.length);

        await page.getByRole("button", { name: "Close project details" }).click();
        await expect(dialog).toBeHidden();
        await expect(page).toHaveURL(/:\d+\/$/);
        expect(await page.evaluate(() => history.length)).toBe(historyLength);

        await page.goto("/#work/not-a-project");
        await expect(dialog).toBeHidden();
        expect(errors).toEqual([]);
    });

    test("Back closes the popup and Forward reopens it", async ({ page }) => {
        await page.goto("/");
        const { dialog } = await openProject(page, "rent-calculator");

        await page.goBack();
        await expect(dialog).toBeHidden();
        await expect(page).not.toHaveURL(/#/);

        await page.goForward();
        await expect(dialog).toBeVisible();
        await expect(page).toHaveURL(/\/#work\/rent-calculator$/);

        // Closing a popup that Forward restored pops its entry again.
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(page).not.toHaveURL(/#/);
    });

    test("morphs from the card with one view transition each way", async ({ page, context }) => {
        await countViewTransitions(context);
        const errors = trackErrors(page);
        await page.goto("/");
        const { dialog } = await openProject(page, "rent-calculator");
        await expectTransitionSettled(page);

        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expectTransitionSettled(page);

        expect(await page.evaluate(() => window.__viewTransitions)).toBe(2);
        await expect(page.locator("html")).not.toHaveClass(/is-project-morph|is-project-closing/);
        expect(
            await page.evaluate(
                () => document.querySelectorAll('[style*="view-transition-name"]').length
            )
        ).toBe(0);
        expect(errors).toEqual([]);
    });

    test("reduced motion opens and closes without view transitions", async ({ browser }) => {
        const context = await browser.newContext({ reducedMotion: "reduce" });
        await countViewTransitions(context);
        const page = await context.newPage();
        const errors = trackErrors(page);
        await page.goto("/");

        const { dialog } = await openProject(page, "rent-calculator");
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();

        expect(await page.evaluate(() => window.__viewTransitions)).toBe(0);
        expect(errors).toEqual([]);
        await context.close();
    });

    test("stays closed in the machine view", async ({ page }) => {
        const errors = trackErrors(page);
        await page.goto("/?view=machine#work/rent-calculator");
        await expectMachineView(page);
        await expect(dialogOf(page)).toBeHidden();
        expect(errors).toEqual([]);
    });

    test("a quick close and reopen ends open", async ({ page }) => {
        const errors = trackErrors(page);
        await page.goto("/");
        const { card, dialog } = await openProject(page, "rent-calculator");
        await page.keyboard.press("Escape");
        await card.click();
        await expect(dialog).toBeVisible();
        await expectTransitionSettled(page);
        await expect(dialog).toBeVisible();
        await expect(page).toHaveURL(/\/#work\/rent-calculator$/);
        expect(errors).toEqual([]);
    });

    test("is a full-screen sheet without the inline demo on phones", async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await context.newPage();
        await page.goto("/");
        const { dialog } = await openProject(page, "rent-calculator");

        const box = await dialog.boundingBox();
        expect(box).toEqual({ x: 0, y: 0, width: 390, height: 844 });
        await expect(dialog.locator("[data-project-detail-try]")).toBeHidden();
        await expect(dialog.locator(".project-detail__cta")).toBeVisible();
        await context.close();
    });

    for (const width of [1280, 390]) {
        test(`loads the hackathon video in the popup at ${width}px and unloads it on close`, async ({ page }) => {
            await page.setViewportSize({ width, height: 844 });
            const videoUrl = "https://drive.google.com/file/d/1v3rAq66T40dje1TkuuASHaEHmZAyQG2n/preview";
            // Test the player lifecycle independently of Google's network/player.
            let loads = 0;
            await page.route(videoUrl, async (route) => {
                loads += 1;
                await route.fulfill({ contentType: "text/html", body: "<p>Demo video player</p>" });
            });
            await page.goto("/");
            expect(loads).toBe(0);
            const card = page.locator('[data-project-id="jobswitch"]');
            await card.hover();
            await expect(card.locator('.project-image--detail')).toHaveAttribute('src', 'images/projects/jobswitch-thumbnail.jpg');
            await expect(card.locator('.project-image--detail')).toHaveCSS('opacity', '1');
            expect(loads).toBe(0);
            const { dialog } = await openProject(page, "jobswitch");
            const frame = dialog.locator("iframe");
            await expect(frame).toHaveCount(1);
            await expect(dialog.locator('.project-detail__media')).toHaveCount(0);
            await expect(dialog.getByRole("link", { name: "Open JobSwitch" })).toHaveAttribute("href", "https://jobswitch-sooty.vercel.app/");
            await expect(frame).toHaveAttribute("src", videoUrl);
            await expect(frame).toHaveAttribute("title", "JobSwitch demo video");
            await expect(frame).toBeVisible();
            expect((await frame.boundingBox()).height).toBeGreaterThan(180);
            await expect(dialog.getByRole('region', { name: 'About JobSwitch' })).toBeVisible();
            await expect(dialog.getByRole("link", { name: "Open video", exact: false })).toBeVisible();
            await expect(dialog.getByRole('link', { name: 'Video on Drive' })).toHaveCount(0);
            await dialog.getByRole("button", { name: "Restart" }).click();
            await expect.poll(() => loads).toBe(2);
            await expect(frame).toHaveCount(1);
            await dialog.locator("[data-project-detail-close]").click();
            await expect(page.locator("iframe")).toHaveCount(0);
        });
    }

    test("the machine view's Copy export includes the popup copy", async ({ page, context }) => {
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
        await page.goto("/?view=machine");
        await page.getByRole("button", { name: "Copy machine-readable Markdown" }).click();
        await expect(page.getByRole("button", { name: "Copy machine-readable Markdown" })).toHaveText("Copied");

        const markdown = await page.evaluate(() => navigator.clipboard.readText());
        const pitch = await page
            .locator('template[data-project-detail="rent-calculator"]')
            .evaluate((template) =>
                template.content.querySelector("[data-project-detail-pitch]").textContent.trim()
            );
        const section = markdown.split("### Rent Calculator")[1].split("\n### ")[0];
        expect(section).toContain(`- Pitch: ${pitch}`);
        expect(section).toContain("- What it does:");
    });

    test("without JavaScript a card is still a direct link", async ({ browser }) => {
        const context = await browser.newContext({ javaScriptEnabled: false });
        const page = await context.newPage();
        await page.goto("/");
        await cardFor(page, "rent-calculator").click();
        await expect(page).toHaveURL(/\/jeonse\/$/);
        await context.close();
    });
});
