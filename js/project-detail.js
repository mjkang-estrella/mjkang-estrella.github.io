// Project detail popup. Each Selected Works card stays a real link to the
// project; a plain click (or Enter) opens a dialog that explains the product
// first and can run the live app inline on demand. Modifier clicks, visitors
// without JS and agents reading the markup still get the direct link.
(() => {
    const dialog = document.querySelector("[data-project-detail-dialog]");
    const grid = document.querySelector(".projects-wrapper");

    if (!dialog || !grid || typeof dialog.showModal !== "function") {
        return;
    }

    const root = document.documentElement;
    const body = document.body;
    const detailBody = dialog.querySelector("[data-project-detail-body]");
    const closeButton = dialog.querySelector("[data-project-detail-close]");
    const MORPH_NAME = "project-detail-media";
    const HASH_PATTERN = /^#work\/([a-z0-9-]+)$/;
    const SLOW_LOAD_MS = 8000;

    const templates = new Map(
        Array.from(
            document.querySelectorAll("template[data-project-detail]"),
            (template) => [template.dataset.projectDetail, template]
        )
    );
    const cards = new Map();

    document.querySelectorAll(".project-card[data-project-id]").forEach((card) => {
        if (templates.has(card.dataset.projectId)) {
            cards.set(card.dataset.projectId, card);
            card.setAttribute("aria-haspopup", "dialog");
        }
    });

    // The popup session: { id, card, pushed, shown, demoUsed, frame,
    // slowTimer } from the moment a popup is requested until it has closed.
    // Opening and closing can straddle a view transition, so every deferred
    // step checks it still belongs to the current session before acting;
    // a stale close must never tear down a popup opened after it.
    let current = null;
    let morphGeneration = 0;
    let pendingBack = false;
    let queuedOpen = null;
    let pointerStartedOnBackdrop = false;
    const namedElements = new Set();

    const isHumanView = () => body.dataset.portfolioView === "human";

    const canAnimate = () =>
        typeof document.startViewTransition === "function" &&
        root.classList.contains("has-motion");

    const isInViewport = (element) => {
        const rect = element.getBoundingClientRect();
        return (
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.top < window.innerHeight &&
            rect.left < window.innerWidth
        );
    };

    const part = (selector) => detailBody.querySelector(selector);

    const setMorphName = (element) => {
        element.style.viewTransitionName = MORPH_NAME;
        namedElements.add(element);
    };

    const clearMorphNames = () => {
        namedElements.forEach((element) => {
            element.style.viewTransitionName = "";
        });
        namedElements.clear();
    };

    // One element carries the morph name in each snapshot: the card's media
    // before, the dialog's media after (or the reverse when closing). The
    // page's own named sections are switched off by .is-project-morph in
    // homepage.css so they cannot paint over the backdrop mid-flight.
    const morph = ({ from, to, update, closing }) => {
        const generation = ++morphGeneration;
        clearMorphNames();
        root.classList.add("is-project-morph");
        root.classList.toggle("is-project-closing", closing);

        if (from) {
            setMorphName(from);
        }

        const transition = document.startViewTransition(() => {
            clearMorphNames();
            update();
            const target = to && to();

            if (target) {
                setMorphName(target);
            }
        });

        const cleanup = () => {
            if (generation === morphGeneration) {
                clearMorphNames();
                root.classList.remove("is-project-morph", "is-project-closing");
            }
        };

        transition.ready.catch(() => {});
        transition.finished.then(cleanup, cleanup);
    };

    const render = (id) => {
        stopDemo();
        const fragment = templates.get(id).content.cloneNode(true);
        fragment
            .querySelector("[data-project-detail-title]")
            ?.setAttribute("id", "project-detail-title");
        fragment
            .querySelector("[data-project-detail-pitch]")
            ?.setAttribute("id", "project-detail-pitch");
        detailBody.replaceChildren(fragment);
    };

    const openDetail = (id, { push = false, animate = true } = {}) => {
        if (!templates.has(id) || !isHumanView()) {
            return;
        }

        if (push && pendingBack) {
            // The previous close is still popping its history entry; open
            // once it lands so the new entry is pushed on top of it.
            queuedOpen = id;
            return;
        }

        if (current) {
            // A hash edited while a popup is open swaps it in place.
            if (dialog.open && current.id !== id) {
                render(id);
                Object.assign(current, {
                    id,
                    card: cards.get(id) || null,
                    pushed: history.state?.projectDetail === id,
                    demoUsed: false,
                });
            }
            return;
        }

        const session = {
            id,
            card: cards.get(id) || null,
            pushed: push || history.state?.projectDetail === id,
            shown: false,
            demoUsed: false,
            frame: null,
            slowTimer: 0,
        };
        current = session;

        if (push) {
            history.pushState({ projectDetail: id }, "", `#work/${id}`);
        }

        const show = () => {
            if (current !== session) {
                return;
            }

            render(id);
            session.shown = true;

            if (!dialog.open) {
                dialog.showModal();
            }
        };

        const cardMedia = session.card?.querySelector(".project-media");

        if (animate && canAnimate() && cardMedia && isInViewport(cardMedia)) {
            morph({
                from: cardMedia,
                to: () => part("[data-project-detail-media]"),
                update: show,
                closing: false,
            });
        } else {
            show();
        }
    };

    const requestClose = () => {
        const session = current;

        if (!session) {
            return;
        }

        if (!session.shown) {
            // Still waiting for its open transition: cancel instead.
            current = null;
            return;
        }

        const close = () => {
            if (current !== session) {
                return;
            }

            stopDemo();

            if (dialog.open) {
                dialog.close();
            }

            finishClose(session);
        };

        if (!canAnimate()) {
            close();
            return;
        }

        const media = part("[data-project-detail-media]");
        const cardMedia = session.card?.querySelector(".project-media");
        const canMorph =
            !dialog.classList.contains("is-live") &&
            media &&
            cardMedia &&
            isInViewport(cardMedia);

        morph({
            from: canMorph ? media : null,
            to: canMorph ? () => cardMedia : null,
            update: close,
            closing: true,
        });
    };

    const finishClose = (session) => {
        if (current !== session) {
            return;
        }

        stopDemo();
        current = null;
        detailBody.replaceChildren();

        if (session.card?.isConnected) {
            session.card.focus({ preventScroll: true });
        }

        if (!HASH_PATTERN.test(window.location.hash)) {
            return;
        }

        // Pop the entry this popup pushed so Back leaves the page rather than
        // stepping through closed popups. A demo may have added its own
        // session-history entries, so after one the hash is dropped in place.
        if (
            session.pushed &&
            !session.demoUsed &&
            history.state?.projectDetail === session.id
        ) {
            pendingBack = true;
            history.back();
        } else {
            history.replaceState(
                null,
                "",
                window.location.pathname + window.location.search
            );
        }
    };

    const createFrame = (src, title) => {
        const frame = document.createElement("iframe");
        frame.className = "project-detail__frame";
        frame.title = `${title} live demo`;
        frame.allow = "fullscreen; clipboard-write";
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        // Setting src before insertion makes the first load replace
        // about:blank instead of adding a history entry.
        frame.src = src;
        frame.addEventListener(
            "load",
            () => {
                if (current?.frame !== frame) {
                    return;
                }

                window.clearTimeout(current.slowTimer);
                part(".project-detail__stage")?.classList.add("is-loaded");
                part(".project-detail__stage")?.classList.remove("is-slow");
                setStatus("");
            },
            { once: true }
        );
        return frame;
    };

    const setStatus = (message) => {
        const status = part("[data-project-detail-status]");

        if (status) {
            status.textContent = message;
        }
    };

    // Cross-origin frame blocking cannot be detected from script (a refused
    // frame still fires load), so the embed flag in portfolio.json decides who
    // gets a Try button and "Open full site" stays visible throughout.
    const loadFrame = () => {
        const stage = part("[data-embed-src]");
        const viewport = stage?.querySelector(".project-detail__viewport");

        if (!current || !viewport) {
            return;
        }

        const title = part("[data-project-detail-title]")?.textContent.trim() || "Project";
        const frame = createFrame(stage.dataset.embedSrc, title);

        window.clearTimeout(current.slowTimer);
        stage.classList.remove("is-loaded", "is-slow");

        if (current.frame) {
            current.frame.replaceWith(frame);
        } else {
            viewport.append(frame);
        }

        current.frame = frame;
        current.demoUsed = true;
        setStatus("Loading live demo…");
        current.slowTimer = window.setTimeout(() => {
            stage.classList.add("is-slow");
            setStatus("Still loading. If it stays blank, use Open full site.");
        }, SLOW_LOAD_MS);
    };

    const startDemo = () => {
        if (!current || current.frame) {
            return;
        }

        loadFrame();
        dialog.classList.add("is-live");

        const tools = part("[data-project-detail-tools]");
        const tryButton = part("[data-project-detail-try]");

        if (tools) tools.hidden = false;
        if (tryButton) tryButton.hidden = true;

        // Focus stays on the control that undoes the action. The frame is
        // never focused for the visitor: Escape cannot leave an iframe, so
        // the visible Close and Exit demo buttons have to stay reachable.
        part("[data-project-detail-exit]")?.focus();
    };

    const stopDemo = ({ restoreFocus = false } = {}) => {
        if (!current?.frame) {
            return;
        }

        window.clearTimeout(current.slowTimer);
        current.frame.remove();
        current.frame = null;
        dialog.classList.remove("is-live");
        part(".project-detail__stage")?.classList.remove("is-loaded", "is-slow");
        setStatus("");

        const tools = part("[data-project-detail-tools]");
        const tryButton = part("[data-project-detail-try]");

        if (tools) tools.hidden = true;

        if (tryButton) {
            tryButton.hidden = false;

            if (restoreFocus) {
                tryButton.focus();
            }
        }
    };

    const idFromHash = () => {
        const match = HASH_PATTERN.exec(window.location.hash);
        return match && templates.has(match[1]) ? match[1] : null;
    };

    const syncFromLocation = ({ initial = false } = {}) => {
        const id = idFromHash();

        if (id) {
            if (initial) {
                cards.get(id)?.scrollIntoView({ block: "center" });
            }

            openDetail(id, { animate: !initial });
        } else {
            requestClose();
        }
    };

    grid.addEventListener("click", (event) => {
        const card = event.target.closest(".project-card[data-project-id]");

        if (
            !card ||
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            !templates.has(card.dataset.projectId) ||
            !isHumanView()
        ) {
            return;
        }

        event.preventDefault();
        openDetail(card.dataset.projectId, { push: true });
    });

    closeButton?.addEventListener("click", requestClose);

    detailBody.addEventListener("click", (event) => {
        if (event.target.closest("[data-project-detail-try]")) {
            startDemo();
        } else if (event.target.closest("[data-project-detail-restart]")) {
            loadFrame();
        } else if (event.target.closest("[data-project-detail-exit]")) {
            stopDemo({ restoreFocus: true });
        }
    });

    // Escape. Chrome makes cancel non-cancelable without fresh user
    // activation; the dialog then closes natively and the close handler below
    // still does the full cleanup.
    dialog.addEventListener("cancel", (event) => {
        if (event.cancelable) {
            event.preventDefault();
            requestClose();
        }
    });

    // The panel fills the dialog, so a click whose target is the dialog
    // itself landed on the backdrop. Requiring the press to start there too
    // keeps a text selection dragged out of the panel from closing it.
    dialog.addEventListener("pointerdown", (event) => {
        pointerStartedOnBackdrop = event.target === dialog;
    });

    dialog.addEventListener("click", (event) => {
        if (event.target === dialog && pointerStartedOnBackdrop) {
            requestClose();
        }

        pointerStartedOnBackdrop = false;
    });

    // A native close (a non-cancelable Escape) skips requestClose, so the
    // close event finishes it. Closes started here have already finished by
    // the time the event arrives, and a popup opened since then has not been
    // shown yet or is open again, so neither is torn down by mistake.
    dialog.addEventListener("close", () => {
        if (!dialog.open && current?.shown) {
            finishClose(current);
        }
    });

    window.addEventListener("popstate", () => {
        if (pendingBack) {
            pendingBack = false;

            if (queuedOpen) {
                const id = queuedOpen;
                queuedOpen = null;
                openDetail(id, { push: true });
            }

            return;
        }

        syncFromLocation();
    });

    window.addEventListener("hashchange", () => syncFromLocation());

    syncFromLocation({ initial: true });
})();
