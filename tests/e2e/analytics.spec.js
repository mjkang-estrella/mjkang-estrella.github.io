const { test, expect } = require("@playwright/test");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "../..");
const KEY = "mj-analytics-consent-v1";
const ID = "G-7SZGKKSJT4";

// Exercise the production hostname with local files. Never send test traffic
// to Google, Cloudflare, or the deployed site.
async function serveSite(page) {
    const googleRequests = [];
    await page.context().route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.hostname === "www.googletagmanager.com") {
            googleRequests.push(url.href);
            return route.fulfill({ contentType: "text/javascript", body: "" });
        }
        if (url.hostname !== "mj-kang.com") return route.abort();
        const file = path.join(ROOT, url.pathname.endsWith("/") ? url.pathname + "index.html" : url.pathname);
        try { return route.fulfill({ path: file }); }
        catch { return route.fulfill({ status: 404, body: "Not found" }); }
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    return googleRequests;
}
async function events(page, name) {
    return page.evaluate((name) => (window.dataLayer || [])
        .map((entry) => Array.from(entry))
        .filter((entry) => entry[0] === "event" && (!name || entry[1] === name)), name);
}
async function grant(page) {
    await page.getByRole("button", { name: "Allow analytics", exact: true }).click();
    await expect.poll(async () => (await events(page, "page_view")).length).toBe(1);
}

test("no Google request before opt-in; decline persists", async ({ page }) => {
    const requests = await serveSite(page);
    await page.goto("https://mj-kang.com/");
    await expect(page.getByRole("button", { name: "Allow analytics", exact: true })).toBeVisible();
    await page.locator('[data-project-id="block-fighter"]').click();
    expect(await events(page)).toEqual([]);
    expect(requests).toEqual([]);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "No thanks", exact: true }).click();
    await page.reload();
    await expect(page.locator(".analytics-choice")).toBeHidden();
    expect(requests).toEqual([]);
});

test("consented project funnel records actual opens and demo starts once", async ({ page }) => {
    await serveSite(page);
    await page.goto("https://mj-kang.com/");
    await grant(page);
    await page.locator('[data-project-id="block-fighter"]').click();
    await expect(page.locator("dialog[open]")).toBeVisible();
    const opens = await events(page, "project_open");
    expect(opens).toHaveLength(1);
    expect(opens[0][2]).toMatchObject({ project_id: "block-fighter", open_method: "card" });
    expect(await events(page, "project_link_click")).toHaveLength(0);
    expect(await events(page, "page_view")).toHaveLength(1);
    await page.locator("dialog [data-project-detail-try]").click();
    expect((await events(page, "demo_start"))[0][2].project_id).toBe("block-fighter");
    await expect(page.locator("dialog iframe")).toBeVisible();
    const frame = page.frames().find((frame) => frame.url().includes("/block-fighter/"));
    await expect.poll(() => frame.evaluate(() => (window.dataLayer || []).length)).toBeGreaterThan(0);
    expect(await frame.locator(".analytics-choice").count()).toBe(0);
    const embeddedView = await frame.evaluate(() => Array.from(window.dataLayer).find((row) => row[1] === "page_view")[2]);
    expect(embeddedView.page_context).toBe("embedded");
    await page.locator("[data-project-detail-close]").click();
    expect(await events(page, "project_close")).toHaveLength(1);
});

test("clean URLs, campaign attribution, and AI provider clicks", async ({ page }) => {
    await serveSite(page);
    await page.goto("https://mj-kang.com/?private=secret&utm_source=linkedin&utm_medium=social");
    await grant(page);
    const config = await page.evaluate(() => Array.from(window.dataLayer).find((row) => row[0] === "config")[2]);
    expect(config).toMatchObject({ page_location: "https://mj-kang.com/", campaign_source: "linkedin", campaign_medium: "social", send_page_view: false, allow_google_signals: false });
    await page.getByRole("button", { name: "Ask an AI about MJ Kang", exact: true }).click();
    const opened = page.waitForEvent("popup");
    await page.locator('[data-ai-provider="chatgpt"]').click();
    await (await opened).close();
    expect((await events(page, "ai_assistant_click"))[0][2].provider).toBe("chatgpt");
    const payload = JSON.stringify(await events(page));
    expect(payload).not.toContain("secret");
    expect(payload).not.toContain("Tell me about");
    expect(payload).not.toContain("?q=");
});

test("project CTA records destination without URL parameters", async ({ page }) => {
    await serveSite(page);
    await page.goto("https://mj-kang.com/");
    await grant(page);
    await page.locator('[data-project-id="block-fighter"]').click();
    const opened = page.waitForEvent("popup");
    await page.locator('dialog .project-detail__secondary[href^="https://github.com/mjkang-estrella/"]').click();
    await (await opened).close();
    expect((await events(page, "project_link_click"))[0][2]).toMatchObject({
        project_id: "block-fighter", link_url: "https://github.com/mjkang-estrella/mjkang-estrella.github.io/tree/main/block-fighter", section: "project_detail",
    });
});

test("same-tab project link queues its event and still navigates if Google is blocked", async ({ page }) => {
    await serveSite(page);
    await page.goto("https://mj-kang.com/");
    await grant(page);
    await page.locator('[data-project-id="block-fighter"]').click();
    let departureEvents = [];
    await page.exposeFunction("recordDeparture", (rows) => { departureEvents = rows; });
    await page.evaluate(() => {
        document.addEventListener("click", () => {
            window.recordDeparture((window.dataLayer || []).map((row) => [row[0], row[1], row[2]?.project_id]));
        });
    });
    await page.locator("dialog .project-detail__cta").click();
    await expect(page).toHaveURL("https://mj-kang.com/block-fighter/");
    expect(departureEvents).toContainEqual(["event", "project_link_click", "block-fighter"]);
});

test("withdrawal disables events, clears cookies, and survives reload", async ({ page, context }) => {
    const requests = await serveSite(page);
    await page.goto("https://mj-kang.com/");
    await grant(page);
    await context.addCookies([{ name: "_ga", value: "test", domain: "mj-kang.com", path: "/", secure: true }]);
    await page.getByRole("button", { name: "Analytics preferences", exact: true }).click();
    await page.getByRole("button", { name: "No thanks", exact: true }).click();
    const before = (await events(page)).length;
    await page.locator('[data-project-id="block-fighter"]').click();
    expect((await events(page)).length).toBe(before);
    expect((await context.cookies()).filter((cookie) => cookie.name.startsWith("_ga"))).toEqual([]);
    expect(await page.evaluate((id) => window[`ga-disable-${id}`], ID)).toBe(true);
    const loads = requests.length;
    await page.reload();
    expect(requests).toHaveLength(loads);
});

test("privacy signals override a stored grant", async ({ page, context }) => {
    const requests = await serveSite(page);
    await context.addInitScript(({ key }) => {
        localStorage.setItem(key, "granted");
        Object.defineProperty(navigator, "globalPrivacyControl", { value: true });
    }, { key: KEY });
    await page.goto("https://mj-kang.com/");
    expect(await events(page)).toEqual([]);
    expect(requests).toEqual([]);
    await page.getByRole("button", { name: "Analytics preferences", exact: true }).click();
    await expect(page.getByRole("button", { name: "Allow analytics", exact: true })).toHaveCount(0);
});

test("local previews do not load analytics", async ({ page }) => {
    const requests = [];
    page.on("request", (request) => {
        if (request.url().includes("googletagmanager")) requests.push(request.url());
    });
    await page.goto("/");
    expect(requests).toEqual([]);
    await expect(page.locator(".analytics-choice")).toHaveCount(0);
});
