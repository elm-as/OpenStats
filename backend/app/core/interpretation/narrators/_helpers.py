def _fmt_pct(x: float | None, decimals: int = 1) -> str:
    if x is None:
        return "n/a"
    return f"{x * 100:.{decimals}f}%" if abs(x) <= 1.5 else f"{x:.{decimals}f}%"


def _fmt_num(x: float | None, decimals: int = 3) -> str:
    if x is None:
        return "n/a"
    if isinstance(x, (int,)) or (isinstance(x, float) and x.is_integer()):
        return f"{int(x):,}".replace(",", " ")
    return f"{x:.{decimals}f}"


def _safe(d: dict | None, *keys, default=None):
    """Accès profond sans KeyError."""
    cur = d
    for k in keys:
        if cur is None or not isinstance(cur, dict):
            return default
        cur = cur.get(k)
    return cur if cur is not None else default
