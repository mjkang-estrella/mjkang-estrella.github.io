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

// Hosts that refuse to be framed (X-Frame-Options: DENY), so a project hosted
// there can never offer the in-popup live demo.
const FRAME_BLOCKED_HOSTS = new Set([
    "github.com",
    "testflight.apple.com",
    "apps.apple.com",
]);

const PROJECT_KEYS = new Set([
    "id",
    "title",
    "description",
    "href",
    "cta",
    "kind",
    "domain",
    "status",
    "image",
    "detailImage",
    "embed",
    "embedUrl",
    "embedLabel",
    "detail",
]);

const DETAIL_KEYS = new Set([
    "pitch",
    "problem",
    "features",
    "tryThis",
    "tryThisHeading",
    "stack",
    "links",
    "sources",
]);

// Caps keep the popup's narrative column readable; a list outside its range
// usually means the copy wants another pass rather than a wider layout.
const TEXT_LIMITS = { pitch: 240, problem: 480, tryThisHeading: 40, embedLabel: 24 };
const LIST_LIMITS = {
    features: { min: 2, max: 5, length: 180 },
    tryThis: { min: 1, max: 4, length: 180 },
    stack: { min: 1, max: 8, length: 40 },
    links: { min: 1, max: 3 },
    sources: { min: 1, max: 12 },
};

const isText = (value) => typeof value === "string" && value.trim() !== "";

const isSafeHref = (href) => isText(href) && /^(https:\/\/|\/)/.test(href);

const hostOf = (href) => (isExternal(href) ? new URL(href).hostname : null);

/** Collects every problem in the data at once, so one build run reports the
 *  whole list instead of failing on the first typo. */
const validatePortfolio = (data) => {
    const errors = [];
    const seenIds = new Set();

    data.projects.forEach((project, index) => {
        const where = `projects[${index}] (${project.id || project.title || "?"})`;
        const fail = (message) => errors.push(`${where}: ${message}`);

        for (const key of Object.keys(project)) {
            if (!PROJECT_KEYS.has(key)) fail(`unknown key "${key}"`);
        }

        for (const key of ["title", "description", "href", "cta", "kind", "domain", "status", "image", "detailImage"]) {
            if (!isText(project[key])) fail(`${key} must be a non-empty string`);
        }

        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(project.id || "")) {
            fail("id must be a kebab-case slug");
        } else if (seenIds.has(project.id)) {
            fail(`duplicate id "${project.id}"`);
        } else {
            seenIds.add(project.id);
        }

        if (typeof project.embed !== "boolean") {
            fail("embed must be true or false");
        }

        if (project.embedUrl !== undefined && !isSafeHref(project.embedUrl)) {
            fail("embedUrl must start with https:// or /");
        }

        const embedHost = hostOf(project.embedUrl || project.href || "");
        if (project.embed === true && FRAME_BLOCKED_HOSTS.has(embedHost)) {
            fail(`${embedHost} refuses to be framed, so embed must be false`);
        }

        if (project.embedLabel !== undefined && (!isText(project.embedLabel) || project.embedLabel.length > TEXT_LIMITS.embedLabel)) {
            fail(`embedLabel must be a non-empty string of at most ${TEXT_LIMITS.embedLabel} characters`);
        }

        const { detail } = project;

        if (detail === undefined) {
            return;
        }

        for (const key of Object.keys(detail)) {
            if (!DETAIL_KEYS.has(key)) fail(`unknown key "detail.${key}"`);
        }

        if (!isText(detail.pitch)) {
            fail("detail.pitch is required");
        }

        for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
            if (key === "embedLabel" || detail[key] === undefined) continue;
            if (!isText(detail[key])) fail(`detail.${key} must be a non-empty string`);
            else if (detail[key].length > limit) fail(`detail.${key} is ${detail[key].length} characters (max ${limit})`);
        }

        for (const [key, limit] of Object.entries(LIST_LIMITS)) {
            const list = detail[key];
            if (list === undefined) {
                if (key === "sources") fail("detail.sources is required so every claim can be traced");
                continue;
            }
            if (!Array.isArray(list) || list.length < limit.min || list.length > limit.max) {
                fail(`detail.${key} must be a list of ${limit.min}–${limit.max} items`);
                continue;
            }
            list.forEach((item, itemIndex) => {
                const label = `detail.${key}[${itemIndex}]`;
                if (key === "links") {
                    if (!isText(item?.label) || !isSafeHref(item?.href)) {
                        fail(`${label} needs a label and an https:// or / href`);
                    }
                } else if (!isText(item)) {
                    fail(`${label} must be a non-empty string`);
                } else if (limit.length && item.length > limit.length) {
                    fail(`${label} is ${item.length} characters (max ${limit.length})`);
                }
            });
        }
    });

    if (errors.length) {
        console.error(`data/portfolio.json has ${errors.length} problem(s):`);
        errors.forEach((error) => console.error(`  - ${error}`));
        process.exit(1);
    }
};

const jpegSizes = new Map();

/** Reads the pixel size from a JPEG's SOF marker so width/height attributes
 *  never drift from the files on disk. */
const jpegSize = (path) => {
    if (!jpegSizes.has(path)) {
        jpegSizes.set(path, readJpegSize(path));
    }

    return jpegSizes.get(path);
};

const readJpegSize = (path) => {
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

const externalLinkAttributes = (href) =>
    isExternal(href) ? ` target="_blank" rel="noopener noreferrer"` : "";

const externalMark = (href) =>
    isExternal(href) ? ` <span aria-hidden="true">↗</span>` : "";

/** A short, URL-bar style label: "reader.mj-kang.com",
 *  "github.com/mjkang-estrella/soma-context", "mj-kang.com/jeonse". */
const displayHost = (href) => {
    const url = new URL(href, SITE_ORIGIN);
    const host = url.hostname.replace(/^www\./, "");
    return `${host}${url.pathname.replace(/\/$/, "")}`;
};

const renderProjectCard = (project) => {
    const flat = jpegSize(project.image);
    const detail = jpegSize(project.detailImage);
    const external = isExternal(project.href);
    // With a detail popup the card explains before it launches; without one
    // it still goes straight to the project, so it keeps the project's CTA.
    const cardCta = project.detail ? "Explore" : project.cta;

    return lines(
        4,
        `<li class="project-item">`,
        `<a`,
        `    href="${escapeHtml(project.href)}"`,
        `    class="project-card"`,
        `    data-reveal`,
        project.detail ? `    data-project-id="${escapeHtml(project.id)}"` : null,
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
        `        <span class="project-link">${escapeHtml(cardCta)}</span>`,
        `    </div>`,
        `</a>`,
        `</li>`
    );
};

// data-detail-field lets the Copy-markdown export read a section without
// depending on its visible heading.
const detailSection = (field, heading, body) => [
    `<section class="project-detail__section" data-detail-field="${field}">`,
    `    <h3 class="project-detail__heading">${escapeHtml(heading)}</h3>`,
    ...body.map((row) => `    ${row}`),
    `</section>`,
];

const detailList = (tag, className, items) => [
    `<${tag} class="${className}">`,
    ...items.map((item) => `    <li>${escapeHtml(item)}</li>`),
    `</${tag}>`,
];

/** The popup body for one project. It lives in an inert <template>, so none
 *  of it renders or loads until the dialog clones it. The dialog assigns the
 *  ids that aria-labelledby/-describedby point at, keeping the source free of
 *  sixteen duplicate ids. */
const renderProjectDetail = (project) => {
    const { detail } = project;
    const flat = jpegSize(project.image);
    const screenshot = jpegSize(project.detailImage);
    const embedSrc = project.embedUrl || project.href;
    const stageHref = project.embed ? embedSrc : project.href;
    const openLabel = project.embed ? "Open full site" : project.cta;
    const title = escapeHtml(project.title);

    const narrative = [
        `<p class="project-detail__pitch" data-project-detail-pitch>${escapeHtml(detail.pitch)}</p>`,
        ...(detail.problem
            ? detailSection("problem", "Why it exists", [
                  `<p class="project-detail__text">${escapeHtml(detail.problem)}</p>`,
              ])
            : []),
        ...(detail.features
            ? detailSection(
                  "features",
                  "What it does",
                  detailList("ul", "project-detail__list", detail.features)
              )
            : []),
        ...(detail.tryThis
            ? detailSection(
                  "tryThis",
                  detail.tryThisHeading || "Try this",
                  detailList("ol", "project-detail__steps", detail.tryThis)
              )
            : []),
        ...(detail.stack
            ? detailSection("stack", "Built with", [
                  `<p class="project-detail__stack">${detail.stack
                      .map(escapeHtml)
                      .join(" · ")}</p>`,
              ])
            : []),
        `<div class="project-detail__actions">`,
        `    <a class="project-detail__cta" href="${escapeHtml(project.href)}"${externalLinkAttributes(project.href)}>${escapeHtml(project.cta)}${externalMark(project.href)}</a>`,
        ...(detail.links || []).map(
            (link) =>
                `    <a class="project-detail__secondary" href="${escapeHtml(link.href)}"${externalLinkAttributes(link.href)}>${escapeHtml(link.label)}${externalMark(link.href)}</a>`
        ),
        `</div>`,
    ];

    const liveControls = project.embed
        ? [
              `    <span class="project-detail__tools" data-project-detail-tools hidden>`,
              `        <button class="project-detail__tool" type="button" data-project-detail-restart>Restart</button>`,
              `        <button class="project-detail__tool" type="button" data-project-detail-exit>Exit demo</button>`,
              `    </span>`,
          ]
        : [];

    const tryButton = project.embed
        ? [
              `    <button class="project-detail__try" type="button" data-project-detail-try>`,
              `        <span class="project-detail__try-icon" aria-hidden="true"></span>`,
              `        ${escapeHtml(project.embedLabel || "Try it here")}`,
              `    </button>`,
          ]
        : [];

    return lines(
        2,
        `<template data-project-detail="${escapeHtml(project.id)}">`,
        `    <header class="project-detail__header">`,
        `        <p class="project-detail__meta">`,
        `            <span>${escapeHtml(project.kind)}</span>`,
        `            <span>${escapeHtml(project.domain)}</span>`,
        `            <span>${escapeHtml(project.status)}</span>`,
        `        </p>`,
        `        <h2 class="project-detail__title" data-project-detail-title>${title}</h2>`,
        `    </header>`,
        `    <div class="project-detail__narrative" role="region" tabindex="0" aria-label="About ${title}">`,
        narrative.map((row) => `        ${row}`),
        `    </div>`,
        `    <div class="project-detail__stage"${project.embed ? ` data-embed-src="${escapeHtml(embedSrc)}"` : ""}>`,
        `        <div class="project-detail__toolbar">`,
        `            <span class="project-detail__address" translate="no">${escapeHtml(displayHost(stageHref))}</span>`,
        liveControls.map((row) => `        ${row}`),
        `            <a class="project-detail__open" href="${escapeHtml(stageHref)}"${externalLinkAttributes(stageHref)}>${escapeHtml(openLabel)}${externalMark(stageHref)}</a>`,
        `        </div>`,
        `        <div class="project-detail__viewport">`,
        `            <figure class="project-detail__media" data-project-detail-media>`,
        `                <img`,
        `                    class="project-detail__image project-detail__image--flat"`,
        `                    src="${escapeHtml(project.image)}"`,
        `                    alt=""`,
        `                    aria-hidden="true"`,
        `                    width="${flat.width}"`,
        `                    height="${flat.height}"`,
        `                    decoding="async"`,
        `                />`,
        `                <img`,
        `                    class="project-detail__image project-detail__image--detail"`,
        `                    src="${escapeHtml(project.detailImage)}"`,
        `                    alt="Screenshot of ${title}"`,
        `                    width="${screenshot.width}"`,
        `                    height="${screenshot.height}"`,
        `                    decoding="async"`,
        `                />`,
        `            </figure>`,
        tryButton.map((row) => `        ${row}`),
        `            <p class="project-detail__status" role="status" data-project-detail-status></p>`,
        `        </div>`,
        `    </div>`,
        `</template>`
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
    "project-details": data.projects
        .filter((project) => project.detail)
        .map(renderProjectDetail)
        .join("\n"),
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
        output = body
            ? `${before}\n${body}\n${closeIndent}${after}`
            : `${before}\n${closeIndent}${after}`;
    }

    return output;
};

const data = JSON.parse(readFileSync(DATA, "utf8"));
validatePortfolio(data);
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
