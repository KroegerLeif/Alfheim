"""Tests for scripts/check-compose.py (run: python3 -m unittest discover scripts/tests)."""

import importlib.util
import pathlib
import unittest

_spec = importlib.util.spec_from_file_location(
    "check_compose", pathlib.Path(__file__).parents[1] / "check-compose.py"
)
check_compose = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(check_compose)

GOOD = {
    "logging": {"driver": "json-file", "options": {"max-size": "10m", "max-file": "3"}},
    "deploy": {"resources": {"limits": {"memory": "256m"}}},
}


class CheckComposeTest(unittest.TestCase):
    def check(self, services, **kwargs):
        return check_compose.check_config({"services": services}, **kwargs)

    def test_compliant_service_passes(self):
        self.assertEqual(self.check({"a": GOOD}), [])

    def test_service_without_logging_fails(self):
        service = {k: v for k, v in GOOD.items() if k != "logging"}
        problems = self.check({"a": GOOD, "new-service": service})
        self.assertEqual(len(problems), 1)
        self.assertTrue(problems[0].startswith("new-service: no `logging`"))

    def test_json_file_without_max_size_fails(self):
        service = {**GOOD, "logging": {"driver": "json-file"}}
        self.assertEqual(len(self.check({"a": service})), 1)

    def test_unknown_driver_fails_and_local_passes(self):
        self.assertEqual(len(self.check({"a": {**GOOD, "logging": {"driver": "syslog"}}})), 1)
        self.assertEqual(self.check({"a": {**GOOD, "logging": {"driver": "local"}}}), [])

    def test_missing_memory_limit_fails(self):
        service = {"logging": GOOD["logging"]}
        self.assertEqual(len(self.check({"a": service})), 1)
        self.assertEqual(self.check({"a": service}, require_memory=False), [])

    def test_mem_limit_is_accepted(self):
        service = {"logging": GOOD["logging"], "mem_limit": "128m"}
        self.assertEqual(self.check({"a": service}), [])


if __name__ == "__main__":
    unittest.main()
