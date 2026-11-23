# -*- coding: utf-8 -*-
"""03_ENGINE (ads) — phân tích chiến dịch ads từ "Product campaign data.xlsx".
NGOÀI pipeline COGS (nguồn riêng, KHÔNG đụng clean/merge/run_all). Thiếu file -> trả None.
Spend = "Chi phí" (GỘP, Chủ chọn). Hoàn/hủy tách riêng. Net-ROI = ads GMV × biên đóng góp (COGS, trừ Ads).
"""
import sys, json
from datetime import date
from pathlib import Path
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config  # noqa: E402

CAMP_FILE = "Product campaign data.xlsx"; CAMP_SHEET = "Data"
C = {  # tên code -> cột thật
    "camp": "Tên chiến dịch", "date": "Theo ngày", "spend": "Chi phí",
    "gmv": "Doanh thu gộp", "orders": "Số lượng đơn hàng SKU",
    "refund": "Hoàn tiền", "ad_refund": "Chi phí quảng cáo được hoàn lại", "budget": "Ngân sách hiện tại",
}

def _num(s): return pd.to_numeric(s, errors="coerce").fillna(0)

def _hour_demand():
    """Demand theo GIỜ từ orders 'Created Time' (ad export chỉ có ngày; giờ lấy ở đây)."""
    f = config.RAW / "Tất cả đơn hàng.xlsx"
    if not f.exists():
        return None
    try:
        o = pd.read_excel(f, sheet_name="OrderSKUList", skiprows=[1])
    except Exception:
        return None
    if "Created Time" not in o.columns:
        return None
    o["_t"] = pd.to_datetime(o["Created Time"], errors="coerce", dayfirst=True)
    o = o.dropna(subset=["_t"])
    if not len(o):
        return None
    o["_h"] = o["_t"].dt.hour
    revc = next((c for c in ("SKU Subtotal After Discount", "SKU Subtotal Before Discount") if c in o.columns), None)
    oid = "Order ID" if "Order ID" in o.columns else o.columns[0]
    out = []
    for h in range(24):
        s = o[o["_h"] == h]
        out.append({"hour": h, "orders": int(s[oid].nunique()),
                    "units": int(_num(s["Quantity"]).sum()) if "Quantity" in o.columns else None,
                    "rev": round(_num(s[revc]).sum()) if revc else None})
    return out

def _contribution_margin():
    """Biên đóng góp blended = (DT - COGS - Platform - KOC) / DT, TRỪ Ads (vì ads là cái đang đánh giá)."""
    f = config.CLEANED
    if not Path(f).exists(): return None
    d = pd.read_excel(f)
    rev = _num(d["Tổng doanh thu"]).sum()
    if rev <= 0: return None
    cost = sum(_num(d[c]).abs().sum() for c in ("Cost_COGS", "Cost_Platform", "Cost_KOC") if c in d.columns)
    return round((rev - cost) / rev, 4)

def build_payload():
    f = config.RAW / CAMP_FILE
    if not f.exists():
        print(f"[ads] không thấy {CAMP_FILE} -> bỏ qua tab Ads"); return None
    df = pd.read_excel(f, sheet_name=CAMP_SHEET)
    df["_c"] = df[C["camp"]].astype(str).str.strip()
    df["_d"] = pd.to_datetime(df[C["date"]], errors="coerce").dt.strftime("%Y-%m-%d")
    for k in ("spend", "gmv", "orders"):
        df["_" + k] = _num(df[C[k]])
    df["_refund"] = _num(df.get(C["refund"], 0)) + _num(df.get(C["ad_refund"], 0))
    df = df[df["_d"].notna()]
    dmax = df["_d"].max()
    cm = _contribution_margin()   # biên đóng góp (có thể None)

    def roas(g, s): return round(g / s, 2) if s else None
    def per(x, n): return round(x / n) if n else None

    # ----- per campaign (tổng) -----
    camps = []
    for c, g in df.groupby("_c"):
        sp, gm, od, rf = g["_spend"].sum(), g["_gmv"].sum(), g["_orders"].sum(), g["_refund"].sum()
        net = round(gm * cm - sp) if cm is not None else None    # lãi ròng ads (xấp xỉ biên blended)
        act = g[g["_spend"] > 0]["_d"]                           # ngày THỰC có chi (khung chạy)
        start, end = (act.min(), act.max()) if len(act) else (g["_d"].min(), g["_d"].max())
        camps.append({"name": c, "spend": round(sp), "gmv": round(gm), "orders": int(od),
                      "roas": roas(gm, sp), "cpa": per(sp, od), "aov": per(gm, od),
                      "refund": round(rf), "net": net,
                      "net_roi": (round(net / sp, 2) if (net is not None and sp) else None),
                      "start": start, "end": end, "days": int(act.nunique()),
                      "active": bool(end == dmax)})
    camps.sort(key=lambda x: -x["spend"])

    # ----- rows campaign×ngày (cho web tự LỌC theo thời gian + campaign) -----
    name2i = {c["name"]: i for i, c in enumerate(camps)}
    g2 = df.groupby(["_c", "_d"], as_index=False).agg(
        s=("_spend", "sum"), g=("_gmv", "sum"), o=("_orders", "sum"), r=("_refund", "sum"))
    rows = [{"ci": name2i[row["_c"]], "d": row["_d"],
             "s": round(row["s"]), "g": round(row["g"]), "o": int(row["o"]), "r": round(row["r"])}
            for _, row in g2.iterrows() if row["_c"] in name2i]

    # ----- daily tổng (trend) -----
    daily = []
    for d, g in df.groupby("_d"):
        sp, gm, od = g["_spend"].sum(), g["_gmv"].sum(), g["_orders"].sum()
        daily.append({"date": d, "spend": round(sp), "gmv": round(gm), "orders": int(od), "roas": roas(gm, sp)})
    daily.sort(key=lambda x: x["date"])

    # ----- decline: 28 ngày cuối vs 28 ngày trước đó, mỗi campaign -----
    dd = pd.to_datetime(df["_d"])
    last = dd.max()
    recent = df[dd > last - pd.Timedelta(days=28)]
    prior = df[(dd <= last - pd.Timedelta(days=28)) & (dd > last - pd.Timedelta(days=56))]
    def blk(x):
        sp, gm, od = x["_spend"].sum(), x["_gmv"].sum(), x["_orders"].sum()
        return {"spend": round(sp), "gmv": round(gm), "orders": int(od), "roas": roas(gm, sp), "cpa": per(sp, od)}
    decline = {"recent": blk(recent), "prior": blk(prior),
               "by_camp": sorted([{"name": c,
                    "roas_now": roas(recent[recent._c == c]._gmv.sum(), recent[recent._c == c]._spend.sum()),
                    "roas_prev": roas(prior[prior._c == c]._gmv.sum(), prior[prior._c == c]._spend.sum()),
                    "spend_now": round(recent[recent._c == c]._spend.sum()),
                    "spend_prev": round(prior[prior._c == c]._spend.sum())}
                   for c in df["_c"].unique()], key=lambda x: -(x["spend_now"] or 0))}

    tot_sp, tot_gm, tot_od, tot_rf = df["_spend"].sum(), df["_gmv"].sum(), df["_orders"].sum(), df["_refund"].sum()
    totals = {"spend": round(tot_sp), "gmv": round(tot_gm), "orders": int(tot_od),
              "roas": roas(tot_gm, tot_sp), "cpa": per(tot_sp, tot_od), "aov": per(tot_gm, tot_od),
              "refund": round(tot_rf), "margin_rate": cm,
              "net": round(tot_gm * cm - tot_sp) if cm is not None else None,
              "net_roi": round((tot_gm * cm - tot_sp) / tot_sp, 2) if (cm is not None and tot_sp) else None,
              "n_camp": df["_c"].nunique(), "range": (daily[0]["date"] + " → " + daily[-1]["date"]) if daily else ""}
    # ----- khung thời gian: DoW (hiệu quả ads) + giờ (demand mua) -----
    dw = pd.to_datetime(df["_d"]).dt.dayofweek
    dow = []
    for w in range(7):
        g = df[dw == w]
        sp, gm, od = g["_spend"].sum(), g["_gmv"].sum(), g["_orders"].sum()
        dow.append({"dow": w, "spend": round(sp), "gmv": round(gm), "orders": int(od), "roas": roas(gm, sp)})
    timewin = {"dow": dow, "hour": _hour_demand()}

    return {"totals": totals, "campaigns": camps, "rows": rows,
            "daily": daily, "decline": decline, "timewin": timewin}

def build_report(out_js=None):
    out = Path(out_js) if out_js else (config.WEB / "ads_data.js")
    p = build_payload()
    data = json.dumps(p, ensure_ascii=False).replace("</", "<\\/") if p else "null"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(f"window.QAMI_ADS = {data};\n", encoding="utf-8")
    if p:
        t = p["totals"]
        print(f"[ads] OK: {t['n_camp']} campaign · {t['range']}")
        print(f"      spend {t['spend']:,} · GMV {t['gmv']:,} · ROAS {t['roas']} · CPA {t['cpa']:,} · AOV {t['aov']:,}")
        print(f"      biên đóng góp (COGS, trừ ads) = {t['margin_rate']} → net {t['net']:,} · NET-ROI {t['net_roi']}")
        rc, pr = p["decline"]["recent"], p["decline"]["prior"]
        print(f"      28 ngày: ROAS {pr['roas']}→{rc['roas']} · spend {pr['spend']:,}→{rc['spend']:,} · đơn {pr['orders']:,}→{rc['orders']:,}")
    return out

if __name__ == "__main__":
    print("->", build_report())
