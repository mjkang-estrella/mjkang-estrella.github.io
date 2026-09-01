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

/** Waits until no mode-transition bookkeeping classes remain on <body>. */
const expectTransitionSettled = async (page) => {
    await expect(page.locator("body")).not.toHaveClass(/is-mode-transitioning|is-exiting-machine/);
    await expect(page.locator(".machine-document")).not.toHaveClass(/is-entering|is-exiting/);
};

test.describe("view mode toggle", () => {
    test("round-trips human -> machine -> human without errors", async ({ page }) => {
        const errors = trackErrors(page);
        await page.goto("/");
        await expectHumanView(page);

        await page.getByRole("button", { name: "Machine" }).click();
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

        await page.getByRole("button", { name: "Human" }).click();
        await expectHumanView(page);
        await expect(page).not.toHaveURL(/view=/);
        await expectTransitionSettled(page);

        // Reveal elements near the top must be visible again after the round trip.
        await expect(page.locator("#profile-title")).toHaveClass(/is-visible/);
        await expect(page.locator("#profile-title")).toHaveCSS("opacity", "1");

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
        await page.getByRole("button", { name: "Machine" }).click();
        await expectMachineView(page);

        await page.goto("/");
        await expectMachineView(page);

        await page.getByRole("button", { name: "Human" }).click();
        await expectHumanView(page);
        await page.goto("/");
        await expectHumanView(page);
        expect(errors).toEqual([]);
    });

    test("rapid double toggle settles in the last requested mode", async ({ page }) => {
        const errors = trackErrors(page);
        await page.goto("/");
        await page.getByRole("button", { name: "Machine" }).click();
        await page.getByRole("button", { name: "Human" }).click();
        await page.getByRole("button", { name: "Machine" }).click();
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

        await page.getByRole("button", { name: "Machine" }).click();
        await expectMachineView(page);
        await page.getByRole("button", { name: "Human" }).click();
        await expectHumanView(page);
        for (const element of await page.locator("[data-reveal]:not([data-machine])").all()) {
            await expect(element).toHaveCSS("opacity", "1");
        }

        expect(errors).toEqual([]);
        await context.close();
    });
});

test.describe("sub-projects", () => {
    for (const path of [
        "/block-fighter/",
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
