import { useEffect, useRef, useState } from "react";
import { useWeatherStore } from "../store/useWeatherStore";

const toC = (f) => ((f - 32) * 5) / 9;

export default function SkewT({ snd }) {
  const cvRef = useRef(null);
  const coordsRef = useRef([]);
  const [tip, setTip] = useState(null);
  
  const customParcel = useWeatherStore((state) => state.customParcel);
  const setCustomParcel = useWeatherStore((state) => state.setCustomParcel);

  const cssW = 340; // Widened slightly to fit the wind barb pane
  const cssH = 400;

  useEffect(() => {
    if (!snd || !cvRef.current) return;
    
    const cv = cvRef.current;
    const ctx = cv.getContext("2d");
    
    // High-DPI screen fix
    const dpr = window.devicePixelRatio || 1;
    cv.width = cssW * dpr;
    cv.height = cssH * dpr;
    cv.style.width = `${cssW}px`;
    cv.style.height = `${cssH}px`;
    ctx.scale(dpr, dpr);

    const ml = 40, mr = 50, mt = 14, mb = 26; // mr=50 creates the dedicated wind pane
    const pw = cssW - ml - mr, ph = cssH - mt - mb;
    const pMax = 1050, pMin = 100, tRef = -50, tRng = 100, skF = 0.55; // skF adjusted for SPC skew angle

    const pY = (p) => mt + ph * (Math.log(pMax) - Math.log(p)) / (Math.log(pMax) - Math.log(pMin));
    const tX = (t, p) => ml + pw * (t - tRef) / tRng + pw * skF * (Math.log(pMax) - Math.log(p)) / (Math.log(pMax) - Math.log(pMin));

    // 1. Background
    ctx.fillStyle = "#060d1a";
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(ml, mt, pw, ph);
    ctx.clip();

    // 2. Isobars (Horizontal Pressure Lines)
    for (let p = 1000; p >= 100; p -= 100) {
      const y = pY(p);
      ctx.strokeStyle = "#1e3a5f";
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(ml + pw, y); ctx.stroke();
    }

    // 3. Isotherms (Angled Temperature Lines)
    for (let t = -100; t <= 50; t += 10) {
      ctx.beginPath();
      for (let p = pMax; p >= pMin; p -= 5) {
        const x = tX(t, p), y = pY(p);
        p === pMax ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = t === 0 ? "#0ea5e9" : "#1e3a5f"; // Highlight 0C in bright blue
      ctx.lineWidth = t === 0 ? 1.5 : 0.8;
      ctx.stroke();
    }

    // 4. Mixing Ratio Lines (Dashed Green)
    const mixingRatios = [2, 4, 8, 12, 16, 20];
    ctx.strokeStyle = "rgba(34, 197, 94, 0.4)";
    ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 4]);
    mixingRatios.forEach(w => {
      ctx.beginPath();
      let fst = true;
      for (let p = pMax; p >= 400; p -= 50) {
        const e = (w * p) / (622 + w);
        const lnE = Math.log(e / 6.112);
        const T = (243.5 * lnE) / (17.67 - lnE);
        const x = tX(T, p), y = pY(p);
        fst ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        fst = false;
      }
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // 5. Dry Adiabats (Curved Solid Orange)
    ctx.strokeStyle = "rgba(214, 158, 46, 0.4)"; 
    ctx.lineWidth = 0.8;
    for (let th = -30; th <= 100; th += 10) {
      ctx.beginPath();
      let fst = true;
      for (let p = pMax; p >= pMin; p -= 10) {
        const ThetaK = th + 273.15;
        const Tk = ThetaK * Math.pow(p / 1000, 0.286);
        const Tc = Tk - 273.15;
        const x = tX(Tc, p), y = pY(p);
        fst ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        fst = false;
      }
      ctx.stroke();
    }

    // 6. Default Parcel Trace (Dotted Silver)
    if (snd.T[0] != null && snd.Td[0] != null) {
      const T0 = toC(snd.T[0]), Td0 = toC(snd.Td[0]), lcl = 1000 - 125 * (T0 - Td0);
      ctx.strokeStyle = "rgba(205, 217, 232, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      let fp = true;
      for (let p = 1000; p >= Math.max(pMin, lcl - 5); p -= 5) {
        const Tv = (T0 + 273.15) * Math.pow(p / 1000, 0.286) - 273.15;
        const x = tX(Tv, p), y = pY(p);
        fp ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        fp = false;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      
      // LCL Marker
      if (lcl > pMin && lcl < 1000) {
        const y = pY(lcl);
        ctx.fillStyle = "#cdd9e8";
        ctx.beginPath(); ctx.arc(ml - 4, y, 2, 0, Math.PI * 2); ctx.fill();
        ctx.font = "8px sans-serif"; ctx.textAlign = "left";
        ctx.fillText("LCL", ml + 2, y - 4);
      }
    }

    // 7. Interactive User Parcel Lift (Dashed Yellow)
    if (customParcel) {
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      let fp = true;
      for (let p = customParcel.p; p >= pMin; p -= 5) {
        const Tv = (customParcel.t + 273.15) * Math.pow(p / customParcel.p, 0.286) - 273.15;
        const x = tX(Tv, p), y = pY(p);
        fp ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        fp = false;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#eab308";
      ctx.beginPath(); ctx.arc(tX(customParcel.t, customParcel.p), pY(customParcel.p), 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // 8. Plot Data Profiles (Temp & Dewpoint)
    const plot = (vals, color, width) => {
      ctx.save(); ctx.beginPath(); ctx.rect(ml, mt, pw, ph); ctx.clip();
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round";
      ctx.beginPath();
      let f = true;
      snd.lvls.forEach((p, i) => {
        if (vals[i] == null) return;
        const x = tX(toC(vals[i]), p), y = pY(p);
        f ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        f = false;
      });
      ctx.stroke(); ctx.restore();
    };
    plot(snd.T, "#ef4444", 2.5);  // Temp (Red)
    plot(snd.Td, "#22c55e", 2.5); // Dewpoint (Green)

    // 9. SPC Wind Barb Pane
    ctx.fillStyle = "#08111f";
    ctx.fillRect(cssW - mr, mt, mr, ph);
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cssW - mr, mt); ctx.lineTo(cssW - mr, mt + ph); ctx.stroke();

    const wBarb = (x, y, kts, dir) => {
      if (kts < 1) {
        ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.stroke();
        return;
      }
      const R = (d) => (d * Math.PI) / 180, dr = R(dir), sLen = 20;
      const dx = Math.sin(dr), dy = -Math.cos(dr), tx = x + dx * sLen, ty = y + dy * sLen;
      const bx = -Math.cos(dr), by = -Math.sin(dr);
      
      ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
      
      let rem = Math.round(kts / 5) * 5, pos = 0;
      const pnts = Math.floor(rem / 50); rem = rem % 50;
      const full = Math.floor(rem / 10); rem = rem % 10;
      const half = rem >= 5 ? 1 : 0;
      
      for (let i = 0; i < pnts; i++) {
        ctx.fillStyle = "#cbd5e1"; ctx.beginPath();
        ctx.moveTo(tx - dx * pos, ty - dy * pos);
        ctx.lineTo(tx - dx * (pos + 6), ty - dy * (pos + 6));
        ctx.lineTo(tx - dx * pos + bx * 10, ty - dy * pos + by * 10);
        ctx.closePath(); ctx.fill(); pos += 6;
      }
      if (pnts) pos += 3;
      for (let j = 0; j < full; j++) {
        ctx.beginPath(); ctx.moveTo(tx - dx * pos, ty - dy * pos); ctx.lineTo(tx - dx * pos + bx * 9, ty - dy * pos + by * 9); ctx.stroke(); pos += 4;
      }
      if (half) {
        ctx.beginPath(); ctx.moveTo(tx - dx * pos, ty - dy * pos); ctx.lineTo(tx - dx * pos + bx * 5, ty - dy * pos + by * 5); ctx.stroke();
      }
    };

    snd.lvls.forEach((p, i) => {
      if (snd.ws[i] != null && snd.wd[i] != null) {
        wBarb(cssW - mr + 25, pY(p), snd.ws[i] * 0.869, snd.wd[i]);
      }
    });

    // 10. Axis Labels
    ctx.fillStyle = "#64748b"; ctx.font = "9px sans-serif";
    [1000, 850, 700, 500, 300, 200].forEach(p => {
      const y = pY(p);
      ctx.textAlign = "right"; ctx.fillText(p, ml - 4, y + 3);
    });
    ctx.textAlign = "center";
    for (let t = -40; t <= 40; t += 20) {
      const x = tX(t, pMax);
      if (x >= ml && x <= ml + pw) ctx.fillText(t + "C", x, cssH - mb + 12);
    }

    // 11. Build Interactive Hover Hitboxes
    const pts = [];
    snd.lvls.forEach((p, i) => {
      if (snd.T[i] != null) pts.push({ x: tX(toC(snd.T[i]), p), y: pY(p), label: "Temp @ " + p + "hPa", val: Math.round(snd.T[i]) + "°F / " + toC(snd.T[i]).toFixed(1) + "°C" });
      if (snd.Td[i] != null) pts.push({ x: tX(toC(snd.Td[i]), p), y: pY(p), label: "Dewpt @ " + p + "hPa", val: Math.round(snd.Td[i]) + "°F / " + toC(snd.Td[i]).toFixed(1) + "°C" });
    });
    coordsRef.current = pts;

  }, [snd, customParcel]);

  // ── Hover & Click Interactions ──
  const handleMouseMove = (e) => {
    if (!cvRef.current) return;
    const rect = cvRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    let best = null, bestD = 400; // Hitbox radius
    coordsRef.current.forEach((pt) => {
      const d = (pt.x - cx) ** 2 + (pt.y - cy) ** 2;
      if (d < bestD) { bestD = d; best = pt; }
    });
    setTip(best ? { x: cx, y: cy, label: best.label, val: best.val } : null);
  };

  const handleClick = (e) => {
    const rect = cvRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const ml = 40, mr = 50, mt = 14, mb = 26;
    const pw = cssW - ml - mr, ph = cssH - mt - mb;
    const pMax = 1050, pMin = 100, tRef = -50, tRng = 100, skF = 0.55;

    const logRatio = (cy - mt) / ph;
    const logP = Math.log(pMax) - logRatio * (Math.log(pMax) - Math.log(pMin));
    const clickedP = Math.exp(logP);
    const tRatio = (cx - ml - pw * skF * logRatio) / pw;
    const clickedT = tRef + tRatio * tRng;

    if (clickedP >= pMin && clickedP <= pMax) setCustomParcel({ p: clickedP, t: clickedT });
  };

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={cvRef} style={{ border: "1px solid #162640", borderRadius: 8, cursor: "crosshair", display: "block" }} 
        onMouseMove={handleMouseMove} onMouseLeave={() => setTip(null)} onClick={handleClick} />
      {tip && (
        <div style={{ position: "absolute", background: "rgba(8,17,31,.97)", border: "1px solid #1e3a5f", borderRadius: 7, padding: "6px 10px", fontSize: 12, color: "#cdd9e8", pointerEvents: "none", zIndex: 9999, transform: "translate(14px, -10px)", left: tip.x, top: tip.y }}>
          <div style={{ fontWeight: 700, color: "#3d8bff", marginBottom: 2 }}>{tip.label}</div>
          <div>{tip.val}</div>
        </div>
      )}
      {customParcel && (
        <div style={{ fontSize: 10, color: '#eab308', marginTop: 6, textAlign: "center" }}>
          Parcel lifted from {Math.round(customParcel.p)}hPa @ {customParcel.t.toFixed(1)}°C
          <button style={{marginLeft: 8, background: 'transparent', border: '1px solid #eab308', color: '#eab308', borderRadius: 4, cursor: 'pointer', fontSize: 9}} onClick={() => setCustomParcel(null)}>Clear</button>
        </div>
      )}
    </div>
  );
}