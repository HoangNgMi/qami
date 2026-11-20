-- silver.fact_order — CONFORM từ bronze.orders_central: đặt tên chuẩn + đúng kiểu + is_settled + created_date.
-- KHÔNG tính lại Z04/Z06/Z09 (đã nằm trong bronze = output đã kiểm chứng của merge.py).
-- View = RULE truy vết được (G-Analyst / Traceable Numbers). IDEMPOTENT.
CREATE OR REPLACE VIEW silver.fact_order AS
SELECT
  id_on_hang_ieu_chinh                        AS order_id,          -- khóa đơn (unique, = key netting Z04)
  loai_giao_dich                              AS transaction_type,
  thoi_gian_tao_on_hang                       AS created_raw,
  CASE WHEN thoi_gian_tao_on_hang ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}'
       THEN to_date(thoi_gian_tao_on_hang, 'YYYY/MM/DD') END        AS created_date,
  trang_thai_quyet_toan                       AS settlement_status,
  (trang_thai_quyet_toan = 'Đã quyết toán')   AS is_settled,
  thoi_gian_quyet_toan_on_hang                AS settlement_timing, -- TEXT mô tả (vd "Delivered + 3 days") — KHÔNG phải ngày
  order_channel                               AS channel,
  loai_on                                     AS order_type,
  order_status, order_substatus, cancel_return_type,
  product_names, variations,
  total_quantity::int                         AS quantity,
  num_skus::int                               AS n_sku,
  -- ===== Tiền (VNĐ) — giữ nguyên giá trị merge.py =====
  tong_doanh_thu                              AS revenue_gross,
  tong_so_tien_quyet_toan                     AS settlement_amount,
  tong_phi                                    AS total_fee,
  cost_cogs, cost_platform, cost_koc, cost_ads,
  -- ===== Z08 derived (đã có sẵn trong file; sẽ CHỐT/kiểm ở m1 semantic S1.3) =====
  all_cost, net_margin, net_margin_pct,
  gross_roi, roas, marketing_spend, marketing_roi, net_roi,
  cogs_pct, platform_pct, koc_pct, ads_pct,
  has_ads, has_koc, is_profitable, is_cancelled
FROM bronze.orders_central;

COMMENT ON VIEW silver.fact_order IS 'Conform cấp đơn từ bronze (1 dòng=1 đơn); nguồn cho semantic m1/m2';
