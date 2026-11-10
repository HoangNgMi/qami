# -*- coding: utf-8 -*-
"""
CHẠY TỔNG QUY TRÌNH  (chạy sau khi đã nhập cost vào cost/cost_list.xlsx)

Cài thư viện (1 lần): python -m pip install -r requirements.txt
    python python/run_all.py

Làm sạch -> ráp nối + đối soát -> phân tích -> cập nhật reports/report.html.
KHÔNG đụng file cost (không ghi đè số bạn đã nhập). Muốn làm mới danh sách SKU
(khi có hàng mới) thì chạy riêng: python python/clean.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import clean          # noqa: E402
import merge          # noqa: E402
import analyze        # noqa: E402


def main():
    print("1/3  Làm sạch nguồn...")
    income = clean.read_income()
    orders = clean.read_orders()
    onhold = clean.read_onhold()
    cost = merge.read_cost()

    print("2/3  Ráp nối + đối soát...")
    df = merge.build_central_table(income, onhold, orders, cost)
    merge.reconcile_fees(df)
    clean.CLEANED.parent.mkdir(parents=True, exist_ok=True)
    df.to_excel(clean.CLEANED, index=False)
    print(f"     cleaned -> {clean.CLEANED}  ({len(df)} đơn, {df.shape[1]} cột)")

    print("3/3  Cập nhật dữ liệu web...")
    analyze.build_report()
    print(f"     data    -> {clean.DATA_JS}")
    print(f"     mở web  -> {clean.REPORT}")
    print("DONE.")


if __name__ == "__main__":
    main()
