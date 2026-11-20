# -*- coding: utf-8 -*-
"""seed_billing.py — nạp cấu hình billing từ db/case_config.py -> bảng m1_profit.billing_config (upsert)."""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import pgconn          # noqa: E402
import case_config     # noqa: E402


def main():
    cc = case_config.CASE
    b = cc["billing"]
    with pgconn.connect() as c:
        c.execute(
            """INSERT INTO m1_profit.billing_config
               (slug, name, flow, hard_fee_vnd, threshold_vnd, pct_over, pct_profit, period_label, updated_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s, now())
               ON CONFLICT (slug) DO UPDATE SET
                 name=excluded.name, flow=excluded.flow, hard_fee_vnd=excluded.hard_fee_vnd,
                 threshold_vnd=excluded.threshold_vnd, pct_over=excluded.pct_over,
                 pct_profit=excluded.pct_profit, period_label=excluded.period_label, updated_at=now()""",
            (cc["slug"], cc["name"], b["flow"], b["hard_fee_vnd"], b["threshold_vnd"],
             b["pct_over"], b["pct_profit"], b["period_label"]),
        )
        c.commit()
    print(f"✓ seed billing_config: {cc['name']} · flow {b['flow']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
