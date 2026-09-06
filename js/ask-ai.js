(() => {
    const widget = document.querySelector(".ask-ai");
    if (!widget) return;

    const trigger = widget.querySelector(".ask-ai__trigger");
    const panel = widget.querySelector(".ask-ai__panel");
    const copy = widget.querySelector(".ask-ai__copy");
    const status = widget.querySelector(".ask-ai__status");
    const promptField = widget.querySelector(".ask-ai__prompt");
    const links = widget.querySelectorAll("[data-ai-provider]");
    const prompt = [
        "Tell me about MJ Kang, a Bay Area product manager who also builds AI projects.",
        "Start by reading his public portfolio summary at https://mj-kang.com/llms.txt and his website at https://mj-kang.com/.",
        "Use these additional public sources when useful: https://github.com/mjkang-estrella, https://blog.mj-kang.com/, and https://www.linkedin.com/in/mj-kang-product/.",
        "Give a balanced introduction to his product management experience and his hands-on AI projects, with concrete examples from both.",
        "Keep professional roles separate from personal projects. Explain what he builds and what his work suggests about his interests.",
        "Cite the sources you actually read, distinguish facts from interpretation, and say if a source is unavailable. Do not invent missing details or present ongoing projects as completed achievements.",
    ].join(" ");

    links.forEach((link) => {
        const url = new URL(link.href);
        url.searchParams.set("q", prompt);
        if (link.dataset.aiProvider === "chatgpt") {
            url.searchParams.set("hints", "search");
        }
        link.href = url.href;
    });
    promptField.value = prompt;
    let pinned = false;
    let hoverTimer = 0;
    let copyTimer = 0;

    const close = () => {
        window.clearTimeout(hoverTimer);
        pinned = false;
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
    };

    const open = (focus = false) => {
        window.clearTimeout(hoverTimer);
        if (panel.hidden) {
            status.textContent = "";
            promptField.hidden = true;
        }
        panel.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
        if (focus) links[0].focus();
    };

    trigger.addEventListener("click", () => {
        if (!panel.hidden && pinned) {
            close();
            return;
        }
        pinned = true;
        open(true);
    });

    widget.addEventListener("pointerenter", (event) => {
        if (event.pointerType === "touch" || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
        window.clearTimeout(hoverTimer);
        hoverTimer = window.setTimeout(() => open(), 140);
    });
    widget.addEventListener("pointerleave", (event) => {
        if (event.pointerType === "touch" || pinned || widget.contains(document.activeElement)) return;
        window.clearTimeout(hoverTimer);
        hoverTimer = window.setTimeout(close, 380);
    });

    links.forEach((link) => link.addEventListener("click", close));

    widget.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !panel.hidden) {
            event.preventDefault();
            close();
            trigger.focus();
        }
    });
    document.addEventListener("pointerdown", (event) => {
        if (!widget.contains(event.target)) close();
    });
    widget.addEventListener("focusout", (event) => {
        if (event.relatedTarget && !widget.contains(event.relatedTarget)) close();
    });

    copy.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(prompt);
            copy.textContent = "Copied";
            window.clearTimeout(copyTimer);
            copyTimer = window.setTimeout(() => {
                copy.textContent = "Copy the prompt instead";
            }, 1600);
            status.textContent = "Prompt copied. Paste it into your assistant.";
        } catch (error) {
            status.textContent = "Select and copy the prompt below.";
            promptField.hidden = false;
            promptField.focus();
            promptField.select();
        }
    });

    widget.hidden = false;

    // Recreate the reference's round bot and projected, pointer-following eyes
    // with a small SVG animation instead of importing its React animation engine.
    const bot = widget.querySelector(".ask-ai__bot");
    const eyes = widget.querySelectorAll(".ask-ai__eye");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let pointer = null;
    let frame = 0;
    let lastFrame = 0;
    const clamp = (value) => Math.max(-1, Math.min(1, value));
    const rotate = (first, second, degrees) => {
        const angle = degrees * Math.PI / 180;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return [first.map((v, i) => v * c + second[i] * s), second.map((v, i) => v * c - first[i] * s)];
    };
    const drawBot = (seconds = 0) => {
        const rect = bot.getBoundingClientRect();
        const x = pointer ? clamp((pointer.x - rect.left - rect.width / 2) / (innerWidth / 2)) : 0;
        const y = pointer ? clamp((pointer.y - rect.top - rect.height / 2) / (innerHeight / 2)) : 0;
        const wander = motion.matches || pointer ? 0 : Math.sin(seconds / 2) * 4;
        let front = [0, 0, 1], right = [1, 0, 0], up = [0, 1, 0];
        [front, right] = rotate(front, right, -26 + x * 16 + wander);
        [up, front] = rotate(up, front, 10 - y * 13);
        [right, up] = rotate(right, up, -13);
        const blinkTime = seconds % 4.7;
        const lid = motion.matches || blinkTime < 4.5 ? 1 : Math.max(.06, Math.abs((blinkTime - 4.6) / .1));
        eyes.forEach((eye, index) => {
            const [position, horizontal] = rotate(front, right, index === 0 ? -15.46 : 15.46);
            eye.setAttribute("transform", `matrix(${horizontal[0]},${horizontal[1] * lid},${up[0]},${up[1] * lid},${position[0] * 100},${position[1] * 100})`);
        });
    };
    const animate = (timestamp) => {
        if (timestamp - lastFrame >= 32) {
            drawBot(timestamp / 1000);
            lastFrame = timestamp;
        }
        frame = requestAnimationFrame(animate);
    };
    const syncAnimation = () => {
        cancelAnimationFrame(frame);
        drawBot();
        if (!motion.matches && !document.hidden) frame = requestAnimationFrame(animate);
    };
    window.addEventListener("pointermove", (event) => {
        if (event.pointerType !== "touch" && !motion.matches) pointer = { x: event.clientX, y: event.clientY };
    }, { passive: true });
    document.addEventListener("pointerleave", () => { pointer = null; });
    document.addEventListener("visibilitychange", syncAnimation);
    motion.addEventListener("change", syncAnimation);
    syncAnimation();
})();
