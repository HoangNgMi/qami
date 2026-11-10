/* ===========================================================
   04_ENGINE (web) — zen.agency dashboard · logic UI
   Dữ liệu: data.js (window.QAMI_DATA) · Tham số/màu: config.js (window.CFG)
   Mỗi khối bọc [ZONE]. Sửa màu/mặc định -> config.js; sửa từng chart -> hàm draw*().
   =========================================================== */
const CFG = window.CFG || {};
const T = CFG.T;                 // palette & màu chrome (ở config.js)
const COSTL = CFG.COSTL;         // nhãn 4 nhóm chi phí

const DATA = window.QAMI_DATA;
const META = window.QAMI_META || {};
const DATES = [...new Set(DATA.date.filter(Boolean))].sort();   // ngày duy nhất, tăng dần
let dS = Math.max(0, DATES.length - (CFG.defaultDays || 30));   // mặc định N ngày gần nhất
let dE = Math.max(0, DATES.length - 1);
let cmpOn = CFG.compareDefault !== false;                       // so sánh kỳ trước (mặc định ON)

const el = id => document.getElementById(id);
const MOB = () => window.innerWidth < (CFG.mobileBreak || 760);
const charts = {};
function gc(id){ if(!charts[id]) charts[id]=echarts.init(el(id)); return charts[id]; }

function fV(n){ n=+n||0; const s=n<0?"-":""; const a=Math.abs(n);
  if(a>=1e9) return s+(a/1e9).toFixed(2)+" tỷ";
  if(a>=1e6) return s+(a/1e6).toFixed(1)+" tr";
  if(a>=1e3) return s+Math.round(a/1e3)+"k"; return s+Math.round(a); }
function fF(n){ return Math.round(+n||0).toLocaleString("vi-VN"); }
function tip(x){ return Object.assign({backgroundColor:T.surface,borderColor:T.grid,
  textStyle:{color:T.ink},confine:true}, x||{}); }
function axc(){ return {color:T.muted,fontSize:MOB()?10:11}; }
function sl(){ return {lineStyle:{color:T.grid}}; }

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
  gc("hc2").setOption({
    tooltip:tip({trigger:"item"}), legend:{bottom:0,textStyle:{color:T.ink2}}, color:T.cost,
    series:[{type:"pie",radius:["48%","72%"],center:["50%","44%"],
      itemStyle:{borderColor:T.surface,borderWidth:3},
      label:{color:T.ink,formatter:"{b} {d}%"},
      data:[{name:"COGS",value:58},{name:"Platform",value:18},{name:"Ads",value:14},{name:"KOC",value:10}]}]
  });
}

/* [ZONE W1 · Gom nhóm & tính (compute / computeRange / metrics)]  Status: LOCKED */
function grp(){ return {r:0,c:0,p:0,k:0,a:0,n:0}; }
function add(g,r,c,p,k,a){ g.r+=r;g.c+=c;g.p+=p;g.k+=k;g.a+=a;g.n++; }
function ac(g){ return g.c+g.p+g.k+g.a; }
function computeRange(s,e){
  const D=DATA, fc=el("fCh").value, fs=el("fSet").value;
  const lo=DATES[s], hi=DATES[e];
  const tot=grp(), bc={}, bp={}, bs={}, bd={}; const days=new Set();
  for(let i=0;i<D.rev.length;i++){
    if(fc!=="all" && D.channels[D.ch[i]]!==fc) continue;
    if(fs!=="all" && D.settles[D.set[i]]!==fs) continue;
    const d=D.date[i]; if(!d || d<lo || d>hi) continue;          // chỉ trong khoảng ngày
    const r=D.rev[i],c=D.cogs[i],p=D.plat[i],k=D.koc[i],a=D.ads[i];
    add(tot,r,c,p,k,a);
    const cn=D.channels[D.ch[i]]; add(bc[cn]=bc[cn]||grp(),r,c,p,k,a);
    const pn=D.products[D.prod[i]]; add(bp[pn]=bp[pn]||grp(),r,c,p,k,a);
    const sn=D.settles[D.set[i]]; add(bs[sn]=bs[sn]||grp(),r,c,p,k,a);
    days.add(d); add(bd[d]=bd[d]||grp(),r,c,p,k,a);
  }
  return {tot,bc,bp,bs,bd,nd:days.size};
}
function compute(){ return computeRange(dS,dE); }
function metrics(A){ const t=A.tot,cost=ac(t); return {rev:t.r,cost:cost,margin:t.r-cost,
  orders:t.n, aov:t.n?t.r/t.n:0, opd:A.nd?t.n/A.nd:0}; }

/* [ZONE W2 · Bộ lọc riêng từng chart (override vs filter tổng)]  Status: LOCKED */
const CHARTS={};
function st(id){ return CHARTS[id]||(CHARTS[id]={dOv:false,cOv:false,dS,dE,cmp:cmpOn}); }
function eff(id){ const s=st(id); return {dS:s.dOv?s.dS:dS, dE:s.dOv?s.dE:dE, cmp:s.cOv?s.cmp:cmpOn}; }
function prevOf(e){ const len=e.dE-e.dS+1, pe=e.dS-1; return pe>=0?computeRange(Math.max(0,e.dS-len),pe):null; }
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
  const e=eff("ovCost"), A=computeRange(e.dS,e.dE), t=A.tot;
  badge("ovCost",A, e.cmp?prevOf(e):null);
  gc("ovCost").setOption({
    tooltip:tip({trigger:"item",valueFormatter:v=>fF(v)+" đ"}),
    legend:{bottom:0,textStyle:{color:T.ink2}}, color:T.cost,
    series:[{type:"pie",radius:MOB()?["40%","62%"]:["46%","70%"],
      center:MOB()?["44%","46%"]:["50%","45%"], avoidLabelOverlap:true,
      itemStyle:{borderColor:T.surface,borderWidth:2},
      label:{color:T.ink,formatter:"{b}\n{d}%",fontSize:MOB()?10:12},
      data:COSTL.map((n,i)=>({name:n,value:[t.c,t.p,t.k,t.a][i]}))}]
  }, true);
}
function rOverview(){
  const A=compute(); let prev=null;
  if(cmpOn){ const len=dE-dS+1, pe=dS-1; if(pe>=0) prev=computeRange(Math.max(0,dS-len),pe); }
  drawKPIs(A,prev); drawOrders(); drawMoney(); drawDonut(); renderNote(A);
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
  el("noteBody").innerHTML = custom ? custom.replace(/\n/g,"<br>") : autoNote(A);
}

/* [ZONE W4 · Sản phẩm: bubble + bar lời/lỗ]  Status: LOCKED */
function drawBubble(){
  const e=eff("prodBubble"), A=computeRange(e.dS,e.dE); badge("prodBubble",A,e.cmp?prevOf(e):null);
  const rows=Object.keys(A.bp).map(n=>{const g=A.bp[n],x=ac(g);
    return {name:n,rev:g.r,orders:g.n,roi:x>0?g.r/x:null,margin:g.r-x};});
  const top=rows.filter(r=>r.roi!=null).sort((a,b)=>b.rev-a.rev).slice(0,MOB()?12:22);
  const col=r=> r.roi<1?T.crit : r.roi<1.15?T.cost[3] : T.good;
  const smax=Math.max(1,...top.map(r=>r.orders));
  const rois=top.map(r=>r.roi), rmin=Math.min(1,...rois), rmax=Math.max(...rois);  // giãn trục: bỏ vùng trống dưới min
  gc("prodBubble").setOption({
    tooltip:tip({trigger:"item",formatter:p=>{const r=p.data.o;
      return `<b>${r.name}</b><br>Doanh thu ${fF(r.rev)}đ<br>Net ROI ${r.roi.toFixed(2)}x<br>Số đơn ${r.orders}`;}}),
    grid:{left:48,right:26,top:16,bottom:28,containLabel:true},
    xAxis:{type:"value",axisLabel:{color:T.muted,formatter:fV,fontSize:MOB()?10:11},splitLine:sl()},
    yAxis:{type:"value",min:+(rmin-0.05).toFixed(2),max:+(rmax+0.05).toFixed(2),
      axisLabel:{color:T.muted,formatter:v=>v.toFixed(2)+"x",fontSize:MOB()?10:11},splitLine:sl()},
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
  const e=eff("prodBar"), A=computeRange(e.dS,e.dE); badge("prodBar",A,e.cmp?prevOf(e):null);
  const rows=Object.keys(A.bp).map(n=>{const g=A.bp[n],x=ac(g);
    return {name:n,rev:g.r,orders:g.n,roi:x>0?g.r/x:null,margin:g.r-x};});
  const bar=rows.sort((a,b)=>b.rev-a.rev).slice(0,MOB()?8:12).reverse();
  gc("prodBar").setOption({
    tooltip:tip({trigger:"item",valueFormatter:v=>fF(v)+" đ"}),
    grid:{left:8,right:54,top:14,bottom:22,containLabel:true},
    xAxis:{type:"value",axisLabel:{color:T.muted,formatter:fV,fontSize:MOB()?10:11},splitLine:sl()},
    yAxis:{type:"category",data:bar.map(r=>r.name.length>24?r.name.slice(0,24)+"…":r.name),
      axisLabel:{color:T.ink2,fontSize:MOB()?10:11},axisLine:{lineStyle:{color:T.axis}}},
    series:[{type:"bar",data:bar.map(r=>({value:r.margin,
        itemStyle:{color:r.margin>=0?T.good:T.crit,borderRadius:[0,5,5,0]}})),
      label:{show:true,position:"right",color:T.ink2,fontSize:11,formatter:p=>fV(p.value)}}]
  }, true);
}

/* [ZONE W5 · Kênh: ROI + cơ cấu chi phí %]  Status: LOCKED */
function drawChROI(){
  const e=eff("chROI"), A=computeRange(e.dS,e.dE); badge("chROI",A,e.cmp?prevOf(e):null);
  const nm=Object.keys(A.bc), net=[],roas=[],gross=[];
  nm.forEach(n=>{const g=A.bc[n],x=ac(g);
    net.push(x>0?+(g.r/x).toFixed(2):0); roas.push(g.a>0?+(g.r/g.a).toFixed(2):0);
    gross.push(g.c>0?+(g.r/g.c).toFixed(2):0);});
  const lbl={show:true,position:"top",color:T.ink2,fontSize:MOB()?9:11,formatter:p=>p.value?p.value.toFixed(2)+"x":""};
  gc("chROI").setOption({
    tooltip:tip({trigger:"axis",axisPointer:{type:"shadow"},valueFormatter:v=>(+v).toFixed(2)+"x"}),
    legend:{top:0,textStyle:{color:T.ink2}}, grid:{left:40,right:16,top:34,bottom:28,containLabel:true}, color:T.roi,
    xAxis:{type:"category",data:nm,axisLabel:axc(),axisLine:{lineStyle:{color:T.axis}}},
    yAxis:{type:"value",name:"ROI (x)",nameTextStyle:{color:T.muted},axisLabel:axc(),splitLine:sl()},
    series:[{name:"Net ROI",type:"bar",data:net,label:lbl,itemStyle:{borderRadius:[4,4,0,0]}},
      {name:"ROAS",type:"bar",data:roas,label:lbl,itemStyle:{borderRadius:[4,4,0,0]}},
      {name:"Gross ROI",type:"bar",data:gross,label:lbl,itemStyle:{borderRadius:[4,4,0,0]}}]
  }, true);
}
function drawChCost(){
  const e=eff("chCost"), A=computeRange(e.dS,e.dE); badge("chCost",A,e.cmp?prevOf(e):null);
  const nm=Object.keys(A.bc);
  const keys=["c","p","k","a"];
  const series=COSTL.map((nm2,ix)=>({name:nm2,type:"bar",stack:"x",color:T.cost[ix],
    itemStyle:{borderColor:T.surface,borderWidth:1},
    label:{show:true,color:"#fff",fontSize:MOB()?9:10,formatter:p=>p.value>=7?Math.round(p.value)+"%":""},
    data:nm.map(n=>{const g=A.bc[n];return g.r>0?+(g[keys[ix]]/g.r*100).toFixed(1):0;})}));
  gc("chCost").setOption({
    tooltip:tip({trigger:"axis",axisPointer:{type:"shadow"},valueFormatter:v=>(+v).toFixed(1)+"%"}),
    legend:{top:0,textStyle:{color:T.ink2}}, grid:{left:40,right:16,top:34,bottom:28,containLabel:true},
    xAxis:{type:"category",data:nm,axisLabel:axc(),axisLine:{lineStyle:{color:T.axis}}},
    yAxis:{type:"value",name:"% doanh thu",nameTextStyle:{color:T.muted},
      axisLabel:{color:T.muted,formatter:"{value}%",fontSize:MOB()?10:11},splitLine:sl()}, series
  }, true);
}

/* [ZONE W6 · Thời gian: dòng tiền + số đơn/ngày]  Status: LOCKED */
function drawMoney(){
  const e=eff("tlMoney"), A=computeRange(e.dS,e.dE), pA=e.cmp?prevOf(e):null;
  badge("tlMoney",A,pA);
  const dts=Object.keys(A.bd).sort(), g=d=>A.bd[d];
  const rev=dts.map(d=>g(d).r), mar=dts.map(d=>{const x=g(d);return x.r-ac(x);});
  const STEP=Math.max(1,Math.ceil(dts.length/12)), everyDay=dts.length<=45;
  const avgR=rev.length?rev.reduce((s,x)=>s+x,0)/rev.length:0;
  if(el("tlAvg")) el("tlAvg").textContent=" · TB/ngày: "+fV(avgR);
  const costS=[["c","COGS"],["p","Platform"],["k","Ads"],["a","KOC"]].map((kk,ix)=>({
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
  gc("tlMoney").setOption({
    tooltip:tip({trigger:"axis",valueFormatter:v=>fF(v)+" đ"}),
    legend:{top:0,textStyle:{color:T.ink2}}, grid:{left:48,right:18,top:34,bottom:28,containLabel:true},
    xAxis:{type:"category",data:dts,axisLabel:axc(),axisLine:{lineStyle:{color:T.axis}}},
    yAxis:{type:"value",axisLabel:{color:T.muted,formatter:fV,fontSize:MOB()?10:11},splitLine:sl()},
    series
  }, true);
}
function drawOrders(){
  const e=eff("tlOrders"), A=computeRange(e.dS,e.dE), pA=e.cmp?prevOf(e):null;
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
  gc("tlOrders").setOption({
    tooltip:tip({trigger:"axis",axisPointer:{type:"shadow"}}),
    legend: pA?{top:0,textStyle:{color:T.ink2}}:undefined,
    grid:{left:44,right:18,top:pA?30:22,bottom:28,containLabel:true},
    xAxis:{type:"category",data:dts,axisLabel:axc(),axisLine:{lineStyle:{color:T.axis}}},
    yAxis:{type:"value",name:"Số đơn",nameTextStyle:{color:T.muted},axisLabel:axc(),splitLine:sl()},
    series
  }, true);
}

/* ---------- điều phối ---------- */
const RENDER={ ovCost:drawDonut, tlOrders:drawOrders, tlMoney:drawMoney,
  prodBubble:drawBubble, prodBar:drawProdBar, chROI:drawChROI, chCost:drawChCost };
let active="ov";
function renderActive(){
  if(active==="ov") rOverview();
  else if(active==="prod"){ drawBubble(); drawProdBar(); }
  else if(active==="ch"){ drawChROI(); drawChCost(); }
  setTimeout(()=>Object.values(charts).forEach(c=>c.resize()),30);
}
function mountControls(){
  document.querySelectorAll(".card[data-chart]").forEach(card=>{
    const id=card.dataset.chart; if(card.querySelector(".chartctrl")) return;
    const h2=card.querySelector("h2");
    const head=document.createElement("div"); head.className="cardhead";
    h2.parentNode.insertBefore(head,h2); head.appendChild(h2);
    const box=document.createElement("div"); box.className="chartctrl";
    box.innerHTML=`<span class="ccmp" data-ccmp="${id}"></span>`+
      `<select class="cc-sel"><option value="g">Theo tổng</option><option value="7">7 ngày</option>`+
      `<option value="14">14 ngày</option><option value="30">30 ngày</option>`+
      `<option value="90">90 ngày</option><option value="all">Tất cả</option></select>`+
      `<label class="cc-chk" title="So sánh kỳ trước"><input type="checkbox"> SS</label>`;
    head.appendChild(box);
    const sel=box.querySelector("select"), chk=box.querySelector("input");
    chk.checked = st(id).cOv ? st(id).cmp : cmpOn;
    sel.onchange=()=>{ const s=st(id);
      if(sel.value==="g"){ s.dOv=false; }
      else { s.dOv=true; if(sel.value==="all"){ s.dS=0; s.dE=DATES.length-1; }
        else { const n=+sel.value; s.dE=DATES.length-1; s.dS=Math.max(0,DATES.length-n); } }
      RENDER[id] && RENDER[id](); };
    chk.onchange=()=>{ const s=st(id); s.cOv=true; s.cmp=chk.checked; RENDER[id] && RENDER[id](); };
  });
}
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
  opts.map(o=>`<option value="${o}">${o}</option>`).join(""); }
if(META.date) el("updated").textContent = "Cập nhật "+META.date+" · nguồn nội bộ";
fill(el("fCh"),DATA.channels); fill(el("fSet"),DATA.settles);
el("fCh").onchange=renderActive; el("fSet").onchange=renderActive;
// thanh kéo khoảng ngày (mặc định 30 ngày gần nhất)
const drS=el("drStart"), drE=el("drEnd"), DN=Math.max(1,DATES.length-1);
drS.max=drE.max=DN; drS.value=dS; drE.value=dE;
function drPaint(){ el("rfill").style.left=(dS/DN*100)+"%"; el("rfill").style.width=((dE-dS)/DN*100)+"%";
  el("drLabel").textContent=DATES.length?(DATES[dS]+" → "+DATES[dE]+" ("+(dE-dS+1)+" ngày)"):"—"; }
function drUpdate(){ dS=+drS.value; dE=+drE.value; if(dS>dE){const x=dS;dS=dE;dE=x;} drPaint(); renderActive(); }
drS.oninput=drE.oninput=drUpdate;
el("cmp").onchange=e=>{ cmpOn=e.target.checked; renderActive(); };
drPaint();
// ô ghi chú: Sửa / Lưu / Về mặc định
el("noteEdit").onclick=()=>{ el("noteText").value=localStorage.getItem(NOTE_KEY)||"";
  el("noteEditWrap").style.display="block"; el("noteBody").style.display="none"; };
el("noteSave").onclick=()=>{ localStorage.setItem(NOTE_KEY, el("noteText").value);
  el("noteEditWrap").style.display="none"; el("noteBody").style.display="block"; renderNote(_noteA||compute()); };
el("noteReset").onclick=()=>{ localStorage.removeItem(NOTE_KEY); el("noteText").value="";
  el("noteEditWrap").style.display="none"; el("noteBody").style.display="block"; renderNote(_noteA||compute()); };
mountControls();   // gắn bộ lọc ngày + SS riêng vào từng chart
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
let rz; window.addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(()=>{
  Object.values(charts).forEach(c=>c.resize());},150);});
function routeHash(){ const h=(location.hash||"").replace("#","").split(":");
  if(h[0]==="clients"){ switchView("clients");
    if(h.includes("cmp")){ cmpOn=true; const cb=el("cmp"); if(cb) cb.checked=true; }
    if(h[1] && h[1]!=="cmp") switchTab(h[1]); else renderActive();
  } else switchView("home"); }
window.addEventListener("hashchange",routeHash);
routeHash();
