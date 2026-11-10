# -*- coding: utf-8 -*-
"""
CHECK — soi nhanh logic + bất thường của bảng tập trung, ĐỐI CHIẾU với raw.

Chạy sau khi đã chạy run_all:
    python python/check.py
In ra các dòng kết quả để bạn kiểm nhanh. KHÔNG sửa dữ liệu gì.
Cài thư viện (1 lần): python -m pip install -r requirements.txt
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import clean  # noqa: E402

# ============================================================
# [ZONE QA · Đối chiếu raw ↔ output + bắt bất thường]   Status: LOCKED
# In : rawdata + cleaned/02_income_py.xlsx + cost/cost_list.xlsx
# Out: in bảng đối chiếu (số đơn, doanh thu, ID trùng, đơn lỗ, đối soát phí)
# Tự chạy: python python/check.py   (không gọi AI)
# ============================================================
def flag(cond): return "✔ khớp" if cond else "✘ LỆCH"


def main():
    df = pd.read_excel(clean.CLEANED)
    inc = clean.read_income()        # raw income (Chi tiết đơn hàng)
    onh = clean.read_onhold()        # raw onhold
    cost = pd.read_excel(clean.COST_FILE)

    rev = df["Tổng doanh thu"].fillna(0)
    for c in ["COGS", "Platform", "KOC", "Ads"]:
        df["Abs_" + c] = -df["Cost_" + c]
    allcost = df[["Abs_COGS", "Abs_Platform", "Abs_KOC", "Abs_Ads"]].sum(axis=1)
    nm = rev - allcost
    settled = df[df["Trạng thái quyết toán"] == "Đã quyết toán"]
    onhold = df[df["Trạng thái quyết toán"] == "Chưa quyết toán"]

    print("== ĐỐI CHIẾU RAW -> OUTPUT ==")
    gmv = int((inc["Loại giao dịch"] == "GMV thanh toán cho Quảng cáo TikTok").sum())
    inc_uniq = inc.loc[inc["Loại giao dịch"] != "GMV thanh toán cho Quảng cáo TikTok",
                       "ID đơn hàng/điều chỉnh"].astype(str).nunique()
    print(f"income raw: {len(inc)} dòng | bỏ GMV {gmv} | đơn UNIQUE {inc_uniq}  vs  cleaned 'Đã quyết toán': {len(settled)}   {flag(inc_uniq == len(settled))}")
    onh_orders = onh["ID đơn hàng/điều chỉnh"].nunique()
    print(f"onhold raw: {onh_orders} đơn (unique)  vs  cleaned 'Chưa quyết toán': {len(onhold)}   {flag(onh_orders == len(onhold))}")
    ng = inc[inc["Loại giao dịch"] != "GMV thanh toán cho Quảng cáo TikTok"]
    rev_all = ng["Tổng doanh thu"].fillna(0).sum()   # cộng dồn giữ nguyên tổng
    cl = settled["Tổng doanh thu"].sum()
    print(f"Doanh thu: raw (cộng dồn) {rev_all:,.0f}  vs  cleaned settled {cl:,.0f}   {flag(abs(rev_all - cl) < 1)}")

    print("\n== TỔNG QUAN OUTPUT ==")
    print(f"Đơn: {len(df)} | Cột: {df.shape[1]}")
    print(f"Doanh thu   : {rev.sum():>16,.0f}")
    print(f"Tổng chi phí: {allcost.sum():>16,.0f}")
    print(f"Net margin  : {nm.sum():>16,.0f}  ({nm.sum()/rev.sum()*100:.1f}%)")

    print("\n== COGS ==")
    print(f"SKU trong cost_list chưa nhập cost : {int(cost['Cost Original'].isna().sum())}/{len(cost)}")
    miss = df[(rev > 0) & (df["Cost_COGS"].fillna(0) == 0)]
    print(f"Đơn có doanh thu nhưng COGS=0      : {len(miss)}  (doanh thu nhóm này {rev[miss.index].sum():,.0f})")

    print("\n== ID TRÙNG (double-count?) ==")
    dmask = df["ID đơn hàng/điều chỉnh"].duplicated(keep=False)
    d = df[dmask]
    n_id = d["ID đơn hàng/điều chỉnh"].nunique()
    # ID trùng mà có >1 dòng doanh thu>0 -> nghi double-count thật
    g = d.groupby("ID đơn hàng/điều chỉnh")["Tổng doanh thu"].apply(lambda s: (s.fillna(0) > 0).sum())
    risk = g[g > 1]
    print(f"ID trùng: {n_id} (tổng {len(d)} dòng)  — phần lớn là đơn hủy nhiều dòng phí (doanh thu=0)")
    print(f"ID trùng có >1 dòng doanh thu>0 (NGHI double-count): {len(risk)}")

    print("\n== BẤT THƯỜNG ==")
    print(f"Doanh thu âm (điều chỉnh/hoàn): {int((rev < 0).sum())}")
    print(f"COGS dương (sai dấu)          : {int((df['Cost_COGS'] > 0).sum())}")
    print(f"Đơn LỖ (net margin < 0)       : {int((nm < 0).sum())}  ({(nm < 0).mean()*100:.1f}%)")
    print(f"Đơn lỗ nặng (< -100% doanh thu): {int((nm < -rev).sum())}")
    gr = (rev / df["Abs_COGS"]).replace([np.inf, -np.inf], np.nan)
    print(f"Gross ROI > 10 (COGS quá thấp?): {int((gr > 10).sum())}  | max {gr.max():.1f}")

    print("\n== ĐỐI SOÁT PHÍ (đã quyết toán) ==")
    diff = (settled[["Cost_Platform", "Cost_KOC", "Cost_Ads"]].sum(axis=1) - settled["Tổng phí"].fillna(0)).abs()
    print(f"Đơn phí lệch >1 (4-nhóm vs Tổng phí): {int((diff > 1).sum())}/{len(settled)}  | lệch trung vị {diff.median():,.0f}")
    print("  (lệch >0 nghĩa còn loại phí ngoài 4 nhóm -> xem COST_GROUPS trong clean.py)")

    print("\n== PHÂN BỐ ==")
    print(df["Trạng thái quyết toán"].value_counts().to_string())
    print("-")
    print(df["Loại đơn"].value_counts().to_string())


if __name__ == "__main__":
    main()
