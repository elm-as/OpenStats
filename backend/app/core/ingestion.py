"""
Module d'ingestion : Adaptateurs de format (CSV, XLSX, JSON).
Patron Adapter : chaque format expose une interface DataFrame unifiée.
"""

from __future__ import annotations

import io
import json
import chardet
import pandas as pd
from pathlib import Path
from typing import Optional


MAGIC_BYTES: dict[str, list[bytes]] = {
    "csv": [],
    "xlsx": [b"\x50\x4B\x03\x04"],
    "xls": [b"\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1"],
    "json": [],
    "jsonl": [],
}


def validate_file_magic(filepath: str, allowed_extensions: set[str]) -> bool:
    """Vérifie les magic bytes du fichier selon son extension."""
    ext = Path(filepath).suffix.lstrip(".").lower()
    if ext not in allowed_extensions:
        return False

    expected = MAGIC_BYTES.get(ext)
    if expected is None:
        return False

    if not expected:
        if ext in ("csv", "json", "jsonl"):
            try:
                with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                    sample = f.read(512)
                if ext in ("json", "jsonl"):
                    stripped = sample.strip()
                    return stripped.startswith("{") or stripped.startswith("[")
                return len(sample) > 0
            except Exception:
                return False
        return True

    with open(filepath, "rb") as f:
        header = f.read(max(len(m) for m in expected))
    return any(header.startswith(magic) for magic in expected)


class BaseAdapter:
    """Interface commune pour tous les adaptateurs de format."""

    def read(self, source: str | io.BytesIO, **kwargs) -> pd.DataFrame:
        raise NotImplementedError


class CSVAdapter(BaseAdapter):
    """
    Adaptateur CSV avec détection automatique :
    - Encodage (chardet)
    - Délimiteur (sniffer)
    - En-tête
    """

    DELIMITERS = [",", ";", "\t", "|"]

    def read(self, source: str | io.BytesIO, **kwargs) -> pd.DataFrame:
        encoding = kwargs.get("encoding") or self._detect_encoding(source)
        delimiter = kwargs.get("delimiter") or self._detect_delimiter(source, encoding)

        read_kwargs = {
            "encoding": encoding,
            "sep": delimiter,
            "on_bad_lines": "warn",
            "engine": "python",
        }
        read_kwargs.update({k: v for k, v in kwargs.items() if k not in ("encoding", "delimiter")})

        if isinstance(source, (str, Path)):
            return pd.read_csv(source, **read_kwargs)
        source.seek(0)
        return pd.read_csv(source, **read_kwargs)

    def _detect_encoding(self, source: str | io.BytesIO) -> str:
        if isinstance(source, (str, Path)):
            with open(source, "rb") as f:
                raw = f.read(100_000)
        else:
            raw = source.read(100_000)
            source.seek(0)
        result = chardet.detect(raw)
        return result.get("encoding", "utf-8") or "utf-8"

    def _detect_delimiter(self, source: str | io.BytesIO, encoding: str) -> str:
        if isinstance(source, (str, Path)):
            with open(source, "r", encoding=encoding, errors="replace") as f:
                sample = f.read(10_000)
        else:
            source.seek(0)
            sample = source.read(10_000)
            if isinstance(sample, bytes):
                sample = sample.decode(encoding, errors="replace")
            source.seek(0)

        counts = {d: sample.count(d) for d in self.DELIMITERS}
        best = max(counts, key=counts.get)
        return best if counts[best] > 0 else ","


class ExcelAdapter(BaseAdapter):
    """
    Adaptateur Excel (XLSX/XLS) avec support multi-feuilles.
    """

    def read(self, source: str | io.BytesIO, **kwargs) -> pd.DataFrame:
        sheet_name = kwargs.pop("sheet_name", 0)

        read_kwargs = {"sheet_name": sheet_name, "engine": "openpyxl"}
        read_kwargs.update(kwargs)

        if isinstance(source, (str, Path)):
            return pd.read_excel(source, **read_kwargs)
        source.seek(0)
        return pd.read_excel(source, **read_kwargs)

    @staticmethod
    def list_sheets(source: str | io.BytesIO) -> list[str]:
        if isinstance(source, (str, Path)):
            xls = pd.ExcelFile(source, engine="openpyxl")
        else:
            source.seek(0)
            xls = pd.ExcelFile(source, engine="openpyxl")
        return xls.sheet_names


class JSONAdapter(BaseAdapter):
    """
    Adaptateur JSON / JSONL avec aplatissement configurable.
    """

    def read(self, source: str | io.BytesIO, **kwargs) -> pd.DataFrame:
        is_jsonl = kwargs.pop("jsonl", False)

        if isinstance(source, (str, Path)):
            with open(source, "r", encoding="utf-8") as f:
                content = f.read()
        else:
            source.seek(0)
            content = source.read()
            if isinstance(content, bytes):
                content = content.decode("utf-8")

        if is_jsonl:
            records = [json.loads(line) for line in content.strip().split("\n") if line.strip()]
            df = pd.json_normalize(records, max_level=kwargs.get("max_level", 3))
        else:
            data = json.loads(content)
            if isinstance(data, list):
                df = pd.json_normalize(data, max_level=kwargs.get("max_level", 3))
            elif isinstance(data, dict):
                # Cherche la première clé contenant une liste
                for key, val in data.items():
                    if isinstance(val, list):
                        df = pd.json_normalize(val, max_level=kwargs.get("max_level", 3))
                        break
                else:
                    df = pd.json_normalize(data, max_level=kwargs.get("max_level", 3))
        return df


# Registre des adaptateurs
ADAPTERS = {
    "csv": CSVAdapter,
    "xlsx": ExcelAdapter,
    "xls": ExcelAdapter,
    "json": JSONAdapter,
    "jsonl": JSONAdapter,
}


def get_adapter(filename: str) -> BaseAdapter:
    ext = Path(filename).suffix.lstrip(".").lower()
    adapter_cls = ADAPTERS.get(ext)
    if adapter_cls is None:
        raise ValueError(f"Format non supporté : .{ext}. Formats acceptés : {list(ADAPTERS.keys())}")
    return adapter_cls()


def ingest_file(filepath: str, **kwargs) -> pd.DataFrame:
    """Point d'entrée principal d'ingestion."""
    adapter = get_adapter(filepath)
    ext = Path(filepath).suffix.lstrip(".").lower()
    if ext == "jsonl":
        kwargs["jsonl"] = True
    return adapter.read(filepath, **kwargs)
