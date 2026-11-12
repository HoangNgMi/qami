# 01 · PROBLEM & ADOPTION — [Trụ 1: PM] + [Trụ 6: Adoption]
> Golden standard của workspace. Ngắn, thật, có số. Why-trước-How.

## Problem (Trụ 1 — PM / giải phẫu)
- **Nỗi đau thật:** Người bán TikTok Shop không biết LỜI/LỖ thật sau khi sàn trừ phí và sau khi khách hoàn đơn. Báo cáo sàn gộp lẫn bán + hoàn + nhiều loại phí → doanh thu nhìn thấy là "ảo", dễ lãi giả/lỗ thật. Đối soát tay trên Excel tốn hàng giờ mỗi kỳ.
- **Điểm nghẽn nghiệp vụ:** Một đơn phát sinh NHIỀU dòng (bán, rồi điều chỉnh/hoàn) cùng một mã. Nếu không gộp về NET theo đơn, tổng doanh thu bị phóng đại; cộng thẳng còn sinh doanh thu âm ảo ở đơn hoàn toàn phần.
- **In/Out của bài toán:** Vào = file income export của TikTok Shop (xlsx thô). Ra = bảng net lời/lỗ theo đơn + tổng hợp, đã trừ phí và gộp hoàn, số khớp đồng/đồng.

## Adoption (Trụ 6 — người dùng & bàn giao)
- **Người dùng cuối + hành vi:** Chủ shop / người vận hành. Chạy định kỳ theo kỳ chốt doanh thu, thao tác tối thiểu (đổ file → chạy → đọc dashboard `flow.html`).
- **ROI / thước đo thành công:** Thay thế buổi đối soát tay; con số ra khớp với quyết toán của sàn (đã bắt được sai lệch làm tròn ~1.377 VND ở ZONE Z10 — xem §8 BLUEPRINT).
- **Handoff:** README (song ngữ) + `flow.html` + BLUEPRINT §8; người không rành vẫn chạy đúng nhờ ZONE LOCKED + eval gác.
- **Distilled asset:** `aggregate_settled` (gộp bán+hoàn về net) là mẫu "settle theo khoá giao dịch" → ứng viên rút về `reusable-arsenal/`.
