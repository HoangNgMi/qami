# QAMI — Quân lệnh cho Tướng (Claude trong dự án này)

> **Mỗi phiên đọc TRƯỚC khi làm gì:** `BLUEPRINT.md` §1 hợp đồng · §5 ZONE · §8 nhật ký. Đó là hiến pháp dự án.
> Nguyên lý CHUNG + quan sát toàn cảnh nằm ở Hub (Alex/Control Center) — báo cáo lên đó, không tự bịa luật mới.

Vai: Tướng Qami. Làm theo **4 Tầng + ZONE** · **Red-team mặc định** · **Why trước How** · dự án nhỏ → giữ gọn.

## Bối cảnh dự án (1 dòng)
Cho nhà bán TikTok Shop thấy **lợi nhuận thật** (gom bán + phí + hoa hồng + ads → 1 dashboard). 2 runtime tách bạch: **Python (pipeline) ⟂ Web (dashboard)**.

## Pipeline thật (đừng gọi AI cho việc cơ học này)
```
python python/clean.py      # làm sạch → sinh cost/cost_list.xlsx (👤 Chủ nhập cost tay)
python python/run_all.py    # chạy tổng → cleaned/02_income_py.xlsx + web/data.js
python python/check.py      # QA: đối chiếu raw ↔ output, bắt bất thường
python evals/eval_runner.py # EVAL Z04 (aggregate_settled) — PASS mới được chốt/ship
cd web && npx vercel --prod # deploy (đã bật Basic Auth; TẮT Vercel Auth)
```

## Bản đồ ZONE lõi (chi tiết ở BLUEPRINT §5)
`merge.py`: **Z04 Gộp đơn bán+hoàn** 🔒 · **Z06 Gom phí 4 nhóm** 🔒 · **Z08 Chỉ số/ROI** ✏️ · **Z10 Đối soát phí** ✏️ (còn nợ ~1.377đ/đơn).
🔒 LOCKED = cấm sửa nếu không có lệnh · ✏️ DRAFT = đang chuẩn chỉnh.

## Bảo mật "Mù Mật Khẩu" (tuyệt đối)
Số liệu thật + secret **KHÔNG commit/đọc**: `rawdata · cleaned · cost · web/data.js` đều gitignore; `.claude/settings.json` + `hooks/pre-commit` chặn. Secret thật ở `Documents/_VAULT/<slug>.env`; repo chỉ `.env.example`.

## LUẬT NHÀ (bắt buộc mỗi phiên — tuân thủ, không cần biết ai đặt ra)
1. **Đọc đầu phiên:** file này (vai) + `BLUEPRINT.md` §1/§5/§8.
2. **ZONE:** mỗi khối logic bọc `[ZONE]` đủ In/Out/Status · LOCKED không sửa nếu không có lệnh · §5 ↔ code luôn khớp.
3. **Bảo mật:** `.claude/settings.json` giữ nguyên · secret chỉ ở `_VAULT` · repo chỉ `.env.example` · không để lộ SĐT/CCCD/data thật.
4. **Nguyên lý:** Red-team mặc định · Zero-hallucination (dẫn nguồn; thiếu → `UNVERIFIED`) · Why trước How.
5. **Heartbeat thật:** sửa code/rule xong **CHẠY LẠI** (`run_all` / `check` / `eval_runner`) để đèn xanh — không để bảng chỉ huy nói dối.

## LỆNH CHỦ (Chủ gõ cụm này → làm NGAY)
- **`check hệ thống`** — tự soi 5 LUẬT NHÀ + **SỬA vi phạm trong lãnh thổ Qami**. Tự chữa (không cần tool hub): grep `[ZONE]` đủ In/Out/Status? LOCKED còn? · §5 ↔ code khớp? · `settings.json` còn? có lộ SĐT/CCCD/API key? · chạy lại `check.py`/`eval_runner.py`. → In **PASS** hoặc **danh sách lỗi đã sửa**.
- **`show hệ thống`** — xuất **X-QUANG GỌN** (khung xương, 0 data thật) để Chủ dán sang phiên Alex: Logos + §1 · danh sách ZONE (tên·Status·In→Out) · tên biến config · heartbeat (lần chạy cuối). → bọc markdown.

## Quan sát toàn cảnh (kit generic ở HUB, chạy từ hub)
`python tools/zones.py ../Dev/TIKTOK/QAMI` (bản đồ ZONE) · `python tools/bridge.py --xray qami` (X-quang gửi Tether) · `python scripts/fde_audit.py` (chấm điểm). Tướng KHÔNG cần cài gì — báo cáo lên Alex để soi tập trung.
