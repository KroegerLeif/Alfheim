"""Tests for scripts/lib/sync_versions.py (run: python3 -m unittest discover scripts/tests)."""

import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

_path = pathlib.Path(__file__).parents[1] / "lib" / "sync_versions.py"
_spec = importlib.util.spec_from_file_location("sync_versions", _path)
if _spec is None or _spec.loader is None:
    raise ImportError("cannot load scripts/lib/sync_versions.py")
sync_versions = importlib.util.module_from_spec(_spec)
# dataclasses resolves the module's string annotations through sys.modules.
sys.modules["sync_versions"] = sync_versions
_spec.loader.exec_module(sync_versions)

Pin = sync_versions.Pin
Component = sync_versions.Component

COMPONENTS = (
    Component(
        "go", "Go", (Pin(("go.work",), r"(?m)^go (?P<v>[\d.]+)$"), Pin(("*/Dockerfile",), r"golang:(?P<v>[\d.]+)"))
    ),
    Component(
        "python", "Python", (Pin(("ruff.toml",), r'target-version = "py(?P<v>\d+)"', render=sync_versions._py_nodot),)
    ),
    Component("lock", "Locked", (Pin(("lock.txt",), r"pkg@(?P<v>[\d.]+)", writable=False),)),
)
FILES = {
    "go.work": "go 1.27.4\n",
    "svc/Dockerfile": "FROM golang:1.27.4-alpine\n",
    "ruff.toml": 'target-version = "py314"\n',
    "lock.txt": "pkg@2.0.0\n",
}
MANIFEST = {"go": "1.27.4", "python": "3.14", "lock": "2.0.0"}


class SyncVersionsTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self._tmp.name)
        for rel, text in FILES.items():
            (self.root / rel).parent.mkdir(parents=True, exist_ok=True)
            (self.root / rel).write_text(text)
        self.write_manifest(MANIFEST)
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)
        subprocess.run(["git", "add", "-A"], cwd=self.root, check=True)
        sync_versions.sync(self.root, write=True, components=COMPONENTS)

    def tearDown(self):
        self._tmp.cleanup()

    def write_manifest(self, data):
        (self.root / "versions.json").write_text(json.dumps(data))

    def check(self):
        return sync_versions.sync(self.root, write=False, components=COMPONENTS)

    def test_matching_pins_pass(self):
        self.assertEqual(self.check(), [])

    def test_drifted_pin_fails_with_location(self):
        (self.root / "svc/Dockerfile").write_text("FROM golang:1.27.3-alpine\n")
        problems = self.check()
        self.assertEqual(len(problems), 1)
        self.assertTrue(problems[0].startswith("svc/Dockerfile:1: Go is 1.27.3"))

    def test_rendered_pin_uses_the_component_format(self):
        self.write_manifest({**MANIFEST, "python": "3.15"})
        problems = self.check()
        self.assertIn("ruff.toml:1: Python is 314, versions.json says 315", problems)

    def test_write_updates_pins_and_versions_md(self):
        self.write_manifest({**MANIFEST, "go": "1.28.0"})
        self.assertEqual(sync_versions.sync(self.root, write=True, components=COMPONENTS), [])
        self.assertEqual((self.root / "go.work").read_text(), "go 1.28.0\n")
        self.assertEqual((self.root / "svc/Dockerfile").read_text(), "FROM golang:1.28.0-alpine\n")
        versions_md = (self.root / "VERSIONS.md").read_text()
        self.assertIn("| Go | `1.28.0` | 2 files |", versions_md)
        self.assertIn("- **Go:** `go.work`, `svc/Dockerfile`", versions_md)
        self.assertEqual(self.check(), [])

    def test_write_reports_but_keeps_generated_pins(self):
        self.write_manifest({**MANIFEST, "lock": "2.1.0"})
        problems = sync_versions.sync(self.root, write=True, components=COMPONENTS)
        self.assertEqual((self.root / "lock.txt").read_text(), "pkg@2.0.0\n")
        self.assertEqual(len(problems), 1)
        self.assertIn("regenerate the lockfile", problems[0])

    def test_stale_versions_md_fails(self):
        (self.root / "VERSIONS.md").write_text("# edited by hand\n")
        self.assertIn("VERSIONS.md is out of date", self.check()[0])

    def test_pattern_without_match_fails(self):
        (self.root / "svc/Dockerfile").write_text("FROM alpine\n")
        self.assertTrue(any("matched no file" in p for p in self.check()))

    def test_unknown_manifest_key_is_rejected(self):
        self.write_manifest({**MANIFEST, "rust": "1.90"})
        with self.assertRaises(SystemExit):
            self.check()


if __name__ == "__main__":
    unittest.main()
