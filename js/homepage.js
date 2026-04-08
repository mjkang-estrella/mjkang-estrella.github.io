(() => {
    const root = document.documentElement;
    const profilePhoto = document.querySelector(".profile-photo");

    const hideBrokenProfilePhoto = () => {
        if (profilePhoto) {
            profilePhoto.style.display = "none";
        }
    };

    if (profilePhoto) {
        if (profilePhoto.complete && profilePhoto.naturalWidth === 0) {
            hideBrokenProfilePhoto();
        } else {
            profilePhoto.addEventListener("error", hideBrokenProfilePhoto, {
                once: true,
            });
        }
    }

    if (!root.classList.contains("has-motion")) {
        return;
    }

    const revealAll = () => {
        document.querySelectorAll("[data-reveal]").forEach((element) => {
            element.classList.add("is-visible");
        });
    };

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

        document
            .querySelectorAll(
                ".grid-row [data-reveal], .works-header [data-reveal], .projects-wrapper [data-reveal], .footer-grid [data-reveal]"
            )
            .forEach((element) => {
                if (element.closest(".header-content")) {
                    return;
                }

                revealObserver.observe(element);
            });

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
    } catch (error) {
        root.classList.remove("has-motion");
        revealAll();
    }
})();
