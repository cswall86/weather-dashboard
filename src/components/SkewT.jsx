import { useEffect, useRef, useState } from "react";
import { useWeatherStore } from "../store/useWeatherStore";

const toC = (f) => ((f - 32) * 5) / 9;

export default function SkewT({ snd }) {
  const cvRef = useRef(null);
  const coordsRef = useRef([]);
  const [tip, setTip] = useState(null);
  
  const customParcel = useWeatherStore((state) => state.customParcel);
  const setCustomParcel = useWeatherStore((state) => state.setCustomParcel);

  // Widened to fit the SPC Wind Speed Bar Chart
  const cssW = 460; 
  const cssH = 450;

  useEffect(() => {
    if (!snd || !cvRef.current) return;
    const cv = cvRef.current;
    const ctx = cv.getContext("2d");
    
    const dpr = window.devicePixelRatio || 1;
    cv.width = cssW * dpr; cv.height = cssH * dpr;
    cv.style.width = `${cssW}px`; cv.style.height = `${cssH}px`;
    ctx.scale(dpr, dpr);

    const ml = 35, mr = 130, mt = 20, mb = 25; 
    const pw = cssW - ml - mr, ph = cssH - mt - mb;
    const pMax = 1050, pMin = 100, tRef = -40, tRng = 120, skF = 0.6; 

    const pY = (p) => mt + ph * (Math.log(pMax) - Math.log(p)) / (Math.log(pMax) - Math.log(pMin));
    const tX = (t, p) => ml + pw * (t - tRef) / tRng + pw * skF * (Math.log(pMax) - Math.log(p)) / (Math.log(pMax) - Math.log(pMin));

    // 1. Background
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.save(); ctx.beginPath(); ctx.rect(ml, mt, pw, ph); ctx.clip();

    // 2. Isobars (Horizontal Pressure Lines)
    for (let p = 1000; p >= 100; p -= 100) {
      const y = pY(p);
      ctx.strokeStyle = p % 500 === 0 ? "#334155" : "#1e293b";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(ml + pw, y); ctx.stroke();
    }

    // 3. Isotherms (Angled Temp Lines)
    for (let t = -100; t <= 50; t += 10) {
      ctx.beginPath();
      for (let p = pMax; p >= pMin; p -= 10) {
        const x = tX(t, p), y = pY(p);
        p === pMax ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = t === 0 ? "#0ea5e9" : "#1e293b"; // Bright blue 0C line
      ctx.lineWidth = t === 0 ? 1.5 : 0.8;
      ctx.stroke();
    }

    // 4. Mixing Ratio Lines (Dashed Green)
    const mixingRatios = [1, 2, 4, 8, 12, 16, 20];
    ctx.strokeStyle = "rgba(22, 163, 74, 0.4)";
    ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    mixingRatios.forEach(w => {
      ctx.beginPath(); let fst = true;
      for (let p = pMax; p >= 400; p -= 50) {
        const e = (w * p) / (622 + w);
        const lnE = Math.log(e / 6.112);
        const T = (243.5 * lnE) / (17.67 - lnE);
        const x = tX(T, p), y = pY(p);
        fst ? ctx.moveTo(x, y) : ctx.lineTo(x, y); fst = false;
      }
      ctx.stroke();
    });

    // 5. Dry Adiabats (Curved Solid Orange)
    ctx.strokeStyle = "rgba(217, 119, 6, 0.4)"; 
    ctx.setLineDash([]); ctx.lineWidth = 1;
    for (let th = -30; th <= 100; th += 10) {
      ctx.beginPath(); let fst = true;
      for (let p = pMax; p >= pMin; p -= 10) {
        const Tk = (th + 273.15) * Math.pow(p / 1000, 0.286);
        const x = tX(Tk - 273.15, p), y = pY(p);
        fst ? ctx.moveTo(x, y) : ctx.lineTo(x, y); fst = false;
      }
      ctx.stroke();
    }

    // 6. Moist Adiabats (Curved Dashed Blue)
    ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
    ctx.setLineDash([5, 5]); ctx.lineWidth = 1;
    for (let tw = -20; tw <= 40; tw += 5) {
       ctx.beginPath(); let fst = true;
       // Simplified pseudo-adiabat visual curve
       for (let p = pMax; p >= 200; p -= 20) {
          const lapse = 0.005; // rough wet adiabatic lapse approx
          const T = tw - lapse * (pMax - p); 
          const x = tX(T, p), y = pY(p);
          fst ? ctx.moveTo(x, y) : ctx.lineTo(x, y); fst = false;
       }
       ctx.stroke();
    }
    ctx.setLineDash([]); ctx.restore();

    // 7. Interactive Custom Parcel Lift
    if (customParcel) {
      ctx.save(); ctx.beginPath(); ctx.rect(ml, mt, pw, ph); ctx.clip();
      ctx.strokeStyle = "#eab308"; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); let fp = true;
      for (let p = customParcel.p; p >= pMin; p -= 5) {
        const Tv = (customParcel.t + 273.15) * Math.pow(p / customParcel.p, 0.286) - 273.15;
        const x = tX(Tv, p), y = pY(p);
        fp ? ctx.moveTo(x, y) : ctx.lineTo(x, y); fp = false;
      }
      ctx.stroke(); ctx.restore();
      ctx.fillStyle = "#eab308";
      ctx.beginPath(); ctx.arc(tX(customParcel.t, customParcel.p), pY(customParcel.p), 4, 0, Math.PI * 2); ctx.fill();
    }

    // 8. Plot Data Profiles (Temp & Dewpoint)
    const plot = (vals, color, width) => {
      ctx.save(); ctx.beginPath(); ctx.rect(ml, mt, pw, ph); ctx.clip();
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round";
      ctx.beginPath(); let f = true;
      snd.lvls.forEach((p, i) => {
        if (vals[i] == null) return;
        const x = tX(toC(vals[i]), p), y = pY(p);
        f ? ctx.moveTo(x, y) : ctx.lineTo(x, y); f = false;
      });
      ctx.stroke(); ctx.restore();
    };
    plot(snd.T, "#ef4444", 2.5);  // Temp Red
    plot(snd.Td, "#22c55e", 2.5); // Dew Green

    // 9. SPC Wind Barb Pane
    const barbX = cssW - mr + 20;
    ctx.fillStyle = "#0f172a"; ctx.fillRect(cssW - mr, mt, mr, ph);
    ctx.strokeStyle = "#334155"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cssW - mr, mt); ctx.lineTo(cssW - mr, mt + ph); ctx.stroke();
    
    // Wind Speed Bar Chart Pane
    const barX = cssW - mr + 60;
    ctx.beginPath(); ctx.moveTo(barX, mt); ctx.lineTo(barX, mt + ph); ctx.stroke();

    const wBarb = (x, y, kts, dir) => {
      if (kts < 1) return;
      const R = (d) => (d * Math.PI) / 180, dr = R(dir), sLen = 20;
      const dx = Math.sin(dr), dy = -Math.cos(dr), tx = x + dx * sLen, ty = y + dy * sLen;
      const bx = -Math.cos(dr), by = -Math.sin(dr);
      ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
      let rem = Math.round(kts / 5) * 5, pos = 0;
      const pnts = Math.floor(rem / 50); rem = rem % 50; const full = Math.floor(rem / 10); rem = rem % 10; const half = rem >= 5 ? 1 : 0;
      for (let i = 0; i < pnts; i++) {
        ctx.fillStyle = "#cbd5e1"; ctx.beginPath();
        ctx.moveTo(tx - dx * pos, ty - dy * pos); ctx.lineTo(tx - dx * (pos + 6), ty - dy * (pos + 6));
        ctx.lineTo(tx - dx * pos + bx * 10, ty - dy * pos + by * 10); ctx.closePath(); ctx.fill(); pos += 6;
      }
      if (pnts) pos += 3;
      for (let j = 0; j < full; j++) {
        ctx.beginPath(); ctx.moveTo(tx - dx * pos, ty - dy * pos); ctx.lineTo(tx - dx * pos + bx * 9, ty - dy * pos + by * 9); ctx.stroke(); pos += 4;
      }
      if (half) { ctx.beginPath(); ctx.moveTo(tx - dx * pos, ty - dy * pos); ctx.lineTo(tx - dx * pos + bx * 5, ty - dy * pos + by * 5); ctx.stroke(); }
    };

    snd.lvls.forEach((p, i) => {
      if (snd.ws[i] != null && snd.wd[i] != null) {
        const y = pY(p);
        wBarb(barbX, y, snd.ws[i] * 0.869, snd.wd[i]);
        // Draw Speed Bar
        const kts = snd.ws[i] * 0.869;
        const bW = Math.min(kts * 0.5, mr - 65);
        ctx.fillStyle = kts > 50 ? "#c084fc" : kts > 30 ? "#38bdf8" : "#4ade80";
        ctx.fillRect(barX + 2, y - 2, bW, 4);
      }
    });

    // 10. Axis Labels
    ctx.fillStyle = "#94a3b8"; ctx.font = "10px sans-serif";
    [1000, 850, 700, 500, 300, 200, 100].forEach(p => {
      const y = pY(p); ctx.textAlign = "right"; ctx.fillText(p, ml - 4, y + 4);
    });
    ctx.textAlign = "center";
    for (let t = -40; t <= 40; t += 20) {
      const x = tX(t, pMax); if (x >= ml && x <= ml + pw) ctx.fillText(t + "C", x, cssH - mb + 14);
    }

    // Hover logic
    const pts = [];
    snd.lvls.forEach((p, i) => {
      if (snd.T[i] != null) pts.push({ x: tX(toC(snd.T[i]), p), y: pY(p), label: "Temp @ " + p + "mb", val: Math.round(snd.T[i]) + "°F" });
      if (snd.Td[i] != null) pts.push({ x: tX(toC(snd.Td[i]), p), y: pY(p), label: "Dewpt @ " + p + "mb", val: Math.round(snd.Td[i]) + "°F" });
    });
    coordsRef.current = pts;

  }, [snd, customParcel]);

  const handleMouseMove = (e) => {
    if (!cvRef.current) return;
    const rect = cvRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    let best = null, bestD = 400; 
    coordsRef.current.forEach((pt) => {
      const d = (pt.x - cx) ** 2 + (pt.y - cy) ** 2;
      if (d < bestD) { bestD = d; best = pt; }
    });
    setTip(best ? { x: cx, y: cy, label: best.label, val: best.val } : null);
  };

  const handleClick = (e) => {
    const rect = cvRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const ml = 35, mr = 130, mt = 20, mb = 25; 
    const pw = cssW - ml - mr, ph = cssH - mt - mb;
    const pMax = 1050, pMin = 100, tRef = -40, tRng = 120, skF = 0.6; 
    const logRatio = (cy - mt) / ph;
    const logP = Math.log(pMax) - logRatio * (Math.log(pMax) - Math.log(pMin));
    const clickedP = Math.exp(logP);
    const tRatio = (cx - ml - pw * skF * logRatio) / pw;
    const clickedT = tRef + tRatio * tRng;
    if (clickedP >= pMin && clickedP <= pMax) setCustomParcel({ p: clickedP, t: clickedT });
  };

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={cvRef} style={{ border: "1px solid #1e293b", borderRadius: 4, cursor: "crosshair", display: "block" }} 
        onMouseMove={handleMouseMove} onMouseLeave={() => setTip(null)} onClick={handleClick} />
      {tip && (
        <div style={{ position: "absolute", background: "rgba(2,6,23,.95)", border: "1px solid #334155", borderRadius: 4, padding: "4px 8px", fontSize: 11, color: "#f8fafc", pointerEvents: "none", zIndex: 10, transform: "translate(14px, -10px)", left: tip.x, top: tip.y }}>
          <div style={{ fontWeight: 700, color: "#38bdf8" }}>{tip.label}</div>
          <div>{tip.val}</div>
        </div>
      )}
    </div>
  );
}