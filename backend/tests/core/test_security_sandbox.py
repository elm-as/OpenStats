"""
Tests de sécurité et de robustesse pour le sandbox, compute_variable et DuckDB (Lot B1).
"""

import os
import pytest
import pandas as pd
import numpy as np

from app.core.sandbox import (
    validate_python_code_safety,
    run_sandboxed_transform,
    run_sandboxed_custom,
)
from app.core.compute_variable import compute_new_variable, validate_formula_ast
from app.core.duckdb_analysis import compute_descriptive_stats_duckdb


class TestSandboxSecurity:
    """Vérifie l'étanchéité du sandbox contre les attaques RCE."""

    def test_blocks_os_import_and_execution(self):
        dangerous_codes = [
            "import os; os.system('echo test')",
            "import subprocess; subprocess.run(['ls'])",
            "x = df.__class__.__bases__[0].__subclasses__()",
            "open('test.txt', 'w').write('data')",
            "eval('1 + 1')",
            "exec('x = 2')",
        ]
        df = pd.DataFrame({"a": [1, 2, 3]})
        for code in dangerous_codes:
            with pytest.raises(ValueError):
                validate_python_code_safety(code)

            with pytest.raises(ValueError):
                run_sandboxed_transform(code, df)

    def test_allows_safe_transformations(self):
        df = pd.DataFrame({"a": [1, 2, 3], "b": [10, 20, 30]})
        code = "df['c'] = df['a'] * 2 + df['b']"
        res_df = run_sandboxed_transform(code, df)
        assert list(res_df["c"]) == [12, 24, 36]

    def test_allows_custom_analysis_function(self):
        df = pd.DataFrame({"val": [10, 20, 30, 40]})
        code = """
def analyze_custom(df, params):
    mean_val = float(df['val'].mean())
    return {"mean": mean_val, "status": "ok"}
"""
        res = run_sandboxed_custom(code, df)
        assert res["status"] == "ok"
        assert res["mean"] == 25.0

    def test_terminates_infinite_loop_timeout(self):
        df = pd.DataFrame({"a": [1, 2]})
        infinite_loop = "while True: pass"
        # Timeout très court (1s) pour le test
        with pytest.raises(ValueError, match="délai limite"):
            run_sandboxed_transform(infinite_loop, df, timeout_seconds=1)


class TestFormulaSecurity:
    """Vérifie la validation AST de compute_variable."""

    def test_valid_arithmetic_formulas(self):
        df = pd.DataFrame({"a": [1.0, 2.0, 3.0], "b": [4.0, 5.0, 6.0]})
        res_df, log = compute_new_variable(df, "sum_ab", "a + b * 2")
        assert log["success"] is True
        assert list(res_df["sum_ab"]) == [9.0, 12.0, 15.0]

    def test_valid_math_function(self):
        df = pd.DataFrame({"a": [1.0, 10.0, 100.0]})
        res_df, log = compute_new_variable(df, "log_a", "log10(a)")
        assert log["success"] is True
        assert list(res_df["log_a"]) == [0.0, 1.0, 2.0]

    def test_rejects_attribute_access_and_dangerous_calls(self):
        df = pd.DataFrame({"a": [1, 2]})
        bad_formulas = [
            "a.__class__",
            "__import__('os').system('echo hi')",
            "open('secret.txt').read()",
        ]
        for f in bad_formulas:
            res_df, log = compute_new_variable(df, "attack", f)
            assert log["success"] is False


class TestDuckDBSecurity:
    """Vérifie la robustesse de l'analyse DuckDB."""

    def test_handles_column_with_quotes(self, tmp_path):
        parquet_file = str(tmp_path / "test_quotes.parquet")
        df = pd.DataFrame({'col"with"quotes': [1.0, 2.0, 3.0], "standard": [10, 20, 30]})
        df.to_parquet(parquet_file)

        cols_info = [
            {"name": 'col"with"quotes', "type": "numeric"},
            {"name": "standard", "type": "numeric"},
        ]
        stats = compute_descriptive_stats_duckdb(parquet_file, cols_info)
        assert 'col"with"quotes' in stats
        assert stats['col"with"quotes']["mean"] == 2.0
        assert stats["standard"]["mean"] == 20.0

    def test_missing_file_raises_filenotfound(self):
        with pytest.raises(FileNotFoundError):
            compute_descriptive_stats_duckdb("non_existent_file.parquet", [])
