#!/usr/bin/env python3
"""Crawl the built GitHub Pages artifact and report rendering defects.

Merges the landing page build and the portal build the same way
.github/workflows/deploy-docs.yml does (portal under /docs), then walks every
HTML file and reports:

* internal links, images, stylesheets and scripts whose target does not exist
* in-page and cross-page anchors (#id) that do not exist in the target page
* portal pages that are not reachable from the sidebar of their locale
* portal pages with an empty content body
* root-absolute URLs that ignore the /docs base path

Build both sites first:
    pnpm --filter @alfheim/landing build
    pnpm --filter @alfheim/docs-portal build
    python3 scripts/check-docs-site.py

Exit code 0 means the crawl is clean.
"""

from __future__ import annotations

import argparse
import shutil
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
BASE = "/docs"
MIN_BODY_CHARS = 80
LOCALES = ("en", "de")


class Page(HTMLParser):
    """Collects links, ids, sidebar links and body text of a single page."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.refs: list[tuple[str, str]] = []
        self.ids: set[str] = set()
        self.sidebar_links: set[str] = set()
        self.body_text = ""
        self._sidebar_depth = 0
        self._content_depth = 0
        self._stack: list[tuple[str, bool, bool]] = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for key in ("id", "name"):
            if a.get(key):
                self.ids.add(a[key])
        if tag == "a" and a.get("href") is not None:
            self.refs.append(("a", a["href"]))
            if self._sidebar_depth:
                self.sidebar_links.add(a["href"])
        elif tag == "img" and a.get("src"):
            self.refs.append(("img", a["src"]))
        elif tag == "link" and a.get("href") and a.get("rel") in (
            "stylesheet", "icon", "manifest", "apple-touch-icon", "shortcut icon",
        ):
            self.refs.append(("link", a["href"]))
        elif tag == "script" and a.get("src"):
            self.refs.append(("script", a["src"]))
        if tag in ("script", "style"):
            self._skip += 1
        if tag in ("br", "hr", "img", "input", "meta", "link", "source", "path"):
            return
        classes = a.get("class", "") or ""
        in_sidebar = "sidebar-content" in classes
        in_content = "sl-markdown-content" in classes
        self._stack.append((tag, in_sidebar, in_content))
        self._sidebar_depth += in_sidebar
        self._content_depth += in_content

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self._skip:
            self._skip -= 1
        for i in range(len(self._stack) - 1, -1, -1):
            if self._stack[i][0] == tag:
                for _, s, c in self._stack[i:]:
                    self._sidebar_depth -= s
                    self._content_depth -= c
                del self._stack[i:]
                break

    def handle_data(self, data):
        if self._content_depth and not self._skip:
            self.body_text += data


def url_of(root: Path, file: Path) -> str:
    rel = file.relative_to(root).as_posix()
    if rel.endswith("index.html"):
        rel = rel[: -len("index.html")]
    return "/" + rel


def resolve(root: Path, path: str) -> Path | None:
    """Map a URL path to a file the way GitHub Pages serves it."""
    p = PurePosixPath(unquote(path).lstrip("/"))
    for cand in (root / p, root / p / "index.html"):
        if cand.is_file():
            return cand
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--landing", default=str(ROOT / "websites/landing/dist"))
    ap.add_argument("--portal", default=str(ROOT / "websites/portal/dist"))
    args = ap.parse_args()

    landing, portal = Path(args.landing), Path(args.portal)
    for d in (landing, portal):
        if not d.is_dir():
            print(f"missing build output: {d} (build first)", file=sys.stderr)
            return 2

    with tempfile.TemporaryDirectory() as tmp:
        site = Path(tmp) / "site"
        shutil.copytree(landing, site)
        shutil.copytree(portal, site / BASE.lstrip("/"), dirs_exist_ok=True)
        return crawl(site)


def crawl(site: Path) -> int:
    pages: dict[Path, Page] = {}
    for f in sorted(site.rglob("*.html")):
        p = Page()
        p.feed(f.read_text(encoding="utf-8", errors="replace"))
        pages[f] = p

    problems: dict[str, list[str]] = {
        "broken links": [], "broken assets": [], "broken anchors": [],
        "base path violations": [], "orphan pages": [], "empty pages": [],
    }
    for f, page in pages.items():
        here = url_of(site, f)
        in_portal = here.startswith(BASE + "/")
        for kind, ref in page.refs:
            parts = urlsplit(ref)
            if parts.scheme or ref.startswith("//") or parts.scheme == "mailto":
                continue
            if ref.startswith(("mailto:", "tel:", "javascript:", "data:")):
                continue
            path = parts.path or here
            if not path.startswith("/"):
                path = str(PurePosixPath(here).parent / path)
                # Normalise "..", "." segments.
                stack: list[str] = []
                for seg in path.split("/"):
                    if seg == "..":
                        stack and stack.pop()
                    elif seg not in ("", "."):
                        stack.append(seg)
                path = "/" + "/".join(stack) + ("/" if path.endswith("/") else "")
            elif in_portal and not (path == BASE or path.startswith(BASE + "/")):
                problems["base path violations"].append(f"{here} -> {ref}")
            target = resolve(site, path)
            label = f"{here} -> {ref}"
            if target is None:
                bucket = "broken links" if kind == "a" else "broken assets"
                problems[bucket].append(label)
                continue
            if parts.fragment and target.suffix == ".html" and parts.fragment != "_top":
                tp = pages.get(target)
                if tp is not None and unquote(parts.fragment) not in tp.ids:
                    problems["broken anchors"].append(label)

    # Portal pages per locale must be linked from that locale's sidebar. The
    # splash home page has no sidebar, so a regular page of the locale is used.
    for locale in LOCALES:
        prefix = f"{BASE}/{locale}/"
        locale_pages = {f: p for f, p in pages.items() if url_of(site, f).startswith(prefix)}
        linked: set[Path] = set()
        for page in locale_pages.values():
            if page.sidebar_links:
                for href in page.sidebar_links:
                    t = resolve(site, urlsplit(href).path)
                    if t:
                        linked.add(t)
                break
        else:
            problems["orphan pages"].append(f"no sidebar found for locale {locale}")
            continue
        for f in locale_pages:
            if f not in linked and url_of(site, f) != prefix:
                problems["orphan pages"].append(url_of(site, f))

    for f, page in pages.items():
        u = url_of(site, f)
        if u.startswith(BASE + "/") and u != f"{BASE}/404.html" and "sl-markdown-content" in f.read_text(encoding="utf-8"):
            if len(page.body_text.strip()) < MIN_BODY_CHARS:
                problems["empty pages"].append(u)

    total = 0
    print(f"Crawled {len(pages)} HTML pages")
    for name, items in problems.items():
        items = sorted(set(items))
        total += len(items)
        print(f"{name}: {len(items)}")
        for item in items[:50]:
            print(f"  {item}")
        if len(items) > 50:
            print(f"  ... and {len(items) - 50} more")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
