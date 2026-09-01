// Renders the generated regions of index.html from data/portfolio.json.
//
//   node scripts/build.mjs          rewrite index.html in place
//   node scripts/build.mjs --check  exit 1 if index.html is out of date
//
// The site is deployed as static files with no build step, so the generated
// markup is committed. Each region sits between
//   <!-- generated:NAME -->  and  <!-- /generated:NAME -->
// and everything outside those markers is left untouched.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = resolve(ROOT, "index.html");
const DATA = resolve(ROOT, "data/portfolio.json");
const SITE_ORIGIN = "https://mj-kang.com";

const escapeHtml = (text) =>
    String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const absoluteUrl = (href) =>
    href.startsWith("/") ? `${SITE_ORIGIN}${href}` : href;

const isExternal = (href) => /^https?:/.test(href);

/** Reads the pixel size from a JPEG's SOF marker so width/height attributes
 *  never drift from the files on disk. */
const jpegSize = (path) => {
    const bytes = readFileSync(resolve(ROOT, path));

    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
        throw new Error(`${path} is not a JPEG`);
    }

    let offset = 2;

    while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) {
            offset += 1;
            continue;
        }

        const marker = bytes[offset + 1];

        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
            return {
                height: bytes.readUInt16BE(offset + 5),
                width: bytes.readUInt16BE(offset + 7),
            };
        }

        offset += 2 + bytes.readUInt16BE(offset + 2);
    }

    throw new Error(`${path}: no SOF marker found`);
};

const indent = (level) => "    ".repeat(level);

const lines = (level, ...rows) =>
    rows
        .flat()
        .filter((row) => row !== null)
        .map((row) => (row === "" ? "" : indent(level) + row))
        .join("\n");

const renderProjectCard = (project) => {
    const flat = jpegSize(project.image);
    const detail = jpegSize(project.detailImage);
    const external = isExternal(project.href);

    return lines(
        4,
        `<li class="project-item">`,
        `<a`,
        `    href="${escapeHtml(project.href)}"`,
        `    class="project-card"`,
        `    data-reveal`,
        `    data-kind="${escapeHtml(project.kind)}"`,
        `    data-domain="${escapeHtml(project.domain)}"`,
        `    data-status="${escapeHtml(project.status)}"`,
        external ? `    target="_blank"` : null,
        external ? `    rel="noopener noreferrer"` : null,
        `>`,
        `    <span class="project-media">`,
        `        <img`,
        `            src="${escapeHtml(project.image)}"`,
        `            class="project-image project-image--flat"`,
        `            alt=""`,
        `            width="${flat.width}"`,
        `            height="${flat.height}"`,
        `            loading="lazy"`,
        `            decoding="async"`,
        `        />`,
        `        <img`,
        `            data-detail-src="${escapeHtml(project.detailImage)}"`,
        `            class="project-image project-image--detail"`,
        `            alt=""`,
        `            aria-hidden="true"`,
        `            width="${detail.width}"`,
        `            height="${detail.height}"`,
        `            loading="lazy"`,
        `            decoding="async"`,
        `        />`,
        `    </span>`,
        `    <div class="project-info">`,
        `        <h3 class="project-title">${escapeHtml(project.title)}</h3>`,
        `        <p class="project-desc">${escapeHtml(project.description)}</p>`,
        `        <span class="project-link">${escapeHtml(project.cta)}</span>`,
        `    </div>`,
        `</a>`,
        `</li>`
    );
};

// Experience spans use an em dash; education spans use a tilde to read as
// "expected" rather than "completed".
const dateSeparator = (item) => (item.kind === "education" ? "~" : "—");

const renderTimelineItem = (item) => {
    const logoClass =
        item.logoFit === "cover"
            ? "company-logo company-logo--cover"
            : "company-logo";

    return lines(
        6,
        `<li`,
        `    class="timeline-item"`,
        `    data-reveal="line"`,
        `    data-machine-kind="${escapeHtml(item.kind)}"`,
        `    data-machine-label="${escapeHtml(item.label)}"`,
        `>`,
        `    <div class="timeline-date">${item.from}${dateSeparator(item)}<br />${item.to}</div>`,
        `    <div>`,
        `        <a`,
        `            class="company-link"`,
        `            href="${escapeHtml(item.href)}"`,
        `            target="_blank"`,
        `            rel="noopener noreferrer"`,
        `        >`,
        `            <div class="company-logo-frame is-logo">`,
        `                <img`,
        `                    class="${logoClass}"`,
        `                    src="${escapeHtml(item.logo)}"`,
        `                    alt=""`,
        `                    loading="lazy"`,
        `                    decoding="async"`,
        `                />`,
        `            </div>`,
        `            <span class="company-name">${escapeHtml(item.organization)}</span>`,
        `        </a>`,
        `        <div class="role-title">${escapeHtml(item.title)}</div>`,
        `        <p class="dense-text">${escapeHtml(item.description)}</p>`,
        `    </div>`,
        `</li>`
    );
};

const markdownLink = (label, href) => `[${label}](${absoluteUrl(href)})`;

const paragraph = (text) => `<p>${escapeHtml(text)}</p>`;

const machineTimelineLine = (item) =>
    `- ${item.from}${dateSeparator(item)}${item.to} · ${markdownLink(
        item.organization,
        item.href
    )} · ${item.title} · ${item.description}`;

const renderMachineHistory = (timeline) =>
    lines(
        4,
        `<h2>## History</h2>`,
        `<h3>### Experience</h3>`,
        timeline
            .filter((item) => item.kind === "experience")
            .map((item) => paragraph(machineTimelineLine(item))),
        `<h3>### Education</h3>`,
        timeline
            .filter((item) => item.kind === "education")
            .map((item) => paragraph(machineTimelineLine(item)))
    );

const renderMachineWorks = (projects) =>
    lines(
        4,
        `<h2>## Selected Works</h2>`,
        projects.map((project) =>
            paragraph(
                `- ${markdownLink(project.title, project.href)} · ${project.description}`
            )
        )
    );

const renderRegions = (data) => ({
    "timeline:experience": data.timeline
        .filter((item) => item.kind === "experience")
        .map(renderTimelineItem)
        .join("\n\n"),
    "timeline:education": data.timeline
        .filter((item) => item.kind === "education")
        .map(renderTimelineItem)
        .join("\n\n"),
    projects: data.projects.map(renderProjectCard).join("\n"),
    "machine:history": renderMachineHistory(data.timeline),
    "machine:works": renderMachineWorks(data.projects),
});

const applyRegions = (html, regions) => {
    let output = html;

    for (const [name, body] of Object.entries(regions)) {
        const open = `<!-- generated:${name} -->`;
        const close = `<!-- /generated:${name} -->`;
        const start = output.indexOf(open);
        const end = output.indexOf(close);

        if (start === -1 || end === -1 || end < start) {
            throw new Error(`index.html is missing the ${name} markers`);
        }

        const before = output.slice(0, start + open.length);
        const after = output.slice(end);
        const closeIndent = output.slice(output.lastIndexOf("\n", end) + 1, end);
        output = `${before}\n${body}\n${closeIndent}${after}`;
    }

    return output;
};

const data = JSON.parse(readFileSync(DATA, "utf8"));
const current = readFileSync(INDEX, "utf8");
const next = applyRegions(current, renderRegions(data));

if (process.argv.includes("--check")) {
    if (next !== current) {
        console.error(
            "index.html is out of date with data/portfolio.json. Run `npm run build` and commit the result."
        );
        process.exit(1);
    }

    console.log("index.html matches data/portfolio.json");
} else if (next === current) {
    console.log("index.html already up to date");
} else {
    writeFileSync(INDEX, next);
    console.log("index.html regenerated");
}
