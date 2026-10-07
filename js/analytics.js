// Aggregate counts only: no Google tag, visitor/session ID, cookie or raw URL.
(() => {
    const production = ["mj-kang.com", "www.mj-kang.com"].includes(location.hostname);
    const PAGES = new Set(["/", "/block-fighter/", "/three-body-problem-simulation/", "/jeonse/", "/retirement-calculator/", "/jagyeokru/"]);
    const PROJECT_EVENTS = new Set(["project_open", "project_close", "demo_start", "demo_restart", "demo_exit", "project_link_click"]);
    const OPT_OUT = "mj-anonymous-counts-disabled";
    const LEGACY = "mj-analytics-consent-v1";
    const privacySignal = navigator.globalPrivacyControl === true || navigator.doNotTrack === "1";
    let disabled = false;
    let sent = 0;
    let pageSent = false;
    let observer;
    const seenSections = new Set();
    const seenDepths = new Set();

    // Retire our previous GA integration. Only an opt-out preference is retained.
    if (production) {
        try {
            if (localStorage.getItem(LEGACY) === "denied") localStorage.setItem(OPT_OUT, "1");
            localStorage.removeItem(LEGACY);
            disabled = localStorage.getItem(OPT_OUT) === "1";
        } catch { /* Storage is optional; counting does not require it. */ }
        window["ga-disable-G-7SZGKKSJT4"] = true;
        for (const name of ["_ga", "_ga_7SZGKKSJT4"]) {
            for (const domain of ["", location.hostname, `.${location.hostname}`, ".mj-kang.com"]) {
                document.cookie = `${name}=; Max-Age=0; Path=/;${domain ? ` Domain=${domain};` : ""} SameSite=Lax; Secure`;
            }
        }
    }

    const targets = {
        page_view: () => "",
        navigation_click: (p) => p.target,
        contact_click: () => "email",
        ai_assistant_click: (p) => p.provider,
        view_mode_change: (p) => p.view_mode,
        copy_click: (p) => p.content_type,
        section_view: (p) => p.section,
        scroll_depth: (p) => String(p.percent_scrolled),
    };
    const track = (event, parameters = {}) => {
        if (!production || disabled || privacySignal || !PAGES.has(location.pathname) || sent >= 120) return;
        const target = PROJECT_EVENTS.has(event) ? parameters.project_id :
            Object.hasOwn(targets, event) ? targets[event](parameters) : undefined;
        if (typeof target !== "string" || target.length > 64) return;
        sent += 1;
        // One independent increment. No batching/session key, credentials,
        // referrer, query string, fragment, exact time, UA or device data.
        fetch("/__counts", {
            method: "POST",
            mode: "same-origin",
            credentials: "omit",
            referrerPolicy: "no-referrer",
            keepalive: true,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event, page: location.pathname, target, context: window.top === window.self ? "page" : "embed" }),
        }).catch(() => {});
    };
    window.portfolioAnalytics = Object.freeze({ track });

    const start = () => {
        if (!production || disabled || privacySignal || !PAGES.has(location.pathname)) return;
        if (!pageSent) { pageSent = true; track("page_view"); }
        if (!("IntersectionObserver" in window)) return;
        observer ||= new IntersectionObserver((entries) => {
            for (const { target, isIntersecting } of entries) {
                const section = target.dataset.humanBlock;
                if (!disabled && isIntersecting && !seenSections.has(section)) {
                    seenSections.add(section);
                    track("section_view", { section });
                }
            }
        }, { threshold: 0.1 });
        document.querySelectorAll('[data-human-block]:not([data-human-block="page"])')
            .forEach((section) => observer.observe(section));
    };
    const button = document.querySelector("[data-counts-toggle]");
    const status = document.querySelector("[data-counts-status]");
    const updatePreference = () => {
        if (status) status.textContent = privacySignal ? "Anonymous counts are off because your browser requests not to be tracked." :
            disabled ? "Anonymous counts are off in this browser." : "Anonymous counts are on. No visitor or session identifier is used.";
        if (button) {
            button.textContent = disabled ? "Enable anonymous counts" : "Disable anonymous counts";
            button.disabled = privacySignal;
        }
    };
    button?.addEventListener("click", () => {
        disabled = !disabled;
        try { if (disabled) localStorage.setItem(OPT_OUT, "1"); else localStorage.removeItem(OPT_OUT); } catch { /* In-memory preference. */ }
        if (disabled) observer?.disconnect(); else start();
        updatePreference();
    });
    window.addEventListener("storage", (event) => {
        if (event.key !== OPT_OUT && event.key !== null) return;
        try { disabled = localStorage.getItem(OPT_OUT) === "1"; } catch { return; }
        if (disabled) observer?.disconnect(); else start();
        updatePreference();
    });
    updatePreference();
    start();

    const navigationTarget = (link) => {
        try {
            const url = new URL(link.href);
            if (!/^https?:$/.test(url.protocol)) return null;
            if (url.origin === location.origin) {
                if (url.pathname === "/") return "home";
                if (url.pathname === "/privacy/") return "privacy";
                if (url.pathname === "/llms.txt" || url.pathname.startsWith("/.well-known/")) return "machine";
            }
            const host = url.hostname.replace(/^www\./, "");
            return ({ "blog.mj-kang.com": "blog", "github.com": "github", "linkedin.com": "linkedin", "x.com": "x" })[host] ||
                (link.closest("[data-human-block=history]") ? "history" : "other");
        } catch { return null; }
    };
    const linkClick = (event) => {
        if (event.defaultPrevented || (event.type === "auxclick" && event.button !== 1)) return;
        const link = event.target.closest("a[href]");
        if (!link) return;
        if (link.getAttribute("href").startsWith("#")) return;
        if (link.protocol === "mailto:") { track("contact_click"); return; }
        if (link.dataset.aiProvider) { track("ai_assistant_click", { provider: link.dataset.aiProvider }); return; }
        const projectId = link.dataset.projectId || link.closest("[data-project-detail-dialog]")
            ?.querySelector("[data-project-detail-body]")?.dataset.analyticsProjectId;
        if (projectId) { track("project_link_click", { project_id: projectId }); return; }
        const target = navigationTarget(link);
        if (target) track("navigation_click", { target });
        // Keep native navigation. fetch keepalive needs no tag-load or timeout.
    };
    document.addEventListener("click", linkClick);
    document.addEventListener("auxclick", linkClick);
    document.addEventListener("click", (event) => {
        const control = event.target.closest("button");
        if (!control) return;
        if (control.dataset.viewMode) track("view_mode_change", { view_mode: control.dataset.viewMode });
        if (control.matches("[data-copy-machine-profile], .ask-ai__copy")) {
            track("copy_click", { content_type: control.matches(".ask-ai__copy") ? "ai_prompt" : "machine_profile" });
        }
    });
    window.addEventListener("scroll", () => {
        if (disabled || privacySignal || document.visibilityState === "hidden") return;
        const height = document.documentElement.scrollHeight;
        if (height <= innerHeight) return;
        const percent = (scrollY + innerHeight) / height * 100;
        for (const depth of [25, 50, 75, 90]) {
            if (percent >= depth && !seenDepths.has(depth)) {
                seenDepths.add(depth);
                track("scroll_depth", { percent_scrolled: depth });
            }
        }
    }, { passive: true });
})();
