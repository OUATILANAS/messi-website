"""Serve the static replica locally with the production URL paths."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from sys import argv
from urllib.parse import urlsplit

DIST = Path(__file__).resolve().parent / 'dist'


class ReplicaHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path != '/' and not Path(path).suffix:
            page = self.translate_path(path + '.html')
            if Path(page).is_file():
                self.path = path + '.html'
        super().do_GET()

    def send_error(self, code, message=None, explain=None):
        if code != 404:
            return super().send_error(code, message, explain)
        page = (DIST / '404.html').read_bytes()
        self.send_response(404)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(page)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(page)


if __name__ == '__main__':
    port = int(argv[1]) if len(argv) > 1 else 8765
    handler = partial(ReplicaHandler, directory=str(DIST))
    with ThreadingHTTPServer(('127.0.0.1', port), handler) as server:
        print(f'http://127.0.0.1:{port}/', flush=True)
        server.serve_forever()
