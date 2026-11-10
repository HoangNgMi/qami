// ============================================================
// 02_CONFIG (web) — THAM SỐ GIAO DIỆN (chạm an toàn, KHÔNG logic)
// Màu sắc, nhãn, mặc định hiển thị. Engine (app.js) chỉ ĐỌC từ window.CFG.
// Đổi tông màu / mặc định chỉ sửa ở đây, không đụng app.js.
// ============================================================
window.CFG = {
  defaultDays: 30,        // khoảng ngày mặc định (slider)
  compareDefault: true,   // bật "So sánh cùng kỳ" mặc định
  mobileBreak: 760,       // ngưỡng px chuyển layout mobile
  labelStepMax: 12,       // khung >45 ngày thì nhãn tiền hiện cách đều ~12 mốc

  // Palette chart (đã qua validator accessibility) + màu chrome nền kem
  T: {
    surface: "#fffdf8", ink: "#1a1611", ink2: "#5f584a", muted: "#938a78",
    grid: "#ece4d4", axis: "#dcd2bd",
    cost: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"], // COGS, Platform, Ads, KOC
    roi: ["#2a78d6", "#eb6834", "#1baf7a"],             // Net ROI, ROAS, Gross ROI
    good: "#0f9d58", crit: "#cf3b3b",
    rev: "#1a1611", margin: "#0f9d58", violet: "#2a78d6", orange: "#df7a2a",
  },
  COSTL: ["COGS", "Platform", "Ads", "KOC"],
};
