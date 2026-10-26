#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Local preview server for the TerraTransfer project website.

Serves the repository root over HTTP without any build step. Binds 0.0.0.0, so
the preview is reachable on every interface, including the Tailscale address.

    python serve.py            # serve on 0.0.0.0:8138
    python serve.py --port N   # override the port

The site is fully static; just refresh the browser after editing files.
"""

import argparse
import functools
import http.server
import os
import socket

DEFAULT_PORT = 8138
HOST = "0.0.0.0"
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    """Static handler rooted at the repo, with no-cache so edits show on reload.

    Supports HTTP Range requests so <video> seeking works in local preview
    (SimpleHTTPRequestHandler alone always answers 200 with the full file,
    which breaks the player's progress bar).
    """

    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".svg": "image/svg+xml",
        ".json": "application/json",
        ".ttf": "font/ttf",
        ".otf": "font/otf",
        ".woff2": "font/woff2",
    }

    def send_head(self):
        self._range = None
        rng = self.headers.get("Range", "")
        path = self.translate_path(self.path)
        if not rng.startswith("bytes=") or os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, "rb")
        except OSError:
            return super().send_head()
        size = os.fstat(f.fileno()).st_size
        spec = rng[len("bytes="):].split(",")[0].strip()
        start_s, _, end_s = spec.partition("-")
        try:
            if start_s:
                start = int(start_s)
                end = int(end_s) if end_s else size - 1
            else:  # suffix range: last N bytes
                start = max(0, size - int(end_s))
                end = size - 1
        except ValueError:
            f.close()
            return super().send_head()
        if start >= size:
            f.close()
            self.send_error(416, "Requested Range Not Satisfiable")
            return None
        end = min(end, size - 1)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        f.seek(start)
        self._range = (start, end - start + 1)
        return f

    def copyfile(self, source, outputfile):
        if getattr(self, "_range", None):
            _, remaining = self._range
            self._range = None
            while remaining > 0:
                chunk = source.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                remaining -= len(chunk)
        else:
            super().copyfile(source, outputfile)

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Quieter, single-line logging.
        print("  %s - %s" % (self.address_string(), fmt % args))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT,
                        help=f"port to bind (default {DEFAULT_PORT})")
    args = parser.parse_args()

    handler = functools.partial(Handler, directory=ROOT)
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer((HOST, args.port), handler) as httpd:
        print(f"TerraTransfer site serving on {HOST}:{args.port} (root: {ROOT})")
        print(f"  local:   http://127.0.0.1:{args.port}")
        print(f"  network: http://{socket.gethostname()}:{args.port}")
        print("  press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
