# -*- coding: utf-8 -*-
"""returns.py — phân tích HOÀN & HỦY trên INCOME THẬT cho tab web "Hoàn & Hủy" (qami).

NGOÀI pipeline COGS (KHÔNG sửa clean/merge/analyze/run_all) — chỉ ĐỌC:
  · rawdata/Tất cả đơn hàng.xlsx   → loại đơn, lý do hủy, ai hủy, đã ship chưa, tỉnh, thanh toán, kênh, KOC, SP
  · rawdata/income_*.xlsx + income.xlsx (sheet "Chi tiết đơn hàng") → TIỀN THẬT theo TỪNG DÒNG QUYẾT TOÁN
      gộp mọi file, BỎ DÒNG TRÙNG HẲN (income_202609 lấn sang QT tháng 10 = 502 dòng trùng income.xlsx)
  · cleaned/02_income_py.xlsx (chỉ dòng "Chưa quyết toán", pipeline dựng từ onhold) → tiền ƯỚC TÍNH đơn chưa quyết toán
Ghi web/returns_data.js (window.QAMI_RETURNS = {...} | null). Thiếu file → null, web ẩn tab.

Tiền mỗi dòng income:  G = "Tổng phụ sau giảm giá của người bán" (income gộp, trước hoàn)
                       R = "Tổng phụ của khoản hoàn tiền sau giảm giá…" (hoàn, ÂM) · F = "Tổng phí" (ÂM)
                       N = "Tổng số tiền quyết toán" (thực nhận) = G + R + F   (kiểm khớp tuyệt đối)
1 đơn có NHIỀU dòng, MỖI dòng 1 ngày quyết toán riêng (vd đặt T10, hoàn QT T11):
  · chế độ A (theo NGÀY ĐẶT)       → gom mọi dòng của đơn về ngày đặt  (mảng theo ĐƠN: ig/ir/if/in)
  · chế độ B (theo NGÀY QUYẾT TOÁN) → từng dòng tính vào ngày tiền chạy (mảng theo DÒNG: e*)

Loại đơn (t): 0 Thành công · 1 Đang xử lý · 2 Hủy trước ship · 3 Giao thất bại (Cancel + ĐÃ ship) · 4 Hoàn/hoàn tiền
"""
import re
import sys
import json
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config  # noqa: E402

TYPES = ["Thành công", "Đang xử lý", "Hủy trước ship", "Giao thất bại", "Hoàn / hoàn tiền"]
BY = {"User": "Khách", "System": "Hệ thống", "Operator": "Shop / vận hành"}
IC = {"g": "Tổng phụ sau giảm giá của người bán", "r": "Tổng phụ của khoản hoàn tiền sau giảm giá của người bán",
      "f": "Tổng phí", "n": "Tổng số tiền quyết toán"}


def _int(s):
    return pd.to_numeric(s.astype(str).str.replace(r"[^\d-]", "", regex=True).replace("", None),
                         errors="coerce").fillna(0)


# ============================================================
# [ZONE R1 · Đọc đơn gốc (1 dòng/đơn) + phân loại]   Status: DRAFT
# ============================================================
def load_orders():
    f = config.RAW / config.FILES["orders"]
    if not f.exists():
        print(f"[returns] khong thay {f.name} -> bo qua tab Hoan & Huy")
        return None
    raw = pd.read_excel(f, sheet_name=config.SHEETS["orders"], dtype={"Order ID": str})
    raw = raw[raw["Order ID"].astype(str).str.fullmatch(r"\d+")]        # bỏ dòng mô tả cột TikTok
    o = raw.drop_duplicates("Order ID").set_index("Order ID")           # SP chính = dòng SKU đầu (97,8% đơn 1 SKU)
    ctype = o["Cancelation/Return Type"].fillna("").astype(str)
    sub = o["Order Substatus"].fillna("").astype(str)
    shipped = o["Shipped Time"].notna() & (o["Shipped Time"].astype(str).str.strip() != "")
    t = pd.Series(1, index=o.index)
    t[sub.isin(["Đã hoàn tất", "Đã giao"])] = 0
    t[(ctype == "Cancel") & ~shipped] = 2
    t[(ctype == "Cancel") & shipped] = 3
    t[ctype == "Return/Refund"] = 4
    df = pd.DataFrame({
        "t": t,
        "date": pd.to_datetime(o["Created Time"], errors="coerce", dayfirst=True).dt.strftime("%Y-%m-%d"),
        "by": o["Cancel By"].map(BY).fillna(""),
        "reason": o["Cancel Reason"].fillna("").astype(str).str.strip(),
        "prov": o["Province"].fillna("(không rõ)").astype(str).str.strip(),
        "pay": (o["Payment Method"].astype(str) == "Thanh toán khi giao hàng").map({True: 0, False: 1}),
        "ch": o["Order Channel"].fillna("Khác").astype(str),
        "koc": o["Creator Handle"].fillna("").astype(str).str.strip(),
        "prod": o["Product Name"].fillna("Không rõ").astype(str).str.slice(0, 70),
    }, index=o.index)
    return df[df["date"].notna()]


# ============================================================
# [ZONE R2 · Income thật: mọi file, bỏ dòng trùng, theo DÒNG quyết toán]   Status: DRAFT
# ============================================================
def load_income():
    pat = re.compile(r"^income(_\d{6})?\.xlsx$")
    files = sorted(f for f in config.RAW.glob("income*.xlsx") if pat.match(f.name))
    if not files:
        print("[returns] khong thay income*.xlsx -> tien = 0")
        return None
    parts = [pd.read_excel(f, sheet_name=config.SHEETS["income"], dtype=str) for f in files]
    common = [c for c in parts[0].columns if all(c in p.columns for p in parts)]
    raw = pd.concat(parts, ignore_index=True)
    n0 = len(raw)
    # TRÙNG giữa các file = giống nhau ở MỌI CỘT CHUNG. (Không so toàn bộ cột: TikTok đổi tên vài cột phụ giữa các lần
    # xuất — "SFR service fee" vs "Phí dịch vụ SFR" — nên cột lệch thành NaN và dòng trùng "trông khác nhau".)
    raw = raw.drop_duplicates(subset=common)
    ndup = n0 - len(raw)
    raw = raw[raw["Loại giao dịch"] == "Đơn hàng"]                       # bỏ bồi hoàn nền tảng / GMV ads (không phải đơn)
    ev = pd.DataFrame({
        "oid": raw["ID đơn hàng/điều chỉnh"].astype(str),
        "dc": pd.to_datetime(raw["Thời gian tạo đơn hàng"], errors="coerce").dt.strftime("%Y-%m-%d"),
        "ds": pd.to_datetime(raw["Thời gian quyết toán đơn hàng"], errors="coerce").dt.strftime("%Y-%m-%d"),
        **{k: pd.to_numeric(raw[c], errors="coerce").fillna(0) for k, c in IC.items()},
    })
    gap = (ev["g"] + ev["r"] + ev["f"] - ev["n"]).abs().max()
    print(f"[returns] income: {len(files)} file · {n0} dong · bo {ndup} dong trung · {len(ev)} dong don hang"
          f" · lech G+R+F-N toi da {gap:.0f}d")
    return ev[ev["dc"].notna() & ev["ds"].notna()]


def load_pl():
    """Từ P&L (pipeline): GIÁ VỐN mỗi đơn (Cost_COGS — cột dashboard dùng; KHÔNG dùng Abs_COGS bị thổi phồng)
    + tiền ƯỚC TÍNH của đơn CHƯA quyết toán (dòng 'Chưa quyết toán', pipeline dựng từ onhold)."""
    if not config.CLEANED.exists():
        return None, None
    p = pd.read_excel(config.CLEANED, dtype={"ID đơn hàng/điều chỉnh": str})
    p = p[p["Loại giao dịch"] == "Đơn hàng"]
    idx = p["ID đơn hàng/điều chỉnh"].astype(str)
    pend_m = p["Trạng thái quyết toán"] == "Chưa quyết toán"
    cogs = pd.Series((-p["Cost_COGS"]).fillna(0).values, index=idx)[~pend_m.values].groupby(level=0).sum()
    q = p[pend_m]
    pend = pd.DataFrame({"g": q["Tổng doanh thu"].fillna(0).values, "f": q["Tổng phí"].fillna(0).values,
                         "n": q["Tổng số tiền quyết toán"].fillna(0).values, "cg": (-q["Cost_COGS"]).fillna(0).values},
                        index=q["ID đơn hàng/điều chỉnh"].astype(str)).groupby(level=0).sum()
    return cogs, pend


# ============================================================
# [ZONE R3 · Đóng gói web: mảng theo ĐƠN + mảng theo DÒNG quyết toán]   Status: DRAFT
# ============================================================
def build_payload():
    o = load_orders()
    if o is None or o.empty:
        return None
    ev = load_income()
    cogs, pend = load_pl()
    pos = {oid: i for i, oid in enumerate(o.index)}

    for k in ("ig", "ir", "if", "in", "cg", "pg", "pf", "pn", "pcg"):
        o[k] = 0.0
    if ev is not None and len(ev):
        s = ev.groupby("oid")[["g", "r", "f", "n"]].sum()
        j = o.index.intersection(s.index)
        o.loc[j, ["ig", "ir", "if", "in"]] = s.loc[j, ["g", "r", "f", "n"]].values
    if cogs is not None and len(cogs):
        j = o.index.intersection(cogs.index)
        o.loc[j, "cg"] = cogs.loc[j].values
    if pend is not None and len(pend):
        j = o.index.intersection(pend.index)
        o.loc[j, ["pg", "pf", "pn", "pcg"]] = pend.loc[j, ["g", "f", "n", "cg"]].values

    def enc(col):
        vals = sorted(v for v in o[col].unique() if v != "")
        ix = {v: i for i, v in enumerate(vals)}
        return vals, [ix.get(v, -1) for v in o[col]]

    dates, d = enc("date")
    by, b = enc("by")
    reasons, rs = enc("reason")
    provs, pv = enc("prov")
    chs, ch = enc("ch")
    kocs, kc = enc("koc")
    prods, pr = enc("prod")
    ints = lambda c: [int(round(x)) for x in o[c]]  # noqa: E731

    # dòng quyết toán: ngày tạo + ngày QT (từ điển ngày riêng) · o = vị trí đơn trong mảng đơn (-1 = đơn không có trong file đơn)
    E = {"o": [], "dc": [], "ds": [], "g": [], "r": [], "f": [], "n": [], "cg": []}
    edates = []
    if ev is not None and len(ev):
        edates = sorted(set(ev["dc"]) | set(ev["ds"]))
        ei = {v: i for i, v in enumerate(edates)}
        # giá vốn của đơn → gắn vào DÒNG QUYẾT TOÁN ĐẦU TIÊN của đơn (chế độ dòng tiền)
        ev = ev.reset_index(drop=True)
        first = ev.sort_values(["ds"], kind="stable").drop_duplicates("oid").index
        ev["cg"] = 0.0
        if cogs is not None:
            ev.loc[first, "cg"] = ev.loc[first, "oid"].map(cogs).fillna(0).values
        E = {"o": [pos.get(x, -1) for x in ev["oid"]], "dc": [ei[x] for x in ev["dc"]], "ds": [ei[x] for x in ev["ds"]],
             **{k: [int(round(x)) for x in ev[k]] for k in ("g", "r", "f", "n", "cg")}}
    orphan = sum(1 for x in E["o"] if x < 0)
    cnt = o["t"].value_counts().reindex(range(5), fill_value=0)
    fmt = lambda s: f"{s:,.0f}".replace(",", ".")  # noqa: E731
    totals = {"orders": int(len(o)), "byType": [int(x) for x in cnt], "events": len(E["o"]), "orphan": orphan,
              "pending": int((o["pg"] != 0).sum()), "range": f"{dates[0]} → {dates[-1]}" if dates else ""}
    print(f"[returns] OK: {len(o)} don · " + " · ".join(f"{TYPES[i]} {cnt[i]}" for i in range(5)) +
          f" · income {len(E['o'])} dong (khong khop don: {orphan}) · thuc nhan {fmt(sum(E['n']))}d"
          f" · cho QT {totals['pending']} don ~{fmt(o['pn'].sum())}d")
    return {"types": TYPES, "dates": dates, "by": by, "reasons": reasons, "provs": provs, "chs": chs,
            "kocs": kocs, "prods": prods,
            "d": d, "t": [int(x) for x in o["t"]], "b": b, "rs": rs, "pv": pv, "pm": [int(x) for x in o["pay"]],
            "ch": ch, "kc": kc, "pr": pr,
            "ig": ints("ig"), "ir": ints("ir"), "if": ints("if"), "in": ints("in"), "cg": ints("cg"),
            "pg": ints("pg"), "pf": ints("pf"), "pn": ints("pn"), "pcg": ints("pcg"),
            "edates": edates, "e": E, "totals": totals}


def build_report(out_js=None):
    out = Path(out_js) if out_js else (config.WEB / "returns_data.js")
    payload = build_payload()
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") if payload else "null"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(f"window.QAMI_RETURNS = {data};\n", encoding="utf-8")
    return out


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print("->", build_report())


if __name__ == "__main__":
    main()
