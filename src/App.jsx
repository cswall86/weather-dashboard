import { useState, useEffect } from "react";
import { useWeatherStore } from "./store/useWeatherStore";
import SkewT from "./components/SkewT";

// Update your proxy function to route to the new Vite/Netlify setup
const px = (url) => {
  if (url.includes("api.weather.gov")) {
    return url.replace("https://api.weather.gov", "/api/nws");
  }
  return url; 
};

// ... PASTE EXISTING UTILITY FUNCTIONS HERE (wmoIcon, wdir, calcSRH, EHI logic, etc.) ... //

export default function App() {
  const { activeTab, setActiveTab, loc, setLoc, soundingHourOffset, setSoundingHourOffset } = useWeatherStore();
  
  // Keep your existing local state for inputs/metars/alerts here
  const [locInp, setLocInp] = useState("");
  const [metarList, setMetarList] = useState([]);
  const [metarLoading, setMetarLoading] = useState(false);
  const [snd, setSnd] = useState(null); // Full sounding array
  
  // ... Keep existing loadAll(), search(), loadMetarList() functions here ... //

  return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif", background: "#050c18", color: "#cdd9e8", height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* HEADER TABS */}
      <div style={{ display: "flex", gap: 10, padding: 14 }}>
        {["dash", "snd", "metar"].map(id => (
           <button 
             key={id} 
             onClick={() => setActiveTab(id)} 
             style={{ borderBottom: activeTab === id ? "2px solid #3d8bff" : "none", background: "none", color: "#cdd9e8", cursor: "pointer" }}
           >
             {id.toUpperCase()}
           </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        
        {/* SOUNDING TAB WITH TIMELINE SLIDER */}
        {activeTab === "snd" && snd && (
          <div>
             <div style={{ marginBottom: 14, background: "#08111f", padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: "#6a8aa8", marginBottom: 6 }}>Forecast Hour: +{soundingHourOffset}h</div>
                <input 
                  type="range" 
                  min="0" max="23" 
                  value={soundingHourOffset} 
                  onChange={(e) => setSoundingHourOffset(Number(e.target.value))} 
                  style={{ width: "100%" }}
                />
             </div>
             
             {/* Use the new modular SkewT component */}
             <SkewT snd={snd /* Pass the specific hour from your snd array based on soundingHourOffset */} />
          </div>
        )}

        {/* METAR RENDERING FIX */}
        {activeTab === "metar" && (
           <div>
             {metarLoading && <div style={{ color: "#3d8bff" }}>Loading METARs...</div>}
             {!metarLoading && metarList.length > 0 && (
               <div style={{ marginTop: 12 }}>
                 <div style={{ fontSize: 10, fontWeight: 800, color: "#3d8bff", textTransform: "uppercase" }}>Live Nearby Observations</div>
                 {metarList.map((m) => (
                   <div key={m.stationId} style={{ background: "#0d1b30", border: "1px solid #162640", borderRadius: 6, padding: "8px 10px", marginBottom: 6 }}>
                     <div style={{ fontWeight: 700, color: "#3d8bff" }}>{m.stationId} <span style={{ color: "#6a8aa8", fontWeight: 400, fontSize: 11 }}>{new Date(m.reportTime).toLocaleTimeString()}</span></div>
                     <div style={{ fontFamily: "monospace", fontSize: 11, color: "#cdd9e8", marginTop: 4 }}>{m.rawOb}</div>
                   </div>
                 ))}
               </div>
             )}
             {/* ... Keep existing global METAR links below here ... */}
           </div>
        )}
      </div>
    </div>
  );
}