// Shared with the reveal-motion setup at the bottom of this file so the mode
// toggle can re-arm scroll reveals after stripping .is-visible.
let homepageRevealObserver = null;

(() => {
    const body = document.body;
    const modeButtons = document.querySelectorAll("[data-view-mode]");
    const skipLink = document.querySelector(".skip-link");
    const machineDocument = document.querySelector(".machine-document");
    const copyMachineProfileButton = document.querySelector(
        "[data-copy-machine-profile]"
    );
    const viewModes = new Set(["human", "machine"]);
    let machineEnterTimer = 0;
    let humanExitTimer = 0;
    let modeWashTimer = 0;
    const machineSourceSelectors = {
        nav: "footer",
        hero: '[data-human-block="hero"]',
        profile: '[data-human-block="profile"]',
        history: '[data-human-block="history"]',
        works: '[data-human-block="works"]',
        footer: '[data-human-block="footer"]',
    };

    const getModeFromUrl = () => {
        const params = new URLSearchParams(window.location.search);
        const mode = params.get("view");
        return viewModes.has(mode) ? mode : null;
    };

    const getStoredMode = () => {
        try {
            const mode = window.localStorage.getItem("portfolio-view");
            return viewModes.has(mode) ? mode : null;
        } catch (error) {
            return null;
        }
    };

    const setStoredMode = (mode) => {
        try {
            window.localStorage.setItem("portfolio-view", mode);
        } catch (error) {
            // Storage can be unavailable in private or embedded contexts.
        }
    };

    const setUrlMode = (mode) => {
        const url = new URL(window.location.href);

        if (mode === "machine") {
            url.searchParams.set("view", "machine");
        } else {
            url.searchParams.delete("view");
        }

        window.history.replaceState({}, "", url);
    };

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    const syncSkipLinkTarget = (mode) => {
        if (skipLink) {
            skipLink.setAttribute(
                "href",
                mode === "machine" ? "#machine-content" : "#main-content"
            );
        }
    };

    const cancelPendingModeTransitions = () => {
        window.clearTimeout(machineEnterTimer);
        window.clearTimeout(humanExitTimer);
        window.clearTimeout(modeWashTimer);
        body.classList.remove("is-mode-transitioning");
        body.classList.remove("is-exiting-machine");

        if (machineDocument) {
            machineDocument.classList.remove("is-entering");
            machineDocument.classList.remove("is-exiting");
        }
    };

    const captureMachineSourceRects = () => {
        const rects = {};

        Object.entries(machineSourceSelectors).forEach(([key, selector]) => {
            const element = document.querySelector(selector);

            if (!element) {
                return;
            }

            rects[key] = element.getBoundingClientRect();
        });

        return rects;
    };

    const captureHumanTargetRects = () => {
        body.classList.add("is-preparing-human");
        const rects = captureMachineSourceRects();
        body.classList.remove("is-preparing-human");
        return rects;
    };

    const setBlockMotionVars = (targetRects) => {
        if (!machineDocument) {
            return;
        }

        machineDocument.querySelectorAll("[data-machine-block]").forEach((block) => {
            const key = block.dataset.machineBlock;
            const targetRect = targetRects ? targetRects[key] : null;
            const blockRect = block.getBoundingClientRect();
            const x = targetRect ? targetRect.left - blockRect.left : 0;
            const y = targetRect ? targetRect.top - blockRect.top : 18;
            const scaleX = targetRect
                ? clamp(targetRect.width / Math.max(blockRect.width, 1), 0.72, 1.2)
                : 1;
            const scaleY = targetRect
                ? clamp(targetRect.height / Math.max(blockRect.height, 1), 0.72, 1.2)
                : 1;

            block.style.setProperty("--machine-x", `${Math.round(x)}px`);
            block.style.setProperty("--machine-y", `${Math.round(y)}px`);
            block.style.setProperty("--machine-scale-x", scaleX.toFixed(3));
            block.style.setProperty("--machine-scale-y", scaleY.toFixed(3));
        });
    };

    const setMachineDocumentTransition = (mode, sourceRects = null) => {
        if (!machineDocument) {
            return;
        }

        machineDocument.classList.remove("is-entering");
        machineDocument.classList.remove("is-exiting");

        if (mode !== "machine") {
            return;
        }

        setBlockMotionVars(sourceRects);

        requestAnimationFrame(() => {
            machineDocument.classList.add("is-entering");
        });

        machineEnterTimer = window.setTimeout(() => {
            machineDocument.classList.remove("is-entering");
        }, 760);
    };

    const getRevealElements = () => ({
        all: document.querySelectorAll("[data-reveal]"),
        hero: document.querySelectorAll(".header-content [data-reveal]"),
    });

    const resetHumanPageLoadReveal = () => {
        const root = document.documentElement;

        if (!root.classList.contains("has-motion")) {
            return false;
        }

        const { all: revealElements } = getRevealElements();

        root.classList.add("is-resetting-human-reveal");
        revealElements.forEach((element) => {
            element.classList.remove("is-visible");
        });

        // Flush the hidden reveal state before re-applying page-load motion.
        document.body.offsetHeight;
        return true;
    };

    const playHumanPageLoadReveal = () => {
        const root = document.documentElement;
        const { all: revealElements, hero: heroElements } = getRevealElements();

        requestAnimationFrame(() => {
            root.classList.remove("is-resetting-human-reveal");

            requestAnimationFrame(() => {
                heroElements.forEach((element) => {
                    element.classList.add("is-visible");
                });

                revealElements.forEach((element) => {
                    if (element.closest(".header-content")) {
                        return;
                    }

                    const rect = element.getBoundingClientRect();
                    const isNearViewport =
                        rect.top < window.innerHeight * 1.22 && rect.bottom > 0;

                    if (isNearViewport) {
                        element.classList.add("is-visible");
                    }
                });

                // The reveal observer unobserves elements once shown, so
                // anything stripped above must be re-armed or it would stay
                // hidden forever after a machine -> human round trip.
                revealElements.forEach((element) => {
                    if (element.classList.contains("is-visible")) {
                        return;
                    }

                    if (homepageRevealObserver) {
                        homepageRevealObserver.observe(element);
                    } else {
                        element.classList.add("is-visible");
                    }
                });
            });
        });
    };

    const transitionToHuman = () => {
        if (!machineDocument) {
            updateMode("human");
            return;
        }

        cancelPendingModeTransitions();
        const targetRects = captureHumanTargetRects();
        setBlockMotionVars(targetRects);
        body.classList.add("is-mode-transitioning");
        body.classList.add("is-exiting-machine");
        machineDocument.classList.remove("is-entering");
        machineDocument.classList.add("is-exiting");

        modeButtons.forEach((button) => {
            const isActive = button.dataset.viewMode === "human";
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });

        setStoredMode("human");
        setUrlMode("human");
        const shouldReplayHumanReveal = resetHumanPageLoadReveal();

        requestAnimationFrame(() => {
            body.dataset.portfolioView = "human";
            syncSkipLinkTarget("human");
            machineDocument.setAttribute("aria-hidden", "true");
            document.querySelectorAll("[data-human-block]").forEach((element) => {
                element.setAttribute("aria-hidden", "false");
            });

            if (shouldReplayHumanReveal) {
                playHumanPageLoadReveal();
            }
        });

        humanExitTimer = window.setTimeout(() => {
            machineDocument.classList.remove("is-exiting");
            body.classList.remove("is-mode-transitioning");
            body.classList.remove("is-exiting-machine");
        }, 840);
    };

    const updateMode = (mode, shouldPersist = true, sourceRects = null) => {
        body.dataset.portfolioView = mode;
        syncSkipLinkTarget(mode);

        modeButtons.forEach((button) => {
            const isActive = button.dataset.viewMode === mode;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });

        document.querySelectorAll("[data-machine]").forEach((element) => {
            element.setAttribute("aria-hidden", String(mode !== "machine"));
        });

        document.querySelectorAll("[data-human-block]").forEach((element) => {
            element.setAttribute("aria-hidden", String(mode === "machine"));
        });

        if (machineDocument) {
            machineDocument.setAttribute("aria-hidden", String(mode !== "machine"));
        }

        setMachineDocumentTransition(mode, sourceRects);

        if (shouldPersist) {
            setStoredMode(mode);
            setUrlMode(mode);
        }
    };

    const textOf = (element, selector) => {
        const match = element.querySelector(selector);
        return match ? match.textContent.trim().replace(/\s+/g, " ") : "";
    };

    const absoluteUrl = (href) => {
        const siteOrigin = "https://mj-kang.com";
        return href.startsWith("/")
            ? `${siteOrigin}${href}`
            : new URL(href, siteOrigin).href;
    };

    const markdownLink = (label, href) => `[${label}](${absoluteUrl(href)})`;

    const createMachineElement = (tagName, text) => {
        const element = document.createElement(tagName);
        element.textContent = text;
        return element;
    };

    const replaceMachineBlock = (blockName, elements) => {
        if (!machineDocument) {
            return;
        }

        const block = machineDocument.querySelector(
            `[data-machine-block="${blockName}"]`
        );

        if (block) {
            block.replaceChildren(...elements);
        }
    };

    const getProjectData = () =>
        Array.from(document.querySelectorAll(".project-card")).map((project) => ({
            title: textOf(project, ".project-title"),
            description: textOf(project, ".project-desc"),
            href: absoluteUrl(project.getAttribute("href") || "/"),
            kind: project.dataset.kind || "project",
            domain: project.dataset.domain || "unspecified",
            status: project.dataset.status || "available",
        }));

    const getTimelineData = () =>
        Array.from(
            document.querySelectorAll(".timeline-item[data-machine-kind]")
        ).map((item) => ({
            kind: item.dataset.machineKind,
            date: textOf(item, ".timeline-date"),
            organization: textOf(item, ".company-name"),
            title: textOf(item, ".role-title"),
            description: textOf(item, ".dense-text"),
            href: item.querySelector(".company-link")?.getAttribute("href") || "",
        }));

    const getSocialEntries = () =>
        Array.from(document.querySelectorAll(".social-links a")).map((link) => ({
            label: link.textContent.trim(),
            href: link.href,
        }));

    const getSocialMarkdownLinks = () =>
        getSocialEntries().map((entry) => markdownLink(entry.label, entry.href));

    const getContactEmail = () => {
        const emailLink = document.querySelector('.footer-contact a[href^="mailto:"]');
        return emailLink ? emailLink.textContent.trim() : "mj.kang@hey.com";
    };

    const getEmailMarkdownLink = () => {
        const emailLink = document.querySelector('.footer-contact a[href^="mailto:"]');
        return emailLink
            ? markdownLink(emailLink.textContent.trim(), emailLink.href)
            : "[Email](mailto:mj.kang@hey.com)";
    };

    const getFooterLocation = () => {
        const contact = document.querySelector(".footer-contact");

        if (!contact) {
            return "San Francisco, CA";
        }

        const clone = contact.cloneNode(true);
        clone.querySelectorAll("a").forEach((link) => link.remove());
        return clone.textContent.trim().replace(/\s+/g, " ");
    };

    const getColophonText = () => {
        const block = Array.from(document.querySelectorAll(".footer-block")).find(
            (candidate) => textOf(candidate, ".footer-heading") === "Colophon"
        );

        if (!block) {
            return "© MJ Kang.";
        }

        const clone = block.cloneNode(true);
        const heading = clone.querySelector(".footer-heading");

        if (heading) {
            heading.remove();
        }

        return clone.textContent.trim().replace(/\s+/g, " ");
    };

    const getProfileFacts = () => {
        const subtitle = textOf(document, ".profile-subtitle");
        const [role, location] = subtitle.split(/\s*Based in\s*/);

        return {
            role: role ? role.trim() : "Product Manager",
            location: location ? location.trim() : "Bay Area",
        };
    };

    const renderMachineNav = (socialLinks, emailMarkdownLink) => {
        replaceMachineBlock("nav", [
            createMachineElement("p", "MJ Kang"),
            createMachineElement(
                "p",
                [
                    emailMarkdownLink,
                    ...socialLinks.filter((link) => !link.includes("[X](")),
                ].join(" ")
            ),
            createMachineElement(
                "p",
                [
                    "[llms.txt](https://mj-kang.com/llms.txt)",
                    "[agent-skills](https://mj-kang.com/.well-known/agent-skills/index.json)",
                ].join(" ")
            ),
        ]);
    };

    const renderMachineHero = () => {
        replaceMachineBlock("hero", [
            createMachineElement("h1", `# ${textOf(document, "#profile-title")}`),
            createMachineElement("p", textOf(document, ".profile-subtitle")),
            createMachineElement("p", textOf(document, ".intro-heading")),
        ]);
    };

    const renderMachineProfile = () => {
        const profileParagraphs = Array.from(
            document.querySelectorAll('[data-human-block="profile"] .body-text')
        ).map((paragraph) => paragraph.textContent.trim().replace(/\s+/g, " "));

        replaceMachineBlock("profile", [
            createMachineElement("h2", "## Profile"),
            ...profileParagraphs.map((paragraph) =>
                createMachineElement("p", paragraph)
            ),
        ]);
    };

    const renderTimelineGroup = (timelineItems, kind) =>
        timelineItems
            .filter((item) => item.kind === kind)
            .map((item) =>
                createMachineElement(
                    "p",
                    `- ${item.date} · ${markdownLink(
                        item.organization,
                        item.href
                    )} · ${item.title} · ${item.description}`
                )
            );

    const renderMachineHistory = (timelineItems) => {
        replaceMachineBlock("history", [
            createMachineElement("h2", "## History"),
            createMachineElement("h3", "### Experience"),
            ...renderTimelineGroup(timelineItems, "experience"),
            createMachineElement("h3", "### Education"),
            ...renderTimelineGroup(timelineItems, "education"),
        ]);
    };

    const renderMachineWorks = (projects) => {
        replaceMachineBlock("works", [
            createMachineElement("h2", "## Selected Works"),
            ...projects.map((project) =>
                createMachineElement(
                    "p",
                    `- ${markdownLink(project.title, project.href)} · ${
                        project.description
                    }`
                )
            ),
        ]);
    };

    const renderMachineFooter = (socialLinks, emailMarkdownLink) => {
        replaceMachineBlock("footer", [
            createMachineElement("h2", "## Contact"),
            createMachineElement(
                "p",
                `${emailMarkdownLink} · ${getFooterLocation()}`
            ),
            createMachineElement("h2", "## Social"),
            createMachineElement("p", socialLinks.join(" ")),
            createMachineElement("h2", "## Colophon"),
            createMachineElement("p", getColophonText()),
        ]);
    };

    const renderMachineDocumentFromPage = () => {
        if (!machineDocument) {
            return;
        }

        const projects = getProjectData();
        const timelineItems = getTimelineData();
        const socialLinks = getSocialMarkdownLinks();
        const emailMarkdownLink = getEmailMarkdownLink();

        renderMachineNav(socialLinks, emailMarkdownLink);
        renderMachineHero();
        renderMachineProfile();
        renderMachineHistory(timelineItems);
        renderMachineWorks(projects);
        renderMachineFooter(socialLinks, emailMarkdownLink);
    };

    const buildMachineProfileMarkdown = () => {
        const projects = getProjectData();
        const timelineItems = getTimelineData();
        const profileFacts = getProfileFacts();

        const lines = [
            "# MJ Kang",
            "",
            "Agent-readable portfolio generated from the same visible page content at https://mj-kang.com/.",
            "",
            "## Profile",
            "",
            `- Role: ${profileFacts.role}`,
            `- Location: ${profileFacts.location}`,
            "- Focus: fintech, live streaming, logistics, agentic AI, product systems",
            `- Contact: ${getContactEmail()}`,
            "",
            "## Selected Works",
            "",
        ];

        projects.forEach((project) => {
            lines.push(
                `### ${project.title}`,
                "",
                `- Description: ${project.description}`,
                `- URL: ${project.href}`,
                `- Kind: ${project.kind}`,
                `- Domain: ${project.domain}`,
                `- Status: ${project.status}`,
                ""
            );
        });

        lines.push("## History", "");

        timelineItems.forEach((item) => {
            lines.push(
                `- ${item.date} | ${item.organization} | ${item.title} | ${item.description}`
            );
        });

        lines.push(
            "",
            "## Machine Discovery",
            "",
            "- llms.txt: https://mj-kang.com/llms.txt",
            "- Agent skills: https://mj-kang.com/.well-known/agent-skills/index.json",
            "",
            "## Contact",
            "",
            `- Email: ${getContactEmail()}`,
            `- Location: ${getFooterLocation()}`,
            "",
            "## Social",
            ""
        );

        getSocialEntries().forEach((entry) => {
            lines.push(`- ${entry.label}: ${entry.href}`);
        });

        lines.push("", "## Colophon", "", `- ${getColophonText()}`);

        return lines.join("\n");
    };

    modeButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const mode = button.dataset.viewMode;

            if (!viewModes.has(mode) || mode === body.dataset.portfolioView) {
                return;
            }

            if (mode === "human") {
                transitionToHuman();
                return;
            }

            cancelPendingModeTransitions();
            const sourceRects = captureMachineSourceRects();

            body.classList.add("is-mode-transitioning");
            updateMode(mode, true, sourceRects);
            modeWashTimer = window.setTimeout(() => {
                body.classList.remove("is-mode-transitioning");
            }, 820);
        });
    });

    if (copyMachineProfileButton) {
        if (!navigator.clipboard) {
            // Clipboard API is unavailable (e.g. non-secure contexts);
            // showing a button that silently does nothing is worse than none.
            copyMachineProfileButton.hidden = true;
        } else {
            const defaultCopyLabel = copyMachineProfileButton.textContent;
            let copyLabelTimer = 0;

            const flashCopyLabel = (label) => {
                copyMachineProfileButton.textContent = label;
                window.clearTimeout(copyLabelTimer);
                copyLabelTimer = window.setTimeout(() => {
                    copyMachineProfileButton.textContent = defaultCopyLabel;
                }, 1400);
            };

            copyMachineProfileButton.addEventListener("click", () => {
                navigator.clipboard
                    .writeText(buildMachineProfileMarkdown())
                    .then(() => flashCopyLabel("Copied"))
                    .catch(() => flashCopyLabel("Copy failed"));
            });
        }
    }

    renderMachineDocumentFromPage();
    updateMode(getModeFromUrl() || getStoredMode() || "human", false);
})();

// Detail screenshots are only revealed by hover/focus-visible, so their src
// lives in data-detail-src and is attached only on hover-capable devices —
// touch devices never pay for images they cannot reveal.
const initProjectDetailImages = () => {
    const detailImages = document.querySelectorAll(
        ".project-card img[data-detail-src]"
    );

    if (!detailImages.length) {
        return;
    }

    if (!(window.matchMedia && window.matchMedia("(hover: hover)").matches)) {
        return;
    }

    const attachDetailSource = (img) => {
        if (img.dataset.detailSrc) {
            img.src = img.dataset.detailSrc;
            delete img.dataset.detailSrc;
        }
    };

    document.querySelectorAll(".project-card").forEach((card) => {
        const loadCardDetail = () => {
            card.querySelectorAll("img[data-detail-src]").forEach(
                attachDetailSource
            );
        };

        card.addEventListener("mouseenter", loadCardDetail, { once: true });
        card.addEventListener("focus", loadCardDetail, { once: true });
    });

    // Prefetch the rest once the page is idle so the first hover crossfade
    // is instant; loading="lazy" still defers offscreen fetches.
    const prefetchAll = () => {
        detailImages.forEach(attachDetailSource);
    };

    window.addEventListener(
        "load",
        () => {
            if ("requestIdleCallback" in window) {
                window.requestIdleCallback(prefetchAll, { timeout: 4000 });
            } else {
                window.setTimeout(prefetchAll, 2500);
            }
        },
        { once: true }
    );
};

const initProfilePhotoFallback = () => {
    const profilePhoto = document.querySelector(".profile-photo");

    const hideBrokenProfilePhoto = () => {
        if (profilePhoto) {
            profilePhoto.style.display = "none";
        }
    };

    if (!profilePhoto) {
        return;
    }

    if (profilePhoto.complete && profilePhoto.naturalWidth === 0) {
        hideBrokenProfilePhoto();
        return;
    }

    profilePhoto.addEventListener("error", hideBrokenProfilePhoto, {
        once: true,
    });
};

const revealVisibleItems = (revealObserver) => {
    document
        .querySelectorAll(
            ".grid-row [data-reveal], .works-header [data-reveal], .projects-wrapper [data-reveal], .footer-grid [data-reveal]"
        )
        .forEach((element) => {
            if (!element.closest(".header-content")) {
                revealObserver.observe(element);
            }
        });
};

const initRevealMotion = (root) => {
    const revealAll = () => {
        document.querySelectorAll("[data-reveal]").forEach((element) => {
            element.classList.add("is-visible");
        });
    };

    if (!root.classList.contains("has-motion")) {
        return;
    }

    try {
        const setStagger = (selector, step, limit = Infinity) => {
            document.querySelectorAll(selector).forEach((element, index) => {
                const delay = Math.min(index, limit) * step;
                element.style.setProperty("--reveal-delay", `${delay}ms`);
            });
        };

        setStagger(".header-content [data-reveal]", 55);
        setStagger(".history-columns .timeline-item[data-reveal]", 45, 4);
        setStagger(".projects-wrapper .project-card[data-reveal]", 40, 5);
        setStagger(".footer-grid > [data-reveal]", 55);

        const heroElements = document.querySelectorAll(
            ".header-content [data-reveal]"
        );

        requestAnimationFrame(() => {
            heroElements.forEach((element) => {
                element.classList.add("is-visible");
            });
        });

        if (!("IntersectionObserver" in window)) {
            revealAll();
            return;
        }

        const revealObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return;
                    }

                    entry.target.classList.add("is-visible");
                    revealObserver.unobserve(entry.target);
                });
            },
            {
                threshold: 0.05,
                rootMargin: "0px 0px 22% 0px",
            }
        );

        homepageRevealObserver = revealObserver;
        revealVisibleItems(revealObserver);
    } catch (error) {
        root.classList.remove("has-motion");
        revealAll();
    }
};

const initScrollProgress = (root) => {
    if (!root.classList.contains("has-motion")) {
        return;
    }

    const updateScrollProgress = () => {
        const scrollableHeight =
            document.documentElement.scrollHeight - window.innerHeight;
        const progress =
            scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;

        root.style.setProperty("--scroll-progress", progress.toFixed(4));
    };

    let ticking = false;

    const requestProgressUpdate = () => {
        if (ticking) {
            return;
        }

        ticking = true;
        requestAnimationFrame(() => {
            updateScrollProgress();
            ticking = false;
        });
    };

    window.addEventListener("scroll", requestProgressUpdate, {
        passive: true,
    });
    window.addEventListener("resize", requestProgressUpdate, {
        passive: true,
    });

    updateScrollProgress();
};

(() => {
    const root = document.documentElement;
    initProjectDetailImages();
    initProfilePhotoFallback();
    initRevealMotion(root);
    initScrollProgress(root);
})();
