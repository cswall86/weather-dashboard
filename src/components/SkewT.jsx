import { useEffect, useRef } from "react";
import { useWeatherStore } from "../store/useWeatherStore";

export default function SkewT({ snd }) {
  const cvRef = useRef(null);
  const customParcel = useWeatherStore((state) => state.customParcel);
  const setCustomParcel = useWeatherStore((state) => state.setCustomParcel);

  useEffect(() => {
    if (!snd || !cvRef.current) return;
    
    const cv = cvRef.current;
    const ctx = cv.getContext("2d");
    
    // High-DPI screen fix
    const dpr = window.devicePixelRatio || 1;
    const rect = cv.getBoundingClientRect();
    cv.width = rect.width * dpr;
    cv.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    
    const ml = 44, mr = 46, mt = 14, mb = 26;
    const pw = W - ml - mr, ph = H - mt - mb;
    const pMax = 1050, pMin = 100, tRef = -50, tRng = 100, skF = 0.5;

    const pY = (p) => mt + ph * (Math.log(pMax) - Math.log(p)) / (Math.log(pMax) - Math.log(pMin));
    const tX = (t, p) => ml + pw * (t - tRef) / tRng + pw * skF * (Math.log(pMax) - Math.log(p)) / (Math.log(pMax) - Math.log(pMin));

    // Clear background
    ctx.fillStyle = "#060d1a";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.beginPath();
    ctx.rect(ml, mt, pw, ph);
    ctx.clip();

    // Draw Isobars and Isotherms
    for (let t = -80; t <= 70; t += 10) {
      ctx.beginPath();
      for (let p = pMax; p >= pMin; p -= 5) {
        const x = tX(t, p), y = pY(p);
        p === pMax ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = t === 0 ? "#1e5080" : t % 20 === 0 ? "#0d2a45" : "#0a1e35";
      ctx.lineWidth = t === 0 ? 1.5 : 0.5;
      ctx.stroke();
    }

    // Draw User's Custom Parcel Lift (If Clicked)
    if (customParcel) {
      ctx.strokeStyle = "#eab308"; // bright yellow
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
      
      // Draw Dot at click origin
      ctx.fillStyle = "#eab308";
      ctx.beginPath();
      ctx.arc(tX(customParcel.t, customParcel.p), pY(customParcel.p), 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Plot real profile data
    const plot = (vals, color) => {
      ctx.save(); ctx.beginPath(); ctx.rect(ml, mt, pw, ph); ctx.clip();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
      let f = true;
      snd.lvls.forEach((p, i) => {
        if (vals[i] == null) return;
        const tC = (vals[i] - 32) * 5/9; // Convert F to C for plotting
        const x = tX(tC, p), y = pY(p);
        f ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        f = false;
      });
      ctx.stroke(); ctx.restore();
    };

    plot(snd.T, "#ef4444"); // Temp
    plot(snd.Td, "#22c55e"); // Dewpoint
  }, [snd, customParcel]);

  // Reverse math to calculate Temp/Pressure from Canvas Click
  const handleClick = (e) => {
    const rect = cvRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const ml = 44, mr = 46, mt = 14, mb = 26;
    const pw = rect.width - ml - mr, ph = rect.height - mt - mb;
    const pMax = 1050, pMin = 100, tRef = -50, tRng = 100, skF = 0.5;

    // Reverse Pressure Y
    const logRatio = (cy - mt) / ph;
    const logP = Math.log(pMax) - logRatio * (Math.log(pMax) - Math.log(pMin));
    const clickedP = Math.exp(logP);

    // Reverse Temp X
    const tRatio = (cx - ml - pw * skF * logRatio) / pw;
    const clickedT = tRef + tRatio * tRng;

    // Save to store
    if (clickedP >= pMin && clickedP <= pMax) {
      setCustomParcel({ p: clickedP, t: clickedT });
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <canvas 
        ref={cvRef} 
        style={{ width: "320px", height: "400px", border: "1px solid #162640", borderRadius: 8, cursor: "crosshair" }} 
        onClick={handleClick}
      />
      {customParcel && (
        <div style={{ fontSize: 10, color: '#eab308', marginTop: 4 }}>
          Custom parcel lifted from {Math.round(customParcel.p)}hPa @ {customParcel.t.toFixed(1)}°C
          <button style={{marginLeft: 8, background: 'transparent', border: '1px solid #eab308', color: '#eab308', borderRadius: 4, cursor: 'pointer'}} onClick={() => setCustomParcel(null)}>Clear</button>
        </div>
      )}
    </div>
  );
}