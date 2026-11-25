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
# In : rawdata/Video_Analysis_Video_List_YYYYMM.xlsx (mọi tháng) — không có thì Video_Analysis_Video_List.xlsx
#      (cột map ở config.VIDEO_COLS)
# Out: DataFrame _month/_user/_date/_video/_gmv/_comm/_sold/_orders/_views/_clicks/_imps/_refund/_ctr/_comp — hoặc None
# ============================================================
def _sources():
    """[(file, 'YYYYMM'|'')]. Có file tháng → chỉ dùng file tháng (bỏ file gộp, báo rõ)."""
    import re
    pat = re.compile(getattr(config, "VIDEO_MONTHLY", r"^$"))
    monthly = sorted((f, pat.match(f.name).group(1)) for f in config.RAW.glob("*.xlsx") if pat.match(f.name))
    plain = config.RAW / config.VIDEO_FILE
    if monthly:
        if plain.exists():
            print(f"[video] co {len(monthly)} file thang -> BO QUA file gop {plain.name} (khung cu)")
        return monthly
    return [(plain, "")] if plain.exists() else []


def load():
    src = _sources()
    if not src:
        print(f"[video] khong thay {config.VIDEO_FILE} (hay file thang) -> bo qua tab Video")
        return None
    frames = []
    for f, ym in src:
        d = _load_one(f, ym)
        if d is not None:
            frames.append(d)
    if not frames:
        return None
    df = pd.concat(frames, ignore_index=True)
    print(f"[video] doc {len(frames)} file: " + ", ".join(f"{ym or 'gop'}={n}" for ym, n in
                                                         df.groupby("_month", sort=True).size().items()) + " dong")
    return df


def _load_one(f, ym):
    try:
        raw = pd.read_excel(f, sheet_name=config.VIDEO_SHEET)
    except Exception as e:
        print(f"[video] loi doc {f.name}: {e} -> bo qua file nay")
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
        """Tỷ lệ về đơn vị % (2.4 = 2,4%). Chuỗi có '%' = ĐÃ là % → giữ nguyên.
        Chỉ ×100 khi KHÔNG có '%' và mọi giá trị ≤ 1 (tỷ lệ thật 0..1).
        (Sửa 2026-11-25: trước đây đoán bằng TRUNG VỊ ≤ 1 → số đã là % bị ×100 oan, vd CTR 1,93% hiện 193%.)"""
        c = getcol(key)
        if c is None:
            return pd.Series(index=raw.index, dtype="float64")
        v = _num(c)
        has_pct = c.astype(str).str.contains("%", regex=False).any()
        if not has_pct and v.dropna().le(1.0).all() and v.notna().any():
            v = v * 100
        return v

    df = pd.DataFrame()
    df["_user"] = raw[C["user"]].fillna("(không rõ)").astype(str).str.strip()
    df["_date"] = pd.to_datetime(raw[C["date"]], errors="coerce").dt.strftime("%Y-%m-%d")
    df["_link"] = raw[C["link"]].astype(str) if C.get("link") in raw.columns else ""
    df["_vidx"] = df["_link"].str.extract(r"/video/(\d+)", expand=False)  # ID chuẩn từ URL (ID video gốc bị đọc thành float, mất số)
    # KHOÁ video = ID từ link (chính xác). ID gốc là float mất số → 2 video khác nhau có thể VA NHAU khi gộp nhiều tháng.
    df["_video"] = df["_vidx"].fillna(raw[C["video"]].astype(str))
    df["_month"] = ym
    df["_gmv"] = money("gmv")
    df["_comm"] = money("comm")
    df["_sold"] = money("sold")
    df["_orders"] = money("orders")    # số ĐƠN nhờ video (khác số món _sold)
    df["_views"] = money("views")      # lượt xem video
    df["_clicks"] = money("clicks")    # lượt nhấp SP (tử số CTR · mẫu số CTOR)
    df["_imps"] = money("imps") if getcol("imps") is not None else float("nan")   # lượt hiển thị SP (mẫu số CTR)
    df["_refund"] = money("refund")    # số món hoàn tiền
    df["_ctr"] = pct("ctr")            # CTR TikTok — chỉ dự phòng khi thiếu _imps
    df["_comp"] = pct("comp")
    # Chỉ giữ dòng là VIDEO THẬT (có ID trong link hoặc ID dạng số) → loại dòng MÔ TẢ cột TikTok chèn dưới header.
    # GIỮ video có "Ngày đăng" = "--" (TikTok không cấp ngày): vẫn có GMV thật → tính vào tổng/bảng "Tất cả",
    # chỉ không xếp được theo ngày đăng. (Trước 2026-11-25 bị LOẠI → mất ~19,7tr GMV ở 4 file tháng qami.)
    real = df["_vidx"].notna() | pd.to_numeric(raw[C["video"]], errors="coerce").notna()
    return df[real & (df["_user"] != "")]


def _ctr(clicks, imps, fallback):
    """CTR % = lượt nhấp SP ÷ lượt hiển thị SP × 100 (khớp 100% số TikTok — kiểm 2026-11-25).
    Không có lượt hiển thị → dùng CTR TikTok (đã chuẩn đơn vị) nếu có."""
    if pd.notna(imps) and imps > 0:
        return round(float(clicks) / float(imps) * 100, 2)
    return round(float(fallback), 2) if pd.notna(fallback) else None


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

    # 1 video có thể nằm ở NHIỀU file tháng → cộng thành phần theo video, rồi TÍNH LẠI tỷ lệ:
    #   CTR = Σ nhấp ÷ Σ hiển thị SP · Xem hết = Σ(xem hết% × lượt xem) ÷ Σ lượt xem (trung bình có trọng số).
    #   (Trước 2026-11-25 lấy MAX tỷ lệ → sai khi gộp nhiều kỳ.)
    df = df.assign(_compw=df["_comp"] * df["_views"],
                   _compv=df["_views"].where(df["_comp"].notna(), 0))
    AGG = dict(user=("_user", "first"), gmv=("_gmv", "sum"), sold=("_sold", "sum"),
               clicks=("_clicks", "sum"), imps=("_imps", "sum"), ctr_tt=("_ctr", "max"),
               compw=("_compw", "sum"), compv=("_compv", "sum"))

    def _comp(r):
        return round(float(r["compw"]) / float(r["compv"]), 2) if r["compv"] else None

    # ---- C: phễu — mỗi video 1 điểm (ctr vs số bán, size = gmv) ----
    vg = df.groupby("_video").agg(**AGG).reset_index()
    vg = vg.sort_values("gmv", ascending=False).head(config.VIDEO_SCATTER)
    videos = [{"user": r["user"], "gmv": int(round(r["gmv"])), "sold": int(round(r["sold"])),
               "ctr": _ctr(r["clicks"], r["imps"], r["ctr_tt"]), "comp": _comp(r)}
              for _, r in vg.iterrows()]

    # ---- Bảng Video ROI (#2): 1 dòng/video, sort GMV↓ rồi Doanh thu gộp↓ ----
    rev_map = _creative_rev()
    vt = df.groupby("_video").agg(date=("_date", "first"), link=("_link", "first"),
                                  vidx=("_vidx", "first"), orders=("_orders", "sum"), comm=("_comm", "sum"),
                                  refund=("_refund", "sum"), views=("_views", "sum"),
                                  months=("_month", "nunique"), **AGG).reset_index()
    vt["ctr"] = vt.apply(lambda r: _ctr(r["clicks"], r["imps"], r["ctr_tt"]), axis=1)
    vt["comp"] = vt.apply(_comp, axis=1)
    vt["rev"] = vt["vidx"].map(rev_map).fillna(0)
    # CTOR = số đơn / số click (×100). Click = 0 -> None (khỏi chia 0)
    vt["ctor"] = vt.apply(lambda r: round(r["orders"] / r["clicks"] * 100, 2)
                          if r["clicks"] else None, axis=1)
    vt = vt.sort_values(["gmv", "rev"], ascending=[False, False])
    table = [{"date": r["date"] if pd.notna(r["date"]) else None, "user": r["user"], "link": r["link"],
              "gmv": int(round(r["gmv"])), "sold": int(round(r["sold"])), "comm": int(round(r["comm"])),
              "orders": int(round(r["orders"])), "refund": int(round(r["refund"])),
              "views": int(round(r["views"])), "clicks": int(round(r["clicks"])),
              "ctr": round(float(r["ctr"]), 2) if pd.notna(r["ctr"]) else None,
              "ctor": r["ctor"] if pd.notna(r["ctor"]) else None,
              "comp": round(float(r["comp"]), 2) if pd.notna(r["comp"]) else None}
             for _, r in vt.iterrows()]
    nrev = int((vt["rev"] > 0).sum())  # Doanh thu gộp bỏ khỏi bảng, giữ đếm để log

    months = sorted(m for m in df["_month"].unique() if m)
    totals = {"videos": int(df["_video"].nunique()), "koc": int(df["_user"].nunique()),
              "gmv": int(round(df["_gmv"].sum())), "comm": int(round(df["_comm"].sum())),
              "sold": int(round(df["_sold"].sum())),
              "range": (dates[0] + " → " + dates[-1]) if dates else "",
              # kỳ số liệu = các tháng file export (số mỗi video = Σ các tháng này)
              "months": [m[4:] + "/" + m[:4] for m in months],
              "nodate": int(df.loc[df["_date"].isna(), "_video"].nunique())}   # video TikTok ghi ngày đăng "--"
    print(f"[video] OK: {totals['videos']} video · {totals['koc']} KOC · {len(dates)} ngay"
          f" · thang {','.join(months) or 'gop'} · 'Doanh thu gop' co o {nrev}/{len(table)} video")
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
