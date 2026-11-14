-- m2_koc — SEMANTIC lăng kính KOC (gốc Creator). Nguồn: silver.video. Traceable. TÁCH SỔ khỏi m1.
-- CTR/CVR tính từ đếm thô (chuẩn hơn avg %/video); completion = trung bình theo views. IDEMPOTENT.

-- ===== Scorecard / KOC =====
CREATE OR REPLACE VIEW m2_koc.vw_koc AS
SELECT
  creator,
  count(*)                                                        AS videos,
  min(post_date)                                                  AS first_post,
  max(post_date)                                                  AS last_post,
  sum(gmv)                                                        AS gmv,
  round(sum(gmv)::numeric / NULLIF(count(*), 0))                  AS gmv_per_video,
  sum(commission)                                                AS commission,
  sum(sold)                                                      AS sold,
  sum(orders)                                                    AS orders,
  sum(views)                                                     AS views,
  sum(gross_rev)                                                AS gross_rev,
  round(sum(prod_clicks) * 100.0 / NULLIF(sum(prod_impressions), 0), 2) AS ctr_pct,    -- click/hiển thị
  round(sum(orders) * 100.0 / NULLIF(sum(prod_clicks), 0), 2)           AS cvr_pct,    -- đơn/click
  round(sum(completion * views)::numeric / NULLIF(sum(views), 0), 2)    AS completion_pct -- xem-hết (weighted)
FROM silver.video
WHERE creator IS NOT NULL
GROUP BY creator;

-- ===== KPI tổng KOC =====
CREATE OR REPLACE VIEW m2_koc.vw_kpi AS
SELECT count(DISTINCT creator) AS kocs, count(*) AS videos,
       sum(gmv) AS gmv, sum(commission) AS commission, sum(sold) AS sold
FROM silver.video WHERE creator IS NOT NULL;

-- ===== Coaching matrix (chẩn đoán để PM đào tạo; KOC >=2 video; so trung vị cohort) =====
CREATE OR REPLACE VIEW m2_koc.vw_coaching AS
WITH k AS (SELECT * FROM m2_koc.vw_koc WHERE videos >= 2),
     b AS (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY ctr_pct)        AS med_ctr,
                  percentile_cont(0.5) WITHIN GROUP (ORDER BY completion_pct) AS med_comp,
                  percentile_cont(0.5) WITHIN GROUP (ORDER BY cvr_pct)        AS med_cvr,
                  percentile_cont(0.5) WITHIN GROUP (ORDER BY views)          AS med_views
           FROM k)
SELECT k.creator, k.videos, k.gmv, k.views, k.ctr_pct, k.completion_pct, k.cvr_pct,
  CASE
    WHEN k.views >= b.med_views AND k.ctr_pct < b.med_ctr
         THEN 'View cao · CTR thấp → sửa CTA / gắn giỏ hàng'
    WHEN k.ctr_pct >= b.med_ctr AND k.completion_pct < b.med_comp
         THEN 'CTR tốt · xem-hết thấp → sửa hook 3s đầu + kịch bản'
    WHEN k.cvr_pct >= b.med_cvr AND k.views < b.med_views
         THEN 'CVR cao · view thấp → cấp sample chủ lực + đẩy ads'
    WHEN k.ctr_pct >= b.med_ctr AND k.completion_pct >= b.med_comp AND k.cvr_pct >= b.med_cvr
         THEN 'Toàn diện tốt → nhân bản nội dung + hàng chủ lực'
    ELSE 'Theo dõi thêm'
  END AS diagnosis
FROM k CROSS JOIN b;

-- ===== KOC × sản phẩm (affinity: KOC hợp dòng hàng nào) =====
CREATE OR REPLACE VIEW m2_koc.vw_affinity AS
SELECT creator, product_id,
       count(*) AS videos, sum(gmv) AS gmv, sum(sold) AS sold,
       row_number() OVER (PARTITION BY creator ORDER BY sum(gmv) DESC) AS rank_in_koc
FROM silver.video
WHERE creator IS NOT NULL AND product_id IS NOT NULL
GROUP BY creator, product_id;

COMMENT ON VIEW m2_koc.vw_koc IS 'Scorecard KOC (gốc Creator) — nền đào tạo/phân phối cho PM';
COMMENT ON VIEW m2_koc.vw_coaching IS 'Chẩn đoán điểm yếu KOC so trung vị cohort (để PM coach)';
COMMENT ON VIEW m2_koc.vw_affinity IS 'KOC hợp dòng sản phẩm nào (rank theo GMV)';
