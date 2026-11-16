#!/usr/bin/env python3
"""Unified reproducible runner for Openstats opaque-box E2E test suite.

Verifies ELMAS.md file line count constraints (<= 350 lines per file)
and executes pytest across Tiers 1 through 4 with code 0 pass guarantee.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

MAX_FILE_LINES = 350


def count_file_lines(file_path: Path) -> int:
    """Returns the physical line count of a given text file."""
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return sum(1 for _ in f)


def verify_elmas_line_counts(target_dir: Path, runner_path: Path) -> list[tuple[str, int, bool]]:
    """Verifies that all Python files strictly conform to the 350-line limit."""
    results = []
    py_files = sorted(target_dir.glob("*.py"))
    if runner_path.is_file():
        py_files.append(runner_path)

    for py_file in py_files:
        lines = count_file_lines(py_file)
        is_valid = lines <= MAX_FILE_LINES
        results.append((py_file.name, lines, is_valid))

    return results


def print_line_count_report(results: list[tuple[str, int, bool]]) -> bool:
    """Prints formatted table of file line counts and returns True if all pass."""
    print("=" * 70)
    print("ELMAS.md Line Count Compliance Check (Max 350 lines per file)")
    print("=" * 70)

    all_passed = True
    for filename, count, is_valid in results:
        status = "PASS" if is_valid else "FAIL"
        print(f"  [{status}] {filename:<45} : {count:>4} lines")
        if not is_valid:
            all_passed = False

    print("=" * 70)
    return all_passed


def run_pytest_suite(backend_dir: Path, test_dir: Path) -> int:
    """Executes pytest in a subprocess with isolated environment and -p no:qt."""
    env = os.environ.copy()
    env["OPENSTATS_PRELOAD"] = "0"
    env["LOCAL_DEV_MODE"] = "false"
    env["FLASK_ENV"] = "testing"
    env["PYTHONPATH"] = str(backend_dir)

    python_bin = sys.executable
    cmd = [
        python_bin,
        "-m",
        "pytest",
        str(test_dir),
        "-v",
        "-p",
        "no:qt",
    ]

    print(f"Executing: {' '.join(cmd)}")
    print(f"Working Directory: {backend_dir}")
    print("-" * 70)

    res = subprocess.run(cmd, cwd=str(backend_dir), env=env)
    return res.returncode


def main() -> int:
    """Main entrypoint for E2E suite validation."""
    script_file = Path(__file__).resolve()
    backend_dir = script_file.parent.parent
    e2e_test_dir = backend_dir / "tests" / "e2e"

    if not e2e_test_dir.is_dir():
        print(f"Error: E2E directory not found at {e2e_test_dir}")
        return 1

    # 1. Line count verification
    compliance_results = verify_elmas_line_counts(e2e_test_dir, script_file)
    if not print_line_count_report(compliance_results):
        print("ELMAS.md line count check FAILED: Some files exceed 350 lines!")
        return 1

    print("ELMAS.md compliance check PASSED (all files <= 350 lines).\n")

    # 2. Pytest execution across all tiers
    exit_code = run_pytest_suite(backend_dir, e2e_test_dir)

    print("=" * 70)
    if exit_code == 0:
        print("ALL E2E TESTS PASSED SUCCESSFULLY (Exit code 0)")
    else:
        print(f"E2E TEST SUITE FAILED (Exit code {exit_code})")
    print("=" * 70)

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
