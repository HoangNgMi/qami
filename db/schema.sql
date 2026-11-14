-- qami — schema theo quy trình G-Analyst (Medallion) + lăng kính model. IDEMPOTENT.
-- S1.0: chỉ dựng KHUNG schema (rỗng). Bảng bronze/silver + views model vào các slice sau.
-- Tách sổ: mỗi mô hình 1 schema riêng — KHÔNG trộn Profit/KOC/GMV.

-- ===== Tầng dữ liệu (Medallion) =====
CREATE SCHEMA IF NOT EXISTS bronze;   -- raw landing (nạp từ cleaned/ + rawdata)
CREATE SCHEMA IF NOT EXISTS silver;   -- net Z04 + COGS + fee-bucket Z06 + classify Z09
CREATE SCHEMA IF NOT EXISTS gold;     -- aggregate business-ready

-- ===== Lăng kính semantic (ĐỢT NÀY: 2 mô hình đã có của qami) =====
CREATE SCHEMA IF NOT EXISTS m1_profit;  -- Net profit · Z08 ROI · Z10 phí ẩn · billing 3-flow
CREATE SCHEMA IF NOT EXISTS m2_koc;     -- KOC scorecard · coaching matrix · SKU-affinity (gốc Creator)

-- ===== RÀO LẠI (Chủ sẽ mở sau) — KHÔNG tạo ở đợt này =====
-- CREATE SCHEMA IF NOT EXISTS m3_gmv;       -- GMV/Video/Campaign (gốc Video_ID)
-- CREATE SCHEMA IF NOT EXISTS m4_research;  -- Deal-sim · SKU roles · benchmark

COMMENT ON SCHEMA bronze    IS 'raw landing (as-is từ cleaned/rawdata)';
COMMENT ON SCHEMA silver    IS 'cleaned + conformed: net order, COGS, fee bucket, classify';
COMMENT ON SCHEMA gold      IS 'business-ready aggregates';
COMMENT ON SCHEMA m1_profit IS 'semantic lăng kính Profit: P&L, ROI, fee-residual, billing';
COMMENT ON SCHEMA m2_koc    IS 'semantic lăng kính KOC: hiệu suất creator (không trộn sổ profit)';
