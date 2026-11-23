# -*- coding: utf-8 -*-
"""03_ENGINE (mmm) — Marketing Mix Model: tách doanh thu TỔNG thành ads-incremental vs organic.
NGOÀI pipeline COGS (chỉ ĐỌC cleaned + ads_data.js, không sửa clean/merge/run_all). Học cách Fospha "Halo".

Y = doanh thu TỔNG/ngày (mọi đơn, gồm organic) từ cleaned.  X = ad spend/ngày từ ads_data.js.
OLS: rev ~ baseline(trend + thứ-tuần) + β·spend.  β = INCREMENTAL ROAS ước lượng.
Báo 2 model (trend tuyến tính / bậc 2) để BRACKET độ nhạy — observational data cần holdout calibrate.
"""
import sys, json
from pathlib import Path
import numpy as np, pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config  # noqa: E402

def _ols(X, y):
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    resid = y - X @ beta
    dof = max(1, len(y) - X.shape[1])
    cov = (resid @ resid) / dof * np.linalg.inv(X.T @ X)
    se = np.sqrt(np.diag(cov))
    r2 = 1 - (resid @ resid) / ((y - y.mean()) ** 2).sum()
    return beta, se, r2, resid

def build_payload():
    cl_path = config.CLEANED
    ads_path = config.WEB / "ads_data.js"
    if not Path(cl_path).exists() or not ads_path.exists():
        print("[mmm] thiếu cleaned hoặc ads_data.js -> bỏ qua"); return None
    cl = pd.read_excel(cl_path)
    cl["d"] = pd.to_datetime(cl["Thời gian tạo đơn hàng"], errors="coerce")
    sales = (cl.dropna(subset=["d"]).groupby(cl["d"].dt.normalize())
             .agg(rev=("Tổng doanh thu", "sum")).reset_index())
    sales.columns = ["date", "rev"]
    txt = ads_path.read_text(encoding="utf-8")
    ADS = json.loads(txt[txt.find("=") + 1: txt.rstrip().rstrip(";").rfind("}") + 1])
    sp = pd.DataFrame(ADS["daily"]); sp["date"] = pd.to_datetime(sp["date"])
    df = sales.merge(sp[["date", "spend", "gmv"]].rename(columns={"gmv": "ad_gmv"}),
                     on="date", how="inner").sort_values("date").reset_index(drop=True)
    if len(df) < 20:
        print(f"[mmm] chỉ {len(df)} ngày chung -> quá ít, bỏ qua"); return None

    df["t"] = (df.date - df.date.min()).dt.days
    tn = df["t"].values / max(df["t"].max(), 1)   # trend chuẩn hoá 0..1
    dow = pd.get_dummies(df.date.dt.day_of_week, prefix="dow", drop_first=True).astype(float).values
    spend = df["spend"].values.astype(float); y = df["rev"].values.astype(float)
    one = np.ones((len(df), 1))
    report_roas = round(df.ad_gmv.sum() / df.spend.sum(), 1) if df.spend.sum() else None

    models = []
    designs = [("trend tuyến tính", np.column_stack([one, tn, spend, dow]), 2),
               ("trend bậc 2 (baseline mềm hơn)", np.column_stack([one, tn, tn**2, spend, dow]), 3)]
    primary_daily = None
    for name, X, bi in designs:
        beta, se, r2, _ = _ols(X, y)
        b, s = beta[bi], se[bi]
        inc = b * df.spend.sum(); base = df.rev.sum() - inc
        models.append({"name": name, "inc_roas": round(b, 2),
                       "ci_lo": round(b - 1.96 * s, 2), "ci_hi": round(b + 1.96 * s, 2),
                       "t": round(b / s, 1) if s else None, "r2": round(r2, 3),
                       "organic_pct": round(max(0, base) / df.rev.sum() * 100)})
        if "bậc 2" in name:   # lấy model mềm hơn (bảo thủ) để phân rã daily
            base_daily = X @ beta - b * spend   # baseline = toàn phần trừ ads
            inc_daily = b * spend
            primary_daily = [{"date": d.strftime("%Y-%m-%d"), "rev": round(r),
                              "spend": round(sp_), "baseline": round(max(0, bl)), "incremental": round(max(0, ic))}
                             for d, r, sp_, bl, ic in zip(df.date, y, spend, base_daily, inc_daily)]

    corr = round(float(np.corrcoef(df["t"], spend)[0, 1]), 2)
    return {
        "range": df.date.min().strftime("%Y-%m-%d") + " → " + df.date.max().strftime("%Y-%m-%d"),
        "n_days": len(df), "report_roas": report_roas,
        "total_rev": round(df.rev.sum()), "total_spend": round(df.spend.sum()),
        "models": models, "daily": primary_daily,
        "diag": {"corr_spend_trend": corr,
                 "note": "Observational: β hiểu là CẬN TRÊN incremental (spend trùng xu hướng tăng). "
                         "Cần HOLDOUT để neo baseline → con số calibrate."}
    }

def build_report(out_js=None):
    out = Path(out_js) if out_js else (config.WEB / "mmm_data.js")
    p = build_payload()
    data = json.dumps(p, ensure_ascii=False).replace("</", "<\\/") if p else "null"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(f"window.QAMI_MMM = {data};\n", encoding="utf-8")
    if p:
        print(f"[mmm] OK: {p['n_days']} ngày · {p['range']} · ROAS report {p['report_roas']}")
        for m in p["models"]:
            print(f"      {m['name']:34s} incremental ROAS {m['inc_roas']} [{m['ci_lo']}–{m['ci_hi']}] "
                  f"· organic {m['organic_pct']}% · R²={m['r2']} · t={m['t']}")
        print(f"      corr(spend,trend)={p['diag']['corr_spend_trend']} → {p['diag']['note'][:60]}…")
    return out

if __name__ == "__main__":
    print("->", build_report())
