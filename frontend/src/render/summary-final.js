// render/summary-final.js
// ✅ Phase 2 — PH2.22 : renderFinalSummary extraite depuis app.js
// Module ESM pur — dépendances injectées via deps

export function renderFinalSummaryPure(proj, deps = {}) {
  const {
    T,
    safeHtml,
    getThumbSrc,
    MODEL,
    getCameraById,
    getSelectedOrRecommendedEnclosure,
    getSelectedOrRecommendedScreen,
    getSelectedOrRecommendedSign,
    computeCriticalProjectScore,
  } = deps;
  const projectScore =
    typeof computeCriticalProjectScore === "function"
      ? computeCriticalProjectScore()
      : null;

  const safe = (v) =>
    typeof safeHtml === "function" ? safeHtml(String(v ?? "")) : String(v ?? "");

  const pickImg = (family, id, obj) => {
    const direct = obj && obj.image_url ? String(obj.image_url) : "";
    if (direct) return direct;

    if (typeof getThumbSrc === "function") {
      const s = getThumbSrc(family, id);
      if (s) return String(s);
    }
    return "";
  };

  const thumb = (imgUrl, alt) => {
    if (imgUrl) {
      return `<div class="sumThumb"><img class="sumThumbImg" src="${safe(imgUrl)}" alt="${safe(alt || "")}" loading="lazy"></div>`;
    }
    return `<div class="sumThumb sumThumbPh">—</div>`;
  };

  const row = ({ qty, ref, name, placeLabel, imgUrl }) => {
    const place = placeLabel ? `<div class="sumPlace">${safe(placeLabel)}</div>` : "";
    return `
      <div class="sumRow">
        ${thumb(imgUrl, name)}
        <div class="sumMain">
          <div class="sumTop">
            <span class="sumPill">${safe(qty)}×</span>
            <span class="sumPill">${safe(ref || "—")}</span>
          </div>
          ${place}
          <div class="sumName">${safe(name || "")}</div>
        </div>
      </div>
    `;
  };

  // Caméras (avec libellé de bloc)
  const camRows = (MODEL.cameraLines || [])
    .map((l) => {
      const cam = getCameraById(l.cameraId);
      if (!cam) return null;

      const blk = (MODEL.cameraBlocks || []).find((b) => b.id === l.fromBlockId) || null;
      const ans = (blk && blk.answers) || {};
      // Indicateur : distance obtenue par mesure photo + gyroscope.
      const measured = ans.hasPhoto
        ? `📷 ${ans.distance_m ? ans.distance_m + " m mesurés" : "distance mesurée"}`
        : "";
      const baseLabel = blk && blk.label ? `${blk.label}` : "";
      const placeLabel = [baseLabel, measured].filter(Boolean).join(" · ");

      const imgUrl = pickImg("cameras", cam.id, cam);

      return row({
        qty: l.qty || 0,
        ref: cam.id || "—",
        name: cam.name || "",
        placeLabel,
        imgUrl,
      });
    })
    .filter(Boolean);

  const camsHtml = camRows.length
    ? `<div class="sumList">${camRows.join("")}</div>`
    : `<div class="sumEmpty">—</div>`;

  // Accessoires
  const accRows = (MODEL.accessoryLines || [])
    .map((a) => {
      // Passer l'objet entier pour que pickImg utilise image_url du CSV
      const imgUrl = pickImg("accessories", a.accessoryId, a);
      return row({
        qty: a.qty || 0,
        ref: a.accessoryId,
        name: a.name || a.accessoryId,
        placeLabel: "",
        imgUrl,
      });
    })
    .filter(Boolean);

  const accsHtml = accRows.length
    ? `<div class="sumList">${accRows.join("")}</div>`
    : `<div class="sumEmpty">—</div>`;

  // NVR
  const nvr = proj && proj.nvrPick ? proj.nvrPick.nvr : null;
  const nvrHtml = nvr
    ? `<div class="sumList">${row({
        qty: 1,
        ref: nvr.id,
        name: nvr.name,
        placeLabel: "",
        imgUrl: pickImg("nvrs", nvr.id, nvr),
      })}</div>`
    : `<div class="sumEmpty">—</div>`;

  // Switch PoE
  const swRows =
    proj && proj.switches && proj.switches.required
      ? (proj.switches.plan || []).map((p) => {
          const it = p.item || null;
          const id = (it && it.id) || "—";
          return row({
            qty: p.qty || 0,
            ref: id,
            name: (it && it.name) || "",
            placeLabel: "",
            imgUrl: pickImg("switches", id, it),
          });
        })
      : [];

  const swHtml = swRows.length
    ? `<div class="sumList">${swRows.join("")}</div>`
    : `<div class="sumEmpty">• ${T("pdf_not_required")}</div>`;

  // Stockage
  const disk = proj ? proj.disks : null;
  const hdd = disk ? disk.hddRef : null;

  const hddHtml = disk
    ? `<div class="sumList">${row({
        qty: disk.count,
        ref: (hdd && hdd.id) || `${disk.sizeTB}TB`,
        name: (hdd && hdd.name) || `Disques ${disk.sizeTB} TB`,
        placeLabel: "",
        imgUrl: pickImg("hdds", (hdd && hdd.id) || `${disk.sizeTB}TB`, hdd),
      })}</div>`
    : `<div class="sumEmpty">—</div>`;

  // Compléments
  const scr = getSelectedOrRecommendedScreen(proj).selected;
  const enc = getSelectedOrRecommendedEnclosure(proj).selected;

  const screenHtml = scr
    ? `<div class="sumList">${row({
        qty: MODEL.complements?.screen?.qty || 1,
        ref: scr.id,
        name: scr.name,
        placeLabel: "",
        imgUrl: pickImg("screens", scr.id, scr),
      })}</div>`
    : `<div class="sumEmpty">• (désactivé)</div>`;

  const enclosureHtml = enc
    ? `<div class="sumList">${row({
        qty: MODEL.complements?.enclosure?.qty || 1,
        ref: enc.id,
        name: enc.name,
        placeLabel: "",
        imgUrl: pickImg("enclosures", enc.id, enc),
      })}</div>`
    : `<div class="sumEmpty">• (désactivé)</div>`;

  const signageEnabled = !!MODEL.complements?.signage?.enabled;
  const signObj =
    typeof getSelectedOrRecommendedSign === "function"
      ? getSelectedOrRecommendedSign()
      : { sign: null };
  const sign = signObj?.sign || null;

  const signageHtml = signageEnabled
    ? sign
      ? `<div class="sumList">${row({
          qty: MODEL.complements?.signage?.qty || 1,
          ref: sign.id,
          name: sign.name,
          placeLabel: "",
          imgUrl: pickImg("signage", sign.id, sign),
        })}</div>`
      : `<div class="sumEmpty">—</div>`
    : `<div class="sumEmpty">• (désactivé)</div>`;

  const totalMbps = (proj && proj.totalInMbps != null ? proj.totalInMbps : 0).toFixed(1);
  const reqTb = (proj && proj.requiredTB != null ? proj.requiredTB : 0).toFixed(1);

  return `
    <div class="recoCard finalSummary">
      <div class="recoHeader">
        <div>
          <div class="recoName">${T("sum_solution")}</div>
          <div class="muted">${T("pdf_format_devis")}</div>
        </div>

        <div class="score">
          ${projectScore != null ? `${projectScore}/100` : "—"}
          <div class="muted" style="margin-top:6px;text-align:right;line-height:1.3">score</div>
        </div>
      </div>

      <div class="finalGrid">
        <div class="finalCard">
          <div class="finalCardHead">
            <div class="finalCardTitle">Caméras</div>
            <div class="finalChip">${camRows.length} ${T("sum_lines")}</div>
          </div>
          ${camsHtml}
        </div>

        <div class="finalCard">
          <div class="finalCardHead">
            <div class="finalCardTitle">NVR</div>
            <div class="finalChip">${nvr ? "1 ligne" : "—"}</div>
          </div>
          ${nvrHtml}
        </div>

        <div class="finalCard">
          <div class="finalCardHead">
            <div class="finalCardTitle">${T("sum_accessories")}</div>
            <div class="finalChip">${accRows.length} ${T("sum_lines")}</div>
          </div>
          ${accsHtml}
        </div>

        <div class="finalCard">
          <div class="finalCardHead">
            <div class="finalCardTitle">${T("sum_switch_poe")}</div>
            <div class="finalChip">${swRows.length ? `${swRows.length} ${T("sum_lines")}` : "—"}</div>
          </div>
          ${swHtml}
        </div>

        <div class="finalCard">
          <div class="finalCardHead">
            <div class="finalCardTitle">${T("sum_storage_section2")}</div>
            <div class="finalChip">${disk ? "1 ligne" : "—"}</div>
          </div>
          ${hddHtml}
        </div>

        <div class="finalCard">
          <div class="finalCardHead">
            <div class="finalCardTitle">${T("sum_complements")}</div>
            <div class="finalChip">${T("sum_optional")}</div>
          </div>

          <div class="finalSub">
            <div class="finalSubTitle">${T("sum_screen")}</div>
            ${screenHtml}
          </div>

          <div class="finalSub">
            <div class="finalSubTitle">${T("sum_enclosure_nvr")}</div>
            ${enclosureHtml}
          </div>

          <div class="finalSub">
            <div class="finalSubTitle">${T("sum_signage_panel")}</div>
            ${signageHtml}
          </div>
        </div>
      </div>

      <div class="finalKpis">
        <div class="kpiTile">
          <div class="kpiLabel">${T("pdf_total_bitrate")}</div>
          <div class="kpiValue">${safe(totalMbps)} <span class="kpiUnit">Mbps</span></div>
        </div>
        <div class="kpiTile">
          <div class="kpiLabel">${T("pdf_required_storage")}</div>
          <div class="kpiValue">~${safe(reqTb)} <span class="kpiUnit">TB</span></div>
        </div>
      </div>
    </div>
  `;
}

// Compat shim pour l'IIFE legacy de app.js
if (typeof window !== 'undefined') {
}
