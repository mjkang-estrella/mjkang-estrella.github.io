// Receives one bounded, allowlisted counter increment. Never logs requests.
const PAGES = new Set(["/", "/block-fighter/", "/three-body-problem-simulation/", "/jeonse/", "/retirement-calculator/"]);
const PROJECTS = new Set(["akashic-computer", "poincare-lean", "personal-ai-lab", "soma", "precortex", "prism", "caption-with-intent", "reader", "agent-newsletter", "resume-os", "conditioned", "reflect-ios", "three-body-simulator", "block-fighter", "rent-calculator", "retirement-calculator"]);
const PROJECT_EVENTS = new Set(["project_open", "project_close", "demo_start", "demo_restart", "demo_exit", "project_link_click"]);
const TARGETS = {
    page_view: [""],
    navigation_click: ["home", "blog", "github", "linkedin", "x", "history", "machine", "privacy", "other"],
    contact_click: ["email"],
    ai_assistant_click: ["chatgpt", "claude", "gemini"],
    view_mode_change: ["human", "machine"],
    copy_click: ["ai_prompt", "machine_profile"],
    section_view: ["hero", "profile", "history", "works", "footer"],
    scroll_depth: ["25", "50", "75", "90"],
};
const ORIGINS = new Set(["https://mj-kang.com", "https://www.mj-kang.com"]);
const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const response = (status) => new Response(null, { status, headers: HEADERS });

export function validCounter(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const keys = Object.keys(value).sort().join(",");
    if (keys !== "context,event,page,target") return false;
    if (![value.event, value.page, value.target, value.context].every((v) => typeof v === "string")) return false;
    if (!PAGES.has(value.page) || !["page", "embed"].includes(value.context)) return false;
    return PROJECT_EVENTS.has(value.event) ? PROJECTS.has(value.target) :
        Object.hasOwn(TARGETS, value.event) && TARGETS[value.event].includes(value.target);
}

async function readCounter(request) {
    if (Number(request.headers.get("Content-Length")) > 512) return null;
    const reader = request.body?.getReader();
    if (!reader) return null;
    const chunks = [];
    let size = 0;
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 512) { await reader.cancel(); return null; }
        chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (!ORIGINS.has(url.origin)) return response(404);
        if (url.pathname === "/__counts/health" && request.method === "GET") {
            return new Response('daily-counts-v1', { headers: { ...HEADERS, "Content-Type": "text/plain" } });
        }
        if (url.pathname !== "/__counts" || url.search) return response(404);
        if (request.method !== "POST") return response(405);
        if (!ORIGINS.has(request.headers.get("Origin"))) return response(403);
        if (request.headers.get("Origin") !== url.origin) return response(403);
        const fetchSite = request.headers.get("Sec-Fetch-Site");
        if (fetchSite && fetchSite !== "same-origin") return response(403);
        if (request.headers.get("Sec-GPC") === "1" || request.headers.get("DNT") === "1") return response(204);
        if (request.headers.get("Content-Type")?.split(";")[0] !== "application/json") return response(415);
        const counter = await readCounter(request);
        if (!validCounter(counter)) return response(400);
        try {
            // The event is reduced directly to an increment. Only a UTC date
            // and known public categories reach D1; request metadata does not.
            await env.COUNTS.prepare(`INSERT INTO daily_counts (day,event,page,target,context,count)
                VALUES (date('now'),?,?,?,?,1)
                ON CONFLICT(day,event,page,target,context) DO UPDATE SET count=count+1`)
                .bind(counter.event, counter.page, counter.target, counter.context).run();
            return response(204);
        } catch {
            // Do not log the exception/request or fall back to a raw event log.
            return response(503);
        }
    },
};
