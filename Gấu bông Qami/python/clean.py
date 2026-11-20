# -*- coding: utf-8 -*-
"""
03_ENGINE · PHẦN 1 — LÀM SẠCH  (chạy FILE NÀY TRƯỚC)

Việc của file này:
  1. Đọc + chuẩn hóa 4 nguồn raw (income, onhold, orders).
  2. Đẩy ra 1 file cost MỚI: cost/cost_list.xlsx (ĐÚNG 1 SHEET) gồm MỌI SKU đang
     xuất hiện — SKU mới (chưa có cost) tô vàng + đưa lên đầu + kèm cột "Gợi ý Cost".

Tham số (đường dẫn, từ khoá, nhóm phí) nằm ở python/config.py.
Chạy: python python/clean.py   → rồi mở cost/cost_list.xlsx nhập cột "Cost Original", lưu.
ZONE INDEX (từ hub): python tools/zones.py ../Dev/TIKTOK/QAMI
"""
import re
import unicodedata

import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import PatternFill, Font

from config import (ROOT, RAW, COST_FILE, OLD_MANUAL, CLEANED, WEB, DATA_JS, REPORT,
                    FILES, SHEETS, COST_GROUPS, FAMILY_KEYWORDS, SIZE_RULES, SIZE_CM)
# (re-export cho các file khác dùng clean.COST_GROUPS, clean.CLEANED, ... như cũ)


# ============================================================
# [ZONE 01 · Đọc & chuẩn hóa nguồn]            Status: LOCKED
# In : rawdata/*.xlsx (income, orders, onhold)
# Out: DataFrame đã ép kiểu ID về chuỗi (chưa biến đổi số liệu)
# ============================================================
def read_income():
    df = pd.read_excel(RAW / FILES["income"], sheet_name=SHEETS["income"])
    df["ID đơn hàng/điều chỉnh"] = df["ID đơn hàng/điều chỉnh"].astype(str)
    return df


def read_orders():
    df = pd.read_excel(RAW / FILES["orders"], sheet_name=SHEETS["orders"], skiprows=[1])
    # Phòng khi header ô A1 bị ghi đè nhầm: cột đầu của OrderSKUList luôn là Order ID.
    if "Order ID" not in df.columns:
        print(f"[cảnh báo] Không thấy cột 'Order ID'. Đổi cột đầu "
              f"('{str(df.columns[0])[:35]}...') -> 'Order ID'.")
        df = df.rename(columns={df.columns[0]: "Order ID"})
    df["Order ID"] = df["Order ID"].astype(str)
    df["SKU ID"] = df["SKU ID"].astype(str)
    return df


def read_onhold():
    df = pd.read_excel(RAW / FILES["onhold"], sheet_name=0, skiprows=4)
    df["ID đơn hàng/điều chỉnh"] = df["ID đơn hàng/điều chỉnh"].astype(str)
    df["ID SKU"] = df["ID SKU"].astype(str)
    return df
# ===================== [HẾT ZONE 01] ========================


# ============================================================
# [ZONE 02 · Engine gợi ý cost (dòng SP × size)]   Status: LOCKED
# In : bảng SKU (có Product Name / Variation / Seller SKU / Cost Original)
# Out: thêm cột "Gợi ý Cost" + "Ghi chú gợi ý"
# ============================================================
def _read_existing_costs():
    """Lấy cost đã có: ưu tiên file cost MỚI (giữ số bạn đã nhập); lần đầu seed từ Manual cũ."""
    if COST_FILE.exists():
        d = pd.read_excel(COST_FILE, sheet_name=0, dtype={"SKU ID": str})
    elif OLD_MANUAL.exists():
        d = pd.read_excel(OLD_MANUAL, sheet_name=SHEETS["cost_list"], dtype={"SKU ID": str})
    else:
        return pd.DataFrame(columns=["SKU ID", "Cost Original"])
    return d[["SKU ID", "Cost Original"]].dropna(subset=["SKU ID"]).drop_duplicates("SKU ID", keep="first")


def _strip(s):
    if not isinstance(s, str):
        return ""
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower().strip()


def _size(*texts):
    for t in texts:
        n = _strip(t)
        if not n:
            continue
        for pat, canon in SIZE_RULES:
            if re.search(pat, n):
                return canon
        for cm in SIZE_CM:
            if re.search(rf"(?<!\d){cm}\s*cm", n):
                return f"{cm}cm"
    return None


def _family(*texts):
    blob = " ".join(_strip(t) for t in texts)
    for fam, keys in FAMILY_KEYWORDS.items():
        if any(k in blob for k in keys):
            return fam
    return None


def add_suggestions(cost_df):
    """Thêm cột 'Gợi ý Cost' + 'Ghi chú gợi ý' (dựa trên các dòng đã có cost)."""
    df = cost_df.copy()
    seller = df["Seller SKU"] if "Seller SKU" in df.columns else ""
    df["_size"] = [_size(v, s, p) for v, s, p in
                   zip(df.get("Variation", ""), seller if isinstance(seller, pd.Series) else [""] * len(df), df.get("Product Name", ""))]
    df["_fam"] = [_family(s, p, v) for s, p, v in
                  zip(seller if isinstance(seller, pd.Series) else [""] * len(df), df.get("Product Name", ""), df.get("Variation", ""))]

    known = df[df["Cost Original"].notna()]

    def mode_cost(s):
        m = s.mode()
        return m.iloc[0] if len(m) else None

    ref_fam = known.dropna(subset=["_size", "_fam"]).groupby(["_fam", "_size"])["Cost Original"].agg(c=mode_cost, n="count")
    ref_size = known.dropna(subset=["_size"]).groupby("_size")["Cost Original"].agg(c=mode_cost, n="count")

    sugs, notes = [], []
    for _, r in df.iterrows():
        fam, size, cost = r["_fam"], r["_size"], r["Cost Original"]
        sug, n, basis = None, 0, ""
        if size is not None and fam is not None and (fam, size) in ref_fam.index:
            sug, n = ref_fam.loc[(fam, size), "c"], int(ref_fam.loc[(fam, size), "n"]); basis = f"{fam} × {size} ({n} SKU)"
        elif size is not None and size in ref_size.index:
            sug, n = ref_size.loc[size, "c"], int(ref_size.loc[size, "n"]); basis = f"size {size} ({n} SKU)"
        if sug is None:
            sugs.append(None); notes.append("Chưa đủ dữ liệu gợi ý"); continue
        if pd.isna(cost):
            notes.append(f"MỚI — gợi ý: {basis}")
        elif abs(float(cost) - float(sug)) < 1:
            notes.append(f"Khớp ({basis})")
        else:
            notes.append(f"⚠️ LỆCH: đang {int(cost):,} vs gợi ý {int(sug):,} — {basis}")
        sugs.append(sug)
    df["Gợi ý Cost"] = sugs
    df["Ghi chú gợi ý"] = notes
    return df.drop(columns=["_size", "_fam"])
# ===================== [HẾT ZONE 02] ========================


# ============================================================
# [ZONE 03 · Đẩy ra file cost mới]              Status: LOCKED
# In : orders, onhold (đã sạch)
# Out: cost/cost_list.xlsx (1 sheet, không sót SKU, tô vàng dòng cần nhập)
# ============================================================
def refresh_cost_file(orders, onhold):
    # Gom MỌI SKU từ orders + onhold (không sót)
    su_o = (orders[["SKU ID", "Seller SKU", "Product Name", "Variation"]]
            .drop_duplicates("SKU ID"))
    su_h = (onhold[["ID SKU", "Tên sản phẩm"]]
            .rename(columns={"ID SKU": "SKU ID", "Tên sản phẩm": "Product Name"})
            .drop_duplicates("SKU ID"))
    all_sku = pd.concat([su_o, su_h], ignore_index=True).drop_duplicates("SKU ID", keep="first")

    # Giữ cost đã nhập (không mất số bạn đã làm)
    existing = _read_existing_costs()
    all_sku = all_sku.merge(existing, on="SKU ID", how="left")

    # Gợi ý cost
    all_sku = add_suggestions(all_sku)

    # Sắp xếp: dòng CHƯA có cost lên đầu (để bạn nhập, khỏi sót)
    all_sku["_need"] = all_sku["Cost Original"].isna()
    all_sku = (all_sku.sort_values(["_need", "Product Name", "Variation"],
                                   ascending=[False, True, True])
               .drop(columns="_need").reset_index(drop=True))
    cols = ["SKU ID", "Seller SKU", "Product Name", "Variation",
            "Cost Original", "Gợi ý Cost", "Ghi chú gợi ý"]
    all_sku = all_sku[[c for c in cols if c in all_sku.columns]]

    COST_FILE.parent.mkdir(parents=True, exist_ok=True)
    all_sku.to_excel(COST_FILE, index=False, sheet_name="cost_list")

    # Tô vàng các dòng chưa có cost + in đậm header
    wb = load_workbook(COST_FILE)
    ws = wb["cost_list"]
    yellow = PatternFill("solid", fgColor="FFF3C7")
    for c in ws[1]:
        c.font = Font(bold=True)
    cost_idx = [i for i, cell in enumerate(ws[1], 1) if cell.value == "Cost Original"][0]
    for row in ws.iter_rows(min_row=2):
        if row[cost_idx - 1].value in (None, ""):
            for cell in row:
                cell.fill = yellow
    wb.save(COST_FILE)

    n_new = int(all_sku["Cost Original"].isna().sum())
    return len(all_sku), n_new
# ===================== [HẾT ZONE 03] ========================


def main():
    print("Làm sạch nguồn raw...")
    orders = read_orders()
    onhold = read_onhold()
    read_income()  # kiểm tra đọc được

    print("Đẩy ra file cost mới...")
    total, n_new = refresh_cost_file(orders, onhold)
    print(f"-> {COST_FILE}")
    print(f"   Tổng SKU: {total} | CẦN NHẬP COST (tô vàng, ở đầu file): {n_new}")
    print("   Mở file, nhập cột 'Cost Original' cho dòng vàng (tham chiếu 'Gợi ý Cost'), rồi lưu.")


if __name__ == "__main__":
    main()
