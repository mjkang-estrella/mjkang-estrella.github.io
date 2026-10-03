// Captures the project screenshots shown on card hover and in the popup.
//
//   node scripts/capture.mjs              capture every project listed below
//   node scripts/capture.mjs prism soma   capture only these ids
//
// Screenshots are real renders of each product rather than illustrations,
// so they go stale when a product changes; rerun this, check the images, and
// commit them. It needs network access for the external projects and serves
// the same-origin ones itself. Afterwards run `npm run build`.
//
// Projects without a screenshot here keep their ink mark in the popup:
//   reader       the live app shows the owner's personal library
//   conditioned  the linked site is a sign-in wall with a dead backend
//   reflect-ios  TestFlight has nothing to show, and the beta is closed

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "images/projects/screens");
const PORT = 4181;
const LOCAL = `http://127.0.0.1:${PORT}`;

// 16:10 like the card and popup frames. 1024px wide keeps every app in its
// desktop layout; 1.5x keeps text crisp at the popup's display size. A shot
// may override the viewport and clip, but the result must stay 16:10.
const VIEWPORT = { width: 1024, height: 640 };
const SCALE = 1.5;

/** Scrolls so `selector`'s top sits `offset` px below the viewport top. */
const scrollToTop = (page, selector, offset = 24) =>
    page.evaluate(
        ([target, gap]) => {
            const element = document.querySelector(target);
            window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - gap);
        },
        [selector, offset]
    );

const SHOTS = [
    { id: "akashic-computer", url: "https://akashic.computer/" },
    {
        // The README opens by saying the proof is not complete. A narrow
        // viewport lets it fill the frame; the offset clears GitHub's sticky
        // README tab bar.
        id: "poincare-lean",
        url: "https://github.com/mjkang-estrella/poincare-lean",
        viewport: { width: 720, height: 450 },
        scale: 2,
        prepare: (page) => scrollToTop(page, "article.markdown-body", 72),
    },
    {
        // The rack photo from the write-up says more than a page capture.
        id: "personal-ai-lab",
        photo: "https://storage.ghost.io/c/43/79/43790fcd-6eda-4599-b65b-6f880096bb1a/content/images/2026/08/IMG_1009.jpeg",
        position: "50% 30%",
    },
    { id: "soma", url: "https://mj-kang.com/soma-context/" },
    { id: "precortex", url: "https://www.pre-cortex.com/?demo=1" },
    {
        // The session list (the left panel) holds the owner's own sessions;
        // frame only the example session beside it.
        id: "prism",
        url: "https://prism.mj-kang.com/",
        viewport: { width: 1304, height: 640 },
        clip: (page) =>
            page.evaluate(() => {
                const x = document.querySelector(".panel-left").getBoundingClientRect().right;
                const width = window.innerWidth - x;
                return { x, y: 0, width, height: width / 1.6 };
            }),
    },
    { id: "caption-with-intent", url: "https://cwi.mj-kang.com/" },
    {
        // The product is the JSON edition itself, so show a real item, at a
        // narrower viewport so the monospace text stays legible.
        id: "agent-newsletter",
        url: "https://agent-news.mj-kang.com/api/newsletter/latest",
        viewport: { width: 768, height: 480 },
        scale: 2,
        prepare: (page) =>
            page.evaluate(() => {
                if (!window.find('"items"')) return;
                const { top } = window.getSelection().getRangeAt(0).getBoundingClientRect();
                window.getSelection().removeAllRanges();
                window.scrollBy(0, top - 28);
            }),
    },
    {
        // On load the Resume OS bullet opens its story beside the resume,
        // which is the product's core idea; 1920px fits both panels. The
        // contact line is hidden so a phone number isn't baked into an image.
        id: "resume-os",
        url: "https://resume-os.com/",
        viewport: { width: 1920, height: 1200 },
        scale: 0.8,
        prepare: async (page) => {
            await page.waitForSelector("aside.deck", { state: "visible" });
            await page.waitForTimeout(1500);
            await page.evaluate(() => {
                // \D between the groups: the page uses a non-breaking hyphen.
                const phone = /\(\d{3}\)\s*\d{3}\D\d{4}/;
                const hasPhone = (element) => phone.test(element.textContent);
                // The number is a link inside the contact line; hide the line.
                [...document.querySelectorAll("body *")]
                    .filter((element) => hasPhone(element) && ![...element.children].some(hasPhone))
                    .forEach((element) => (element.parentElement.style.visibility = "hidden"));
            });
        },
    },
    {
        id: "three-body-simulator",
        url: `${LOCAL}/three-body-problem-simulation/`,
        prepare: async (page) => {
            await page.selectOption("#preset-select", "figure-eight");
            await page.click("#run-btn");
            await page.locator("#run-btn").scrollIntoViewIfNeeded();
            await page.waitForTimeout(3500);
        },
    },
    {
        id: "block-fighter",
        url: `${LOCAL}/block-fighter/`,
        prepare: async (page) => {
            await page.keyboard.press("Space");
            await page.waitForTimeout(6000);
        },
    },
    {
        id: "rent-calculator",
        url: `${LOCAL}/jeonse/`,
        prepare: (page) => page.click("#btnExample"),
    },
    { id: "retirement-calculator", url: `${LOCAL}/retirement-calculator/` },
];

const startServer = () =>
    new Promise((resolveServer, reject) => {
        const server = spawn("python3", ["tests/serve.py", String(PORT)], {
            cwd: ROOT,
            stdio: "ignore",
        });
        server.once("error", reject);
        // serve.py has no ready signal; poll until it answers.
        const poll = async (attempt = 0) => {
            try {
                await fetch(`${LOCAL}/`);
                resolveServer(server);
            } catch (error) {
                if (attempt > 50) reject(error);
                else setTimeout(() => poll(attempt + 1), 100);
            }
        };
        poll();
    });

const wanted = new Set(process.argv.slice(2));
const shots = SHOTS.filter((shot) => !wanted.size || wanted.has(shot.id));

if (!shots.length) {
    console.error(`No capture configured for: ${[...wanted].join(", ")}`);
    process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const server = await startServer();
const browser = await chromium.launch();
let failed = 0;

try {
    for (const shot of shots) {
        const viewport = shot.viewport || VIEWPORT;
        const context = await browser.newContext({
            viewport,
            deviceScaleFactor: shot.scale || SCALE,
            colorScheme: "light",
        });
        const page = await context.newPage();
        const path = resolve(OUT_DIR, `${shot.id}.jpg`);

        try {
            if (shot.photo) {
                // Crop a photo to the 16:10 frame by laying it out as a cover.
                await page.setContent(
                    `<body style="margin:0"><img src="${shot.photo}" style="width:100vw;height:100vh;object-fit:cover;object-position:${shot.position || "50% 50%"};display:block"></body>`,
                    { waitUntil: "networkidle", timeout: 45000 }
                );
            } else {
                await page.goto(shot.url, { waitUntil: "networkidle", timeout: 45000 });
                await shot.prepare?.(page);
            }
            // Let fonts, entry animations and lazy content settle.
            await page.evaluate(() => document.fonts.ready);
            await page.waitForTimeout(1200);
            const clip = typeof shot.clip === "function" ? await shot.clip(page) : shot.clip;
            await page.screenshot({ path, type: "jpeg", quality: 82, clip });
            console.log(`ok    ${shot.id}`);
        } catch (error) {
            failed += 1;
            console.error(`fail  ${shot.id}: ${error.message.split("\n")[0]}`);
        } finally {
            await context.close();
        }
    }
} finally {
    await browser.close();
    server.kill();
}

process.exit(failed ? 1 : 0);
