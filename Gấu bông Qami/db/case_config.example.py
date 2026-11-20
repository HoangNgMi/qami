# -*- coding: utf-8 -*-
"""case_config.example.py — MẪU cấu hình case (billing hợp đồng).
Copy -> case_config.py (đã gitignore) và điền SỐ THẬT ở máy local, rồi: python db/seed_billing.py
flow: 1 = phí cứng + % vượt ngưỡng · 2 = % lợi nhuận · 3 = hỗn hợp (cộng gộp)."""
CASE = {
    "slug": "qami",
    "name": "<Tên case>",
    "billing": {
        "flow": 1,
        "hard_fee_vnd": 0,        # phí cứng/tháng (điền số thật, vd 10000000)
        "threshold_vnd": 0,       # ngưỡng lợi nhuận bắt đầu ăn % (flow 1/3)
        "pct_over": 0.0,          # % phần vượt ngưỡng (flow 1/3)
        "pct_profit": 0.0,        # % trên tổng lợi nhuận (flow 2/3)
        "period_label": "retainer/tháng",
    },
}
