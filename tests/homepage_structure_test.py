from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX_HTML = ROOT / "index.html"
ROBOTS_TXT = ROOT / "robots.txt"


class HomePageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.main_ids: list[str] = []
        self.project_card_count = 0
        self.timeline_item_count = 0
        self.social_link_count = 0
        self.heading_text: list[str] = []
        self.title_text = ""
        self.stylesheets: list[str] = []
        self.scripts: list[str] = []
        self.meta: dict[str, str] = {}
        self.links: dict[str, str] = {}
        self.structured_data_blocks: list[str] = []

        self._capture_title = False
        self._capture_heading = False
        self._heading_buffer: list[str] = []
        self._capture_json_ld = False
        self._json_ld_buffer: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = dict(attrs)
        class_names = set((attr_map.get("class") or "").split())

        if tag == "main" and attr_map.get("id"):
            self.main_ids.append(attr_map["id"])

        if tag == "a" and "project-card" in class_names:
            self.project_card_count += 1

        if tag == "li" and "timeline-item" in class_names:
            self.timeline_item_count += 1

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

        if tag == "meta" and attr_map.get("name") and attr_map.get("content"):
            self.meta[attr_map["name"]] = attr_map["content"]

        if tag == "link" and attr_map.get("rel") and attr_map.get("href"):
            rel = attr_map["rel"]
            self.links[rel] = attr_map["href"]
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

        if self._capture_json_ld:
            self._json_ld_buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._capture_title = False

        if tag in {"h1", "h2", "h3", "h4"} and self._capture_heading:
            heading = " ".join(part.strip() for part in self._heading_buffer if part.strip())
            if heading:
                self.heading_text.append(heading)
            self._capture_heading = False
            self._heading_buffer = []

        if tag == "script" and self._capture_json_ld:
            block = "".join(self._json_ld_buffer).strip()
            if block:
                self.structured_data_blocks.append(block)
            self._capture_json_ld = False
            self._json_ld_buffer = []


def main() -> None:
    parser = HomePageParser()
    parser.feed(INDEX_HTML.read_text(encoding="utf-8"))

    assert parser.title_text.strip() == "MJ Kang | Product Manager"
    assert parser.main_ids == ["main-content"]
    assert "MJ Kang" in parser.heading_text
    assert "History" in parser.heading_text
    assert "Selected Works" in parser.heading_text
    assert parser.project_card_count == 10
    assert parser.timeline_item_count == 5
    assert parser.social_link_count >= 4
    assert "css/homepage.css" in parser.stylesheets
    assert parser.scripts == ["js/homepage.js"]
    assert parser.meta["description"].startswith("MJ Kang is a Bay Area")
    assert parser.meta["robots"].startswith("index,follow")
    assert parser.links["canonical"] == "https://mj-kang.com/"
    assert any('"@type": "Person"' in block for block in parser.structured_data_blocks)
    assert ROBOTS_TXT.read_text(encoding="utf-8").strip() == "User-agent: *\nAllow: /"


if __name__ == "__main__":
    main()
