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

    const cx = cssW / 2, cy = cssH / 2, maxSpd = 80;
    
    // 1. Background
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, cssW, cssH);

    // 2. SPC Style Rings (Orange, 10-80 kts)
    [10, 20, 30, 40, 50, 60, 70, 80].forEach(r => {
      const rad = (r / maxSpd) * (cssW / 2 - 25);
      ctx.strokeStyle = r % 20 === 0 ? "rgba(245, 158, 11, 0.5)" : "rgba(245, 158, 11, 0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
      if (r % 20 === 0) {
        ctx.fillStyle = "#d97706"; ctx.font = "9px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(r, cx + rad, cy + 12);
      }
    });

    // 3. Crosshairs
    ctx.strokeStyle = "rgba(245, 158, 11, 0.5)"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 10); ctx.lineTo(cx, cssH - 10);
    ctx.moveTo(10, cy); ctx.lineTo(cssW - 10, cy);
    ctx.stroke();

    // 4. Calculate Wind Points & SPC AGL Colors
    const tr = (d) => (d * Math.PI) / 180;
    const sc = (spd) => (spd / maxSpd) * (cssW / 2 - 25);
    const sfcH = snd.gh[0] != null ? snd.gh[0] : 0; 
    
    const pts = snd.lvls.map((p, i) => {
      if (snd.ws[i] == null || snd.wd[i] == null || snd.gh[i] == null) return null;
      const agl = snd.gh[i] - sfcH; 
      const kts = snd.ws[i] * 0.869;
      
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

    // 5. Draw Shear Line
    ctx.lineWidth = 2.5;
    for (let i = 0; i < pts.length - 1; i++) {
      ctx.strokeStyle = pts[i].color;
      ctx.beginPath();
      ctx.moveTo(cx + sc(pts[i].u), cy - sc(pts[i].v));
      ctx.lineTo(cx + sc(pts[i + 1].u), cy - sc(pts[i + 1].v));
      ctx.stroke();
    }

    // 6. Draw Bunkers Right Mover (RM) Placeholder
    if (pts.length >= 3) {
       // Highly simplified estimate for RM vector mapping for the canvas
       const rmU = (pts[0].u + pts[pts.length-1].u) / 2 + 5;
       const rmV = (pts[0].v + pts[pts.length-1].v) / 2 - 5;
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