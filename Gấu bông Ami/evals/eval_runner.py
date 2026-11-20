# -*- coding: utf-8 -*-
"""eval_runner — chấm logic LÕI của QAMI theo golden_dataset (Trụ 4: QA / Evals).

    python evals/eval_runner.py

Test ZONE Z04 (gộp bán + hoàn): gọi HÀM THẬT `aggregate_settled` trong python/merge.py,
so với expected cứng. 0 ảo giác. Chạy trước khi chốt ZONE DRAFT→LOCKED.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
QROOT = HERE.parent
sys.path.insert(0, str(QROOT / "python"))   # để import merge/config của QAMI
GOLDEN = HERE / "golden_dataset.json"


# ============================================================
# [ZONE EVAL · Gọi Z04 aggregate_settled]   Status: DRAFT
# In : {"rows": [[order_id, revenue], ...]}
# Out: {order_id: net_revenue} — cộng dồn theo đơn
# ============================================================
def run_case(inp):
    import pandas as pd
    from merge import aggregate_settled  # hàm THẬT của QAMI (Z04)
    df = pd.DataFrame(inp["rows"], columns=["ID đơn hàng/điều chỉnh", "revenue"])
    out = aggregate_settled(df)
    return {str(r["ID đơn hàng/điều chỉnh"]): int(r["revenue"]) for _, r in out.iterrows()}


def equal(got, expected):
    return got == expected


def main():
    cases = json.loads(GOLDEN.read_text(encoding="utf-8")) if GOLDEN.exists() else []
    cases = [c for c in cases if not any(str(v).startswith("__comment") for v in c.get("input", {}).values())]
    if not cases:
        print("⚠ Chưa có golden_dataset.json có nội dung.")
        return
    passed = fails = 0
    for c in cases:
        try:
            got = run_case(c["input"])
            ok = equal(got, c["expected"])
        except Exception as e:
            ok, got = False, f"ERROR: {e}"
        passed += ok
        fails += (not ok)
        mark = "✓" if ok else "✘"
        print(f"  {mark} {c['id']} · {c.get('desc', '')}")
        if not ok:
            print(f"       expected: {c['expected']}")
            print(f"       got     : {got}")
    total = passed + fails
    print(f"\nEVAL Z04: {passed}/{total} đúng ({100 * passed // max(total, 1)}%) · {fails} sai")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
