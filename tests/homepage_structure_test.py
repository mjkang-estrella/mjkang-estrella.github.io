from __future__ import annotations

import hashlib
import json
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
INDEX_HTML = ROOT / "index.html"
PORTFOLIO_JSON = ROOT / "data" / "portfolio.json"
ROBOTS_TXT = ROOT / "robots.txt"
SITEMAP_XML = ROOT / "sitemap.xml"
LLMS_TXT = ROOT / "llms.txt"
HEADERS = ROOT / "_headers"
NOJEKYLL = ROOT / ".nojekyll"
AGENT_SKILLS_INDEX = ROOT / ".well-known" / "agent-skills" / "index.json"
SITE_NAVIGATION_SKILL = (
    ROOT / ".well-known" / "agent-skills" / "site-navigation" / "SKILL.md"
)

# html.parser never emits end tags for these, so depth bookkeeping must
# ignore them or one bare <br> inside the machine document corrupts the count.
VOID_ELEMENTS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}

SOCIAL_HOSTS = {"www.linkedin.com", "x.com", "github.com", "blog.mj-kang.com"}
FRAME_BLOCKED_HOSTS = {"github.com", "testflight.apple.com", "apps.apple.com"}


class HomePageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.main_ids: list[str] = []
        self.body_attrs: dict[str, str | None] = {}
        self.machine_section_attrs: dict[str, str | None] = {}
        self.skip_link_href = ""
        self.project_card_count = 0
        self.project_hrefs: list[str] = []
        self.project_titles: list[str] = []
        self.project_metadata_count = 0
        self.project_cards: list[dict[str, str | None]] = []
        self.detail_dialogs: list[dict[str, object]] = []
        self.detail_close_buttons = 0
        self.detail_templates: dict[str, dict[str, list[str | None]]] = {}
        self.timeline_item_count = 0
        self.machine_timeline_count = 0
        self.mode_buttons: list[str] = []
        self.mode_button_pressed: dict[str, str | None] = {}
        self.copy_machine_profile_button = False
        self.social_hosts: list[str] = []
        self.profile_social_links: list[dict[str, str | None]] = []
        self.heading_text: list[str] = []
        self.title_text = ""
        self.stylesheets: list[str] = []
        self.scripts: list[str] = []
        self.meta: dict[str, str] = {}
        self.meta_content_paths: list[str] = []
        self.links: dict[str, str] = {}
        self.link_attrs: list[dict[str, str | None]] = []
        self.image_sources: list[str] = []
        self.structured_data_blocks: list[str] = []
        self.machine_text: list[str] = []

        self._capture_title = False
        self._capture_heading = False
        self._heading_buffer: list[str] = []
        self._capture_project_title = False
        self._project_title_buffer: list[str] = []
        self._capture_json_ld = False
        self._json_ld_buffer: list[str] = []
        self._machine_depth = 0
        self._social_nav_depth = 0
        self._main_depth = 0
        self._dialog_depth = 0
        self._template_depth = 0
        self._template_id: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = dict(attrs)
        class_names = set((attr_map.get("class") or "").split())
        is_void = tag in VOID_ELEMENTS

        if tag == "section" and "machine-document" in class_names:
            self._machine_depth = 1
            self.machine_section_attrs = attr_map
        elif self._machine_depth and not is_void:
            self._machine_depth += 1

        if tag == "main":
            self._main_depth = 1
        elif self._main_depth and not is_void:
            self._main_depth += 1

        if tag == "dialog" and "project-detail" in class_names:
            self.detail_dialogs.append(
                {
                    "attrs": attr_map,
                    "in_main": bool(self._main_depth),
                    "in_machine": bool(self._machine_depth),
                }
            )
            self._dialog_depth = 1
        elif self._dialog_depth and not is_void:
            self._dialog_depth += 1

        if (
            self._dialog_depth
            and tag == "button"
            and "data-project-detail-close" in attr_map
            and attr_map.get("type") == "button"
        ):
            self.detail_close_buttons += 1

        if tag == "template" and attr_map.get("data-project-detail"):
            self._template_id = attr_map["data-project-detail"]
            self._template_depth = 1
            self.detail_templates[self._template_id] = {
                "cta_hrefs": [],
                "embed_srcs": [],
                "forbidden": [],
            }
        elif self._template_depth and not is_void:
            self._template_depth += 1

            # Templates are cloned into the dialog, so they must not carry
            # anything the page scrapes or observes, or any fixed ids.
            template = self.detail_templates[self._template_id]
            if tag == "a" and "project-detail__cta" in class_names:
                template["cta_hrefs"].append(attr_map.get("href"))
            if attr_map.get("data-embed-src"):
                template["embed_srcs"].append(attr_map["data-embed-src"])
            if (
                class_names & {"project-card", "project-title"}
                or "data-reveal" in attr_map
                or "id" in attr_map
            ):
                template["forbidden"].append(tag)

        if tag == "a" and "profile-social__link" in class_names:
            self.profile_social_links.append(attr_map)

        if tag == "ul" and "social-links" in class_names:
            self._social_nav_depth = 1
        elif self._social_nav_depth and not is_void:
            self._social_nav_depth += 1

        if tag == "body":
            self.body_attrs = attr_map

        if tag == "main" and attr_map.get("id"):
            self.main_ids.append(attr_map["id"])

        if tag == "a" and "skip-link" in class_names:
            self.skip_link_href = attr_map.get("href") or ""

        if tag == "a" and "project-card" in class_names:
            self.project_card_count += 1
            self.project_cards.append(
                {"id": attr_map.get("data-project-id"), "href": attr_map.get("href")}
            )
            if attr_map.get("href"):
                self.project_hrefs.append(attr_map["href"])
            if (
                attr_map.get("data-kind")
                and attr_map.get("data-domain")
                and attr_map.get("data-status")
            ):
                self.project_metadata_count += 1

        if tag == "li" and "timeline-item" in class_names:
            self.timeline_item_count += 1
            if attr_map.get("data-machine-kind") and attr_map.get("data-machine-label"):
                self.machine_timeline_count += 1

        if tag == "button" and attr_map.get("data-view-mode"):
            self.mode_buttons.append(attr_map["data-view-mode"])
            self.mode_button_pressed[attr_map["data-view-mode"]] = attr_map.get(
                "aria-pressed"
            )

        if tag == "button" and "data-copy-machine-profile" in attr_map:
            self.copy_machine_profile_button = True

        if self._social_nav_depth and tag == "a" and attr_map.get("href"):
            host = urlsplit(attr_map["href"]).hostname
            if host:
                self.social_hosts.append(host)

        if tag == "title":
            self._capture_title = True

        if tag in {"h1", "h2", "h3", "h4"}:
            self._capture_heading = True
            self._heading_buffer = []

        if tag == "h3" and "project-title" in class_names:
            self._capture_project_title = True
            self._project_title_buffer = []

        if tag == "meta" and attr_map.get("content"):
            if attr_map.get("name"):
                self.meta[attr_map["name"]] = attr_map["content"]
            if attr_map.get("property"):
                self.meta[attr_map["property"]] = attr_map["content"]
            if attr_map.get("name") == "msapplication-TileImage":
                self.meta_content_paths.append(attr_map["content"])

        if tag == "link" and attr_map.get("rel") and attr_map.get("href"):
            rel = attr_map["rel"]
            self.links[rel] = attr_map["href"]
            self.link_attrs.append(attr_map)
            if rel == "stylesheet":
                self.stylesheets.append(attr_map["href"])

        if tag == "img":
            for source_attr in ("src", "data-detail-src"):
                if attr_map.get(source_attr):
                    self.image_sources.append(attr_map[source_attr])

        if tag == "script" and attr_map.get("src"):
            self.scripts.append(attr_map["src"])

        if (
            tag == "script"
            and attr_map.get("type") == "application/ld+json"
        ):
            self._capture_json_ld = True
            self._json_ld_buffer = []

    def handle_data(self, data: str) -> None:
        if self._capture_title:
            self.title_text += data

        if self._capture_heading:
            self._heading_buffer.append(data)

        if self._capture_project_title:
            self._project_title_buffer.append(data)

        if self._capture_json_ld:
            self._json_ld_buffer.append(data)

        if self._machine_depth:
            text = data.strip()
            if text:
                self.machine_text.append(text)

    def handle_endtag(self, tag: str) -> None:
        if tag in VOID_ELEMENTS:
            return

        if tag == "title":
            self._capture_title = False

        if tag in {"h1", "h2", "h3", "h4"} and self._capture_heading:
            heading = " ".join(part.strip() for part in self._heading_buffer if part.strip())
            if heading:
                self.heading_text.append(heading)
            self._capture_heading = False
            self._heading_buffer = []

        if tag == "h3" and self._capture_project_title:
            project_title = " ".join(
                part.strip() for part in self._project_title_buffer if part.strip()
            )
            if project_title:
                self.project_titles.append(project_title)
            self._capture_project_title = False
            self._project_title_buffer = []

        if tag == "script" and self._capture_json_ld:
            block = "".join(self._json_ld_buffer).strip()
            if block:
                self.structured_data_blocks.append(block)
            self._capture_json_ld = False
            self._json_ld_buffer = []

        if self._machine_depth:
            self._machine_depth -= 1

        if self._social_nav_depth:
            self._social_nav_depth -= 1

        if self._main_depth:
            self._main_depth -= 1

        if self._dialog_depth:
            self._dialog_depth -= 1

        if self._template_depth:
            self._template_depth -= 1
            if not self._template_depth:
                self._template_id = None


def parse_homepage() -> tuple[HomePageParser, str]:
    html = INDEX_HTML.read_text(encoding="utf-8")
    parser = HomePageParser()
    parser.feed(html)
    return parser, html


def assert_local_asset_exists(reference: str) -> None:
    if reference.startswith(("https://", "http://", "mailto:", "//")):
        return
    path = reference.split("?")[0].split("#")[0].lstrip("/")
    if not path:
        return
    assert (ROOT / path).exists(), f"referenced asset missing on disk: {reference}"


def test_document_structure() -> None:
    parser, _ = parse_homepage()

    assert parser.title_text.strip() == "MJ Kang | Product Manager"
    assert parser.main_ids == ["main-content"]
    assert "MJ Kang" in parser.heading_text
    assert "History" in parser.heading_text
    assert "Selected Works" in parser.heading_text
    assert parser.project_card_count == 16
    assert parser.project_metadata_count == 16
    assert len(parser.project_titles) == 16
    assert parser.project_hrefs[:4] == [
        "https://akashic.computer/",
        "https://github.com/mjkang-estrella/poincare-lean",
        "https://blog.mj-kang.com/my-ai-homelab/",
        "https://github.com/mjkang-estrella/soma-context",
    ]
    assert "https://cwi.mj-kang.com/" in parser.project_hrefs
    assert parser.timeline_item_count == 4
    assert parser.machine_timeline_count == 4


def test_machine_document_mirrors_visible_content() -> None:
    parser, _ = parse_homepage()

    machine_text = " ".join(parser.machine_text)
    assert machine_text, "machine document produced no text"
    for title in parser.project_titles:
        assert title in machine_text
    for href in parser.project_hrefs:
        if href.startswith("/"):
            href = f"https://mj-kang.com{href}"
        assert href in machine_text


def test_project_detail_popup() -> None:
    parser, _ = parse_homepage()
    projects = json.loads(PORTFOLIO_JSON.read_text(encoding="utf-8"))["projects"]
    detailed_ids = sorted(project["id"] for project in projects if "detail" in project)
    assert len(detailed_ids) == len(projects), "every project should have a popup"

    assert len(parser.detail_dialogs) == 1
    dialog = parser.detail_dialogs[0]
    assert not dialog["in_main"], "the dialog must sit outside <main>"
    assert not dialog["in_machine"], "the dialog must sit outside the machine view"
    assert dialog["attrs"].get("aria-labelledby") == "project-detail-title"
    assert parser.detail_close_buttons == 1

    card_ids = [card["id"] for card in parser.project_cards if card["id"]]
    assert len(card_ids) == len(set(card_ids)), "data-project-id must be unique"
    assert sorted(card_ids) == detailed_ids
    assert sorted(parser.detail_templates) == detailed_ids

    for card in parser.project_cards:
        if not card["id"]:
            continue
        template = parser.detail_templates[card["id"]]
        assert template["cta_hrefs"] == [card["href"]], card["id"]
        assert template["forbidden"] == [], card["id"]
        for source in template["embed_srcs"]:
            assert urlsplit(source).hostname not in FRAME_BLOCKED_HOSTS, card["id"]


def test_view_toggle_initial_accessibility_state() -> None:
    parser, _ = parse_homepage()

    assert parser.mode_buttons == ["human", "machine"]
    assert parser.mode_button_pressed["human"] == "true"
    assert parser.mode_button_pressed["machine"] == "false"
    assert parser.copy_machine_profile_button
    assert parser.body_attrs.get("data-portfolio-view") == "human"
    assert parser.machine_section_attrs.get("aria-hidden") == "true"
    assert parser.machine_section_attrs.get("id") == "machine-content"
    assert parser.skip_link_href == "#main-content"


def test_footer_social_links() -> None:
    parser, _ = parse_homepage()

    assert len(parser.social_hosts) == 4
    assert set(parser.social_hosts) == SOCIAL_HOSTS


def test_profile_social_links() -> None:
    parser, _ = parse_homepage()

    hrefs = [link.get("href") or "" for link in parser.profile_social_links]
    assert [urlsplit(href).hostname for href in hrefs[:3]] == [
        "www.linkedin.com",
        "github.com",
        "x.com",
    ]
    assert hrefs[3] == "mailto:mj.kang@hey.com"
    for link in parser.profile_social_links:
        # Icon-only links need an accessible name; web profiles must leave
        # the site safely.
        assert link.get("aria-label"), link
        if link["href"].startswith("https://"):
            assert link.get("target") == "_blank"
            assert link.get("rel") == "noopener noreferrer"


def test_head_metadata() -> None:
    parser, html = parse_homepage()

    assert parser.meta["description"].startswith("MJ Kang is a Bay Area")
    assert parser.meta["robots"].startswith("index,follow")
    assert parser.links["canonical"] == "https://mj-kang.com/"
    assert parser.meta["og:title"] == "MJ Kang | Product Manager"
    assert parser.meta["og:url"] == "https://mj-kang.com/"
    assert parser.meta["og:description"].startswith("MJ Kang is a Bay Area")
    assert (
        parser.meta["og:image"]
        == "https://mj-kang.com/images/profile/mj-profile-og.jpg"
    )
    assert parser.meta["twitter:card"] == "summary_large_image"
    assert parser.meta["twitter:image"] == parser.meta["og:image"]
    assert any(
        link.get("rel") == "sitemap" and link.get("href") == "/sitemap.xml"
        for link in parser.link_attrs
    )
    assert any(
        link.get("rel") == "alternate"
        and link.get("type") == "text/markdown"
        and link.get("href") == "/llms.txt"
        for link in parser.link_attrs
    )
    assert any(
        link.get("rel") == "describedby"
        and link.get("href") == "/.well-known/agent-skills/index.json"
        for link in parser.link_attrs
    )
    assert (
        "https://fonts.googleapis.com/css2?family=Geist:wght@400;700&display=swap"
        in html
    )
    assert "https://fonts.gstatic.com" in html


def test_structured_data_parses() -> None:
    parser, _ = parse_homepage()

    assert parser.structured_data_blocks, "no JSON-LD block found"
    data = json.loads(parser.structured_data_blocks[0])
    assert data["@type"] == "Person"
    assert data["name"] == "MJ Kang"
    assert data["url"] == "https://mj-kang.com/"
    assert data["image"].startswith("https://mj-kang.com/images/profile/")


def test_referenced_assets_exist_on_disk() -> None:
    parser, _ = parse_homepage()

    assert "css/homepage.css" in parser.stylesheets
    assert parser.scripts == [
        "/js/analytics.js",
        "js/homepage.js",
        "js/project-detail.js",
        "js/ask-ai.js",
    ]
    for stylesheet in parser.stylesheets:
        assert_local_asset_exists(stylesheet)
    for script in parser.scripts:
        assert_local_asset_exists(script)
    for link in parser.link_attrs:
        assert_local_asset_exists(link.get("href") or "")
    for content_path in parser.meta_content_paths:
        assert_local_asset_exists(content_path)

    # Two images per card (flat + hover detail), two more per popup template,
    # the profile badge, 4 timeline logos and 3 Ask-an-AI provider icons.
    projects = json.loads(PORTFOLIO_JSON.read_text(encoding="utf-8"))["projects"]
    detailed = [project for project in projects if "detail" in project]
    assert len(parser.image_sources) == 2 * len(projects) + 2 * len(detailed) + 8
    for image in parser.image_sources:
        assert_local_asset_exists(image)

    # The og/twitter share image must exist locally too.
    og_image_path = urlsplit(parse_homepage()[0].meta["og:image"]).path
    assert_local_asset_exists(og_image_path)


def test_machine_export_strings_present() -> None:
    _, html = parse_homepage()

    assert "Typeset in Geist Sans." in html
    assert "https://mj-kang.com/block-fighter/" in html
    assert "https://mj-kang.com/jeonse/" in html
    assert "https://mj-kang.com/retirement-calculator/" in html
    assert "## Contact" in html
    assert "## Social" in html
    assert "## Colophon" in html


def test_robots_txt() -> None:
    robots_text = ROBOTS_TXT.read_text(encoding="utf-8")
    assert "User-agent: *\nAllow: /" in robots_text
    assert "Sitemap: https://mj-kang.com/sitemap.xml" in robots_text
    assert "Content-Signal: ai-train=no, search=yes, ai-input=yes" in robots_text


def test_sitemap() -> None:
    sitemap = ET.parse(SITEMAP_XML)
    namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    sitemap_urls = [
        element.text for element in sitemap.findall("./sm:url/sm:loc", namespace)
    ]
    assert sitemap_urls == [
        "https://mj-kang.com/",
        "https://mj-kang.com/three-body-problem-simulation/",
        "https://mj-kang.com/block-fighter/",
        "https://mj-kang.com/jeonse/",
        "https://mj-kang.com/retirement-calculator/",
    ]


def test_llms_txt() -> None:
    llms_text = LLMS_TXT.read_text(encoding="utf-8")
    assert "# MJ Kang" in llms_text
    assert "[Machine view](https://mj-kang.com/?view=machine)" in llms_text
    assert "[Caption With Intent](https://cwi.mj-kang.com/)" in llms_text
    assert "[Reader](https://reader.mj-kang.com/)" in llms_text
    assert "https://mj-kang.com/retirement-calculator/" in llms_text


def test_headers_and_nojekyll() -> None:
    headers_text = HEADERS.read_text(encoding="utf-8")
    assert 'Link: </llms.txt>; rel="describedby"; type="text/markdown"' in headers_text
    assert (
        'Link: </.well-known/agent-skills/index.json>; rel="describedby"; '
        'type="application/json"'
    ) in headers_text
    assert NOJEKYLL.exists()


def test_error_page_exists() -> None:
    assert (ROOT / "404.html").exists()
    assert (ROOT / "favicon.ico").exists()


def test_agent_skills_digest() -> None:
    skills_index = json.loads(AGENT_SKILLS_INDEX.read_text(encoding="utf-8"))
    skill = skills_index["skills"][0]
    digest = hashlib.sha256(SITE_NAVIGATION_SKILL.read_bytes()).hexdigest()
    assert (
        skills_index["$schema"]
        == "https://schemas.agentskills.io/discovery/0.2.0/schema.json"
    )
    assert skill["name"] == "site-navigation"
    assert skill["type"] == "skill-md"
    assert skill["url"] == "/.well-known/agent-skills/site-navigation/SKILL.md"
    assert skill["digest"] == f"sha256:{digest}"


def main() -> None:
    if sys.flags.optimize:
        sys.exit("refusing to run under python -O: assert statements are disabled")

    tests = [
        (name, fn)
        for name, fn in sorted(globals().items())
        if name.startswith("test_") and callable(fn)
    ]
    for name, fn in tests:
        fn()
        print(f"ok: {name}")
    print(f"{len(tests)} checks passed")


if __name__ == "__main__":
    main()
