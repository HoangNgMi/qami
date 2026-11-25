/* ads_model.js — MÔ HÌNH quyết định Ads (THUẦN, tham số hoá, KHÔNG dính data).
   Chạy cả browser (window.AdsModel) lẫn node (module.exports). Ráp BẤT KỲ dataset vào.
   Dataset chuẩn: rows = [{ci, d:"YYYY-MM-DD", s:spend, g:gmv, o:orders}], names = [tên theo ci].
   Triết lý: quyết định bằng NGƯỠNG + ĐỦ MẪU, không cảm tính. net-ROI=0 là hoà vốn (KHÔNG phải 1). */
(function (root) {
  "use strict";

  var DEFAULTS = {
    margin: null,          // null = tự suy từ data (nếu có), fallback 0.2736
    marginFallback: 0.2736,
    minOrders: 30,         // đủ mẫu mới dám kết luận 1 campaign
    killBelowNr: 0.0,      // net-ROI < 0 (LỖ) sau đủ mẫu -> CẮT
    scaleAboveNr: 1.0,     // net-ROI >= 1 (lời ≥1đ/1đ ad) -> SCALE
    scaleStepPct: 0.20,    // guardrail: đổi ngân sách tối đa 20%/lần
    reallocFromPct: 0.20,  // dời tối đa 20% spend kém nhất
    marginalDiscount: 0.6, // $ dồn sang winner chỉ giữ 60% net-ROI (diminishing returns)
    weights: { roi: 0.45, mom: 0.25, scale: 0.15, cons: 0.15 },
    mde: 0.20, alpha: 0.05, power: 0.80   // test-sizing
  };

  function cfg(p) { var o = {}, k; for (k in DEFAULTS) o[k] = DEFAULTS[k]; for (k in (p || {})) o[k] = p[k]; return o; }

  function economics(margin) {
    var m = margin || DEFAULTS.marginFallback;
    return { margin: m, breakevenRoas: +(1 / m).toFixed(2) };
  }

  /* Quyết định 1 campaign theo trạng thái tích luỹ {spend, gmv, orders}. */
  function decide(cum, P) {
    P = cfg(P);
    var m = P.margin || P.marginFallback;
    var net = cum.gmv * m - cum.spend;
    var nr = cum.spend ? net / cum.spend : 0;
    if (cum.orders < P.minOrders)
      return { action: "HOLD", nr: nr, ready: false, reason: "chưa đủ mẫu (" + cum.orders + "/" + P.minOrders + " đơn)" };
    if (nr < P.killBelowNr)
      return { action: "CUT", nr: nr, ready: true, reason: "net-ROI " + nr.toFixed(2) + " < 0 (lỗ), đủ mẫu" };
    if (nr >= P.scaleAboveNr)
      return { action: "SCALE", nr: nr, ready: true, reason: "net-ROI " + nr.toFixed(2) + " ≥ " + P.scaleAboveNr };
    return { action: "HOLD", nr: nr, ready: true, reason: "lời mỏng (0 ≤ net-ROI " + nr.toFixed(2) + " < " + P.scaleAboveNr + ")" };
  }

  /* Quy mô test A/B (2-proportion z-test) — bao nhiêu click/đơn/tiền mỗi nhánh. */
  function testSize(o) {
    o = o || {};
    var p1 = o.cvrBase != null ? o.cvrBase : 0.115;
    var mde = o.mdeRel != null ? o.mdeRel : DEFAULTS.mde;
    var cpc = o.cpc != null ? o.cpc : 1103;
    var za = o.z_alpha != null ? o.z_alpha : 1.96, zb = o.z_power != null ? o.z_power : 0.84;
    var p2 = p1 * (1 + mde), d = p2 - p1;
    if (d <= 0) return null;
    var nClick = Math.ceil((za + zb) * (za + zb) * (p1 * (1 - p1) + p2 * (1 - p2)) / (d * d));
    return {
      cvrBase: p1, cvrTarget: +p2.toFixed(4), mdeRel: mde,
      clicksPerArm: nClick, convPerArm: Math.round(nClick * p1),
      spendPerArm: Math.round(nClick * cpc), spendTotal2arm: Math.round(nClick * cpc * 2)
    };
  }

  /* Gộp rows -> campaigns {name, spend, gmv, orders, net, nr} (toàn kỳ). */
  function rollup(rows, names, m) {
    var by = {}, i, r;
    for (i = 0; i < rows.length; i++) {
      r = rows[i]; if (!(r.s > 0)) continue;
      var c = by[r.ci] || (by[r.ci] = { ci: r.ci, spend: 0, gmv: 0, orders: 0 });
      c.spend += r.s; c.gmv += r.g; c.orders += r.o;
    }
    return Object.keys(by).map(function (ci) {
      var c = by[ci], net = c.gmv * m - c.spend;
      c.name = names ? names[ci] : String(ci); c.net = net; c.nr = c.spend ? net / c.spend : 0;
      return c;
    });
  }

  /* BACKTEST: ráp chuỗi campaign×ngày -> replay quyết định -> net mô-hình vs thực tế.
     Mô hình CẮT campaign tại ngày rule kích hoạt (đủ mẫu + lỗ) -> bỏ spend phần đuôi;
     spend giải phóng dồn sang winner ở net-ROI biên (có chiết khấu diminishing). */
  function backtest(rows, names, P) {
    P = cfg(P);
    // margin: ưu tiên P.margin, else fallback
    var m = P.margin || P.marginFallback;
    // group by ci, sort theo ngày
    var ser = {}, i, r;
    for (i = 0; i < rows.length; i++) {
      r = rows[i]; if (!(r.s > 0)) continue;
      (ser[r.ci] || (ser[r.ci] = [])).push(r);
    }
    Object.keys(ser).forEach(function (ci) { ser[ci].sort(function (a, b) { return a.d < b.d ? -1 : 1; }); });

    var actualNet = 0, actualSpend = 0, modelNet = 0, freed = 0, decisions = [];
    Object.keys(ser).forEach(function (ci) {
      var s = ser[ci], cs = 0, cg = 0, co = 0, cutIdx = -1;
      for (i = 0; i < s.length; i++) {
        cs += s[i].s; cg += s[i].g; co += s[i].o;
        if (cutIdx < 0) {
          var dec = decide({ spend: cs, gmv: cg, orders: co }, P);
          if (dec.action === "CUT") cutIdx = i;
        }
      }
      var totS = s.reduce(function (a, b) { return a + b.s; }, 0);
      var totG = s.reduce(function (a, b) { return a + b.g; }, 0);
      var totO = s.reduce(function (a, b) { return a + b.o; }, 0);
      var fullNet = totG * m - totS;
      actualNet += fullNet; actualSpend += totS;
      var finalNr = totS ? fullNet / totS : 0;
      // mô hình chỉ CẮT nếu campaign KẾT THÚC là lỗ (net<0) — tránh cắt nhầm winner
      if (cutIdx >= 0 && fullNet < 0) {
        var head = s.slice(0, cutIdx + 1);
        var hS = head.reduce(function (a, b) { return a + b.s; }, 0);
        var hG = head.reduce(function (a, b) { return a + b.g; }, 0);
        modelNet += hG * m - hS;
        freed += totS - hS;
        decisions.push({ name: names ? names[ci] : ci, action: "CUT", cutDay: s[cutIdx].d,
          spendSaved: Math.round(totS - hS), lossAvoided: Math.round(-(fullNet - (hG * m - hS))) });
      } else {
        modelNet += fullNet;
        decisions.push({ name: names ? names[ci] : ci, action: decide({ spend: totS, gmv: totG, orders: totO }, P).action,
          nr: +finalNr.toFixed(2) });
      }
    });

    // reallocation: dồn freed sang net-ROI biên (weighted nr của SCALE camps × discount)
    var camps = rollup(rows, names, m);
    var scalers = camps.filter(function (c) { return c.nr >= P.scaleAboveNr; });
    var wNr = scalers.length ? scalers.reduce(function (a, b) { return a + b.net; }, 0) / scalers.reduce(function (a, b) { return a + b.spend; }, 0) : 0;
    var reallocGain = freed * wNr * P.marginalDiscount;
    modelNet += reallocGain;

    // ÔPPORTUNITY phân bổ (riêng, có caveat): trần (mọi $ = best) + thực tế (dời 20% kém -> top-quartile)
    var sortByNr = camps.slice().sort(function (a, b) { return b.nr - a.nr; });
    var bestNr = sortByNr.length ? sortByNr[0].nr : 0;
    var ceil = actualSpend * bestNr;
    var asc = camps.slice().sort(function (a, b) { return a.nr - b.nr; });
    var cut = actualSpend * P.reallocFromPct, moved = 0, lostNr = 0, j = 0;
    while (moved < cut && j < asc.length) { var take = Math.min(asc[j].spend, cut - moved); lostNr += take * asc[j].nr; moved += take; j++; }
    var topQ = sortByNr.slice(0, Math.max(1, Math.ceil(camps.length / 4)));
    var topNr = topQ.reduce(function (a, b) { return a + b.net; }, 0) / topQ.reduce(function (a, b) { return a + b.spend; }, 0);
    var realloc20 = moved * topNr - lostNr;

    return {
      margin: m, breakevenRoas: +(1 / m).toFixed(2),
      actualSpend: Math.round(actualSpend), actualNet: Math.round(actualNet), actualNr: +(actualNet / actualSpend).toFixed(2),
      modelNet: Math.round(modelNet), freedSpend: Math.round(freed), reallocGain: Math.round(reallocGain),
      improvement: Math.round(modelNet - actualNet), improvementPct: +((modelNet - actualNet) / actualNet * 100).toFixed(2),
      decisions: decisions,
      opportunity: {
        ceilingNet: Math.round(ceil), ceilingPct: +((ceil - actualNet) / actualNet * 100).toFixed(1),
        realistic20Net: Math.round(realloc20), realistic20Pct: +(realloc20 / actualNet * 100).toFixed(1),
        note: "Trần = lý thuyết (bỏ qua diminishing). Thực tế = dời " + Math.round(P.reallocFromPct * 100) + "% spend kém sang top-quartile."
      }
    };
  }

  var API = { DEFAULTS: DEFAULTS, cfg: cfg, economics: economics, decide: decide, testSize: testSize, rollup: rollup, backtest: backtest };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (root) root.AdsModel = API;
})(typeof window !== "undefined" ? window : null);
