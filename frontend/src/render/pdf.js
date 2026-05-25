// ============================================================
// render/pdf.js — Génération HTML pour export PDF
// ============================================================
//
// Module extrait de app.js (Phase 2 refactor — PH2.19).
// Fonction pure : toutes les dépendances injectées via `deps`.
//
// Dépendances injectées :
//   T                               — fonction de traduction (i18n)
//   currentLang                     — code langue courant (ex: "fr")
//   safeHtml                        — échappement HTML (utils/format)
//   computeCriticalProjectScore     — engine/totals
//   interpretScoreForBlock          — engine/camera-score
//   getCameraById                   — state/lookups
//   generateQRDataUrl               — app.js
//   generateShareUrl                — app.js
//   getSelectedOrRecommendedEnclosure/Screen/Sign — app.js
//   getThumbSrc                     — app.js
//   CATALOG                         — catalogue produits (app.js)
//   MODEL                           — état global courant (app.js)
// ============================================================

export function buildPdfHtmlPure(proj, deps = {}) {
  const {
    T,
    currentLang,
    computeCriticalProjectScore,
    generateQRDataUrl,
    generateShareUrl,
    getCameraById,
    getSelectedOrRecommendedEnclosure,
    getSelectedOrRecommendedScreen,
    getSelectedOrRecommendedSign,
    getThumbSrc,
    interpretScoreForBlock,
    safeHtml,
    CATALOG,
    MODEL,
  } = deps;

  const now = new Date();
  const langLocale = { fr: "fr-FR", en: "en-GB", it: "it-IT", es: "es-ES", de: "de-DE" };
  const dateStr = now.toLocaleString(langLocale[currentLang] || "fr-FR");

  const safe = (v) =>
    typeof safeHtml === "function" ? safeHtml(String(v ?? "")) : String(v ?? "");

  const projectScore =
    typeof computeCriticalProjectScore === "function"
      ? computeCriticalProjectScore()
      : null;

  // Branding COMELIT
  const LOGO_SRC = "/assets/logo.png";
  const COMELIT_GREEN = "#00BC70"; // Pantone 7480 C
  const COMELIT_BLUE = "#1C1F2A"; // Pantone 532 C

  // ✅ Nom du projet (priorité proj -> MODEL)
  const projectName = String(proj?.projectName ?? MODEL?.projectName ?? "").trim();
  const projectNameDisplay = projectName ? projectName : "—";

  // QR Code — encode l'URL de partage si disponible
  let qrDataUrl = "";
  try {
    if (typeof generateShareUrl === "function") {
      const shareUrl = generateShareUrl();
      console.log("[PDF] Share URL length:", shareUrl ? shareUrl.length : "null");
      if (shareUrl && shareUrl.length < 4000) {
        qrDataUrl = generateQRDataUrl(shareUrl);
        console.log("[PDF] QR data URL:", qrDataUrl ? "OK (" + qrDataUrl.length + " chars)" : "EMPTY");
      }
    }
  } catch (e) { console.warn("[PDF] QR generation skipped:", e); }

  // Helpers FR
  const frCodec = (c) => {
    const s = String(c || "").toLowerCase().trim();
    if (s === "h265" || s === "h.265") return "H.265";
    if (s === "h264" || s === "h.264") return "H.264";
    return c ? String(c).toUpperCase() : "—";
  };

  const frMode = (m) => {
    const s = String(m || "").toLowerCase().trim();
    if (s === "continuous" || s === "continu" || s === "24/7") return T("pdf_continuous");
    if (s === "motion" || s === "détection" || s === "detection") return "Sur détection";
    if (s === "mixed" || s === "mixte") return "Mixte";
    return m ? String(m) : "—";
  };

  const imgTag = (family, ref) => {
    // 1. Chercher l'image_url dans le catalogue (CDN Comelit)
    let src = "";
    try {
      const catalogMap = {
        CAMERAS: CATALOG?.CAMERAS, cameras: CATALOG?.CAMERAS,
        NVRS: CATALOG?.NVRS, nvrs: CATALOG?.NVRS,
        HDDS: CATALOG?.HDDS, hdds: CATALOG?.HDDS,
        SWITCHES: CATALOG?.SWITCHES, switches: CATALOG?.SWITCHES,
        ACCESSORIES: CATALOG?.ACCESSORIES, accessories: CATALOG?.ACCESSORIES,
        SCREENS: CATALOG?.SCREENS, screens: CATALOG?.SCREENS,
        ENCLOSURES: CATALOG?.ENCLOSURES, enclosures: CATALOG?.ENCLOSURES,
        SIGNAGE: CATALOG?.SIGNAGE, signage: CATALOG?.SIGNAGE,
      };
      const list = catalogMap[family] || catalogMap[String(family||"").toLowerCase()];
      const obj = Array.isArray(list) ? list.find(x => x.id === ref) : null;
      if (obj && obj.image_url && obj.image_url !== "false") src = obj.image_url;
    } catch {}
    // 2. Fallback chemin local
    if (!src) src = getThumbSrc(family, ref);
    if (!src) return "—";
    return `<img class="thumb" crossorigin="anonymous" src="${src}" alt="${safe(ref)}"
      />`;
  };

  // Tableau produits (Qté / Réf / Désignation / Image)
  // imgUrl optionnel : si fourni, utilisé directement (évite le lookup catalogue)
  const row4 = (qty, ref, name, family, imgUrl) => `
    <tr>
      <td class="colQty">${safe(qty)}</td>
      <td class="colRef">${safe(ref || "—")}</td>
      <td class="colName">${safe(name || "")}</td>
      <td class="colImg">${imgUrl && imgUrl !== "false"
        ? `<img class="thumb" crossorigin="anonymous" src="${imgUrl}" />`
        : imgTag(family, ref)}</td>
    </tr>
  `;

  // Row enrichie pour caméras : avec score et contexte
  const row4cam = (qty, ref, name, family, scoreInfo) => `
    <tr>
      <td class="colQty">${safe(qty)}</td>
      <td class="colRef">
        <strong>${safe(ref || "—")}</strong>
        ${scoreInfo ? `<div class="rowScore ${scoreInfo.level}">${safe(scoreInfo.score)}/100</div>` : ""}
      </td>
      <td class="colName">
        ${safe(name || "")}
        ${scoreInfo?.context ? `<div class="rowContext">${safe(scoreInfo.context)}</div>` : ""}
      </td>
      <td class="colImg">${imgTag(family, ref)}</td>
    </tr>
  `;

  const table4 = (rowsHtml) => {
    if (!rowsHtml) return `<div class="muted">—</div>`;
    return `
      <table class="tbl">
        <thead>
          <tr>
            <th class="colQty">${T("pdf_qty")}</th>
            <th class="colRef">${T("pdf_ref")}</th>
            <th class="colName">${T("pdf_designation")}</th>
            <th class="colImg">${T("pdf_image")}</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
  };

  // ✅ Header commun (V4) : bande verte + logo | titres | score + sous-titre + page
  let _pageCounter = 0;

  const headerHtml = (subtitle) => {
    _pageCounter++;
    return `
    <div class="greenBand"></div>
    <div class="pdfHeader">
      <div class="headerGrid">
        <img class="brandLogo" src="${LOGO_SRC}" onerror="this.style.display='none'" alt="Comelit" loading="lazy">

        <div class="headerTitles">
          <div class="mainTitle">${T("pdf_report_title")}</div>
          <div class="mainTitle mainTitleSub">${T("pdf_report_subtitle")}</div>
        </div>

        <div class="headerRight">
          ${projectScore != null ? `
          <div class="scorePill">
            <span class="scoreLabel">Score</span>
            <span class="scoreValue">${safe(projectScore)}/100</span>
          </div>` : ""}
          <div class="pageNum">Page ${_pageCounter}</div>
        </div>
      </div>

      <div class="headerSubWrap">
        <div class="headerSubLine">
          <span class="headerSubDot"></span>
          <span class="headerSubText">${safe(subtitle)}</span>
        </div>
      </div>
    </div>
  `;
  };

  // =========================================================================
  // EXTRACTION DES DONNÉES (ordre important !)
  // =========================================================================

  // 1) Extraction produits en ARRAY (pour pagination)
  (MODEL.cameraLines || [])
    .map((l) => {
      const cam = typeof getCameraById === "function" ? getCameraById(l.cameraId) : null;
      if (!cam) return "";
      const blk = (MODEL.cameraBlocks || []).find((b) => b.id === l.fromBlockId) || null;
      const label = blk?.label ? `${blk.label} — ` : "";
      return row4(l.qty || 0, cam.id, `${label}${cam.name || ""}`, "cameras");
    })
    .filter(Boolean);

  (MODEL.accessoryLines || [])
    .map((a) => row4(a.qty || 0, a.accessoryId || "—", a.name || a.accessoryId || "", "accessories", a.image_url || false))
    .filter(Boolean);

  // 2) Autres produits
  const nvr = proj?.nvrPick?.nvr || null;
  const nvrRows = nvr ? row4(1, nvr.id, nvr.name, "nvrs") : "";

  const swRows = proj?.switches?.required
    ? (() => {
        // Consolider par référence
        const map = new Map();
        for (const p of (proj?.switches?.plan || [])) {
          const id = p?.item?.id || "—";
          if (map.has(id)) { map.get(id).qty += (p.qty || 0); }
          else { map.set(id, { qty: p.qty || 0, item: p.item }); }
        }
        return [...map.values()].map(p => row4(p.qty, p.item?.id || "—", p.item?.name || "", "switches")).filter(Boolean).join("");
      })()
    : "";

  const disk = proj?.disks || null;
  const hdd = disk?.hddRef || null;
  const hddRows = disk
    ? row4(disk.count || 0, hdd?.id || `${disk.sizeTB}TB`, hdd?.name || `Disques ${disk.sizeTB} TB`, "hdds")
    : "";

  const scr =
    typeof getSelectedOrRecommendedScreen === "function"
      ? getSelectedOrRecommendedScreen(proj)?.selected
      : null;

  const enc =
    typeof getSelectedOrRecommendedEnclosure === "function"
      ? getSelectedOrRecommendedEnclosure(proj)?.selected
      : null;

  const signageEnabled = !!(MODEL?.complements?.signage?.enabled ?? MODEL?.complements?.signage?.enable);
  const sign =
    typeof getSelectedOrRecommendedSign === "function"
      ? getSelectedOrRecommendedSign()?.sign || null
      : null;

  const compRows = [
    scr ? row4(MODEL?.complements?.screen?.qty || 1, scr.id, scr.name, "screens") : "",
    enc ? row4(MODEL?.complements?.enclosure?.qty || 1, enc.id, enc.name, "enclosures") : "",
    signageEnabled && sign ? row4(MODEL?.complements?.signage?.qty || 1, sign.id, sign.name, "signage") : "",
  ]
    .filter(Boolean)
    .join("");

  // 3) KPI (AVANT buildCamAccPages !)
  const totalMbps = Number(proj?.totalInMbps ?? 0);
  const requiredTB = Number(proj?.requiredTB ?? 0);

  // 4) Paramètres enregistrement
  const sp = proj?.storageParams || {};
  const daysRetention = sp.daysRetention ?? MODEL?.recording?.daysRetention ?? 14;
  const hoursPerDay = sp.hoursPerDay ?? MODEL?.recording?.hoursPerDay ?? 24;
  const overheadPct = sp.overheadPct ?? MODEL?.recording?.overheadPct ?? 15;
  const codec = frCodec(sp.codec ?? MODEL?.recording?.codec ?? "H.265");
  const ips = sp.ips ?? MODEL?.recording?.fps ?? 12;
  const mode = frMode(sp.mode ?? MODEL?.recording?.mode ?? T("pdf_continuous"));

  // =========================================================================
  // =========================================================================
  // PAGINATION PAR BLOC : Caméras + Accessoires groupés par zone
  // =========================================================================
  
  // Construire les données groupées par bloc
  const blockGroups = [];
  for (const blk of (MODEL.cameraBlocks || [])) {
    if (!blk.validated) continue;
    
    const blockLabel = blk.label || `Bloc ${String(blk.id).slice(0, 6)}`;
    
    // Caméras de ce bloc
    const camLine = (MODEL.cameraLines || []).find((l) => l.fromBlockId === blk.id);
    const cam = camLine && typeof getCameraById === "function" ? getCameraById(camLine.cameraId) : null;
    
    // Accessoires de ce bloc
    const blockAccs = (MODEL.accessoryLines || []).filter((a) => a.fromBlockId === blk.id);
    
    // Score de la caméra pour ce bloc
    let scoreInfo = null;
    if (cam && typeof interpretScoreForBlock === "function") {
      try {
        const interp = interpretScoreForBlock(blk, cam);
        scoreInfo = {
          score: interp.score ?? "—",
          level: interp.level || "warn",
          context: interp.message || ""
        };
      } catch {}
    }

    const ans = blk.answers || {};
    blockGroups.push({
      blockId: blk.id,
      label: blockLabel,
      blkInfo: {
        objective: String(ans.objective || "").toLowerCase(),
        distance: ans.distance || null,
        emplacement: String(ans.emplacement || "").toLowerCase(),
      },
      camera: cam ? { qty: camLine.qty || 0, id: cam.id, name: cam.name, scoreInfo } : null,
      accessories: blockAccs.map((a) => ({ qty: a.qty || 0, id: a.accessoryId, name: a.name || a.accessoryId, image_url: a.image_url || false }))
    });
  }

  // Constantes de pagination
  const MAX_ROWS_FIRST_PAGE = 8;  // Lignes max sur page 1 (avec KPI)
  const MAX_ROWS_PER_PAGE = 10;   // Lignes max sur pages suivantes

  // Fonction pour construire les pages
  const buildCamAccPages = () => {
    let pages = [];
    let currentRows = [];  // Buffer des lignes en cours
    let isFirstPage = true;
    let pageSubtitle = T("pdf_cameras_accessories");

    // Fonction pour créer une page
    const flushPage = (isContinuation = false) => {
      if (currentRows.length === 0) return;
      
      const subtitle = isContinuation ? T("pdf_cameras_accessories") + " (" + T("pdf_detail_zone_cont").split("(").pop() : pageSubtitle;
      
      if (isFirstPage) {
        // Première page avec KPI
        pages.push(`
  <div class="pdfPage">
    ${headerHtml(subtitle)}

    <div class="kpiRow">
      <div class="kpiBox">
        <div class="kpiLabel">${T("pdf_total_bitrate")}</div>
        <div class="kpiValue">${safe(totalMbps.toFixed(1))} Mbps</div>
        <div class="muted">Basé sur le débit typique du catalogue quand disponible.</div>
      </div>
      <div class="kpiBox">
        <div class="kpiLabel">${T("pdf_required_storage")}</div>
        <div class="kpiValue">~${safe(requiredTB.toFixed(1))} To</div>
        <div class="muted">${T("pdf_detail_annex")}</div>
      </div>
      <div class="kpiBox">
        <div class="kpiLabel">${T("pdf_rec_params")}</div>
        <div class="kpiValue">${safe(daysRetention)} jours</div>
        <div class="muted">${safe(codec)} • ${safe(ips)} ${T("pdf_ips")} • ${safe(mode)} • ${T("pdf_margin_label")} ${safe(overheadPct)}%</div>
      </div>
    </div>

    <div class="section">
      <div class="sectionTitle">${T("pdf_detail_zone")}</div>
      ${table4(currentRows.join(""))}
    </div>

    <div class="footerLine"><span class="footLeft">Comelit — With you always</span><span class="footRight">${safe(dateStr)}</span></div>
  </div>`);
        isFirstPage = false;
      } else {
        // Pages suivantes sans KPI
        pages.push(`
  <div class="pdfPage">
    ${headerHtml(subtitle)}
    <div class="section">
      <div class="sectionTitle">${T("pdf_detail_zone_cont")}</div>
      ${table4(currentRows.join(""))}
    </div>
    <div class="footerLine"><span class="footLeft">Comelit — With you always</span><span class="footRight">${safe(dateStr)}</span></div>
  </div>`);
      }
      currentRows = [];
    };

    // Fonction pour ajouter une ligne avec gestion de pagination
    const addRow = (rowHtml) => {
      const maxRows = isFirstPage ? MAX_ROWS_FIRST_PAGE : MAX_ROWS_PER_PAGE;
      if (currentRows.length >= maxRows) {
        flushPage(true);
      }
      currentRows.push(rowHtml);
    };

    // Fonction pour créer une ligne de séparation de bloc
    const blockSeparatorRow = (label, blkInfo) => {
      const objLabel = {"identification":"Identification","detection":"Détection","observation":"Observation","reconnaissance":"Reconnaissance","dissuasion":"Observation"}[blkInfo?.objective] || "";
      const dist = blkInfo?.distance ? `${blkInfo.distance}m` : "";
      const empl = blkInfo?.emplacement === "exterieur" ? "Ext." : blkInfo?.emplacement === "interieur" ? "Int." : "";
      const meta = [objLabel, dist, empl].filter(Boolean).join(" • ");
      return `
      <tr class="blockSeparator">
        <td colspan="4">
          <div class="blockSepInner">
            <span class="blockSepLabel">📍 ${safe(label)}</span>
            ${meta ? `<span class="blockSepMeta">${safe(meta)}</span>` : ""}
          </div>
        </td>
      </tr>
    `;
    };

    // Parcourir tous les blocs
    for (const group of blockGroups) {
      // Ajouter le séparateur de bloc avec contexte
      addRow(blockSeparatorRow(group.label, group.blkInfo));
      
      // Ajouter la caméra du bloc (avec score)
      if (group.camera) {
        addRow(row4cam(group.camera.qty, group.camera.id, group.camera.name, "cameras", group.camera.scoreInfo));
      }
      
      // Ajouter les accessoires du bloc
      for (const acc of group.accessories) {
        addRow(row4(acc.qty, acc.id, acc.name, "accessories", acc.image_url || false));
      }
    }

    // Flush la dernière page
    flushPage(pages.length > 0);

    // Si aucun bloc, créer une page vide
    if (pages.length === 0) {
      pages.push(`
  <div class="pdfPage">
    ${headerHtml(T("pdf_cameras_accessories"))}

    <div class="kpiRow">
      <div class="kpiBox">
        <div class="kpiLabel">${T("pdf_total_bitrate")}</div>
        <div class="kpiValue">${safe(totalMbps.toFixed(1))} Mbps</div>
        <div class="muted">Basé sur le débit typique du catalogue quand disponible.</div>
      </div>
      <div class="kpiBox">
        <div class="kpiLabel">${T("pdf_required_storage")}</div>
        <div class="kpiValue">~${safe(requiredTB.toFixed(1))} To</div>
        <div class="muted">${T("pdf_detail_annex")}</div>
      </div>
      <div class="kpiBox">
        <div class="kpiLabel">${T("pdf_rec_params")}</div>
        <div class="kpiValue">${safe(daysRetention)} jours</div>
        <div class="muted">${safe(codec)} • ${safe(ips)} ${T("pdf_ips")} • ${safe(mode)} • ${T("pdf_margin_label")} ${safe(overheadPct)}%</div>
      </div>
    </div>

    <div class="section">
      <div class="sectionTitle">${T("pdf_detail_zone")}</div>
      <div class="muted">${T("err_no_camera_config")}</div>
    </div>

    <div class="footerLine"><span class="footLeft">Comelit — With you always</span><span class="footRight">${safe(dateStr)}</span></div>
  </div>`);
    }

    return pages.join("");
  };

  // Appel de la fonction APRÈS la définition des KPI
  const camAccPagesHtml = buildCamAccPages();
  // =========================================================================
  // =========================================================================
  // ANNEXE 1 : Débit par caméra
  // =========================================================================
  const MAX_ANNEX_ROWS = 22;
  const perCam = Array.isArray(proj?.perCamera) ? proj.perCamera : [];
  const perCamShown = perCam.slice(0, MAX_ANNEX_ROWS);
  const perCamHiddenCount = Math.max(0, perCam.length - perCamShown.length);

  const perCamRows = perCamShown
    .map(
      (r) => `
      <tr>
        <td class="aQty">${safe(r.qty)}</td>
        <td class="aRef">${safe(r.cameraId)}</td>
        <td class="aName">${safe(r.blockLabel ? r.blockLabel + " — " + r.cameraName : r.cameraName)}</td>
        <td class="aNum">${safe(Number(r.mbpsPerCam || 0).toFixed(2))}</td>
        <td class="aNum">${safe(Number(r.mbpsLine || 0).toFixed(2))}</td>
      </tr>
    `
    )
    .join("");

  // =========================================================================
  // ANNEXE 2 : SYNOPTIQUE
  // =========================================================================
const buildSynopticHtml = (proj) => {
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const safe = (v) =>
    typeof safeHtml === "function" ? safeHtml(String(v ?? "")) : String(v ?? "");

  // -----------------------------
  // Helpers robustes
  // -----------------------------
  const firstTruthy = (...vals) =>
    vals.find((v) => v != null && String(v).trim() !== "") ?? "";

  const toId = (obj) =>
    firstTruthy(
      obj?.id,
      obj?.ref,
      obj?.sku,
      obj?.code,
      obj?.product_id,
      obj?.productId,
      obj?.article,
      obj?.article_id
    );

  const isObj = (v) => v && typeof v === "object";

  const deepScan = (root, maxNodes = 2500) => {
    const out = [];
    const seen = new Set();
    const queue = [root];
    while (queue.length && out.length < maxNodes) {
      const cur = queue.shift();
      if (!isObj(cur)) continue;
      if (seen.has(cur)) continue;
      seen.add(cur);
      out.push(cur);
      if (Array.isArray(cur)) for (const it of cur) queue.push(it);
      else for (const k of Object.keys(cur)) queue.push(cur[k]);
    }
    return out;
  };

  const findInCatalogById = (catalogList, wantedId) => {
    if (!wantedId) return null;
    if (!Array.isArray(catalogList)) return null;
    const norm = String(wantedId).trim().toLowerCase();
    return (
      catalogList.find((x) => String(toId(x) || "").trim().toLowerCase() === norm) ||
      null
    );
  };

  // -----------------------------
  // 0) Récupération caméraLines robuste (MODEL ou proj)
  // -----------------------------
  const getAllCameraLines = () => {
    const linesModel = Array.isArray(MODEL?.cameraLines) ? MODEL.cameraLines : [];
    if (linesModel.length) return linesModel;

    // Fallbacks courants côté proj
    const p1 = Array.isArray(proj?.cameraLines) ? proj.cameraLines : [];
    if (p1.length) return p1;

    const p2 = Array.isArray(proj?.cameras?.lines) ? proj.cameras.lines : [];
    if (p2.length) return p2;

    // Certains projets gardent un plan de caméras
    const plan = Array.isArray(proj?.cameras?.plan) ? proj.cameras.plan : [];
    // Convertit plan -> lines si possible
    if (plan.length) {
      // plan item typique: { qty, item:{id,name...} } ou {qty, cameraId}
      return plan
        .map((p) => {
          const qty = Number(p?.qty || 0);
          const camId = String(p?.cameraId || p?.item?.id || "");
          if (!qty || !camId) return null;
          return { qty, cameraId: camId, fromBlockId: p?.fromBlockId || "ALL" };
        })
        .filter(Boolean);
    }

    // Dernier recours : deepScan pour trouver des objets qui ressemblent à une line
    const nodes = deepScan(proj);
    const found = [];
    for (const n of nodes) {
      if (!isObj(n)) continue;
      if (!("qty" in n) && !("quantity" in n)) continue;
      const camId = n.cameraId || n.camId || n.id || n.ref;
      if (!camId) continue;
      const qty = Number(n.qty ?? n.quantity ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      found.push({ qty, cameraId: String(camId), fromBlockId: n.fromBlockId || "ALL" });
      if (found.length > 80) break;
    }
    return found;
  };

  const sumCams = () => {
    const lines = getAllCameraLines();
    return lines.reduce((acc, l) => acc + Number(l?.qty || 0), 0);
  };

  // -----------------------------
  // 1) Groupes caméras (robuste)
  // -----------------------------
  const buildCameraBlocks = () => {
    const blocks = Array.isArray(MODEL?.cameraBlocks) ? MODEL.cameraBlocks : [];
    const lines = getAllCameraLines();

    const map = new Map();

    for (const l of lines) {
      const qty = Number(l?.qty || 0);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const camId = String(l?.cameraId || l?.id || "").trim();
      if (!camId) continue;

      // Cam depuis fonction existante ou catalogue
      let cam = null;
      if (typeof getCameraById === "function") cam = getCameraById(camId);
      if (!cam) cam = findInCatalogById(CATALOG?.CAMERAS, camId);

      if (!cam) continue;

      const fromId = l?.fromBlockId || "ALL";
      const blk = blocks.find((b) => b.id === fromId) || null;
      const blockLabel =
        String(blk?.label || "").trim() ||
        (fromId === "ALL" ? "Caméras" : `Bloc ${String(fromId).slice(0, 6)}`);

      if (!map.has(fromId)) {
        map.set(fromId, {
          blockId: fromId,
          label: blockLabel,
          qty: 0,
          refs: [],
          primaryRef: String(cam.id || camId || ""),
        });
      }

      const b = map.get(fromId);
      b.qty += qty;

      const ref = String(cam.id || camId || "");
      if (ref && !b.refs.includes(ref)) b.refs.push(ref);
      if (!b.primaryRef && ref) b.primaryRef = ref;
    }

    const ordered = [];

    // Respecte l’ordre des blocks UI quand dispo
    for (const blk of blocks) if (map.has(blk.id)) ordered.push(map.get(blk.id));

    // Ajoute le reste
    for (const [, v] of map.entries()) if (!ordered.includes(v)) ordered.push(v);

    // Si pas de blocks UI, mais on a des cams : fallback “ALL”
    if (ordered.length === 0) {
      const total = sumCams();
      if (total > 0) {
        ordered.push({
          blockId: "ALL",
          label: "Caméras",
          qty: total,
          refs: [],
          primaryRef: "",
        });
      }
    }

    return ordered;
  };

  // -----------------------------
  // 2) Switches (inchangé, mais safe)
  // -----------------------------
  const expandSwitches = () => {
    const list = [];
    const plan = Array.isArray(proj?.switches?.plan) ? proj.switches.plan : [];
    let sIdx = 1;

    for (const p of plan) {
      const qty = Number(p?.qty || 0);
      const item = p?.item || {};
      const id = String(item?.id || "SWITCH");
      const name = String(item?.name || id);

      const portsCandidates = [
        item?.ports,
        item?.ports_count,
        item?.poe_ports,
        item?.poe_ports_count,
      ];

      let portsCap = 0;
      for (const v of portsCandidates) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) {
          portsCap = n;
          break;
        }
      }
      if (!portsCap) portsCap = 8;

      const count = Math.max(1, qty || 0);
      for (let k = 0; k < count; k++) list.push({ idx: sIdx++, id, name, portsCap });
    }

    if ((proj?.switches?.required || false) && list.length === 0) {
      list.push({ idx: 1, id: "SWITCH", name: "Switch PoE", portsCap: 8 });
    }

    if (!(proj?.switches?.required || false)) return [];
    return list;
  };

  // -----------------------------
  // 3) Allocation blocs -> switches — split les gros blocs sur plusieurs switches
  // -----------------------------
  const allocateBlocksToSwitches = (camBlocks, switches) => {
    if (!switches.length) return [];
    const buckets = switches.map((sw) => ({ sw, blocks: [], used: 0 }));

    // Aplatir : si un bloc a plus de caméras que le switch peut accueillir, on le split
    const flatItems = [];
    for (const b of camBlocks) {
      let remaining = b.qty;
      while (remaining > 0) {
        flatItems.push({ ...b, qty: remaining, originalQty: b.qty });
        remaining = 0; // on poussera la quantité réelle dans le bucket
      }
    }

    let si = 0;
    for (const item of flatItems) {
      let remaining = item.qty;
      while (remaining > 0 && si < buckets.length) {
        const bucket = buckets[si];
        const available = bucket.sw.portsCap - bucket.used;
        if (available <= 0) { si++; continue; }
        const take = Math.min(remaining, available);
        bucket.blocks.push({ ...item, qty: take });
        bucket.used += take;
        remaining -= take;
        if (bucket.used >= bucket.sw.portsCap && si < buckets.length - 1) si++;
      }
      // Si plus de place, empile sur le dernier switch
      if (remaining > 0 && buckets.length > 0) {
        const last = buckets[buckets.length - 1];
        last.blocks.push({ ...item, qty: remaining });
        last.used += remaining;
      }
    }
    return buckets;
  };

  // -----------------------------
  // 4) Résolution NVR / HDD / SCREEN (identique à ta logique)
  // -----------------------------
  const camBlocks = buildCameraBlocks();
  const switches = expandSwitches();
  const alloc = allocateBlocksToSwitches(camBlocks, switches);

  // Filtrer les switches vides (pas de caméras allouées)
  const allocUsed = alloc.filter(b => b.used > 0);
  const swUsed = allocUsed.map(b => b.sw);

  const camCount = Math.max(1, camBlocks.length);
  const swCount = Math.max(0, swUsed.length);

  const nvr = proj?.nvrPick?.nvr || proj?.nvrPick?.item || proj?.nvr || null;
  const nvrId = String(toId(nvr) || "—");
  const nvrName = String(nvr?.name || "");

  // HDD
  const resolveHdd = () => {
    const diskPlan =
      proj?.storage?.diskPlan ||
      proj?.storage?.disk ||
      proj?.storage?.plan ||
      proj?.storage?.hddPlan ||
      proj?.diskPlan ||
      proj?.disk ||
      null;

    const candidates = [];

    const directObj =
      proj?.hddPick?.hdd ||
      proj?.hddPick?.item ||
      proj?.storage?.hddPick?.hdd ||
      proj?.storage?.hddPick?.item ||
      proj?.storage?.hdd ||
      proj?.hdd ||
      null;

    if (directObj) candidates.push(directObj);

    if (Array.isArray(diskPlan?.items)) {
      for (const it of diskPlan.items) {
        if (!it) continue;
        if (it.item) candidates.push(it.item);
        candidates.push(it);
      }
    } else if (Array.isArray(diskPlan)) {
      for (const it of diskPlan) {
        if (!it) continue;
        if (it.item) candidates.push(it.item);
        candidates.push(it);
      }
    } else if (diskPlan && typeof diskPlan === "object") {
      candidates.push(diskPlan);
      if (diskPlan.item) candidates.push(diskPlan.item);
    }

    const nodes = deepScan(proj);
    for (const n of nodes) candidates.push(n);

    const pick = (obj) => {
      const id = String(toId(obj) || "").trim();
      if (!id) return null;
      const inCat = findInCatalogById(CATALOG?.HDDS, id);
      if (inCat) return inCat;
      const cap = obj?.capacity_tb ?? obj?.capacityTB ?? obj?.capacity;
      if (Number.isFinite(Number(cap))) return obj;
      return null;
    };

    let found = null;
    for (const c of candidates) {
      found = pick(c);
      if (found) break;
    }

    const qty =
      Number(
        firstTruthy(
          proj?.disks?.count,
          diskPlan?.count,
          diskPlan?.qty,
          diskPlan?.quantity,
          diskPlan?.items?.[0]?.qty,
          diskPlan?.items?.[0]?.count,
          diskPlan?.items?.[0]?.quantity,
          0
        )
      ) || 0;

    const id = found ? String(toId(found) || "") : "";
    return { id, obj: found, qty };
  };

  // SCREEN
  const resolveScreen = () => {
    const enabled = !!(proj?.complements?.screen?.enabled || MODEL?.complements?.screen?.enabled);

    const direct =
      proj?.complements?.screen?.pick ||
      proj?.complements?.screen?.selected ||
      proj?.complements?.screen?.item ||
      proj?.complements?.screenPick?.screen ||
      proj?.screenPick?.screen ||
      proj?.screen ||
      MODEL?.complements?.screen?.pick ||
      MODEL?.complements?.screen?.selected ||
      null;

    const directId = String(toId(direct) || "").trim();
    const directInCat = directId ? findInCatalogById(CATALOG?.SCREENS, directId) : null;

    if (directInCat) return { enabled: true, id: String(toId(directInCat) || ""), obj: directInCat };
    if (direct && directId && /^([MH]MON)/i.test(directId)) return { enabled: true, id: directId, obj: direct };

    const sizeInch =
      Number(
        firstTruthy(
          proj?.complements?.screen?.sizeInch,
          proj?.complements?.screen?.size_inch,
          proj?.complements?.screen?.size,
          MODEL?.complements?.screen?.sizeInch,
          MODEL?.complements?.screen?.size_inch,
          MODEL?.complements?.screen?.size
        )
      ) || 0;

    if (enabled && sizeInch > 0 && Array.isArray(CATALOG?.SCREENS)) {
      let best = null;
      let bestD = Infinity;
      for (const s of CATALOG.SCREENS) {
        const si = Number(s?.size_inch ?? s?.sizeInch ?? 0);
        if (!Number.isFinite(si) || si <= 0) continue;
        const d = Math.abs(si - sizeInch);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      if (best) return { enabled: true, id: String(toId(best) || ""), obj: best };
    }

    const nodes = deepScan(proj);
    for (const n of nodes) {
      const id = String(toId(n) || "").trim();
      if (!id) continue;
      const inCat = findInCatalogById(CATALOG?.SCREENS, id);
      if (inCat) return { enabled: true, id: String(toId(inCat) || ""), obj: inCat };
    }

    return { enabled: !!enabled, id: "", obj: null };
  };

  const hddRes = resolveHdd();
  const hddId = String(hddRes.id || "");
  const hddObj = hddRes.obj;
  const hddQty = Number(hddRes.qty || 0) || 0;

  const screenRes = resolveScreen();
  const scrEnabled = !!screenRes.enabled;
  const screenId = String(screenRes.id || "");
  const scr = screenRes.obj;

  // -----------------------------
  // 5) Layout adaptatif (W/H virtuels)
  // -----------------------------
  const W = 1120;
  const H = 720;

  let densityScale = 1;
  if (camCount > 4) densityScale -= (camCount - 4) * 0.05;
  if (swCount > 2) densityScale -= (swCount - 2) * 0.06;
  densityScale = clamp(densityScale, 0.65, 1);


  // Grille
  const camX = 70;
  const swX = 400;
  const coreX = 880;

  const topY = 150;
  const bottomY = H - 140;

  const distributeY = (count) => {
    if (count <= 1) return [Math.round((topY + bottomY) / 2)];
    const gap = (bottomY - topY) / (count - 1);
    return Array.from({ length: count }, (_, i) => Math.round(topY + i * gap));
  };

  const camYs = distributeY(camCount);
  const swYs = distributeY(Math.max(1, swCount || 1));

  // Helpers % (pour fit parfait dans la page)
  const pctX = (x) => `${((x / W) * 100).toFixed(3)}%`;
  const pctY = (y) => `${((y / H) * 100).toFixed(3)}%`;
  const pctW = (w) => `${((w / W) * 100).toFixed(3)}%`;
  const pctH = (h) => `${((h / H) * 100).toFixed(3)}%`;

  // -----------------------------
  // 6) Nodes & images
  // -----------------------------
  const camCardW = 240;
  const swCardW = 240;

  const blockToSwitch = new Map();
  allocUsed.forEach((b) => (b.blocks || []).forEach((blk) => blockToSwitch.set(blk.blockId, b.sw.idx)));

  const camNodes = camBlocks.map((b, i) => ({
    ...b,
    x: camX,
    y: camYs[i] || camYs[camYs.length - 1],
    img: typeof getThumbSrc === "function" ? getThumbSrc("cameras", b.primaryRef) : "",
  }));

  const swNodes = swUsed.map((sw, i) => ({
    ...sw,
    x: swX,
    y: swYs[i] || swYs[swYs.length - 1],
    img: typeof getThumbSrc === "function" ? getThumbSrc("switches", sw.id) : "",
  }));

  const screenX = coreX - 170;
  const screenY = 135;
  const nvrY = 320;

  const wanW = 360;
  const wanH = 92;
  const wanX0 = clamp(Math.round(coreX - wanW / 2), 30, W - 30 - wanW);
  const wanY = 555;

  // -----------------------------
  // 7) Câbles (SVG full canvas)
  // -----------------------------
  const cableOrtho = (x1, y1, x2, y2, stroke, dash = "", w = 3.4) => {
    const midX = Math.round((x1 + x2) / 2);
    return `
      <path d="M ${x1} ${y1}
               L ${midX} ${y1}
               L ${midX} ${y2}
               L ${x2} ${y2}"
        fill="none"
        stroke="${stroke}"
        stroke-width="${w}"
        stroke-linecap="round"
        stroke-linejoin="round"
        ${dash ? `stroke-dasharray="${dash}"` : ""} />
    `;
  };

  const poeLines = camNodes
    .map((c) => {
      const x1 = c.x + camCardW - 18;
      const y1 = c.y + 28;

      const nvrEntryX = Math.round(coreX - 190);
      const nvrEntryY = nvrY + 60;

      if (!swNodes.length) return cableOrtho(x1, y1, nvrEntryX, nvrEntryY, "#dc2626", "", 3.8);

      const swIdx = blockToSwitch.get(c.blockId) || swNodes[0]?.idx || 1;
      const sw = swNodes.find((s) => s.idx === swIdx) || swNodes[0];

      const x2 = sw.x - 18;
      const y2 = sw.y + 28;

      return cableOrtho(x1, y1, x2, y2, "#dc2626", "", 3.8);
    })
    .join("");

  const uplinkLines = swNodes
    .map((sw) => {
      const x1 = sw.x + swCardW - 18;
      const y1 = sw.y + 28;

      const nvrEntryX = Math.round(coreX - 190);
      const nvrEntryY = nvrY + 60;

      return cableOrtho(x1, y1, nvrEntryX, nvrEntryY, "#6b7280", "6 6", 3.4);
    })
    .join("");

  const hdmiLine =
    scrEnabled && screenId
      ? (() => {
          const x1 = coreX + 10;
          const y1 = nvrY + 45;
          const x2 = screenX + 40;
          const y2 = screenY + 75;
          return cableOrtho(x1, y1, x2, y2, "#2563eb", "", 3.2);
        })()
      : "";

  const nvrToWan = (() => {
    const x1 = coreX + 10;
    const y1 = nvrY + 150;
    const x2 = wanX0 + 20;
    const y2 = wanY + 46;
    return cableOrtho(x1, y1, x2, y2, "#6b7280", "6 6", 3.2);
  })();

  const cablesSvg = `
    <svg class="synSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
      ${poeLines}
      ${uplinkLines}
      ${hdmiLine}
      ${nvrToWan}
    </svg>
  `;

  // -----------------------------
  // 8) Cards HTML (position en %)
  // -----------------------------
  const card = ({ x, y, w, h, barColor, title, line1, line2, imgSrc }) => {
    const left = x - 24;
    const top = y - 18;
    const hasImg = !!String(imgSrc || "").trim();

    return `
      <div class="synCard" style="left:${pctX(left)}; top:${pctY(top)}; width:${pctW(w)}; height:${pctH(h)};">
        ${barColor ? `<div class="synBar" style="background:${barColor}"></div>` : ``}
        <div class="synInner">
          <div class="synIcon">
            ${
              hasImg
                ? `<img class="synImg" src="${imgSrc}" alt="" loading="lazy">`
                : `<div class="synImgPh"></div>`
            }
          </div>
          <div class="synTxt">
            <div class="synT">${safe(title)}</div>
            ${line1 ? `<div class="synL1">${safe(line1)}</div>` : ``}
            ${line2 ? `<div class="synL2">${safe(line2)}</div>` : ``}
          </div>
        </div>
      </div>
    `;
  };

  const camCards = camNodes
    .map((c) => {
      const refLine =
        c.refs && c.refs.length > 1 ? `${c.refs[0]} + …` : c.refs?.[0] || c.primaryRef || "—";
      // Trouver sur quel(s) switch(s) ce bloc est câblé
      const swTarget = blockToSwitch.get(c.blockId);
      const swLabel = swTarget && swNodes.length ? ` → SW${swTarget}` : "";
      return card({
        x: c.x,
        y: c.y,
        w: camCardW,
        h: 96,
        barColor: COMELIT_GREEN,
        title: c.label,
        line1: `${refLine} • ${c.qty} cam${swLabel}`,
        line2: "",
        imgSrc: c.img,
      });
    })
    .join("");

  const swCards = swNodes
    .map((sw) => {
      const bucket = allocUsed.find((a) => a.sw.idx === sw.idx);
      const used = bucket ? Number(bucket.used || 0) : 0;
      const free = Math.max(0, sw.portsCap - used);
      const details = (bucket?.blocks || []).map(b => `${b.qty}× ${(b.label || '').substring(0, 12)}`);
      const detailStr = details.length > 2 ? details.slice(0, 2).join(', ') + '…' : details.join(', ');
      return card({
        x: sw.x,
        y: sw.y,
        w: swCardW,
        h: 96,
        barColor: "#F59E0B",
        title: `SW${sw.idx} — ${sw.id}`,
        line1: `${used}/${sw.portsCap} ports • ${free} libres`,
        line2: detailStr || "⚡ 230V",
        imgSrc: sw.img,
      });
    })
    .join("");

  const nvrImg = typeof getThumbSrc === "function" ? getThumbSrc("nvrs", nvrId) : "";
  const nvrCardW = 360;
  const nvrCardH = 200;
  const nvrCardX = clamp(Math.round(coreX - nvrCardW / 2), 30, W - 30 - nvrCardW);
  const nvrCardY = Math.round(nvrY);

  const hddImg =
    (hddObj?.image_url || hddObj?.image || "") ||
    (hddId && typeof getThumbSrc === "function" ? getThumbSrc("hdds", hddId) : "");

  const hddLabel = hddId ? `${Math.max(1, hddQty || 1)}× ${hddId}` : "HDD : —";
  const storageTB = Number(proj?.requiredTB ?? 0).toFixed(1);
  const nvrChannels = nvr?.channels || "?";
  const totalCams = sumCams();

  const nvrCardHtml = `
    <div class="synCard synNvr" style="left:${pctX(nvrCardX)}; top:${pctY(nvrCardY)}; width:${pctW(nvrCardW)}; height:${pctH(nvrCardH)};">
      <div class="synBar" style="background:${COMELIT_BLUE}"></div>
      <div class="synInner synInnerNvr">
        <div class="synIcon synIconBig">
          ${nvrImg ? `<img class="synImg" src="${nvrImg}" alt="" loading="lazy">` : `<div class="synImgPh"></div>`}
        </div>
        <div class="synTxt">
          <div class="synT">NVR — ${safe(nvrId)}</div>
          <div class="synL1">${safe(nvrName)}</div>
          <div class="synL2">${totalCams}/${nvrChannels} canaux • ${storageTB} To</div>
          <div class="synL2">⚡ 230V</div>

          <div class="synHddMini">
            <div class="synHddIcon">
              ${hddImg ? `<img class="synImgMini" src="${hddImg}" alt="" loading="lazy">` : `<div class="synImgPhMini"></div>`}
            </div>
            <div class="synHddTxt">${safe(hddLabel)}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const scrImg =
    (scr && screenId && typeof getThumbSrc === "function" ? getThumbSrc("screens", screenId) : "") ||
    (scr?.image_url || scr?.image || "");

  const screenHtml =
    scrEnabled && screenId
      ? `
        <div class="synCard" style="left:${pctX(screenX)}; top:${pctY(screenY)}; width:${pctW(320)}; height:${pctH(110)};">
          <div class="synInner">
            <div class="synIcon">
              ${scrImg ? `<img class="synImg" src="${scrImg}" alt="" loading="lazy">` : `<div class="synImgPh"></div>`}
            </div>
            <div class="synTxt">
              <div class="synT">${T("sum_screen")}</div>
              <div class="synL1">${safe(screenId)}</div>
              <div class="synL2">⚡ 230V</div>
            </div>
          </div>
        </div>
      `
      : "";

  const wanHtml = `
    <div class="synCard" style="left:${pctX(wanX0)}; top:${pctY(wanY)}; width:${pctW(wanW)}; height:${pctH(wanH)};">
      <div class="synInner">
        <div class="synTxt" style="padding-left:8px">
          <div class="synT">Accès distant / WAN</div>
          <div class="synL1">Box Internet / Internet / VPN / App</div>
        </div>
      </div>
    </div>
  `;

  const projectNameDisplay = String(MODEL?.project?.name || proj?.projectName || "—");
  const totalCamsDisplay = sumCams();
  const synHeaderHtml = `
    <div class="synHeader">
      <div class="synH1">${T("pdf_synoptic")}</div>
      <div class="synMeta">Projet : ${safe(projectNameDisplay)} • ${totalCamsDisplay} caméras</div>
      <div class="synMeta">Débit ~${Number(proj?.totalInMbps ?? 0).toFixed(1)} Mbps • Stockage ~${Number(
        proj?.requiredTB ?? 0
      ).toFixed(1)} To • ${swCount ? swCount + ' switch' + (swCount > 1 ? 'es' : '') : 'PoE direct NVR'}</div>
    </div>
  `;

  const legendHtml = `
    <div class="synLegend">
      <span class="dot" style="background:#dc2626"></span><span>PoE</span>
      <span class="dot" style="background:#6b7280"></span><span>Uplink</span>
      <span class="dot" style="background:#2563eb"></span><span>HDMI</span>
      <span class="sep"></span>
      <span class="hint">PoE max 90m / 250m</span>
    </div>
  `;

  return `
    <div class="synWrap">
      <div class="synCanvas" data-syn-fit="1">
        <div class="synStage" style="transform-origin:50% 50%; transform:scale(${(Math.max(0.55, Math.min(1.1, 0.94 * densityScale))).toFixed(4)});">

          ${synHeaderHtml}
          ${legendHtml}
          ${cablesSvg}
          ${camCards}
          ${swCards}
          ${screenHtml}
          ${nvrCardHtml}
          ${wanHtml}
        </div>
      </div>

      <style>
        /* Le wrap prend toute la place dispo (piloté par la page landscape) */
        .synWrap{ width:100%; height:100%; border: 1px solid var(--c-line); border-radius:18px; background:#fff; overflow:hidden; }
        .synCanvas{ width:100%; height:100%; position:relative; display:flex; align-items:center; justify-content:center; }
        .synStage{ position:relative; width:${W}px; height:${H}px; }

        .synSvg{ position:absolute; left:0; top:0; width:100%; height:100%; z-index:1; pointer-events:none; }

        .synHeader{ position:absolute; left:3.6%; top:3.8%; z-index:3; }
        .synH1{ font-family:Arial Black, Arial, sans-serif; font-size:16px; color:${COMELIT_BLUE}; }
        .synMeta{ margin-top:4px; font-size:10px; font-weight:700; color:#475569; }

        .synLegend{
          position:absolute; right:3.2%; top:3.4%; z-index:3;
          display:flex; align-items:center; gap:8px;
          background:#fff; border:1px solid #e5e7eb; border-radius:14px;
          padding:10px 12px; font-size:10px; font-weight:800; color:#475569;
        }
        .synLegend .dot{ width:10px; height:10px; border-radius:999px; display:inline-block; }
        .synLegend .sep{ width:1px; height:16px; background:#e5e7eb; display:inline-block; margin:0 4px; }
        .synLegend .hint{ font-weight:800; }

        .synCard{
          position:absolute; z-index:2;
          background:#fff; border:1px solid #e5e7eb; border-radius:16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          overflow:hidden;
        }
        .synBar{ position:absolute; left:0; top:0; bottom:0; width:8px; }
        .synInner{ display:flex; gap:12px; padding:14px; }
        .synInnerNvr{ padding-left:18px; }

        .synIcon{ width:56px; height:56px; border:1px solid #e5e7eb; border-radius:14px; background:#fff; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .synIconBig{ width:78px; height:78px; border-radius:16px; }
        .synImg{ width:100%; height:100%; object-fit:contain; display:block; }
        .synImgPh{ width:100%; height:100%; background:#f8fafc; }
        .synTxt{ min-width:0; flex:1; overflow:hidden; }
        .synT{ font-size:12px; font-weight:900; color:${COMELIT_BLUE}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .synL1{ margin-top:4px; font-size:10px; font-weight:800; color:#475569; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .synL2{ margin-top:3px; font-size:9px; font-weight:800; color:#b45309; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }

        .synNvr{ background:#f8fafc; }
        .synHddMini{
          margin-top:10px; display:flex; align-items:center; gap:10px;
          background:#fff; border:1px solid #e5e7eb; border-radius:14px;
          padding:10px 12px;
        }
        .synHddIcon{ width:32px; height:32px; border:1px solid #e5e7eb; border-radius:10px; background:#fff; overflow:hidden; display:flex; align-items:center; justify-content:center;}
        .synImgMini{ width:100%; height:100%; object-fit:contain; display:block; }
        .synImgPhMini{ width:100%; height:100%; background:#f8fafc; }
        .synHddTxt{ font-size:10px; font-weight:900; color:#475569; }
      </style>
      <!-- Scale calculé en CSS pur (compatible html2canvas) -->

    </div>
  `;
};


    return `
<div id="pdfReportRoot" style="font-family: Arial, sans-serif; color:${COMELIT_BLUE}; background:#ffffff;">
  <style>
    * { box-sizing: border-box; }
    html, body { width:100%; background:#ffffff; }

    :root{
      --c-green: ${COMELIT_GREEN};
      --c-blue:  ${COMELIT_BLUE};
      --c-white: #ffffff;
      --c-muted: #475569;
      --c-line:  #e5e7eb;
      --c-soft:  #f8fafc;
      --c-blue-soft: #eef2f7;
    }

    /* ====== BANDE VERTE COMELIT ====== */
    .greenBand{
      width: 100%;
      height: 5px;
      background: linear-gradient(90deg, var(--c-green) 0%, var(--c-green) 70%, var(--c-blue) 100%);
      border-radius: 0 0 2px 2px;
      margin-bottom: 2mm;
      flex-shrink: 0;
    }

    .pdfPage{
      width: 210mm;
      height: 297mm;
      box-sizing: border-box;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 5mm 6mm 4mm 6mm;
      background: var(--c-white);
    }

    .pdfPage:last-child{
      page-break-after: auto;
      break-after: auto;
    }
    .pdfPageLandscape{
      width: 297mm;
      height: 210mm;
      padding: 5mm 6mm 4mm 6mm;
      box-sizing: border-box;
      overflow: hidden;
      display:flex;
      flex-direction:column;
    }

    .pdfPageLandscape .landscapeBody{
      flex: 1 1 auto;
      display:flex;
      flex-direction:column;
      min-height: 0;
    }

    /* ✅ synWrap = prend toute la hauteur dispo */
    .pdfPageLandscape .synWrap{
      flex: 1 1 auto;
      height: 100%;
      padding: 0;      /* important : c’est le synWrap interne qui gère le bord */
      border: none;    /* évite double bord si tu en as un ailleurs */
      min-height: 0;
    }


  /* Optionnel : footer plus proche en paysage */
    .qrBlock{
      margin-top: auto;
      padding: 16px 0 8px 0;
      display:flex;
      align-items:center;
      gap: 16px;
    }
    .qrImg{
      width: 90px;
      height: 90px;
      image-rendering: pixelated;
    }
    .qrLabel{
      font-size: 10px;
      color: var(--c-muted);
      max-width: 200px;
      line-height: 1.4;
    }


  .pdfPageLandscape .footerLine{
    margin-top: 6px;
  }


    .pdfHeader{
      border-bottom:3px solid var(--c-blue);
      padding-bottom:8px;
      margin-bottom:10px;
    }

    .headerGrid{
      display:grid;
      grid-template-columns: 120px 1fr auto;
      column-gap: 12px;
      align-items:center;
    }
    .brandLogo{
      width:132px;             /* ✅ avant 120 */
      height:auto;
      object-fit:contain;
    }


    .headerTitles{
      min-width:0;
      text-align:center;
      padding:0 8px;
    }

    .mainTitle{
      font-family:"Arial Black", Arial, sans-serif;
      font-size:22px;            /* ✅ + lisible */
      line-height:1.15;
      color:var(--c-blue);
      margin:0;
      white-space:normal;
      overflow:visible;
      text-overflow:clip;
    }

    .metaLine{
      margin-top:4px;
      font-size:11.5px;          /* ✅ avant 10.5 */
      color:var(--c-muted);
      line-height:1.25;
    }

    .scorePill{
      display:inline-flex;
      align-items:center;
      gap:6px;
      border:1px solid var(--c-line);
      border-left:6px solid var(--c-green);
      border-radius:999px;
      background:var(--c-soft);
      padding:6px 10px;
      white-space:nowrap;
      justify-self:end;
    }
    .scoreLabel{
      font-size:10px;
      color:var(--c-muted);
      font-weight:900;
      text-transform:uppercase;
      letter-spacing:0.3px;
    }
    .scoreValue{
      font-family:"Arial Black", Arial, sans-serif;
      font-size:12px;
      color:var(--c-blue);
    }

    .headerSub{
      margin-top:6px;           /* ✅ plus respirant */
      font-size:14px;            /* ✅ avant 12.5 */
      font-weight:900;
      color:var(--c-blue);
    }
    .headerSubWrap{
      margin-top:10px;
      padding-top:10px;
      border-top:1px solid var(--c-line);
    }

    .headerSubLine{
      display:flex;
      align-items:center;
      gap:10px;
    }

    .headerSubDot{
      width:10px;
      height:10px;
      border-radius:999px;
      background:var(--c-green);
      flex:0 0 auto;
    }

    .headerSubText{
      font-size:14px;          /* ✅ plus gros */
      font-weight:900;
      color:var(--c-blue);
      line-height:1.2;
    }

    .projectCard{
      margin-top:10px;
      border:1px solid var(--c-line);
      border-left:10px solid var(--c-green);
      border-radius:16px;
      padding:12px;           /* ✅ moins “gros” */
      background:var(--c-soft);
    }

    .projectLabel{
      font-size:11px;
      color:var(--c-muted);
      font-weight:900;
      text-transform:uppercase;
      letter-spacing:0.3px;
    }
    .projectValue{
      margin-top:10px;
      font-family:"Arial Black", Arial, sans-serif;
      font-size:26px;
      line-height:1.15;
      color:var(--c-blue);
      overflow-wrap:anywhere;
    }
    .projectHint{
      margin-top:10px;
      font-size:11px;
      color:var(--c-muted);
      line-height:1.35;
    }

    .kpiRow{
      display:flex;
      gap:12px;
      margin-top:10px;
    }

    .kpiBox{
      flex:1 1 0;
      border:1px solid var(--c-line);
      border-radius:14px;
      background:var(--c-soft);
      padding:12px;             /* ✅ + de présence */
    }

    .kpiLabel{
      font-size:12px;           /* ✅ avant 11 */
      color:var(--c-muted);
      font-weight:800;
    }

    .kpiValue{
      margin-top:4px;
      font-size:16px;           /* ✅ avant 14 */
      font-weight:900;
      color:var(--c-blue);
    }

    /* ✅ muted un peu plus grand, sinon ça “fait vide” */
    .muted{
      color:var(--c-muted);
      font-size:12px;           /* ✅ avant 11 */
      line-height:1.35;
      overflow-wrap:anywhere;
      word-break:break-word;
    }

    .section{
      margin-top:10px;
      padding:10px;
      overflow:hidden;
      border:1px solid var(--c-line);
      border-radius:14px;
      background:#fff;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .sectionTitle{
      font-family:"Arial Black", Arial, sans-serif;
      font-size:13.5px;       /* ✅ + grand */
      margin:0 0 8px 0;
      color:var(--c-blue);
    }

    .tbl{
      width:100%;
      border-collapse:collapse;
      font-size:12px;
      table-layout:fixed;
      overflow-wrap:anywhere;
      word-break:break-word;
    }

    .tbl th, .tbl td{
      border:1px solid var(--c-line);
      padding:9px 10px;
      vertical-align:top;
      overflow:hidden;
    }

    .tbl th{
      background:var(--c-blue-soft);
      text-align:left;
      font-weight:900;
      color:var(--c-blue);
    }

    .colQty{ width:50px; }
    .colRef{ width:130px; }
    .colImg{ width:80px; text-align:center; }

      .thumb{
        width:58px;             /* ✅ + grand */
        height:58px;
        object-fit:contain;
        border:1px solid var(--c-line);
        border-radius:10px;
        background:#fff;
        display:inline-block;
      }


    .annexGrid{ display:flex; gap:10px; align-items:stretch; }
    .annexColL{ flex:0 0 40%; }
    .annexColR{ flex:1 1 auto; }

    .tblAnnex{
      width:100%;
      border-collapse:collapse;
      font-size:9.5px;
      overflow-wrap:anywhere;
    }
    .tblAnnex th, .tblAnnex td{
      border:1px solid var(--c-line);
      padding:5px 6px;
      vertical-align:top;
    }
    .tblAnnex th{
      background:var(--c-blue-soft);
      text-align:left;
      font-weight:900;
      color:var(--c-blue);
    }
    .aQty{ width:36px; }
    .aRef{ width:92px; }
    .aNum{ width:70px; text-align:right; }

    .footerLine{
      margin-top:auto;
      padding-top: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: var(--c-muted);
      border-top: 1px solid var(--c-line);
      flex-shrink: 0;
    }
    .footLeft{ font-weight: 700; }
    .footRight{ font-style: italic; }

    /* ====== HEADER V4 ====== */
    .headerRight{
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }
    .pageNum{
      font-size: 9px;
      font-weight: 700;
      color: var(--c-muted);
      text-align: right;
    }
    .mainTitleSub{
      font-size: 16px;
      color: var(--c-green);
      margin-top: 2px;
    }

    /* ====== DASHBOARD KPI (PAGE 0) ====== */
    .dashGrid{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 10px;
    }
    .dashCard{
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      border: 1px solid var(--c-line);
      border-radius: 14px;
      background: var(--c-soft);
    }
    .dashIcon{
      font-size: 22px;
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      border: 1px solid var(--c-line);
      border-radius: 10px;
    }
    .dashData{ min-width: 0; }
    .dashValue{
      font-family: "Arial Black", Arial, sans-serif;
      font-size: 15px;
      color: var(--c-blue);
      line-height: 1.2;
      overflow-wrap: anywhere;
    }
    .dashLabel{
      font-size: 10px;
      color: var(--c-muted);
      font-weight: 700;
      margin-top: 2px;
    }

    /* ====== CAMERA ROW ENRICHIE ====== */
    .rowScore{
      display: inline-block;
      margin-top: 3px;
      font-size: 10px;
      font-weight: 900;
      padding: 2px 6px;
      border-radius: 6px;
      line-height: 1.3;
    }
    .rowScore.ok{ background: #dcfce7; color: #166534; }
    .rowScore.warn{ background: #fef3c7; color: #92400e; }
    .rowScore.bad{ background: #fee2e2; color: #991b1b; }
    .rowContext{
      margin-top: 3px;
      font-size: 9px;
      color: var(--c-muted);
      line-height: 1.3;
    }

    /* ====== BLOCK SEPARATOR ENRICHI ====== */
    .blockSeparator td{
      background: #f0f9f4 !important;
      padding: 8px 10px !important;
      border-left: 4px solid var(--c-green) !important;
    }
    .blockSepInner{
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .blockSepLabel{
      font-weight: 900;
      color: var(--c-blue);
      font-size: 12px;
    }
    .blockSepMeta{
      font-size: 10px;
      font-weight: 700;
      color: var(--c-muted);
      background: #fff;
      padding: 2px 8px;
      border-radius: 8px;
      border: 1px solid var(--c-line);
    }

    /* =========================================================
       ✅ ANNEXE 2 — SYNOPTIQUE (LANDSCAPE NATIF)
       ========================================================= */

  .synWrap{
  width: 100%;
  height: 180mm;   /* tu étais à 178mm c'est ok */
  border: 1px solid var(--c-line);
  border-radius: 18px;
  background: #fff;
  overflow: hidden;
  padding: 10mm;   /* ✅ un poil moins, ça agrandit le schéma utile */
}
.synCanvas{
  width: 100%;
  height: 100%;
  display:flex;
  align-items:center;
  justify-content:center;
}
.synCanvas svg{
  width: 100%;
  height: 100%;
  display:block;
}


.synCanvas svg{
  width: 100%;
  height: 100%;
  display:block;
}

  </style>

  <!-- ✅ PAGE 0 : SYNTHÈSE DU PROJET -->
  <div class="pdfPage">
    ${headerHtml(T("pdf_project_summary"))}

    <div class="projectCard">
      <div class="projectLabel">Projet</div>
      <div class="projectValue">${safe(projectNameDisplay)}</div>
    </div>

    <div class="dashGrid">
      <div class="dashCard">
        <div class="dashIcon">📹</div>
        <div class="dashData">
          <div class="dashValue">${safe((MODEL.cameraLines || []).reduce((s,l) => s + (l.qty || 0), 0))}</div>
          <div class="dashLabel">${T("pdf_cameras")}</div>
        </div>
      </div>
      <div class="dashCard">
        <div class="dashIcon">📍</div>
        <div class="dashData">
          <div class="dashValue">${safe(blockGroups.length)}</div>
          <div class="dashLabel">${T("pdf_zones")}</div>
        </div>
      </div>
      <div class="dashCard">
        <div class="dashIcon">💾</div>
        <div class="dashData">
          <div class="dashValue">${safe(requiredTB.toFixed(1))} To</div>
          <div class="dashLabel">${T("pdf_required_storage")}</div>
        </div>
      </div>
      <div class="dashCard">
        <div class="dashIcon">📡</div>
        <div class="dashData">
          <div class="dashValue">${safe(totalMbps.toFixed(1))} Mbps</div>
          <div class="dashLabel">${T("pdf_total_bitrate")}</div>
        </div>
      </div>
      <div class="dashCard">
        <div class="dashIcon">🎥</div>
        <div class="dashData">
          <div class="dashValue">${safe(nvr?.id || "—")}</div>
          <div class="dashLabel">${T("pdf_nvr")}</div>
        </div>
      </div>
      <div class="dashCard">
        <div class="dashIcon">⏱</div>
        <div class="dashData">
          <div class="dashValue">${safe(daysRetention)}j • ${safe(codec)} • ${safe(ips)} IPS</div>
          <div class="dashLabel">${T("pdf_recording")}</div>
        </div>
      </div>
    </div>

    ${qrDataUrl ? `
    <div class="qrBlock">
      <img src="${qrDataUrl}" class="qrImg" alt="QR Code" />
      <div class="qrLabel">${T("pdf_qr_label")}</div>
    </div>
    ` : ""}

    <div class="footerLine"><span class="footLeft">Comelit — With you always</span><span class="footRight">${safe(dateStr)}</span></div>
  </div>


  <!-- ✅ PAGE(S) CAMÉRAS & ACCESSOIRES (pagination automatique) -->
  ${camAccPagesHtml}

  <!-- ✅ PAGE 2 -->
  <div class="pdfPage">
    ${headerHtml(T("pdf_equipment"))}

    <div class="section">
      <div class="sectionTitle">${T("pdf_nvr_section")}</div>
      ${table4(nvrRows)}
    </div>

    <div class="section">
      <div class="sectionTitle">${T("pdf_switches")}</div>
      ${proj?.switches?.required ? table4(swRows) : `<div class="muted">${T("pdf_not_required")}</div>`}
    </div>

    <div class="section">
      <div class="sectionTitle">${T("pdf_storage")}</div>
      ${table4(hddRows)}
    </div>

    <div class="section">
      <div class="sectionTitle">${T("pdf_complements")}</div>
      ${table4(compRows)}
      ${!signageEnabled ? `<div class="muted" style="margin-top:6px">Panneau de signalisation : (désactivé)</div>` : ``}
    </div>

    <div class="footerLine"><span class="footLeft">Comelit — With you always</span><span class="footRight">${safe(dateStr)}</span></div>
  </div>

  <!-- ✅ PAGE 3 -->
  <div class="pdfPage">
    ${headerHtml(T("pdf_annex1"))}

    <div class="annexGrid">
      <div class="annexColL">
        <div class="section">
          <div class="sectionTitle">${T("pdf_hypotheses")}</div>
          <table class="tblAnnex">
            <thead><tr><th>${T("pdf_param")}</th><th>${T("pdf_value")}</th></tr></thead>
            <tbody>
              <tr><td>${T("pdf_days_retention")}</td><td>${safe(daysRetention)}</td></tr>
              <tr><td>${T("pdf_hours_day_label")}</td><td>${safe(hoursPerDay)}</td></tr>
              <tr><td>Mode d’enregistrement</td><td>${safe(mode)}</td></tr>
              <tr><td>Codec</td><td>${safe(codec)}</td></tr>
              <tr><td>${T("pdf_ips")}</td><td>${safe(ips)}</td></tr>
              <tr><td>Marge</td><td>${safe(overheadPct)}%</td></tr>
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="sectionTitle">${T("pdf_formula")}</div>
          <div class="muted">
            To ≈ (Débit total (Mbps) × 3600 × Heures/jour × Jours) ÷ (8 × 1024 × 1024) × (1 + Marge)
          </div>
          <div class="muted" style="margin-top:8px">
            ${T("pdf_total_bitrate")} : <strong>${safe(totalMbps.toFixed(2))} Mbps</strong><br>
            ${T("pdf_required_storage")} : <strong>~${safe(requiredTB.toFixed(2))} To</strong>
          </div>
        </div>
      </div>

      <div class="annexColR">
        <div class="section">
          <div class="sectionTitle">${T("pdf_bitrate_detail")}</div>

          ${
            perCamRows
              ? `
                <table class="tblAnnex">
                  <thead>
                    <tr>
                      <th class="aQty">${T("pdf_qty")}</th>
                      <th class="aRef">${T("pdf_ref")}</th>
                      <th class="aName">${T("pdf_designation")}</th>
                      <th class="aNum">${T("pdf_mbps_cam")}</th>
                      <th class="aNum">${T("pdf_mbps_total")}</th>
                    </tr>
                  </thead>
                  <tbody>${perCamRows}</tbody>
                </table>
                ${
                  perCamHiddenCount > 0
                    ? `<div class="muted" style="margin-top:6px">… + ${safe(perCamHiddenCount)} ${T("sum_lines")} supplémentaires non affichées (pour tenir sur 1 page)</div>`
                    : ``
                }
                <div class="muted" style="margin-top:6px">
                  ${T("pdf_total_bitrate_label")} : <strong>${safe(totalMbps.toFixed(2))} Mbps</strong>
                </div>
              `
              : `<div class="muted">—</div>`
          }

          <div class="muted" style="margin-top:6px">
            ${T("pdf_source_catalog")} → <em>bitrate_mbps_typical</em> (${T("pdf_source_estimation")}).
          </div>
        </div>
      </div>
    </div>

    <div class="footerLine"><span class="footLeft">Comelit — With you always</span><span class="footRight">${safe(dateStr)}</span></div>
  </div>

  <!-- ✅ PAGE 4 : SYNOPTIQUE -->
  <div class="pdfPage pdfPageLandscape">
    ${headerHtml(T("pdf_annex2"))}
    <div class="landscapeBody">
      ${buildSynopticHtml(proj)}
    </div>
    <div class="footerLine"><span class="footLeft">Comelit — With you always</span><span class="footRight">${safe(dateStr)}</span></div>
  </div>

</div>`;
}

// ─── Compat global ──────────────────────────────────────────
if (typeof window !== 'undefined') {
}
