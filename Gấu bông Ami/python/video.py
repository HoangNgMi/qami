# -*- coding: utf-8 -*-
"""03_ENGINE (video) — bóc tách KOC/Video từ Video_Analysis cho tab web "Video và KOC".

NGOÀI pipeline COGS (nguồn riêng, không đụng clean/merge). Thiếu file/cột -> trả None,
pipeline vẫn chạy bình thường (web chỉ ẩn tab video). Tham số ở config.VIDEO_*.
Mỗi khối bọc [ZONE].
"""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config  # noqa: E402


def _num(s):
    """Ép số thập phân (CTR, tỉ lệ %): bỏ '%', dấu phẩy. Giữ dấu '.' (thập phân)."""
    return pd.to_numeric(
        s.astype(str).str.replace("%", "", regex=False).str.replace(",", "", regex=False).str.strip(),
        errors="coerce")


def _money(s):
    """Ép tiền/đếm kiểu VN: '24.017.609₫' -> 24017609 ; '211' -> 211 (bỏ mọi ký tự ngoài chữ số)."""
    return pd.to_numeric(
        s.astype(str).str.replace(r"[^\d-]", "", regex=True).replace("", None),
        errors="coerce")


# ============================================================
# [ZONE V1 · Đọc & chuẩn hoá Video_Analysis]   Status: DRAFT
# In : rawdata/Video_Analysis_Video_List.xlsx (cột map ở config.VIDEO_COLS)
# Out: DataFrame _user/_date/_video/_gmv/_comm/_sold/_orders/_views/_clicks/_refund/_ctr/_comp — hoặc None
# ============================================================
def load():
    f = config.RAW / config.VIDEO_FILE
    if not f.exists():
        print(f"[video] khong thay {f.name} -> bo qua tab Video")
        return None
    try:
        raw = pd.read_excel(f, sheet_name=config.VIDEO_SHEET)
    except Exception as e:
        print(f"[video] loi doc {f.name}: {e} -> bo qua")
        return None
    C = config.VIDEO_COLS
    miss = [C[k] for k in ("user", "date", "video") if C[k] not in raw.columns]
    if miss:
        print(f"[video] thieu cot bat buoc {miss}. Co trong file: {list(raw.columns)}")
        return None

    def getcol(key):
        name = C.get(key)
        return raw[name] if (name and name in raw.columns) else None

    def money(key):
        c = getcol(key)
        return _money(c).fillna(0) if c is not None else pd.Series(0.0, index=raw.index)

    def pct(key):
        c = getcol(key)
        return _num(c) if c is not None else pd.Series(index=raw.index, dtype="float64")

    df = pd.DataFrame()
    df["_user"] = raw[C["user"]].fillna("(không rõ)").astype(str).str.strip()
    df["_date"] = pd.to_datetime(raw[C["date"]], errors="coerce").dt.strftime("%Y-%m-%d")
    df["_video"] = raw[C["video"]].astype(str)
    df["_link"] = raw[C["link"]].astype(str) if C.get("link") in raw.columns else ""
    df["_vidx"] = df["_link"].str.extract(r"/video/(\d+)", expand=False)  # ID chuẩn từ URL (ID video gốc bị đọc thành float, mất số)
    df["_gmv"] = money("gmv")
    df["_comm"] = money("comm")
    df["_sold"] = money("sold")
    df["_orders"] = money("orders")    # số ĐƠN nhờ video (khác số món _sold)
    df["_views"] = money("views")      # lượt xem video
    df["_clicks"] = money("clicks")    # lượt nhấp SP (mẫu số CTOR)
    df["_refund"] = money("refund")    # số món hoàn tiền
    df["_ctr"] = pct("ctr")
    df["_comp"] = pct("comp")
    df = df[df["_date"].notna() & (df["_user"] != "")]
    # chuẩn hoá CTR / tỉ lệ xem hết về %: nếu đang là tỉ lệ 0..1 thì ×100
    for k in ("_ctr", "_comp"):
        col = df[k].dropna()
        if len(col) and col.median() <= 1.0:
            df[k] = df[k] * 100
    return df


def _creative_rev():
    """Dict {ID video -> Doanh thu gộp} từ Creatives (join cấp video). Thiếu -> {}."""
    f = config.RAW / config.CREATIVE_FILE
    if not f.exists():
        print(f"[video] khong thay {f.name} -> 'Doanh thu gop' = 0")
        return {}
    try:
        cr = pd.read_excel(f, sheet_name=config.CREATIVE_SHEET)
    except Exception as e:
        print(f"[video] loi doc Creatives: {e}")
        return {}
    cc = config.CREATIVE_COLS
    if cc["video"] not in cr.columns or cc["rev"] not in cr.columns:
        print(f"[video] Creatives thieu cot {cc}")
        return {}
    v = cr[cc["video"]].astype(str)
    return _money(cr[cc["rev"]]).fillna(0).groupby(v).sum().to_dict()


# ============================================================
# [ZONE V2 · Tổng hợp A/B/C + đóng gói web]    Status: DRAFT
# In : df (ZONE V1)
# Out: dict {dates, koc, heat, kocRank, videos, totals} — hoặc None
# A = KOC × ngày (heat) · B = xếp hạng KOC theo GMV/hiệu suất · C = phễu CTR→bán (size=GMV)
# ============================================================
def build_payload():
    df = load()
    if df is None or df.empty:
        return None

    # ---- A: KOC × ngày -> số video (distinct) — TOÀN BỘ KOC (web lo ngay-loc + top20 + sort DESC) ----
    dates = sorted(df["_date"].dropna().unique().tolist())
    di = {d: i for i, d in enumerate(dates)}
    koc_order = df.groupby("_user")["_video"].nunique().sort_values(ascending=False).index.tolist()
    ki = {k: i for i, k in enumerate(koc_order)}
    heat = [[di[d], ki[u], int(c)]
            for (d, u), c in df.groupby(["_date", "_user"])["_video"].nunique().items()]

    # ---- B: xếp hạng KOC theo GMV + GMV/video ----
    agg = df.groupby("_user").agg(videos=("_video", "nunique"), gmv=("_gmv", "sum"),
                                  comm=("_comm", "sum"), sold=("_sold", "sum")).reset_index()
    agg["gpv"] = agg.apply(lambda r: r["gmv"] / r["videos"] if r["videos"] else 0, axis=1)
    agg = agg.sort_values("gmv", ascending=False).head(config.VIDEO_TOP_KOC)
    kocRank = [{"name": r["_user"], "videos": int(r["videos"]), "gmv": int(round(r["gmv"])),
                "comm": int(round(r["comm"])), "sold": int(round(r["sold"])),
                "gpv": int(round(r["gpv"]))} for _, r in agg.iterrows()]

    # ---- C: phễu — mỗi video 1 điểm (ctr vs số bán, size = gmv) ----
    vg = df.groupby("_video").agg(user=("_user", "first"), gmv=("_gmv", "sum"),
                                  sold=("_sold", "sum"), ctr=("_ctr", "max"),
                                  comp=("_comp", "max")).reset_index()
    vg = vg.sort_values("gmv", ascending=False).head(config.VIDEO_SCATTER)
    videos = [{"user": r["user"], "gmv": int(round(r["gmv"])), "sold": int(round(r["sold"])),
               "ctr": round(float(r["ctr"]), 2) if pd.notna(r["ctr"]) else None,
               "comp": round(float(r["comp"]), 2) if pd.notna(r["comp"]) else None}
              for _, r in vg.iterrows()]

    # ---- Bảng Video ROI (#2): 1 dòng/video, sort GMV↓ rồi Doanh thu gộp↓ ----
    rev_map = _creative_rev()
    vt = df.groupby("_video").agg(date=("_date", "first"), user=("_user", "first"),
                                  link=("_link", "first"), vidx=("_vidx", "first"),
                                  gmv=("_gmv", "sum"), sold=("_sold", "sum"),
                                  orders=("_orders", "sum"), refund=("_refund", "sum"),
                                  views=("_views", "sum"), clicks=("_clicks", "sum"),
                                  ctr=("_ctr", "max"), comp=("_comp", "max")).reset_index()
    vt["rev"] = vt["vidx"].map(rev_map).fillna(0)
    # CTOR = số đơn / số click (×100). Click = 0 -> None (khỏi chia 0)
    vt["ctor"] = vt.apply(lambda r: round(r["orders"] / r["clicks"] * 100, 2)
                          if r["clicks"] else None, axis=1)
    vt = vt.sort_values(["gmv", "rev"], ascending=[False, False])
    table = [{"date": r["date"], "user": r["user"], "link": r["link"],
              "gmv": int(round(r["gmv"])), "sold": int(round(r["sold"])),
              "orders": int(round(r["orders"])), "refund": int(round(r["refund"])),
              "views": int(round(r["views"])), "clicks": int(round(r["clicks"])),
              "ctr": round(float(r["ctr"]), 2) if pd.notna(r["ctr"]) else None,
              "ctor": r["ctor"] if pd.notna(r["ctor"]) else None,
              "comp": round(float(r["comp"]), 2) if pd.notna(r["comp"]) else None}
             for _, r in vt.iterrows()]
    nrev = int((vt["rev"] > 0).sum())  # Doanh thu gộp bỏ khỏi bảng, giữ đếm để log

    totals = {"videos": int(df["_video"].nunique()), "koc": int(df["_user"].nunique()),
              "gmv": int(round(df["_gmv"].sum())), "comm": int(round(df["_comm"].sum())),
              "sold": int(round(df["_sold"].sum())),
              "range": (dates[0] + " → " + dates[-1]) if dates else ""}
    print(f"[video] OK: {totals['videos']} video · {totals['koc']} KOC · {len(dates)} ngay"
          f" · 'Doanh thu gop' co o {nrev}/{len(table)} video")
    return {"dates": dates, "koc": koc_order, "heat": heat, "kocRank": kocRank,
            "videos": videos, "table": table, "totals": totals}


# ============================================================
# [ZONE V3 · Ghi web/video_data.js]            Status: DRAFT
# In : payload (ZONE V2)
# Out: web/video_data.js (window.QAMI_VIDEO = {...} | null) — file RIÊNG, KHÔNG đụng data.js
# ============================================================
def build_report(out_js=None):
    import json
    out = Path(out_js) if out_js else (config.WEB / "video_data.js")
    payload = build_payload()
    data = json.dumps(payload, ensure_ascii=False).replace("</", "<\\/") if payload else "null"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(f"window.QAMI_VIDEO = {data};\n", encoding="utf-8")
    return out


def main():
    print("->", build_report())


if __name__ == "__main__":
    main()
