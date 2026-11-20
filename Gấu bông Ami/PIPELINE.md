# PIPELINE — Data pipeline TikTok Shop (qami · dùng chung cho các shop clone)

> Lineage + input/output + hợp đồng dữ liệu của **pipeline xử lý data** (chưa gồm lớp G-Analyst/DB).
> Pipeline **BẤT KHẢ XÂM PHẠM**: không sửa `clean.py` / `merge.py` / `analyze.py` / `run_all.py` nếu không có lệnh rõ. Thấy số bất thường → sửa **INPUT**, không vá code.

## Chức năng chính
Biến **export thô TikTok Shop + cost thủ công** → **1 bảng P&L cấp đơn** (`cleaned/02_income_py.xlsx`) → **số tĩnh cho dashboard** (`web/data.js`). Chạy offline, số tái lập được.

## Lineage (nguồn → biến đổi → đích)

| # | File (hoạt động) | ĐỌC (input) | GHI (output) | Làm gì |
|---|---|---|---|---|
| 1 | `python/clean.py` | `rawdata/` income·orders·onhold | `cost/cost_list.xlsx` | Chuẩn hoá nguồn → liệt kê MỌI SKU, SKU mới tô vàng + gợi ý cost |
| 2 | ✋ **THỦ CÔNG (Chủ)** | `cost/cost_list.xlsx` | (ghi tay) | Nhập `Cost Original` **(SỐ ÂM)** cho dòng vàng |
| 3a | `python/merge.py` | income + onhold + orders + cost | `cleaned/02_income_py.xlsx` | Ghép 4 nguồn → bảng cấp đơn: COGS, gộp **phí 4 nhóm**, ROI, phân loại đơn, đối soát phí |
| 3b | `python/analyze.py` | `cleaned/02_income_py.xlsx` | `web/data.js` | Đóng gói cột rev/cogs/plat/koc/ads → `window.QAMI_DATA` |
| 3c | `python/video.py` | `rawdata/Video_Analysis…` (+Creatives) | `web/video_data.js` | KOC/video — NGOÀI pipeline COGS, thiếu file vẫn chạy |
| — | `python/run_all.py` | — | — | **Nhạc trưởng** chạy 3a→3b→3c. **KHÔNG đụng cost** |

## Luồng thư mục
```
rawdata/*.xlsx ──clean──► cost/cost_list.xlsx ──[Chủ nhập cost ÂM]──┐
     │                                                              │
     └──────── run_all (clean→merge) ◄─────────────────────────────┘
                    ├─► cleaned/02_income_py.xlsx   ← SSOT cấp đơn (bảng vàng)
                    ├─► web/data.js        (analyze)
                    └─► web/video_data.js  (video)   ─► web/index.html (dashboard)
```

## Hợp đồng INPUT (chỗ dễ lỗi — canh kỹ)

| Nguồn | BẮT BUỘC | Lỗi từng gặp |
|---|---|---|
| `rawdata/Tất cả đơn hàng.xlsx` (sheet `OrderSKUList`) | đủ **56 cột**, có `SKU ID · Seller SKU · Product Name · Variation · Quantity` | gven xuất thiếu → chỉ 1 cột "Order ID" ⇒ clean chết |
| `cost/cost_list.xlsx` cột `Cost Original` | **SỐ ÂM** (chi phí = khấu trừ; qami 100% âm) | điền dương → COGS lật dấu → lãi > doanh thu |
| `rawdata/income.xlsx` (sheet `Chi tiết đơn hàng`) | phí lưu **ÂM** (quy ước TikTok) | — |
| orders ↔ income | **cùng kỳ** để khớp đơn ↔ doanh thu | đơn giao mà doanh thu=0 ⇒ nghi thiếu kỳ income |

## Chạy (chuỗi cố định)
```
python python/clean.py      # 1 · sinh cost_list (SKU mới tô vàng)
#   → mở cost/cost_list.xlsx, nhập Cost Original (ÂM), lưu     # 2 · THỦ CÔNG
python python/run_all.py    # 3 · clean→merge→analyze→video → web/data.js
#   → mở web/index.html
```

## Version (xem tag `pipeline-v*`)
| Version | Ngày | Nội dung |
|---|---|---|
| `pipeline-v1` | 2026-11-16 | Flow nghiệm thu: clean→merge→analyze→video. Bảng Video ROI thêm cột View/CTOR/Số đơn/Hoàn (giữ CTR). Lineage + hợp đồng input chốt. |

> Quản version: commit + tag `pipeline-vX` ở mốc nghiệm thu, push GitHub **private** (code+doc; data shield bởi `.gitignore`). Tái lập số version cũ (snapshot data) + UI lineage = giai đoạn sau. Nghiệp vụ RIÊNG shop ở `BLUEPRINT.md §8`.
