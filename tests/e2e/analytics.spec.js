const { test, expect } = require('@playwright/test');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const OPT_OUT = 'mj-anonymous-counts-disabled';
async function serveSite(page, failure = false) {
    const counts = [];
    const google = [];
    await page.context().route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (/google-analytics|googletagmanager/.test(url.hostname)) google.push(url.href);
        if (url.hostname !== 'mj-kang.com') return route.abort();
        if (url.pathname === '/__counts') {
            counts.push({ body: route.request().postDataJSON(), headers: route.request().headers() });
            return failure ? route.abort() : route.fulfill({ status: 204 });
        }
        try { return await route.fulfill({ path: path.join(ROOT, url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname) }); }
        catch { return route.fulfill({ status: 404, body: 'Not found' }); }
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    return { counts, google };
}
const of = (counts, event) => counts.filter((row) => row.body.event === event);

test('counts immediately without a banner, identifiers, credentials, referrer or Google', async ({ page, context }) => {
    const { counts, google } = await serveSite(page);
    await context.addCookies([{ name: 'unrelated_session', value: 'private', domain: 'mj-kang.com', path: '/', secure: true }]);
    await page.goto('https://mj-kang.com/?email=secret&utm_source=person#private');
    await expect.poll(() => of(counts, 'page_view').length).toBe(1);
    await expect(page.getByText('Allow analytics', { exact: true })).toHaveCount(0);
    expect(google).toEqual([]);
    for (const row of counts) {
        expect(Object.keys(row.body).sort()).toEqual(['context', 'event', 'page', 'target']);
        expect(row.headers.cookie).toBeUndefined();
        expect(row.headers.referer).toBeUndefined();
    }
    expect(JSON.stringify(counts.map((row) => row.body))).not.toMatch(/secret|person|private|email|utm_source/);
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
    expect((await context.cookies()).map((c) => c.name)).toEqual(['unrelated_session']);
});

test('project open, demo and outbound clicks remain separate anonymous increments', async ({ page }) => {
    const { counts } = await serveSite(page);
    await page.goto('https://mj-kang.com/');
    await page.locator('[data-project-id="block-fighter"]').click();
    await expect.poll(() => of(counts, 'project_open').length).toBe(1);
    expect(of(counts, 'project_open')[0].body).toEqual({ event: 'project_open', page: '/', target: 'block-fighter', context: 'page' });
    expect(of(counts, 'project_link_click')).toHaveLength(0);
    await page.locator('dialog [data-project-detail-try]').click();
    await expect.poll(() => of(counts, 'demo_start').length).toBe(1);
    await expect.poll(() => counts.filter((r) => r.body.event === 'page_view' && r.body.context === 'embed').length).toBe(1);
    await page.locator('dialog [data-project-detail-exit]').click();
    await page.locator('dialog .project-detail__cta').click();
    await expect(page).toHaveURL('https://mj-kang.com/block-fighter/');
    await expect.poll(() => of(counts, 'project_link_click').length).toBe(1);
});

test('AI clicks send only a provider category, never prompt or destination URL', async ({ page }) => {
    const { counts } = await serveSite(page);
    await page.goto('https://mj-kang.com/');
    await page.getByRole('button', { name: 'Ask an AI about MJ Kang', exact: true }).click();
    const popup = page.waitForEvent('popup');
    await page.locator('[data-ai-provider="chatgpt"]').click();
    await (await popup).close();
    await expect.poll(() => of(counts, 'ai_assistant_click').length).toBe(1);
    expect(of(counts, 'ai_assistant_click')[0].body).toEqual({ event: 'ai_assistant_click', page: '/', target: 'chatgpt', context: 'page' });
});

test('old GA cookies are removed and an existing refusal becomes an opt-out', async ({ page, context }) => {
    const { counts, google } = await serveSite(page);
    await context.addCookies(['_ga', '_ga_7SZGKKSJT4'].map((name) => ({ name, value: 'old-id', domain: 'mj-kang.com', path: '/', secure: true })));
    await context.addInitScript(() => {
        if (!localStorage.getItem('migration_seeded')) {
            localStorage.setItem('mj-analytics-consent-v1', 'denied');
            localStorage.setItem('migration_seeded', '1');
        }
    });
    await page.goto('https://mj-kang.com/');
    expect(counts).toEqual([]);
    expect(google).toEqual([]);
    expect((await context.cookies()).filter((c) => c.name.startsWith('_ga'))).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('mj-analytics-consent-v1'))).toBeNull();
    expect(await page.evaluate((key) => localStorage.getItem(key), OPT_OUT)).toBe('1');
    await page.goto('https://mj-kang.com/privacy/');
    await page.getByRole('button', { name: 'Enable anonymous counts', exact: true }).click();
    await page.getByRole('link', { name: 'Back to MJ Kang', exact: true }).click();
    await expect.poll(() => of(counts, 'page_view').length).toBe(1);
});

test('privacy-page opt-out persists and privacy signals override collection', async ({ page, context }) => {
    const { counts } = await serveSite(page);
    await page.goto('https://mj-kang.com/privacy/');
    await page.getByRole('button', { name: 'Disable anonymous counts', exact: true }).click();
    await page.getByRole('link', { name: 'Back to MJ Kang', exact: true }).click();
    expect(counts).toEqual([]);
    await context.addInitScript(() => {
        localStorage.clear();
        Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });
    });
    await page.reload();
    expect(counts).toEqual([]);
    await page.goto('https://mj-kang.com/privacy/');
    await expect(page.getByRole('button', { name: 'Disable anonymous counts', exact: true })).toBeDisabled();
});

test('unavailable counter never blocks project navigation', async ({ page }) => {
    await serveSite(page, true);
    await page.goto('https://mj-kang.com/');
    await page.locator('[data-project-id="block-fighter"]').click();
    await page.locator('dialog .project-detail__cta').click();
    await expect(page).toHaveURL('https://mj-kang.com/block-fighter/');
});

test('local previews send no counter or Google requests', async ({ page }) => {
    const unexpected = [];
    page.on('request', (r) => { if (/__counts|googletagmanager|google-analytics/.test(r.url())) unexpected.push(r.url()); });
    await page.goto('/');
    expect(unexpected).toEqual([]);
    await expect(page.locator('.analytics-choice, .analytics-settings')).toHaveCount(0);
});
