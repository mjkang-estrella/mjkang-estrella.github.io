// Optional, consent-gated portfolio analytics. Cloudflare RUM remains separate.
(() => {
    const MEASUREMENT_ID = "G-7SZGKKSJT4";
    const CONSENT_KEY = "mj-analytics-consent-v1";
    const production = ["mj-kang.com", "www.mj-kang.com"].includes(location.hostname);
    const embedded = window.top !== window.self;
    const privacySignal = navigator.globalPrivacyControl === true || navigator.doNotTrack === "1";
    let enabled = false;
    let initialized = false;
    let pageSent = false;
    let observer;
    const seenSections = new Set();
    const seenDepths = new Set();
    const readConsent = () => {
        try { return localStorage.getItem(CONSENT_KEY); } catch { return null; }
    };
    const cleanUrl = (value) => {
        try {
            const url = new URL(value, location.href);
            return /^https?:$/.test(url.protocol) ? url.origin + url.pathname : "";
        } catch { return ""; }
    };
    function gtag() {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(arguments);
    }
    const track = (name, parameters = {}) => {
        if (!enabled) return;
        gtag("event", name, {
            send_to: MEASUREMENT_ID,
            page_location: cleanUrl(location.href),
            page_referrer: cleanUrl(document.referrer),
            page_title: document.title,
            view_mode: document.body.dataset.portfolioView || "project",
            page_context: embedded ? "embedded" : "standalone",
            ...parameters,
        });
    };
    window.portfolioAnalytics = Object.freeze({ track });

    const trackDepth = () => {
        if (!enabled || document.visibilityState === "hidden") return;
        const height = document.documentElement.scrollHeight;
        if (height <= innerHeight) return;
        const percent = Math.min(100, (scrollY + innerHeight) / height * 100);
        [25, 50, 75, 90].forEach((depth) => {
            if (percent >= depth && !seenDepths.has(depth)) {
                seenDepths.add(depth);
                track("scroll_depth", { percent_scrolled: depth });
            }
        });
    };
    const observeSections = () => {
        if (!("IntersectionObserver" in window)) return;
        observer ||= new IntersectionObserver((entries) => {
            entries.forEach(({ target, isIntersecting }) => {
                const section = target.dataset.humanBlock;
                if (enabled && isIntersecting && !seenSections.has(section)) {
                    seenSections.add(section);
                    track("section_view", { section });
                }
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('[data-human-block]:not([data-human-block="page"])')
            .forEach((section) => observer.observe(section));
    };
    const start = () => {
        if (!production || privacySignal || enabled) return;
        enabled = true;
        window[`ga-disable-${MEASUREMENT_ID}`] = false;
        if (!initialized) {
            initialized = true;
            // Basic consent mode: no Google request at all before opt-in.
            gtag("consent", "default", {
                analytics_storage: "granted", ad_storage: "denied",
                ad_user_data: "denied", ad_personalization: "denied",
            });
            gtag("js", new Date());
            const campaign = {};
            const query = new URLSearchParams(location.search);
            ["source", "medium", "campaign", "term", "content", "id"].forEach((key) => {
                const value = query.get(`utm_${key}`);
                if (value) campaign[`campaign_${key === "campaign" ? "name" : key}`] = value.slice(0, 100);
            });
            gtag("config", MEASUREMENT_ID, {
                send_page_view: false,
                allow_google_signals: false,
                allow_ad_personalization_signals: false,
                cookie_domain: location.hostname,
                cookie_flags: "SameSite=Lax;Secure",
                page_location: cleanUrl(location.href),
                page_referrer: cleanUrl(document.referrer),
                ...(query.get("analytics_debug") === "1" ? { debug_mode: true } : {}),
                ...campaign,
            });
            const script = document.createElement("script");
            script.async = true;
            script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
            document.head.append(script);
        } else {
            gtag("consent", "update", { analytics_storage: "granted" });
        }
        if (!pageSent) {
            pageSent = true;
            track("page_view");
        }
        observeSections();
    };
    const stop = () => {
        enabled = false;
        observer?.disconnect();
        window[`ga-disable-${MEASUREMENT_ID}`] = true;
        if (initialized) gtag("consent", "update", { analytics_storage: "denied" });
        // Remove only cookies owned by this integration on this host.
        ["_ga", `_ga_${MEASUREMENT_ID.slice(2)}`].forEach((name) => {
            ["", location.hostname, `.${location.hostname}`].forEach((domain) => {
                document.cookie = `${name}=; Max-Age=0; Path=/;${domain ? ` Domain=${domain};` : ""} SameSite=Lax; Secure`;
            });
        });
    };

    // Local previews never contact Google or display a consent prompt.
    if (!production) return;

    if (!embedded) {
        const panel = document.createElement("section");
        panel.className = "analytics-choice";
        panel.setAttribute("aria-label", "Analytics preference");
        panel.innerHTML = '<p><strong>Help improve this site?</strong> Optional Google Analytics cookies measure page visits and clicks. <a href="/privacy/">Privacy details</a></p><div><button type="button" data-choice="denied">No thanks</button><button type="button" data-choice="granted">Allow analytics</button></div>';
        const settings = document.createElement("button");
        settings.type = "button";
        settings.className = "analytics-settings";
        settings.textContent = "Analytics preferences";
        settings.addEventListener("click", () => {
            panel.hidden = false;
            settings.hidden = true;
            panel.querySelector("button").focus();
        });
        panel.addEventListener("click", (event) => {
            const choice = event.target.closest("[data-choice]")?.dataset.choice;
            if (!choice) return;
            try { localStorage.setItem(CONSENT_KEY, choice); } catch { /* Session-only choice. */ }
            if (choice === "granted") start(); else stop();
            panel.hidden = true;
            settings.hidden = false;
            settings.focus({ preventScroll: true });
        });
        if (privacySignal) {
            panel.querySelector("p").innerHTML = 'Analytics is off because your browser requests not to be tracked. <a href="/privacy/">Privacy details</a>';
            panel.querySelector('[data-choice="granted"]').remove();
        }
        panel.hidden = readConsent() !== null || privacySignal;
        settings.hidden = !panel.hidden;
        document.body.append(panel, settings);
    }

    if (readConsent() === "granted") start();
    else window[`ga-disable-${MEASUREMENT_ID}`] = true;
    window.addEventListener("storage", (event) => {
        if (event.key !== CONSENT_KEY && event.key !== null) return;
        if (readConsent() === "granted") start(); else stop();
    });
    window.addEventListener("scroll", trackDepth, { passive: true });

    const linkClick = (event) => {
        if (!enabled || (event.type === "auxclick" && event.button !== 1)) return;
        const link = event.target.closest("a[href]");
        if (!link || event.defaultPrevented || link.closest(".analytics-choice")) return;
        const href = link.getAttribute("href");
        const projectId = link.dataset.projectId ||
            link.closest('[data-project-detail-dialog]')
                ?.querySelector('[data-project-detail-body]')?.dataset.analyticsProjectId || "";
        const section = link.closest("[data-human-block]")?.dataset.humanBlock ||
            (link.closest("[data-project-detail-dialog]") ? "project_detail" : "navigation");
        if (/^mailto:/i.test(href)) {
            track("contact_click", { contact_method: "email", section });
            return;
        }
        if (link.dataset.aiProvider) {
            track("ai_assistant_click", { provider: link.dataset.aiProvider });
            return;
        }
        const url = cleanUrl(link.href);
        if (!url || href.startsWith("#")) return;
        const delivery = {};
        // Give gtag a bounded opportunity to send before a same-tab navigation
        // tears down this document. A blocked tag must never strand the link.
        if (event.type === "click" && event.button === 0 &&
            !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
            (!link.target || link.target === "_self") && !link.hasAttribute("download")) {
            event.preventDefault();
            const destination = link.href;
            let navigated = false;
            const navigate = () => {
                if (navigated) return;
                navigated = true;
                location.assign(destination);
            };
            delivery.event_callback = navigate;
            delivery.event_timeout = 200;
            window.setTimeout(navigate, 250);
        }
        track(projectId ? "project_link_click" : "navigation_click", {
            ...(projectId ? { project_id: projectId } : {}),
            link_url: url,
            link_domain: new URL(url).hostname,
            outbound: new URL(url).origin !== location.origin,
            section,
            ...delivery,
        });
    };
    document.addEventListener("click", linkClick);
    document.addEventListener("auxclick", linkClick);
    document.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button) return;
        if (button.dataset.viewMode) track("view_mode_change", { view_mode: button.dataset.viewMode });
        if (button.matches("[data-copy-machine-profile], .ask-ai__copy")) {
            track("copy_click", { content_type: button.matches(".ask-ai__copy") ? "ai_prompt" : "machine_profile" });
        }
    });
})();
