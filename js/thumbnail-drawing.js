// Build the overlay from the same projected paths as the resting JPEG.
// Import the scene kit only after the first eligible interaction.
const motion = matchMedia("(prefers-reduced-motion: no-preference)");
const mouse = matchMedia("(any-hover: hover) and (any-pointer: fine)");

for (const card of document.querySelectorAll(".project-card[data-project-id]")) {
    const media = card.querySelector(".project-media");
    let hovered = false;
    let focused = false;
    let active = false;
    let revision = 0;
    let layer;

    async function update() {
        const shouldDraw = motion.matches && (hovered || focused);
        if (active === shouldDraw) return;
        active = shouldDraw;
        const current = ++revision;
        layer?.remove();
        if (!active) return;

        try {
            const { renderSvgs } = await import("../scripts/thumbnails/scenes.mjs");
            if (revision !== current) return;
            const [drawing] = renderSvgs([card.dataset.projectId]);
            if (!drawing) return;

            const svg = new DOMParser().parseFromString(drawing.svg, "image/svg+xml").documentElement;
            // The photograph underneath supplies the paper texture. The faint
            // silhouette keeps the composition legible while its lines build.
            svg.querySelector("defs").remove();
            svg.querySelector("rect[filter]").remove();
            svg.querySelector("rect").setAttribute("opacity", "0.93");
            svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
            svg.setAttribute("aria-hidden", "true");
            svg.classList.add("thumbnail-drawing");
            const marks = svg.querySelector("g").children;
            for (const [index, mark] of Array.from(marks).entries()) {
                mark.style.setProperty("--start", Math.round(800 * index / marks.length) + "ms");
                if (!mark.hasAttribute("stroke-dasharray")) mark.setAttribute("pathLength", "1");
            }
            svg.addEventListener("animationend", event => {
                if (event.target === svg) svg.remove();
            });
            layer = svg;
            media.append(svg);
        } catch {
            // The static image stays available if the optional module cannot load.
        }
    }

    card.addEventListener("pointerenter", event => {
        hovered = event.pointerType !== "touch" && mouse.matches;
        update();
    });
    card.addEventListener("pointerleave", () => { hovered = false; update(); });
    card.addEventListener("focus", () => { focused = card.matches(":focus-visible"); update(); });
    card.addEventListener("blur", () => { focused = false; update(); });
    motion.addEventListener("change", update);
}
