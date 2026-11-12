# 02 · ONTOLOGY & SSOT — [Trụ 2: Data]
> Chuẩn chung: `ssot-registry/00-master-ontology.md` (THAM CHIẾU, không định nghĩa lại).

## Nguồn dữ liệu (Raw)
- File income export của TikTok Shop (xlsx thô, tải từ sàn theo kỳ). Grain gốc: 1 dòng = 1 bản ghi giao dịch (bán HOẶC điều chỉnh/hoàn).

## Bảng fact trung tâm (1 nguồn sự thật của dự án)
- **Đường dẫn:** `cleaned/` (income đã làm sạch) — KHÔNG lên git (data thật, chặn bởi Khiên).
- **Grain:** 1 dòng = 1 giao dịch theo cột khoá `ID đơn hàng/điều chỉnh`. *Khai grain TRƯỚC khi tính; sai grain = sai mọi tổng.*

## Chỉ số GỐC (khai 1 lần — không lặp công thức ở nơi khác)
| Metric (snake_case) | Công thức gốc | ZONE định nghĩa |
|---|---|---|
| net_revenue | gộp mọi dòng cùng `ID đơn hàng/điều chỉnh` → cộng dồn revenue (bán + hoàn âm) | Z04 `aggregate_settled` (python/merge.py) |
| rounding_gap | sai lệch làm tròn giữa tổng tính và quyết toán sàn (~1.377 VND đã bắt) | Z10 |

## Rủi ro dữ liệu đã xử (bài học — Red-team)
- Gộp bán + hoàn về NET đúng theo đơn → chống doanh thu phóng đại và doanh thu âm ảo (đơn hoàn toàn phần về 0, không về âm).
- **Đối soát raw ↔ output:** `evals/eval_runner.py` gọi THẲNG `aggregate_settled` với golden cases cứng (code thuần, KHÔNG AI) — chạy trước mỗi lần chốt ZONE DRAFT→LOCKED và trước khi ship.
