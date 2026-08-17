import { useEffect, useRef, useState } from "react";

const wdir = (d) => ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(d / 22.5) % 16];

export default function Hodograph({ snd }) {
  const cvRef = useRef(null);
  const coordsRef = useRef([]);
  const [tip, setTip] = useState(null);

  const cssW = 340; 
  const cssH = 340;

  useEffect(() => {
    if (!snd || !cvRef.current) return;
    const cv = cvRef.current;
    const ctx = cv.getContext("2d");
    
    const dpr = window.devicePixelRatio || 1;
    cv.width = cssW * dpr; cv.height = cssH * dpr;
    cv.style.width = `${cssW}px`; cv.style.height = `${cssH}px`;
    ctx.scale(dpr, dpr);

    const cx = cssW / 2, cy = cssH / 2;
    
    // 1. Background
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, cssW, cssH);

    // 2. Pre-process Wind Points & Dynamic Scale
    const tr = (d) => (d * Math.PI) / 180;
    const sfcH = snd.gh[0] != null ? snd.gh[0] : 0; 
    
    const pts = snd.lvls.map((p, i) => {
      if (snd.ws[i] == null || snd.wd[i] == null || snd.gh[i] == null) return null;
      const kts = snd.ws[i] * 0.869;
      const agl = snd.gh[i] - sfcH; 
      
      let color = "#ef4444"; // Red (Sfc-3km)
      if (agl >= 3000 && agl < 6000) color = "#22c55e"; // Green (3-6km)
      else if (agl >= 6000 && agl < 9000) color = "#eab308"; // Yellow (6-9km)
      else if (agl >= 9000) color = "#06b6d4"; // Cyan (9km+)
      
      return { 
        u: -kts * Math.sin(tr(snd.wd[i])), 
        v: -kts * Math.cos(tr(snd.wd[i])), 
        p, agl, color, kts, dir: snd.wd[i]
      };
    }).filter(Boolean);

    if (pts.length < 2) return;

    // Dynamic scale bounds based on actual wind
    const maxWs = Math.max(...pts.map(p => Math.sqrt(p.u**2 + p.v**2)));
    const maxSpd = Math.max(80, Math.ceil(maxWs / 10) * 10);
    const sc = (spd) => (spd / maxSpd) * (cssW / 2 - 25);

    // 3. Crosshairs & Axes
    ctx.strokeStyle = "rgba(245, 158, 11, 0.4)"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 10); ctx.lineTo(cx, cssH - 10);
    ctx.moveTo(10, cy); ctx.lineTo(cssW - 10, cy);
    ctx.stroke();

    // 4. SPC Style Rings & Axis Labels
    ctx.fillStyle = "#d97706"; ctx.font = "9px sans-serif"; 
    for (let r = 10; r <= maxSpd; r += 10) {
      const rad = sc(r);
      ctx.strokeStyle = r % 20 === 0 ? "rgba(245, 158, 11, 0.5)" : "rgba(245, 158, 11, 0.2)";
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
      
      // Labels along the Positive X & Y Axes
      if (r % 10 === 0) {
        ctx.textAlign = "center"; ctx.fillText(r, cx + rad, cy + 12); // X Axis
        ctx.textAlign = "left"; ctx.fillText(r, cx + 4, cy - rad + 3); // Y Axis
      }
    }

    // 5. Draw Shear Line
    ctx.lineWidth = 2.5;
    for (let i = 0; i < pts.length - 1; i++) {
      ctx.strokeStyle = pts[i].color;
      ctx.beginPath();
      ctx.moveTo(cx + sc(pts[i].u), cy - sc(pts[i].v));
      ctx.lineTo(cx + sc(pts[i + 1].u), cy - sc(pts[i + 1].v));
      ctx.stroke();
    }

    // 6. Draw Bunkers Right Mover (RM) Vector
    let sumU = 0, sumV = 0, count = 0, u6 = 0, v6 = 0;
    pts.forEach(pt => {
      if (pt.agl <= 6000) { sumU += pt.u; sumV += pt.v; count++; }
      if (pt.agl <= 6000) { u6 = pt.u; v6 = pt.v; }
    });
    if (count > 0) {
      const meanU = sumU / count, meanV = sumV / count;
      const shearU = u6 - pts[0].u, shearV = v6 - pts[0].v;
      const shearMag = Math.sqrt(shearU**2 + shearV**2) || 1;
      const orthoU = (shearV / shearMag) * 14.58; // 7.5 m/s = ~14.58 kts
      const orthoV = (-shearU / shearMag) * 14.58;
      const rmU = meanU + orthoU, rmV = meanV + orthoV;
      
      const rmX = cx + sc(rmU), rmY = cy - sc(rmV);
      ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(rmX, rmY, 4, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rmX-6, rmY); ctx.lineTo(rmX+6, rmY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rmX, rmY-6); ctx.lineTo(rmX, rmY+6); ctx.stroke();
      ctx.fillStyle = "#f8fafc"; ctx.font = "8px sans-serif"; ctx.textAlign = "left";
      ctx.fillText("RM", rmX + 6, rmY + 4);
    }

    // 7. Draw Plot Points
    const hoverCoords = [];
    pts.forEach((pt) => {
      const px = cx + sc(pt.u), py = cy - sc(pt.v);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#020617"; ctx.lineWidth = 1; ctx.stroke();
      
      hoverCoords.push({ 
        x: px, y: py, 
        label: `${Math.round(pt.agl)}m AGL (${pt.p}mb)`, 
        val: `${Math.round(pt.kts)} kts ${wdir(pt.dir)}`
      });
    });
    coordsRef.current = hoverCoords;

  }, [snd]);

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

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={cvRef} style={{ border: "1px solid #1e293b", borderRadius: 4, cursor: "crosshair", display: "block" }} 
        onMouseMove={handleMouseMove} onMouseLeave={() => setTip(null)} />
      {tip && (
        <div style={{ position: "absolute", background: "rgba(2,6,23,.95)", border: "1px solid #334155", borderRadius: 4, padding: "4px 8px", fontSize: 11, color: "#f8fafc", pointerEvents: "none", zIndex: 10, transform: "translate(14px, -10px)", left: tip.x, top: tip.y }}>
          <div style={{ fontWeight: 700, color: "#38bdf8" }}>{tip.label}</div>
          <div>{tip.val}</div>
        </div>
      )}
    </div>
  );
}