// handlers/admin.js
// ✅ Phase 3 — PH3.5 : panel admin extrait depuis app.js (pattern factory)
// adminTokenRef : { value: ADMIN_TOKEN } — mutable ref passée par app.js

const ADMIN_SCHEMAS = {
  cameras: ["id","name","type","resolution_mp","image_url","datasheet_url"],
  nvrs: ["id","name","channels","nvr_output","image_url","datasheet_url"],
  hdds: ["id","name","capacity_tb"],
  switches: ["id","name"],
  accessories: ["camera_id"],
  screens: ["id","name","size_inch","format","vesa","Resolution","image_url","datasheet_url"],
  enclosures: ["id","name","screen_compatible_with","compatible_with","image_url","datasheet_url"],
  signage: ["id","name","image_url","datasheet_url"],
};

export function createAdminHandlers(deps = {}) {
  const { adminTokenRef = { value: '' } } = deps;

  // State interne du panel admin
  const ADMIN_GRID = {
    csvName: "cameras",
    headers: [],
    rows: [],           // array d'objets
    selectedIndex: -1,
  };

  // Helper DOM local
  function q(id){ return document.getElementById(id); }


  function adminSchemaWarnings(name, headers, rows){
    try{
      const need = ADMIN_SCHEMAS[name];
      if (!need) return null;
  
      const set = new Set((headers || []).map(h => String(h).trim()));
      const missing = need.filter(h => !set.has(h));
      const warns = [];
  
      if (missing.length) warns.push(`colonnes manquantes: ${missing.join(", ")}`);
  
      // Duplicats ID (si colonne id présente)
      if (set.has("id")){
        const seen = new Set();
        const dups = new Set();
        for (const r of (rows || [])){
          const id = String(r?.id || "").trim();
          if (!id) continue;
          if (seen.has(id)) dups.add(id);
          seen.add(id);
        }
        if (dups.size) warns.push(`IDs en double: ${Array.from(dups).slice(0,6).join(", ")}${dups.size>6?"…":""}`);
      }
  
      return warns.length ? warns.join(" • ") : null;
    } catch {
      return "validation impossible (format inattendu)";
    }
  }

  function admin$(id){ return document.getElementById(id); }

  function adminShow(open){
    const m = admin$("adminModal");
    if (!m) return;
    m.classList.toggle("hidden", !open);
  }

  function setAdminMode(isAuthed){
    const loginBox = admin$("adminLoginBox");
    const editorBox = admin$("adminEditorBox");
    if (!loginBox || !editorBox) return;
    loginBox.classList.toggle("hidden", isAuthed);
    editorBox.classList.toggle("hidden", !isAuthed);
  }

  async function adminLogin(password){
    const msg = admin$("adminLoginMsg");
    if (msg) msg.textContent = "Connexion…";
    const res = await fetch("/api/login", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({password})
    });
  
  if (!res.ok) {
    const t = await res.text().catch(()=> "");
    throw new Error(`Erreur chargement CSV (${res.status}) ${t}`);
  }
  
  
    const data = await res.json();
    adminTokenRef.value = data.token;
    if (msg) msg.textContent = "✅ Connecté";
    setAdminMode(true);
  }

  async function adminLoadCsv(name){
    const ta = admin$("adminCsvText");
    const msg = admin$("adminMsg");
    if (msg) msg.textContent = `Chargement ${name}.csv…`;
  
    const res = await fetch(`/api/csv/${encodeURIComponent(name)}`, {
      cache: "no-store",
      headers: adminTokenRef.value ? { "Authorization": `Bearer ${adminTokenRef.value}` } : {},
    });
  
    if (!res.ok) {
      const t = await res.text().catch(()=> "");
      throw new Error(`Load CSV failed (${res.status}) ${t}`);
    }
  
    // ✅ variable unique : txt
    const txt = await res.text();
  
    // ✅ Remplit le textarea (mode expert) + la grille
    if (ta) ta.value = txt;
  
    const parsed = parseCSVGrid(txt);
    ADMIN_GRID.csvName = name;
    ADMIN_GRID.headers = parsed.headers;
    ADMIN_GRID.rows = parsed.rows;
    ADMIN_GRID.selectedIndex = ADMIN_GRID.rows.length ? 0 : -1;
  
  renderAdminGrid();
  
  const warn = adminSchemaWarnings(name, ADMIN_GRID.headers, ADMIN_GRID.rows);
  if (msg) msg.textContent = warn ? `⚠️ Chargé avec alertes — ${warn}` : "✅ Chargé";
  
  }

  async function adminSaveCsv(name, content){
    const msg = admin$("adminMsg");
    if (msg) msg.textContent = `Sauvegarde ${name}.csv…`;
  
    const expertBox = document.getElementById("adminExpertBox");
    const ta = admin$("adminCsvText");
  
    let csvToSave = "";
  
    // ✅ Si mode expert ouvert => on sauve le textarea brut
    if (expertBox && !expertBox.classList.contains("hidden")) {
      csvToSave = (ta?.value || "");
    } else {
      // ✅ Sinon on sauve depuis la grille
      csvToSave = toCSVGrid(ADMIN_GRID.headers, ADMIN_GRID.rows);
      if (ta) ta.value = csvToSave; // sync au cas où
    }
  
    const res = await fetch(`/api/csv/${encodeURIComponent(name)}`, {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization": `Bearer ${adminTokenRef.value}`
      },
      body: JSON.stringify({content: csvToSave})
    });
  
    if (!res.ok) {
      const t = await res.text().catch(()=> "");
      throw new Error(`Save CSV failed (${res.status}) ${t}`);
    }
  
    if (msg) msg.textContent = "✅ Sauvegardé (backup .bak créé côté serveur)";
    const warn = adminSchemaWarnings(name, ADMIN_GRID.headers, ADMIN_GRID.rows);
  if (warn && msg) msg.textContent += ` • ⚠️ ${warn}`;
  
    // ✅ Recharger les données dans le configurateur après save
    try {
      await init();
      if (msg) msg.textContent += " • Données rechargées dans le configurateur";
    } catch {
      if (msg) msg.textContent += " • ⚠️ Données sauvegardées, mais reload a échoué (voir console)";
    }
  }

  function bindAdminPanel(){
    // ✅ IMPORTANT : sur la page configurateur, l'UI Admin n'existe pas.
    // Si on lance initAdminGridUI() quand les éléments n'existent pas => crash JS => configurateur KO.
    const modal = document.getElementById("adminModal");
    const root  = document.getElementById("adminRoot");
    const btnAdmin = document.getElementById("btnAdmin");
  
    // Si aucun élément admin n'est présent sur la page, on ne fait rien.
    if (!modal && !root && !btnAdmin) return;
  
    // ✅ Maintenant seulement on peut initialiser la grille admin
    initAdminGridUI();
  
    const btnClose  = admin$("btnAdminClose");
    const btnLogin  = admin$("btnAdminLogin");
    const btnLoad   = admin$("btnAdminLoad");
    const btnSave   = admin$("btnAdminSave");
    const btnLogout = admin$("btnAdminLogout");
    const sel = admin$("adminCsvSelect");
    const ta  = admin$("adminCsvText");
    const pwd = admin$("adminPassword");
  
    if (btnAdmin) btnAdmin.addEventListener("click", () => {
      adminShow(true);
      setAdminMode(!!adminTokenRef.value);
    });
  
    if (btnClose) btnClose.addEventListener("click", () => adminShow(false));
  
    // fermer si clic backdrop
    if (modal) modal.addEventListener("click", (e) => {
      if (e.target === modal) adminShow(false);
    });
  
    if (btnLogin) btnLogin.addEventListener("click", async () => {
      try {
        await adminLogin((pwd?.value || "").trim());
        const name = sel?.value || "cameras";
        await adminLoadCsv(name);
      } catch {
        const msg = admin$("adminLoginMsg");
        if (msg) msg.textContent = "❌ Login failed";
      }
    });
  
    if (btnLoad) btnLoad.addEventListener("click", async () => {
      try {
        const name = sel?.value || "cameras";
        await adminLoadCsv(name);
      } catch {
        const msg = admin$("adminMsg");
        if (msg) msg.textContent = "❌ Load failed";
      }
    });
  
    if (btnSave) btnSave.addEventListener("click", async () => {
      try {
        const name = sel?.value || "cameras";
        await adminSaveCsv(name, (ta?.value || ""));
      } catch {
        const msg = admin$("adminMsg");
        if (msg) msg.textContent = "❌ Save failed";
      }
    });
  
    if (btnLogout) btnLogout.addEventListener("click", () => {
      adminTokenRef.value = "";
      setAdminMode(false);
      const msg = admin$("adminMsg");
      if (msg) msg.textContent = "Déconnecté";
    });
  }

  function escapeAttr(v){
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseCSVGrid(csvText){
    const s = String(csvText ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
  
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;
  
    for (let i = 0; i < s.length; i++){
      const ch = s[i];
      const next = s[i+1];
  
      if (ch === '"' && inQuotes && next === '"'){
        cur += '"'; i++; continue;
      }
      if (ch === '"'){
        inQuotes = !inQuotes; 
        continue;
      }
  
      if (ch === "," && !inQuotes){
        row.push(cur);
        cur = "";
        continue;
      }
  
      if (ch === "\n" && !inQuotes){
        row.push(cur);
        cur = "";
        // évite de pousser une ligne vide “à cause” d'un \n final
        if (row.some(c => String(c).trim() !== "")) rows.push(row);
        row = [];
        continue;
      }
  
      cur += ch;
    }
  
    // dernière cellule
    row.push(cur);
    if (row.some(c => String(c).trim() !== "")) rows.push(row);
  
    if (!rows.length) return { headers: [], rows: [] };
  
    const headers = rows[0].map(h => String(h ?? "").trim());
    const dataRows = [];
  
    for (let i = 1; i < rows.length; i++){
      const cols = rows[i];
      const obj = {};
      headers.forEach((h, idx) => obj[h] = String(cols[idx] ?? ""));
      dataRows.push(obj);
    }
  
    return { headers, rows: dataRows };
  }

  function toCSVGrid(headers, rows){
    const esc = (v) => {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
      return s;
    };
    const head = headers.map(esc).join(",");
    const body = rows.map(r => headers.map(h => esc(r[h])).join(",")).join("\n");
    return head + "\n" + body + "\n";
  }

  function syncGridMeta(){
    const el = q("adminGridMeta");
    if (!el) return;
    const sel = ADMIN_GRID.selectedIndex >= 0 ? `Ligne : #${ADMIN_GRID.selectedIndex+1}` : "Aucune ligne";
    el.textContent = `${sel} • ${ADMIN_GRID.rows.length} lignes • ${ADMIN_GRID.headers.length} colonnes`;
  }

  function syncExpertTextareaIfOpen(){
    const expertBox = q("adminExpertBox");
    const ta = q("adminCsvText");
    if (!expertBox || !ta) return;
    if (!expertBox.classList.contains("hidden")){
      ta.value = toCSVGrid(ADMIN_GRID.headers, ADMIN_GRID.rows);
    }
  }

  function renderAdminGrid(){
    const mount = q("adminTableMount");
    if (!mount) return;
  
    if (!ADMIN_GRID.headers.length){
      mount.innerHTML = `<div class="muted" style="padding:12px">Aucune donnée.</div>`;
      syncGridMeta();
      return;
    }
  
    const ths = ADMIN_GRID.headers.map(h => `<th title="${escapeAttr(h)}">${escapeAttr(h)}</th>`).join("");
  
    const trs = ADMIN_GRID.rows.map((row, idx) => {
      const selected = idx === ADMIN_GRID.selectedIndex ? "selected" : "";
      const tds = ADMIN_GRID.headers.map(h => {
        const val = row[h] ?? "";
        return `<td><input class="adminCell" data-row="${idx}" data-col="${escapeAttr(h)}" value="${escapeAttr(val)}" /></td>`;
      }).join("");
  
      return `
        <tr class="adminRow ${selected}" data-row="${idx}">
          <td class="rowSel">#${idx+1}</td>
          ${tds}
        </tr>
      `;
    }).join("");
  
    mount.innerHTML = `
      <table class="adminTable">
        <thead>
          <tr>
            <th class="rowSel">—</th>
            ${ths}
          </tr>
        </thead>
        <tbody>${trs}</tbody>
      </table>
    `;
  
    syncGridMeta();
  }

  function adminGridAddRow(){
    if (!ADMIN_GRID.headers.length) return;
    const obj = {};
    ADMIN_GRID.headers.forEach(h => obj[h] = "");
    ADMIN_GRID.rows.push(obj);
    ADMIN_GRID.selectedIndex = ADMIN_GRID.rows.length - 1;
    renderAdminGrid();
    syncExpertTextareaIfOpen();
  }

  function adminGridDupRow(){
    const i = ADMIN_GRID.selectedIndex;
    if (i < 0 || !ADMIN_GRID.rows[i]) return;
    const copy = { ...ADMIN_GRID.rows[i] };
    ADMIN_GRID.rows.splice(i+1, 0, copy);
    ADMIN_GRID.selectedIndex = i+1;
    renderAdminGrid();
    syncExpertTextareaIfOpen();
  }

  function adminGridDelRow(){
    const i = ADMIN_GRID.selectedIndex;
    if (i < 0 || !ADMIN_GRID.rows[i]) return;
    ADMIN_GRID.rows.splice(i, 1);
    ADMIN_GRID.selectedIndex = ADMIN_GRID.rows.length ? Math.min(i, ADMIN_GRID.rows.length-1) : -1;
    renderAdminGrid();
    syncExpertTextareaIfOpen();
  }

  function initAdminGridUI(){
    const btnAdd = q("btnAdminAddRow");
    const btnDup = q("btnAdminDupRow");
    const btnDel = q("btnAdminDelRow");
    const btnToggle = q("btnAdminToggleExpert");
    const expertBox = q("adminExpertBox");
    const ta = q("adminCsvText");
  
    if (btnAdd) btnAdd.addEventListener("click", adminGridAddRow);
    if (btnDup) btnDup.addEventListener("click", adminGridDupRow);
    if (btnDel) btnDel.addEventListener("click", adminGridDelRow);
  
    if (btnToggle && expertBox){
      btnToggle.addEventListener("click", () => {
        expertBox.classList.toggle("hidden");
        if (!expertBox.classList.contains("hidden") && ta){
          ta.value = toCSVGrid(ADMIN_GRID.headers, ADMIN_GRID.rows);
        }
      });
    }
  }

  return {
    adminSchemaWarnings, admin$, adminShow, setAdminMode, adminLogin,
    adminLoadCsv, adminSaveCsv, bindAdminPanel, escapeAttr, parseCSVGrid,
    toCSVGrid, syncGridMeta, syncExpertTextareaIfOpen, renderAdminGrid,
    adminGridAddRow, adminGridDupRow, adminGridDelRow, initAdminGridUI,
  };
}

if (typeof window !== 'undefined') {
}
