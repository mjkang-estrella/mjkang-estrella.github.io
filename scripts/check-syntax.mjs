// Syntax-checks every script the site ships: standalone files and the inline
// <script> blocks of each page. It parses without running anything.
//
//   node scripts/check-syntax.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", "test-results", "playwright-report"]);

const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) return [];
        const path = join(dir, entry.name);
        return entry.isDirectory() ? walk(path) : [path];
    });

const scratch = mkdtempSync(join(tmpdir(), "check-syntax-"));
const failures = [];
let checked = 0;

const check = (label, file) => {
    checked += 1;
    try {
        execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
    } catch (error) {
        failures.push(`${label}\n${String(error.stderr).trim()}`);
    }
};

try {
    for (const file of walk(ROOT)) {
        const label = relative(ROOT, file);

        if (/\.(js|mjs)$/.test(file)) {
            check(label, file);
        } else if (file.endsWith(".html")) {
            const html = readFileSync(file, "utf8");
            let index = 0;

            for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
                const type = /\btype="([^"]*)"/.exec(attributes)?.[1] || "text/javascript";
                if (/\bsrc=/.test(attributes) || !/^(module|text\/javascript)$/.test(type)) continue;

                index += 1;
                const extension = type === "module" ? "mjs" : "js";
                const copy = join(scratch, `inline-${checked}.${extension}`);
                writeFileSync(copy, body);
                check(`${label} (inline script ${index})`, copy);
            }
        }
    }
} finally {
    rmSync(scratch, { recursive: true, force: true });
}

if (failures.length) {
    console.error(`${failures.length} script(s) failed to parse:\n`);
    failures.forEach((failure) => console.error(`${failure}\n`));
    process.exit(1);
}

console.log(`syntax ok: ${checked} scripts`);
