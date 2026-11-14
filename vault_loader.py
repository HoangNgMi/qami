# -*- coding: utf-8 -*-
"""vault_loader.py — nạp secret từ _VAULT/<slug>.env vào os.environ (két ngoài repo).
Đi NGƯỢC cây tìm két THẬT SỰ chứa <slug>.env (tránh split-brain Dev/_VAULT vs Documents/_VAULT);
utf-8-sig để chịu BOM; biến đã có trong env THẬT không bị ghi đè."""
import os
from pathlib import Path


def _find_vault(slug: str):
    here = Path(__file__).resolve()
    for d in (here.parent, *here.parents):
        cand = d / "_VAULT" / f"{slug}.env"
        if cand.exists():
            return cand
    return None


def load(slug: str = "qami") -> bool:
    f = _find_vault(slug)
    if not f:
        return False
    for raw in f.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:   # env thật ưu tiên
            os.environ[k] = v
    return True
