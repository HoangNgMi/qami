# -*- coding: utf-8 -*-
"""
02_CONFIG — TẦNG THAM SỐ (chạm an toàn, KHÔNG chứa logic tính toán).

Mọi thứ hay phải chỉnh khi vận hành gom hết về đây: đường dẫn, tên file/sheet,
cách gom nhóm chi phí, bộ từ khoá nhận diện sản phẩm/size.
Engine (clean / merge / analyze) chỉ ĐỌC từ file này — sửa luật chơi chỉ sửa ở đây.
"""
from pathlib import Path

# ---------- Đường dẫn (data tiers) ----------
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "rawdata"                                 # 4 file raw — BẤT BIẾN
COST_FILE = ROOT / "cost" / "cost_list.xlsx"           # file cost MỚI — nhập tay
OLD_MANUAL = RAW / "Manual_List SKU_Cost.xlsx"         # file Manual cũ (seed cost lần đầu)
CLEANED = ROOT / "cleaned" / "02_income_py.xlsx"       # bảng tập trung (output pipeline)
WEB = ROOT / "web"                                     # thư mục site (deploy Vercel)
DATA_JS = WEB / "data.js"                              # số liệu cho web (pipeline CHỈ ghi file này)
REPORT = WEB / "index.html"                            # trang để mở/xem

# ---------- Tên file & sheet nguồn ----------
FILES = {
    "income": "income.xlsx",
    "orders": "Tất cả đơn hàng.xlsx",
    "onhold": "Onhold-unsettled-orders.xlsx",
}
SHEETS = {"income": "Chi tiết đơn hàng", "orders": "OrderSKUList", "cost_list": "cost_list"}

# ---------- Nguồn VIDEO/KOC (tab web "Video và KOC") — NGOÀI pipeline COGS ----------
# Tuỳ chọn: thiếu file/cột thì pipeline VẪN chạy (chỉ bỏ qua tab video).
VIDEO_FILE = "Video_Analysis_Video_List.xlsx"
# File THEO THÁNG (2026-11-25): Video_Analysis_Video_List_YYYYMM.xlsx — mỗi file = video CÓ HOẠT ĐỘNG trong
# tháng đó, số liệu CỦA RIÊNG tháng đó (1 video có thể nằm ở nhiều tháng → cộng theo video là đúng).
# Có ≥1 file tháng thì ĐỌC TẤT CẢ file tháng và BỎ QUA VIDEO_FILE gộp (khung cũ dễ sai/cắt hẹp).
VIDEO_MONTHLY = r"^Video_Analysis_Video_List_(\d{6})\.xlsx$"
VIDEO_SHEET = "Sheet 1"
VIDEO_COLS = {            # trái = tên code dùng · phải = tên cột THẬT trong file
    "user":   "Tên nhà sáng tạo",            # KOC / nhà sáng tạo
    "date":   "Ngày đăng",
    "video":  "ID video",
    "link":   "Link video",
    "gmv":    "GMV đến từ video liên kết",   # GMV affiliate quy cho video
    "comm":   "Hoa hồng ước tính",
    "sold":   "Số món bán ra ghi nhận vào video",
    "orders": "Đơn hàng nhờ video",
    "ctr":    "CTR",            # chỉ DỰ PHÒNG — CTR tự tính = clicks ÷ imps (file tháng 11 TikTok đã bỏ cột này)
    "imps":   "Lượt hiển thị sản phẩm trong video",   # mẫu số CTR (đúng định nghĩa TikTok)
    "comp":   "Tỷ lệ xem hết",
    "views":  "Lượt xem video",
    "clicks": "Lượt nhấp vào sản phẩm trong video",   # mẫu số CTOR = số đơn / số click
    "refund": "Số món đã hoàn tiền",                   # số MÓN hoàn tiền (file ko có số ĐƠN hoàn)
}
VIDEO_TOP_KOC = 15        # số KOC ở bảng xếp hạng
VIDEO_HEAT_KOC = 28       # (không dùng nữa — web tự top 20)
VIDEO_SCATTER = 200       # (cũ)

# ---------- Nguồn Creatives: lấy "Doanh thu gộp" CẤP VIDEO (join bằng ID video) ----------
# Video_Analysis KHÔNG có "Doanh thu gộp" → lấy từ đây. Thiếu file/cột → cột đó = 0.
CREATIVE_FILE = "Creatives video data.xlsx"
CREATIVE_SHEET = "Sheet1"
CREATIVE_COLS = {"video": "ID video", "rev": "Doanh thu gộp"}

# ---------- Phân nhóm chi phí 4 loại (THÊM/BỚT cột phí khi TikTok đổi tên) ----------
COST_GROUPS = {
    "platform": [
        "Phí giao dịch", "Phí hoa hồng của TikTok Shop", "Phí xử lý đơn hàng",
        "Phí dịch vụ SFP", "Phí dịch vụ SFR", "Phí dịch vụ Voucher Xtra",
        "Phí dịch vụ Ưu đãi đặc biệt trên LIVE", "Phí vận chuyển của người bán",
    ],
    "koc": ["Hoa hồng liên kết", "Hoa hồng liên kết Quảng cáo cửa hàng"],
    "ads": ["Phí quảng cáo GMV Max", "Phí nguồn lực chiến dịch"],
}

# ---------- Engine gợi ý cost: từ khoá DÒNG sản phẩm (thêm dòng mới ở đây) ----------
FAMILY_KEYWORDS = {
    "cá lóc": ["ca loc", "caloc", "ca-loc"], "cá heo": ["ca heo", "caheo"],
    "bánh mỳ": ["banh my", "banh-my", "banh mi"], "ôm đầu thú": ["om dau thu"],
    "báo hồng": ["bao hong"], "trái chuối": ["trai chuoi", "chuoi"],
    "trái bơ": ["trai bo"], "pikachu": ["pikachu"], "mèo mướp": ["meo muop"],
    "chai dầu gió": ["dau gio", "chai dau"],
}
# Quy tắc bóc SIZE (xét trước), rồi tới các size dạng Ncm
SIZE_RULES = [
    (r"1\s*m\s*5|1m50|150\s*cm|1\.5\s*m", "150cm"), (r"1\s*m\s*3|130\s*cm", "130cm"),
    (r"2\s*m(?![0-9])|200\s*cm", "200cm"), (r"1\s*m(?![0-9])|100\s*cm", "100cm"),
]
SIZE_CM = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10]
