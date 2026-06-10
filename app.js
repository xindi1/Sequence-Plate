const STORAGE_KEY = "sequence_plate_v6_meals";
const TYPES = ["Anchor","Expand","Reinforce","Sweet","Drink"];
const LEGACY_MAP = {"Protein":"Anchor","Fat":"Anchor","Light vegetable":"Expand","Heavy vegetable":"Reinforce","Fruit":"Sweet","Carbohydrate":"Sweet","Dessert":"Sweet","Alcohol":"Sweet","Beverage":"Drink"};
let meals = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let editId = null;
let deferredPrompt = null;

const $ = id => document.getElementById(id);
const rowsEl = $("rows");

function nowLocal(){
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,16);
}
$("dt").value = nowLocal();

function uid(){ return "m_" + Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4); }
function saveStore(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(meals)); render(); }

function addRow(item="", type="Anchor"){
  const i = rowsEl.children.length + 1;
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `<div class="idx">${i}</div>
    <input class="item" placeholder="Item(s)" value="${escapeHtml(item)}">
    <select class="type">${TYPES.map(t=>`<option ${t===type?"selected":""}>${t}</option>`).join("")}</select>
    <button class="x" type="button">×</button>`;
  row.querySelector(".x").onclick = () => { row.remove(); renumber(); live(); };
  row.querySelector(".item").oninput = live;
  row.querySelector(".type").onchange = live;
  rowsEl.appendChild(row);
  live();
}
function renumber(){ [...rowsEl.children].forEach((r,idx)=>r.querySelector(".idx").textContent=idx+1); }

function getFunctions(){
  return [...rowsEl.children].map(r => ({
    item: r.querySelector(".item").value.trim(),
    type: r.querySelector(".type").value
  })).filter(f => f.item);
}

function scoreMeal(funcs, outcomes={}){
  if(!funcs.length) return {score:null, explain:"Add functions to score."};
  const types = funcs.map(f=>f.type);
  let s = 40;
  if(types.includes("Anchor")) s += 20;
  if(types.includes("Expand")) s += 12;
  if(types.includes("Reinforce")) s += 14;
  if(types.includes("Sweet")){
    const firstSweet = types.indexOf("Sweet");
    const hasAnchorBefore = types.slice(0, firstSweet).includes("Anchor");
    const hasBufferBefore = types.slice(0, firstSweet).some(t => t==="Expand" || t==="Reinforce");
    s += hasAnchorBefore ? 8 : -8;
    s += hasBufferBefore ? 8 : -6;
  } else {
    s += 6;
  }
  if(types.includes("Drink")){
    const lastDrink = types[types.length-1] === "Drink";
    s += lastDrink ? 8 : 0;
  }
  const anchorCount = types.filter(t=>t==="Anchor").length;
  if(anchorCount >= 2) s += 8;
  const sweetCount = types.filter(t=>t==="Sweet").length;
  if(sweetCount > 1) s -= (sweetCount-1)*8;
  const cravings = Number(outcomes.cravings || 0);
  const satiety = Number(outcomes.satiety || 0);
  const energy = Number(outcomes.energy || 0);
  if(cravings) s += (6-cravings)*3 - 6;
  if(satiety) s += (satiety-3)*4;
  if(energy) s += (energy-3)*2;
  s = Math.max(0, Math.min(100, Math.round(s)));
  let explain = [];
  if(types.includes("Anchor")) explain.push("anchor present");
  if(types.includes("Expand") || types.includes("Reinforce")) explain.push("vegetable/fiber buffer");
  if(types.includes("Sweet")) explain.push("sweet timing scored");
  if(types[types.length-1]==="Drink") explain.push("drink last");
  if(anchorCount>=2) explain.push("second anchor credited");
  return {score:s, explain: explain.join(" • ") || "intentional structure scored"};
}

function live(){
  const funcs = getFunctions();
  const outcomes = {satiety:$("satiety").value, energy:$("energy").value, cravings:$("cravings").value};
  const r = scoreMeal(funcs, outcomes);
  $("liveScore").textContent = r.score ?? "—";
  $("scoreExplain").textContent = r.explain;
}

function resetForm(){
  editId=null; $("formTitle").textContent="New Meal"; $("cancelEditBtn").classList.add("hidden");
  ["name","notes"].forEach(id=>$(id).value=""); $("dt").value=nowLocal();
  $("context").value="Normal meal"; ["hunger","satiety","energy","cravings"].forEach(id=>$(id).value="");
  rowsEl.innerHTML=""; addRow(); addRow("", "Expand"); addRow("", "Reinforce"); addRow("", "Sweet"); addRow("", "Drink");
  live();
}

function mealFromForm(){
  const funcs = getFunctions();
  const outcomes = {satiety:$("satiety").value, energy:$("energy").value, cravings:$("cravings").value};
  const sc = scoreMeal(funcs, outcomes);
  return {
    id: editId || uid(),
    name: $("name").value.trim() || "Meal",
    dt: $("dt").value,
    context: $("context").value,
    hunger: $("hunger").value,
    notes: $("notes").value.trim(),
    functions: funcs,
    outcomes,
    score: sc.score,
    scoreExplain: sc.explain,
    updatedAt: new Date().toISOString()
  };
}

function editMeal(id){
  const m = meals.find(x=>x.id===id); if(!m) return;
  editId=id; $("formTitle").textContent="Edit Meal"; $("cancelEditBtn").classList.remove("hidden");
  $("name").value=m.name||""; $("dt").value=(m.dt||nowLocal()).slice(0,16); $("context").value=m.context||"Normal meal";
  $("hunger").value=m.hunger||""; $("notes").value=m.notes||"";
  $("satiety").value=m.outcomes?.satiety||""; $("energy").value=m.outcomes?.energy||""; $("cravings").value=m.outcomes?.cravings||"";
  rowsEl.innerHTML=""; (m.functions||[]).forEach(f=>addRow(f.item, f.type)); if(!rowsEl.children.length) addRow();
  window.scrollTo({top:0,behavior:"smooth"}); live();
}
function duplicateMeal(id){
  const m = meals.find(x=>x.id===id); if(!m) return;
  const copy = JSON.parse(JSON.stringify(m)); copy.id=uid(); copy.name=(copy.name||"Meal")+" copy"; copy.dt=nowLocal(); copy.updatedAt=new Date().toISOString();
  meals.unshift(copy); saveStore();
}
function deleteMeal(id){
  if(confirm("Delete this meal?")){ meals = meals.filter(m=>m.id!==id); saveStore(); }
}

function render(){
  meals.sort((a,b)=>String(b.dt).localeCompare(String(a.dt)));
  $("mealCount").textContent = meals.length;
  const scores = meals.map(m=>Number(m.score)).filter(n=>!isNaN(n));
  $("avgScore").textContent = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : "—";
  const cr = meals.map(m=>Number(m.outcomes?.cravings)).filter(n=>n);
  $("avgCravings").textContent = cr.length ? (cr.reduce((a,b)=>a+b,0)/cr.length).toFixed(1) : "—";

  const groups = {};
  for(const m of meals){
    const day = (m.dt || "Undated").slice(0,10);
    (groups[day] ||= []).push(m);
  }
  $("ledger").innerHTML = Object.entries(groups).map(([day,items])=>{
    const avg = Math.round(items.reduce((a,m)=>a+(Number(m.score)||0),0)/items.length);
    return `<div class="day"><div class="dayHead"><span>${day}</span><span>Daily avg ${avg}</span></div>
      ${items.map(m=>`<article class="meal">
        <div class="mealTop"><div><h3>${escapeHtml(m.name)}</h3><div class="fn">${escapeHtml(m.context||"")} ${m.hunger?`• hunger ${m.hunger}`:""}</div></div><span class="badge">${m.score ?? "—"}</span></div>
        <div class="fn">${(m.functions||[]).map(f=>`${escapeHtml(f.item)} <b>${f.type}</b>`).join(" → ")}</div>
        ${m.notes?`<div class="fn">${escapeHtml(m.notes)}</div>`:""}
        <div class="mealActions">
          <button class="secondary" onclick="editMeal('${m.id}')">Edit</button>
          <button class="secondary" onclick="duplicateMeal('${m.id}')">Duplicate</button>
          <button class="danger" onclick="deleteMeal('${m.id}')">Delete</button>
        </div>
      </article>`).join("")}</div>`;
  }).join("") || `<section class="card"><p class="sub">No meals yet. Import JSON or save a new meal.</p></section>`;
}

function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

function normalizeImported(obj){
  const arr = obj.meals || [];
  return arr.map(m=>{
    let funcs = m.functions;
    if(!funcs && m.courses){
      funcs = m.courses.filter(c=>c.item && c.item.trim()).map(c=>({item:c.item.trim(), type:LEGACY_MAP[c.type] || c.type || "Anchor", legacyType:c.type}));
    }
    funcs = (funcs||[]).filter(f=>f.item).map(f=>({item:f.item, type:LEGACY_MAP[f.type] || f.type || "Anchor", legacyType:f.legacyType}));
    const outcomes = m.outcomes || {satiety:"",energy:"",cravings:""};
    const sc = scoreMeal(funcs,outcomes);
    return {...m, id:m.id||uid(), functions:funcs, outcomes, score:sc.score, scoreExplain:sc.explain};
  });
}

$("addRowBtn").onclick = () => addRow();
$("saveBtn").onclick = () => {
  const m = mealFromForm();
  const idx = meals.findIndex(x=>x.id===m.id);
  if(idx>=0) meals[idx]=m; else meals.unshift(m);
  saveStore(); resetForm();
};
$("resetBtn").onclick = resetForm;
$("cancelEditBtn").onclick = resetForm;

$("exportJsonBtn").onclick = () => {
  const payload = {app:"Sequence Plate", version:"6.0", exportedAt:new Date().toISOString(), meals};
  download("sequence-plate-v6-export.json", JSON.stringify(payload,null,2), "application/json");
};
$("exportCsvBtn").onclick = () => {
  const rows = [["name","dt","context","hunger","score","functions","satiety","energy","cravings","notes"]];
  meals.forEach(m=>rows.push([m.name,m.dt,m.context,m.hunger,m.score,(m.functions||[]).map(f=>`${f.item}:${f.type}`).join(" > "),m.outcomes?.satiety,m.outcomes?.energy,m.outcomes?.cravings,m.notes]));
  download("sequence-plate-v6-export.csv", rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n"), "text/csv");
};
$("importFile").onchange = e => {
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const obj = JSON.parse(reader.result);
      const imported = normalizeImported(obj);
      meals = [...imported, ...meals];
      saveStore();
      alert(`Imported ${imported.length} meals.`);
    }catch(err){ alert("Import failed: " + err.message); }
  };
  reader.readAsText(file);
};
$("clearBtn").onclick = () => { if(confirm("Clear all saved meals?")){ meals=[]; saveStore(); } };

function download(name, content, type){
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); URL.revokeObjectURL(a.href);
}

window.addEventListener("beforeinstallprompt", e=>{ e.preventDefault(); deferredPrompt=e; $("installBtn").classList.remove("hidden"); });
$("installBtn").onclick=async()=>{ if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt=null; $("installBtn").classList.add("hidden"); } };
if("serviceWorker" in navigator){ navigator.serviceWorker.register("sw.js").catch(()=>{}); }

resetForm(); render();