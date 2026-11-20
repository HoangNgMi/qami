# -*- coding: utf-8 -*-
"""migrate.py — tạo DB `qami` (nếu chưa có) + chạy schema.sql. IDEMPOTENT.
Fail-fast nếu _VAULT/qami.env chưa có PGPASSWORD (tránh nhầm/treo)."""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import pgconn  # noqa: E402


def main():
    p = pgconn.params()
    if not p.get("password"):
        print("✘ DỪNG: _VAULT/qami.env chưa có PGPASSWORD.")
        print("  → Điền creds PostgreSQL vào Documents/_VAULT/qami.env (xem db/.env.example) rồi chạy lại.")
        return 1

    dbname = p["dbname"]   # tên DB lấy từ PGDATABASE trong vault (nguồn sự thật — hiện: tiktokqami)
    # 1) Tạo database nếu chưa có (connect vào 'postgres', autocommit cho CREATE DATABASE)
    try:
        with pgconn.connect(dbname="postgres") as c:
            c.autocommit = True
            exists = c.execute("SELECT 1 FROM pg_database WHERE datname=%s", (dbname,)).fetchone()
            if exists:
                print(f"• database '{dbname}' đã tồn tại")
            else:
                c.execute(f'CREATE DATABASE "{dbname}"')
                print(f"✓ tạo database '{dbname}'")
    except Exception as e:
        msg = str(e).strip().splitlines()[0] if str(e).strip() else ""
        print(f"✘ Không kết nối/tạo được DB: {type(e).__name__}: {msg[:140]}")
        print("  → Kiểm PGPASSWORD trong Documents/_VAULT/qami.env (password PG thật).")
        return 1

    # 2) Chạy schema.sql trên DB qami (tạo khung schema)
    sql = (HERE / "schema.sql").read_text(encoding="utf-8")
    with pgconn.connect() as c:
        c.execute(sql)
        c.commit()
    print("✓ chạy schema.sql xong (khung Medallion + lăng kính)")

    # 3) Liệt kê schema đã tạo
    with pgconn.connect() as c:
        rows = c.execute(
            "SELECT schema_name FROM information_schema.schemata "
            "WHERE schema_name NOT LIKE 'pg_%' AND schema_name <> 'information_schema' ORDER BY 1"
        ).fetchall()
        print("  schema:", [r["schema_name"] for r in rows])
    return 0


if __name__ == "__main__":
    sys.exit(main())
