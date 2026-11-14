-- silver.video — CONFORM từ bronze.video (per-video) + vài chỉ số dẫn xuất/video. IDEMPOTENT.
-- Nguồn cho lăng kính m2_koc (gốc Creator). KHÔNG trộn sổ profit (m1).
CREATE OR REPLACE VIEW silver.video AS
SELECT
  creator, video_id, title, post_date, link, product_id,
  gmv, commission, sold, orders, aov, ctr, completion, views,
  likes, comments, shares, prod_impressions, prod_clicks, gpm, refund, gross_rev,
  -- dẫn xuất/video (RULE công khai)
  round(gmv * 1000.0 / NULLIF(views, 0))                          AS gmv_per_1k_view,
  round(orders * 100.0 / NULLIF(prod_clicks, 0), 2)              AS cvr_click_pct,   -- click SP -> đơn
  round((likes + comments + shares) * 100.0 / NULLIF(views, 0), 2) AS engage_pct
FROM bronze.video;

COMMENT ON VIEW silver.video IS 'Conform cấp video từ bronze.video; nguồn cho m2_koc';
