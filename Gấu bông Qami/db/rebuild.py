# -*- coding: utf-8 -*-
"""rebuild.py — DỰNG LẠI toàn bộ DB tiktokqami theo đúng thứ tự (idempotent, 1 lệnh).
Chạy: python db/rebuild.py   (sau khi pipeline file đã sinh cleaned/ + rawdata video có sẵn)
Non-destructive với file nguồn; chỉ dựng lại DB (bronze/silver/semantic)."""
import sys
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import pgconn  # noqa: E402

PY = sys.executable

STEPS = [
    ("py",  "migrate.py"),            # DB + khung schema
    ("py",  "load_bronze.py"),        # bronze.orders_central
    ("sql", "silver.sql"),            # silver.fact_order
    ("sql", "m1_profit.sql"),         # m1_profit.*
    ("sql", "billing.sql"),           # billing_config + vw_billing
    ("py",  "seed_billing.py"),       # nạp config billing
    ("py",  "load_bronze_video.py"),  # bronze.video
    ("sql", "silver_video.sql"),      # silver.video
    ("sql", "m2_koc.sql"),            # m2_koc.*
]


def run_py(name):
    print(f"\n▶ py  {name}")
    if subprocess.run([PY, str(HERE / name)]).returncode:
        raise SystemExit(f"✘ {name} FAIL")


def run_sql(name):
    print(f"▶ sql {name}")
    with pgconn.connect() as c:
        c.execute((HERE / name).read_text(encoding="utf-8"))
        c.commit()


def main():
    for kind, name in STEPS:
        (run_py if kind == "py" else run_sql)(name)
    print("\n✓ REBUILD xong — bronze→silver→(m1_profit · m2_koc)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
