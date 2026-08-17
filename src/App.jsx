import { useState, useEffect, useRef } from "react";
import { useWeatherStore } from "./store/useWeatherStore";
import SkewT from "./components/SkewT";

// ── Smart API Proxy ──────────────────────────────────────────────────────────
const px = (url) => {
  // Route NWS API calls through Vite/Netlify proxy to avoid CORS
  if (url.includes("api.weather.gov")) return url.replace("https://api.weather.gov", "/api/nws");
  if (url.includes("open-meteo.com") || url.includes("geocoding-api")) return url; 
  // Fallback to the original netlify proxy for UWyo/SPC GeoJSON
  return `/.netlify/functions/proxy?url=${encodeURIComponent(url)}`;
};

// ── WMO helpers ───────────────────────────────────────────────────────────────
const WMO={0:{l:"Clear",i:"☀️"},1:{l:"Mainly Clear",i:"🌤️"},2:{l:"Partly Cloudy",i:"⛅"},3:{l:"Overcast",i:"☁️"},45:{l:"Fog",i:"🌫️"},48:{l:"Icy Fog",i:"🌫️"},51:{l:"Light Drizzle",i:"🌦️"},53:{l:"Drizzle",i:"🌦️"},55:{l:"Heavy Drizzle",i:"🌧️"},61:{l:"Light Rain",i:"🌧️"},63:{l:"Rain",i:"🌧️"},65:{l:"Heavy Rain",i:"🌧️"},71:{l:"Light Snow",i:"🌨️"},73:{l:"Snow",i:"❄️"},75:{l:"Heavy Snow",i:"❄️"},77:{l:"Snow Grains",i:"🌨️"},80:{l:"Showers",i:"🌦️"},81:{l:"Heavy Showers",i:"🌧️"},82:{l:"Violent Showers",i:"⛈️"},95:{l:"Thunderstorm",i:"⛈️"},96:{l:"Hail Storm",i:"⛈️"},99:{l:"Heavy Hail Storm",i:"⛈️"}};
const WMO_NIGHT={0:{l:"Clear",i:"🌙"},1:{l:"Mainly Clear",i:"🌙"},2:{l:"Partly Cloudy",i:"🌙⛅"}};
const wmo=c=>WMO[c]||{l:"Unknown",i:"🌡️"};
const wmoIcon=(code,night)=>{if(night&&WMO_NIGHT[code])return WMO_NIGHT[code];return wmo(code);};
const checkIsNight=(rise,set)=>{if(!rise||!set)return false;const n=Date.now();return n<new Date(rise).getTime()||n>new Date(set).getTime();};

// ── Utility ───────────────────────────────────────────────────────────────────
const wdir=d=>["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"][Math.round(d/22.5)%16];
const fmtSun=s=>{const p=s.split("T")[1].split(":").map(Number),h=p[0],m=p[1];return(h===0?12:h>12?h-12:h)+":"+String(m).padStart(2,"0")+(h<12?"am":"pm");};
const nowIdx=ts=>{const n=new Date().toISOString().slice(0,13);const i=ts.findIndex(t=>t.slice(0,13)>=n);return i<0?0:i;};
const toC=f=>(f-32)*5/9;
const capeClr=v=>!v||v<500?"#68d391":v<1500?"#d69e2e":v<3000?"#dd6b20":"#e53e3e";
const liClr=v=>v==null?"#cdd9e8":v>0?"#68d391":v>-3?"#d69e2e":"#e53e3e";
const srhClr=v=>{const n=parseInt(v);return isNaN(n)?"#cdd9e8":n<150?"#68d391":n<300?"#d69e2e":n<450?"#dd6b20":"#e53e3e";};
const safeGet=(obj,key,idx)=>{if(!obj||!obj[key]||idx>=obj[key].length)return null;return obj[key][idx];};

// ── Geocode ───────────────────────────────────────────────────────────────────
const STATE_MAP={"AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California","CO":"Colorado","CT":"Connecticut","DE":"Delaware","FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas","KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming","DC":"District of Columbia"};
async function geocode(q){
  const parts=q.split(",").map(s=>s.trim());
  const city=parts[0],hint=parts[1]?parts[1].toUpperCase():"";
  const stateFull=STATE_MAP[hint]||hint;
  const r=await fetch(px("https://geocoding-api.open-meteo.com/v1/search?name="+encodeURIComponent(city)+"&count=10&language=en&format=json")).then(r=>r.json());
  if(!r.results||!r.results.length)return{error:"not found"};
  let m=null;
  if(stateFull&&STATE_MAP[hint])m=r.results.find(x=>x.country_code==="US"&&(x.admin1||"").toLowerCase()===stateFull.toLowerCase());
  if(!m)m=r.results[0];
  return{lat:m.latitude,lon:m.longitude,country:m.country_code,name:m.name+(m.admin1?", "+m.admin1:"")+", "+m.country_code};
}

// ── RAOB & EU Data ────────────────────────────────────────────────────────────
const RAOB_STNS=[
  ["72469","Denver, CO",39.75,-104.87],["72558","Omaha, NE",41.32,-96.37],["72357","Amarillo, TX",35.22,-101.70],["72265","Little Rock, AR",34.83,-92.25],["72493","Rapid City, SD",44.07,-103.20],["72776","Great Falls, MT",47.52,-111.38],["72681","Medford, OR",42.37,-122.87],["72489","Dodge City, KS",37.77,-99.97],["72451","Springfield, MO",37.23,-93.40],["72340","Fort Worth, TX",32.84,-97.30],["72274","Shreveport, LA",32.52,-93.82],["72230","Lake Charles, LA",30.12,-93.22],["72210","Corpus Christi, TX",27.77,-97.50],["72248","Midland, TX",31.95,-102.18],["72363","Albuquerque, NM",35.04,-106.62],["72387","Topeka, KS",39.07,-95.63],["72426","Davenport, IA",41.61,-90.58],["72533","Green Bay, WI",44.48,-88.13],["72562","Aberdeen, SD",45.45,-98.42],["72645","Bismarck, ND",46.77,-100.75],["72518","Pittsburgh, PA",40.53,-80.23],["72520","Albany, NY",42.75,-73.80],["72528","Chatham, MA",41.67,-69.97],["72606","Buffalo, NY",42.93,-78.73],["72634","Gaylord, MI",45.03,-84.68],["72672","Intl Falls, MN",48.57,-93.38],["74560","Louisville, KY",38.18,-85.73],["72317","Jackson, MS",32.32,-90.08],["72208","Miami, FL",25.75,-80.38],["72214","Jacksonville, FL",30.50,-81.70],["72327","Greer, SC",34.90,-82.22],["72403","Huntington, WV",38.37,-82.55],["72501","Wallops, VA",37.93,-75.48],["72632","Detroit, MI",42.33,-83.05],["72659","Duluth, MN",46.83,-92.18],["72364","Salt Lake City, UT",40.77,-111.97],["72293","Oakland, CA",37.73,-122.22],["72391","Tucson, AZ",32.12,-110.93],["72597","Spokane, WA",47.62,-117.53],
  ["03808","Camborne, UK",50.22,-5.32],["03496","Herstmonceux, UK",50.90,0.33],["03005","Lerwick, UK",60.13,-1.18],["03953","Dublin, Ireland",53.43,-6.27],
  ["07145","Brest, France",48.45,-4.42],["07481","Nimes, France",43.87,4.40],["07110","Bordeaux, France",44.83,-0.69],["07150","Trappes (Paris), France",48.77,2.01],
  ["10113","Bergen, Germany",52.81,9.93],["10393","Berlin-Tempelhof, Germany",52.63,13.50],["10739","Stuttgart, Germany",48.83,9.20],["10868","Munich, Germany",48.25,11.55],
  ["06260","De Bilt, Netherlands",52.10,5.18],["01400","Oslo, Norway",59.94,10.72],["02963","Stockholm, Sweden",59.35,17.95],["04220","Copenhagen, Denmark",55.63,12.13],["02365","Helsinki, Finland",60.32,24.97],
  ["08001","A Coruna, Spain",43.37,-8.42],["08202","Zaragoza, Spain",41.67,-1.02],["08495","Barcelona, Spain",41.29,2.07],["08221","Madrid, Spain",40.45,-3.58],
  ["16080","Brindisi, Italy",40.65,17.95],["16144","Udine, Italy",46.03,13.19],["16113","Milano, Italy",45.43,9.28],
  ["12374","Warsaw, Poland",52.17,20.97],["12843","Prague, Czechia",50.02,14.45],["11035","Vienna, Austria",48.25,16.36],
  ["16716","Athens, Greece",37.90,23.73],["17062","Istanbul, Turkey",40.97,28.82],["06610","Lisbon, Portugal",38.77,-9.13]
];
const nearestRaob=(lat,lon)=>{let b=null,bd=Infinity;RAOB_STNS.forEach(s=>{const d=Math.sqrt((lat-s[2])**2+(lon-s[3])**2);if(d<bd){bd=d;b=s;}});return b;};

const EU_MET_DATA={GB:{name:"Met Office (UK)",links:[["https://www.metoffice.gov.uk/","Met Office Homepage","UK national weather service"],["https://www.metoffice.gov.uk/weather/warnings-and-advice/uk-storm-centre","UK Storm Centre","Active named storms and warnings"]]},FR:{name:"Meteo-France",links:[["https://meteofrance.com/","Meteo-France Homepage","France's national meteorological service"],["https://vigilance.meteofrance.fr/","Meteo-France Vigilance","Real-time weather warnings by department"]]},DE:{name:"DWD (Germany)",links:[["https://www.dwd.de/EN/Home/home_node.html","DWD Homepage","Deutscher Wetterdienst"],["https://kachelmannwetter.com/","Kachelmannwetter","German-language model viewer and radar"]]},NL:{name:"KNMI (Netherlands)",links:[["https://www.knmi.nl/home","KNMI Homepage","Royal Netherlands Meteorological Institute"]]},SE:{name:"SMHI (Sweden)",links:[["https://www.smhi.se/en","SMHI Homepage","Swedish Meteorological and Hydrological Institute"]]},NO:{name:"MET Norway",links:[["https://www.met.no/en","MET Norway Homepage","Norway's national weather service"],["https://www.yr.no/en","Yr.no","Excellent public-facing forecast site"]]},IE:{name:"Met Eireann (Ireland)",links:[["https://www.met.ie/","Met Eireann Homepage","Ireland's national meteorological service"]]},ES:{name:"AEMET (Spain)",links:[["https://www.aemet.es/en/portada","AEMET Homepage","Spain's state meteorological agency"]]},IT:{name:"ARPA Meteo (Italy)",links:[["https://www.meteoam.it/","Aeronautica Militare Meteoam","Italy's military met service"]]},PT:{name:"IPMA (Portugal)",links:[["https://www.ipma.pt/en/","IPMA Homepage","Portuguese Institute for Sea and Atmosphere"]]},DK:{name:"DMI (Denmark)",links:[["https://www.dmi.dk/en/","DMI Homepage","Danish Meteorological Institute"]]},FI:{name:"FMI (Finland)",links:[["https://en.ilmatieteenlaitos.fi/","FMI Homepage","Finnish Meteorological Institute"]]},AT:{name:"GeoSphere Austria",links:[["https://www.zamg.ac.at/cms/en/","ZAMG / GeoSphere Austria","Austria's national weather service"]]},CZ:{name:"CHMU (Czechia)",links:[["https://www.chmi.cz/?l=en","CHMU Homepage","Czech Hydrometeorological Institute"]]},PL:{name:"IMGW (Poland)",links:[["https://www.imgw.pl/en","IMGW Homepage","Institute of Meteorology and Water Management"]]},GR:{name:"EMY (Greece)",links:[["https://www.emy.gr/emy/en/","EMY Homepage","Hellenic National Meteorological Service"]]},TR:{name:"MGM (Turkey)",links:[["https://www.mgm.gov.tr/en-US/","MGM Homepage","Turkish State Meteorological Service"]]}};

// ── SRH Calculation ───────────────────────────────────────────────────────────
const calcSRH=(s,topM)=>{
  if(!s)return"--";
  const tr=d=>d*Math.PI/180,mph2ms=0.44704,sfcH=s.gh[0]!=null?s.gh[0]:0;
  const pts=s.lvls.map((p,i)=>{if(s.ws[i]==null||s.wd[i]==null||s.gh[i]==null)return null;const wsm=s.ws[i]*mph2ms;return{h:s.gh[i]-sfcH,u:-wsm*Math.sin(tr(s.wd[i])),v:-wsm*Math.cos(tr(s.wd[i]))};}).filter(Boolean);
  if(pts.length<2)return"--";
  const lo6=pts.filter(p=>p.h<=6000);if(!lo6.length)return"--";
  const mU=lo6.reduce((a,p)=>a+p.u,0)/lo6.length,mV=lo6.reduce((a,p)=>a+p.v,0)/lo6.length;
  const shU=lo6[lo6.length-1].u-pts[0].u,shV=lo6[lo6.length-1].v-pts[0].v,shMag=Math.sqrt(shU*shU+shV*shV)||1;
  const cU=mU+shV/shMag*7.5*mph2ms,cV=mV-shU/shMag*7.5*mph2ms;
  const layer=pts.filter(p=>p.h<=topM);if(layer.length<2)return"--";
  let srh=0;for(let i=0;i<layer.length-1;i++){const u1=layer[i].u-cU,v1=layer[i].v-cV,u2=layer[i+1].u-cU,v2=layer[i+1].v-cV;srh+=u1*v2-u2*v1;}
  return Math.round(Math.abs(srh))+" m\u00b2/s\u00b2";
};
const srhLabel=v=>{const n=parseInt(v);if(isNaN(n))return null;if(n<150)return{label:"Weak",color:"#68d391"};if(n<300)return{label:"Moderate",color:"#d69e2e"};if(n<450)return{label:"Significant",color:"#dd6b20"};return{label:"Extreme",color:"#e53e3e"};};

// ── Styles & Astronomy ────────────────────────────────────────────────────────
const BG="#050c18",BG2="#08111f",BG3="#0d1b30",BD="#162640",BD2="#1e3a5f",TC="#cdd9e8",T2="#6a8aa8",T3="#2e4a65",ACC="#3d8bff",RED="#e53e3e";
const cardS={background:BG2,border:"1px solid "+BD,borderRadius:10,padding:14,marginBottom:12};
const mcS={background:BG3,border:"1px solid "+BD,borderRadius:8,padding:10,textAlign:"center"};
const inp0={background:BG3,border:"1px solid "+BD2,borderRadius:6,padding:"7px 10px",color:TC,fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box"};
const stitle={fontSize:10,fontWeight:800,color:ACC,textTransform:"uppercase",letterSpacing:".1em",marginBottom:10};
const btnS=bg=>({background:bg||ACC,border:"none",borderRadius:6,padding:"7px 13px",cursor:"pointer",fontSize:13,fontWeight:600,color:"#fff",fontFamily:"inherit"});

const JD=(y,mo,d)=>{if(mo<=2){y--;mo+=12;}const A=Math.floor(y/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(mo+1))+d+B-1524.5;};
const moonPhase=date=>{
  const jd=JD(date.getFullYear(),date.getMonth()+1,date.getDate()+(date.getUTCHours()/24));
  const pct=((jd-2451550.1)%29.530588853+29.530588853)%29.530588853/29.530588853;
  const phases=[[0.0625,"🌑","New Moon"],[0.1875,"🌒","Waxing Crescent"],[0.3125,"🌓","First Quarter"],[0.4375,"🌔","Waxing Gibbous"],[0.5625,"🌕","Full Moon"],[0.6875,"🌖","Waning Gibbous"],[0.8125,"🌗","Last Quarter"],[0.9375,"🌘","Waning Crescent"],[1.001,"🌑","New Moon"]];
  const p=phases.find(([t])=>pct<t)||phases[0];
  return{emoji:p[1],name:p[2],illumination:Math.round((1-Math.cos(pct*2*Math.PI))/2*100)};
};
const moonAltAt=(jd0,lat,lon,hr)=>{
  const rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI,jd=jd0+hr/24,d=jd-2451545;
  const Lm=((218.316+13.176396*d)%360+360)%360,Mm=((134.963+13.064993*d)%360+360)%360,Fm=((93.272+13.229350*d)%360+360)%360;
  const lonM=Lm+6.289*Math.sin(rad(Mm)),latM=5.128*Math.sin(rad(Fm)),eps=23.439;
  const ra=deg(Math.atan2(Math.sin(rad(lonM))*Math.cos(rad(eps))-Math.tan(rad(latM))*Math.sin(rad(eps)),Math.cos(rad(lonM))));
  const dec=deg(Math.asin(Math.sin(rad(latM))*Math.cos(rad(eps))+Math.cos(rad(latM))*Math.sin(rad(eps))*Math.sin(rad(lonM))));
  const LST=((((280.46061837+360.98564736629*d)%360+360)%360+lon)%360+360)%360;
  return deg(Math.asin(Math.sin(rad(lat))*Math.sin(rad(dec))+Math.cos(rad(lat))*Math.cos(rad(dec))*Math.cos(rad(LST-ra))));
};
const calcMoonRiseSet=(lat,lon,date)=>{
  const jd=JD(date.getFullYear(),date.getMonth()+1,date.getDate());
  let rise=null,set=null,prev=moonAltAt(jd,lat,lon,0);
  for(let h=1;h<=25;h++){const a=moonAltAt(jd,lat,lon,h);if(prev<0&&a>=0&&!rise)rise=h-prev/(a-prev);if(prev>=0&&a<0&&!set)set=h-prev/(a-prev);prev=a;}
  const fmt=h=>{if(h===null)return"--";const hh=Math.floor(h)%24,mm=Math.round((h%1)*60);return(hh===0?12:hh>12?hh-12:hh)+":"+String(mm).padStart(2,"0")+(hh<12?"am":"pm");};
  return{rise:fmt(rise),set:fmt(set)};
};
const localTimeStr=utcOffsetSec=>{
  const d=new Date(Date.now()+(utcOffsetSec*1000));
  const h=d.getUTCHours(),m=d.getUTCMinutes();
  return(h===0?12:h>12?h-12:h)+":"+String(m).padStart(2,"0")+(h<12?" am":" pm");
};
const fmtTz=tz=>tz?tz.replace("_"," ").split("/").pop().replace(/_/g," "):"";

// ─────────────────────────────────────────────────────────────────────────────
export default function App(){
  // ── State ──
  const { activeTab, setActiveTab } = useWeatherStore();
  
  const [locInp,setLocInp]=useState("");
  const [loc,setLoc]=useState(null);
  const [wx,setWx]=useState(null);
  const [nws,setNws]=useState([]);
  const [snd,setSnd]=useState(null);
  const [status,setStatus]=useState("");
  const [afd,setAfd]=useState(null);
  const [afdExpanded,setAfdExpanded]=useState(false);
  const [spcWatches,setSpcWatches]=useState([]);
  const [mds,setMds]=useState([]);
  const [obsSnd,setObsSnd]=useState(null);
  const [obsSndLoading,setObsSndLoading]=useState(false);
  const [nearestRaobStn,setNearestRaobStn]=useState(null);
  const [metarList,setMetarList]=useState([]);
  const [metarLoading,setMetarLoading]=useState(false);

  const hodoRef=useRef(null);
  const [hodoTip,setHodoTip]=useState(null);
  const hodoCoords=useRef(null);

  useEffect(()=>{
    (async()=>{
      try{const r=localStorage.getItem("wx:loc");if(r){const l=JSON.parse(r);setLocInp(l.name);await loadAll(l);}}catch(e){}
    })();
  },[]);

  useEffect(()=>{
    if(activeTab==="snd"&&snd&&hodoRef.current) setTimeout(()=>drawHodo(snd,hodoRef.current), 80);
  },[activeTab,snd]);

  useEffect(()=>{
    if(activeTab==="metar"&&loc&&metarList.length===0&&!metarLoading)loadMetarList(loc);
  },[activeTab,loc]);

  // ── Data loaders ────────────────────────────────────────────────────────────
  const loadAll=async l=>{
    setStatus("Loading weather...");setAfd(null);setMds([]);setObsSnd(null);setMetarList([]);
    try{
      const lvls=[1000,925,850,700,600,500,400,300,250,200];
      const bp=new URLSearchParams({latitude:l.lat,longitude:l.lon,current:"temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,uv_index,surface_pressure",hourly:"temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cape,lifted_index",daily:"weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset,cape_max",temperature_unit:"fahrenheit",wind_speed_unit:"mph",precipitation_unit:"inch",timezone:"auto",forecast_days:7});
      const data=await fetch(px("https://api.open-meteo.com/v1/forecast?"+bp.toString())).then(r=>r.json());
      if(data.error){setStatus("Weather error: "+data.reason);return;}
      setWx(data);
      const pv=lvls.map(p=>"temperature_"+p+"hPa,dewpoint_"+p+"hPa,windspeed_"+p+"hPa,winddirection_"+p+"hPa,geopotential_height_"+p+"hPa");
      const sp=new URLSearchParams({latitude:l.lat,longitude:l.lon,hourly:pv.join(","),temperature_unit:"fahrenheit",wind_speed_unit:"mph",timezone:"auto",forecast_days:1});
      const sd=await fetch(px("https://api.open-meteo.com/v1/forecast?"+sp.toString())).then(r=>r.json());
      const hi2=nowIdx(sd.hourly.time),hi3=nowIdx(data.hourly.time);
      setSnd({lvls,time:sd.hourly.time[hi2],T:lvls.map(p=>{const a=sd.hourly["temperature_"+p+"hPa"];return a?a[hi2]:null;}),Td:lvls.map(p=>{const a=sd.hourly["dewpoint_"+p+"hPa"];return a?a[hi2]:null;}),ws:lvls.map(p=>{const a=sd.hourly["windspeed_"+p+"hPa"];return a?a[hi2]:null;}),wd:lvls.map(p=>{const a=sd.hourly["winddirection_"+p+"hPa"];return a?a[hi2]:null;}),gh:lvls.map(p=>{const a=sd.hourly["geopotential_height_"+p+"hPa"];return a?a[hi2]:null;}),cape:safeGet(data.hourly,"cape",hi3),li:safeGet(data.hourly,"lifted_index",hi3)});
      try{const nr=await fetch(px("https://api.weather.gov/alerts/active?point="+l.lat.toFixed(4)+","+l.lon.toFixed(4))).then(r=>r.json());setNws((nr.features||[]).map(f=>({event:f.properties.event,headline:f.properties.headline})));}catch(e){}
      setLoc(l);
      if(l.country==="US"){loadAFD(l.lat,l.lon);loadMDs();loadSPCWatches();}
      else{setSpcWatches([]);setMds([]);}
      loadObsSnd(l.lat,l.lon);
      setStatus("");
    }catch(e){setStatus("Error: "+e.message);}
  };

  const loadAFD=async(lat,lon)=>{
    try{const pt=await fetch(px("https://api.weather.gov/points/"+lat.toFixed(4)+","+lon.toFixed(4))).then(r=>r.json());const cwa=pt.properties&&pt.properties.cwa;if(!cwa)return;const prods=await fetch(px("https://api.weather.gov/products?type=AFD&location="+cwa+"&limit=1")).then(r=>r.json());if(!prods["@graph"]||!prods["@graph"].length)return;const pid=prods["@graph"][0]["@id"]||prods["@graph"][0].id;const prod=await fetch(px(pid)).then(r=>r.json());setAfd({office:cwa,text:prod.productText||"",issued:prod.issuanceTime||""});}catch(e){}
  };
  const loadMDs=async()=>{
    try{const r=await fetch(px("https://api.weather.gov/products?type=MCD&limit=5")).then(r=>r.json());const items=(r["@graph"]||[]).slice(0,3);const texts=await Promise.allSettled(items.map(async item=>{const p=await fetch(px(item["@id"]||item.id)).then(r=>r.json());return{id:p.productId||"",text:(p.productText||"").slice(0,600),issued:p.issuanceTime||""};}));setMds(texts.filter(r=>r.status==="fulfilled").map(r=>r.value));}catch(e){}
  };
  const loadSPCWatches=async()=>{
    try{const r=await fetch(px("https://www.spc.noaa.gov/products/watch/ActiveWW.geojson")).then(r=>r.json());setSpcWatches((r.features||[]).map(f=>({type:(f.properties.PROD_TYPE||"Watch").trim()})));}catch(e){}
  };
  const loadObsSnd=async(lat,lon)=>{
    const stn=nearestRaob(lat,lon);if(!stn)return;
    setNearestRaobStn(stn);setObsSnd(null);setObsSndLoading(true);
    try{
      const now=new Date(),utcH=now.getUTCHours();
      let sndH=utcH>=13?12:utcH>=1?0:12;
      let d=new Date(now);if(sndH===12&&utcH<13)d=new Date(now.getTime()-86400000);
      const yr=d.getUTCFullYear(),mo=String(d.getUTCMonth()+1).padStart(2,"0"),dy=String(d.getUTCDate()).padStart(2,"0");
      const from=dy+String(sndH).padStart(2,"0");
      const html=await fetch(px("https://weather.uwyo.edu/cgi-bin/sounding.py?TYPE=TEXT%3ALIST&YEAR="+yr+"&MONTH="+mo+"&FROM="+from+"&TO="+from+"&STNM="+stn[0])).then(r=>r.text());
      const pre=html.match(/<pre>([\s\S]*?)<\/pre>/);if(!pre){setObsSndLoading(false);return;}
      const rows=pre[1].split("\n").filter(l=>/^\s+[\d.]+\s+/.test(l)).map(l=>{const v=l.trim().split(/\s+/).map(Number);if(v.length<8)return null;return{pres:v[0],hght:v[1],temp:v[2],dwpt:v[3],drct:v[6],sknt:v[7]};}).filter(Boolean);
      if(rows.length>2)setObsSnd({stn:stn[1],id:stn[0],time:yr+"-"+mo+"-"+dy+" "+String(sndH).padStart(2,"0")+":00Z",rows});
    }catch(e){}
    setObsSndLoading(false);
  };
  const loadMetarList=async(l)=>{
    if(!l)return;setMetarLoading(true);setMetarList([]);
    try{
      const stnsUrl="https://api.weather.gov/stations?point="+l.lat.toFixed(4)+","+l.lon.toFixed(4)+"&limit=50";
      const stnsResp=await fetch(px(stnsUrl));
      if(!stnsResp.ok){setMetarLoading(false);return;}
      const stnsData=await stnsResp.json();
      const stations=(stnsData.features||[]).map(f=>f.properties.stationIdentifier).filter(Boolean).slice(0,30);
      if(!stations.length){setMetarLoading(false);return;}
      const results=await Promise.allSettled(stations.map(async id=>{
        const obsResp=await fetch(px("https://api.weather.gov/stations/"+id+"/observations?limit=1"));
        if(!obsResp.ok)return null;
        const obsData=await obsResp.json();
        const obs=obsData.features&&obsData.features[0];
        if(!obs)return null;
        const p=obs.properties;
        if(!p.rawMessage)return null;
        return{stationId:id,rawOb:p.rawMessage,reportTime:p.timestamp||""};
      }));
      const feats=results.filter(r=>r.status==="fulfilled"&&r.value).map(r=>r.value).sort((a,b)=>a.stationId.localeCompare(b.stationId));
      setMetarList(feats);
    }catch(e){}
    setMetarLoading(false);
  };

  const search=async()=>{
    const q=locInp.trim();if(!q)return;setStatus("Searching...");
    try{const g=await geocode(q);if(g.error){setStatus("Not found");return;}const l={name:g.name,lat:parseFloat(g.lat),lon:parseFloat(g.lon),country:g.country||"US"};setLocInp(l.name);try{localStorage.setItem("wx:loc",JSON.stringify(l));}catch(e){}await loadAll(l);}
    catch(e){setStatus("Search error: "+e.message);}
  };

  // ── Sounding helpers ────────────────────────────────────────────────────────
  const getFzLvl=s=>{if(!s)return"--";for(let i=1;i<s.lvls.length;i++){if(s.T[i-1]!=null&&s.T[i]!=null&&s.T[i-1]>=32&&s.T[i]<32){const frac=(32-s.T[i-1])/(s.T[i]-s.T[i-1]);const h=(s.gh[i-1]!=null&&s.gh[i]!=null)?s.gh[i-1]+(s.gh[i]-s.gh[i-1])*frac:null;return h!=null?Math.round(h*3.28084).toLocaleString()+" ft":"--";}}return(s.T[0]!=null&&s.T[0]<32)?"At surface":"Above sounding";};
  const getLapse=s=>{if(!s)return"--";const i8=s.lvls.indexOf(850),i5=s.lvls.indexOf(500);if(i8<0||i5<0||s.T[i8]==null||s.T[i5]==null||s.gh[i8]==null||s.gh[i5]==null)return"--";return((toC(s.T[i8])-toC(s.T[i5]))/((s.gh[i5]-s.gh[i8])/1000)).toFixed(1)+" C/km";};
  const getLvlW=(s,p)=>{if(!s)return"--";const i=s.lvls.indexOf(p);if(i<0||s.ws[i]==null)return"--";return Math.round(s.ws[i])+" mph "+wdir(s.wd[i]||0);};
  const getBulk=s=>{if(!s)return"--";const i0=s.lvls.indexOf(1000),i6=s.lvls.indexOf(300);if(i0<0||i6<0||s.ws[i0]==null||s.ws[i6]==null)return"--";const tr=d=>d*Math.PI/180;const u0=-s.ws[i0]*Math.sin(tr(s.wd[i0]||0)),v0=-s.ws[i0]*Math.cos(tr(s.wd[i0]||0)),u6=-s.ws[i6]*Math.sin(tr(s.wd[i6]||0)),v6=-s.ws[i6]*Math.cos(tr(s.wd[i6]||0));return Math.round(Math.sqrt((u6-u0)**2+(v6-v0)**2))+" mph";};
  const get700RH=s=>{if(!s)return"--";const i=s.lvls.indexOf(700);if(i<0||s.T[i]==null||s.Td[i]==null)return"--";const Tc=toC(s.T[i]),Tdc=toC(s.Td[i]);return Math.min(100,Math.max(0,Math.round(100*Math.exp(17.625*Tdc/(243.04+Tdc))/Math.exp(17.625*Tc/(243.04+Tc)))))+" %";};
  const getPLvl=(s,key,p,unit)=>{if(!s)return"--";const i=s.lvls.indexOf(p);if(i<0||!s[key]||s[key][i]==null)return"--";return unit==="m"?Math.round(s[key][i])+" m":Math.round(s[key][i])+"F";};

  // ── Hodograph Draw ──────────────────────────────────────────────────────────
  const buildHodoCoords=(s,W,H)=>{
    const cx=W/2,cy=H/2,maxSpd=80,sc=spd=>(spd/maxSpd)*(W/2-20),tr=d=>d*Math.PI/180;
    return s.lvls.map((p,i)=>{if(s.ws[i]==null||s.wd[i]==null)return null;const u=-s.ws[i]*Math.sin(tr(s.wd[i])),v=-s.ws[i]*Math.cos(tr(s.wd[i]));return{x:cx+sc(u),y:cy-sc(v),label:p+"hPa",val:Math.round(s.ws[i])+" mph "+wdir(s.wd[i])};}).filter(Boolean);
  };
  const onHodoMove=e=>{
    if(!hodoRef.current||!snd)return;
    const rect=hodoRef.current.getBoundingClientRect(),scale=hodoRef.current.width/rect.width;
    const cx=(e.clientX-rect.left)*scale,cy=(e.clientY-rect.top)*scale;
    const pts=hodoCoords.current||[];let best=null,bestD=800;
    pts.forEach(pt=>{const d=(pt.x-cx)**2+(pt.y-cy)**2;if(d<bestD){bestD=d;best=pt;}});
    setHodoTip(best?{x:e.clientX,y:e.clientY,label:best.label,val:best.val}:null);
  };
  const drawHodo=(s,cv)=>{
    if(!s||!cv)return;
    const ctx=cv.getContext("2d"),W=cv.width,H=cv.height,cx=W/2,cy=H/2,maxSpd=80;
    ctx.fillStyle="#060d1a";ctx.fillRect(0,0,W,H);
    [20,40,60,80].forEach(r=>{const rad=r/maxSpd*(W/2-20);ctx.strokeStyle="#152840";ctx.lineWidth=0.5;ctx.beginPath();ctx.arc(cx,cy,rad,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#3a5a7a";ctx.font="8px sans-serif";ctx.textAlign="left";ctx.fillText(r,cx+rad+2,cy+3);});
    ctx.strokeStyle="#1a3050";ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(cx,20);ctx.lineTo(cx,H-20);ctx.moveTo(20,cy);ctx.lineTo(W-20,cy);ctx.stroke();
    const tr=d=>d*Math.PI/180,sc=spd=>(spd/maxSpd)*(W/2-20);
    const pts=s.lvls.map((p,i)=>{if(s.ws[i]==null||s.wd[i]==null)return null;return{u:-s.ws[i]*Math.sin(tr(s.wd[i])),v:-s.ws[i]*Math.cos(tr(s.wd[i])),p};}).filter(Boolean);
    if(pts.length<2){ctx.fillStyle=T3;ctx.font="11px sans-serif";ctx.textAlign="center";ctx.fillText("Insufficient wind data",cx,cy);return;}
    const colors=["#22c55e","#22c55e","#22c55e","#fbbf24","#fbbf24","#fbbf24","#f87171","#f87171","#f87171","#a78bfa"];
    ctx.lineWidth=2;
    for(let i=0;i<pts.length-1;i++){ctx.strokeStyle=colors[i]||"#a78bfa";ctx.beginPath();ctx.moveTo(cx+sc(pts[i].u),cy-sc(pts[i].v));ctx.lineTo(cx+sc(pts[i+1].u),cy-sc(pts[i+1].v));ctx.stroke();}
    pts.forEach((pt,i)=>{ctx.fillStyle=colors[i]||"#a78bfa";ctx.beginPath();ctx.arc(cx+sc(pt.u),cy-sc(pt.v),3,0,Math.PI*2);ctx.fill();ctx.fillStyle="#3a5a7a";ctx.font="7px sans-serif";ctx.textAlign="left";ctx.fillText(pt.p+"hPa",cx+sc(pt.u)+4,cy-sc(pt.v)-2);});
    ctx.fillStyle=T3;ctx.font="9px sans-serif";ctx.textAlign="center";ctx.fillText("N",cx,14);ctx.fillText("S",cx,H-8);ctx.textAlign="left";ctx.fillText("W",4,cy+4);ctx.textAlign="right";ctx.fillText("E",W-4,cy+4);
    hodoCoords.current=buildHodoCoords(s,W,H);
  };

  // ── Pre-computed ─────────────────────────────────────────────────────────────
  const isUS=loc?loc.country==="US":true;
  const _cwa=afd?afd.office:null;
  const _cwaLow=_cwa?_cwa.toLowerCase():null;
  const _cc=loc?loc.country:"US";
  const _euMet=EU_MET_DATA[_cc]||null;
  const _night=wx?checkIsNight(wx.daily.sunrise[0],wx.daily.sunset[0]):false;
  const _cond=wx?wmoIcon(wx.current.weather_code,_night):null;
  const _tempF=wx?Math.round(wx.current.temperature_2m):0;
  const _tempC=wx?Math.round(toC(wx.current.temperature_2m)):0;
  const _feelF=wx?Math.round(wx.current.apparent_temperature):0;
  const _feelC=wx?Math.round(toC(wx.current.apparent_temperature)):0;
  const _localTime=wx?localTimeStr(wx.utc_offset_seconds||0):null;
  const _tz=wx?fmtTz(wx.timezone||""):"";
  const _moon=loc?moonPhase(new Date()):null;
  const _moonRS=loc?calcMoonRiseSet(loc.lat,loc.lon,new Date()):null;
  const alertCount=nws.length+spcWatches.length;
  const alertLabel="Alerts"+(alertCount?" ("+alertCount+")":"");
  const TABS=[["dash","🌡 Conditions"],["snd","📈 Sounding"],["metar","🔵 METARs"],["alrt",alertLabel],["rsrc","📎 Resources"]];
  const tipStyle={position:"fixed",background:"rgba(8,17,31,.97)",border:"1px solid "+BD2,borderRadius:7,padding:"6px 10px",fontSize:12,color:TC,pointerEvents:"none",zIndex:9999,whiteSpace:"nowrap",boxShadow:"0 2px 12px rgba(0,0,0,.5)"};

  // ── Render ───────────────────────────────────────────────────────────────────
  return(
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",fontSize:13,lineHeight:1.5,background:BG,color:TC,height:"100vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>

      {/* Header & Search */}
      <div style={{background:BG2,borderBottom:"1px solid "+BD,padding:"10px 14px 0",flexShrink:0}}>
        <div style={{display:"flex",gap:8,marginBottom:6}}>
          <input style={Object.assign({},inp0,{flex:1,width:"auto"})} value={locInp} onChange={e=>setLocInp(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")search();}} placeholder="City, state or city, country — e.g. Warren, OH or London, GB"/>
          <button style={btnS()} onClick={search}>Search</button>
          {loc&&<button style={btnS(BG3)} onClick={()=>loadAll(loc)} title="Refresh">&#8635;</button>}
        </div>
        {status&&<div style={{fontSize:11,color:status.includes("rror")||status.includes("ot found")?RED:ACC,marginBottom:4}}>{status}</div>}
        {loc&&!status&&<div style={{fontSize:11,color:T3,marginBottom:4}}>
          <span>&#128205; {loc.name}</span>
          {_localTime&&<span style={{color:ACC,marginLeft:12,fontWeight:700}}>&#128336; {_localTime} <span style={{color:T3,fontWeight:400}}>{_tz}</span></span>}
        </div>}
        <div style={{display:"flex",overflowX:"auto"}}>
          {TABS.map(([id,label])=>(
            <button key={id} onClick={()=>setActiveTab(id)} style={{padding:"8px 13px",background:"none",border:"none",borderBottom:activeTab===id?"2px solid "+ACC:"2px solid transparent",color:activeTab===id?ACC:T3,fontSize:11,fontWeight:700,whiteSpace:"nowrap",letterSpacing:".06em",textTransform:"uppercase",cursor:"pointer",fontFamily:"inherit"}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:"auto",padding:14}}>

        {/* ── CONDITIONS (Dash) ──────────────────────────────────────────────── */}
        {activeTab==="dash"&&(
          <div>
            {!wx&&<div style={{color:T3,textAlign:"center",padding:60}}><div style={{fontSize:48,marginBottom:12}}>&#127782;</div>Search a location above.</div>}
            {wx&&(
              <div>
                {nws.map((a,i)=>(<div key={i} style={{background:"#3b0d0d",border:"1px solid "+RED,borderRadius:9,padding:"11px 14px",marginBottom:12}}><div style={{fontWeight:800,color:"#fc8181"}}>&#9888; {a.event}</div><div style={{fontSize:11,color:"#fc8181",opacity:.8,marginTop:3}}>{(a.headline||"").slice(0,200)}</div></div>))}
                <div style={Object.assign({},cardS,{display:"flex",justifyContent:"space-between",alignItems:"flex-start"})}>
                  <div>
                    <div style={{display:"flex",alignItems:"baseline",gap:10}}>
                      <div style={{fontSize:68,fontWeight:200,lineHeight:1,letterSpacing:-2}}>{_tempF}&#176;<span style={{fontSize:28,color:T3}}>F</span></div>
                      <div style={{fontSize:28,fontWeight:300,color:T3,lineHeight:1}}>{_tempC}&#176;<span style={{fontSize:16}}>C</span></div>
                    </div>
                    <div style={{fontSize:12,color:T2,marginTop:6}}>Feels like {_feelF}&#176;F / {_feelC}&#176;C &middot; {_cond.l}</div>
                    <div style={{fontSize:11,color:T3,marginTop:3}}>{_night?"🌙 Nighttime":"☀️ Daytime"} &middot; {fmtSun(wx.daily.sunrise[0])} ↑ {fmtSun(wx.daily.sunset[0])} ↓</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:60,lineHeight:1}}>{_cond.i}</div>
                    {_night&&_moon&&<div style={{fontSize:22,marginTop:4}}>{_moon.emoji}</div>}
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
                  {[["Humidity",wx.current.relative_humidity_2m+"%"],["Wind",Math.round(wx.current.wind_speed_10m)+" mph "+wdir(wx.current.wind_direction_10m)],["Pressure",(wx.current.surface_pressure||0).toFixed(0)+" hPa"],["UV",wx.current.uv_index]].map(([k,v])=>(<div key={k} style={mcS}><div style={{fontSize:10,color:T3,textTransform:"uppercase",letterSpacing:".05em"}}>{k}</div><div style={{fontSize:14,fontWeight:700,marginTop:3}}>{v}</div></div>))}
                </div>
                {snd&&(
                  <div style={cardS}>
                    <div style={stitle}>Instability Indices</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                      {[["CAPE",snd.cape!=null?Math.round(snd.cape)+" J/kg":"--",capeClr(snd.cape),snd.cape!=null?(snd.cape<500?"Weak/None":snd.cape<1500?"Moderate":snd.cape<3000?"Large":"Extreme"):""],["Lifted Index",snd.li!=null?snd.li.toFixed(1)+"C":"--",liClr(snd.li),snd.li!=null?(snd.li>0?"Stable":snd.li>-3?"Slight":snd.li>-6?"Moderate":"Very unstable"):""],["Freezing Level",getFzLvl(snd),TC,"0C isotherm"],["850mb Temp",getPLvl(snd,"T",850,"F"),TC,"Low-level thermal"],["500mb Height",getPLvl(snd,"gh",500,"m"),TC,"Upper pattern"],["700mb RH",get700RH(snd),TC,"Mid-level moisture"]].map(([k,v,c,d])=>(
                        <div key={k} style={{background:BG3,border:"1px solid "+BD,borderRadius:8,padding:10}}>
                          <div style={{fontSize:10,color:T3,textTransform:"uppercase",letterSpacing:".05em",marginBottom:4}}>{k}</div>
                          <div style={{fontSize:17,fontWeight:700,color:c}}>{v}</div>
                          {d&&<div style={{fontSize:11,color:T2,marginTop:2}}>{d}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={cardS}>
                  <div style={stitle}>Today</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                    {[["High/Low",Math.round(wx.daily.temperature_2m_max[0])+"F / "+Math.round(wx.daily.temperature_2m_min[0])+"F",Math.round(toC(wx.daily.temperature_2m_max[0]))+"C / "+Math.round(toC(wx.daily.temperature_2m_min[0]))+"C"],["Rain",wx.daily.precipitation_probability_max[0]+"%",null],["Sunrise",fmtSun(wx.daily.sunrise[0]),null],["Sunset",fmtSun(wx.daily.sunset[0]),null]].map(([k,v,s])=>(<div key={k} style={mcS}><div style={{fontSize:10,color:T3,textTransform:"uppercase",letterSpacing:".05em"}}>{k}</div><div style={{fontSize:13,fontWeight:700,marginTop:3}}>{v}</div>{s&&<div style={{fontSize:11,color:T3,marginTop:1}}>{s}</div>}</div>))}
                  </div>
                </div>
                {_moon&&_moonRS&&(
                  <div style={cardS}>
                    <div style={stitle}>Moon</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                      <div style={mcS}><div style={{fontSize:10,color:T3,textTransform:"uppercase",letterSpacing:".05em"}}>Phase</div><div style={{fontSize:22,margin:"4px 0"}}>{_moon.emoji}</div><div style={{fontSize:11,fontWeight:700}}>{_moon.name}</div></div>
                      <div style={mcS}><div style={{fontSize:10,color:T3,textTransform:"uppercase",letterSpacing:".05em"}}>Illumination</div><div style={{fontSize:18,fontWeight:700,marginTop:6}}>{_moon.illumination}%</div></div>
                      <div style={mcS}><div style={{fontSize:10,color:T3,textTransform:"uppercase",letterSpacing:".05em"}}>Moonrise</div><div style={{fontSize:13,fontWeight:700,marginTop:6}}>{_moonRS.rise}</div></div>
                      <div style={mcS}><div style={{fontSize:10,color:T3,textTransform:"uppercase",letterSpacing:".05em"}}>Moonset</div><div style={{fontSize:13,fontWeight:700,marginTop:6}}>{_moonRS.set}</div></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SOUNDING ───────────────────────────────────────────────────────── */}
        {activeTab==="snd"&&(
          <div>
            {!snd&&<div style={{color:T3,padding:20}}>Load a location to view sounding data.</div>}
            {snd&&(
              <div>
                <div style={cardS}>
                  <div style={stitle}>Skew-T Log-P &amp; Hodograph <span style={{color:T3,fontWeight:400,fontSize:10}}>{(snd.time||"").slice(0,16)} model</span></div>
                  <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                    {/* The Interactive React Component */}
                    <SkewT snd={snd} /> 
                    <canvas ref={hodoRef} width={220} height={220} style={{border:"1px solid "+BD,borderRadius:8,display:"block",cursor:"crosshair",flexShrink:0}} onMouseMove={onHodoMove} onMouseLeave={()=>setHodoTip(null)}/>
                  </div>
                </div>

                <div style={cardS}>
                  <div style={stitle}>Key Parameters</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                    <div>
                      <div style={{fontSize:10,color:T3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8,fontWeight:700}}>Instability</div>
                      {[
                        ["CAPE",snd.cape!=null?Math.round(snd.cape)+" J/kg":"--",capeClr(snd.cape)],
                        ["Lifted Index",snd.li!=null?snd.li.toFixed(1)+"C":"--",liClr(snd.li)],
                        ["Freezing Level",getFzLvl(snd),TC],
                        ["850-500 Lapse Rate",getLapse(snd),TC],
                        ["700mb RH",get700RH(snd),TC],
                      ].map(([k,v,c])=>(
                        <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid "+BD}}>
                          <span style={{fontSize:12,color:T2}}>{k}</span>
                          <span style={{fontSize:13,fontWeight:700,color:c}}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{fontSize:10,color:T3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8,fontWeight:700}}>Shear &amp; Wind</div>
                      {[
                        ["SRH 0-1 km",calcSRH(snd,1000)],
                        ["SRH 0-3 km",calcSRH(snd,3000)],
                        ["Bulk Shear Sfc-300",getBulk(snd)],
                        ["850mb Wind",getLvlW(snd,850)],
                        ["500mb Wind",getLvlW(snd,500)],
                      ].map(([k,v])=>{
                        const lbl=k.startsWith("SRH")?srhLabel(v):null;
                        return(
                          <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid "+BD}}>
                            <span style={{fontSize:12,color:T2}}>{k}</span>
                            <span style={{fontSize:13,fontWeight:700,color:srhClr(v)}}>
                              {v}
                              {lbl&&<span style={{display:"inline-block",background:lbl.color+"22",border:"1px solid "+lbl.color,borderRadius:4,padding:"1px 5px",fontSize:10,color:lbl.color,marginLeft:5}}>{lbl.label}</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{fontSize:11,color:T3,marginTop:8}}>SRH via Bunkers right-mover estimate. Yellow dashed = parcel trace from LCL.</div>
                </div>

                <div style={cardS}>
                  <div style={stitle}>Model Profile — {(snd.time||"").slice(0,16)}</div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead>
                        <tr style={{borderBottom:"1px solid "+BD2}}>
                          {["hPa","Hgt (m)","Temp F","Dewpt F","Wind"].map(h=>(
                            <th key={h} style={{padding:"5px 8px",textAlign:"right",fontSize:10,color:T3,fontWeight:700,textTransform:"uppercase",letterSpacing:".05em"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {snd.lvls.map((p,i)=>(
                          <tr key={p} style={{borderBottom:"1px solid "+BD,background:i%2===0?BG2:BG3}}>
                            <td style={{padding:"5px 8px",textAlign:"right",color:T2,fontWeight:600}}>{p}</td>
                            <td style={{padding:"5px 8px",textAlign:"right",color:T2}}>{snd.gh[i]!=null?Math.round(snd.gh[i]).toLocaleString():"--"}</td>
                            <td style={{padding:"5px 8px",textAlign:"right",color:"#fc8181",fontWeight:600}}>{snd.T[i]!=null?Math.round(snd.T[i])+"":"--"}</td>
                            <td style={{padding:"5px 8px",textAlign:"right",color:"#68d391",fontWeight:600}}>{snd.Td[i]!=null?Math.round(snd.Td[i])+"":"--"}</td>
                            <td style={{padding:"5px 8px",textAlign:"right"}}>{snd.ws[i]!=null?Math.round(snd.ws[i])+" mph "+wdir(snd.wd[i]||0):"--"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={cardS}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={stitle}>Observed Sounding (Radiosonde)</div>
                    {nearestRaobStn&&<button style={btnS(BG3)} onClick={()=>loadObsSnd(loc.lat,loc.lon)}>&#8635; Refresh</button>}
                  </div>
                  {nearestRaobStn&&(
                    <div>
                      <div style={{fontSize:11,color:T2,marginBottom:8}}>Nearest: <span style={{color:TC,fontWeight:700}}>{nearestRaobStn[1]}</span> (#{nearestRaobStn[0]}){obsSnd&&<span style={{marginLeft:8,color:T3}}>&middot; {obsSnd.time}</span>}</div>
                      {obsSndLoading&&<div style={{color:ACC,fontSize:12}}>&#8987; Loading radiosonde data...</div>}
                      {!obsSndLoading&&!obsSnd&&<div style={{color:T3,fontSize:12}}>No data available. Soundings launch at 00Z and 12Z.</div>}
                      {obsSnd&&obsSnd.rows&&(
                        <div style={{overflowX:"auto"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:340}}>
                            <thead>
                              <tr style={{borderBottom:"1px solid "+BD2}}>
                                {["hPa","Hgt (m)","Temp C","Dewpt C","Wind (kt)"].map(h=>(
                                  <th key={h} style={{padding:"5px 8px",textAlign:"right",fontSize:10,color:T3,fontWeight:700,textTransform:"uppercase"}}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {obsSnd.rows.slice(0,20).map((r,i)=>(
                                <tr key={i} style={{borderBottom:"1px solid "+BD,background:i%2===0?BG2:BG3}}>
                                  <td style={{padding:"4px 8px",textAlign:"right",color:T2,fontWeight:600}}>{r.pres}</td>
                                  <td style={{padding:"4px 8px",textAlign:"right",color:T2}}>{r.hght}</td>
                                  <td style={{padding:"4px 8px",textAlign:"right",color:"#fc8181",fontWeight:600}}>{r.temp.toFixed(1)}</td>
                                  <td style={{padding:"4px 8px",textAlign:"right",color:"#68d391",fontWeight:600}}>{r.dwpt.toFixed(1)}</td>
                                  <td style={{padding:"4px 8px",textAlign:"right"}}>{r.sknt} kt {wdir(r.drct)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {obsSnd.rows.length>20&&<div style={{fontSize:11,color:T3,marginTop:4}}>...{obsSnd.rows.length-20} more levels</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={cardS}>
                  <div style={stitle}>How to Read a Skew-T / Hodograph</div>
                  <div style={{fontSize:12,color:T2,lineHeight:1.8,marginBottom:10}}>
                    <div><span style={{color:"#ef4444",fontWeight:700}}>Red</span> = Temperature. <span style={{color:"#22c55e",fontWeight:700}}>Green</span> = Dewpoint. Close together = moist.</div>
                    <div><span style={{color:"rgba(255,200,50,0.8)",fontWeight:700}}>Yellow dashed</span> = Parcel trace from LCL. Area between parcel and T = CAPE.</div>
                    <div><span style={{fontWeight:700,color:TC}}>Wind barbs</span>: full barb = 10 kt, pennant = 50 kt, half = 5 kt.</div>
                    <div>Hodograph: <span style={{color:"#22c55e",fontWeight:700}}>green</span> = Sfc-3km, <span style={{color:"#fbbf24",fontWeight:700}}>yellow</span> = 3-6km, <span style={{color:"#f87171",fontWeight:700}}>red</span> = 6-9km. Curved = veering shear.</div>
                    <div>SRH &gt;150 = supercell possible, &gt;300 = significant tornado potential.</div>
                  </div>
                  {[["https://www.weather.gov/jetstream/skewt","NWS JetStream - How to Read a Skew-T","Official beginner-friendly walkthrough"],["https://www.spc.noaa.gov/exper/soundings/","SPC Observed Soundings","Twice-daily radiosonde data plotted on Skew-T"],["https://rucsoundings.noaa.gov/","RUC/RAP Model Soundings","Model-derived sounding at any location and time"],["https://www.meted.ucar.edu/mesoprim/skewt/navmenu.php","MetEd - Skew-T Mastery","Free interactive training (UCAR free account)"]].map(([href,label,desc])=>(
                    <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={{display:"block",background:BG3,border:"1px solid "+BD,borderRadius:8,padding:"10px 14px",marginBottom:8,textDecoration:"none",color:TC}}>
                      <div style={{fontWeight:700,color:ACC,marginBottom:2}}>{label} &#8599;</div>
                      <div style={{fontSize:11,color:T2}}>{desc}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── METARs ─────────────────────────────────────────────────────────── */}
        {activeTab==="metar"&&(
          <div>
            <div style={cardS}>
              <div style={stitle}>METAR Stations{loc?" near "+loc.name:""}</div>
              <div style={{fontSize:12,color:T2,lineHeight:1.7,marginBottom:14}}>
                METARs are surface aviation weather observations issued every 20–60 minutes by airport stations. The links below open live viewers pre-loaded for your region. <strong style={{color:TC}}>KYNG</strong> (Youngstown-Warren Regional) and surrounding stations will be listed there.
              </div>

              {metarLoading && <div style={{ color: "#3d8bff", marginBottom: 12 }}>Loading nearby stations...</div>}
              {!metarLoading && metarList.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  {metarList.map((m) => (
                    <div key={m.stationId} style={{ background: "#0d1b30", border: "1px solid #162640", borderRadius: 6, padding: "8px 10px", marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, color: "#3d8bff" }}>{m.stationId} <span style={{ color: "#6a8aa8", fontWeight: 400, fontSize: 11 }}>{new Date(m.reportTime).toLocaleTimeString()}</span></div>
                      <div style={{ fontFamily: "monospace", fontSize: 11, color: "#cdd9e8", marginTop: 4 }}>{m.rawOb}</div>
                    </div>
                  ))}
                </div>
              )}

              {loc&&(
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,color:T3,textTransform:"uppercase",letterSpacing:".08em",fontWeight:700,marginBottom:8}}>Your Region</div>
                  {[
                    ["https://aviationweather.gov/data/metar/?id=KYNG,KCLE,KPBZ,KPIT,KERI,KAKR,KCAD,KBKL&decoded=yes&hours=2",
                     "Decoded METARs — NE Ohio / W PA",
                     "KYNG, KCLE, KPBZ, KPIT, KERI, KAKR and more — decoded, human-readable format"],
                    ["https://aviationweather.gov/data/metar/?id=KYNG,KCLE,KPBZ,KPIT,KERI,KAKR,KCAD,KBKL&decoded=no&hours=2",
                     "Raw METARs — NE Ohio / W PA",
                     "Same stations — raw METAR strings"],
                    ["https://forecast.weather.gov/product.php?site=CLE&issuedby=CLE&product=OSO&format=CI",
                     "NWS Cleveland — Hourly Surface Obs (OSO)",
                     "Official NWS CLE hourly observations product"],
                    ["https://aviationweather.gov/map/",
                     "AWC METAR Map",
                     "Interactive map showing all METAR stations globally"],
                  ].map(([href,label,desc])=>(
                    <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                      style={{display:"block",background:BG3,border:"1px solid "+BD,borderRadius:8,padding:"10px 14px",marginBottom:8,textDecoration:"none",color:TC}}>
                      <div style={{fontWeight:700,color:ACC,marginBottom:2}}>{label} &#8599;</div>
                      <div style={{fontSize:11,color:T2}}>{desc}</div>
                    </a>
                  ))}
                </div>
              )}

              <div style={{fontSize:10,color:T3,textTransform:"uppercase",letterSpacing:".08em",fontWeight:700,marginBottom:8}}>General METAR Resources</div>
              {[
                ["https://aviationweather.gov/data/metar/",
                 "Aviation Weather Center — METAR Viewer",
                 "Search any station ID worldwide — decoded and raw formats, TAF included"],
                ["https://aviationweather.gov/map/",
                 "AWC METAR Map (interactive)",
                 "Pan and zoom to see all reporting stations on a map"],
                ["https://aviationweather.gov/api/data/metar?ids=KYNG&format=raw&hours=2",
                 "Direct API — KYNG raw (bookmark this)",
                 "Bookmark-friendly direct link to Youngstown-Warren Regional latest obs"],
                ["https://mesonet.agron.iastate.edu/ASOS/",
                 "IEM ASOS Station List",
                 "Full list of all ASOS stations with links to their observation history"],
              ].map(([href,label,desc])=>(
                <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                  style={{display:"block",background:BG3,border:"1px solid "+BD,borderRadius:8,padding:"10px 14px",marginBottom:8,textDecoration:"none",color:TC}}>
                  <div style={{fontWeight:700,color:ACC,marginBottom:2}}>{label} &#8599;</div>
                  <div style={{fontSize:11,color:T2}}>{desc}</div>
                </a>
              ))}

              {isUS&&(
                <div style={{marginTop:14}}>
                  <div style={{fontSize:10,color:T3,textTransform:"uppercase",letterSpacing:".08em",fontWeight:700,marginBottom:8}}>Quick Station Lookup</div>
                  <div style={{fontSize:12,color:T2,marginBottom:8}}>Paste any of these into the AWC viewer above:</div>
                  <div style={{fontFamily:"'Courier New',monospace",fontSize:12,background:BG3,border:"1px solid "+BD,borderRadius:8,padding:"10px 14px",lineHeight:2}}>
                    {["KYNG — Youngstown-Warren Regional, OH","KCLE — Cleveland Hopkins Intl, OH","KPBZ — Pittsburgh/Moon Township, PA","KPIT — Pittsburgh Intl, PA","KERI — Erie Intl, PA","KAKR — Akron-Canton, OH","KCMH — Columbus, OH","KBUF — Buffalo, NY"].map(s=>(
                      <div key={s} style={{color:TC}}>{s}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ALERTS ─────────────────────────────────────────────────────────── */}
        {activeTab==="alrt"&&(
          <div>
            {!loc&&<div style={{color:T3,textAlign:"center",padding:40}}>Search a location to load alerts and forecast discussion.</div>}
            {afd&&(
              <div style={cardS}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={stitle}>Area Forecast Discussion &mdash; {afd.office}</div>
                  <button style={btnS(BG3)} onClick={()=>setAfdExpanded(v=>!v)}>{afdExpanded?"Collapse":"Expand"}</button>
                </div>
                <div style={{fontSize:10,color:T3,marginBottom:8}}>{afd.issued?new Date(afd.issued).toLocaleString():""}</div>
                <pre style={{fontSize:11,color:T2,whiteSpace:"pre-wrap",wordBreak:"break-word",lineHeight:1.6,margin:0,fontFamily:"inherit",maxHeight:afdExpanded?"none":"200px",overflow:afdExpanded?"visible":"hidden"}}>{afd.text.replace(/\n{3,}/g,"\n\n").trim()}</pre>
                {!afdExpanded&&afd.text.length>300&&<div style={{fontSize:11,color:ACC,marginTop:6,cursor:"pointer"}} onClick={()=>setAfdExpanded(true)}>&#9660; Show full discussion</div>}
              </div>
            )}
            {!afd&&loc&&isUS&&<div style={{...cardS,color:T3,fontSize:13}}>&#8987; Loading forecast discussion...</div>}
            {spcWatches.length>0&&(
              <div style={cardS}>
                <div style={stitle}>SPC Active Watches ({spcWatches.length})</div>
                {spcWatches.map((w,i)=>{const isTorn=w.type.includes("TORNADO");return(<div key={i} style={{background:isTorn?"#3b0000":"#2d1800",border:"1px solid "+(isTorn?"#ff4444":"#ff8800"),borderRadius:9,padding:"10px 14px",marginBottom:8}}><div style={{fontWeight:800,color:isTorn?"#ff6666":"#ffaa44"}}>{isTorn?"🌪️":"⛈️"} {w.type}</div></div>);})}
              </div>
            )}
            {nws.length>0&&(
              <div style={cardS}>
                <div style={stitle}>NWS Active Alerts ({nws.length})</div>
                {nws.map((a,i)=>(<div key={i} style={{background:"#3b0d0d",border:"1px solid "+RED,borderRadius:9,padding:"11px 14px",marginBottom:10}}><div style={{fontWeight:800,color:"#fc8181"}}>&#9888;&#65039; {a.event}</div><div style={{fontSize:11,color:"#fc8181",opacity:.8,marginTop:3}}>{(a.headline||"").slice(0,300)}</div></div>))}
              </div>
            )}
            {mds.length>0&&(
              <div style={cardS}>
                <div style={stitle}>SPC Mesoscale Discussions ({mds.length})</div>
                {mds.map((m,i)=>(<div key={i} style={{borderBottom:i===mds.length-1?"none":"1px solid "+BD,paddingBottom:12,marginBottom:12}}><div style={{fontSize:11,color:ACC,fontWeight:700,marginBottom:4}}>{m.id} &middot; {m.issued?new Date(m.issued).toLocaleString():""}</div><pre style={{fontSize:11,color:T2,whiteSpace:"pre-wrap",wordBreak:"break-word",lineHeight:1.6,margin:0,fontFamily:"inherit"}}>{m.text.trim()}</pre></div>))}
              </div>
            )}
          </div>
        )}

        {/* ── RESOURCES ──────────────────────────────────────────────────────── */}
        {activeTab==="rsrc"&&(
          <div>
            <div style={cardS}>
              {isUS?(
                <>
                  <div style={stitle}>Your NWS Office{_cwa?" - "+_cwa:""}</div>
                  {!loc&&<div style={{color:T3,fontSize:12}}>Search a location to get regional links.</div>}
                  {loc&&!_cwa&&<div style={{color:T3,fontSize:12}}>Loading office info...</div>}
                  {_cwaLow&&[
                    ["https://www.weather.gov/"+_cwaLow,"NWS "+_cwa+" Homepage","Main office page"],
                    loc?["https://forecast.weather.gov/MapClick.php?lat="+loc.lat.toFixed(4)+"&lon="+loc.lon.toFixed(4),"Point Forecast - "+loc.name,"7-day text forecast for your coordinates"]:null,
                    loc?["https://forecast.weather.gov/MapClick.php?lat="+loc.lat.toFixed(4)+"&lon="+loc.lon.toFixed(4)+"&FcstType=graphical","Hourly Weather Graph","Temp, wind, precip breakdown"]:null,
                    _cwa?["https://forecast.weather.gov/product.php?site="+_cwa+"&issuedby="+_cwa+"&product=AFD&format=CI&version=1&glossary=0","Area Forecast Discussion (AFD)","Latest forecaster reasoning"]:null,
                    _cwa?["https://forecast.weather.gov/product.php?site="+_cwa+"&issuedby="+_cwa+"&product=HWO&format=CI","Hazardous Weather Outlook","Potential hazards next 7 days"]:null,
                    ["https://www.weather.gov/"+_cwaLow+"/climate","Local Climate Data","Records, climatology, monthly summaries"],
                  ].filter(Boolean).map(([href,label,desc])=>(
                    <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={{display:"block",background:BG3,border:"1px solid "+BD,borderRadius:8,padding:"10px 14px",marginBottom:8,textDecoration:"none",color:TC}}>
                      <div style={{fontWeight:700,color:ACC,marginBottom:2}}>{label} &#8599;</div>
                      <div style={{fontSize:11,color:T2}}>{desc}</div>
                    </a>
                  ))}
                </>
              ):(
                <>
                  <div style={stitle}>{_euMet?"National Met Office - "+_euMet.name:"Regional Resources"}</div>
                  {!loc&&<div style={{color:T3,fontSize:12}}>Search a location to get regional links.</div>}
                  {_euMet&&_euMet.links.map(([href,label,desc])=>(
                    <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={{display:"block",background:BG3,border:"1px solid "+BD,borderRadius:8,padding:"10px 14px",marginBottom:8,textDecoration:"none",color:TC}}>
                      <div style={{fontWeight:700,color:ACC,marginBottom:2}}>{label} &#8599;</div>
                      <div style={{fontSize:11,color:T2}}>{desc}</div>
                    </a>
                  ))}
                  {!_euMet&&loc&&<div style={{color:T3,fontSize:12,marginBottom:8}}>No specific links for {_cc} yet.</div>}
                  {[["https://www.meteoalarm.org/","MeteoAlarm - Pan-European Warnings","Official European warning aggregator - all 35+ countries"],["https://openweathermap.org/","OpenWeatherMap","Good general-purpose forecast for any global city"]].map(([href,label,desc])=>(
                    <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={{display:"block",background:BG3,border:"1px solid "+BD,borderRadius:8,padding:"10px 14px",marginBottom:8,textDecoration:"none",color:TC}}>
                      <div style={{fontWeight:700,color:ACC,marginBottom:2}}>{label} &#8599;</div>
                      <div style={{fontSize:11,color:T2}}>{desc}</div>
                    </a>
                  ))}
                </>
              )}
            </div>

            {isUS&&(
              <div style={cardS}>
                <div style={stitle}>Storm Prediction Center</div>
                {[["https://www.spc.noaa.gov/products/outlook/","Day 1-3 Convective Outlooks","Categorical and probabilistic severe weather outlooks"],["https://www.spc.noaa.gov/products/outlook/day4-8otlk.html","Days 4-8 Outlooks","Extended range probabilistic outlook"],["https://www.spc.noaa.gov/climo/reports/today.html","Today's Storm Reports","Real-time tornado, hail, wind reports"],["https://www.spc.noaa.gov/products/watch/","Active Watches","Currently active watches"],["https://www.spc.noaa.gov/products/md/","Mesoscale Discussions","Short-term convective threat guidance"]].map(([href,label,desc])=>(
                  <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={{display:"block",background:BG3,border:"1px solid "+BD,borderRadius:8,padding:"10px 14px",marginBottom:8,textDecoration:"none",color:TC}}>
                    <div style={{fontWeight:700,color:ACC,marginBottom:2}}>{label} &#8599;</div>
                    <div style={{fontSize:11,color:T2}}>{desc}</div>
                  </a>
                ))}
              </div>
            )}

            <div style={cardS}>
              <div style={stitle}>Satellite Imagery</div>
              <div style={{fontSize:12,color:T2,marginBottom:10,lineHeight:1.6}}><strong style={{color:TC}}>Satellite shows clouds. Radar shows precipitation.</strong> A solid overcast can show zero radar return if nothing is falling.</div>
              {(isUS?[["https://www.star.nesdis.noaa.gov/GOES/conus.php?sat=G16","GOES-16 East - NESDIS/STAR","Official NOAA GOES-East: visible, IR, water vapor"],["https://weather.cod.edu/satrad/?parms=subregional-GOES_East-13-200-1-100-1","College of DuPage GOES Viewer","Fast regional viewer with many band options"],["https://zoom.earth/","Zoom Earth","Near real-time satellite + rain overlay, global"]]:[["https://www.metoffice.gov.uk/weather/maps-and-charts/satellite-images","Met Office Satellite Viewer","UK Met Office visible and IR loops"],["https://view.eumetsat.int/productviewer?v=default","EUMETSAT EUMETView","Meteosat full-disc and regional products"],["https://www.sat24.com/en/eu","SAT24 Europe","Animated satellite loop for Europe"],["https://zoom.earth/","Zoom Earth","Near real-time satellite + rain overlay, global"]]).map(([href,label,desc])=>(
                <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={{display:"block",background:BG3,border:"1px solid "+BD,borderRadius:8,padding:"10px 14px",marginBottom:8,textDecoration:"none",color:TC}}>
                  <div style={{fontWeight:700,color:ACC,marginBottom:2}}>{label} &#8599;</div>
                  <div style={{fontSize:11,color:T2}}>{desc}</div>
                </a>
              ))}
              <a href="https://worldview.earthdata.nasa.gov/" target="_blank" rel="noopener noreferrer" style={{display:"block",background:BG3,border:"1px solid "+BD,borderRadius:8,padding:"10px 14px",marginBottom:8,textDecoration:"none",color:TC}}>
                <div style={{fontWeight:700,color:ACC,marginBottom:2}}>NASA Worldview &#8599;</div>
                <div style={{fontSize:11,color:T2}}>Full-resolution imagery for any date since 2012</div>
              </a>
            </div>

            <div style={cardS}>
              <div style={stitle}>Soundings &amp; Upper Air</div>
              {[["https://weather.uwyo.edu/upperair/sounding.html","U. Wyoming Soundings","Observed radiosonde data - global archive"],["https://www.spc.noaa.gov/exper/soundings/","SPC Observed Soundings","Twice-daily data plotted on Skew-T"],["https://rucsoundings.noaa.gov/","RUC/RAP Model Soundings","Model-derived sounding anywhere, anytime"],["https://www.meted.ucar.edu/mesoprim/skewt/navmenu.php","MetEd - Skew-T Module","Free interactive training (UCAR account)"]].map(([href,label,desc])=>(
                <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={{display:"block",background:BG3,border:"1px solid "+BD,borderRadius:8,padding:"10px 14px",marginBottom:8,textDecoration:"none",color:TC}}>
                  <div style={{fontWeight:700,color:ACC,marginBottom:2}}>{label} &#8599;</div>
                  <div style={{fontSize:11,color:T2}}>{desc}</div>
                </a>
              ))}
            </div>

            <div style={cardS}>
              <div style={stitle}>Model Guidance</div>
              {[[true,"https://www.tropicaltidbits.com/analysis/models/","Tropical Tidbits","GFS, EURO, NAM, HRRR - fast, global coverage"],[!isUS,"https://www.ecmwf.int/en/forecasts/charts/","ECMWF Charts","Official European Centre - global gold standard"],[true,"https://mag.ncep.noaa.gov/","NCEP Model Analysis","Official NOAA model output"],[true,"https://www.pivotalweather.com/model.php","Pivotal Weather","Professional model viewer - great for comparing runs"],[!isUS,"https://www.meteoblue.com/en/weather/maps/","Meteoblue Maps","European-focused model maps"]].filter(r=>r[0]).map(([,href,label,desc])=>(
                <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={{display:"block",background:BG3,border:"1px solid "+BD,borderRadius:8,padding:"10px 14px",marginBottom:8,textDecoration:"none",color:TC}}>
                  <div style={{fontWeight:700,color:ACC,marginBottom:2}}>{label} &#8599;</div>
                  <div style={{fontSize:11,color:T2}}>{desc}</div>
                </a>
              ))}
            </div>

            <div style={cardS}>
              <div style={stitle}>Learning &amp; Reference</div>
              {[["https://www.weather.gov/jetstream/","NWS JetStream - Online School","Comprehensive met education from NWS"],["https://www.meted.ucar.edu/","MetEd (UCAR)","Free training modules - requires free account"],["https://glossary.ametsoc.org/wiki/Main_Page","AMS Glossary of Meteorology","Authoritative definitions for weather terms"],["https://aviationweather.gov/data/metar/","Aviation Weather Center - METARs","Global METAR viewer and decoder"]].map(([href,label,desc])=>(
                <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={{display:"block",background:BG3,border:"1px solid "+BD,borderRadius:8,padding:"10px 14px",marginBottom:8,textDecoration:"none",color:TC}}>
                  <div style={{fontWeight:700,color:ACC,marginBottom:2}}>{label} &#8599;</div>
                  <div style={{fontSize:11,color:T2}}>{desc}</div>
                </a>
              ))}
            </div>
          </div>
        )}

      </div>

      {hodoTip&&<div style={Object.assign({},tipStyle,{left:hodoTip.x+14,top:hodoTip.y-10})}><div style={{fontWeight:700,color:ACC,marginBottom:2}}>{hodoTip.label}</div><div>{hodoTip.val}</div></div>}
    </div>
  );
}