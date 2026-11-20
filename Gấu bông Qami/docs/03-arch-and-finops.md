# 03 · ARCHITECTURE & FINOPS — [Trụ 3: Dev] + [Trụ 5: Ops/FinOps]
> Stack mặc định: `ssot-registry/02-approved-stack.md` (lệch phải ghi lý do).

## Kiến trúc (Trụ 3 — Dev)
- **4 Tầng:** `01 BLUEPRINT` · `02 CONFIG` · `03 ENGINE` (bọc `[ZONE]`) · `04 INTERFACE`. Sơ đồ động: `flow.html`.
- **Stack dùng:** _(Python/SQLite/Sheets/Vercel/Next.js… — theo approved-stack)_
- **Luồng chính:** _(vài mũi tên: nguồn → xử lý → đầu ra; ai nhập tay ở đâu?)_

## FinOps & Ops (Trụ 5 — vận hành tự chịu lỗi)
- **Chi phí:** _(0đ? token tốn ở điểm nào?)_ · **Mock mode:** _(`LLM_MODE=mock` chạy end-to-end 0đ?)_
- **Fallback:** _(AI lỗi / thiếu key → đường lui tất định gì? không được gãy)_
- **Giám sát nhẹ:** _(heartbeat qua `ship.py` / `command_center` — đèn 🟢 cập nhật · 🟡 chờ chạy · 🔴 chưa có output)_
