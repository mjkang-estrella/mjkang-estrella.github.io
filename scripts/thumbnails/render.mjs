// Renders the isometric project thumbnails to images/projects/<id>-iso.jpg.
//
//   node scripts/thumbnails/render.mjs              # every project
//   node scripts/thumbnails/render.mjs soma folio   # only these ids
//
// Scenes live in scenes.mjs; the drawing kit in iso.mjs. Output is 1200x750 (16:10).

import { chromium } from "@playwright/test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSvgs } from "./scenes.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const WIDTH = 1200;

const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 720, height: 450 }, deviceScaleFactor: WIDTH / 720 });
    for (const { id, svg } of renderSvgs(process.argv.slice(2))) {
        await page.setContent(`<style>html,body{margin:0}</style>${svg}`);
        const path = join(ROOT, "images/projects", `${id}-iso.jpg`);
        await page.locator("svg").screenshot({ path, type: "jpeg", quality: 86 });
        console.log(`wrote ${path}`);
    }
} finally {
    await browser.close();
}
