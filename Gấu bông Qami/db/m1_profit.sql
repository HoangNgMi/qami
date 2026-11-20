-- m1_profit — SEMANTIC lăng kính LỢI NHUẬN (Traceable Numbers). Nguồn: silver.fact_order.
-- 5 nhóm phí: COGS · platform · koc · ads · OTHER. net_profit = revenue - (COGS + |Tổng phí|).
--   fee_other = |Tổng phí| - (platform+koc+ads) = phần phí CHƯA phân loại (nhóm riêng, nghiên cứu sau).
-- Chi phí nguồn lưu ÂM -> dùng |.|. IDEMPOTENT (drop cascade; billing.sql chạy SAU tái tạo vw_billing).
DROP VIEW IF EXISTS m1_profit.vw_order CASCADE;

CREATE VIEW m1_profit.vw_order AS
WITH base AS (
  SELECT *,
         abs(total_fee) - (abs(cost_platform) + abs(cost_koc) + abs(cost_ads)) AS fee_other_calc
  FROM silver.fact_order
)
SELECT
  order_id, created_date, channel, order_type, is_settled, settlement_status,
  revenue_gross, settlement_amount,
  abs(cost_cogs)                              AS cogs,
  abs(cost_platform)                          AS fee_platform,
  abs(cost_koc)                               AS fee_koc,
  abs(cost_ads)                               AS fee_ads,
  fee_other_calc                              AS fee_other,      -- phí chưa phân loại (gác lại)
  all_cost + fee_other_calc                   AS total_cost,     -- = COGS + |Tổng phí|
  revenue_gross - (all_cost + fee_other_calc)                AS net_profit,
  round((revenue_gross - (all_cost + fee_other_calc)) * 100.0 / NULLIF(revenue_gross, 0), 2) AS margin_pct,
  abs(total_fee)                              AS fee_total_tiktok,
  roas, has_ads, has_koc, is_cancelled
FROM base;

CREATE OR REPLACE VIEW m1_profit.vw_kpi AS
SELECT count(*) AS orders, sum(revenue_gross) AS revenue,
       sum(total_cost) AS total_cost, sum(net_profit) AS net_profit,
       round(sum(net_profit) * 100.0 / NULLIF(sum(revenue_gross), 0), 2) AS margin_pct,
       count(*) FILTER (WHERE net_profit > 0) AS orders_profitable
FROM m1_profit.vw_order WHERE is_settled;

CREATE OR REPLACE VIEW m1_profit.vw_cost_mix AS
SELECT sum(cogs) AS cogs, sum(fee_platform) AS platform, sum(fee_koc) AS koc,
       sum(fee_ads) AS ads, sum(fee_other) AS other, sum(total_cost) AS total_cost
FROM m1_profit.vw_order WHERE is_settled;

CREATE OR REPLACE VIEW m1_profit.vw_by_day AS
SELECT created_date AS day, count(*) AS orders, sum(revenue_gross) AS revenue,
       sum(net_profit) AS net_profit,
       round(sum(net_profit) * 100.0 / NULLIF(sum(revenue_gross), 0), 2) AS margin_pct
FROM m1_profit.vw_order WHERE is_settled AND created_date IS NOT NULL
GROUP BY created_date ORDER BY created_date;

CREATE OR REPLACE VIEW m1_profit.vw_by_channel AS
SELECT coalesce(channel, '(unknown)') AS channel, count(*) AS orders, sum(revenue_gross) AS revenue,
       sum(net_profit) AS net_profit,
       round(sum(net_profit) * 100.0 / NULLIF(sum(revenue_gross), 0), 2) AS margin_pct
FROM m1_profit.vw_order WHERE is_settled GROUP BY 1 ORDER BY revenue DESC;

COMMENT ON VIEW m1_profit.vw_order IS 'Lợi nhuận cấp đơn; 5 nhóm phí COGS/platform/koc/ads/other; net=revenue-total_cost';
