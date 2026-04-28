import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
INDEX_HTML = ROOT / "index.html"
ROBOTS_TXT = ROOT / "robots.txt"
SITEMAP_XML = ROOT / "sitemap.xml"
LLMS_TXT = ROOT / "llms.txt"
HEADERS = ROOT / "_headers"
NOJEKYLL = ROOT / ".nojekyll"
AGENT_SKILLS_INDEX = ROOT / ".well-known" / "agent-skills" / "index.json"
SITE_NAVIGATION_SKILL = (
    ROOT / ".well-known" / "agent-skills" / "site-navigation" / "SKILL.md"
)


class HomePageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.main_ids: list[str] = []
        self.project_card_count = 0
        self.project_hrefs: list[str] = []
        self.project_titles: list[str] = []
        self.project_metadata_count = 0
        self.timeline_item_count = 0
        self.machine_timeline_count = 0
        self.mode_buttons: list[str] = []
        self.copy_machine_profile_button = False
        self.social_link_count = 0
        self.heading_text: list[str] = []
        self.title_text = ""
        self.stylesheets: list[str] = []
        self.scripts: list[str] = []
        self.meta: dict[str, str] = {}
        self.links: dict[str, str] = {}
        self.link_attrs: list[dict[str, str | None]] = []
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

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = dict(attrs)
        class_names = set((attr_map.get("class") or "").split())

        if tag == "section" and "machine-document" in class_names:
            self._machine_depth = 1
        elif self._machine_depth:
            self._machine_depth += 1

        if tag == "main" and attr_map.get("id"):
            self.main_ids.append(attr_map["id"])

        if tag == "a" and "project-card" in class_names:
            self.project_card_count += 1
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

        if tag == "button" and "data-copy-machine-profile" in attr_map:
            self.copy_machine_profile_button = True

        if tag == "a" and attr_map.get("href", "").startswith("https://") and (
            "linkedin.com" in attr_map["href"]
            or "x.com" in attr_map["href"]
            or "github.com" in attr_map["href"]
            or "blog.mj-kang.com" in attr_map["href"]
        ):
            self.social_link_count += 1

        if tag == "title":
            self._capture_title = True

        if tag in {"h1", "h2", "h3", "h4"}:
            self._capture_heading = True
            self._heading_buffer = []

        if tag == "h4" and "project-title" in class_names:
            self._capture_project_title = True
            self._project_title_buffer = []

        if tag == "meta" and attr_map.get("name") and attr_map.get("content"):
            self.meta[attr_map["name"]] = attr_map["content"]

        if tag == "link" and attr_map.get("rel") and attr_map.get("href"):
            rel = attr_map["rel"]
            self.links[rel] = attr_map["href"]
            self.link_attrs.append(attr_map)
            if rel == "stylesheet":
                self.stylesheets.append(attr_map["href"])

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
        if tag == "title":
            self._capture_title = False

        if tag in {"h1", "h2", "h3", "h4"} and self._capture_heading:
            heading = " ".join(part.strip() for part in self._heading_buffer if part.strip())
            if heading:
                self.heading_text.append(heading)
            self._capture_heading = False
            self._heading_buffer = []

        if tag == "h4" and self._capture_project_title:
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


def main() -> None:
    html = INDEX_HTML.read_text(encoding="utf-8")
    parser = HomePageParser()
    parser.feed(html)

    assert parser.title_text.strip() == "MJ Kang | Product Manager"
    assert parser.main_ids == ["main-content"]
    assert "MJ Kang" in parser.heading_text
    assert "History" in parser.heading_text
    assert "Selected Works" in parser.heading_text
    assert parser.project_card_count == 12
    assert parser.project_metadata_count == 12
    assert parser.project_hrefs[2] == "https://cwi.mj-kang.com/"
    machine_text = " ".join(parser.machine_text)
    for title in parser.project_titles:
        assert title in machine_text
    for href in parser.project_hrefs:
        if href.startswith("/"):
            href = f"https://mj-kang.com{href}"
        assert href in machine_text
    assert parser.timeline_item_count == 5
    assert parser.machine_timeline_count == 4
    assert parser.mode_buttons == ["human", "machine"]
    assert parser.copy_machine_profile_button
    assert parser.social_link_count >= 4
    assert "css/homepage.css" in parser.stylesheets
    assert parser.scripts == ["js/homepage.js"]
    assert parser.meta["description"].startswith("MJ Kang is a Bay Area")
    assert parser.meta["robots"].startswith("index,follow")
    assert parser.links["canonical"] == "https://mj-kang.com/"
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
    assert any('"@type": "Person"' in block for block in parser.structured_data_blocks)
    assert (
        'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap'
        in html
    )
    assert "https://fonts.gstatic.com" in html
    assert "Typeset in Geist Sans." in html
    assert "https://mj-kang.com/block-fighter/" in html
    assert "https://mj-kang.com/jeonse/" in html
    assert "https://mj-kang.com/retirement-calculator/" in html
    assert "## Contact" in html
    assert "## Social" in html
    assert "## Colophon" in html

    robots_text = ROBOTS_TXT.read_text(encoding="utf-8")
    assert "User-agent: *\nAllow: /" in robots_text
    assert "Sitemap: https://mj-kang.com/sitemap.xml" in robots_text
    assert "Content-Signal: ai-train=no, search=yes, ai-input=yes" in robots_text

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

    llms_text = LLMS_TXT.read_text(encoding="utf-8")
    assert "# MJ Kang" in llms_text
    assert "Machine view: https://mj-kang.com/?view=machine" in llms_text
    assert "Caption With Intent: https://cwi.mj-kang.com/" in llms_text
    assert "Reader: https://reader.mj-kang.com/" in llms_text
    assert "https://mj-kang.com/retirement-calculator/" in llms_text

    headers_text = HEADERS.read_text(encoding="utf-8")
    assert 'Link: </llms.txt>; rel="describedby"; type="text/markdown"' in headers_text
    assert (
        'Link: </.well-known/agent-skills/index.json>; rel="describedby"; '
        'type="application/json"'
    ) in headers_text
    assert NOJEKYLL.exists()

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


if __name__ == "__main__":
    main()
