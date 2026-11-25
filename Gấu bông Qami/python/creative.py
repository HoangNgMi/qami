# -*- coding: utf-8 -*-
"""03_ENGINE (creative) — phễu & creative từ "Creative data.xlsx" (ad cấp CREATIVE/bài đăng).
NGOÀI pipeline COGS (nguồn riêng, KHÔNG đụng clean/merge/run_all). Thiếu file -> trả None.
Mở phễu mà campaign file THIẾU: Hiển thị → Click (CTR) → Đơn (CVR) + hook video.
"""
import sys, json
from pathlib import Path
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config  # noqa: E402

FILE = "Creative data.xlsx"
C = {
    "post": "ID bài đăng", "fmt": "Mẫu quảng cáo", "camp": "Tên chiến dịch", "spu": "Tên sản phẩm",
    "ctype": "Loại nội dung sáng tạo", "spend": "Chi phí", "orders": "Số lượng đơn hàng SKU",
    "gmv": "Doanh thu gộp", "impr": "Số lượt hiển thị quảng cáo sản phẩm",
    "clicks": "Số lượt nhấp vào quảng cáo sản phẩm",
    "hook2": "Tỷ lệ xem video quảng cáo trong 2 giây",
    "hook6": "Tỷ lệ xem video quảng cáo trong 6 giây",
    "v100": "Tỷ lệ xem 100% thời lượng video quảng cáo",
}


def _num(s):
    return pd.to_numeric(s, errors="coerce").fillna(0)


def _rate(series):
    v = pd.to_numeric(series.astype(str).str.replace("%", "", regex=False).str.replace(",", ".", regex=False).str.strip(),
                      errors="coerce").fillna(0)
    return v / 100 if v.max() > 1.5 else v   # chuẩn hoá về phân số 0..1


def _div(a, b):
    return round(a / b, 4) if b else None


def _margin():
    """Biên đóng góp blended (TRỪ ads) từ cleaned — để tính hoà vốn + backtest. Thiếu → 0.275."""
    f = config.CLEANED
    if not Path(f).exists():
        return 0.275
    try:
        d = pd.read_excel(f)
        rev = _num(d["Tổng doanh thu"]).sum()
        if rev <= 0:
            return 0.275
        cost = sum(_num(d[c]).abs().sum() for c in ("Cost_COGS", "Cost_Platform", "Cost_KOC") if c in d.columns)
        return round((rev - cost) / rev, 4)
    except Exception:
        return 0.275


def build_payload():
    f = config.RAW / FILE
    if not f.exists():
        print(f"[creative] không thấy {FILE} -> bỏ qua"); return None
    df = pd.read_excel(f)
    for k in ("spend", "orders", "gmv", "impr", "clicks"):
        df["_" + k] = _num(df[C[k]])
    df["_hook6"] = _rate(df[C["hook6"]]) if C["hook6"] in df.columns else 0
    df["_camp"] = df[C["camp"]].astype(str).str.strip()
    df["_spu"] = df.get(C["spu"], "").astype(str).str.strip()
    df["_fmt"] = df.get(C["fmt"], "").astype(str).str.strip()
    df["_ctype"] = df.get(C["ctype"], "").astype(str).str.strip()
    act = df[df["_spend"] > 0].copy()            # creative CÓ chạy ads
    if not len(act):
        print("[creative] không có creative nào có chi phí -> bỏ qua"); return None

    def blk(g):
        sp, gm, od = g["_spend"].sum(), g["_gmv"].sum(), g["_orders"].sum()
        im, cl = g["_impr"].sum(), g["_clicks"].sum()
        return {"spend": round(sp), "gmv": round(gm), "orders": int(od),
                "impr": int(im), "clicks": int(cl),
                "ctr": _div(cl, im), "cvr": _div(od, cl), "roas": _div(gm, sp),
                "cpc": _div(sp, cl), "cpm": round(sp / im * 1000) if im else None,
                "cpa": round(sp / od) if od else None}

    # ----- phễu theo campaign (roll-up) -----
    camps = []
    for c, g in act.groupby("_camp"):
        d = blk(g); d["name"] = c; d["n_creative"] = int(len(g))
        camps.append(d)
    camps.sort(key=lambda x: -x["spend"])

    # ----- theo ĐỊNH DẠNG nội dung (Video / Thẻ SP / LIVE...) -----
    types = []
    for ct, g in act.groupby("_ctype"):
        d = blk(g); d["ctype"] = (ct or "—").strip() or "—"; d["n"] = int(len(g))
        types.append(d)
    types.sort(key=lambda x: -x["spend"])

    # ----- leaderboard creative (top theo spend) -----
    act = act.sort_values("_spend", ascending=False)
    creatives = []
    for _, r in act.head(80).iterrows():
        sp, gm, od = r["_spend"], r["_gmv"], r["_orders"]
        im, cl = r["_impr"], r["_clicks"]
        creatives.append({
            "post": str(r.get(C["post"], ""))[:40], "camp": r["_camp"],
            "spu": r["_spu"][:60], "fmt": r["_fmt"], "ctype": r["_ctype"],
            "spend": round(sp), "gmv": round(gm), "orders": int(od),
            "roas": _div(gm, sp), "ctr": _div(cl, im), "cvr": _div(od, cl),
            "hook6": round(float(r["_hook6"]), 3), "impr": int(im), "clicks": int(cl)})

    tot = blk(act)
    tot["n_creative"] = int(len(act)); tot["n_campaign"] = len(camps)

    # ----- BACKTEST: creative DƯỚI hoà vốn (net<0) = tiền kill-rule đáng lẽ cứu -----
    mr = _margin(); be = round(1 / mr, 2) if mr else 3.64
    act["_net"] = act["_gmv"] * mr - act["_spend"]
    loss = act[act["_net"] < 0]
    backtest = {"margin": mr, "breakeven_roas": be,
                "all_n": int(len(act)), "all_spend": round(act["_spend"].sum()),
                "loss_n": int(len(loss)), "loss_spend": round(loss["_spend"].sum()),
                "loss_gmv": round(loss["_gmv"].sum()),
                "loss_net": round(loss["_net"].sum())}   # âm = tổng lỗ trên creative dốt
    return {"totals": tot, "campaigns": camps, "types": types, "creatives": creatives, "backtest": backtest}


def build_report(out_js=None):
    out = Path(out_js) if out_js else (config.WEB / "creative_data.js")
    p = build_payload()
    data = json.dumps(p, ensure_ascii=False).replace("</", "<\\/") if p else "null"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(f"window.QAMI_CREATIVE = {data};\n", encoding="utf-8")
    if p:
        t = p["totals"]
        print(f"[creative] OK: {t['n_creative']} creative · {t['n_campaign']} campaign")
        print(f"      spend {t['spend']:,} · GMV {t['gmv']:,} · ROAS {t['roas']} · "
              f"CTR {round((t['ctr'] or 0)*100,2)}% · CVR {round((t['cvr'] or 0)*100,2)}% · CPC {t['cpc']}")
    return out


if __name__ == "__main__":
    print("->", build_report())
