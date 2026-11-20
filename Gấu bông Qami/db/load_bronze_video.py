# -*- coding: utf-8 -*-
"""load_bronze_video.py — S2.1: nạp Video_Analysis + Creatives (rawdata) -> bronze.video (per-video).
Parse tiền/%/đếm an toàn; ID đọc dạng text (chống mất số); join gross-rev từ Creatives qua ID video.
Idempotent (DROP+CREATE+INSERT). ĐỌC data thật qua subprocess; KHÔNG sửa file nguồn; DB local."""
import sys
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
_ROOT = HERE.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(_ROOT / "python"))
import pgconn      # noqa: E402
import config      # noqa: E402

TABLE = "bronze.video"


def _money(v):
    import pandas as pd
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v)
    neg = s.strip().startswith("-")
    d = re.sub(r"[^0-9]", "", s)
    if d == "":
        return None
    return -int(d) if neg else int(d)


def _date(v):
    import pandas as pd
    d = pd.to_datetime(v, errors="coerce")
    return d.date() if pd.notna(d) else None


def _pct(v):
    import pandas as pd
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v).strip()
    has = "%" in s
    num = re.sub(r"[^0-9,.\-]", "", s).replace(",", ".")
    if num in ("", "-", "."):
        return None
    try:
        f = float(num)
    except ValueError:
        return None
    if not has and f <= 1.0:
        f *= 100
    return round(f, 2)


def main():
    import pandas as pd
    vf = config.RAW / config.VIDEO_FILE
    cf = config.RAW / config.CREATIVE_FILE
    if not vf.exists():
        print(f"✘ Không thấy {vf}")
        return 1

    VC = config.VIDEO_COLS
    dfv = pd.read_excel(vf, sheet_name=config.VIDEO_SHEET,
                        dtype={VC["video"]: str, "ID sản phẩm": str})

    # gross-rev từ Creatives (join qua ID video)
    gross = {}
    if cf.exists():
        CC = config.CREATIVE_COLS
        dfc = pd.read_excel(cf, sheet_name=config.CREATIVE_SHEET, dtype={CC["video"]: str})
        for _, r in dfc.iterrows():
            vid = str(r.get(CC["video"]) or "").strip()
            if vid:
                gross[vid] = _money(r.get(CC["rev"]))

    def g(row, key):
        return row.get(VC[key])

    rows = []
    for _, r in dfv.iterrows():
        vid = str(g(r, "video") or "").strip()
        rows.append((
            (str(g(r, "user")).strip() if g(r, "user") is not None else None),  # creator
            vid or None,                                                          # video_id
            (str(r.get("Tiêu đề video")).strip() if r.get("Tiêu đề video") is not None else None),
            _date(g(r, "date")),                                                 # post_date
            (str(g(r, "link")).strip() if g(r, "link") is not None else None),
            (str(r.get("ID sản phẩm")).strip() if r.get("ID sản phẩm") is not None else None),
            _money(g(r, "gmv")), _money(g(r, "comm")),
            _money(r.get("Số món bán ra ghi nhận vào video")),
            _money(g(r, "orders")),
            _money(r.get("AOV")),
            _pct(g(r, "ctr")), _pct(g(r, "comp")),
            _money(g(r, "views")),
            _money(r.get("Lượt thích")), _money(r.get("Lượt bình luận")), _money(r.get("Lượt chia sẻ")),
            _money(r.get("Lượt hiển thị sản phẩm trong video")),
            _money(r.get("Lượt nhấp vào sản phẩm trong video")),
            _money(r.get("GPM video")), _money(r.get("Hoàn tiền")),
            gross.get(vid),                                                       # gross_rev
        ))

    cols = ["creator", "video_id", "title", "post_date", "link", "product_id",
            "gmv", "commission", "sold", "orders", "aov", "ctr", "completion", "views",
            "likes", "comments", "shares", "prod_impressions", "prod_clicks", "gpm", "refund", "gross_rev"]
    types = ["text", "text", "text", "date", "text", "text",
             "bigint", "bigint", "bigint", "bigint", "bigint", "numeric", "numeric", "bigint",
             "bigint", "bigint", "bigint", "bigint", "bigint", "bigint", "bigint", "bigint"]
    coldefs = ",\n  ".join(f'"{cols[i]}" {types[i]}' for i in range(len(cols)))
    collist = ",".join(f'"{x}"' for x in cols)
    ph = "(" + ",".join(["%s"] * len(cols)) + ")"

    with pgconn.connect() as c:
        c.execute(f"CREATE TABLE IF NOT EXISTS {TABLE} (\n  {coldefs}\n)")
        c.execute(f"TRUNCATE {TABLE}")   # refresh data, KHÔNG drop (view phụ thuộc không vỡ)
        with c.cursor() as cur:
            cur.executemany(f"INSERT INTO {TABLE} ({collist}) VALUES {ph}", rows)
        c.commit()
        got = c.execute(f"SELECT count(*) n FROM {TABLE}").fetchone()["n"]
        nkoc = c.execute(f"SELECT count(distinct creator) n FROM {TABLE}").fetchone()["n"]
        ngr = c.execute(f"SELECT count(*) n FROM {TABLE} WHERE gross_rev IS NOT NULL").fetchone()["n"]
    print(f"✓ {TABLE}: {got} video · {nkoc} KOC · gross_rev join {ngr}/{got}")
    return 0 if got == len(rows) else 1


if __name__ == "__main__":
    sys.exit(main())
