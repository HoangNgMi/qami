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
