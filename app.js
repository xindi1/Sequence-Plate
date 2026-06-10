const STORAGE_KEY = "sequence_plate_v7_entries";
const TYPES = ["Anchor","Expand","Reinforce","Sweet"];
const LEGACY_MAP = {"Protein":"Anchor","Fat":"Anchor","Light vegetable":"Expand","Heavy vegetable":"Reinforce","Fruit":"Sweet","Carbohydrate":"Sweet","Dessert":"Sweet","Alcohol":"Sweet","Beverage":"Drink"};
let entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let editId = null;
let entryType = "Meal";
let deferredPrompt = null;
const $ = id => document.getElementById(id);
const rowsEl = $("rows");

function nowLocal(){ const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,16); }
function uid(){ return "e_" + Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4); }
function saveStore(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); render(); }
function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

function setEntryType(t){
  entryType = t;
  $("mealTab").classList.toggle("active", t==="Meal");
  $("bevTab").classList.toggle("active", t==="Beverage");
  $("mealFields").classList.toggle("hidden", t!=="Meal");
  $("beverageFields").classList.toggle("hidden", t!=="Beverage");
  $("scoreLabel").textContent = t === "Meal" ? "Meal Effectiveness" : "Beverage Fit";
  live();
}

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
  return [...rowsEl.children].map(r => ({ item: r.querySelector(".item").value.trim(), type: r.querySelector(".type").value })).filter(f => f.item);
}
function getOutcomes(){ return {satiety:$("satiety").value, energy:$("energy").value, cravings:$("cravings").value}; }

function scoreMeal(funcs, outcomes={}){
  if(!funcs.length) return {score:null, explain:"Add functions to score."};
  const types = funcs.map(f=>f.type);
  let s = 42;
  if(types.includes("Anchor")) s += 22;
  if(types.includes("Expand")) s += 13;
  if(types.includes("Reinforce")) s += 15;
  if(types.includes("Sweet")){
    const firstSweet = types.indexOf("Sweet");
    const hasAnchorBefore = types.slice(0, firstSweet).includes("Anchor");
    const hasBufferBefore = types.slice(0, firstSweet).some(t => t==="Expand" || t==="Reinforce");
    s += hasAnchorBefore ? 8 : -8;
    s += hasBufferBefore ? 8 : -6;
  } else s += 7;
  const anchorCount = types.filter(t=>t==="Anchor").length;
  if(anchorCount >= 2) s += 8;
  const sweetCount = types.filter(t=>t==="Sweet").length;
  if(sweetCount > 1) s -= (sweetCount-1)*8;
  const cravings = Number(outcomes.cravings || 0), satiety = Number(outcomes.satiety || 0), energy = Number(outcomes.energy || 0);
  if(cravings) s += (6-cravings)*3 - 6;
  if(satiety) s += (satiety-3)*4;
  if(energy) s += (energy-3)*2;
  s = Math.max(0, Math.min(100, Math.round(s)));
  let explain = [];
  if(types.includes("Anchor")) explain.push("anchor present");
  if(types.includes("Expand") || types.includes("Reinforce")) explain.push("vegetable/fiber buffer");
  if(types.includes("Sweet")) explain.push("sweet timing scored");
  if(anchorCount>=2) explain.push("second anchor credited");
  return {score:s, explain: explain.join(" • ") || "intentional structure scored"};
}

function scoreBeverage(){
  const bev = $("beverage").value.trim();
  if(!bev) return {score:null, explain:"Add beverage to score."};
  let s = 82;
  const sugar = $("addedSugar").value, cal = $("caloric").value, protein = $("proteinBeverage").value, purpose = $("beveragePurpose").value;
  if(sugar==="No") s += 8;
  if(sugar==="Light") s += 3;
  if(sugar==="Moderate") s -= 8;
  if(sugar==="High") s -= 20;
  if(cal==="No") s += 4;
  if(cal==="Light") s += 2;
  if(cal==="High") s -= 8;
  if(protein==="Yes") s += 6;
  if(["Recovery","Hydration","Energy","Routine"].includes(purpose)) s += 3;
  const cravings = Number($("cravings").value || 0), energy = Number($("energy").value || 0);
  if(cravings) s += (6-cravings)*2 - 4;
  if(energy) s += (energy-3)*2;
  s = Math.max(0, Math.min(100, Math.round(s)));
  let exp = [`purpose: ${purpose.toLowerCase()}`];
  if(sugar) exp.push(`sugar: ${sugar.toLowerCase()}`);
  if(protein==="Yes") exp.push("protein credited");
  return {score:s, explain:exp.join(" • ")};
}

function live(){
  const r = entryType==="Meal" ? scoreMeal(getFunctions(), getOutcomes()) : scoreBeverage();
  $("liveScore").textContent = r.score ?? "—";
  $("scoreExplain").textContent = r.explain;
}

function resetForm(){
  editId=null; $("formTitle").textContent="New Entry"; $("cancelEditBtn").classList.add("hidden");
  ["name","notes","mealBeverages","beverage"].forEach(id=>$(id).value="");
  $("dt").value=nowLocal(); $("context").value="Normal meal"; $("beveragePurpose").value="Energy";
  ["hunger","satiety","energy","cravings","addedSugar","caloric","proteinBeverage"].forEach(id=>$(id).value="");
  rowsEl.innerHTML=""; addRow(); addRow("", "Expand"); addRow("", "Reinforce"); addRow("", "Sweet");
  setEntryType("Meal"); live();
}

function entryFromForm(){
  const outcomes = getOutcomes();
  if(entryType==="Meal"){
    const funcs = getFunctions();
    const sc = scoreMeal(funcs, outcomes);
    const bevText = $("mealBeverages").value.trim();
    return {id:editId||uid(), entryType:"Meal", name:$("name").value.trim()||"Meal", dt:$("dt").value, context:$("context").value, hunger:$("hunger").value, notes:$("notes").value.trim(), functions:funcs, beverages:bevText ? bevText.split(",").map(x=>({item:x.trim(), type:"Beverage"})).filter(x=>x.item) : [], outcomes, score:sc.score, scoreExplain:sc.explain, updatedAt:new Date().toISOString()};
  }
  const sc = scoreBeverage();
  return {id:editId||uid(), entryType:"Beverage", name:$("name").value.trim()||"Beverage", dt:$("dt").value, context:$("context").value, hunger:$("hunger").value, notes:$("notes").value.trim(), beverage:$("beverage").value.trim(), beveragePurpose:$("beveragePurpose").value, addedSugar:$("addedSugar").value, caloric:$("caloric").value, proteinBeverage:$("proteinBeverage").value, outcomes, score:sc.score, scoreExplain:sc.explain, updatedAt:new Date().toISOString()};
}

function editEntry(id){
  const m = entries.find(x=>x.id===id); if(!m) return;
  editId=id; $("formTitle").textContent="Edit Entry"; $("cancelEditBtn").classList.remove("hidden");
  setEntryType(m.entryType || "Meal");
  $("name").value=m.name||""; $("dt").value=(m.dt||nowLocal()).slice(0,16); $("context").value=m.context||"Normal meal"; $("hunger").value=m.hunger||""; $("notes").value=m.notes||"";
  $("satiety").value=m.outcomes?.satiety||""; $("energy").value=m.outcomes?.energy||""; $("cravings").value=m.outcomes?.cravings||"";
  if(entryType==="Meal"){
    rowsEl.innerHTML=""; (m.functions||[]).forEach(f=>addRow(f.item, f.type)); if(!rowsEl.children.length) addRow();
    $("mealBeverages").value=(m.beverages||[]).map(b=>b.item).join(", ");
  } else {
    $("beverage").value=m.beverage || (m.beverages?.[0]?.item) || "";
    $("beveragePurpose").value=m.beveragePurpose||"Energy"; $("addedSugar").value=m.addedSugar||""; $("caloric").value=m.caloric||""; $("proteinBeverage").value=m.proteinBeverage||"";
  }
  window.scrollTo({top:0,behavior:"smooth"}); live();
}
function duplicateEntry(id){ const m=entries.find(x=>x.id===id); if(!m)return; const copy=JSON.parse(JSON.stringify(m)); copy.id=uid(); copy.name=(copy.name||"Entry")+" copy"; copy.dt=nowLocal(); copy.updatedAt=new Date().toISOString(); entries.unshift(copy); saveStore(); }
function deleteEntry(id){ if(confirm("Delete this entry?")){ entries=entries.filter(m=>m.id!==id); saveStore(); } }

function render(){
  entries.sort((a,b)=>String(b.dt).localeCompare(String(a.dt)));
  $("entryCount").textContent = entries.length;
  const mealScores = entries.filter(e=>(e.entryType||"Meal")==="Meal").map(e=>Number(e.score)).filter(n=>!isNaN(n));
  const bevScores = entries.filter(e=>e.entryType==="Beverage").map(e=>Number(e.score)).filter(n=>!isNaN(n));
  $("avgScore").textContent = mealScores.length ? Math.round(mealScores.reduce((a,b)=>a+b,0)/mealScores.length) : "—";
  $("avgBeverage").textContent = bevScores.length ? Math.round(bevScores.reduce((a,b)=>a+b,0)/bevScores.length) : "—";
  const groups = {};
  for(const m of entries){ const day=(m.dt || "Undated").slice(0,10); (groups[day] ||= []).push(m); }
  $("ledger").innerHTML = Object.entries(groups).map(([day,items])=>{
    const avg = Math.round(items.reduce((a,m)=>a+(Number(m.score)||0),0)/items.length);
    return `<div class="day"><div class="dayHead"><span>${day}</span><span>Daily avg ${avg}</span></div>
      ${items.map(m=>{
        const isBev = m.entryType==="Beverage";
        const line = isBev ? escapeHtml(m.beverage || "") : (m.functions||[]).map(f=>`${escapeHtml(f.item)} <b>${f.type}</b>`).join(" → ");
        const bevLine = !isBev && m.beverages?.length ? `<div class="fn">Drinks: ${m.beverages.map(b=>escapeHtml(b.item)).join(", ")}</div>` : "";
        return `<article class="meal">
          <div class="mealTop"><div><h3><span class="typeBadge">${isBev?"Beverage":"Meal"}</span>${escapeHtml(m.name)}</h3><div class="fn">${escapeHtml(m.context||"")} ${m.hunger?`• hunger ${m.hunger}`:""}</div></div><span class="badge">${m.score ?? "—"}</span></div>
          <div class="fn">${line}</div>${bevLine}
          ${m.scoreExplain?`<div class="fn">${escapeHtml(m.scoreExplain)}</div>`:""}
          ${m.notes?`<div class="fn">${escapeHtml(m.notes)}</div>`:""}
          <div class="mealActions"><button class="secondary" onclick="editEntry('${m.id}')">Edit</button><button class="secondary" onclick="duplicateEntry('${m.id}')">Duplicate</button><button class="danger" onclick="deleteEntry('${m.id}')">Delete</button></div>
        </article>`;
      }).join("")}</div>`;
  }).join("") || `<section class="card"><p class="sub">No entries yet. Import JSON or save a new entry.</p></section>`;
}

function normalizeImported(obj){
  const arr = obj.meals || obj.entries || [];
  return arr.map(m=>{
    let eType = m.entryType;
    if(!eType){
      const courses = (m.courses||[]).filter(c=>c.item && c.item.trim());
      eType = courses.length && courses.every(c=>c.type==="Beverage") ? "Beverage" : "Meal";
    }
    if(eType==="Beverage"){
      const bev = m.beverage || m.beverages?.[0]?.item || (m.courses||[]).find(c=>c.item)?.item || "";
      const temp = {...m, id:m.id||uid(), entryType:"Beverage", beverage:bev, outcomes:m.outcomes||{satiety:"",energy:"",cravings:""}};
      const savedFields = ["beverage","beveragePurpose","addedSugar","caloric","proteinBeverage","cravings","energy"];
      savedFields.forEach(k=>{ if($(k) && temp[k] !== undefined) $(k).value = temp[k] || ""; });
      const sc = scoreImportedBeverage(temp);
      return {...temp, score:sc.score, scoreExplain:sc.explain};
    }
    let funcs = m.functions;
    let beverages = m.beverages || [];
    if(!funcs && m.courses){
      funcs=[]; beverages=[];
      m.courses.filter(c=>c.item && c.item.trim()).forEach(c=>{
        const mapped = LEGACY_MAP[c.type] || c.type || "Anchor";
        if(mapped==="Drink") beverages.push({item:c.item.trim(), type:"Beverage", legacyType:c.type});
        else funcs.push({item:c.item.trim(), type:mapped, legacyType:c.type});
      });
    }
    funcs = (funcs||[]).filter(f=>f.item).map(f=>({item:f.item, type:LEGACY_MAP[f.type] === "Drink" ? "Anchor" : (LEGACY_MAP[f.type] || f.type || "Anchor"), legacyType:f.legacyType}));
    const outcomes = m.outcomes || {satiety:"",energy:"",cravings:""};
    const sc = scoreMeal(funcs,outcomes);
    return {...m, id:m.id||uid(), entryType:"Meal", functions:funcs, beverages, outcomes, score:sc.score, scoreExplain:sc.explain};
  });
}
function scoreImportedBeverage(m){
  let s=82;
  if(m.addedSugar==="No") s+=8; if(m.addedSugar==="Light") s+=3; if(m.addedSugar==="Moderate") s-=8; if(m.addedSugar==="High") s-=20;
  if(m.caloric==="No") s+=4; if(m.caloric==="Light") s+=2; if(m.caloric==="High") s-=8;
  if(m.proteinBeverage==="Yes") s+=6;
  s=Math.max(0,Math.min(100,Math.round(s)));
  return {score:s, explain:"beverage event scored separately"};
}

$("mealTab").onclick=()=>setEntryType("Meal"); $("bevTab").onclick=()=>setEntryType("Beverage");
$("addRowBtn").onclick=()=>addRow();
["name","dt","context","hunger","notes","mealBeverages","beverage","beveragePurpose","addedSugar","caloric","proteinBeverage","satiety","energy","cravings"].forEach(id=>$(id).addEventListener("input", live));
$("saveBtn").onclick=()=>{ const e=entryFromForm(); const idx=entries.findIndex(x=>x.id===e.id); if(idx>=0) entries[idx]=e; else entries.unshift(e); saveStore(); resetForm(); };
$("resetBtn").onclick=resetForm; $("cancelEditBtn").onclick=resetForm;
$("exportJsonBtn").onclick=()=>download("sequence-plate-v7-export.json", JSON.stringify({app:"Sequence Plate",version:"7.0",exportedAt:new Date().toISOString(),entries,meals:entries},null,2), "application/json");
$("exportCsvBtn").onclick=()=>{ const rows=[["entryType","name","dt","context","hunger","score","functions_or_beverage","beverages","satiety","energy","cravings","notes"]]; entries.forEach(m=>rows.push([m.entryType,m.name,m.dt,m.context,m.hunger,m.score,m.entryType==="Beverage"?m.beverage:(m.functions||[]).map(f=>`${f.item}:${f.type}`).join(" > "),(m.beverages||[]).map(b=>b.item).join("; "),m.outcomes?.satiety,m.outcomes?.energy,m.outcomes?.cravings,m.notes])); download("sequence-plate-v7-export.csv", rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n"), "text/csv"); };
$("importFile").onchange=e=>{ const file=e.target.files[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{ try{ const obj=JSON.parse(reader.result); const imported=normalizeImported(obj); entries=[...imported,...entries]; saveStore(); alert(`Imported ${imported.length} entries.`); }catch(err){ alert("Import failed: "+err.message); } }; reader.readAsText(file); };
$("clearBtn").onclick=()=>{ if(confirm("Clear all saved entries?")){ entries=[]; saveStore(); } };
function download(name, content, type){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
window.addEventListener("beforeinstallprompt", e=>{ e.preventDefault(); deferredPrompt=e; $("installBtn").classList.remove("hidden"); });
$("installBtn").onclick=async()=>{ if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt=null; $("installBtn").classList.add("hidden"); } };
if("serviceWorker" in navigator){ navigator.serviceWorker.register("sw.js").catch(()=>{}); }
resetForm(); render();