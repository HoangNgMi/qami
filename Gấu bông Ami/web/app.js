/* ===========================================================
   04_ENGINE (web) — zen.agency dashboard · logic UI
   Dữ liệu: data.js (window.QAMI_DATA) · Tham số/màu: config.js (window.CFG)
   Mỗi khối bọc [ZONE]. Sửa màu/mặc định -> config.js; sửa từng chart -> hàm draw*().
   =========================================================== */
const CFG = window.CFG || {};
const T = CFG.T;                 // palette & màu chrome (ở config.js)
const COSTL = CFG.COSTL;         // nhãn 4 nhóm chi phí

// Thiếu data.js → KHÔNG sập trang (SPEC rà soát UI §6.12): dữ liệu rỗng + tab Tổng quan báo rỗng (mountNoData)
const NO_DATA = !(window.QAMI_DATA && window.QAMI_DATA.date);
const DATA = NO_DATA ? {date:[],rev:[],cogs:[],plat:[],koc:[],ads:[],other:[],ch:[],set:[],prod:[],channels:[],settles:[],products:[]}
                     : window.QAMI_DATA;
const META = window.QAMI_META || {};
const VID = window.QAMI_VIDEO || null;     // nguồn Video/KOC (file riêng video_data.js)
const DATES = [...new Set(DATA.date.filter(Boolean))].sort();   // ngày duy nhất, tăng dần
// mặc định (LUẬT QA.md · Chủ chốt 2026-11-25): TỪ NGÀY 1 THÁNG HIỆN TẠI → ngày mới nhất có data.
// Data chưa sang tháng hiện tại (data cũ) → từ ngày 1 của THÁNG MỚI NHẤT có data (không để trống).
function _mtdDefault(){
  if(!DATES.length) return [0,0];
  var e=DATES.length-1, now=new Date(), pad=function(x){return (x<10?"0":"")+x;};
  var ym=now.getFullYear()+"-"+pad(now.getMonth()+1), last=String(DATES[e]).slice(0,7);
  if(last<ym) ym=last;
  var s=e; while(s>0 && String(DATES[s-1]).slice(0,7)>=ym) s--;
  return [s,e];
}
var _wk=_mtdDefault();   // [ngày 1 tháng hiện tại, ngày mới nhất] → mặc định của filter TỔNG (G, ở ZONE W2)

const el = id => document.getElementById(id);
const MOB = () => window.innerWidth < (CFG.mobileBreak || 760);
const charts = {};
function gc(id){ if(!charts[id]) charts[id]=echarts.init(el(id)); return charts[id]; }

function fV(n){ n=+n||0; const s=n<0?"-":""; const a=Math.abs(n);
  if(a>=1e9) return s+(a/1e9).toFixed(2)+" tỷ";
  if(a>=1e6) return s+(a/1e6).toFixed(1)+" tr";
  if(a>=1e3) return s+Math.round(a/1e3)+"k"; return s+Math.round(a); }
function fF(n){ return Math.round(+n||0).toLocaleString("vi-VN"); }
// nhãn TRỤC tiền gọn ("10tr", "1.2tỷ", "500k") — trục nằm ngang trên điện thoại không còn "10.0 tr20.0 tr" dính nhau
function fAx(n){ n=+n||0; const s=n<0?"-":"", a=Math.abs(n), d=x=>x<10&&x%1?x.toFixed(1):Math.round(x);
  if(a>=1e9) return s+d(a/1e9)+"tỷ"; if(a>=1e6) return s+d(a/1e6)+"tr"; if(a>=1e3) return s+Math.round(a/1e3)+"k"; return s+Math.round(a); }
function tip(x){ return Object.assign({backgroundColor:T.surface,borderColor:T.grid,
  textStyle:{color:T.ink},confine:true}, x||{}); }
function axc(){ return {color:T.muted,fontSize:MOB()?10:11}; }
function sl(){ return {lineStyle:{color:T.grid}}; }

/* [ZONE W0b · Bố cục chart đọc được trên laptop + điện thoại]  (SPEC rà soát UI 2026-11-25 · AC-02/03)
   lgTop  : legend ở ĐẦU chart + đo số DÒNG legend thật theo bề rộng khung → trả grid.top đủ chỗ
            (legend rớt 2–3 dòng trên mobile KHÔNG đè cột/đường/nhãn số). o.lbl = có nhãn số trên đỉnh · o.name = trục Y có tên.
   pieFit : donut co bán kính + nhãn bám mép khung trên mobile (không xén mép trái/phải).
   catLbl : nhãn trục danh mục tự xuống dòng theo bề rộng mỗi cột (không đè nhau). */
const _cv=document.createElement("canvas").getContext("2d");
function lgTop(id,names,o){ o=o||{};
  const m=MOB(), fs=m?11:12, iw=m?16:22, ih=m?10:12, gap=m?8:10;
  const W=Math.max(120,((el(id)&&el(id).clientWidth)||320)-10);
  _cv.font=fs+"px system-ui,-apple-system,'Segoe UI',sans-serif";
  let rows=1,x=0;
  names.forEach(n=>{ const w=iw+5+_cv.measureText(String(n)).width; if(x>0 && x+w>W){ rows++; x=0; } x+=w+gap; });
  const rowH=Math.max(ih,fs+4);
  return {rows, legend:{top:0,left:"center",itemWidth:iw,itemHeight:ih,itemGap:gap,textStyle:{color:T.ink2,fontSize:fs}},
          top:10+rows*rowH+(rows-1)*gap+(o.lbl?18:8)+(o.name?14:0)}; }
function pieFit(fmt){ const m=MOB();
  return m ? {radius:["34%","54%"],center:["50%","43%"],
              label:{color:T.ink,formatter:fmt,fontSize:10,lineHeight:12,alignTo:"edge",edgeDistance:4,minMargin:3,overflow:"break"},
              labelLine:{length:8,length2:6}}
           : {radius:["46%","70%"],center:["50%","45%"],label:{color:T.ink,formatter:fmt,fontSize:12},labelLine:{}}; }
function catLbl(id,n){ const W=((el(id)&&el(id).clientWidth)||320)-70;
  return Object.assign(axc(),{interval:0,width:Math.max(36,Math.floor(W/Math.max(1,n))-6),overflow:"break",lineHeight:MOB()?11:13}); }

/* ---------- HOME: chart mẫu (quảng cáo, data giả) ---------- */
function renderHome(){
  const xs=["T1","T2","T3","T4","T5","T6","T7","T8"];
  gc("hc1").setOption({
    tooltip:tip({trigger:"axis"}), grid:{left:46,right:18,top:18,bottom:28,containLabel:true},
    xAxis:{type:"category",data:xs,boundaryGap:false,axisLabel:axc(),axisLine:{lineStyle:{color:T.axis}}},
    yAxis:{type:"value",axisLabel:axc(),splitLine:sl()},
    series:[{type:"line",data:[120,180,160,240,300,280,420,560],smooth:true,symbol:"none",
      lineStyle:{width:3,color:T.orange},
      areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[
        {offset:0,color:"rgba(223,122,42,.26)"},{offset:1,color:"rgba(223,122,42,0)"}])}}]
  });
  const pf=pieFit("{b} {d}%");
  gc("hc2").setOption({
    tooltip:tip({trigger:"item"}), legend:{bottom:0,textStyle:{color:T.ink2}}, color:T.cost,
    series:[Object.assign({type:"pie",itemStyle:{borderColor:T.surface,borderWidth:3},
      data:[{name:"COGS",value:58},{name:"Platform",value:18},{name:"Ads",value:14},{name:"KOC",value:10}]},pf)]
  }, true);
}

/* [ZONE W0 · Khử độc đầu vào — Untrusted Boundary]  Status: LOCKED
   In : chuỗi do NGƯỜI NGOÀI đặt (tên KOC, tên kênh, link video — lấy từ sàn)
   Out: chuỗi an toàn để ghép vào innerHTML / thuộc tính HTML
   Vì sao: tên KOC do chính creator tự đặt. Ghép thẳng vào innerHTML hoặc vào
   title="..." là chạy được script trong trình duyệt người xem.
   Luật gốc: PRINCIPLES.md §Bảo mật · fde-blueprint-template/AGENT_PROTOCOL.md §A1 */
const esc = function (s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};
/* esc() KHÔNG đủ cho href: "javascript:alert(1)" không chứa dấu nháy nên lọt nguyên.
   Link phải lọc theo scheme. */
const safeUrl = function (u) {
  const s = String(u == null ? '' : u).trim();
  return /^https?:\/\//i.test(s) ? esc(s) : '';
};

/* [ZONE W1 · Gom nhóm & tính (compute / computeRange / metrics)]  Status: LOCKED */
function grp(){ return {r:0,c:0,p:0,k:0,a:0,o:0,n:0}; }
function add(g,r,c,p,k,a,o){ g.r+=r;g.c+=c;g.p+=p;g.k+=k;g.a+=a;g.o+=(o||0);g.n++; }
function ac(g){ return g.c+g.p+g.k+g.a+g.o; }
function computeRange(s,e,fc,fs){   // fc/fs = kênh/trạng thái của bộ lọc (tổng hoặc riêng chart)
  const D=DATA; fc=fc||"all"; fs=fs||"all";
  const lo=DATES[s], hi=DATES[e];
  const tot=grp(), bc={}, bp={}, bs={}, bd={}; const days=new Set();
  for(let i=0;i<D.rev.length;i++){
    if(fc!=="all" && D.channels[D.ch[i]]!==fc) continue;
    if(fs!=="all" && D.settles[D.set[i]]!==fs) continue;
    const d=D.date[i]; if(!d || d<lo || d>hi) continue;          // chỉ trong khoảng ngày
    const r=D.rev[i],c=D.cogs[i],p=D.plat[i],k=D.koc[i],a=D.ads[i],o=(D.other&&D.other[i])||0;
    add(tot,r,c,p,k,a,o);
    const cn=D.channels[D.ch[i]]; add(bc[cn]=bc[cn]||grp(),r,c,p,k,a,o);
    const pn=D.products[D.prod[i]]; add(bp[pn]=bp[pn]||grp(),r,c,p,k,a,o);
    const sn=D.settles[D.set[i]]; add(bs[sn]=bs[sn]||grp(),r,c,p,k,a,o);
    days.add(d); add(bd[d]=bd[d]||grp(),r,c,p,k,a,o);
  }
  return {tot,bc,bp,bs,bd,nd:days.size};
}
function compute(f){ return computeRange(f.dS,f.dE,f.ch,f.set); }
function metrics(A){ const t=A.tot,cost=ac(t); return {rev:t.r,cost:cost,margin:t.r-cost,
  orders:t.n, aov:t.n?t.r/t.n:0, opd:A.nd?t.n/A.nd:0}; }

/* [ZONE W2 · Bộ lọc TỔNG (G) → mặc định cho bộ lọc RIÊNG từng chart (L)]  Status: DRAFT
   Luật (giống tab Chiến dịch): đổi filter TỔNG → MỌI chart chạy theo (L[id] = bản sao G).
   Đổi filter RIÊNG (nút ⚙ trên chart) → CHỈ chart đó. Nút ⚙ hiện ● khi chart đang khác filter tổng.
   Một bộ lọc f = {dS,dE: chỉ số trong DATES · ch: kênh · set: trạng thái quyết toán · cmp: so kỳ trước} */
const NLAST=Math.max(0,DATES.length-1);
const G={dS:_wk[0], dE:_wk[1], ch:"all", set:"all", cmp:CFG.compareDefault!==false};
const L={};
function cloneF(f){ return {dS:f.dS,dE:f.dE,ch:f.ch,set:f.set,cmp:f.cmp}; }
function sameF(a,b){ return a.dS===b.dS&&a.dE===b.dE&&a.ch===b.ch&&a.set===b.set&&a.cmp===b.cmp; }
function F(id){ return L[id]||(L[id]=cloneF(G)); }
function prevOf(f){ const len=f.dE-f.dS+1, pe=f.dS-1;   // kỳ trước = cùng số ngày-có-đơn, ngay trước, cùng kênh/trạng thái
  return pe>=0?computeRange(Math.max(0,f.dS-len),pe,f.ch,f.set):null; }
function badge(id,A,pA){ const sp=document.querySelector(`[data-ccmp="${id}"]`); if(!sp) return;
  if(!pA){ sp.textContent=""; return; }
  const p=Math.abs(pA.tot.r)||1, dp=(A.tot.r-pA.tot.r)/p*100, up=dp>=0;
  sp.innerHTML=`<span class="${up?'pos':'neg'}">${up?'▲':'▼'} ${Math.abs(dp).toFixed(0)}% DT vs kỳ trước</span>`; }

/* [ZONE W3 · Tổng quan: KPI + Donut + điều phối]  Status: LOCKED */
function drawKPIs(A,prev){
  const m=metrics(A), pm=prev?metrics(prev):null;
  function dl(cur,prv,goodUp){ if(!pm) return null; const base=Math.abs(prv)||1;
    const dp=(cur-prv)/base*100, up=dp>=0;
    return {t:(up?"▲":"▼")+" "+Math.abs(dp).toFixed(0)+"% vs kỳ trước", c:(goodUp?up:!up)?"pos":"neg"}; }
  const mp=m.rev? m.margin/m.rev*100:0;
  const K=[
    {l:"Doanh thu",v:fV(m.rev),d:dl(m.rev,pm&&pm.rev,true),def:fF(m.rev)+" đ"},
    {l:"Tổng chi phí",v:fV(m.cost),d:dl(m.cost,pm&&pm.cost,false),def:fF(m.cost)+" đ"},
    {l:"Lợi nhuận ròng",v:fV(m.margin),vc:(m.margin>=0?"pos":"neg"),d:dl(m.margin,pm&&pm.margin,true),def:(mp>=0?"+":"")+mp.toFixed(1)+"%"},
    {l:"Số đơn",v:fF(m.orders),d:dl(m.orders,pm&&pm.orders,true),def:A.nd+" ngày"},
    {l:"GT/đơn",v:fV(m.aov),d:dl(m.aov,pm&&pm.aov,true),def:"mỗi đơn"},
    {l:"Đơn/ngày",v:m.opd.toFixed(0),d:dl(m.opd,pm&&pm.opd,true),def:"trung bình"},
  ];
  el("kpis").innerHTML=K.map(k=>{ const s=k.d?`<div class="s ${k.d.c}">${k.d.t}</div>`:`<div class="s ${k.vc||''}">${k.def}</div>`;
    return `<div class="kpi"><div class="l">${k.l}</div><div class="v ${k.vc||''}">${k.v}</div>${s}</div>`; }).join("");
}
function drawDonut(){
  const f=F("ovCost"), A=compute(f), t=A.tot;
  badge("ovCost",A, f.cmp?prevOf(f):null);
  gc("ovCost").setOption({
    tooltip:tip({trigger:"item",valueFormatter:v=>fF(v)+" đ"}),
    legend:{bottom:0,textStyle:{color:T.ink2,fontSize:MOB()?11:12},itemGap:MOB()?8:10}, color:T.cost,
    series:[Object.assign({type:"pie",avoidLabelOverlap:true,
      itemStyle:{borderColor:T.surface,borderWidth:2},
      // COSTL = [COGS, Platform, Ads, KOC, Phụ trội] ↔ g.c, g.p, g.a(=ads), g.k(=koc), g.o
      // (2026-11-25 sửa: trước đây truyền [c,p,k,a] → nhãn Ads hiện số KOC và ngược lại)
      data:COSTL.map((n,i)=>({name:n,value:[t.c,t.p,t.a,t.k,t.o][i]}))}, pieFit("{b}\n{d}%"))]
  }, true);
}
function rOverview(){   // KPI + ghi chú luôn theo filter TỔNG
  const A=compute(G); drawKPIs(A, G.cmp?prevOf(G):null); renderNote(A);
}

/* [ZONE W7 · Ghi chú nổi bật (tự điền + Sửa)]  Status: LOCKED */
const NOTE_KEY = "qami_note";
function ddmm(s){ const p=(s||"").split("-"); return p.length===3?(p[2]+"/"+p[1]):s; }
function autoNote(A){
  const t=A.tot, cost=ac(t), m=t.r-cost, mp=t.r?Math.round(m/t.r*100):0;
  let peak={d:"",r:-1,n:0}; for(const d in A.bd){ if(A.bd[d].r>peak.r) peak={d,r:A.bd[d].r,n:A.bd[d].n}; }
  let topc="", topr=-1; for(const c in A.bc){ if(A.bc[c].r>topr){topr=A.bc[c].r; topc=c;} }
  const opd=A.nd?Math.round(t.n/A.nd):0;
  return (
    `🚀 <b>${A.nd} ngày gần đây</b>, shop gom về <b>${fV(t.r)}</b> doanh thu — `+
    `lãi ròng <b class="pos">${fV(m)}</b> (biên <b>${mp}%</b>). Ngon!<br><br>`+
    `💥 Ngày đỉnh <b>${ddmm(peak.d)}</b> một mình kéo <b>${fV(peak.r)}</b> với <b>${fF(peak.n)} đơn</b> — `+
    `một cú nổ đáng nhớ.<br><br>`+
    `⚡ Trung bình <b>${opd} đơn/ngày</b>, kênh <b>${topc}</b> đang gánh team.<br><br>`+
    `👉 Đà đang lên — giữ hàng &amp; nhịp quảng cáo cho kênh <b>${topc}</b>, đừng để đứt phiên đỉnh!`
  );
}
let _noteA=null;
function renderNote(A){
  _noteA=A;
  if(el("noteEditWrap") && el("noteEditWrap").style.display==="block") return; // đang sửa thì giữ nguyên
  const custom=(localStorage.getItem(NOTE_KEY)||"").trim();
  // ghi chú tự gõ = chữ THUẦN → khử độc qua esc() [ZONE W0] rồi mới đổi xuống dòng (SPEC §6.14)
  el("noteBody").innerHTML = custom ? esc(custom).replace(/\n/g,"<br>") : autoNote(A);
}

/* [ZONE W4 · Sản phẩm: bubble + bar lời/lỗ]  Status: LOCKED */
function drawBubble(){
  const f=F("prodBubble"), A=compute(f); badge("prodBubble",A,f.cmp?prevOf(f):null);
  const rows=Object.keys(A.bp).map(n=>{const g=A.bp[n],x=ac(g);
    return {name:n,rev:g.r,orders:g.n,roi:x>0?g.r/x:null,margin:g.r-x};});
  const top=rows.filter(r=>r.roi!=null).sort((a,b)=>b.rev-a.rev).slice(0,MOB()?12:22);
  const col=r=> r.roi<1?T.crit : r.roi<1.15?T.cost[3] : T.good;
  const smax=Math.max(1,...top.map(r=>r.orders));
  const rois=top.map(r=>r.roi), rmin=Math.min(1,...rois), rmax=Math.max(1,...rois);  // giãn trục: bỏ vùng trống dưới min
  const pad=Math.max(0.05,(rmax-rmin)*0.12);   // chừa lề trên/dưới để bong bóng to + nhãn ở biên không bị cắt
  const ylo=Math.floor((rmin-pad)*20)/20, yhi=Math.ceil((rmax+pad)*20)/20;   // làm tròn bước 0.05 → không có mốc lẻ dính nhau (1.30x/1.32x)
  gc("prodBubble").setOption({
    tooltip:tip({trigger:"item",formatter:p=>{const r=p.data.o;
      return `<b>${esc(r.name)}</b><br>Doanh thu ${fF(r.rev)}đ<br>Net ROI ${r.roi.toFixed(2)}x<br>Số đơn ${r.orders}`;}}),
    grid:{left:MOB()?8:48,right:MOB()?18:26,top:22,bottom:28,containLabel:true},
    xAxis:{type:"value",min:0,boundaryGap:[0,"10%"],splitNumber:MOB()?3:5,axisLabel:{color:T.muted,formatter:fAx,fontSize:MOB()?10:11,hideOverlap:true},splitLine:sl()},
    yAxis:{type:"value",min:+ylo.toFixed(2),max:+yhi.toFixed(2),
      axisLabel:{color:T.muted,formatter:v=>v.toFixed(2)+"x",fontSize:MOB()?10:11,hideOverlap:true},splitLine:sl()},
    series:[{type:"scatter",data:top.map(r=>({value:[r.rev,r.roi],o:r,
        symbolSize:13+Math.sqrt(r.orders/smax)*(MOB()?26:36),
        itemStyle:{color:col(r),opacity:.82,borderColor:T.surface,borderWidth:1.5},
        label:{show:true,position:"top",color:T.ink2,fontSize:10,formatter:()=>r.roi.toFixed(2)+"x"}})),
      labelLayout:{hideOverlap:true},
      markLine:{silent:true,symbol:"none",lineStyle:{color:T.muted,type:"dashed"},
        data:[{yAxis:1,label:{formatter:"Hòa vốn",color:T.muted,position:"insideStartTop"}}]}}]
  }, true);
}
function drawProdBar(){
  const f=F("prodBar"), A=compute(f); badge("prodBar",A,f.cmp?prevOf(f):null);
  const rows=Object.keys(A.bp).map(n=>{const g=A.bp[n],x=ac(g);
    return {name:n,rev:g.r,orders:g.n,roi:x>0?g.r/x:null,margin:g.r-x};});
  const bar=rows.sort((a,b)=>b.rev-a.rev).slice(0,MOB()?8:12).reverse();
  const NL=MOB()?14:24;   // tên SP: điện thoại cắt 14 ký tự để vùng vẽ thanh không bị bóp (SPEC §6.10)
  gc("prodBar").setOption({
    tooltip:tip({trigger:"item",formatter:p=>`<b>${esc(bar[p.dataIndex].name)}</b><br>Lời/lỗ ${fF(p.value)} đ`}),
    grid:{left:8,right:MOB()?50:58,top:14,bottom:22,containLabel:true},
    xAxis:{type:"value",splitNumber:MOB()?3:5,axisLabel:{color:T.muted,formatter:fAx,fontSize:MOB()?10:11,hideOverlap:true},splitLine:sl()},
    // onZero:false → trục tên SP nằm ở MÉP TRÁI, không chạy qua vạch 0 đè lên thanh LỖ (âm)
    yAxis:{type:"category",data:bar.map(r=>r.name.length>NL?r.name.slice(0,NL)+"…":r.name),
      axisLabel:{color:T.ink2,fontSize:MOB()?10:11},axisLine:{onZero:false,lineStyle:{color:T.axis}},axisTick:{show:false}},
    series:[{type:"bar",data:bar.map(r=>({value:r.margin,
        itemStyle:{color:r.margin>=0?T.good:T.crit,borderRadius:r.margin>=0?[0,5,5,0]:[5,0,0,5]}})),
      // nhãn "right": thanh dương = sau đầu thanh · thanh âm = bên phải vạch 0 (vùng trống) → không đè trục/thanh
      label:{show:true,position:"right",color:T.ink2,fontSize:MOB()?10:11,formatter:p=>fV(p.value)}}]
  }, true);
}

/* [ZONE W5 · Kênh: ROI + cơ cấu chi phí %]  Status: LOCKED */
function drawChROI(){
  const f=F("chROI"), A=compute(f); badge("chROI",A,f.cmp?prevOf(f):null);
  const nm=Object.keys(A.bc), net=[],roas=[],gross=[];
  nm.forEach(n=>{const g=A.bc[n],x=ac(g);
    net.push(x>0?+(g.r/x).toFixed(2):0); roas.push(g.a>0?+(g.r/g.a).toFixed(2):0);
    gross.push(g.c>0?+(g.r/g.c).toFixed(2):0);});
  // 3 cột sát nhau/kênh: điện thoại xoay nhãn 90° (mỗi nhãn nằm gọn trong bề ngang cột) + ẩn nhãn chồng (SPEC §6.11)
  const lbl=Object.assign({show:true,position:"top",color:T.ink2,fontSize:MOB()?9:11,formatter:p=>p.value?p.value.toFixed(2)+"x":""},
    MOB()?{rotate:90,align:"left",verticalAlign:"middle",distance:4}:{});
  const lg=lgTop("chROI",["Net ROI","ROAS","Gross ROI"],{lbl:true,name:true});
  gc("chROI").setOption({
    tooltip:tip({trigger:"axis",axisPointer:{type:"shadow"},valueFormatter:v=>(+v).toFixed(2)+"x"}),
    legend:lg.legend, grid:{left:MOB()?6:40,right:16,top:lg.top,bottom:28,containLabel:true}, color:T.roi,
    labelLayout:{hideOverlap:true},
    xAxis:{type:"category",data:nm,axisLabel:catLbl("chROI",nm.length),axisLine:{lineStyle:{color:T.axis}}},
    yAxis:{type:"value",name:"ROI (x)",nameTextStyle:{color:T.muted},boundaryGap:[0,MOB()?"30%":"12%"],axisLabel:axc(),splitLine:sl()},
    series:[{name:"Net ROI",type:"bar",data:net,label:lbl,itemStyle:{borderRadius:[4,4,0,0]}},
      {name:"ROAS",type:"bar",data:roas,label:lbl,itemStyle:{borderRadius:[4,4,0,0]}},
      {name:"Gross ROI",type:"bar",data:gross,label:lbl,itemStyle:{borderRadius:[4,4,0,0]}}]
  }, true);
}
function drawChCost(){
  const f=F("chCost"), A=compute(f); badge("chCost",A,f.cmp?prevOf(f):null);
  const nm=Object.keys(A.bc);
  // khớp COSTL [COGS,Platform,Ads,KOC,Phí sàn phụ trội] ↔ g.c,g.p,g.a,g.k,g.o (trước 2026-11-25 tráo k/a).
  // SPEC §6.6: trước đây keys chỉ 4 mục → series thứ 5 (Phí sàn phụ trội) = g[undefined] = NaN mà legend vẫn hiện 5 mục.
  const keys=["c","p","a","k","o"];
  const series=COSTL.map((nm2,ix)=>({name:nm2,type:"bar",stack:"x",color:T.cost[ix],
    itemStyle:{borderColor:T.surface,borderWidth:1},
    label:{show:true,color:"#fff",fontSize:MOB()?9:10,formatter:p=>p.value>=7?Math.round(p.value)+"%":""},
    data:nm.map(n=>{const g=A.bc[n];return g.r>0?+(((g[keys[ix]])||0)/g.r*100).toFixed(1):0;})}));
  const lg=lgTop("chCost",COSTL,{name:true});
  gc("chCost").setOption({
    tooltip:tip({trigger:"axis",axisPointer:{type:"shadow"},valueFormatter:v=>(+v).toFixed(1)+"%"}),
    legend:lg.legend, grid:{left:MOB()?6:40,right:16,top:lg.top,bottom:28,containLabel:true},
    xAxis:{type:"category",data:nm,axisLabel:catLbl("chCost",nm.length),axisLine:{lineStyle:{color:T.axis}}},
    yAxis:{type:"value",name:"% doanh thu",nameTextStyle:{color:T.muted},
      axisLabel:{color:T.muted,formatter:"{value}%",fontSize:MOB()?10:11},splitLine:sl()}, series
  }, true);
}

/* [ZONE W6 · Thời gian: dòng tiền + số đơn/ngày]  Status: LOCKED */
function drawMoney(){
  const f=F("tlMoney"), A=compute(f), pA=f.cmp?prevOf(f):null;
  badge("tlMoney",A,pA);
  const dts=Object.keys(A.bd).sort(), g=d=>A.bd[d];
  const rev=dts.map(d=>g(d).r), mar=dts.map(d=>{const x=g(d);return x.r-ac(x);});
  // nhãn số DT: bước nhãn theo BỀ RỘNG THẬT của chart (mỗi nhãn cần ~28px) thay vì "≤45 ngày = mọi ngày"
  // → điện thoại 25–31 ngày không còn 31 nhãn dính chùm trên ~290px (SPEC §6.4) · thêm hideOverlap chặn chồng còn sót
  const pxDay=Math.max(1,(((el("tlMoney")&&el("tlMoney").clientWidth)||600)-70)/Math.max(1,dts.length));
  const STEP=Math.max(1,Math.ceil(28/pxDay)), everyDay=STEP===1;
  const avgR=rev.length?rev.reduce((s,x)=>s+x,0)/rev.length:0;
  if(el("tlAvg")) el("tlAvg").textContent=" · TB/ngày: "+fV(avgR);
  const costS=[["c","COGS"],["p","Platform"],["a","Ads"],["k","KOC"],["o","Phí sàn phụ trội"]].map((kk,ix)=>({   // g.a=Ads, g.k=KOC (sửa tráo 2026-11-25)
    name:kk[1],type:"bar",stack:"cost",color:T.cost[ix],
    itemStyle:{borderColor:T.surface,borderWidth:.4,borderRadius:ix===3?[3,3,0,0]:0}, data:dts.map(d=>g(d)[kk[0]])}));
  const series=[...costS,
    {name:"Doanh thu",type:"line",data:rev,smooth:true,symbol:"circle",symbolSize:1,lineStyle:{width:2.5,color:T.rev},itemStyle:{color:T.rev},z:5,
      label:{show:true,position:"top",distance:5,fontSize:9,fontWeight:600,color:T.ink,
        formatter:p=>(everyDay||p.dataIndex%STEP===0)?(p.value/1e6).toFixed(1):""},
      markLine:{silent:true,symbol:"none",lineStyle:{color:T.muted,type:"dashed",width:1},data:[{yAxis:Math.round(avgR),label:{show:false}}]}},
    {name:"Lợi nhuận",type:"line",data:mar,smooth:true,symbol:"none",lineStyle:{width:2,type:"dashed",color:T.margin},itemStyle:{color:T.margin},z:6}];
  if(pA){ const pv=Object.keys(pA.bd).sort().map(d=>pA.bd[d].r);
    series.push({name:"DT kỳ trước",type:"line",smooth:true,symbol:"none",z:4,data:dts.map((_,i)=>pv[i]!=null?pv[i]:null),
      lineStyle:{color:T.muted,width:1.5,type:"dashed"},itemStyle:{color:T.muted}}); }
  const lg=lgTop("tlMoney",series.map(s=>s.name),{lbl:true});   // 7–8 mục legend: chừa đủ số dòng thật → không đè plot
  gc("tlMoney").setOption({
    tooltip:tip({trigger:"axis",valueFormatter:v=>fF(v)+" đ"}),
    legend:lg.legend, grid:{left:MOB()?6:48,right:18,top:lg.top,bottom:28,containLabel:true}, labelLayout:{hideOverlap:true},
    xAxis:{type:"category",data:dts,axisLabel:axc(),axisLine:{lineStyle:{color:T.axis}}},
    yAxis:{type:"value",axisLabel:{color:T.muted,formatter:fV,fontSize:MOB()?10:11},splitLine:sl()},
    series
  }, true);
}
function drawOrders(){
  const f=F("tlOrders"), A=compute(f), pA=f.cmp?prevOf(f):null;
  badge("tlOrders",A,pA);
  const dts=Object.keys(A.bd).sort(), g=d=>A.bd[d];
  const ords=dts.map(d=>g(d).n);
  const omax=Math.max(1,...ords);
  const lerp=(a,b,t)=>"#"+[1,3,5].map(i=>{const x=parseInt(a.substr(i,2),16),y=parseInt(b.substr(i,2),16);
    return Math.round(x+(y-x)*t).toString(16).padStart(2,"0");}).join("");
  const shade=v=>lerp("#a9cdf2","#154b8e",0.15+0.85*Math.sqrt(v/omax));
  const avg=ords.length?ords.reduce((s,x)=>s+x,0)/ords.length:0;
  if(el("olAvg")) el("olAvg").textContent=" · TB/ngày: "+avg.toFixed(0)+" đơn";
  const series=[{name:"Số đơn",type:"bar",itemStyle:{borderRadius:[4,4,0,0]},
    data:ords.map(v=>({value:v,itemStyle:{color:shade(v)}})),
    label:{show:true,position:"top",fontSize:9,color:T.ink2,formatter:p=>p.value},labelLayout:{hideOverlap:true},
    markLine:{silent:true,symbol:"none",lineStyle:{color:T.muted,type:"dashed",width:1},data:[{yAxis:+avg.toFixed(1),label:{show:false}}]}}];
  if(pA){ const pv=Object.keys(pA.bd).sort().map(d=>pA.bd[d].n);
    series.push({name:"Kỳ trước",type:"line",smooth:true,symbol:"none",z:4,data:dts.map((_,i)=>pv[i]!=null?pv[i]:null),
      lineStyle:{color:T.muted,width:1.5,type:"dashed"},itemStyle:{color:T.muted}}); }
  const lg=pA?lgTop("tlOrders",["Số đơn","Kỳ trước"],{lbl:true,name:true}):null;
  gc("tlOrders").setOption({
    tooltip:tip({trigger:"axis",axisPointer:{type:"shadow"}}),
    legend: lg?lg.legend:undefined,
    grid:{left:MOB()?6:44,right:18,top:lg?lg.top:36,bottom:28,containLabel:true},
    xAxis:{type:"category",data:dts,axisLabel:axc(),axisLine:{lineStyle:{color:T.axis}}},
    yAxis:{type:"value",name:"Số đơn",nameTextStyle:{color:T.muted},axisLabel:axc(),splitLine:sl()},
    series
  }, true);
}

/* [ZONE W8 · Video & KOC: năng suất + xếp hạng + phễu]  Status: DRAFT
   Nguồn: window.QAMI_VIDEO (video_data.js, từ python/video.py). Không có nguồn -> ẩn, hiện empty. */
/* Video chỉ có NGÀY ĐĂNG + số liệu theo FILE THÁNG (Σ các tháng export; TikTok không xuất theo ngày)
   → lọc thời gian cho video = lọc theo NGÀY ĐĂNG. Toàn kỳ (Tất cả) = không lọc. */
const VMON=(VID&&VID.totals&&VID.totals.months&&VID.totals.months.length)?
  ("tháng "+VID.totals.months[0]+(VID.totals.months.length>1?" → "+VID.totals.months[VID.totals.months.length-1]:"")):"cả kỳ file export";
const VNODATE=(VID&&VID.totals&&VID.totals.nodate)||0;   // video TikTok ghi ngày đăng "--"
function vRange(f){ return (f.dS<=0 && f.dE>=NLAST) ? null : [DATES[f.dS], DATES[f.dE]]; }
function inR(d,r){ return !r || (!!d && d>=r[0] && d<=r[1]); }
function renderVideo(){
  const V=VID, empty=el("vEmpty"), has=V && V.koc && V.koc.length;
  if(empty) empty.style.display=has?"none":"block";
  // thiếu video_data.js: ẩn luôn 2 thẻ bảng + thanh ⓘ KPI (khỏi để khung rỗng) → chỉ còn thẻ #vEmpty (SPEC TC-EDGE-02)
  ["vHeat","vTable"].forEach(id=>{ const c=el(id)&&el(id).closest(".card"); if(c) c.style.display=has?"":"none"; });
  if(el("qkb-vkpi")) el("qkb-vkpi").style.display=has?"":"none";
  if(!has){ el("vkpis").innerHTML=""; return; }
  drawVKpis(V); drawVHeat(V); drawVTable(V);
}
function drawVKpis(V){   // theo filter TỔNG (ngày đăng); hoa hồng chỉ có số toàn kỳ → ghi rõ, không lọc
  const t=V.totals||{}, r=vRange(G), rows=(V.table||[]).filter(x=>inR(x.date,r));
  const sum=k=>rows.reduce((s,x)=>s+(+x[k]||0),0), users=new Set(rows.map(x=>x.user));
  const sub=r?("đăng "+ddmm(r[0])+" → "+ddmm(r[1])):("toàn bộ · số liệu "+VMON);
  const K=[{l:"Tổng video",v:fF(rows.length),s:sub},{l:"Số KOC",v:fF(users.size),s:sub},
    {l:"GMV video",v:fV(sum("gmv")),s:sub},{l:"Số đơn",v:fF(sum("orders")),s:sub},
    {l:"Số món bán",v:fF(sum("sold")),s:sub},{l:"Hoa hồng ước tính",v:fV(rows.length&&rows[0].comm!=null?sum("comm"):t.comm),
     s:(rows.length&&rows[0].comm!=null)?sub:("Σ "+VMON+" · không lọc theo ngày đăng")}];
  el("vkpis").innerHTML=K.map(k=>`<div class="kpi"><div class="l">${k.l}</div><div class="v">${k.v}</div><div class="s">${k.s}</div></div>`).join("");
}
let vExpand=false; const VTOP=20;   // bảng ma trận: hiện top 20, mở xem thêm
function drawVHeat(V){
  const r=vRange(F("vHeat"));                       // cột = ngày ĐĂNG trong filter (riêng hoặc theo tổng)
  const cols=V.dates.filter(d=>inR(d,r));
  const host=el("vHeat");
  if(!cols.length){ host.innerHTML='<div style="padding:22px;color:#938a78">Không có KOC đăng video trong khoảng ngày đang lọc.</div>'; return; }
  const ci={}; cols.forEach((d,i)=>ci[d]=i);
  const rows=V.koc.map(name=>({name,cells:new Array(cols.length).fill(0),total:0}));
  for(const [di,ki,c] of V.heat){ const cx=ci[V.dates[di]]; if(cx===undefined) continue;
    rows[ki].cells[cx]+=c; rows[ki].total+=c; }
  const active=rows.filter(r=>r.total>0).sort((a,b)=>b.total-a.total);   // luôn sort DESC theo Tổng
  const max=Math.max(1,...active.map(r=>Math.max(0,...r.cells)));
  const shown=vExpand?active:active.slice(0,VTOP);
  const colTot=cols.map((_,cx)=>active.reduce((s,r)=>s+r.cells[cx],0));
  const grand=active.reduce((s,r)=>s+r.total,0);
  const blue=v=>{ if(!v) return "";                 // gradient xanh như hình PBI
    const t=0.10+0.90*Math.sqrt(v/max), L=[238,244,251], D=[42,120,214];
    const c=L.map((a,i)=>Math.round(a+(D[i]-a)*t));
    return "background:rgb("+c[0]+","+c[1]+","+c[2]+");color:"+(t>0.62?"#fff":"#243b53"); };
  const dd=d=>{const p=d.split("-");return p[2]+"/"+p[1];};
  const dcell=v=>'<td style="'+blue(v)+'">'+(v||"")+'</td>';
  const others=vExpand?[]:active.slice(VTOP);          // thu gọn = GỘP phần còn lại, KHÔNG loại bỏ
  let body=shown.map(function(r){return '<tr><td class="kcol" title="'+esc(r.name)+'">'+esc(r.name)+'</td>'+
    r.cells.map(dcell).join("")+'<td class="tcol">'+r.total+'</td></tr>';}).join("");
  if(others.length){
    const oc=cols.map(function(_,cx){var s=0;others.forEach(function(r){s+=r.cells[cx];});return s;});
    const ot=others.reduce(function(s,r){return s+r.total;},0);
    body+='<tr class="orow"><td class="kcol">… '+others.length+' KOC còn lại (gộp)</td>'+
      oc.map(function(v){return '<td>'+(v||"")+'</td>';}).join("")+'<td class="tcol">'+ot+'</td></tr>';
  }
  const h='<table class="vmx"><thead><tr><th class="kcol">KOC / Ngày</th>'+
    cols.map(function(d){return '<th>'+dd(d)+'</th>';}).join("")+'<th class="tcol">Tổng</th></tr></thead><tbody>'+
    body+'</tbody><tfoot><tr><td class="kcol">Tổng</td>'+
      cols.map(function(_,cx){return '<td>'+(colTot[cx]||"")+'</td>';}).join("")+'<td class="tcol">'+grand+'</td></tr></tfoot></table>';
  let out=h;
  if(active.length>VTOP){ out+='<button id="vMore" class="minibtn" style="margin:8px 0 2px">'
    +(vExpand?'▲ Thu gọn (20 đầu + gộp phần còn lại)':'▼ Hiện tất cả '+active.length+' KOC')+'</button>'; }
  host.innerHTML=out;
  const mb=el("vMore"); if(mb) mb.onclick=()=>{ vExpand=!vExpand; drawVHeat(V); };
}
/* (2026-11-25 · SPEC §6.12) đã gỡ drawVKocRev / drawVKocEff / drawVFunnel — không có thẻ HTML đích, không được gọi. */

/* [ZONE W9 · Bảng Video ROI (xếp hạng GMV↓ rồi Doanh thu gộp↓)]  Status: DRAFT */
let vtExpand=false;
function drawVTable(V){
  const host=el("vTable"); if(!host) return;
  const all=(V && V.table)||[];
  if(!all.length){ host.innerHTML='<div style="padding:22px;color:#938a78">Chưa có dữ liệu video.</div>'; return; }
  const r=vRange(F("vTable"));                      // chỉ video ĐĂNG trong khoảng lọc · xếp GMV↓ (cả khi gộp nhiều shop)
  const rows=all.filter(x=>inR(x.date,r)).sort((a,b)=>(b.gmv||0)-(a.gmv||0));
  if(!rows.length){ host.innerHTML='<div style="padding:22px;color:#938a78">Không có video ĐĂNG trong '+ddmm(r[0])+' → '+ddmm(r[1])+
    ' (bảng lọc theo ngày đăng — xem ⓘ Rule). Chọn khoảng rộng hơn hoặc "Tất cả".</div>'; return; }
  const shown=vtExpand?rows:rows.slice(0,VTOP);
  const dd=function(d){var p=(d||'').split('-');return p.length===3?(p[2]+'/'+p[1]+'/'+p[0]):(d||'—');};   // '—' = TikTok không cấp ngày đăng
  const pc=function(x){return x==null?'—':x+'%';};
  /* esc()/safeUrl() dùng chung ở [ZONE W0] — một cửa khử độc duy nhất cho cả file */
  var body=shown.map(function(r){
    return '<tr><td>'+dd(r.date)+'</td>'+
      '<td class="kcol" title="'+esc(r.user)+'">'+esc(r.user)+'</td>'+
      '<td class="lnk"><a href="'+safeUrl(r.link)+'" target="_blank" rel="noopener" title="'+esc(r.link)+'">'+esc(r.link)+'</a></td>'+
      '<td class="num">'+fF(r.gmv)+'</td>'+
      '<td class="num">'+fF(r.views)+'</td>'+
      '<td class="num">'+pc(r.ctr)+'</td>'+
      '<td class="num">'+pc(r.ctor)+'</td>'+
      '<td class="num">'+fF(r.orders)+'</td>'+
      '<td class="num">'+fF(r.refund)+'</td>'+
      '<td class="num">'+fF(r.sold)+'</td>'+
      '<td class="num">'+pc(r.comp)+'</td></tr>';
  }).join("");
  var h='<table class="vtbl"><thead><tr>'+
    '<th>Thời gian đăng</th><th class="kcol">Tên người dùng</th><th>Link video</th>'+
    '<th class="num">GMV video liên kết</th>'+
    '<th class="num" title="Lượt xem video">Lượt xem</th>'+
    '<th class="num" title="CTR = Lượt nhấp SP ÷ Lượt hiển thị SP trong video × 100% (Σ các tháng)">CTR</th>'+
    '<th class="num" title="CTOR = Số đơn ÷ Lượt nhấp SP × 100%">CTOR</th>'+
    '<th class="num" title="Đơn hàng nhờ video">Số đơn</th>'+
    '<th class="num" title="Số món đã hoàn tiền">Hoàn (món)</th>'+
    '<th class="num" title="Số món bán ra ghi nhận vào video — khác số đơn">Số món bán</th>'+
    '<th class="num" title="Tỷ lệ xem hết — trung bình các tháng, trọng số theo lượt xem">Tỷ lệ xem hết</th></tr></thead><tbody>'+
    body+'</tbody></table>';
  var out='<div class="qcap">'+fF(rows.length)+' video '+(r?('đăng '+ddmm(r[0])+' → '+ddmm(r[1])):'(toàn kỳ)')+
    ' · số liệu mỗi video = Σ '+VMON+'</div>'+h;
  if(rows.length>VTOP){ out+='<button id="vtMore" class="minibtn" style="margin:8px 0 2px">'
    +(vtExpand?'▲ Thu gọn':'▼ Hiện tất cả '+rows.length+' video')+'</button>'; }
  host.innerHTML=out;
  var b=el("vtMore"); if(b) b.onclick=function(){ vtExpand=!vtExpand; drawVTable(V); };
}

/* [ZONE W13 · Hoàn & Hủy — tab phân tích sâu trên INCOME THẬT]  Status: DRAFT
   Nguồn: window.QAMI_RETURNS (python/returns.py) — chỉ account CÓ returns.py (qami).
   · Đếm đơn (tỷ lệ, lý do, COD, SP/KOC/tỉnh) → theo NGÀY ĐẶT ĐƠN.
   · TIỀN = income thật (G gộp · R hoàn · F phí · N thực nhận = G+R+F), 2 chế độ (RT_MODE):
       "order"  = A · theo NGÀY ĐẶT: gom mọi dòng quyết toán của đơn về ngày đặt (đơn T10 hoàn QT T11 → tính về T10)
       "settle" = B · theo NGÀY QUYẾT TOÁN: từng dòng tính vào ngày tiền chạy (khớp sao kê TikTok)
   · RT_PEND = gồm đơn CHƯA quyết toán (ước tính từ onhold) — vá điểm yếu "tháng gần nhất chưa chín" của A. */
const RET=window.QAMI_RETURNS||null, RET_TAG=window.QAMI_RETURNS_TAG||"";
const RTC=RET?["rtWater","rtLag","rtCost","rtTrend","rtReason","rtPay","rtProd","rtKoc","rtProv"]:[];
const RT_COL=["#0f9d58","#938a78","#eda100","#cf3b3b","#8e5bd8"];   // màu theo loại t=0..4
const RT_EXP={};                                                       // bảng đang bung hết?
let RT_MODE="order", RT_PEND=false, RT_LAGM="r";                       // chế độ tiền · gồm chưa QT · ma trận: r hoàn / n thực nhận
const rP=(x,n)=>n?x/n*100:0, fP=x=>x.toFixed(1)+"%";
const RT_ML=()=>RT_MODE==="order"?"theo ngày đặt":"theo ngày quyết toán";
function rtRows(r){ const out=[]; if(!RET) return out;
  for(let i=0;i<RET.t.length;i++){ const d=RET.dates[RET.d[i]]; if(r && (d<r[0]||d>r[1])) continue; out.push(i); }
  return out; }
function rtAgg(ix){ const a={N:ix.length,n:[0,0,0,0,0]}; ix.forEach(i=>a.n[RET.t[i]]++); return a; }   // ĐẾM đơn theo loại
function rtMoney(r){   // TIỀN income theo chế độ hiện tại → m.t[0..4] + m.p (chờ QT) · mỗi ô {g,r,f,n,c}
  const z=()=>({g:0,r:0,f:0,n:0,cg:0,c:0}), m={t:[z(),z(),z(),z(),z()],p:z()};
  if(!RET) return m;
  if(RT_MODE==="order"){
    for(let i=0;i<RET.t.length;i++){ const d=RET.dates[RET.d[i]]; if(r&&(d<r[0]||d>r[1])) continue;
      if(!(RET.ig[i]||RET.ir[i]||RET.if[i]||RET.in[i]||RET.cg[i])) continue;
      const x=m.t[RET.t[i]]; x.g+=RET.ig[i]; x.r+=RET.ir[i]; x.f+=RET.if[i]; x.n+=RET.in[i]; x.cg+=RET.cg[i]; x.c++; }
  } else { const E=RET.e;
    for(let k=0;k<E.o.length;k++){ const d=RET.edates[E.ds[k]]; if(r&&(d<r[0]||d>r[1])) continue;
      const x=m.t[E.o[k]>=0?RET.t[E.o[k]]:0]; x.g+=E.g[k]; x.r+=E.r[k]; x.f+=E.f[k]; x.n+=E.n[k]; x.cg+=E.cg[k]; x.c++; } }
  if(RT_PEND) for(let i=0;i<RET.t.length;i++){ if(!(RET.pg[i]||RET.pn[i])) continue; const d=RET.dates[RET.d[i]];
    if(r&&(d<r[0]||d>r[1])) continue; m.p.g+=RET.pg[i]; m.p.f+=RET.pf[i]; m.p.n+=RET.pn[i]; m.p.cg+=RET.pcg[i]; m.p.c++; }
  const S=k=>m.t.reduce((a,x)=>a+x[k],0)+m.p[k];
  m.G=S("g"); m.R=S("r"); m.F=S("f"); m.N=S("n");
  m.Fbad=m.t[2].f+m.t[3].f+m.t[4].f; m.Nbad=m.t[2].n+m.t[3].n+m.t[4].n;
  m.CG=S("cg"); m.L=m.N-m.CG; m.Lbad=m.Nbad-(m.t[2].cg+m.t[3].cg+m.t[4].cg);   // lãi sau giá vốn (= cách dashboard tính lãi ròng)
  return m; }
function rtGroup(ix,key){ const g={};   // gom theo 1 chiều (pr/kc/pv): N + số đơn mỗi loại + hoàn trên income (theo đơn)
  ix.forEach(i=>{ const v=RET[key][i]; const o=g[v]||(g[v]={k:v,N:0,n:[0,0,0,0,0],lost:0}); o.N++; o.n[RET.t[i]]++; o.lost-=RET.ir[i]; });
  return Object.values(g).map(o=>Object.assign(o,{bad:o.n[2]+o.n[3]+o.n[4]})); }
function rtTable(id,head,rows,opt){ opt=opt||{}; const host=el(id); if(!host) return;
  if(!rows.length){ host.innerHTML='<div class="qrtnote">Không có dữ liệu trong khoảng đang lọc.</div>'; return; }
  const top=opt.top||15, show=RT_EXP[id]?rows:rows.slice(0,top);
  host.innerHTML=(opt.cap?'<div class="qrtnote">'+opt.cap+'</div>':'')+'<div class="qrtw"><table class="qrt"><thead><tr>'+
    head.map(h=>'<th'+(h[1]?' title="'+esc(h[1])+'"':'')+'>'+h[0]+'</th>').join("")+'</tr></thead><tbody>'+
    show.map(r=>'<tr'+(r.cls?' class="'+r.cls+'"':'')+'>'+r.map(c=>(c&&typeof c==="object")?'<td class="'+c.c+'">'+c.v+'</td>':'<td>'+c+'</td>').join("")+'</tr>').join("")+
    (opt.foot?'<tr class="qrtf">'+opt.foot.map(c=>'<td>'+c+'</td>').join("")+'</tr>':'')+'</tbody></table></div>'+
    (rows.length>top?'<button class="minibtn qrtmore" style="margin:8px 0 2px">'+(RT_EXP[id]?'▲ Thu gọn':'▼ Hiện tất cả '+rows.length)+'</button>':'');
  const b=host.querySelector(".qrtmore"); if(b) b.onclick=()=>{ RT_EXP[id]=!RT_EXP[id]; RENDER[id](); }; }
function rtHot(x,base){ return {v:fP(x),c:(base>0&&x>0&&x>=base*1.5)?"hot":""}; }   // đỏ khi ≥ 1,5× mức chung
function rtBase(ix){ const a=rtAgg(ix); return {2:rP(a.n[2],a.N),3:rP(a.n[3],a.N),4:rP(a.n[4],a.N),bad:rP(a.n[2]+a.n[3]+a.n[4],a.N)}; }
const RT_HEAD=[["Đơn"],["Hủy trước ship"],["Giao thất bại"],["Hoàn"],["Tổng lỗi","(hủy + thất bại + hoàn) ÷ đơn"],["Hoàn trên income","Σ tiền hoàn (income) của các đơn này"]];
function rtRateRows(g,nameOf,base){ return g.map(o=>[nameOf(o.k),fF(o.N),rtHot(rP(o.n[2],o.N),base[2]),rtHot(rP(o.n[3],o.N),base[3]),
  rtHot(rP(o.n[4],o.N),base[4]),{v:"<b>"+fP(rP(o.bad,o.N))+"</b>",c:rP(o.bad,o.N)>=base.bad*1.5?"hot":""},fV(o.lost)]); }
const fVP=(v,b)=>fV(v)+" · "+fP(rP(v,b));                               // "84.9 tr · 6.8%"

function drawRtKpis(){ const host=el("rtkpis"); if(!host||!RET) return;
  const r=vRange(G), m=rtMoney(r), a=rtAgg(rtRows(r)), len=G.dE-G.dS+1, pe=G.dS-1;
  const pa=(G.cmp && r && pe>=0) ? rtAgg(rtRows([DATES[Math.max(0,G.dS-len)],DATES[pe]])) : null;
  const bad=rP(a.n[2]+a.n[3]+a.n[4],a.N), pbad=pa&&pa.N?rP(pa.n[2]+pa.n[3]+pa.n[4],pa.N):null;
  const dl=pbad==null?"":`<div class="s ${bad<=pbad?"pos":"neg"}">${bad<=pbad?"▼":"▲"} ${Math.abs(bad-pbad).toFixed(1)} điểm % vs kỳ trước</div>`;
  const K=[
    {l:"Income gộp",v:fV(m.G),s:"trước hoàn · "+RT_ML()+(RT_PEND?" · gồm chờ QT":"")},
    {l:"Hoàn & đảo đơn",v:fV(-m.R),vc:"neg",s:fP(rP(-m.R,m.G))+" income gộp"},
    {l:"Phí bị trừ",v:fV(-m.F),s:fP(rP(-m.F,m.G))+" gộp · đơn lỗi "+fV(-m.Fbad)},
    {l:"Thực nhận",v:fV(m.N),vc:"pos",s:fP(rP(m.N,m.G))+" income gộp"+(RT_PEND&&m.p.n?" · chờ QT ~"+fV(m.p.n):"")},
    {l:"Lãi sau giá vốn",v:fV(m.L),vc:m.L>=0?"pos":"neg",s:fP(rP(m.L,m.G))+" gộp · đơn lỗi kéo "+fV(m.Lbad)},
    {l:"Tỷ lệ đơn lỗi",v:fP(bad),vc:"neg",s:"hủy "+fP(rP(a.n[2],a.N))+" · thất bại "+fP(rP(a.n[3],a.N))+" · hoàn "+fP(rP(a.n[4],a.N)),x:dl}];
  host.innerHTML=K.map(k=>`<div class="kpi"><div class="l">${k.l}</div><div class="v ${k.vc||""}">${k.v}</div><div class="s">${k.s}</div>${k.x||""}</div>`).join("");
}
function drawRtWater(){ const m=rtMoney(vRange(F("rtWater"))), G0=m.G||1;
  // khung HẸP (điện thoại): waterfall NẰM NGANG — tên bậc đọc thẳng ở trục trái, nhãn "tiền · %" bên phải mỗi thanh
  // → hết cảnh 10 nhãn 2 dòng chen trên ~290px + nhãn trục xoay 38° bị cắt đáy (SPEC §6.5 · TC-RT-02)
  const narrow=((el("rtWater")&&el("rtWater").clientWidth)||900)<640;
  const cats=[], base=[], val=[], col=[], tot=[]; let run=m.G;
  const push=(c,b,v,k,isT)=>{ cats.push(c); base.push(b); val.push(v); col.push(k); tot.push(!!isT); };
  push("Income gộp",0,m.G,T.ink,1);
  const hk=-(m.t[0].r+m.t[1].r);
  [[2,"Hủy trước ship",-m.t[2].r],[3,"Giao thất bại",-m.t[3].r],[4,"Trả hàng / hoàn",-m.t[4].r]].concat(hk?[[1,"Hoàn khác",hk]]:[])
    .forEach(s=>{ run-=s[2]; push("− "+s[1],Math.max(0,run),s[2],RT_COL[s[0]]); });
  push("= Doanh thu",0,run,"#5f584a",1);
  const fOk=-(m.t[0].f+m.t[1].f+m.p.f), fBad=-m.Fbad;
  run-=fOk; push("− Phí đơn thường",Math.max(0,run),fOk,"#a89f8c");
  run-=fBad; push("− Phí đơn lỗi",Math.max(0,run),fBad,"#cf3b3b");
  push("= Thực nhận",0,run,"#2a78d6",1);
  run-=m.CG; push("− Giá vốn",Math.max(0,run),m.CG,"#8a8296");
  push("= Lãi",0,run,run>=0?T.good:T.crit,1);
  const catAx={type:"category",data:cats,axisLine:{lineStyle:{color:T.axis}},axisTick:{show:false},
    axisLabel:Object.assign(axc(),narrow?{interval:0,fontSize:10,color:T.ink2}:{interval:0,fontSize:11,width:Math.max(60,(el("rtWater").clientWidth-90)/cats.length-6),overflow:"break",lineHeight:13})};
  const valAx={type:"value",splitNumber:narrow?3:5,axisLabel:{color:T.muted,formatter:narrow?fAx:fV,fontSize:MOB()?10:11,hideOverlap:true},splitLine:sl()};
  gc("rtWater").setOption({
    tooltip:tip({trigger:"axis",axisPointer:{type:"shadow"},formatter:p=>{const q=p[p.length-1];
      return `<b>${q.name}</b><br>${fF(q.value)} đ · <b>${fP(rP(q.value,G0))}</b> income gộp`+(RT_PEND&&m.p.g&&q.dataIndex===0?`<br>gồm chờ QT ~${fV(m.p.g)}`:"");}}),
    grid:narrow?{left:6,right:58,top:10,bottom:24,containLabel:true}:{left:46,right:14,top:30,bottom:30,containLabel:true},
    xAxis:narrow?valAx:catAx,
    yAxis:narrow?Object.assign(catAx,{inverse:true}):valAx,
    labelLayout:{hideOverlap:true},
    series:[{type:"bar",stack:"w",data:base,itemStyle:{color:"transparent"},emphasis:{disabled:true},tooltip:{show:false}},
      {type:"bar",stack:"w",barMaxWidth:narrow?22:undefined,
       data:val.map((v,i)=>({value:v,itemStyle:{color:col[i],borderRadius:narrow?[0,4,4,0]:[4,4,0,0],opacity:tot[i]?1:.92}})),
       label:{show:true,position:narrow?"right":"top",fontSize:narrow?9:11,color:T.ink2,lineHeight:narrow?11:14,
         formatter:p=>fV(p.value)+(narrow?"\n":" · ")+fP(rP(p.value,G0))}}]
  },true);
}
function drawRtLag(){ const host=el("rtLag"); if(!host||!RET) return;
  const r=vRange(F("rtLag")), E=RET.e, M={}, cols=new Set(), mo=s=>s.slice(5,7)+"/"+s.slice(0,4), key=RT_LAGM;
  for(let k=0;k<E.o.length;k++){ const dc=RET.edates[E.dc[k]]; if(r&&(dc<r[0]||dc>r[1])) continue; const v=E[key][k]; if(!v) continue;
    const a=mo(dc), b=mo(RET.edates[E.ds[k]]); (M[a]=M[a]||{})[b]=(M[a][b]||0)+v; cols.add(b); }
  const ord=s=>s.slice(3)+s.slice(0,2);
  const C=[...cols].sort((x,y)=>ord(x)<ord(y)?-1:1);
  if(RT_PEND && key==="n") for(let i=0;i<RET.t.length;i++){ if(!RET.pn[i]) continue; const d=RET.dates[RET.d[i]]; if(r&&(d<r[0]||d>r[1])) continue;
    const a=mo(d); (M[a]=M[a]||{})["Chờ QT"]=(M[a]["Chờ QT"]||0)+RET.pn[i]; }
  if(RT_PEND && key==="n") C.push("Chờ QT");
  const rows=Object.keys(M).sort((x,y)=>ord(x)<ord(y)?-1:1).map(a=>{ const tot=C.reduce((s,c)=>s+(M[a][c]||0),0);
    const late=C.filter(c=>c!=="Chờ QT" && ord(c)>ord(a)).reduce((s,c)=>s+(M[a][c]||0),0);
    return ["Đặt "+a,...C.map(c=>{ const v=M[a][c]||0; if(!v) return "";
        const cls=c==="Chờ QT"?"pend":(ord(c)>ord(a)?"late":(c===a?"same":""));
        return {v:fV(v)+'<br><span class="pct">'+fP(rP(v,tot))+'</span>',c:cls}; }),
      "<b>"+fV(tot)+"</b>",{v:"<b>"+fP(rP(late,tot))+"</b>",c:late?"late":""}]; });
  const btn=(k,t)=>`<button data-lag="${k}" class="${RT_LAGM===k?"on":""}">${t}</button>`;
  rtTable("rtLag",[["Tháng đặt ↓ · tháng quyết toán →"],...C.map(c=>[c==="Chờ QT"?"Chờ QT (ước)":"QT "+c]),["Cộng"],["Trôi sang tháng sau","phần quyết toán ở tháng SAU tháng đặt ÷ cộng hàng"]],rows,
    {cap:'<span class="qrtsw">'+btn("r","Tiền hoàn")+btn("n","Thực nhận")+'</span> ô vàng = trôi sang tháng sau (vd đơn đặt T10, hoàn quyết toán T11) · % = phần của hàng'});
  host.querySelectorAll("[data-lag]").forEach(b=>b.onclick=()=>{ RT_LAGM=b.dataset.lag; drawRtLag(); });
}
function drawRtCost(){ const m=rtMoney(vRange(F("rtCost"))), G0=m.G, N0=m.N, L0=m.L;
  const row=(nm,x,cls)=>Object.assign([nm,fF(x.c),fV(x.g),fP(rP(x.g,G0)),fV(-x.r),fV(-x.f),
    {v:fV(x.n),c:x.n<0?"hot":""},fV(x.cg),{v:"<b>"+fV(x.n-x.cg)+"</b>",c:(x.n-x.cg)<0?"hot":""},fP(rP(x.n-x.cg,L0))],{cls:cls||""});
  const rows=[0,1,2,3,4].filter(t=>m.t[t].c).map(t=>row(RET.types[t],m.t[t],t>=2?"bad":""));
  if(RT_PEND && m.p.c) rows.push(row("Chờ quyết toán (ước)",m.p,"pend"));
  const cnt=m.t.reduce((s,x)=>s+x.c,0)+m.p.c;
  rtTable("rtCost",[["Loại đơn"],[RT_MODE==="order"?"Đơn":"Dòng QT",RT_MODE==="order"?"số đơn có income":"số dòng quyết toán trong khoảng"],["Income gộp"],["% gộp","phần của income gộp"],
    ["Hoàn"],["Phí bị trừ"],["Thực nhận"],["Giá vốn","Cost_COGS trên P&L (cost_list Chủ nhập)"],["Lãi","thực nhận − giá vốn"],["% lãi","phần của tổng lãi (loại lỗi thường ÂM = kéo xuống)"]],rows,
    {cap:"Phân bổ income "+RT_ML()+(RT_PEND?" · gồm chờ quyết toán (ước tính)":"")+" · nền % = income gộp / tổng lãi",
     foot:["<b>Cộng</b>",fF(cnt),"<b>"+fV(G0)+"</b>","100%",fV(-m.R),fV(-m.F),fV(N0),fV(m.CG),"<b>"+fV(L0)+"</b>","100%"]});
}
function drawRtTrend(){ const ix=rtRows(vRange(F("rtTrend"))), by={};
  ix.forEach(i=>{ const d=RET.dates[RET.d[i]], o=by[d]||(by[d]={N:0,n:[0,0,0,0,0]}); o.N++; o.n[RET.t[i]]++; });
  const ds=Object.keys(by).sort(), rate=ds.map(d=>{const o=by[d];return +((o.n[2]+o.n[3]+o.n[4])/o.N*100).toFixed(1);});
  const lg=lgTop("rtTrend",[2,3,4].map(k=>RET.types[k]).concat(["% đơn lỗi"]),{name:true});
  // đọc không cần hover: nhãn % lỗi trên đường, giãn theo bề rộng (~30px/nhãn) + ẩn chồng
  const pxD=Math.max(1,((el("rtTrend").clientWidth||600)-90)/Math.max(1,ds.length)), stp=Math.max(1,Math.ceil(30/pxD));
  gc("rtTrend").setOption({
    tooltip:tip({trigger:"axis",axisPointer:{type:"shadow"}}), legend:lg.legend, labelLayout:{hideOverlap:true},
    grid:{left:MOB()?6:40,right:MOB()?6:40,top:lg.top,bottom:28,containLabel:true},
    xAxis:{type:"category",data:ds,axisLabel:axc(),axisLine:{lineStyle:{color:T.axis}}},
    yAxis:[{type:"value",name:"Số đơn",nameTextStyle:{color:T.muted},axisLabel:axc(),splitLine:sl()},
      {type:"value",name:"% lỗi",nameTextStyle:{color:T.muted},axisLabel:{color:T.muted,formatter:"{value}%",fontSize:MOB()?10:11},splitLine:{show:false}}],
    series:[...[2,3,4].map(k=>({name:RET.types[k],type:"bar",stack:"x",color:RT_COL[k],data:ds.map(d=>by[d].n[k])})),
      {name:"% đơn lỗi",type:"line",yAxisIndex:1,smooth:true,symbol:"circle",symbolSize:2,lineStyle:{width:2,color:T.ink},itemStyle:{color:T.ink},data:rate,z:5,
       label:{show:true,position:"top",fontSize:9,fontWeight:600,color:T.ink,formatter:p=>p.dataIndex%stp===0?Math.round(p.value)+"%":""}}]
  },true);
}
function drawRtReason(){ const ix=rtRows(vRange(F("rtReason"))).filter(i=>RET.t[i]===2||RET.t[i]===3), g={};
  ix.forEach(i=>{ const rs=RET.rs[i]<0?"(không ghi lý do)":RET.reasons[RET.rs[i]], b=RET.b[i]<0?"(không rõ)":RET.by[RET.b[i]];
    const o=g[rs]||(g[rs]={n:0,by:{}}); o.n++; o.by[b]=(o.by[b]||0)+1; });
  const top=Object.keys(g).sort((x,y)=>g[y].n-g[x].n).slice(0,10).reverse(), tot=ix.length;
  const whos=[...new Set(top.flatMap(r=>Object.keys(g[r].by)))], C={"Khách":T.orange,"Hệ thống":"#cf3b3b","Shop / vận hành":"#2a78d6"};
  const W=MOB()?16:34;   // điện thoại cắt lý do 16 ký tự → vùng thanh ngang không bị bóp (SPEC TC-RT-04)
  const lg=lgTop("rtReason",whos);
  gc("rtReason").setOption({
    tooltip:tip({trigger:"axis",axisPointer:{type:"shadow"},formatter:ps=>{const n=ps.reduce((s,p)=>s+p.value,0);
      return `<b>${ps[0].name}</b> · ${fF(n)} đơn · ${fP(rP(n,tot))}<br>`+ps.filter(p=>p.value).map(p=>`${p.marker}${p.seriesName}: ${fF(p.value)}`).join("<br>");}}),
    legend:lg.legend, grid:{left:8,right:46,top:lg.top,bottom:20,containLabel:true},
    xAxis:{type:"value",axisLabel:Object.assign(axc(),{hideOverlap:true}),splitLine:sl()},
    yAxis:{type:"category",data:top.map(r=>r.length>W?r.slice(0,W)+"…":r),axisLabel:{color:T.ink2,fontSize:MOB()?10:11},axisLine:{lineStyle:{color:T.axis}}},
    series:whos.map((w,ix2)=>({name:w,type:"bar",stack:"r",color:C[w]||T.muted,data:top.map(r=>g[r].by[w]||0),
      label:ix2===whos.length-1?{show:true,position:"right",color:T.ink2,fontSize:10,formatter:p=>fP(rP(g[top[p.dataIndex]].n,tot))}:{show:false}}))
  },true);
}
function drawRtPay(){ const ix=rtRows(vRange(F("rtPay"))), g={0:{N:0,n:[0,0,0,0,0]},1:{N:0,n:[0,0,0,0,0]}};
  ix.forEach(i=>{ const o=g[RET.pm[i]]; o.N++; o.n[RET.t[i]]++; });
  const nm=["COD (trả khi nhận)","Trả trước (ví/thẻ)"], col=[T.orange,"#2a78d6"];
  const lg=lgTop("rtPay",[0,1].map(p=>nm[p]+" · "+fF(g[p].N)+" đơn"),{lbl:true});   // legend dài rớt 2 dòng → chừa chỗ
  gc("rtPay").setOption({
    tooltip:tip({trigger:"axis",axisPointer:{type:"shadow"},formatter:ps=>ps.map(p=>{const o=g[p.seriesIndex],k=[2,3,4][p.dataIndex];
      return `${p.marker}${nm[p.seriesIndex]}: <b>${p.value}%</b> (${fF(o.n[k])}/${fF(o.N)} đơn)`;}).join("<br>")}),
    legend:lg.legend, grid:{left:MOB()?6:40,right:16,top:lg.top,bottom:24,containLabel:true}, labelLayout:{hideOverlap:true},
    xAxis:{type:"category",data:[2,3,4].map(k=>RET.types[k]),axisLabel:catLbl("rtPay",3),axisLine:{lineStyle:{color:T.axis}}},
    yAxis:{type:"value",boundaryGap:[0,"10%"],axisLabel:{color:T.muted,formatter:"{value}%",fontSize:MOB()?10:11},splitLine:sl()},
    series:[0,1].map(p=>({name:nm[p]+" · "+fF(g[p].N)+" đơn",type:"bar",color:col[p],itemStyle:{borderRadius:[4,4,0,0]},
      data:[2,3,4].map(k=>+rP(g[p].n[k],g[p].N).toFixed(1)),label:{show:true,position:"top",fontSize:10,color:T.ink2,formatter:q=>q.value+"%"}}))
  },true);
}
function drawRtProd(){ const ix=rtRows(vRange(F("rtProd"))), base=rtBase(ix);
  const g=rtGroup(ix,"pr").filter(o=>o.N>=10).sort((x,y)=>y.bad-x.bad||y.N-x.N);
  rtTable("rtProd",[["Sản phẩm (SKU đầu của đơn)"],...RT_HEAD],rtRateRows(g,k=>esc(RET.prods[k]),base),
    {cap:"Mức chung: tổng lỗi "+fP(base.bad)+" · đỏ = ≥ 1,5× mức chung · chỉ SP ≥ 10 đơn · xếp theo số đơn lỗi"});
}
function drawRtKoc(){ const ix=rtRows(vRange(F("rtKoc"))), base=rtBase(ix);
  const viaK=ix.filter(i=>RET.kc[i]>=0), noK=ix.filter(i=>RET.kc[i]<0), bk=rtBase(viaK), bn=rtBase(noK);
  const g=rtGroup(viaK,"kc").filter(o=>o.N>=20).sort((x,y)=>y.bad-x.bad||y.N-x.N);
  rtTable("rtKoc",[["KOC"],...RT_HEAD],rtRateRows(g,k=>esc(RET.kocs[k]),base),
    {cap:"Qua KOC: lỗi "+fP(bk.bad)+" ("+fF(viaK.length)+" đơn) · không qua KOC: "+fP(bn.bad)+" ("+fF(noK.length)+" đơn) · chỉ KOC ≥ 20 đơn"});
}
function drawRtProv(){ const ix=rtRows(vRange(F("rtProv"))), base=rtBase(ix), cod={};
  ix.forEach(i=>{ const v=RET.pv[i]; cod[v]=(cod[v]||0)+(RET.pm[i]===0?1:0); });
  const g=rtGroup(ix,"pv").filter(o=>o.N>=15).sort((x,y)=>y.n[3]-x.n[3]||y.N-x.N);
  rtTable("rtProv",[["Tỉnh"],["Đơn"],["Giao thất bại","số đơn"],["% thất bại"],["% hủy trước ship"],["COD","% đơn trả khi nhận"]],
    g.map(o=>[esc(RET.provs[o.k]),fF(o.N),fF(o.n[3]),rtHot(rP(o.n[3],o.N),base[3]),rtHot(rP(o.n[2],o.N),base[2]),fP(rP(cod[o.k]||0,o.N))]),
    {cap:"Xếp theo số đơn giao thất bại · mức chung "+fP(base[3])+" · chỉ tỉnh ≥ 15 đơn"});
}
function renderReturns(){ if(!RET) return; drawRtKpis(); RTC.forEach(id=>RENDER[id]()); }
function mountReturns(){   // tạo tab + panel (chạy cả index.html lẫn hub) — CHỈ khi có dữ liệu
  if(!RET || el("p-rt")) return;
  const tabs=document.querySelector(".tabs"), pv=el("p-vid"); if(!tabs||!pv) return;
  const b=document.createElement("button"); b.className="tab"; b.dataset.tab="rt"; b.textContent="Hoàn & Hủy";
  const vb=tabs.querySelector('[data-tab="vid"]'); if(vb) vb.after(b); else tabs.appendChild(b);
  const card=(id,t,n,cls)=>`<div class="card"><h2>${t} <span class="note">${n}</span></h2><div class="${cls||"c tall"}" id="${id}"></div></div>`;
  const s=document.createElement("section"); s.className="panel"; s.id="p-rt";
  s.innerHTML=(RET_TAG?`<div class="qrtbanner">Chỉ có số liệu Hoàn &amp; Hủy của account <b>${esc(RET_TAG)}</b> — account khác chưa có.</div>`:"")+
    '<div class="qrtmode"><span class="ml">💰 Tiền tính theo</span><span class="qrtsw">'+
      '<button data-m="order" class="on" title="Gom mọi khoản của 1 đơn về NGÀY ĐẶT — đơn T10 hoàn QT T11 vẫn tính về T10">Ngày đặt đơn</button>'+
      '<button data-m="settle" title="Mỗi khoản tính vào NGÀY QUYẾT TOÁN — khớp sao kê / dòng tiền TikTok">Ngày quyết toán · dòng tiền</button></span>'+
      '<label class="cc-chk" title="Cộng thêm đơn CHƯA quyết toán (ước tính từ file onhold) — tháng gần nhất bớt thiếu"><input type="checkbox" id="rtPend"> Gồm đơn chưa quyết toán (ước tính)</label></div>'+
    '<div class="kpis" id="rtkpis"></div>'+
    card("rtWater","Dòng chảy income — từ gộp tới thực nhận","(nhãn = số tiền · % income gộp)","c tall")+
    card("rtLag","Hoàn trễ kỳ — tháng đặt × tháng quyết toán","(đơn A đặt T10, hoàn QT T11 nằm ở đây)","qrtbox")+
    card("rtCost","Phân bổ income theo loại đơn","(% gộp · % thực nhận)","qrtbox")+
    card("rtTrend","Hủy · giao thất bại · hoàn theo ngày đặt","(cột = số đơn · đường = % đơn lỗi)")+
    '<div class="grid2">'+card("rtReason","Lý do hủy · ai hủy","(top 10 · gồm cả giao thất bại · % = phần trong số đơn hủy)")+
      card("rtPay","COD vs trả trước","(% đơn mỗi loại)")+'</div>'+
    card("rtProd","Sản phẩm hay bị hủy / hoàn","(đỏ = cao bất thường)","qrtbox")+
    '<div class="grid2">'+card("rtKoc","KOC mang đơn lỗi","(đơn qua Creator Handle)","qrtbox")+
      card("rtProv","Tỉnh giao thất bại nhiều","(COD + địa chỉ)","qrtbox")+'</div>';
  pv.after(s);
  s.querySelectorAll("[data-m]").forEach(x=>x.onclick=()=>{ RT_MODE=x.dataset.m;
    s.querySelectorAll("[data-m]").forEach(y=>y.classList.toggle("on",y===x)); renderReturns(); });
  el("rtPend").onchange=e=>{ RT_PEND=e.target.checked; renderReturns(); };
}

/* [ZONE W10 · Điều phối: filter tổng → riêng + ⓘ Rule mỗi chart]  Status: DRAFT
   Markup chart nằm ở index.html VÀ bản sao trong Dev/dashboard.html (hub) → mọi nút/bộ lọc/popup/CSS
   do app.js TỰ DỰNG từ id sẵn có, không phụ thuộc markup mới. */
const OVC=["tlOrders","tlMoney","ovCost","prodBubble","prodBar","chROI","chCost"];   // tab Tổng quan
const VIC=["vHeat","vTable"];                                                       // tab Video (lọc theo NGÀY ĐĂNG)
const RENDER={ ovCost:drawDonut, tlOrders:drawOrders, tlMoney:drawMoney,
  prodBubble:drawBubble, prodBar:drawProdBar, chROI:drawChROI, chCost:drawChCost,
  vHeat:()=>{ if(VID&&VID.dates) drawVHeat(VID); }, vTable:()=>{ if(VID) drawVTable(VID); },
  rtWater:drawRtWater, rtTrend:drawRtTrend, rtReason:drawRtReason, rtPay:drawRtPay,
  rtCost:drawRtCost, rtLag:drawRtLag, rtProd:drawRtProd, rtKoc:drawRtKoc, rtProv:drawRtProv };
const ALLC=[...OVC,...VIC,...RTC];                                                 // mọi chart có ⚙ + ⓘ
let active="ov";
function renderActive(){
  if(active==="vid"){ renderVideo(); }
  else if(active==="rt"){ renderReturns(); }
  else if(!NO_DATA){ rOverview(); OVC.forEach(id=>RENDER[id]()); }
  ALLC.forEach(syncMini);
  setTimeout(()=>Object.values(charts).forEach(c=>c.resize()),30);
}
function commitG(p){ Object.assign(G,p); ALLC.forEach(id=>{ L[id]=cloneF(G); }); syncGlobal(); renderActive(); }
function commitL(id,p){ Object.assign(F(id),p); RENDER[id](); syncMini(id);
  setTimeout(()=>{ if(charts[id]) charts[id].resize(); },30); }

const PRESETS=[["g","Theo tổng"],["mtd","Tháng này"],["7","7n"],["14","14n"],["30","30n"],["90","90n"],["all","Tất cả"]];
function presetOf(id){ const f=F(id); if(sameF(f,G)) return "g";
  if(f.dS===_wk[0] && f.dE===_wk[1]) return "mtd";
  if(f.dS===0 && f.dE===NLAST) return "all";
  for(const n of [7,14,30,90]) if(f.dE===NLAST && f.dS===Math.max(0,DATES.length-n)) return String(n);
  return ""; }
function optHTML(list,cur){ return '<option value="all">Tất cả</option>'+
  list.map(o=>`<option value="${esc(o)}"${o===cur?" selected":""}>${esc(o)}</option>`).join(""); }
function miniHTML(id){ const vid=VIC.includes(id)||RTC.includes(id);
  return '<div class="qmp">'+PRESETS.map(p=>`<button data-p="${p[0]}">${p[1]}</button>`).join("")+'</div>'+
    '<div class="qmr"><div class="qml"></div><div class="rangewrap"><div class="rtrack"><div class="rfill qmfill"></div></div>'+
    `<input type="range" class="qlo" min="0" max="${NLAST}"><input type="range" class="qhi" min="0" max="${NLAST}"></div></div>`+
    (vid ? (RTC.includes(id)?'<div class="qmn">📅 Hoàn &amp; Hủy lọc theo <b>NGÀY ĐẶT ĐƠN</b> (gồm cả đơn chưa quyết toán)</div>'
               :'<div class="qmn">📅 Video lọc theo <b>NGÀY ĐĂNG</b> (không có kênh/trạng thái)</div>')
         : '<div class="qmo"><label>Kênh <select class="qch">'+optHTML(DATA.channels,"all")+'</select></label>'+
           '<label>Trạng thái <select class="qset">'+optHTML(DATA.settles,"all")+'</select></label>'+
           '<label class="cc-chk"><input type="checkbox" class="qcmp"> So kỳ trước</label></div>'); }
function paintRange(host,lo,hi){ const fl=host.querySelector(".qmfill"), N=NLAST||1;
  fl.style.left=(lo/N*100)+"%"; fl.style.width=((hi-lo)/N*100)+"%";
  host.querySelector(".qml").innerHTML=DATES.length?('Khoảng ngày · <b>'+ddmm(DATES[lo])+'</b> → <b>'+ddmm(DATES[hi])+'</b> ('+(hi-lo+1)+' ngày có đơn)'):"—"; }
function syncMini(id){
  const host=el("qmf-"+id), btn=document.querySelector(`.qlbtn[data-flt="${id}"]`); if(!host) return;
  const f=F(id), p=presetOf(id);
  host.querySelectorAll("[data-p]").forEach(b=>b.classList.toggle("on",b.dataset.p===p));
  host.querySelector(".qlo").value=f.dS; host.querySelector(".qhi").value=f.dE; paintRange(host,f.dS,f.dE);
  const ch=host.querySelector(".qch"); if(ch){ ch.value=f.ch; host.querySelector(".qset").value=f.set; host.querySelector(".qcmp").checked=!!f.cmp; }
  if(btn) btn.classList.toggle("diff",!sameF(f,G));
}
function mountControls(){
  ALLC.forEach(id=>{
    const c=el(id), card=c&&c.closest(".card"); if(!card || card.querySelector(".qlbtn")) return;
    card.dataset.chart=id;
    let head=card.querySelector(".cardhead"); const h2=card.querySelector("h2");
    if(!head){ head=document.createElement("div"); head.className="cardhead"; h2.parentNode.insertBefore(head,h2); head.appendChild(h2); }
    let box=head.querySelector(".chartctrl");
    if(!box){ box=document.createElement("div"); box.className="chartctrl"; head.appendChild(box); }
    box.innerHTML=`<span class="ccmp" data-ccmp="${id}"></span><button class="qibtn" data-rule="${id}">ⓘ Rule</button>`+
      `<button class="qlbtn" data-flt="${id}">⚙ lọc riêng</button>`;
    const host=document.createElement("div"); host.className="qmf"; host.id="qmf-"+id; host.style.display="none";
    host.innerHTML=miniHTML(id); head.parentNode.insertBefore(host,head.nextSibling);
    box.querySelector(".qlbtn").onclick=()=>{ host.style.display=host.style.display==="none"?"block":"none"; syncMini(id); };
    host.addEventListener("click",e=>{ const b=e.target.closest("[data-p]"); if(!b) return; const k=b.dataset.p;
      if(k==="g"){ L[id]=cloneF(G); RENDER[id](); syncMini(id); return; }
      if(k==="mtd") commitL(id,{dS:_wk[0],dE:_wk[1]});
      else if(k==="all") commitL(id,{dS:0,dE:NLAST}); else commitL(id,{dS:Math.max(0,DATES.length-(+k)),dE:NLAST}); });
    const lo=host.querySelector(".qlo"), hi=host.querySelector(".qhi");
    const vals=()=>{ let a=+lo.value,b=+hi.value; if(a>b){const x=a;a=b;b=x;} return [a,b]; };
    host.addEventListener("input",e=>{ if(e.target===lo||e.target===hi){ const v=vals(); paintRange(host,v[0],v[1]); } });
    host.addEventListener("change",e=>{
      if(e.target===lo||e.target===hi){ const v=vals(); commitL(id,{dS:v[0],dE:v[1]}); }
      else if(e.target.classList.contains("qch")) commitL(id,{ch:e.target.value});
      else if(e.target.classList.contains("qset")) commitL(id,{set:e.target.value});
      else if(e.target.classList.contains("qcmp")) commitL(id,{cmp:e.target.checked}); });
  });
  // thanh nhỏ ⓘ cho 2 hàng KPI (theo filter TỔNG)
  [["kpis","kpi","Chỉ số tổng · theo bộ lọc tổng ở trên"],["vkpis","vkpi","Chỉ số video · video ĐĂNG trong bộ lọc tổng"],["rtkpis","rtkpi","Chỉ số hoàn & hủy · đơn ĐẶT trong bộ lọc tổng"]].forEach(k=>{
    const g=el(k[0]); if(!g || el("qkb-"+k[1])) return;
    const bar=document.createElement("div"); bar.className="qkbar"; bar.id="qkb-"+k[1];
    bar.innerHTML=`<span>${k[2]}</span><button class="qibtn" data-rule="${k[1]}">ⓘ Rule</button>`;
    g.parentNode.insertBefore(bar,g); });
  // popup Rule (1 cái dùng chung)
  if(!el("qModal")){ const m=document.createElement("div"); m.id="qModal"; m.className="qmodal";
    // đầu popup (tiêu đề + ✕) ĐỨNG YÊN, chỉ thân cuộn → nút đóng luôn thấy dù nội dung dài (SPEC AC-06)
    m.innerHTML='<div class="qmbox" role="dialog" aria-modal="true"><div class="qmhd"><h3 id="qmT"></h3><button class="qmx" aria-label="Đóng">✕</button></div><div id="qmB" class="qmbd"></div></div>';
    document.body.appendChild(m);
    m.addEventListener("click",e=>{ if(e.target===m||e.target.closest(".qmx")) m.classList.remove("on"); });
    document.addEventListener("keydown",e=>{ if(e.key==="Escape") m.classList.remove("on"); }); }
  document.addEventListener("click",e=>{ const b=e.target.closest(".qibtn[data-rule]"); if(!b) return;
    const r=RULES[b.dataset.rule]; if(!r) return; el("qmT").textContent=r[0]; el("qmB").innerHTML=r[1]; el("qModal").classList.add("on"); });
}

/* [ZONE W11 · Nội dung ⓘ Rule — công thức THẬT theo code + pipeline (merge.py · config.py COST_GROUPS)] */
const R_COST='<ul><li><b>COGS</b> = giá vốn hàng (Chủ nhập ở <code>cost/cost_list.xlsx</code>, số ÂM).</li>'+
  '<li><b>Platform</b> = phí giao dịch + hoa hồng TikTok Shop + phí xử lý đơn + phí dịch vụ SFP/SFR/Voucher Xtra/Ưu đãi LIVE + phí vận chuyển người bán.</li>'+
  '<li><b>Ads</b> = phí quảng cáo GMV Max + phí nguồn lực chiến dịch — <i>phần TikTok trừ trên từng đơn trong file income</i> (có thể khác tổng spend ở tab Chiến dịch).</li>'+
  '<li><b>KOC</b> = hoa hồng liên kết (+ hoa hồng liên kết Quảng cáo cửa hàng).</li>'+
  '<li><b>Phí sàn phụ trội</b> = |Tổng phí| − (Platform + KOC + Ads) — phần phí còn lại để lãi ròng khớp đúng.</li></ul>';
const R_SRC='<p class="qsrc">Nguồn: bảng P&amp;L cấp đơn (<code>cleaned/02_income_py.xlsx</code> → <code>data.js</code>) · mỗi đơn 1 dòng · ngày = <b>Thời gian tạo đơn hàng</b>.</p>';
const R_FLT='<p class="qsrc">Bộ lọc: mặc định chạy theo <b>bộ lọc tổng</b>; bấm <b>⚙ lọc riêng</b> để chỉ chart này đổi (● = đang khác bộ lọc tổng; "Theo tổng" = quay về). Đổi bộ lọc tổng → mọi chart reset theo. <b>Mặc định</b> = từ <b>ngày 1 tháng hiện tại</b> → ngày mới nhất có data (nút "Tháng này"). <b>7n/14n/…</b> = N ngày CÓ ĐƠN gần nhất.</p>';
const R_CMP='<p><b>So kỳ trước</b>: cùng số ngày-có-đơn, nằm NGAY TRƯỚC khoảng đang xem, cùng kênh/trạng thái. Huy hiệu ▲/▼ = (DT nay − DT trước) ÷ |DT trước|.</p>';
const R_RT='<p class="qsrc">Nguồn TIỀN: file TikTok <b>income</b> (mọi file <code>income*.xlsx</code>, đã bỏ dòng trùng giữa các file) — từng dòng quyết toán. Nguồn ĐẾM ĐƠN: file "Tất cả đơn hàng" (loại đơn · lý do · ai hủy · đã ship chưa · tỉnh · thanh toán · KOC). Ghép theo Order ID.</p>';
const R_RTTYPE='<ul><li><b>Hủy trước ship</b> = hủy khi CHƯA giao vận chuyển → đơn COD không hề vào income (0đ); đơn trả trước vào rồi bị đảo 100%.</li>'+
  '<li><b>Giao thất bại</b> = ĐÃ ship rồi mới hủy (≈99% lý do "Giao gói hàng thất bại" — khách không nhận COD) → đảo doanh thu + VẪN bị trừ phí.</li>'+
  '<li><b>Hoàn / hoàn tiền</b> = khách đã nhận rồi trả hàng / đòi hoàn tiền.</li><li><b>Đang xử lý</b> = chưa chốt (có thể còn thất bại/hoàn).</li></ul>';
const R_RTMODE='<p><b>2 chế độ tiền</b> (nút đầu tab) — 1 đơn có NHIỀU dòng quyết toán, mỗi dòng 1 ngày riêng:</p><ul>'+
  '<li><b>Ngày đặt đơn</b>: gom mọi dòng của đơn về NGÀY ĐẶT — đơn đặt T10 mà hoàn quyết toán T11 → khoản hoàn vẫn tính về <b>T10</b>. Trả lời "đơn bán ra rốt cuộc mất bao nhiêu". Số tháng cũ có thể thay đổi khi hoàn về trễ.</li>'+
  '<li><b>Ngày quyết toán · dòng tiền</b>: mỗi dòng tính vào ngày tiền thật chạy — khoản hoàn trên tính vào <b>T11</b>. Khớp sao kê TikTok; tháng đã đóng không đổi.</li>'+
  '<li><b>Gồm đơn chưa quyết toán</b> (công tắc): cộng thêm đơn đang treo (ước tính từ file onhold, có thể đổi) theo ngày đặt — để tháng gần nhất không bị thiếu.</li></ul>';
const R_RTMONEY='<ul><li><b>Income gộp</b> = "Tổng phụ sau giảm giá của người bán" (trước hoàn) — <b>nền 100%</b> của mọi %.</li>'+
  '<li><b>Hoàn</b> = "Tổng phụ của khoản hoàn tiền sau giảm giá…" · <b>Phí</b> = "Tổng phí" (sàn + KOC + ads + vận chuyển…).</li>'+
  '<li><b>Thực nhận</b> = "Tổng số tiền quyết toán" = gộp − hoàn − phí (khớp tuyệt đối từng dòng).</li>'+
  '<li><b>Giá vốn</b> = Cost_COGS từng đơn trên P&amp;L (cost_list Chủ nhập — cùng số tab Tổng quan) · chế độ dòng tiền: gắn vào dòng quyết toán ĐẦU của đơn.</li>'+
  '<li><b>Lãi</b> = thực nhận − giá vốn (= cách tab Tổng quan tính lãi ròng).</li></ul>';
const R_RTWARN='<p class="qsrc">⚠ Đơn đặt GẦN ĐÂY chưa kịp giao thất bại / hoàn → tỷ lệ & tiền hoàn của những ngày cuối THẤP GIẢ (bật "Gồm đơn chưa quyết toán" để thấy phần đang treo). Giá vốn của đơn giao thất bại = số P&amp;L đang ghi — nếu hàng đã về kho nguyên vẹn thì phần này không mất thật.</p>';
const RULES={
  kpi:["Chỉ số tổng (KPI)", R_SRC+'<ul><li><b>Doanh thu</b> = Σ "Tổng doanh thu" các đơn trong khoảng.</li>'+
    '<li><b>Tổng chi phí</b> = COGS + Platform + Ads + KOC + Phí sàn phụ trội.</li>'+
    '<li><b>Lợi nhuận ròng</b> = Doanh thu − Tổng chi phí · dòng nhỏ = biên ròng % = LN ÷ DT.</li>'+
    '<li><b>Số đơn</b> = số dòng đơn · <b>GT/đơn</b> = DT ÷ số đơn · <b>Đơn/ngày</b> = số đơn ÷ số ngày CÓ đơn.</li></ul>'+
    R_CMP+'<p class="qsrc">KPI luôn theo <b>bộ lọc tổng</b> (không có lọc riêng).</p>'+R_COST],
  tlOrders:["Số đơn theo ngày", R_SRC+'<ul><li>Cột = số đơn TẠO trong ngày; màu đậm hơn = nhiều đơn hơn (√ chuẩn hoá theo ngày đỉnh).</li>'+
    '<li>Đường gạch ngang = TB/ngày = tổng đơn ÷ số ngày có đơn.</li>'+
    '<li>Đường xám "Kỳ trước" = số đơn từng ngày của kỳ trước, ghép theo thứ tự (ngày 1 ↔ ngày 1).</li></ul>'+R_CMP+R_FLT],
  tlMoney:["Dòng tiền theo ngày", R_SRC+'<ul><li>Cột chồng = 5 nhóm chi phí mỗi ngày.</li>'+
    '<li>Đường đen = doanh thu/ngày (nhãn = triệu đồng) · gạch ngang = TB doanh thu/ngày.</li>'+
    '<li>Đường xanh gạch = lợi nhuận = DT − tổng chi phí trong ngày.</li><li>Đường xám = DT kỳ trước (ghép theo thứ tự ngày).</li></ul>'+R_COST+R_CMP+R_FLT],
  ovCost:["Cơ cấu chi phí", R_SRC+'<p>Mỗi lát = tỷ trọng một nhóm trong <b>Tổng chi phí</b> của khoảng lọc (%).</p>'+R_COST+
    '<p class="qsrc">2026-11-25: đã sửa lỗi tráo nhãn Ads ↔ KOC ở chart này (trước đó lát "Ads" hiện số KOC và ngược lại).</p>'+R_FLT],
  prodBubble:["Hiệu quả sản phẩm (bong bóng)", R_SRC+'<ul><li>Mỗi bong bóng = 1 <b>tổ hợp sản phẩm của đơn</b> (cột Product_Names; đơn nhiều SP tính là 1 tổ hợp).</li>'+
    '<li>Trục ngang = doanh thu · trục đứng = <b>Net ROI = DT ÷ Tổng chi phí</b> (1.00x = hoà vốn, vạch gạch).</li>'+
    '<li>Kích thước = số đơn · Màu: 🟥 &lt; 1.00x (lỗ) · 🟧 1.00–1.15x (lãi mỏng) · 🟩 ≥ 1.15x.</li>'+
    '<li>Hiện top 22 theo doanh thu (điện thoại: 12).</li></ul>'+R_FLT],
  prodBar:["Lời/lỗ theo sản phẩm", R_SRC+'<ul><li>Thanh = <b>Lợi nhuận ròng = DT − Tổng chi phí</b> của từng tổ hợp sản phẩm.</li>'+
    '<li>🟩 lời · 🟥 lỗ · lấy top 12 theo DOANH THU (điện thoại: 8) rồi vẽ lời/lỗ của chúng.</li></ul>'+R_FLT],
  chROI:["ROI theo kênh", R_SRC+'<ul><li>Kênh = cột Order_Channel của đơn.</li>'+
    '<li><b>Net ROI</b> = DT ÷ Tổng chi phí (1x = hoà vốn).</li><li><b>ROAS</b> = DT ÷ Ads (Ads = phí quảng cáo trừ trên đơn).</li>'+
    '<li><b>Gross ROI</b> = DT ÷ COGS.</li></ul>'+R_FLT],
  chCost:["Cơ cấu chi phí theo kênh", R_SRC+'<ul><li>Mỗi cột = 1 kênh; mỗi đoạn = <b>chi phí nhóm ÷ doanh thu kênh × 100%</b>.</li>'+
    '<li>Vẽ đủ 5 nhóm COGS · Platform · Ads · KOC · Phí sàn phụ trội (cộng lại = tổng chi phí ÷ DT kênh) · số chỉ in khi ≥ 7%.</li></ul>'+R_COST+
    '<p class="qsrc">2026-11-25: sửa lỗi nhóm "Phí sàn phụ trội" có trên chú giải nhưng dữ liệu rỗng (NaN) — nay vẽ đúng số.</p>'+
    '<p class="qsrc">2026-11-25: đã sửa lỗi tráo nhãn Ads ↔ KOC ở chart này.</p>'+R_FLT],
  vkpi:["Chỉ số video (KPI)", '<p class="qsrc">Nguồn: file TikTok <code>Video_Analysis_Video_List.xlsx</code> → <code>video_data.js</code>.</p>'+
    '<ul><li>Lọc theo <b>NGÀY ĐĂNG video</b> nằm trong bộ lọc tổng ("Tất cả" = mọi video).</li>'+
    '<li>Nguồn = các <b>file tháng</b> (<code>Video_Analysis_Video_List_YYYYMM.xlsx</code>, hiện: '+VMON+'). Mỗi file = video CÓ HOẠT ĐỘNG trong tháng, số của RIÊNG tháng đó → số mỗi video = <b>Σ các tháng</b>.</li>'+
    '<li>Lọc ngày = chọn video theo <b>NGÀY ĐĂNG</b>, KHÔNG cắt GMV theo ngày (GMV = Σ các tháng của video đó).</li>'+
    (VNODATE?'<li>'+VNODATE+' video TikTok ghi ngày đăng <b>--</b>: vẫn tính khi chọn "Tất cả", không vào được khoảng ngày.</li>':'')+
    '<li><b>Tổng video</b> = số video · <b>Số KOC</b> = số tài khoản đăng khác nhau · <b>GMV video</b> = Σ GMV video liên kết · <b>Số đơn</b> = Σ đơn nhờ video · <b>Số món bán</b> = Σ món · <b>Hoa hồng ước tính</b> = Σ hoa hồng ước tính của video.</li></ul>'],
  vHeat:["KOC đăng video theo ngày", '<ul><li>Ô = <b>số video</b> KOC đó ĐĂNG trong ngày · cột = ngày đăng nằm trong bộ lọc.</li>'+
    '<li>Xanh đậm = nhiều (√ chuẩn hoá theo ô lớn nhất) · xếp KOC theo tổng video ↓.</li>'+
    '<li>Hiện top 20 KOC; phần còn lại GỘP thành 1 dòng (không bỏ) · "Hiện tất cả" để bung.</li></ul>'+R_FLT],
  vTable:["Video ROI", '<ul><li>Mỗi dòng = 1 video <b>ĐĂNG</b> trong khoảng lọc (cột "Thời gian đăng"); "Tất cả" = mọi video.</li>'+
    '<li>Mọi số (GMV, lượt xem, đơn, món, hoàn) = <b>Σ các file tháng</b> ('+VMON+') — lọc ngày chọn VIDEO theo ngày đăng, KHÔNG cắt GMV theo ngày.</li>'+
    (VNODATE?'<li>Ngày đăng <b>—</b> = TikTok ghi "--" ('+VNODATE+' video): chỉ hiện khi chọn "Tất cả".</li>':'')+
    '<li><b>CTR</b> = Σ lượt nhấp SP ÷ Σ lượt HIỂN THỊ SP trong video × 100% (đúng định nghĩa TikTok, tự tính lại vì tháng 11 TikTok bỏ cột CTR) · <b>CTOR</b> = số đơn ÷ lượt nhấp × 100% · <b>Tỷ lệ xem hết</b> = trung bình các tháng, trọng số theo lượt xem.</li>'+
    '<li class="qsrc">2026-11-25: sửa lỗi CTR/Tỷ lệ xem hết bị ×100 (vd 1,93% hiện 193%) + đọc đủ file tháng (GMV video trước chỉ ~107tr do khung export sai).</li>'+
    '<li>Xếp GMV video liên kết ↓ · top 20, "Hiện tất cả" để xem hết.</li></ul>'+R_FLT],
  rtkpi:["Chỉ số Hoàn & Hủy (KPI)", R_RT+R_RTMODE+R_RTMONEY+'<ul><li><b>Hoàn &amp; đảo đơn</b> = Σ hoàn; % = ÷ income gộp.</li>'+
    '<li><b>Phí bị trừ</b> · "đơn lỗi" = phần phí rơi vào đơn hủy / giao thất bại / hoàn.</li>'+
    '<li><b>Lãi sau giá vốn</b> = thực nhận − giá vốn · "đơn lỗi kéo" = lãi của đơn hủy + giao thất bại + hoàn (âm = phí + giá vốn không bù được).</li>'+
    '<li><b>Tỷ lệ đơn lỗi</b> = (hủy + thất bại + hoàn) ÷ đơn ĐẶT trong khoảng (đếm đơn, luôn theo ngày đặt) · so kỳ trước = chênh điểm % với khoảng ngay trước.</li></ul>'+R_RTTYPE+R_RTWARN],
  rtWater:["Dòng chảy income", R_RT+R_RTMODE+R_RTMONEY+'<ul><li>Cột đầu = <b>Income gộp</b> (100%). Mỗi bậc rơi = khoản trừ: hoàn theo loại đơn (hủy trước ship · giao thất bại · trả hàng · hoàn khác) → <b>= Doanh thu</b> → phí đơn thường · <b>phí đơn lỗi</b> → <b>= Thực nhận</b> → giá vốn → <b>= Lãi</b>.</li>'+
    '<li>Nhãn mỗi cột = số tiền · <b>% income gộp</b> (các bậc rơi + lãi cộng lại = 100%).</li></ul>'+R_RTWARN+R_FLT],
  rtLag:["Hoàn trễ kỳ — tháng đặt × tháng quyết toán", R_RT+'<ul><li><b>Hàng</b> = tháng ĐẶT đơn · <b>cột</b> = tháng QUYẾT TOÁN (tiền thật chạy).</li>'+
    '<li>Ô <b>trên đường chéo</b> = quyết toán trong chính tháng đặt · ô <b>vàng</b> (bên phải) = <b>trôi sang tháng sau</b> — vd đơn A đặt T10, hoàn quyết toán T11.</li>'+
    '<li>% trong ô = phần của cả hàng · cột cuối = <b>% trôi sang tháng sau</b>.</li>'+
    '<li>Nút <b>Tiền hoàn</b> / <b>Thực nhận</b> đổi chỉ số · bật "Gồm đơn chưa quyết toán" → thêm cột "Chờ QT (ước)" (chỉ với Thực nhận).</li>'+
    '<li>Đọc: % trôi cao → số "theo ngày quyết toán" của tháng sau đang gánh đơn của tháng trước; dùng chế độ "Ngày đặt đơn" để thấy đúng chất lượng từng tháng bán.</li></ul>'+R_FLT],
  rtCost:["Phân bổ income theo loại đơn", R_RT+R_RTMODE+R_RTMONEY+R_RTTYPE+'<ul><li>Mỗi dòng = 1 loại đơn · <b>% gộp</b> = income gộp của loại ÷ tổng income gộp · <b>% thực nhận</b> = thực nhận của loại ÷ tổng thực nhận (loại lỗi thường ÂM = kéo tổng xuống).</li>'+
    '<li>Cột 2 = số đơn có income (chế độ ngày đặt) hoặc số dòng quyết toán (chế độ dòng tiền).</li></ul>'+R_RTWARN+R_FLT],
  rtTrend:["Hủy · giao thất bại · hoàn theo ngày", R_RT+'<ul><li>ĐẾM ĐƠN theo NGÀY ĐẶT (không đổi theo chế độ tiền). Cột chồng = số đơn mỗi loại.</li>'+
    '<li>Đường = <b>% đơn lỗi</b> = (hủy + giao thất bại + hoàn) ÷ đơn đặt trong ngày.</li></ul>'+R_RTWARN+R_FLT],
  rtReason:["Lý do hủy · ai hủy", R_RT+'<ul><li>Gồm đơn <b>hủy trước ship</b> + <b>giao thất bại</b> (cột "Cancel Reason" / "Cancel By").</li>'+
    '<li>Màu = ai hủy: <b>Khách</b> · <b>Hệ thống</b> (vd giao thất bại, quá hạn thanh toán) · <b>Shop / vận hành</b>.</li>'+
    '<li>% cuối thanh = phần của lý do đó trong tổng đơn hủy (cùng khoảng) · top 10.</li></ul>'+R_FLT],
  rtPay:["COD vs trả trước", R_RT+'<ul><li><b>COD</b> = "Thanh toán khi giao hàng"; <b>Trả trước</b> = ví, thẻ, PayLater…</li>'+
    '<li>Cột = % đơn của nhóm rơi vào mỗi loại lỗi (mẫu số = số đơn của CHÍNH nhóm đó).</li></ul>'+R_FLT],
  rtProd:["Sản phẩm hay bị hủy / hoàn", R_RT+'<ul><li>Sản phẩm = dòng SKU ĐẦU của đơn (97,8% đơn chỉ có 1 SKU) · đếm đơn theo ngày đặt.</li>'+
    '<li>% mỗi cột = số đơn loại đó ÷ số đơn của SP · <b>Tổng lỗi</b> = hủy + thất bại + hoàn · <b>Hoàn trên income</b> = Σ tiền hoàn (income) của các đơn đó.</li>'+
    '<li><b>Đỏ</b> = ≥ 1,5× mức chung · chỉ SP ≥ 10 đơn · xếp theo số đơn lỗi.</li></ul>'+R_FLT],
  rtKoc:["KOC mang đơn lỗi", R_RT+'<ul><li>KOC = cột "Creator Handle" của đơn.</li>'+
    '<li>Dòng đầu so <b>qua KOC</b> vs <b>không qua KOC</b>; bảng = từng KOC ≥ 20 đơn, xếp theo số đơn lỗi · Hoàn trên income = Σ tiền hoàn của đơn KOC đó.</li>'+
    '<li>Đỏ = ≥ 1,5× mức chung → xem lại nội dung hứa quá đà, tệp khách, hoặc đơn ảo.</li></ul>'+R_FLT],
  rtProv:["Tỉnh giao thất bại nhiều", R_RT+'<ul><li>Tỉnh = cột "Province" · chỉ tỉnh ≥ 15 đơn · xếp theo SỐ đơn giao thất bại.</li>'+
    '<li><b>% thất bại</b> = thất bại ÷ đơn của tỉnh · <b>COD</b> = % đơn trả khi nhận · đỏ = ≥ 1,5× mức chung → cân nhắc cọc / ưu đãi trả trước.</li></ul>'+R_FLT],
};

/* [ZONE W12 · CSS cho nút ⓘ/⚙, bộ lọc mini, popup — tiêm từ app.js để chạy cả index.html lẫn hub] */
(function(){ if(document.getElementById("qFltCss")) return; const s=document.createElement("style"); s.id="qFltCss";
  s.textContent=
  ".chartctrl{flex-wrap:wrap;justify-content:flex-end}"+
  ".qibtn,.qlbtn{font:inherit;font-size:11.5px;border-radius:999px;padding:4px 11px;cursor:pointer;white-space:nowrap}"+
  ".qibtn{color:#2a78d6;background:#eef4fc;border:1px solid #cfe0f5}.qibtn:hover{background:#e3edfa}"+
  ".qlbtn{color:var(--ink2,#5f584a);background:#f3ecdd;border:1px solid var(--line,#e7dec9)}.qlbtn:hover{background:#ece2cd}"+
  ".qlbtn.diff{background:#e7d3ae;color:#6b4e16;border-color:#d8b877}.qlbtn.diff::after{content:' ●';color:#df7a2a}"+
  ".qmf{margin:0 0 10px;padding:10px 12px;background:var(--surface2,#f8f2e6);border:1px solid var(--line,#e7dec9);border-radius:12px;font-size:12px}"+
  ".qmp{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}"+
  ".qmp button{font:inherit;font-size:11.5px;border:1px solid var(--line,#e7dec9);background:var(--surface,#fffdf8);color:var(--ink2,#5f584a);border-radius:999px;padding:3px 10px;cursor:pointer}"+
  ".qmp button.on{background:var(--ink,#1a1611);color:#fdfaf2;border-color:var(--ink,#1a1611)}"+
  ".qml{color:var(--ink2,#5f584a);font-size:11.5px}.qmr .rangewrap{max-width:520px}"+
  ".qmo{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin-top:4px;color:var(--muted,#938a78);font-size:11.5px}"+
  ".qmo select{font-size:12px;padding:4px 8px;margin-left:4px;max-width:180px}"+
  ".qmn{color:var(--ink2,#5f584a);font-size:11.5px;margin-top:4px}"+
  ".qkbar{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 2px 6px;color:var(--muted,#938a78);font-size:12px}"+
  ".qcap{color:var(--muted,#938a78);font-size:12px;margin:0 0 6px}"+
  ".qrtw{overflow-x:auto;-webkit-overflow-scrolling:touch}.qrtbox{min-height:40px}"+
  ".grid2>*{min-width:0}"+   /* ô lưới được CO: bảng rộng cuộn trong thẻ thay vì đẩy lưới ra ngoài màn (html/body overflow-x:clip sẽ CẮT KHUẤT) */
  ".qrt{width:100%;border-collapse:collapse;font-size:12.5px}.qrt th{color:var(--muted,#938a78);font-weight:600;font-size:11.5px;text-align:right;padding:6px 8px;border-bottom:1px solid var(--line,#e7dec9);white-space:nowrap;cursor:help}"+
  ".qrt td{text-align:right;padding:6px 8px;border-bottom:1px solid var(--line,#e7dec9);white-space:nowrap}"+
  ".qrt th:first-child,.qrt td:first-child{text-align:left;white-space:normal;min-width:130px;max-width:280px}"+
  ".qrt td.hot{color:#cf3b3b;font-weight:700}.qrt tr.qrtf td{border-top:2px solid var(--ink,#1a1611);border-bottom:none}"+
  ".qrtnote{color:var(--muted,#938a78);font-size:12px;margin:0 0 6px}"+
  ".qrtmode{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;background:var(--surface,#fffdf8);border:1px solid var(--line,#e7dec9);border-radius:14px;padding:10px 12px;margin:0 0 12px;font-size:12.5px}"+
  ".qrtmode .ml{font-weight:700;color:var(--ink,#1a1611)}.qrtsw{display:inline-flex;flex-wrap:wrap;gap:4px}"+
  ".qrtsw button{font:inherit;font-size:12px;border:1px solid var(--line,#e7dec9);background:var(--surface,#fffdf8);color:var(--ink2,#5f584a);border-radius:999px;padding:4px 11px;cursor:pointer}"+
  ".qrtsw button.on{background:var(--ink,#1a1611);color:#fdfaf2;border-color:var(--ink,#1a1611)}"+
  ".qrt td.late{background:#fff4e0;color:#8a5a00}.qrt td.same{background:#f2f8f3}.qrt td.pend{background:#eef4fc;color:#2a5a9a}.qrt .pct{font-size:11px;color:var(--muted,#938a78)}"+
  ".qrt tr.bad td:first-child{color:#cf3b3b;font-weight:600}.qrt tr.pend td{color:#2a5a9a;font-style:italic}"+
  ".qrtbanner{background:#fff4e5;border:1px solid #f0cf9f;color:#6b4e16;border-radius:12px;padding:8px 12px;font-size:12.5px;margin:0 0 12px}"+
  ".qmtd{font:inherit;font-size:11px;margin-top:3px;align-self:flex-start;border:1px solid var(--line,#e7dec9);background:var(--surface,#fffdf8);color:var(--ink2,#5f584a);border-radius:999px;padding:2px 10px;cursor:pointer}"+
  ".qmtd.on{background:var(--ink,#1a1611);color:#fdfaf2;border-color:var(--ink,#1a1611)}"+
  ".qmodal{display:none;position:fixed;inset:0;z-index:1000;background:rgba(30,22,10,.45);align-items:center;justify-content:center;padding:16px}"+
  ".qmodal.on{display:flex}"+
  ".qmbox{background:var(--surface,#fffdf8);border:1px solid var(--line,#e7dec9);border-radius:16px;max-width:600px;width:100%;max-height:86vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(30,22,10,.35);position:relative;font-size:13.5px;line-height:1.55;color:var(--ink,#1a1611)}"+
  ".qmhd{display:flex;align-items:flex-start;gap:10px;padding:16px 14px 8px 20px;border-bottom:1px solid var(--line,#e7dec9);flex:0 0 auto}"+
  ".qmbd{overflow:auto;padding:8px 20px 18px;flex:1 1 auto;min-height:0;overflow-wrap:anywhere}"+
  ".qmbox h3{margin:0;font-size:17px;flex:1;min-width:0}.qmbox ul{padding-left:18px;margin:6px 0}.qmbox li{margin:3px 0}"+
  ".qmbox code{font-size:12px;background:#f3ecdd;padding:1px 5px;border-radius:5px;word-break:break-all}"+
  ".qsrc{color:var(--ink2,#5f584a);font-size:12.5px;background:#f8f2e6;border-radius:10px;padding:7px 10px;margin:8px 0}"+
  ".qmx{flex:0 0 auto;width:32px;height:32px;border:1px solid var(--line,#e7dec9);border-radius:50%;background:var(--surface2,#f8f2e6);font-size:16px;line-height:1;cursor:pointer;color:var(--ink,#1a1611)}"+
  ".qmx:hover{background:#ece2cd}"+
  "@media(max-width:760px){.qmo select{max-width:none;width:auto}.qmbox{font-size:13px}.qmhd{padding:14px 12px 8px 14px}.qmbd{padding:8px 14px 16px}.qkbar{font-size:11.5px}"+
    /* bảng ma trận KOC×ngày: 2 cột sticky gọn lại → vùng số ở giữa còn ≥ 4 cột trên 360px (SPEC AC-05 · TC-VID-02) */
    "table.vmx .kcol{min-width:84px;max-width:96px}table.vmx th,table.vmx td{min-width:26px;padding:3px 4px}"+
    ".chartctrl{gap:6px}.qibtn,.qlbtn{padding:4px 9px}}";
  document.head.appendChild(s); })();
function switchTab(t){
  if(!document.getElementById("p-"+t)) t="ov";   // tab không còn (vd 'tl') -> về Tổng quan
  active=t;
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("on",b.dataset.tab===t));
  document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("on",p.id==="p-"+t));
  renderActive();
}
function switchView(v){
  history.replaceState(null,"","#"+v);
  document.querySelectorAll(".navbtns button").forEach(b=>b.classList.toggle("on",b.dataset.view===v));
  el("view-home").classList.toggle("on",v==="home");
  el("view-clients").classList.toggle("on",v==="clients");
  if(v==="home") renderHome(); else renderActive();
  setTimeout(()=>Object.values(charts).forEach(c=>c.resize()),40);
  window.scrollTo(0,0);
}

/* ---------- init ---------- */
function fill(sel,opts){ sel.innerHTML='<option value="all">Tất cả</option>'+
  opts.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join(""); }
if(META.date) el("updated").textContent = "Cập nhật "+META.date+" · nguồn nội bộ";
fill(el("fCh"),DATA.channels); fill(el("fSet"),DATA.settles);
// BỘ LỌC TỔNG (G): đổi bất kỳ ô nào → commitG → mọi chart reset theo (L[id] = bản sao G)
el("fCh").onchange=e=>commitG({ch:e.target.value}); el("fSet").onchange=e=>commitG({set:e.target.value});
const drS=el("drStart"), drE=el("drEnd"), DN=Math.max(1,DATES.length-1);
drS.max=drE.max=DN;
function drPaint(){ el("rfill").style.left=(G.dS/DN*100)+"%"; el("rfill").style.width=((G.dE-G.dS)/DN*100)+"%";
  el("drLabel").textContent=DATES.length?(DATES[G.dS]+" → "+DATES[G.dE]+" ("+(G.dE-G.dS+1)+" ngày)"):"—"; }
function syncGlobal(){ drS.value=G.dS; drE.value=G.dE; el("fCh").value=G.ch; el("fSet").value=G.set; el("cmp").checked=!!G.cmp; drPaint();
  const b=el("qMtdG"); if(b) b.classList.toggle("on",G.dS===_wk[0]&&G.dE===_wk[1]); }
function drUpdate(){ let a=+drS.value, b=+drE.value; if(a>b){const x=a;a=b;b=x;} commitG({dS:a,dE:b}); }
drS.oninput=drE.oninput=drUpdate;
el("cmp").onchange=e=>commitG({cmp:e.target.checked});
// nút "Tháng này" cạnh thanh kéo TỔNG — quay về mặc định 1 chạm (LUẬT QA.md · Đụng DASHBOARD)
(function(){ const lb=el("drLabel"), box=lb&&lb.closest(".f"); if(!box || el("qMtdG")) return;
  const b=document.createElement("button"); b.id="qMtdG"; b.className="qmtd"; b.type="button"; b.textContent="Tháng này";
  b.onclick=()=>commitG({dS:_wk[0],dE:_wk[1]}); box.appendChild(b); })();
syncGlobal();
// ô ghi chú: Sửa / Lưu / Về mặc định
el("noteEdit").onclick=()=>{ el("noteText").value=localStorage.getItem(NOTE_KEY)||"";
  el("noteEditWrap").style.display="block"; el("noteBody").style.display="none"; };
el("noteSave").onclick=()=>{ localStorage.setItem(NOTE_KEY, el("noteText").value);
  el("noteEditWrap").style.display="none"; el("noteBody").style.display="block"; renderNote(_noteA||compute(G)); };
el("noteReset").onclick=()=>{ localStorage.removeItem(NOTE_KEY); el("noteText").value="";
  el("noteEditWrap").style.display="none"; el("noteBody").style.display="block"; renderNote(_noteA||compute(G)); };
function mountNoData(){   // thiếu data.js → tab Tổng quan hiện 1 thẻ báo rỗng gọn (giống #vEmpty), không vỡ trang
  if(!NO_DATA || el("ovEmpty")) return; const p=el("p-ov"); if(!p) return;
  [...p.children].forEach(c=>{ c.style.display="none"; });
  const d=document.createElement("div"); d.id="ovEmpty"; d.className="card";
  d.style.cssText="text-align:center;color:#938a78;padding:40px";
  d.innerHTML='Chưa có dữ liệu đơn hàng (<code>data.js</code>) — chạy <code>python python/run_all.py</code> để tạo.';
  p.prepend(d); }
mountReturns();    // tab "Hoàn & Hủy" (chỉ khi có returns_data.js — hiện: qami)
mountControls();   // gắn ⓘ Rule + ⚙ lọc riêng (preset · thanh kéo · kênh · trạng thái · so kỳ trước) vào từng chart
mountNoData();     // SAU mountControls: ẩn luôn thanh ⓘ KPI vừa gắn
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
// Đổi BỀ RỘNG (kéo cửa sổ laptop ↔ mobile, xoay màn hình) → co khung + VẼ LẠI option phụ thuộc MOB()/bề rộng
// (bán kính donut, số bong bóng/thanh, số dòng legend, hướng waterfall, bước nhãn) — trước chỉ resize() nên giữ layout cũ (SPEC §6.9 · AC-07).
// Chỉ đổi CHIỀU CAO (thanh địa chỉ mobile ẩn/hiện khi cuộn) → bỏ qua, khỏi vẽ lại liên tục.
let rz, rzW=window.innerWidth;
window.addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(()=>{
  Object.values(charts).forEach(c=>c.resize());
  if(window.innerWidth===rzW) return; rzW=window.innerWidth;
  if(el("view-home").classList.contains("on")){ renderHome(); return; }
  const ids=active==="ov"?(NO_DATA?[]:OVC):active==="rt"?RTC:[];
  ids.forEach(id=>{ if(charts[id]) RENDER[id](); });   // chỉ chart ECharts (bảng HTML tự co, giữ vị trí cuộn)
},150);});
function routeHash(){ const h=(location.hash||"").replace("#","").split(":");
  if(h[0]==="clients"){ switchView("clients");
    if(h.includes("cmp")){ G.cmp=true; ALLC.forEach(id=>{ L[id]=cloneF(G); }); syncGlobal(); }
    if(h[1] && h[1]!=="cmp") switchTab(h[1]); else renderActive();
  } else switchView("home"); }
window.addEventListener("hashchange",routeHash);
routeHash();
