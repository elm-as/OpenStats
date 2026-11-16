"""Master E2E acceptance test runner for OpenStats Desktop Application.

Orchestrates multi-tier verification (ELMAS.md compliance, TypeScript,
Vitest component tests, Pytest E2E tiers, UI themes, packaging, documentation).
Strictly adheres to ELMAS.md: <= 350 lines, guard clauses, stdlib only.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path


class StepResult:
    """Encapsulates outcome, duration, and details of a verification step."""

    def __init__(self, name: str, passed: bool, duration: float, detail: str) -> None:
        self.name = name
        self.passed = passed
        self.duration = duration
        self.detail = detail

    def to_dict(self) -> dict[str, object]:
        """Serializes step result to JSON-compatible dictionary."""
        return {
            "name": self.name,
            "passed": self.passed,
            "duration_s": round(self.duration, 2),
            "detail": self.detail,
        }


def resolve_python() -> str:
    """Resolves Python 3.10 interpreter, avoiding MSYS2 ucrt64 runtime."""
    known = Path(r"C:\Users\elmas\AppData\Local\Programs\Python\Python310\python.exe")
    if known.is_file():
        return str(known)
    return sys.executable


def resolve_iscc() -> str | None:
    """Discovers Inno Setup compiler executable (ISCC.exe)."""
    which_path = shutil.which("iscc")
    if which_path:
        return which_path
    known_paths = [
        Path(r"C:\Users\elmas\AppData\Local\Programs\Inno Setup 6\ISCC.exe"),
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Inno Setup 6" / "ISCC.exe",
        Path("C:/Program Files/Inno Setup 6/ISCC.exe"),
    ]
    return next((str(p) for p in known_paths if p.is_file()), None)


def run_command(cmd: str | list[str], cwd: Path, env: dict[str, str] | None = None) -> tuple[int, str]:
    """Executes a subprocess command returning exit code and merged output."""
    full_env = os.environ.copy()
    if env:
        full_env.update(env)
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd),
            env=full_env,
            shell=isinstance(cmd, str),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        return proc.returncode, proc.stdout.strip()
    except Exception as exc:
        return 1, f"Execution failed: {exc}"


def run_step_lines(base_dir: Path, py_bin: str) -> tuple[bool, str]:
    """Runs check_line_counts.py to enforce ELMAS.md 350-line limit."""
    script_path = base_dir / "backend" / "scripts" / "check_line_counts.py"
    if not script_path.is_file():
        return False, f"Missing script: {script_path}"
    code, output = run_command([py_bin, str(script_path)], base_dir)
    return code == 0, output


def run_step_tsc(base_dir: Path) -> tuple[bool, str]:
    """Validates TypeScript static types across the frontend workbench."""
    frontend_dir = base_dir / "frontend"
    if not frontend_dir.is_dir():
        return False, f"Missing frontend directory: {frontend_dir}"
    code, output = run_command("npx tsc -b --noEmit", frontend_dir)
    return code == 0, output if output else "TypeScript compiled with 0 errors."


def run_step_vitest(base_dir: Path) -> tuple[bool, str]:
    """Executes Vitest suite with isolated threads and no file parallelism."""
    frontend_dir = base_dir / "frontend"
    if not frontend_dir.is_dir():
        return False, f"Missing frontend directory: {frontend_dir}"
    code, output = run_command("npx vitest run --pool=threads --no-file-parallelism", frontend_dir)
    return code == 0, output


def get_pytest_files(backend_dir: Path, target: str) -> list[str]:
    """Maps target tier string to corresponding test files."""
    tier_map: dict[str, list[str]] = {
        "tier1": [
            "tests/e2e/test_tier1_auth_lifecycle.py",
            "tests/e2e/test_tier1_analytics_features.py",
            "tests/e2e/test_tier1_canvas_reporting.py",
            "tests/e2e/test_tier1_timeseries_modeling.py",
        ],
        "tier2": ["tests/e2e/test_tier2_boundary_corner.py"],
        "tier3": ["tests/e2e/test_tier3_cross_feature.py"],
        "tier4": ["tests/e2e/test_tier4_real_world.py"],
        "all": ["tests/e2e"],
    }
    return tier_map.get(target, ["tests/e2e"])


def run_step_pytest(base_dir: Path, py_bin: str, target: str) -> tuple[bool, str]:
    """Executes backend pytest E2E suites with isolated testing environment."""
    backend_dir = base_dir / "backend"
    test_files = get_pytest_files(backend_dir, target)
    env = {
        "OPENSTATS_PRELOAD": "0",
        "LOCAL_DEV_MODE": "false",
        "FLASK_ENV": "testing",
        "PYTHONPATH": str(backend_dir),
    }
    cmd = [py_bin, "-m", "pytest"] + test_files + ["-v", "-p", "no:qt"]
    code, output = run_command(cmd, backend_dir, env)
    return code == 0, output


def run_step_themes(base_dir: Path) -> tuple[bool, str]:
    """Audits theme tokens, tabular typography (tnum), and Jamovi components."""
    styles = base_dir / "frontend" / "src" / "styles"
    tokens = (styles / "tokens.css").read_text("utf-8", errors="ignore")
    light = (styles / "theme-light.css").read_text("utf-8", errors="ignore")
    studio = (styles / "studio-primitives.css").read_text("utf-8", errors="ignore")
    if "--ui-bg-" not in tokens or "--surface-" not in tokens:
        return False, "tokens.css missing --ui-bg- or --surface- tokens"
    if '[data-theme="light"]' not in light:
        return False, "theme-light.css missing [data-theme='light'] override"
    if "tnum" not in studio or ".ui-num" not in studio or ".ui-td-num" not in studio:
        return False, "studio-primitives.css missing tabular typography rules"

    shell = base_dir / "frontend" / "src" / "components" / "shell"
    comps = ("AppShell.tsx", "ContextBar.tsx", "NavRail.tsx", "StatusBar.tsx", "CommandPalette.tsx")
    missing = [c for c in comps if not (shell / c).is_file()]
    if missing:
        return False, f"Missing Jamovi shell components: {missing}"
    return True, "Theme tokens, light theme, tabular typography, and shell components valid."


def run_step_packaging(base_dir: Path) -> tuple[bool, str]:
    """Audits Windows installer packaging readiness and ISCC compiler."""
    assets = ["backend/build_backend.py", "backend/openstats-backend.spec", "scripts/build_installer.py", "installer.iss"]
    missing = [a for a in assets if not (base_dir / a).is_file()]
    if missing:
        return False, f"Missing packaging assets: {missing}"
    iscc_path = resolve_iscc()
    if not iscc_path:
        return False, "Inno Setup compiler (ISCC.exe) not found on system"
    return True, f"Packaging assets present. ISCC compiler: {iscc_path}"


def run_step_docs(base_dir: Path) -> tuple[bool, str]:
    """Audits USER_GUIDE, TECHNICAL_ARCHITECTURE, and root README linkages."""
    ug = base_dir / "docs" / "USER_GUIDE.md"
    ta = base_dir / "docs" / "TECHNICAL_ARCHITECTURE.md"
    rm = base_dir / "README.md"
    if not ug.is_file() or ug.stat().st_size < 1000:
        return False, "USER_GUIDE.md missing or empty"
    if not ta.is_file() or ta.stat().st_size < 1000:
        return False, "TECHNICAL_ARCHITECTURE.md missing or empty"
    if not rm.is_file():
        return False, "Root README.md missing"

    ug_txt = ug.read_text("utf-8", "ignore")
    ta_txt = ta.read_text("utf-8", "ignore")
    rm_txt = rm.read_text("utf-8", "ignore")
    if "Table des Mati" not in ug_txt and "Guide Utilisateur" not in ug_txt:
        return False, "USER_GUIDE.md missing core table of contents"
    if "Table des Mati" not in ta_txt and "Architecture Technique" not in ta_txt:
        return False, "TECHNICAL_ARCHITECTURE.md missing core chapters"
    if "docs/USER_GUIDE.md" not in rm_txt or "docs/TECHNICAL_ARCHITECTURE.md" not in rm_txt:
        return False, "README.md missing markdown links to docs/"
    return True, "Documentation guides and README linkages verified successfully."


def execute_single_step(step_name: str, base_dir: Path, py_bin: str) -> StepResult:
    """Dispatches execution for a named verification step with elapsed timing."""
    start_time = time.time()
    passed = False
    detail = ""

    if step_name == "lines":
        passed, detail = run_step_lines(base_dir, py_bin)
    elif step_name == "tsc":
        passed, detail = run_step_tsc(base_dir)
    elif step_name == "vitest":
        passed, detail = run_step_vitest(base_dir)
    elif step_name.startswith("pytest"):
        target = step_name.split(":", 1)[1] if ":" in step_name else "all"
        passed, detail = run_step_pytest(base_dir, py_bin, target)
    elif step_name == "themes":
        passed, detail = run_step_themes(base_dir)
    elif step_name == "packaging":
        passed, detail = run_step_packaging(base_dir)
    elif step_name == "docs":
        passed, detail = run_step_docs(base_dir)
    else:
        detail = f"Unknown step: {step_name}"

    duration = time.time() - start_time
    return StepResult(step_name, passed, duration, detail)


def resolve_step_list(tier: int | None, step: str | None, is_fast: bool) -> list[str]:
    """Determines the sequence of steps to execute based on CLI configuration."""
    if step:
        if step == "pytest" and tier:
            return [f"pytest:tier{tier}"]
        return [step]

    if is_fast:
        return ["lines", "tsc", "vitest", "themes", "packaging", "docs"]

    if tier == 1:
        return ["lines", "tsc", "vitest", "pytest:tier1"]
    if tier == 2:
        return ["pytest:tier2"]
    if tier == 3:
        return ["pytest:tier3"]
    if tier == 4:
        return ["pytest:tier4", "themes", "packaging", "docs"]

    return ["lines", "tsc", "vitest", "pytest:all", "themes", "packaging", "docs"]


def print_banner(title: str) -> None:
    """Renders formatted console banner."""
    print("=" * 72)
    print(f" {title}")
    print("=" * 72)


def print_step_outcome(result: StepResult) -> None:
    """Prints single step completion status and summary lines."""
    tag = "[PASS]" if result.passed else "[FAIL]"
    print(f"{tag} {result.name:<16} in {result.duration:6.2f}s")
    if not result.passed:
        first_line = result.detail.splitlines()[0] if result.detail else "No detail"
        print(f"       >> Error: {first_line[:90]}")


def write_json_report(output_path: str, results: list[StepResult], total_time: float) -> None:
    """Exports structured JSON report of test execution."""
    data = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_duration_s": round(total_time, 2),
        "overall_passed": all(r.passed for r in results),
        "summary": {
            "total": len(results),
            "passed": sum(1 for r in results if r.passed),
            "failed": sum(1 for r in results if not r.passed),
        },
        "steps": [r.to_dict() for r in results],
    }
    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"\nJSON report written to: {out_file.resolve()}")


def parse_arguments() -> argparse.Namespace:
    """Configures CLI flags for master E2E runner."""
    parser = argparse.ArgumentParser(description="Master E2E Acceptance Test Runner")
    parser.add_argument("--tier", type=int, choices=[1, 2, 3, 4], help="Run checks for specific tier")
    parser.add_argument(
        "--step",
        choices=["lines", "tsc", "vitest", "pytest", "themes", "packaging", "docs"],
        help="Execute a single check step",
    )
    parser.add_argument("--fast", action="store_true", help="Fast pass (skips heavy backend modeling tests)")
    parser.add_argument("--json", dest="json_path", help="Path to export JSON results report")
    return parser.parse_args()


def main() -> int:
    """Main execution entrypoint for E2E runner."""
    args = parse_arguments()
    base_dir = Path(__file__).resolve().parent.parent
    py_bin = resolve_python()
    steps = resolve_step_list(args.tier, args.step, args.fast)

    print_banner(f"OpenStats Desktop E2E Acceptance Test Suite ({len(steps)} steps)")
    print(f"Root Directory: {base_dir}")
    print(f"Python Runtime: {py_bin}")
    print("-" * 72)

    total_start = time.time()
    results: list[StepResult] = []

    for name in steps:
        res = execute_single_step(name, base_dir, py_bin)
        results.append(res)
        print_step_outcome(res)

    total_time = time.time() - total_start
    all_passed = all(r.passed for r in results)

    print("-" * 72)
    summary_tag = "ALL CHECKS PASSED" if all_passed else "ACCEPTANCE CHECKS FAILED"
    print(f"Summary: {summary_tag} ({sum(1 for r in results if r.passed)}/{len(results)} in {total_time:.2f}s)")
    print("=" * 72)

    if args.json_path:
        write_json_report(args.json_path, results, total_time)

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
