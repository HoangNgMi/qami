# -*- coding: utf-8 -*-
"""
PHẦN 3 — PHÂN TÍCH (dữ liệu cho web)

Chỉ sinh ra 1 file: web/data.js  (window.QAMI_DATA = {...} + ngày cập nhật).
Giao diện nằm ở các file NGUỒN tách riêng — bạn sửa thoải mái, pipeline KHÔNG đụng:
  web/index.html   — bố cục trang (HOME + KHÁCH HÀNG)
  web/styles.css   — màu sắc / layout
  web/app.js       — logic chart (object T = màu; các hàm r* = từng chart)

Deploy Vercel: trỏ thẳng thư mục web/.
Cài thư viện (1 lần): python -m pip install -r requirements.txt
"""
import json
import sys
from datetime import date
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import clean  # noqa: E402


# ============================================================
# [ZONE 01 · Đóng gói số liệu theo cột]        Status: LOCKED
# In : cleaned/02_income_py.xlsx
# Out: dict (channels/settles/products + mảng rev/cogs/plat/koc/ads theo cột) để nhúng web
# ============================================================
def build_payload(df):
    df = df.copy()
    dt = pd.to_datetime(df["Thời gian tạo đơn hàng"], errors="coerce")
    df["_date"] = dt.dt.strftime("%Y-%m-%d").fillna("")
    df["_ch"] = df.get("Order_Channel", pd.Series(index=df.index)).fillna("Khác").astype(str)
    df["_set"] = df.get("Trạng thái quyết toán", pd.Series(index=df.index)).fillna("Khác").astype(str)
    df["_prod"] = df.get("Product_Names", pd.Series(index=df.index)).fillna("Không rõ").astype(str).str.slice(0, 70)

    rev = df["Tổng doanh thu"].fillna(0)
    cogs = (-df["Cost_COGS"]).fillna(0)
    plat = (-df["Cost_Platform"]).fillna(0)
    koc = (-df["Cost_KOC"]).fillna(0)
    ads = (-df["Cost_Ads"]).fillna(0)

    channels = sorted(df["_ch"].unique().tolist())
    settles = sorted(df["_set"].unique().tolist())
    products = sorted(df["_prod"].unique().tolist())
    ci = {v: i for i, v in enumerate(channels)}
    si = {v: i for i, v in enumerate(settles)}
    pi = {v: i for i, v in enumerate(products)}

    def ints(s):
        return [int(round(x)) for x in s]

    return {
        "channels": channels, "settles": settles, "products": products,
        "date": df["_date"].tolist(),
        "ch": [ci[v] for v in df["_ch"]], "set": [si[v] for v in df["_set"]],
        "prod": [pi[v] for v in df["_prod"]],
        "rev": ints(rev), "cogs": ints(cogs), "plat": ints(plat), "koc": ints(koc), "ads": ints(ads),
    }


# ============================================================
# [ZONE 02 · Ghi web/data.js]                  Status: LOCKED
# In : payload (ZONE 01) + ngày cập nhật
# Out: web/data.js (window.QAMI_DATA + QAMI_META) — KHÔNG đụng UI
# ============================================================
def build_report(cleaned_path=None, out_js=None):
    cleaned_path = cleaned_path or clean.CLEANED
    out_js = out_js or clean.DATA_JS
    payload = build_payload(pd.read_excel(cleaned_path))
    data = json.dumps(payload, ensure_ascii=False).replace("</", "<\\/")
    js = (f"window.QAMI_DATA = {data};\n"
          f'window.QAMI_META = {{"date": "{date.today():%d/%m/%Y}"}};\n')
    Path(out_js).parent.mkdir(parents=True, exist_ok=True)
    Path(out_js).write_text(js, encoding="utf-8")
    return out_js


def main():
    print("->", build_report())


if __name__ == "__main__":
    main()
