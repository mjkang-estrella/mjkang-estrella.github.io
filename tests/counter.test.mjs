import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import worker, { validCounter } from '../analytics/worker.mjs';

const schema = await readFile(new URL('../analytics/schema.sql', import.meta.url), 'utf8');
const payload = { event: 'project_open', page: '/', target: 'block-fighter', context: 'page' };
const request = (value = payload, headers = {}, url = 'https://mj-kang.com/__counts') => new Request(url, {
    method: 'POST', headers: { Origin: 'https://mj-kang.com', 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(value),
});
function database() {
    const sql = new DatabaseSync(':memory:');
    sql.exec(schema);
    return { sql, env: { COUNTS: { prepare(query) { return { bind(...values) { return { async run() { return sql.prepare(query).run(...values); } }; } }; } } } };
}

test('repeated requests increment a single daily row with no individual event records', async () => {
    const { sql, env } = database();
    for (let i = 0; i < 5; i++) {
        const r = await worker.fetch(request(payload, { Cookie: 'session=private', 'CF-Connecting-IP': '192.0.2.1', 'User-Agent': 'private-agent', Referer: 'https://example.com/private' }), env);
        assert.equal(r.status, 204);
        assert.equal(r.headers.get('Set-Cookie'), null);
    }
    const rows = sql.prepare('SELECT * FROM daily_counts').all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].count, 5);
    assert.deepEqual(Object.keys(rows[0]).sort(), ['context', 'count', 'day', 'event', 'page', 'target']);
    assert.equal(JSON.stringify(rows).includes('private'), false);
    assert.match(rows[0].day, /^\d{4}-\d{2}-\d{2}$/);
    sql.close();
});

test('rejects arbitrary identifiers, raw URLs, unknown fields and malformed types', async () => {
    const { sql, env } = database();
    for (const value of [
        { ...payload, user_id: 'abc' }, { ...payload, page: '/?email=private' },
        { ...payload, target: 'https://github.com/person' }, { ...payload, target: 4 },
        { ...payload, context: 'user123' }, { ...payload, count: 1000 },
        { ...payload, timestamp: Date.now() }, [], null, { event: '__proto__', page: '/', target: '', context: 'page' },
    ]) assert.equal((await worker.fetch(request(value), env)).status, 400);
    assert.equal(sql.prepare('SELECT count(*) AS n FROM daily_counts').get().n, 0);
    sql.close();
});

test('validates same-origin writes and has no public report endpoint', async () => {
    const { sql, env } = database();
    assert.equal((await worker.fetch(request(payload, { Origin: 'https://evil.example' }), env)).status, 403);
    assert.equal((await worker.fetch(request(payload, { 'Sec-Fetch-Site': 'cross-site' }), env)).status, 403);
    assert.equal((await worker.fetch(request(payload, { 'Content-Type': 'text/plain' }), env)).status, 415);
    assert.equal((await worker.fetch(request(payload, {}, 'https://mj-kang.com/__counts?visitor=1'), env)).status, 404);
    assert.equal((await worker.fetch(new Request('https://mj-kang.com/__counts'), env)).status, 405);
    assert.equal((await worker.fetch(new Request('https://mj-kang.com/__counts/report'), env)).status, 404);
    sql.close();
});

test('privacy headers suppress writes, oversized bodies are rejected, DB failures do not leak details', async () => {
    const { sql, env } = database();
    for (const headers of [{ DNT: '1' }, { 'Sec-GPC': '1' }]) assert.equal((await worker.fetch(request(payload, headers), env)).status, 204);
    assert.equal(sql.prepare('SELECT count(*) AS n FROM daily_counts').get().n, 0);
    assert.equal((await worker.fetch(request({ ...payload, target: 'x'.repeat(600) }), env)).status, 400);
    const failed = await worker.fetch(request(), {});
    assert.equal(failed.status, 503);
    assert.equal(await failed.text(), '');
    sql.close();
});

test('every curated project ID is permitted, distinct targets remain separate totals', async () => {
    const portfolio = JSON.parse(await readFile(new URL('../data/portfolio.json', import.meta.url), 'utf8'));
    for (const project of portfolio.projects) assert.equal(validCounter({ ...payload, target: project.id }), true, project.id);
    const { sql, env } = database();
    await worker.fetch(request(), env);
    await worker.fetch(request({ ...payload, target: 'soma' }), env);
    await worker.fetch(request({ ...payload, context: 'embed' }), env);
    assert.equal(sql.prepare('SELECT count(*) AS n FROM daily_counts').get().n, 3);
    sql.close();
});
