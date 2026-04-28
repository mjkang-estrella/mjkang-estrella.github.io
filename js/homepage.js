(() => {
    const body = document.body;
    const modeButtons = document.querySelectorAll("[data-view-mode]");
    const modeLine = document.querySelector("[data-mode-line]");
    const machineDocument = document.querySelector(".machine-document");
    const copyMachineProfileButton = document.querySelector(
        "[data-copy-machine-profile]"
    );
    const viewModes = new Set(["human", "machine"]);
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

        window.setTimeout(() => {
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
            });
        });
    };

    const transitionToHuman = () => {
        if (!machineDocument) {
            updateMode("human");
            return;
        }

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
            machineDocument.setAttribute("aria-hidden", "true");
            document.querySelectorAll("[data-human]").forEach((element) => {
                element.setAttribute("aria-hidden", "false");
            });

            if (shouldReplayHumanReveal) {
                playHumanPageLoadReveal();
            }
        });

        window.setTimeout(() => {
            machineDocument.classList.remove("is-exiting");
            body.classList.remove("is-mode-transitioning");
            body.classList.remove("is-exiting-machine");
        }, 840);
    };

    const updateMode = (mode, shouldPersist = true, sourceRects = null) => {
        body.dataset.portfolioView = mode;

        modeButtons.forEach((button) => {
            const isActive = button.dataset.viewMode === mode;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });

        document.querySelectorAll("[data-machine]").forEach((element) => {
            element.setAttribute("aria-hidden", String(mode !== "machine"));
        });

        document.querySelectorAll("[data-human]").forEach((element) => {
            element.setAttribute("aria-hidden", String(mode === "machine"));
        });

        if (machineDocument) {
            machineDocument.setAttribute("aria-hidden", String(mode !== "machine"));
        }

        setMachineDocumentTransition(mode, sourceRects);

        if (modeLine) {
            modeLine.textContent =
                mode === "machine"
                    ? "view=machine · same DOM data · markdown export ready"
                    : "view=human · narrative portfolio · visual scan";
        }

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

    const getSocialMarkdownLinks = () =>
        Array.from(document.querySelectorAll(".social-links a")).map((link) =>
            markdownLink(link.textContent.trim(), link.href)
        );

    const getEmailMarkdownLink = () => {
        const emailLink = document.querySelector('.footer-contact a[href^="mailto:"]');
        return emailLink
            ? markdownLink(emailLink.textContent.trim(), emailLink.href)
            : "[Email](mailto:mj.kang@hey.com)";
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
                `${emailMarkdownLink} · San Francisco, CA`
            ),
            createMachineElement("h2", "## Social"),
            createMachineElement("p", socialLinks.join(" ")),
            createMachineElement("h2", "## Colophon"),
            createMachineElement("p", "Typeset in Geist Sans. © 2026 MJ Kang."),
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

        const lines = [
            "# MJ Kang",
            "",
            "Agent-readable portfolio generated from the same visible page content at https://mj-kang.com/.",
            "",
            "## Profile",
            "",
            "- Role: Product Manager",
            "- Location: Bay Area",
            "- Focus: fintech, live streaming, logistics, agentic AI, product systems",
            "- Contact: mj.kang@hey.com",
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
            "- Email: mj.kang@hey.com",
            "- Location: San Francisco, CA",
            "",
            "## Social",
            "",
            "- LinkedIn: https://www.linkedin.com/in/mj-kang-product/",
            "- X: https://x.com/mj_kang",
            "- GitHub: https://github.com/mjkang-estrella",
            "- Blog: https://blog.mj-kang.com/",
            "",
            "## Colophon",
            "",
            "- Typeset in Geist Sans.",
            "- © 2026 MJ Kang."
        );

        return lines.join("\n");
    };

    const copyMachineProfile = async () => {
        if (!copyMachineProfileButton || !navigator.clipboard) {
            return;
        }

        const originalText = copyMachineProfileButton.textContent;
        await navigator.clipboard.writeText(buildMachineProfileMarkdown());
        copyMachineProfileButton.textContent = "Copied";

        window.setTimeout(() => {
            copyMachineProfileButton.textContent = originalText;
        }, 1400);
    };

    modeButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const mode = button.dataset.viewMode;

            if (viewModes.has(mode)) {
                if (
                    mode === "human" &&
                    body.dataset.portfolioView === "machine"
                ) {
                    transitionToHuman();
                    return;
                }

                const sourceRects =
                    mode === "machine" ? captureMachineSourceRects() : null;

                body.classList.add("is-mode-transitioning");
                updateMode(mode, true, sourceRects);
                window.setTimeout(() => {
                    body.classList.remove("is-mode-transitioning");
                }, 820);
            }
        });
    });

    if (copyMachineProfileButton) {
        copyMachineProfileButton.addEventListener("click", () => {
            copyMachineProfile().catch(() => {
                copyMachineProfileButton.textContent = "Copy failed";
            });
        });
    }

    renderMachineDocumentFromPage();
    updateMode(getModeFromUrl() || getStoredMode() || "human", false);
})();

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
    initProfilePhotoFallback();
    initRevealMotion(root);
    initScrollProgress(root);
})();
