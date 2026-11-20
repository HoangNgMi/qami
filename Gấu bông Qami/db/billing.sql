-- billing.sql — công nợ Agency 3 flow (config-as-data + SQL view, Traceable). Nguồn: m1_profit.vw_kpi.
-- IDEMPOTENT. Cấu hình điền qua db/case_config.py -> seed_billing.py -> bảng billing_config.

CREATE TABLE IF NOT EXISTS m1_profit.billing_config (
  slug          text PRIMARY KEY,
  name          text,
  flow          int,            -- 1 | 2 | 3
  hard_fee_vnd  bigint  DEFAULT 0,
  threshold_vnd bigint  DEFAULT 0,
  pct_over      numeric DEFAULT 0,   -- % phần vượt ngưỡng (flow 1/3)
  pct_profit    numeric DEFAULT 0,   -- % trên tổng lợi nhuận (flow 2/3)
  period_label  text,
  updated_at    timestamptz DEFAULT now()
);

CREATE OR REPLACE VIEW m1_profit.vw_billing AS
WITH k   AS (SELECT net_profit, revenue, orders FROM m1_profit.vw_kpi),
     cfg AS (SELECT * FROM m1_profit.billing_config LIMIT 1)
SELECT
  cfg.name,
  cfg.flow,
  CASE cfg.flow WHEN 1 THEN 'Flow 1: phí cứng + % vượt ngưỡng'
                WHEN 2 THEN 'Flow 2: % lợi nhuận'
                WHEN 3 THEN 'Flow 3: hỗn hợp (cộng gộp)' END                 AS flow_label,
  k.orders, k.revenue, k.net_profit,
  cfg.hard_fee_vnd, cfg.threshold_vnd, cfg.pct_over, cfg.pct_profit,
  GREATEST(k.net_profit - cfg.threshold_vnd, 0)                              AS profit_over_threshold,
  -- RULE công nợ Agency:
  CASE cfg.flow
    WHEN 1 THEN cfg.hard_fee_vnd + round(GREATEST(k.net_profit - cfg.threshold_vnd, 0) * cfg.pct_over)
    WHEN 2 THEN round(k.net_profit * cfg.pct_profit)
    WHEN 3 THEN cfg.hard_fee_vnd
               + round(GREATEST(k.net_profit - cfg.threshold_vnd, 0) * cfg.pct_over)
               + round(k.net_profit * cfg.pct_profit)
  END::bigint                                                                AS agency_fee_vnd,
  cfg.period_label, cfg.updated_at
FROM cfg CROSS JOIN k;

COMMENT ON VIEW m1_profit.vw_billing IS 'Công nợ Agency theo flow hợp đồng (config: billing_config); nguồn net_profit từ vw_kpi';

-- ===== Billing THEO THÁNG (mỗi tháng đối chiếu P&L của đúng tháng đó với phí) =====
CREATE OR REPLACE VIEW m1_profit.vw_billing_monthly AS
WITH cfg AS (SELECT * FROM m1_profit.billing_config LIMIT 1),
     m AS (
       SELECT to_char(created_date, 'YYYY-MM') AS month,
              count(*) AS orders, sum(revenue_gross) AS revenue, sum(net_profit) AS net_profit
       FROM m1_profit.vw_order
       WHERE is_settled AND created_date IS NOT NULL
       GROUP BY 1)
SELECT m.month, m.orders, m.revenue, m.net_profit,
       (cfg.hard_fee_vnd
        + round(GREATEST(m.net_profit - cfg.threshold_vnd, 0) * cfg.pct_over)
        + round(m.net_profit * cfg.pct_profit))::bigint                              AS agency_fee,
       (m.net_profit
        - (cfg.hard_fee_vnd
           + round(GREATEST(m.net_profit - cfg.threshold_vnd, 0) * cfg.pct_over)
           + round(m.net_profit * cfg.pct_profit)))::bigint                          AS net_after_fee
FROM m CROSS JOIN cfg ORDER BY m.month;

-- ===== Billing TỔNG KỲ (phí = mức tháng × số tháng active) =====
CREATE OR REPLACE VIEW m1_profit.vw_billing_period AS
SELECT count(*)                 AS months_active,
       sum(orders)              AS orders,
       sum(revenue)             AS revenue,
       sum(net_profit)          AS net_profit,
       sum(agency_fee)          AS agency_fee_total,
       sum(net_after_fee)       AS net_after_fee_total
FROM m1_profit.vw_billing_monthly;

COMMENT ON VIEW m1_profit.vw_billing_period IS 'Công nợ tổng kỳ = mức/tháng × số tháng active; net_after_fee = net - phí agency';
