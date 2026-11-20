# -*- coding: utf-8 -*-
"""load_bronze.py — S1.1: nạp output pipeline file `cleaned/02_income_py.xlsx` -> bronze.orders_central.
RAW LANDING: giữ as-is, chỉ sanitize tên cột sang snake_case ASCII (tên gốc lưu ở COMMENT để truy vết).
Idempotent (DROP+CREATE+INSERT). ĐỌC data thật qua subprocess; KHÔNG sửa file nguồn; DB local (gitignore)."""
import sys
import re
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
_ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import pgconn  # noqa: E402

SRC = _ROOT / "cleaned" / "02_income_py.xlsx"   # = config.CLEANED (output của merge.py)
TABLE = "bronze.orders_central"


def sane_col(name):
    s = unicodedata.normalize("NFKD", str(name)).encode("ascii", "ignore").decode()
    s = re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_").lower()
    return s or "col"


def pg_type(dtype):
    k = str(dtype)
    if k.startswith("int"):
        return "bigint"
    if k.startswith("float"):
        return "numeric"
    if "datetime" in k:
        return "timestamp"
    if k == "bool":
        return "boolean"
    return "text"


def main():
    if not SRC.exists():
        print(f"✘ Không thấy {SRC}")
        print("  → Chạy pipeline file trước: python python/run_all.py")
        return 1

    import pandas as pd
    import numpy as np

    df = pd.read_excel(SRC)
    n = len(df)

    # tên cột sanitize + chống trùng, giữ map tên gốc
    cols, seen, origmap = [], {}, {}
    for orig in df.columns:
        s = sane_col(orig)
        if s in seen:
            seen[s] += 1
            s = f"{s}_{seen[s]}"
        else:
            seen[s] = 0
        cols.append(s)
        origmap[s] = str(orig)
    types = [pg_type(df[c].dtype) for c in df.columns]

    def coerce(v):
        try:
            if v is None or pd.isna(v):
                return None
        except (TypeError, ValueError):
            pass
        if isinstance(v, pd.Timestamp):
            return v.to_pydatetime()
        if isinstance(v, np.integer):
            return int(v)
        if isinstance(v, np.floating):
            return float(v)
        if isinstance(v, np.bool_):
            return bool(v)
        return v

    rows = [tuple(coerce(v) for v in rec) for rec in df.itertuples(index=False, name=None)]

    coldefs = ",\n  ".join(f'"{cols[i]}" {types[i]}' for i in range(len(cols)))
    collist = ",".join(f'"{x}"' for x in cols)
    placeholders = "(" + ",".join(["%s"] * len(cols)) + ")"

    with pgconn.connect() as c:
        c.execute(f"CREATE TABLE IF NOT EXISTS {TABLE} (\n  {coldefs}\n)")
        c.execute(f"TRUNCATE {TABLE}")   # refresh data, KHÔNG drop (view phụ thuộc không vỡ)
        for s, orig in origmap.items():
            o = orig.replace("'", "''")
            c.execute(f"COMMENT ON COLUMN {TABLE}.\"{s}\" IS '{o}'")
        with c.cursor() as cur:
            cur.executemany(f"INSERT INTO {TABLE} ({collist}) VALUES {placeholders}", rows)
        c.commit()
        got = c.execute(f"SELECT count(*) n FROM {TABLE}").fetchone()["n"]

    ok = (got == n)
    print(f"{'✓' if ok else '✘'} {TABLE}: nạp {got} dòng · file {n} dòng · {'KHỚP ✓' if ok else 'LỆCH ✗'}")
    print(f"  {len(cols)} cột. Mẫu: {cols[:10]}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
