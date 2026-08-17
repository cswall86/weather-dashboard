import { useEffect, useRef, useState } from "react";

const wdir = (d) => ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(d / 22.5) % 16];

export default function Hodograph({ snd }) {
  const cvRef = useRef(null);
  const coordsRef = useRef([]);
  const [tip, setTip] = useState(null);

  const cssW = 220;
  const cssH = 220;

  useEffect(() => {
    if (!snd || !cvRef.current) return;
    
    const cv = cvRef.current;
    const ctx = cv.getContext("2d");
    
    // High-DPI screen fix (Fixes the smooshing)
    const dpr = window.devicePixelRatio || 1;
    cv.width = cssW * dpr;
    cv.height = cssH * dpr;
    cv.style.width = `${cssW}px`;
    cv.style.height = `${cssH}px`;
    
    ctx.scale(dpr, dpr);

    const cx = cssW / 2, cy = cssH / 2, maxSpd = 80;
    
    // 1. Background
    ctx.fillStyle = "#060d1a";
    ctx.fillRect(0, 0, cssW, cssH);

    // 2. Speed Rings
    [20, 40, 60, 80].forEach(r => {
      const rad = (r / maxSpd) * (cssW / 2 - 20);
      ctx.strokeStyle = "#152840"; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#3a5a7a"; ctx.font = "8px sans-serif"; ctx.textAlign = "left";
      ctx.fillText(r, cx + rad + 2, cy + 3);
    });

    // 3. Crosshairs
    ctx.strokeStyle = "#1a3050"; ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, 20); ctx.lineTo(cx, cssH - 20);
    ctx.moveTo(20, cy); ctx.lineTo(cssW - 20, cy);
    ctx.stroke();

    // 4. Direction Labels
    ctx.fillStyle = "#2e4a65"; ctx.font = "9px sans-serif"; 
    ctx.textAlign = "center"; ctx.fillText("N", cx, 14); ctx.fillText("S", cx, cssH - 8);
    ctx.textAlign = "left"; ctx.fillText("W", 4, cy + 4); 
    ctx.textAlign = "right"; ctx.fillText("E", cssW - 4, cy + 4);

    // 5. Calculate Wind Points
    const tr = (d) => (d * Math.PI) / 180;
    const sc = (spd) => (spd / maxSpd) * (cssW / 2 - 20);
    
    const pts = snd.lvls.map((p, i) => {
      if (snd.ws[i] == null || snd.wd[i] == null) return null;
      return { 
        u: -snd.ws[i] * Math.sin(tr(snd.wd[i])), 
        v: -snd.ws[i] * Math.cos(tr(snd.wd[i])), 
        p,
        rawSpd: snd.ws[i],
        rawDir: snd.wd[i]
      };
    }).filter(Boolean);

    if (pts.length < 2) {
      ctx.fillStyle = "#2e4a65"; ctx.textAlign = "center";
      ctx.fillText("Insufficient wind data", cx, cy);
      return;
    }

    // 6. Draw Shear Line Segments
    const colors = ["#22c55e", "#22c55e", "#22c55e", "#fbbf24", "#fbbf24", "#fbbf24", "#f87171", "#f87171", "#f87171", "#a78bfa"];
    ctx.lineWidth = 2;
    for (let i = 0; i < pts.length - 1; i++) {
      ctx.strokeStyle = colors[i] || "#a78bfa";
      ctx.beginPath();
      ctx.moveTo(cx + sc(pts[i].u), cy - sc(pts[i].v));
      ctx.lineTo(cx + sc(pts[i + 1].u), cy - sc(pts[i + 1].v));
      ctx.stroke();
    }

    // 7. Draw Plot Points and Labels
    const hoverCoords = [];
    pts.forEach((pt, i) => {
      const px = cx + sc(pt.u);
      const py = cy - sc(pt.v);
      
      ctx.fillStyle = colors[i] || "#a78bfa";
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
      
      ctx.fillStyle = "#3a5a7a"; ctx.font = "7px sans-serif"; ctx.textAlign = "left";
      ctx.fillText(pt.p + "hPa", px + 4, py - 2);

      // Save coords for tooltip interactions
      hoverCoords.push({ 
        x: px, y: py, 
        label: pt.p + "hPa", 
        val: Math.round(pt.rawSpd) + " mph " + wdir(pt.rawDir) 
      });
    });
    
    coordsRef.current = hoverCoords;

    // 8. Legend
    [["#22c55e", "Sfc-3km"], ["#fbbf24", "3-6km"], ["#f87171", "6-9km"]].forEach(([c, lb], i) => {
      ctx.fillStyle = c; ctx.font = "8px sans-serif"; ctx.textAlign = "left";
      ctx.fillText(lb, 4, cssH - 28 + i * 10);
    });

  }, [snd]);

  // ── Hover Handler ──
  const handleMouseMove = (e) => {
    if (!cvRef.current) return;
    const rect = cvRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    let best = null, bestD = 400; // Hitbox tolerance
    coordsRef.current.forEach((pt) => {
      const d = (pt.x - cx) ** 2 + (pt.y - cy) ** 2;
      if (d < bestD) { bestD = d; best = pt; }
    });
    setTip(best ? { x: cx, y: cy, label: best.label, val: best.val } : null);
  };

  const tipStyle = { position: "absolute", background: "rgba(8,17,31,.97)", border: "1px solid #1e3a5f", borderRadius: 7, padding: "6px 10px", fontSize: 12, color: "#cdd9e8", pointerEvents: "none", zIndex: 9999, whiteSpace: "nowrap", boxShadow: "0 2px 12px rgba(0,0,0,.5)", transform: "translate(14px, -10px)" };

  return (
    <div style={{ position: "relative" }}>
      <canvas 
        ref={cvRef} 
        style={{ border: "1px solid #162640", borderRadius: 8, cursor: "crosshair", display: "block" }} 
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTip(null)}
      />
      {tip && (
        <div style={{ ...tipStyle, left: tip.x, top: tip.y }}>
          <div style={{ fontWeight: 700, color: "#3d8bff", marginBottom: 2 }}>{tip.label}</div>
          <div>{tip.val}</div>
        </div>
      )}
    </div>
  );
}