# -*- coding: utf-8 -*-
"""02 CONFIG (flow) — MANIFEST luồng của QAMI cho sơ đồ động TỰ SINH.
Chỉ MÔ TẢ, KHÔNG logic. `flow.py` đọc file này + quét [ZONE] sống trong code → xuất flow.html.

Sửa LUỒNG (node/cạnh/lời kể ai-làm-gì) ở đây.
Chi tiết ZONE (In/Out/Status, số LOCKED/DRAFT) KHÔNG ghi tay — flow.py tự lấy từ code qua trường 'scan'.
"""

TITLE = "QAMI — Sơ đồ động (TỰ SINH từ ZONE)"

RAILS = {
    "left":   "01 Hiến pháp · 02 Config",
    "center": "Luồng dữ liệu chính (03 Engine → 04 Interface)",
    "right":  "Công cụ bạn tự chạy",
}

# owner: you | ai | code | art | mix | pot   ·   scan: tên file engine để tự quét ZONE sống
# ghost=True → thuộc lớp "tiềm năng" (ẩn, bật bằng nút)   ·   gate=True → cổng người (nhấn mạnh)
STAGES = [
    # ---- cột trái: hiến pháp + config ----
    {"id": "blueprint", "col": "left", "owner": "mix", "title": "📜 BLUEPRINT.md",
     "ownt": "🤖+👤 Hiến pháp", "st": "01 BLUEPRINT", "io": "luật 4 tầng + ZONE",
     "in": "— (chốt từ đầu)", "out": "Luật chơi: mục đích, ranh giới, bản đồ ZONE",
     "you": "Chốt mục đích & ranh giới cứng; nạp đầu mỗi phiên để hiểu toàn hệ",
     "ai": "Tuân thủ; ghi Nhật ký tiến hoá mỗi khi rút ra nguyên lý mới"},
    {"id": "configpy", "col": "left", "owner": "you", "title": "🎛️ python/config.py",
     "ownt": "👤 BẠN chỉnh", "st": "02 CONFIG", "io": "paths · COST_GROUPS · từ khoá",
     "in": "Bạn gõ số/tham số", "out": "Tham số cho engine Python đọc",
     "you": "Đổi NHÓM PHÍ, đường dẫn, từ khoá gợi ý cost — không đụng code lõi",
     "ai": "Chỉ ĐỌC từ đây, cấm hardcode trong engine"},
    {"id": "configjs", "col": "left", "owner": "you", "title": "🎛️ web/config.js",
     "ownt": "👤 BẠN chỉnh", "st": "02 CONFIG", "io": "màu · mặc định 30 ngày/SS",
     "in": "Bạn gõ màu/mặc định", "out": "CFG cho dashboard đọc",
     "you": "Đổi tông màu (T), số ngày mặc định, bật/tắt so sánh",
     "ai": "Đọc qua window.CFG; logic chart không chứa màu cứng"},
    {"id": "pgenesis", "col": "left", "owner": "pot", "ghost": True, "title": "🧬 genesis.py → dự án khác",
     "ownt": "⚡ Tiềm năng", "st": "Tái dùng khung", "io": "nhân khung sang PJ mới",
     "in": "1 lệnh + tên dự án", "out": "Khung 4 tầng cho Pháp lý / Sách / BĐS…",
     "you": 'Từ hub (Control Center): python genesis.py "Tên" --full py|web',
     "ai": "Dùng lại các ZONE đã LOCKED như Lego giữa các dự án"},

    # ---- cột giữa: luồng chính ----
    {"id": "raw", "col": "center", "owner": "art", "title": "📦 rawdata/*.xlsx",
     "ownt": "👤 Bạn tải", "st": "Nguồn", "io": "4 file Excel TikTok",
     "in": "Export từ TikTok Seller", "out": "income · onhold · đơn hàng · manual (BẤT BIẾN)",
     "you": "Tải file từ TikTok, bỏ vào rawdata/ (không sửa tay)", "ai": "—"},
    {"id": "clean", "col": "center", "owner": "code", "scan": "clean.py", "title": "🧹 clean.py",
     "ownt": "⚙️ Code (AI viết)", "st": "03 ENGINE", "io": "rawdata → cost_list",
     "in": "rawdata/*.xlsx", "out": "cost/cost_list.xlsx (mọi SKU + GỢI Ý cost, tô vàng ô thiếu)",
     "you": "Chạy: python python/clean.py", "ai": "Engine gợi ý cost theo (dòng SP × size); không sót SKU"},
    {"id": "cost", "col": "center", "owner": "you", "gate": True, "title": "✍️ cost_list.xlsx",
     "ownt": "👤 BẠN LÀM — cổng người", "st": "Human-in-the-loop", "io": "nhập cost gốc tay",
     "in": "Danh sách SKU + cột Gợi ý Cost", "out": "Cost gốc đã xác nhận",
     "you": "NHẬP cost cho dòng vàng (liếc cột gợi ý rồi dán), lưu lại — đây là khâu người quyết định",
     "ai": "Chỉ GỢI Ý + tô vàng; KHÔNG tự điền (bạn duyệt bằng mắt)"},
    {"id": "merge", "col": "center", "owner": "code", "scan": "merge.py", "title": "🔗 merge.py",
     "ownt": "⚙️ Code (AI viết)", "st": "03 ENGINE", "io": "raw + cost → bảng tập trung",
     "in": "rawdata + cost_list", "out": "cleaned/02_income_py.xlsx (cấp đơn)",
     "you": "Chạy (qua run_all); duyệt khi chốt ZONE DRAFT",
     "ai": "Gộp bán+hoàn · COGS · gom phí 4 nhóm · ROI · đối soát phí"},
    {"id": "cleaned", "col": "center", "owner": "art", "title": "🗃️ 02_income_py.xlsx",
     "ownt": "📄 Dữ liệu", "st": "Bảng tập trung", "io": "nguồn DUY NHẤT",
     "in": "Từ merge", "out": "Nguồn chuẩn cho mọi phân tích (và Power BI nếu cần)",
     "you": "— (có thể mở xem/PBI)", "ai": "—"},
    {"id": "analyze", "col": "center", "owner": "code", "scan": "analyze.py", "title": "📊 analyze.py",
     "ownt": "⚙️ Code (AI viết)", "st": "03 ENGINE", "io": "cleaned → data.js",
     "in": "cleaned/02_income_py.xlsx", "out": "web/data.js (số liệu nhúng, KHÔNG đụng UI)",
     "you": "Chạy (qua run_all)", "ai": "Đóng gói số liệu theo cột cho web"},
    {"id": "web", "col": "center", "owner": "mix", "scan": "app.js", "title": "🖥️ web/ dashboard",
     "ownt": "🤖 viết · 👤 chỉnh", "st": "04 INTERFACE", "io": "data.js + config.js → chart",
     "in": "data.js (số) + config.js (màu)", "out": "Dashboard 4 tab, lọc riêng từng chart",
     "you": "Chỉnh config.js; duyệt UI; yêu cầu sửa chart theo ZONE Wx",
     "ai": "Viết app.js (ZONE W1–W7) + index.html/styles.css"},
    {"id": "deploy", "col": "center", "owner": "you", "title": "🚀 Vercel + Basic Auth",
     "ownt": "👤 BẠN deploy", "st": "Giao hàng (riêng tư)", "io": "web/ → link có mật khẩu",
     "in": "Thư mục web/", "out": "Link .vercel.app khoá mật khẩu nội bộ",
     "you": "cd web && npx vercel --prod; đặt BASIC_AUTH_USER/PASS",
     "ai": "Viết middleware.js khoá toàn site (kể cả data.js)"},

    # ---- cột phải: công cụ tự chạy ----
    {"id": "zones", "col": "right", "owner": "you", "title": "🗺️ bản đồ ZONE (từ hub)",
     "ownt": "👤 BẠN chạy", "st": "Công cụ (hub)", "io": "in bản đồ ZONE",
     "in": "Quét code mọi ngôn ngữ (zonescan)", "out": "Danh sách ZONE + trạng thái 🔒/✏️",
     "you": "Từ hub: python tools/zones.py ../Dev/TIKTOK/QAMI (kit chạy tập trung qua Alex)", "ai": "—"},
    {"id": "runall", "col": "right", "owner": "you", "title": "▶️ run_all.py",
     "ownt": "👤 BẠN chạy", "st": "Điều phối", "io": "chạy tổng pipeline",
     "in": "raw + cost", "out": "clean→merge→analyze 1 lệnh → cleaned + data.js",
     "you": "1 lệnh chạy toàn pipeline sau khi nhập cost", "ai": "—"},
    {"id": "check", "col": "right", "owner": "you", "scan": "check.py", "title": "✅ check.py",
     "ownt": "👤 BẠN chạy", "st": "QA tự động", "io": "đối chiếu raw↔output",
     "in": "raw + cleaned + cost", "out": "Bảng đối chiếu + bắt bất thường (không ảo giác)",
     "you": "Chạy để tự kiểm số đúng/sai — không cần gọi AI", "ai": "—"},
    {"id": "ptriage", "col": "right", "owner": "pot", "ghost": True, "title": "🤖 AI nhỏ: Triage (ZONE 0)",
     "ownt": "⚡ Tiềm năng", "st": "Sơ chế rẻ", "io": "lọc rác / ẩn danh",
     "in": "Khối dữ liệu lớn hoặc nhạy cảm", "out": "Dữ liệu sạch tinh chất cho engine",
     "you": "Bật khi raw quá lớn hoặc cần ẩn danh trên máy",
     "ai": "AI free/local chạy theo ZONE đã LOCKED (0đ), đỡ gánh cho AI mạnh"},
    {"id": "pdraft", "col": "right", "owner": "pot", "ghost": True, "title": "🔒 Hoàn tất Z08/Z10",
     "ownt": "⚡ Tiềm năng", "st": "Nội dung còn nợ", "io": "DRAFT → LOCKED",
     "in": "Review ROI + phí ngoài 4 nhóm", "out": "2 ZONE chuyển LOCKED (số chuẩn hơn)",
     "you": "Chốt công thức ROI; rà loại phí còn thiếu", "ai": "Chuẩn chỉnh logic, thêm phòng vệ, test"},
    {"id": "pcron", "col": "right", "owner": "pot", "ghost": True, "title": "⏰ Bot cron 24/7",
     "ownt": "⚡ Tiềm năng", "st": "Agent chạy ngầm", "io": "tự refresh định kỳ",
     "in": "Lịch chạy", "out": "Tự run_all + bắn thông báo (Telegram…)",
     "you": "Khi muốn dashboard tự cập nhật, khỏi chạy tay", "ai": "Agent độc lập chạy ngầm"},
    {"id": "pjudge", "col": "right", "owner": "pot", "ghost": True, "title": "⚖️ AI thẩm định ngữ nghĩa",
     "ownt": "⚡ Tiềm năng", "st": "Kiểm chất lượng", "io": "review có chủ đích",
     "in": "CHỈ Output cuối + Tiêu chuẩn gốc", "out": "ĐẠT / chỉ ra chỗ sai",
     "you": "Bật khi cần soi rủi ro ngữ nghĩa (vd báo cáo gửi khách)",
     "ai": "Agent phán xử độc lập, không xem quá trình trước (tránh lối mòn)"},
]

# [from, to, kind]  kind: flow | feed | tool | ghost
EDGES = [
    ["raw", "clean", "flow"], ["clean", "cost", "flow"], ["cost", "merge", "flow"],
    ["raw", "merge", "flow"], ["merge", "cleaned", "flow"], ["cleaned", "analyze", "flow"],
    ["analyze", "web", "flow"], ["web", "deploy", "flow"],
    ["configpy", "clean", "feed"], ["configpy", "merge", "feed"], ["configjs", "web", "feed"],
    ["runall", "merge", "tool"], ["check", "cleaned", "tool"], ["zones", "merge", "tool"],
    ["ptriage", "clean", "ghost"], ["pdraft", "merge", "ghost"], ["pcron", "runall", "ghost"],
    ["pjudge", "web", "ghost"], ["pgenesis", "blueprint", "ghost"],
]

# thứ tự "▶ Chạy luồng"
PLAY = ["raw", "clean", "cost", "merge", "cleaned", "analyze", "web", "deploy"]

# ============================================================
# RUNBOOK VÒNG CHẠY + HEARTBEAT (Người ⇄ Máy) — COMMAND_CENTER.html đọc ở đây để đo mtime
# ============================================================
RUNBOOK = {
    "human": [
        "Tải 4 file Excel TikTok (income · onhold · đơn · manual) → bỏ vào rawdata/",
        "python python/clean.py → mở cost/cost_list.xlsx nhập cost (dòng vàng), lưu",
        "python python/run_all.py",
    ],
    "system": "cleaned/02_income_py.xlsx + web/data.js → dashboard (deploy Vercel, Basic Auth)",
}
HEARTBEAT = {
    "inputs": ["rawdata/*.xlsx"],
    "outputs": ["cleaned/02_income_py.xlsx", "web/data.js"],
}
