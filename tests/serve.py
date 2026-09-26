"""Static file server for the browser tests.

`python3 -m http.server` listens with a backlog of 5, so parallel Playwright
workers loading image-heavy pages get connection resets that surface as
console errors. This is the same stdlib server with a deeper queue.
"""

from __future__ import annotations

import functools
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class TestServer(ThreadingHTTPServer):
    request_queue_size = 256
    daemon_threads = True


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    with TestServer(("127.0.0.1", port), handler) as server:
        server.serve_forever()
