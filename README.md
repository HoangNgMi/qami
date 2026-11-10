# TIKTOK QAMI — Phân tích lời/lỗ Gấu Bông

<!-- SHIP:START (auto by tools/ship.py — do not edit inside this block) -->
> **Cho nhà bán TikTok Shop (SME) thấy lợi nhuận thật từng sản phẩm/kênh/ngày — gom bán hàng + chi phí + hoa hồng + quảng cáo về 1 dashboard, để quyết định đẩy gì / cắt gì.**
>
> 🧩 **Architecture / Kiến trúc:** 4-Tier + `[ZONE]`  ·  **Progress / Tiến độ:** 21 🔒 LOCKED / 2 ✏️ DRAFT  ·  **Flow:** [flow.html](flow.html)
> <sub>🔒 LOCKED = reviewed & frozen · ✏️ DRAFT = in progress</sub>

> **Latest insights / Bài học mới nhất (§8):**
> - Bỏ dual-axis. Tiền và số-đơn tách 2 chart riêng (chuẩn trực quan). *(W6 app.js)*
> - Mobile đọc không cần hover: chart hiện sẵn số; màn hẹp tự thu khoảng ngày.
> - Còn nợ (DRAFT): review ROI (Z08) · phí ngoài 4 nhóm ~1.377đ/đơn (Z10).

> _Living repo · updated 2026-11-10 · built in public._
<!-- SHIP:END -->

## 🌍 About (English)

**QAMI turns raw TikTok Shop exports into true per-product / per-channel / per-day profit** — merging sales, costs, commissions and ad spend into one dashboard, so a seller knows exactly *what to push and what to cut*.

**What makes it correct (not just pretty):**
- **Returned-order netting (`Z04`)** — TikTok logs a sale (+) and its refund (−) as *separate rows*; a naive "keep latest" shows phantom negative revenue. QAMI **aggregates** to the true net.
- **Fee reconciliation (`Z10`)** — a pure-code QA step surfaces ~1,377 VND/order of fees that fall *outside* the standard buckets and quietly eat margin.
- **Zero-cost, zero-leak stack** — flat files + plain Python + Vercel Hobby (no DB, no heavy libs); **real data never touches git** (blocked at commit time by the OS pre-commit shield).

**Architecture:** 4-Tier + `[ZONE]` — every logic block declares `In / Out / Status`. 🔒 LOCKED = reviewed & frozen · ✏️ DRAFT = in progress.

📖 **Deep dive →** [Case Study: Data Rigor × Zero-Leakage](https://github.com/HoangNgMi/principles/blob/main/showcase/CASE_STUDY_01_ZERO_LEAKAGE_DATA.md)

---

### 🇻🇳 Chi tiết (tiếng Việt)

Gom dữ liệu TikTok (đã + chưa quyết toán) → 1 bảng tập trung → dashboard web.
Tổ chức theo **4 Tầng + ZONE**. 👉 Hiểu toàn hệ trong 1 trang: **[`BLUEPRINT.md`](BLUEPRINT.md)**.

## Cài thư viện (1 lần)
Trong terminal VS Code (đúng Python mà nút ▶ Run đang chọn):
```
python -m pip install -r requirements.txt
```
> Nếu lỗi font tiếng Việt trên console: thêm `PYTHONUTF8=1` trước lệnh.

## Quy trình dùng
| Bước | Lệnh | Kết quả |
|------|------|---------|
| **0. Làm sạch** (chạy trước) | `python python/clean.py` | cập nhật `cost/cost_list.xlsx` — SKU mới tô **vàng** + cột **Gợi ý Cost** |
| **1. Nhập cost** (tay) | mở `cost/cost_list.xlsx` | điền `Cost Original` cho dòng vàng, **lưu** |
| **2. Chạy tổng** | `python python/run_all.py` | `cleaned/02_income_py.xlsx` + `web/data.js` → mở `web/index.html` |

## Kiến trúc 4 Tầng (chi tiết ở BLUEPRINT.md)
| Tầng | Python (pipeline) | Web (dashboard) |
|------|-------------------|-----------------|
| 01 BLUEPRINT | `BLUEPRINT.md` | — |
| 02 CONFIG *(tham số, chạm an toàn)* | `python/config.py` | `web/config.js` |
| 03 ENGINE *(lõi, bọc `[ZONE]`)* | `clean.py · merge.py · analyze.py · check.py` | `web/app.js` |
| 04 INTERFACE | — | `web/index.html · styles.css` |

- Sửa **luật chơi** (màu, nhóm phí, mặc định) → chỉ sửa tầng **CONFIG**, không đụng engine.
- Sửa **lõi** → mở đúng `[ZONE]`, giữ In/Out. Vùng 🔒 LOCKED cấm sửa nếu không có lệnh.

## Bộ công cụ tự chạy (không cần AI)
```
python python/clean.py     # làm sạch + sinh cost_list
python python/run_all.py   # chạy tổng → cleaned + web/data.js
python python/check.py     # QA: đối chiếu raw↔output + bắt bất thường
```
> **Bản đồ ZONE / sơ đồ flow:** quan sát TẬP TRUNG qua Control Center (Alex). Từ hub:
> `python tools/zones.py ../Dev/TIKTOK/QAMI` — kit generic không nằm trong dự án (một nguồn sự thật).

## Web & Deploy (riêng tư)
- `web/index.html#clients` = dashboard; mobile hiện sẵn số (không cần hover).
- Deploy **bằng CLI** (không git — vì `data.js` số thật đã gitignore):
```
cd web && npx vercel --prod
```
- **Bảo mật:** `web/middleware.js` khoá Basic Auth. Đặt `BASIC_AUTH_USER/PASS` trong Vercel Env → Redeploy. Chưa đặt = site tự khoá cứng.

## Khung tái dùng cho dự án mới
Khung 4 Tầng + ZONE + bộ công cụ nay nằm ở **Control Center** (OS chung), **không còn bản sao `_TEMPLATE/` trong dự án** (một nguồn sự thật, quản lý tập trung qua Alex). Tạo dự án mới — chạy từ hub:
```
python genesis.py "Tên dự án" --full py    # hoặc --full web
```

## Đang chờ xử (DRAFT)
- `merge.py` Z08 (ROI) · Z10 (đối soát phí — còn loại phí ngoài 4 nhóm). Bản đồ ZONE: `python tools/zones.py ../Dev/TIKTOK/QAMI` (từ hub).
