#!/usr/bin/env python3
"""Verify that every relative Markdown link in the repository resolves.

Absolute URLs, mailto links and bare anchors are skipped: only on-disk paths
are checked. Run from the repository root.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys

LINK = re.compile(r"\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
SKIP_PREFIXES = ("http://", "https://", "mailto:", "tel:", "#", "/")
SKIP_PATHS = (".claude/worktrees/",)


def tracked_markdown_files() -> list[str]:
    out = subprocess.check_output(["git", "ls-files", "*.md", "*.mdx"], text=True)
    return [f for f in out.split() if not f.startswith(SKIP_PATHS)]


def main() -> int:
    broken: list[tuple[str, str]] = []
    files = tracked_markdown_files()

    for path in files:
        directory = os.path.dirname(path)
        with open(path, encoding="utf-8", errors="replace") as handle:
            content = handle.read()
        for match in LINK.finditer(content):
            target = match.group(1)
            if target.startswith(SKIP_PREFIXES):
                continue
            relative = target.split("#")[0]
            if not relative:
                continue
            if not os.path.exists(os.path.normpath(os.path.join(directory, relative))):
                broken.append((path, target))

    if broken:
        print(f"{len(broken)} broken relative link(s) in {len(files)} Markdown files:\n")
        current = None
        for path, target in broken:
            if path != current:
                print(f"  {path}")
                current = path
            print(f"    -> {target}")
        return 1

    print(f"All relative Markdown links resolve ({len(files)} files checked).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
