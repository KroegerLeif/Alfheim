#!/usr/bin/env python3
"""Fail when a Compose service has unbounded logs or no memory limit.

Parses the output of ``docker compose -f <file> config --format json`` and
checks every service for

* a bounded ``logging`` configuration: the ``json-file`` driver with
  ``max-size`` set, the ``local`` driver (rotates by default) or ``none``; and
* (unless ``--logging-only`` is given) a memory limit, either
  ``deploy.resources.limits.memory`` or ``mem_limit``.

Run from the repository root:

    python3 scripts/check-compose.py compose.prod.yaml
    python3 scripts/check-compose.py --logging-only compose.yaml
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from typing import Any

BOUNDED_DRIVERS = {"local", "none"}


def logging_problem(service: dict[str, Any]) -> str | None:
    logging = service.get("logging")
    if not logging:
        return "no `logging` configuration (logs are unbounded)"
    driver = logging.get("driver", "json-file")
    if driver in BOUNDED_DRIVERS:
        return None
    if driver != "json-file":
        return f"logging driver `{driver}` is not known to be bounded"
    options = logging.get("options") or {}
    if not options.get("max-size"):
        return "json-file logging without `max-size` (logs are unbounded)"
    try:
        if int(options.get("max-file", 1)) < 1:
            return "json-file logging with `max-file` below 1"
    except (TypeError, ValueError):
        return "json-file logging with a non-numeric `max-file`"
    return None


def memory_problem(service: dict[str, Any]) -> str | None:
    limits = ((service.get("deploy") or {}).get("resources") or {}).get("limits") or {}
    if limits.get("memory") or service.get("mem_limit"):
        return None
    return "no memory limit (`deploy.resources.limits.memory` or `mem_limit`)"


def check_config(config: dict[str, Any], *, require_memory: bool = True) -> list[str]:
    """Return one message per violation, sorted by service name."""
    problems: list[str] = []
    for name, service in sorted((config.get("services") or {}).items()):
        service = service or {}
        checks = [logging_problem]
        if require_memory:
            checks.append(memory_problem)
        for check in checks:
            problem = check(service)
            if problem:
                problems.append(f"{name}: {problem}")
    return problems


def load_config(path: str) -> dict[str, Any]:
    # --no-interpolate: the checked keys never contain variables, and this
    # lets the production file be parsed without a populated .env.
    command = [
        "docker", "compose", "--profile", "*", "-f", os.path.basename(path), "config",
        "--format", "json", "--no-interpolate",
    ]
    output = subprocess.check_output(
        command, cwd=os.path.dirname(os.path.abspath(path)), text=True
    )
    return json.loads(output)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("compose_file")
    parser.add_argument(
        "--logging-only",
        action="store_true",
        help="skip the memory-limit check (dev compose files set none)",
    )
    args = parser.parse_args()

    try:
        config = load_config(args.compose_file)
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        print(f"could not read {args.compose_file}: {exc}", file=sys.stderr)
        return 2

    problems = check_config(config, require_memory=not args.logging_only)
    if problems:
        print(f"{args.compose_file}: {len(problems)} problem(s)", file=sys.stderr)
        for problem in problems:
            print(f"  {problem}", file=sys.stderr)
        return 1
    count = len(config.get("services") or {})
    print(f"{args.compose_file}: all {count} services have bounded logging"
          + ("" if args.logging_only else " and a memory limit"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
