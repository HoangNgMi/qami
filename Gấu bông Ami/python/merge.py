# -*- coding: utf-8 -*-
"""
03_ENGINE · PHẦN 2 — RÁP NỐI + ĐỐI SOÁT

Ghép 4 nguồn đã sạch thành 1 BẢNG TẬP TRUNG cấp đơn hàng (cleaned/02_income_py.xlsx):
gộp Đã/Chưa quyết toán → gắn COGS → gom phí 4 nhóm → chỉ số → loại đơn → đối soát.

Tham số ở python/config.py. Logic giữ nguyên bản đã nghiệm thu.
Mỗi khối bọc trong [ZONE] có Status (LOCKED = cấm sửa nếu không có lệnh | DRAFT = đang chuẩn chỉnh).
ZONE INDEX (từ hub): python tools/zones.py ../Dev/TIKTOK/QAMI
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import clean  # noqa: E402  (hằng số config + hàm đọc nguồn)


# ============================================================
# [ZONE 01 · Đọc cost đã nhập]                 Status: LOCKED
# In : cost/cost_list.xlsx (hoặc Manual cũ nếu chưa có)
# Out: bảng SKU ID -> Cost Original (dedup)
# ============================================================
def read_cost():
    """Đọc cost bạn đã nhập (file mới). Chưa có file thì seed từ Manual cũ."""
    if clean.COST_FILE.exists():
        d = pd.read_excel(clean.COST_FILE, sheet_name=0, dtype={"SKU ID": str})
    else:
        d = pd.read_excel(clean.OLD_MANUAL, sheet_name=clean.SHEETS["cost_list"], dtype={"SKU ID": str})
    return d[["SKU ID", "Cost Original"]].drop_duplicates("SKU ID", keep="first").reset_index(drop=True)


# ============================================================
# [ZONE 02 · Gắn COGS vào từng dòng SKU]       Status: LOCKED
# In : orders (SKU-level) + cost
# Out: orders + Total Cost (= Cost Original × Quantity)
# ============================================================
def attach_cogs_to_orders(orders, cost):
    orders = orders.merge(cost, on="SKU ID", how="left")
    orders["Total Cost"] = orders["Cost Original"] * orders["Quantity"]
    return orders


# ============================================================
# [ZONE 03 · Onhold → cấp đơn]                 Status: LOCKED
# In : onhold thô (SKU-level) + cost
# Out: onhold gộp cấp đơn + cờ "Chưa quyết toán", rename cột khớp income
# ============================================================
def process_onhold(onhold_raw, cost):
    onhold_raw = onhold_raw.merge(cost.rename(columns={"SKU ID": "ID SKU"}), on="ID SKU", how="left")
    onhold_raw["Total Cost"] = onhold_raw["Cost Original"] * onhold_raw["Số lượng"]

    def concat_bracket(x):
        return " | ".join(f"[{v}]" for v in x.dropna().astype(str).unique())

    agg = {}
    for col in onhold_raw.columns:
        if col == "ID đơn hàng/điều chỉnh":
            continue
        if col in ["Tên sản phẩm", "Tên SKU", "ID SKU"]:
            agg[col] = concat_bracket
        elif pd.api.types.is_numeric_dtype(onhold_raw[col]):
            agg[col] = "sum"
        else:
            agg[col] = "first"
    onhold_agg = onhold_raw.groupby("ID đơn hàng/điều chỉnh", as_index=False).agg(agg)
    onhold_agg["Num_SKUs"] = onhold_raw.groupby("ID đơn hàng/điều chỉnh").size().values

    onhold_agg = onhold_agg.rename(columns={
        "Ngày tạo giao dịch": "Thời gian tạo đơn hàng",
        "Thời gian quyết toán dự kiến": "Thời gian quyết toán đơn hàng",
        "Số tiền quyết toán ước tính": "Tổng số tiền quyết toán",
        "Phí giao dịch ước tính": "Phí giao dịch",
        "Phí vận chuyển ước tính của người bán": "Phí vận chuyển của người bán",
        "Hoa hồng liên kết ước tính": "Hoa hồng liên kết",
        "Tên sản phẩm": "Products_List", "Tên SKU": "SKUs_List", "ID SKU": "SKU_IDs_List",
    })
    onhold_agg["Trạng thái quyết toán"] = "Chưa quyết toán"
    return onhold_agg


# ============================================================
# [ZONE 04 · Gộp đơn trùng (bán + hoàn)]       Status: LOCKED
# In : income thô (1 Order ID có thể nhiều dòng)
# Out: 1 dòng/đơn — số CỘNG DỒN (bán+hoàn triệt tiêu), chữ giữ dòng đầu
# ============================================================
def aggregate_settled(income):
    """Cùng 1 Order ID có nhiều dòng quyết toán -> CỘNG DỒN (số cộng, chữ giữ dòng đầu).
    Lý do: TikTok ghi bán (+) và hoàn/điều chỉnh (−) thành dòng riêng; cộng dồn thì
    bán-rồi-hoàn triệt tiêu về net đúng (doanh thu 0, phí giữ lại). Giữ-latest sẽ ra
    doanh thu âm ảo. Đơn 1 dòng thì không đổi."""
    income = income.copy()
    income["ID đơn hàng/điều chỉnh"] = income["ID đơn hàng/điều chỉnh"].astype(str)
    agg = {}
    for col in income.columns:
        if col == "ID đơn hàng/điều chỉnh":
            continue
        agg[col] = "sum" if pd.api.types.is_numeric_dtype(income[col]) else "first"
    n0 = len(income)
    income = income.groupby("ID đơn hàng/điều chỉnh", as_index=False).agg(agg)
    if n0 != len(income):
        print(f"[gộp] cộng dồn dòng trùng Order ID: {n0} -> {len(income)} (bán + hoàn triệt tiêu)")
    return income


# ============================================================
# [ZONE 05 · Nối Đã/Chưa + COGS cấp đơn]       Status: LOCKED
# In : income (đã gộp) + onhold_agg + orders (có Total Cost)
# Out: 1 bảng gộp + cột Cost_COGS mỗi đơn
# ============================================================
def merge_settled_onhold(income, onhold_agg):
    income = income.copy()
    income["ID đơn hàng/điều chỉnh"] = income["ID đơn hàng/điều chỉnh"].astype(str)
    income["Trạng thái quyết toán"] = "Đã quyết toán"
    return pd.concat([income, onhold_agg], ignore_index=True, sort=False)


def attach_cogs(income, orders):
    cogs = orders.groupby("Order ID", as_index=False)["Total Cost"].sum()
    cogs.columns = ["Order ID", "Cost_COGS"]
    return income.merge(cogs, left_on="ID đơn hàng/điều chỉnh", right_on="Order ID", how="left")


# ============================================================
# [ZONE 06 · Gom phí 4 nhóm]                   Status: LOCKED (config-driven)
# In : income (cột phí lẻ) + config.COST_GROUPS
# Out: income + Cost_Platform / Cost_KOC / Cost_Ads (bỏ cột phí lẻ)
# ============================================================
def group_costs(income):
    p = [c for c in clean.COST_GROUPS["platform"] if c in income.columns]
    k = [c for c in clean.COST_GROUPS["koc"] if c in income.columns]
    a = [c for c in clean.COST_GROUPS["ads"] if c in income.columns]
    income["Cost_Platform"] = income[p].fillna(0).sum(axis=1)
    income["Cost_KOC"] = income[k].fillna(0).sum(axis=1)
    income["Cost_Ads"] = income[a].fillna(0).sum(axis=1)
    return income.drop(columns=p + k + a)


# ============================================================
# [ZONE 07 · Chọn cột lõi + làm giàu đơn]      Status: LOCKED
# In : income + orders
# Out: income gọn cột + kênh/SP/trạng thái đơn
# ============================================================
def select_core_columns(income):
    income = income[["ID đơn hàng/điều chỉnh", "Loại giao dịch", "Thời gian tạo đơn hàng",
                     "Thời gian quyết toán đơn hàng", "Tổng số tiền quyết toán", "Tổng doanh thu",
                     "Tổng phí", "Order ID", "Cost_COGS", "Cost_Platform", "Cost_KOC", "Cost_Ads",
                     "Trạng thái quyết toán"]].copy()
    income["ID đơn hàng/điều chỉnh"] = income["ID đơn hàng/điều chỉnh"].astype(str)
    return income


def enrich_order_info(income, orders):
    info = orders.groupby("Order ID").agg(
        Order_Channel=("Order Channel", "first"),
        Product_Names=("Product Name", lambda x: " | ".join(x.dropna().unique())),
        Variations=("Variation", lambda x: " | ".join(f"[{v}]" for v in x.dropna().unique())),
        Total_Quantity=("Quantity", "sum"),
        Num_SKUs=("SKU ID", "nunique"),
        Order_Status=("Order Status", "first"),
        Order_Substatus=("Order Substatus", "first"),
        Cancel_Return_Type=("Cancelation/Return Type", "first"),
    ).reset_index()
    income = income.merge(info, left_on="ID đơn hàng/điều chỉnh", right_on="Order ID", how="left")
    if "Order ID_y" in income.columns:
        income = income.drop(columns=["Order ID_y"])
    return income


# ============================================================
# [ZONE 08 · Chỉ số phái sinh / ROI]           Status: DRAFT (đang chuẩn chỉnh - review ROI)
# In : income (doanh thu + 4 nhóm chi phí)
# Out: Abs_*, All_Cost, Net_Margin, các ROI, cost-mix %, cờ
# ============================================================
def add_derived_metrics(income):
    income["Abs_COGS"] = -income["Cost_COGS"]
    income["Abs_Platform"] = -income["Cost_Platform"]
    income["Abs_KOC"] = -income["Cost_KOC"]
    income["Abs_Ads"] = -income["Cost_Ads"]
    income["All_Cost"] = income[["Abs_COGS", "Abs_Platform", "Abs_KOC", "Abs_Ads"]].sum(axis=1)
    income["Net_Margin"] = income["Tổng doanh thu"] - income["All_Cost"]
    income["Net_Margin_Pct"] = (income["Net_Margin"] / income["Tổng doanh thu"]).round(3)
    income["Gross_ROI"] = (income["Tổng doanh thu"] / income["Abs_COGS"]).where(income["Abs_COGS"] > 0).round(2)
    income["ROAS"] = (income["Tổng doanh thu"] / income["Abs_Ads"]).where(income["Abs_Ads"] > 0).round(2)
    income["Marketing_Spend"] = income["Abs_Ads"] + income["Abs_KOC"]
    income["Marketing_ROI"] = (income["Tổng doanh thu"] / income["Marketing_Spend"]).where(income["Marketing_Spend"] > 0).round(2)
    income["Net_ROI"] = (income["Tổng doanh thu"] / income["All_Cost"]).where(income["All_Cost"] > 0).round(2)
    income["Has_Ads"] = income["Abs_Ads"] > 0
    income["Has_KOC"] = income["Abs_KOC"] > 0
    income["Is_Profitable"] = income["Net_Margin"] > 0
    income["Is_Cancelled"] = (income["Tổng phí"] != 0) & (income["Tổng doanh thu"] == 0)
    for col, abscol in [("COGS_Pct", "Abs_COGS"), ("Platform_Pct", "Abs_Platform"),
                        ("KOC_Pct", "Abs_KOC"), ("Ads_Pct", "Abs_Ads")]:
        income[col] = (income[abscol] / income["Tổng doanh thu"]).where(income["Tổng doanh thu"] > 0).round(3)
    for col in ["Net_Margin_Pct", "Gross_ROI", "ROAS", "Marketing_ROI", "Net_ROI",
                "COGS_Pct", "Platform_Pct", "KOC_Pct", "Ads_Pct"]:
        income[col] = income[col].replace([np.inf, -np.inf], np.nan)
    return income


# ============================================================
# [ZONE 09 · Phân loại đơn + hậu kỳ]           Status: LOCKED
# In : income (Order_Status, Cancel_Return_Type...)
# Out: cột "Loại đơn"; bỏ dòng GMV ads; zero COGS đơn hủy trước ship
# ============================================================
def classify_order_type(income):
    cond = [
        income["Cancel_Return_Type"] == "Return/Refund",
        (income["Order_Status"] == "Đã hủy") & (income["Cancel_Return_Type"] == "Cancel"),
        income["Order_Status"] == "Cần vận chuyển",
        income["Order_Status"] == "Đã hoàn tất",
        (income["Order_Status"] == "Đã vận chuyển") & (income["Order_Substatus"] == "Đã giao"),
        income["Order_Status"] == "Đã vận chuyển",
    ]
    choices = ["Trả hàng sau giao", "Hủy trước ship", "Chờ ship", "Hoàn tất",
               "Đã giao thành công", "Đang giao"]
    income["Loại đơn"] = np.select(cond, choices, default="Chưa phân loại")
    return income


def post_process(income):
    income["Loại đơn"] = income["Loại đơn"].replace("Hoàn tất", "Đã giao thành công")
    income = income[income["Loại giao dịch"] != "GMV thanh toán cho Quảng cáo TikTok"].reset_index(drop=True)
    income.loc[(income["Tổng phí"] <= 0) & (income["Tổng doanh thu"] == 0), "Cost_COGS"] = 0
    return income


# ============================================================
# [ZONE 10 · Đối soát phí]                     Status: DRAFT (review #1 - phí ngoài 4 nhóm)
# In : bảng tập trung (đơn đã quyết toán)
# Out: in cảnh báo số đơn có phí lệch > tol; trả bảng đơn lệch
# ============================================================
def reconcile_fees(income, tol=1.0):
    s = income[income["Trạng thái quyết toán"] == "Đã quyết toán"].copy()
    grouped = s[["Cost_Platform", "Cost_KOC", "Cost_Ads"]].fillna(0).sum(axis=1)
    bad = s[(grouped - s["Tổng phí"].fillna(0)).abs() > tol]
    print(f"[đối soát] {len(bad)}/{len(s)} đơn đã quyết toán có phí lệch > {tol} (4-nhóm vs 'Tổng phí').")
    return bad


# -------- Orchestrator: chạy ZONE 04→09 theo thứ tự --------
def build_central_table(income, onhold_raw, orders, cost):
    income = aggregate_settled(income)
    orders = attach_cogs_to_orders(orders, cost)
    onhold_agg = process_onhold(onhold_raw, cost)
    income = merge_settled_onhold(income, onhold_agg)
    income = attach_cogs(income, orders)
    income = group_costs(income)
    income = select_core_columns(income)
    income = enrich_order_info(income, orders)
    income = add_derived_metrics(income)
    income = classify_order_type(income)
    income = post_process(income)
    return income


def main():
    income = clean.read_income()
    orders = clean.read_orders()
    onhold = clean.read_onhold()
    cost = read_cost()
    df = build_central_table(income, onhold, orders, cost)
    reconcile_fees(df)
    clean.CLEANED.parent.mkdir(parents=True, exist_ok=True)
    df.to_excel(clean.CLEANED, index=False)
    print(f"-> {clean.CLEANED}  ({len(df)} đơn, {df.shape[1]} cột)")


if __name__ == "__main__":
    main()
