import { GARMENT_TYPES } from './constants';

// ─── FORMATTERS ───────────────────────────────────────────────────────────────
export const fmtN = (n) => (n || 0).toLocaleString('es-CO');
export const fmtM = (n) => '$' + fmtN(n);

export const genLotCode = () => {
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `ELROHI-${new Date().getFullYear()}-${seq}`;
};

export const today = () => new Date().toISOString().split('T')[0];

// ─── LABEL HELPERS ────────────────────────────────────────────────────────────
export const gLabel = (id) => GARMENT_TYPES.find((g) => g.id === id)?.name || id;

export const cLabel = (clients, id) => clients.find((c) => c.id === id)?.name || id;

export const sLabel = (satellites, id) => satellites.find((s) => s.id === id)?.name || id;

export const uLabel = (users, id) => users.find((u) => u.id === id)?.name || id;

// ─── CALCULATIONS ─────────────────────────────────────────────────────────────

/**
 * Devuelve el valor efectivo de una operación para un satélite.
 * Usa la tarifa personalizada del taller si existe, si no usa la global.
 * @param {Object[]} ops - Lista global de operaciones
 * @param {Object} satOpVals - Mapa {satId: {opId: valor}}
 * @param {string} satId - ID del satélite
 * @param {string} opId - ID de la operación
 */
export const getOpVal = (ops, satOpVals, satId, opId) => {
  const custom = satOpVals?.[satId]?.[opId];
  if (custom !== undefined && custom !== null) return custom;
  return ops.find((o) => o.id === opId)?.val ?? 0;
};

/**
 * Total de una operación = valor_unitario × cantidad_piezas
 */
export const opTotal = (ops, satOpVals, satId, opId, qty) =>
  getOpVal(ops, satOpVals, satId, opId) * (qty || 0);

/**
 * Progreso de costura de un lote (0–100%)
 */
export const lotProgress = (lot) => {
  if (!lot.lotOps?.length) return 0;
  const done = lot.lotOps.filter((o) => o.status === 'completado').length;
  return Math.round((done / lot.lotOps.length) * 100);
};

/**
 * Valor total de un lote (suma de valor × piezas de cada op)
 */
export const lotTotalValue = (lot, ops, satOpVals) =>
  (lot.lotOps || []).reduce((acc, lo) => {
    const val = getOpVal(ops, satOpVals, lot.satId, lo.opId);
    return acc + val * lo.qty;
  }, 0);

/**
 * Valor completado de un lote (solo ops terminadas)
 */
export const lotDoneValue = (lot, ops, satOpVals) =>
  (lot.lotOps || [])
    .filter((lo) => lo.status === 'completado')
    .reduce((acc, lo) => {
      const val = getOpVal(ops, satOpVals, lot.satId, lo.opId);
      return acc + val * lo.qty;
    }, 0);

/**
 * Total quincena de un operario — recorre todos los lotes
 */
export const workerQuincena = (userId, lots, ops, satOpVals) =>
  lots
    .flatMap((l) =>
      l.lotOps
        .filter((lo) => lo.wId === userId && lo.status === 'completado')
        .map((lo) => ({ ...lo, satId: l.satId }))
    )
    .reduce((acc, lo) => {
      const val = getOpVal(ops, satOpVals, lo.satId, lo.opId);
      return acc + val * lo.qty;
    }, 0);


// ── PDF Download Helper ──────────────────────────────────────────────────────
export function openPDF(html, filename) {
  var style = '<style>@media print{.no-print{display:none!important;}body{margin:0;}}</style>';
  var btn = '<div class="no-print" style="position:fixed;top:12px;right:12px;z-index:9999;display:flex;gap:8px;">' +
    '<button onclick="window.print()" style="background:#14405A;color:#fff;border:none;padding:10px 18px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.2)">⬇️ Descargar / Imprimir</button>' +
    '<button onclick="window.close()" style="background:#6b7280;color:#fff;border:none;padding:10px 14px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">✕ Cerrar</button>' +
    '</div>';
  var finalHtml = html.replace('</head>', style + '</head>').replace('</body>', btn + '</body>');
  var win = window.open('', '_blank', 'width=950,height=750');
  win.document.write(finalHtml);
  win.document.close();
  win.focus();
}
