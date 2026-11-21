"""Local preview server that never caches, so edits always show up on refresh.

Usage: python scripts/serve.py [port]
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class NoCacheHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".mjs": "text/javascript",
        ".wasm": "application/wasm",
        ".webmanifest": "application/manifest+json",
        ".zip": "application/zip",
        ".avif": "image/avif",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        if code == 404:
            page = ROOT / "404.html"
            if page.is_file():
                body = page.read_bytes()
                self.send_response(404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(body)
                return
        super().send_error(code, message, explain)


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(NoCacheHandler, directory=str(ROOT))
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        print(f"Serving {ROOT} at http://localhost:{port}/index.html (no cache)")
        server.serve_forever()


if __name__ == "__main__":
    main()
