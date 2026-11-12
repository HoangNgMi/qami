# QAMI — MASTER BLUEPRINT (Hiến pháp dự án)

- **Phiên bản:** 1.0 · **Trạng thái:** Đang vận hành
- **Mục đích cốt lõi (The Logos):** Cho **nhà bán TikTok Shop (SME)** thấy **lợi nhuận thật** từng sản phẩm/kênh/ngày — gom bán hàng + chi phí + hoa hồng + quảng cáo về **1 dashboard**, để quyết định đẩy gì / cắt gì.

> Nạp file này đầu mỗi phiên là hiểu toàn hệ. Bản đồ ZONE (từ hub): `python tools/zones.py ../Dev/TIKTOK/QAMI`.

---

## 1. HỢP ĐỒNG DỮ LIỆU & RANH GIỚI (Boundaries)
- **Đầu vào gốc (Raw):** 4 file Excel TikTok trong `rawdata/` (income = đã quyết toán · onhold = chưa quyết toán · Tất cả đơn hàng = chi tiết SKU · Manual = cost cũ) + `cost/cost_list.xlsx` (cost nhập tay).
- **Đầu ra cuối (Output):** `cleaned/02_income_py.xlsx` (bảng tập trung cấp đơn) → `web/data.js` → dashboard `web/index.html` deploy Vercel (có mật khẩu).
- **Giới hạn cứng (Hard Constraints):**
  - 💰 **Chi phí = 0đ** (file phẳng + Vercel Hobby + script thuần, không DB/thư viện nặng).
  - 🔒 **Số liệu thật KHÔNG lên git** (`data.js`, `rawdata`, `cleaned`, `cost` đều gitignore) — deploy qua CLI, site khoá Basic Auth.
  - 🧱 **2 runtime tách bạch:** Python (pipeline) ⟂ Web (hiển thị). Không trộn.

## 2. SƠ ĐỒ LUỒNG
```
rawdata/*.xlsx ──▶ [clean] ──▶ cost/cost_list.xlsx  (👤 nhập tay cost)
                                      │
rawdata + cost ──▶ [merge] ──▶ cleaned/02_income_py.xlsx  (bảng tập trung)
                                      │
                   [analyze] ──▶ web/data.js ──▶ web/index.html (dashboard)
                                      │
                   [check] ──▶ đối chiếu raw ↔ output (QA)
```

## 3. KIẾN TRÚC 4 TẦNG (áp xuyên 2 runtime)
| Tầng | Python (pipeline) | Web (dashboard) |
|------|-------------------|-----------------|
| **01 BLUEPRINT** | `BLUEPRINT.md` (file này) | — |
| **02 CONFIG** (chạm an toàn) | `python/config.py` | `web/config.js` (`window.CFG`) |
| **03 ENGINE** (lõi, bọc ZONE) | `clean.py · merge.py · analyze.py · check.py` | `web/app.js` |
| **04 INTERFACE** | — (xuất data.js) | `web/index.html · styles.css` |

## 4. BẢNG ĐIỀU KHIỂN THAM SỐ (sửa luật chơi — KHÔNG đụng engine)
- **`python/config.py`:** đường dẫn · tên file/sheet · `COST_GROUPS` (gom phí) · `FAMILY_KEYWORDS`/`SIZE_RULES` (gợi ý cost).
- **`web/config.js`:** `T` (palette) · `COSTL` · `defaultDays` (30) · `compareDefault` (ON) · `mobileBreak`.

## 5. ZONE INDEX (bản đồ mổ xẻ — từ hub: `python tools/zones.py ../Dev/TIKTOK/QAMI`)
**merge.py** (lõi nghiệp vụ): Z01 Đọc cost · Z02 Gắn COGS/SKU · Z03 Onhold→đơn · **Z04 Gộp đơn trùng (bán+hoàn)** 🔒 · Z05 Nối Đã/Chưa+COGS · Z06 Gom phí 4 nhóm 🔒 · Z07 Chọn cột+enrich · **Z08 Chỉ số/ROI** ✏️DRAFT · Z09 Loại đơn+hậu kỳ · **Z10 Đối soát phí** ✏️DRAFT
**clean.py:** Z01 Đọc nguồn · Z02 Engine gợi ý cost · Z03 Đẩy file cost
**analyze.py:** Z01 Đóng gói số liệu · Z02 Ghi data.js
**app.js:** W1 Tính · W2 Lọc riêng từng chart · W3 Tổng quan · W4 SP · W5 Kênh · W6 Thời gian · W7 Ghi chú
> 🔒 LOCKED = đã nghiệm thu, cấm sửa nếu không có lệnh. ✏️ DRAFT = đang chuẩn chỉnh.

## 6. BỘ CÔNG CỤ TỰ CHẠY + RUNBOOK (anh/chị tự kiểm soát, không gọi AI)

### RUNBOOK VÒNG CHẠY (Người ⇄ Máy)
| 👤 Việc Chủ dự án (Human Trigger) | 🤖 Máy làm (System Output) | 🎯 Heartbeat (đo mtime) |
|---|---|---|
| 1. Tải 4 Excel TikTok → `rawdata/` · 2. `python python/clean.py` → nhập cost vào `cost/cost_list.xlsx` · 3. `python python/run_all.py` | Gom bán + chi phí → bảng tập trung + số liệu dashboard | **In:** `rawdata/*.xlsx` · **Out:** `cleaned/02_income_py.xlsx`, `web/data.js` |

### Lệnh tự chạy
```
python python/clean.py      # 0. làm sạch → sinh cost_list (nhập cost tay)
python python/run_all.py    # 1-3. chạy tổng → cleaned + web/data.js
python python/check.py      # QA: đối chiếu raw↔output + bắt bất thường
cd web && npx vercel --prod # deploy (có Basic Auth)
```
> **Bản đồ ZONE + sơ đồ flow** quan sát TẬP TRUNG qua Control Center (Alex) — kit generic KHÔNG nằm trong dự án. Từ hub: `python tools/zones.py ../Dev/TIKTOK/QAMI` · `python tools/bridge.py --xray qami`.

## 7. LỰA CHỌN CÔNG CỤ / GIẢI PHÁP (khung ra quyết định)
| Việc | Dùng gì (nguyên tắc) |
|------|----------------------|
| Chân tay cơ học (đọc/ghi file, kiểm định dạng, đối chiếu số) | **Code thuần** (`check.py`) — 0đ, không ảo giác |
| Sơ chế khối lượng lớn (lọc rác, ẩn danh, format) | **AI nhỏ/Free** theo ZONE đã LOCKED (chưa dùng ở QAMI) |
| Thiết kế khung / sửa logic lõi / review | **AI mạnh** (phiên sâu, ít MCP/Skill gây nhiễu) |
| Tổng chỉ huy, trực giác nghiệp vụ, duyệt | **Bạn** |

**Khi nào tách thêm Agent?** Chỉ khi: (a) xung đột ngữ cảnh (sáng tạo vs soi lỗi), (b) chạy ngầm 24/7, (c) 1 ZONE phình tràn bộ nhớ. Ngoài ra: **1 Agent chạy tuần tự các ZONE là đủ**.

## 8. NHẬT KÝ TIẾN HÓA (tinh chất đã chưng cất)
- **Gộp đơn trùng = CỘNG DỒN, không "giữ latest".** TikTok ghi bán(+)/hoàn(−) thành dòng riêng → cộng dồn mới ra net đúng; giữ-latest tạo doanh thu âm ảo. *(Z04 merge.py)*
- **Cost ≈ hàm (dòng SP × size).** Dựng engine gợi ý cost để nhập tay nhanh, không sót SKU. *(Z02 clean.py)*
- **Bỏ dual-axis.** Tiền và số-đơn tách 2 chart riêng (chuẩn trực quan). *(W6 app.js)*
- **Deploy = CLI thủ công + TẮT "Vercel Authentication".** `data.js` gitignore → thêm `web/.vercelignore` để vẫn upload; Vercel "Deployment Protection" bật = chặn bằng SSO Vercel (trang "die") → phải tắt vì đã có Basic Auth riêng. *(web/)*
- **Mobile đọc không cần hover:** chart hiện sẵn số; màn hẹp tự thu khoảng ngày.
- **Còn nợ (DRAFT):** review ROI (Z08) · phí ngoài 4 nhóm ~1.377đ/đơn (Z10).
