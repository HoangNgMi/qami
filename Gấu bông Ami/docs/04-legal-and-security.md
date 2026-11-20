# 04 · LEGAL & SECURITY — [Trụ 4: Governance] · CHECKLIST trước deploy
> Nguồn: `ssot-registry/01-global-guardrails.md` + dự án `LEGAL/02_STRUCTURED_RULES/` (tra theo `rule_id`).

## Checklist (tick hết mới deploy)
- [ ] **PII (`DP-001`/`AI-002`):** form/DB có SĐT·CCCD·email·tài chính? → ẩn danh/mask TRƯỚC khi lưu hệ chung hoặc gửi API AI ngoại.
- [ ] **Nền tảng (`EC-003`):** có giỏ hàng thanh toán / cho bên thứ 3 đăng bán? → ranh giới Sàn TMĐT (giấy phép). Giữ mức "Digital Catalog" nếu được.
- [ ] **UGC (`SN-004`):** cho user công khai đăng bài/bình luận/chat chéo? → bẫy MXH không phép. Đóng kín / feedback 1 chiều.
- [ ] **Dòng tiền (`FIN-005`):** thu hộ / chia hoa hồng qua tài khoản mình? → dùng VietQR trực tiếp vào TK đối tác; hệ thống KHÔNG chạm tiền.
- [ ] **Admin (`OPS-006`):** có audit-log? BYOD (CTV tự giữ DB)? server "nothing-to-lose"?
- [ ] **Khiên:** `.claude/settings.json` + `git config core.hooksPath hooks` đã bật. Secret ở `_VAULT/`. Repo chỉ `.env.example`.

## Rule áp dụng (ghi nhận)
| rule_id | risk | tech_guardrail đã làm (đưa về 🟢) |
|---|---|---|
| _( )_ | 🔴/🟡 | _( )_ |
