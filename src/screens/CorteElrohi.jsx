import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { addDocument, updateDocument, listenCol } from '../services/db';
import { advanceLotStatus } from '../services/db_timeline';
import { GARMENT_TYPES, SIZES, LOT_PRIORITY, ACCENT } from '../constants';
import { EmptyState } from '../components/ui';
import { gLabel, genLotCode, today, fmtM } from '../utils';
import { orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';
import logo from '../assets/LogoELROHI.jpeg';

const SIZES_REF = ['XS','S','M','L','XL','2XL','3XL','4XL','5XL','6XL','6','8','10','12','14','16','18','20','22','24','26','28','30','32','34','36','38','40','42','44','46','48','50'];
const TODAS_TALLAS_ORD = ['XS','S','M','L','XL','XXL','2XL','3XL','4XL','5XL','6XL','6','8','10','12','14','16','18','20','22','24','26','28','30','32','34','36','38','40','42','44','46','48','50'];

// Expand talla ranges from lista de precios into individual tallas
// Normaliza talla para comparación (XXL = 2XL)
const normTalla = (t) => {
  const s = (t||'').replace(/\s/g,'').toUpperCase();
  if (s==='XXL') return '2XL';
  if (s==='XXXL') return '3XL';
  return s;
};

const getTallasDeProducto = (prod) => {
  if (!prod?.precios) return new Set();
  const result = new Set();
  const TALLAS_ORD = ['XS','S','M','L','XL','XXL','2XL','3XL','4XL','5XL','6XL','6','8','10','12','14','16','18','20','22','24','26','28','30','32','34','36','38','40','42','44','46','48','50'];
  prod.precios.forEach(p => {
    const r = (p.talla||'').replace(/\s/g,'').toUpperCase();
    if (r.includes('-')) {
      const parts = r.split('-');
      const a = normTalla(parts[0]);
      const b = normTalla(parts[parts.length-1]);
      const ia = TALLAS_ORD.findIndex(t=>normTalla(t)===a);
      const ib = TALLAS_ORD.findIndex(t=>normTalla(t)===b);
      if (ia>=0 && ib>=0) {
        for(let k=ia;k<=ib;k++) result.add(normTalla(TALLAS_ORD[k]));
      } else {
        // fallback: add both endpoints
        result.add(a); result.add(b);
      }
    } else {
      result.add(normTalla(r));
    }
  });
  return result;
};
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const genDocName = (num) => {
  const h = new Date();
  return `ELROHI_Corte${String(num).padStart(4,'0')}_Fecha_${String(h.getDate()).padStart(2,'0')}${MESES[h.getMonth()]}${h.getFullYear()}`;
};
const nowStr   = () => new Date().toLocaleString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const todayFmt = () => { const h=new Date(); return `${String(h.getDate()).padStart(2,'0')}/${String(h.getMonth()+1).padStart(2,'0')}/${String(h.getFullYear()).slice(-2)}`; };

const CORTE_STATES = [
  { key: 'nuevo',                 label: 'Nuevo',                 cls: 'bg-gray-100 text-gray-600'     },
  { key: 'recibido_alistamiento', label: 'Recibido Alistamiento', cls: 'bg-blue-100 text-blue-700'     },
  { key: 'en_corte',              label: 'En Corte',              cls: 'bg-orange-100 text-orange-800' },
  { key: 'entregar_admin',        label: 'Entregar a Admin',      cls: 'bg-amber-100 text-amber-800'   },
];

const nextStateMap = {
  nuevo:                 { next: 'recibido_alistamiento', label: '📥 Recibir para alistamiento', color: '#2563eb' },
  recibido_alistamiento: { next: 'en_corte',              label: '✂ Iniciar corte',              color: '#ea580c' },
  en_corte:              { next: 'entregar_admin',        label: '📦 Entregar al Admin',          color: '#d97706' },
};

// ─── CANVAS DE FIRMA ─────────────────────────────────────────────────────────
function FirmaCanvas({ onSave, label }) {
  const canvasRef = useRef(null);
  const drawing   = useRef(false);
  const [hasFirma, setHasFirma] = useState(false);

  const getPos = (e,c) => { const r=c.getBoundingClientRect(); const s=e.touches?e.touches[0]:e; return {x:s.clientX-r.left,y:s.clientY-r.top}; };
  const start  = (e) => { e.preventDefault(); drawing.current=true; const c=canvasRef.current; const ctx=c.getContext('2d'); const p=getPos(e,c); ctx.beginPath(); ctx.moveTo(p.x,p.y); };
  const draw   = (e) => { e.preventDefault(); if(!drawing.current)return; const c=canvasRef.current; const ctx=c.getContext('2d'); ctx.strokeStyle='#1a3a6b'; ctx.lineWidth=2; ctx.lineCap='round'; const p=getPos(e,c); ctx.lineTo(p.x,p.y); ctx.stroke(); setHasFirma(true); };
  const stop   = () => { drawing.current=false; };
  const clear  = () => { const c=canvasRef.current; c.getContext('2d').clearRect(0,0,c.width,c.height); setHasFirma(false); onSave(null); };
  const save   = () => { onSave(canvasRef.current.toDataURL('image/png')); toast.success('Firma guardada'); };

  return (
    <div style={{marginBottom:10}}>
      <p style={{fontSize:11,fontWeight:600,color:'#374151',marginBottom:5}}>{label}</p>
      <div style={{border:'1px solid #d1d5db',borderRadius:8,background:'#fff',overflow:'hidden'}}>
        <canvas ref={canvasRef} width={340} height={70}
          style={{display:'block',touchAction:'none',cursor:'crosshair',width:'100%'}}
          onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={stop} />
      </div>
      <div style={{display:'flex',gap:6,marginTop:4}}>
        <button onClick={clear} style={{fontSize:10,padding:'2px 9px',background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:4,cursor:'pointer',fontWeight:600}}>Borrar</button>
        {hasFirma && <button onClick={save} style={{fontSize:10,padding:'2px 9px',background:'#dcfce7',color:'#15803d',border:'none',borderRadius:4,cursor:'pointer',fontWeight:600}}>✓ Guardar firma</button>}
      </div>
    </div>
  );
}

// ─── IMPRIMIR FORMATO ─────────────────────────────────────────────────────────
function printFormato(fc, logoBase64='') {
  const lot = fc.lot || {};
  const garmentRows = (lot.garments||[]).map((g,i)=>{
    const sizes = SIZES_REF.map(s=>{const val=g.sizes?.[s]||''; return `<td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px">${val||''}</td>`;}).join('');
    return `<tr><td style="border:1px solid #1a3a6b;padding:3px 6px;font-size:10px;font-weight:500;color:#1a3a6b">${g.descripcionRef||gLabel(g.gtId)}</td>${sizes}<td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px;font-weight:700;background:#dce6f5">${g.total?.toLocaleString('es-CO')||''}</td><td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px;font-weight:700;background:#fff0e0;color:#e85d26">${fc.cortesRef?.[i]||''}</td><td style="border:1px solid #1a3a6b;padding:3px 4px;font-size:9px;color:#4a3a6b;font-style:italic;background:#fdfbff">${fc.comentariosRef?.[i]||''}</td></tr>`;
  }).join('');
  const emptyRef = Array(Math.max(0,5-(lot.garments||[]).length)).fill(0).map(()=>`<tr><td style="border:1px solid #1a3a6b;height:22px"></td>${SIZES_REF.map(s=>'<td style="border:1px solid #1a3a6b"></td>').join('')}<td style="border:1px solid #1a3a6b;background:#dce6f5"></td><td style="border:1px solid #1a3a6b;background:#fff0e0"></td><td style="border:1px solid #1a3a6b;background:#fdfbff"></td></tr>`).join('');
  const espRows = (fc.especificaciones||[]).map(e=>`<tr><td style="border:1px solid #1a3a6b;padding:3px 6px;font-size:10px;height:22px">${e.tipoTela||''}</td><td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px">${e.metrosUsados||''}</td><td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px;color:#dc2626">${e.metrosDesechados||''}</td><td style="border:1px solid #1a3a6b;padding:3px 4px;font-size:9px;font-style:italic">${e.comentario||''}</td></tr>`).join('');
  const firmaBox = (label,img,nombre,fecha) => `<div style="text-align:center;padding:6px 14px">${img?`<img src="${img}" style="height:44px;display:block;margin:0 auto 3px;border-bottom:1px solid #1a3a6b;width:80%">`:`<div style="height:44px;border-bottom:1px solid #1a3a6b;margin:0 16px"></div>`}<div style="font-size:9px;font-weight:700;color:#1a3a6b">${label}</div>${nombre?`<div style="font-size:9px;color:#374151">${nombre}</div>`:''}${fecha?`<div style="font-size:8px;color:#6b7280">${fecha}</div>`:''}</div>`;

  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>${fc.nombreDoc}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif}@media print{body{print-color-adjust:exact}}</style></head><body>
  <div style="max-width:960px;margin:10px auto;border:1.5px solid #1a3a6b">
    <div style="border-bottom:2px solid #14405A;padding:8px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#F7F7F7">
      <img src="${logoBase64}" style="width:72px;height:56px;object-fit:contain;border-radius:4px" />
      <div style="text-align:center;flex:1"><div style="font-size:17px;font-weight:900"><span style="color:#2878B4">Dotaciones </span><span style="color:#14405A">EL·ROHI</span></div><div style="font-size:9px;color:#14405A">NIT. 901.080.234-7 · Calle 39 A Sur No. 5-63 Este La Victoria · Cel.: 313 372 5739</div></div>
      <div style="border:2px solid #14405A;padding:4px 10px;text-align:center;background:#F7F7F7"><div style="font-size:9px;font-weight:700;color:#14405A">CORTE</div><div style="font-size:13px;font-weight:900;color:#2878B4;font-family:monospace">${fc.nombreDoc}</div></div>
    </div>
    <div style="display:flex;border-bottom:1px solid #1a3a6b">
      <div style="border-right:1px solid #1a3a6b;padding:4px 10px;display:flex;align-items:center;gap:6px"><span style="font-size:8px;font-weight:700;color:#1a3a6b">FECHA</span><span style="font-size:12px;font-weight:700;color:#1a3a6b">${fc.date||todayFmt()}</span></div>
      <div style="flex:1;padding:6px 14px;display:flex;align-items:center;gap:8px"><span style="font-size:10px;font-weight:700;color:#1a3a6b">Operario de Corte:</span><span style="font-size:13px;font-weight:700;color:#1a3a6b">${fc.operarioNombre||''}</span></div>
      <div style="padding:6px 14px;display:flex;align-items:center;gap:8px;border-left:1px solid #1a3a6b"><span style="font-size:10px;font-weight:700;color:#1a3a6b">Lote:</span><span style="font-size:11px;font-weight:700;color:#e85d26;font-family:monospace">${fc.lotCode||''}</span></div>
    </div>
    <div style="background:#14405A;color:#fff;font-size:9px;font-weight:700;letter-spacing:0.12em;padding:3px 8px">REFERENCIAS — PRENDAS</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed"><thead><tr><th style="width:100px;border:1px solid #1a3a6b;padding:3px 6px;background:#deeaf5;font-size:9px;font-weight:700;color:#14405A;text-align:left">Referencia</th>${SIZES_REF.map(s=>`<th style="width:28px;border:1px solid #1a3a6b;padding:3px 2px;background:#e8eef7;font-size:8px;font-weight:700;color:#1a3a6b;text-align:center">${s}</th>`).join('')}<th style="width:46px;border:1px solid #1a3a6b;padding:3px 2px;background:#c5daf0;font-size:9px;font-weight:700;color:#14405A;text-align:center">TOTAL</th><th style="width:44px;border:1px solid #1a3a6b;padding:3px 2px;background:#fff0e0;font-size:9px;font-weight:700;color:#e85d26;text-align:center">#CORTE</th><th style="width:90px;border:1px solid #1a3a6b;padding:3px 2px;background:#f5f0fa;font-size:8px;font-weight:700;color:#4a3a6b;text-align:center;font-style:italic">Comentarios</th></tr></thead><tbody>${garmentRows}${emptyRef}</tbody></table>
    <div style="background:#2878B4;color:#fff;font-size:9px;font-weight:700;letter-spacing:0.12em;padding:3px 8px">ESPECIFICACIONES DE TELA</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed"><thead><tr><th style="border:1px solid #1a3a6b;padding:3px 8px;background:#fef3e2;font-size:9px;font-weight:700;color:#92400e;text-align:left;width:200px">Tipo de tela</th><th style="border:1px solid #1a3a6b;padding:3px 2px;background:#fef3e2;font-size:9px;font-weight:700;color:#92400e;text-align:center;width:160px">Metros usados</th><th style="border:1px solid #1a3a6b;padding:3px 2px;background:#fef3e2;font-size:9px;font-weight:700;color:#dc2626;text-align:center;width:160px">Metros desechados</th><th style="border:1px solid #1a3a6b;padding:3px 2px;background:#fef3e2;font-size:8px;font-weight:700;color:#92400e;text-align:center;font-style:italic">Comentarios</th></tr></thead><tbody>${espRows}</tbody></table>
    <div style="border-top:1px solid #1a3a6b;padding:7px 12px;display:flex;align-items:center;gap:6px"><span style="font-size:10px;font-weight:700;color:#1a3a6b">NOTA:</span><span style="flex:1;border-bottom:1px solid #1a3a6b;min-height:18px;display:inline-block;font-size:11px;padding:0 4px">${fc.nota||''}</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #1a3a6b">
      ${firmaBox('Entregado por (Corte)',fc.firmaCorte,fc.operarioNombre,fc.fechaCorte)}
      <div style="border-left:1px solid #1a3a6b">${firmaBox('Recibido por (Admin ELROHI)',fc.firmaAdmin,fc.nombreAdmin,fc.fechaAdmin)}</div>
    </div>
  </div>
  <script>window.onload=()=>window.print();</script></body></html>`;

  const win=window.open('','_blank'); win.document.write(html); win.document.close();
}

// ─── PANTALLA PRINCIPAL ───────────────────────────────────────────────────────
export default function CorteElrohiScreen() {
  const { profile }           = useAuth();
  const { lots }              = useData();
  const [vista, setVista]     = useState('lista');
  const [filterStatus, setFilter] = useState('all');
  const [formatosCorte, setFormatosCorte] = useState([]);

  useEffect(() => {
    const unsub = listenCol('formatosCorte', setFormatosCorte, orderBy('createdAt','desc'));
    return unsub;
  }, []);

  const isAdmin = ['gerente','admin_elrohi'].includes(profile?.role);
  const isCorte = profile?.role === 'corte' || isAdmin;

  const corteLots = lots.filter(l => ['nuevo','recibido_alistamiento','en_corte','entregar_admin'].includes(l.status));
  const filtered  = filterStatus === 'all' ? corteLots : corteLots.filter(l => l.status === filterStatus);
  const pendientes = formatosCorte.filter(f => f.status === 'enviado' && isAdmin);

  const advance = async (lot, nextStatus) => {
    try {
      await advanceLotStatus(lot.id, nextStatus, profile?.id, profile?.name);
      toast.success('Estado actualizado');
    } catch { toast.error('Error'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold text-gray-900">Área de Corte</h1>
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        {[
          ['lista',    'Cola de Corte'],
          ['nuevo',    '+ Nuevo Formato de Corte'],
          ['pendientes', `Pendientes${pendientes.length > 0 ? ` (${pendientes.length})` : ''}`],
          ['historial','Historial'],
        ].map(([k,l]) => (
          <button key={k} onClick={() => setVista(k)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{ background: vista===k ? (k==='nuevo'?ACCENT:'#fff') : 'transparent', color: vista===k ? (k==='nuevo'?'#fff':'#111827') : '#6b7280', fontWeight: vista===k?700:400, boxShadow: vista===k&&k!=='nuevo'?'0 1px 3px rgba(0,0,0,0.08)':'none' }}>
            {l}
          </button>
        ))}
      </div>

      {/* COLA */}
      {vista === 'lista' && (
        <>
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {[['all',`Todos (${corteLots.length})`], ...CORTE_STATES.map(s=>[s.key,`${s.label} (${corteLots.filter(l=>l.status===s.key).length})`])].map(([k,l])=>(
              <button key={k} onClick={() => setFilter(k)}
                className="px-2.5 py-1 rounded-full text-[10px] font-medium border-none cursor-pointer"
                style={{ background: filterStatus===k?ACCENT:'#f1f0ec', color: filterStatus===k?'#fff':'#6b7280' }}>
                {l}
              </button>
            ))}
          </div>
          {filtered.length === 0 && <EmptyState emoji="✂" title="Sin lotes" sub="Crea un nuevo formato de corte para comenzar" />}
          <div className="space-y-3">
            {filtered.map(lot => {
              const st = CORTE_STATES.find(s => s.key === lot.status);
              const pr = LOT_PRIORITY[lot.priority];
              const next = nextStateMap[lot.status];
              return (
                <div key={lot.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                        <span className={`${st?.cls} px-2 py-0.5 rounded-full text-[9px] font-semibold`}>{st?.label}</span>
                        <span className={`${pr.cls} px-2 py-0.5 rounded-full text-[9px] font-semibold`}>{pr.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {lot.garments?.map((g,i)=>(
                          <span key={i} className="text-[10px] bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full text-gray-700">
                            {g.descripcionRef||gLabel(g.gtId)}: <strong>{g.total?.toLocaleString('es-CO')}</strong>
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-400">
                        {lot.totalPieces?.toLocaleString('es-CO')} piezas · Vence: {lot.deadline}
                        {lot.descripcion && lot.descripcion !== lot.code && ` · ${lot.descripcion}`}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {isCorte && next && (
                        <button onClick={() => advance(lot, next.next)}
                          className="text-white text-[10px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap"
                          style={{ background: next.color }}>
                          {next.label}
                        </button>
                      )}
                      {isAdmin && lot.status === 'entregar_admin' && (
                        <button onClick={() => advance(lot, 'asignacion')}
                          className="text-white text-[10px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap"
                          style={{ background: '#7c3aed' }}>
                          ✓ Recibido → Asignar Satélite
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Timeline */}
                  {lot.timeline?.length > 0 && (
                    <div className="mt-3 border-t border-gray-100 pt-2">
                      <div className="flex gap-2 flex-wrap">
                        {lot.timeline.map((t,i) => {
                          const st2 = CORTE_STATES.find(s=>s.key===t.status);
                          return (
                            <div key={i} className="flex items-center gap-1 text-[9px]">
                              <span className={`${st2?.cls||'bg-gray-100 text-gray-600'} px-1.5 py-0.5 rounded font-medium`}>{st2?.label||t.status}</span>
                              {t.duracion && <span className="text-gray-400">{t.duracion}</span>}
                              {i < lot.timeline.length-1 && <span className="text-gray-300">→</span>}
                            </div>
                          );
                        })}
                        {lot.timeline[lot.timeline.length-1]?.salió===null && (
                          <span className="text-[9px] text-blue-500 italic">⏱ En curso...</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tabla tallas */}
                  <div className="mt-3 overflow-x-auto">
                    <table className="text-[10px] border-collapse w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-2 py-1 text-left text-gray-500 font-medium border border-gray-200">Prenda</th>
                          {SIZES.filter(s=>(lot.garments||[]).some(g=>(+g.sizes?.[s]||0)>0)).map(s=><th key={s} className="px-2 py-1 text-center text-gray-500 font-medium border border-gray-200 w-10">{s}</th>)}
                          <th className="px-2 py-1 text-center text-gray-700 font-bold border border-gray-200">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(()=>{ const activeSizes = SIZES.filter(s=>(lot.garments||[]).some(g=>(g.sizes?.[s]||0)>0)); return lot.garments?.map((g,i)=>(
                          <tr key={i}>
                            <td className="px-2 py-1.5 font-medium text-gray-700 border border-gray-200" style={{maxWidth:200,fontSize:10}}>{g.descripcionRef||gLabel(g.gtId)}</td>
                            {activeSizes.map(s=>(
                              <td key={s} className="px-2 py-1.5 text-center border border-gray-200"
                                style={{color:(g.sizes?.[s]||0)>0?'#1a3a6b':'#d1d5db',fontWeight:(g.sizes?.[s]||0)>0?600:400}}>
                                {g.sizes?.[s]||'—'}
                              </td>
                            ))}
                            <td className="px-2 py-1.5 text-center font-bold text-gray-800 border border-gray-200 bg-gray-50">{g.total?.toLocaleString('es-CO')}</td>
                          </tr>
                        ))})()}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {vista === 'nuevo'      && <NuevoFormato profile={profile} onBack={() => setVista('lista')} />}
      {vista === 'pendientes' && <PendientesFormato formatosCorte={pendientes} profile={profile} />}
      {vista === 'historial'  && <HistorialFormatos formatosCorte={formatosCorte} />}
    </div>
  );
}

// ─── NUEVO FORMATO ─────────────────────────────────────────────────────────────
function NuevoFormato({ profile, onBack }) {
  const [numCorte,  setNumCorte]  = useState(null);
  const [priority,  setPriority]  = useState('normal');
  const [deadline,  setDeadline]  = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [listas,    setListas]    = useState([]);
  // Cargar listas de precios para obtener referencias reales
  useEffect(() => {
    const unsub = listenCol('listasPrecios', setListas);
    return unsub;
  }, []);
  // Productos de todas las listas activas (sin duplicados)
  const productosDisp = [];
  const vistos = new Set();
  listas.filter(l=>l.active!==false&&!l.eliminado).forEach(l => {
    (l.productos||[]).forEach(p => {
      const key = p.descripcion;
      if (!vistos.has(key)) { vistos.add(key); productosDisp.push(p); }
    });
  });
  // Referencias — múltiples filas
  const [items, setItems] = useState([
    { gtId: 'gt1', descripcionRef: '', sizes: {}, total: 0, corte: '', comentario: '' },
  ]);
  const [specs, setSpecs] = useState(
    Array(4).fill(null).map(()=>({tipoTela:'',metrosUsados:'',metrosDesechados:'',comentario:''}))
  );
  const [nota,     setNota]     = useState('');
  const [firmaImg, setFirmaImg] = useState(null);
  const [nombre,   setNombre]   = useState(profile?.name||'');
  const [saving,   setSaving]   = useState(false);

  // Consecutivo se asigna al guardar, no al abrir el formulario

  const nombreDoc = genDocName(numCorte);

  const addItem    = () => setItems(f => [...f, { gtId: 'gt1', descripcionRef: '', sizes: {}, total: 0, corte: '', comentario: '' }]);
  const removeItem = (i) => { if(items.length===1){toast.error('Debe haber al menos una referencia');return;} setItems(f=>f.filter((_,idx)=>idx!==i)); };
  const updItem    = (i, k, v) => setItems(f => {
    const its=[...f]; its[i]={...its[i],[k]:v};
    if(k==='sizes') its[i].total=Object.values(v).reduce((a,b)=>a+(+b||0),0);
    return its;
  });
  const updSpec    = (i,k,v) => setSpecs(f => { const n=[...f]; n[i]={...n[i],[k]:v}; return n; });

  const totalPiezas = items.reduce((a,i)=>a+i.total,0);

  const enviar = async () => {
    if (!deadline)    { toast.error('Selecciona la fecha límite'); return; }
    if (totalPiezas===0) { toast.error('Agrega prendas con cantidades'); return; }
    if (!firmaImg)    { toast.error('Dibuja y guarda tu firma'); return; }
    if (!nombre)      { toast.error('Escribe tu nombre'); return; }
    setSaving(true);
    try {
      // Obtener consecutivo SOLO al guardar
      const { getNextCorteNum } = await import('../services/consecutivos');
      const numConsec = await getNextCorteNum();
      const numCorteGuardado = String(numConsec).padStart(4,'0');
      setNumCorte(numCorteGuardado);
      const code = `ELROHI-${new Date().getFullYear()}-${numCorteGuardado}`;
      const nowISO  = new Date().toISOString();
      const lotData = {
        code, descripcion: descripcion||code, clientId: null,
        status: 'nuevo', priority, satId: null,
        created: today(), deadline,
        garments: items.filter(i=>i.total>0).map(({gtId,sizes,total,descripcionRef})=>({gtId,sizes,total,descripcionRef})),
        totalPieces: totalPiezas, lotOps: [], opsElrohi: [],
        notes: nota, novelties: [], bodega: null, createdBy: profile?.id,
        timeline: [{ status:'nuevo', entró: nowISO, salió:null, duracionMs:null, duracion:null, cambiadoPor: nombre, cambiadoPorId: profile?.id }],
      };
      const lotId = await addDocument('lots', lotData);
      const docName = `ELROHI_Corte${numCorteGuardado}_Fecha_${String(new Date().getDate()).padStart(2,'0')}${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][new Date().getMonth()]}${new Date().getFullYear()}`;
      await addDocument('formatosCorte', {
        nombreDoc: docName, numCorte: numCorteGuardado,
        lotId, lotCode: code, status: 'enviado', date: today(),
        lot: {...lotData, id: lotId},
        cortesRef:      items.map(i=>i.corte),
        comentariosRef: items.map(i=>i.comentario),
        especificaciones: specs, nota,
        operarioNombre: nombre, firmaCorte: firmaImg, fechaCorte: nowStr(),
        firmaAdmin: null, nombreAdmin: null, fechaAdmin: null,
      });
      toast.success(`✅ Lote ${code} creado y formato enviado al Admin`);
      onBack();
    } catch(e) { console.error(e); toast.error('Error al crear'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">← Volver a cola</button>

      {/* HEADER */}
      <div className="bg-white rounded-xl border-2 border-blue-200 overflow-hidden mb-4">
        <div className="flex items-center gap-3 p-3 border-b" style={{background:'#F7F7F7',borderColor:'#3C78B4'}}>
          <div className="w-20 h-14 flex-shrink-0">
            <img src={logo} alt="ELROHI" className="w-full h-full object-contain rounded" />
          </div>
          <div className="flex-1 text-center">
            <p className="text-sm font-black"><span style={{color:'#2878B4'}}>Dotaciones </span><span style={{color:'#14405A'}}>EL·ROHI</span></p>
            <p className="text-[9px]" style={{color:'#14405A'}}>NIT. 901.080.234-7 · Calle 39 A Sur No. 5-63 Este La Victoria · Cel.: 313 372 5739</p>
          </div>
          <div className="border-2 px-2 py-1.5 text-center flex-shrink-0 rounded" style={{borderColor:'#14405A'}}>
            <p className="text-[9px] font-bold" style={{color:'#14405A'}}>CORTE</p>
            <input value={numCorte} onChange={e=>setNumCorte(e.target.value)}
              className="w-16 text-center bg-transparent border-none outline-none font-black font-mono text-xs" style={{color:ACCENT}} />
          </div>
        </div>
        <div className="flex border-b border-blue-100 bg-white flex-wrap">
          <div className="px-3 py-2 border-r border-blue-100 flex items-center gap-2 flex-shrink-0">
            <span className="text-[9px] font-bold text-blue-800 uppercase">Fecha</span>
            <span className="text-xs font-bold font-mono text-blue-900">{todayFmt()}</span>
          </div>
          <div className="flex-1 px-3 py-2 flex items-center gap-2">
            <span className="text-[9px] font-bold text-blue-800 whitespace-nowrap">Operario:</span>
            <span className="text-xs font-bold text-blue-900">{profile?.name}</span>
          </div>
          <div className="px-3 py-2 border-l border-blue-100 flex items-center gap-2 flex-wrap">
            <select value={priority} onChange={e=>setPriority(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-0.5 bg-white focus:outline-none">
              <option value="normal">Normal</option>
              <option value="urgente">Urgente</option>
              <option value="critico">Crítico</option>
            </select>
            <input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-0.5 focus:outline-none" />
          </div>
        </div>
      </div>

      {/* REFERENCIAS — tabla inline con botón agregar */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
        <div className="px-4 py-2 flex items-center justify-between" style={{background:'#1a3a6b'}}>
          <p className="text-[10px] font-bold text-white uppercase tracking-wider">Referencias — Prendas</p>
          <button onClick={addItem}
            className="text-[10px] font-bold px-3 py-1 rounded-md text-blue-900 hover:text-white"
            style={{background:'rgba(255,255,255,0.2)'}}>
            + Agregar referencia
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{tableLayout:'fixed',fontSize:'10px'}}>
            <thead>
              <tr style={{background:'#e8eef7'}}>
                <th className="border border-blue-200 px-2 py-1.5 text-left text-[9px] text-blue-800 font-bold" style={{width:'115px'}}>Referencia</th>
                {SIZES_REF.map(s=>(
                  <th key={s} className="border border-blue-200 px-0 py-1.5 text-[8px] text-blue-700 font-bold text-center" style={{width:'26px'}}>{s}</th>
                ))}
                <th className="border border-blue-200 px-1 py-1.5 text-[9px] font-bold text-center" style={{background:'#dce6f5',color:'#1a3a6b',width:'44px'}}>TOTAL</th>
                <th className="border border-blue-200 px-1 py-1.5 text-[9px] font-bold text-center" style={{background:'#fff0e0',color:ACCENT,width:'46px'}}>#CORTE</th>
                <th className="border border-blue-200 px-1 py-1.5 text-[8px] font-bold italic text-center" style={{background:'#f5f0fa',color:'#4a3a6b',width:'86px'}}>Comentarios</th>
                <th className="border border-blue-200 px-1 py-1.5 text-center" style={{width:'28px'}}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item,i) => (
                <tr key={i} style={{background: i%2===0 ? '#fff' : '#fafafa'}}>
                  <td className="border border-blue-100 px-1 py-1" style={{minWidth:120}}>
                    {productosDisp.length > 0 ? (
                      <select value={item.descripcionRef||''} onChange={e=>{
                        const prod = productosDisp.find(p=>p.descripcion===e.target.value);
                        updItem(i,'descripcionRef',e.target.value);
                        if(prod) updItem(i,'gtId', prod.gtId||'gt1');
                      }}
                        className="w-full border-none bg-transparent outline-none font-medium" style={{fontSize:'9px',color:'#1a3a6b'}}>
                        <option value="">— Seleccionar ref —</option>
                        {productosDisp.map((p,j)=><option key={j} value={p.descripcion}>{p.descripcion} ({p.tipo})</option>)}
                      </select>
                    ) : (
                      <select value={item.gtId} onChange={e=>updItem(i,'gtId',e.target.value)}
                        className="w-full border-none bg-transparent outline-none font-medium" style={{fontSize:'10px',color:'#1a3a6b'}}>
                        {GARMENT_TYPES.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    )}
                  </td>
                  {SIZES_REF.map(s => {
                    const key = s.split('/')[0];
                    const prod = productosDisp.find(p=>p.descripcion===item.descripcionRef);
                    const tallasDisp = prod ? getTallasDeProducto(prod) : null;
                    const normKey = key==='XXL'?'2XL':key==='XXXL'?'3XL':key;
                    const habilitada = !item.descripcionRef || !tallasDisp || tallasDisp.size===0 || tallasDisp.has(normKey) || tallasDisp.has(key);
                    return (
                      <td key={s} className="border border-blue-100 p-0"
                        style={{background: habilitada ? 'transparent' : '#f0f0f0'}}>
                        <input type="number" min={0} value={item.sizes[key]||''}
                          onChange={e=>updItem(i,'sizes',{...item.sizes,[key]:+e.target.value||0})}
                          disabled={!habilitada}
                          className="w-full text-center border-none outline-none bg-transparent font-semibold disabled:cursor-not-allowed"
                          style={{fontSize:'10px',color:habilitada?'#1a3a6b':'#ccc',padding:'4px 1px'}} />
                      </td>
                    );
                  })}
                  <td className="border border-blue-100 px-1 py-1 text-center font-bold" style={{background:'#f0f4f8',color:'#1a3a6b'}}>
                    {item.total > 0 ? item.total.toLocaleString('es-CO') : '—'}
                  </td>
                  <td className="border border-blue-100 p-0" style={{background:'#fff8f0'}}>
                    <input type="text" value={item.corte||''} onChange={e=>updItem(i,'corte',e.target.value)}
                      placeholder="#"
                      className="w-full text-center border-none outline-none bg-transparent font-bold"
                      style={{fontSize:'10px',color:ACCENT,padding:'4px 2px'}} />
                  </td>
                  <td className="border border-blue-100 p-0" style={{background:'#fdfbff'}}>
                    <input type="text" value={item.comentario||''} onChange={e=>updItem(i,'comentario',e.target.value)}
                      placeholder="Obs..."
                      className="w-full border-none outline-none bg-transparent italic"
                      style={{fontSize:'9px',color:'#4a3a6b',padding:'4px 3px'}} />
                  </td>
                  <td className="border border-blue-100 px-1 py-1 text-center">
                    <button onClick={()=>removeItem(i)} className="text-red-400 hover:text-red-600 font-bold" style={{fontSize:'11px',lineHeight:1,background:'none',border:'none',cursor:'pointer'}}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{background:'#f0f4f8'}}>
                <td className="border border-blue-100 px-2 py-1.5 font-bold text-blue-800" style={{fontSize:'10px'}}>TOTAL GENERAL</td>
                {SIZES_REF.map(s=>{
                  const sum=items.reduce((a,it)=>a+(+it.sizes[s]||0),0);
                  return <td key={s} className="border border-blue-100 px-1 py-1.5 text-center font-bold" style={{color:sum>0?'#1a3a6b':'#d1d5db',fontSize:'10px'}}>{sum>0?sum:'—'}</td>;
                })}
                <td className="border border-blue-100 px-1 py-1.5 text-center font-black text-blue-900" style={{background:'#dce6f5',fontSize:'11px'}}>{totalPiezas.toLocaleString('es-CO')}</td>
                <td className="border border-blue-100" style={{background:'#fff0e0'}}></td>
                <td className="border border-blue-100" style={{background:'#fdfbff'}}></td>
                <td className="border border-blue-100"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ESPECIFICACIONES DE TELA */}
      <div className="bg-white rounded-xl border border-orange-100 overflow-hidden mb-4">
        <div className="px-4 py-2" style={{background:ACCENT}}>
          <p className="text-[10px] font-bold text-white uppercase tracking-wider">Especificaciones de Tela</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{tableLayout:'fixed',fontSize:'10px'}}>
            <thead>
              <tr style={{background:'#fef3e2'}}>
                <th className="border border-orange-200 px-2 py-1.5 text-left text-[9px] font-bold" style={{color:'#92400e',width:'200px'}}>Tipo de tela</th>
                <th className="border border-orange-200 px-1 py-1.5 text-[9px] font-bold text-center" style={{color:'#92400e',width:'130px'}}>Metros usados</th>
                <th className="border border-orange-200 px-1 py-1.5 text-[9px] font-bold text-center" style={{color:'#dc2626',width:'130px'}}>Metros desechados</th>
                <th className="border border-orange-200 px-1 py-1.5 text-[8px] font-bold italic text-center" style={{color:'#92400e'}}>Comentarios</th>
              </tr>
            </thead>
            <tbody>
              {specs.map((sp,i)=>(
                <tr key={i} style={{background:i%2===0?'#fff':'#fffbf5'}}>
                  <td className="border border-orange-100 px-1 py-1">
                    <input value={sp.tipoTela} onChange={e=>updSpec(i,'tipoTela',e.target.value)} placeholder={`Tipo de tela ${i+1}`}
                      className="w-full border-none outline-none bg-transparent font-medium" style={{fontSize:'10px',color:'#1a3a6b'}} />
                  </td>
                  <td className="border border-orange-100 px-1 py-1">
                    <input value={sp.metrosUsados} onChange={e=>updSpec(i,'metrosUsados',e.target.value)} placeholder="0.00"
                      className="w-full text-center border-none outline-none bg-transparent font-semibold" style={{fontSize:'10px',color:'#1a3a6b'}} />
                  </td>
                  <td className="border border-orange-100 px-1 py-1">
                    <input value={sp.metrosDesechados} onChange={e=>updSpec(i,'metrosDesechados',e.target.value)} placeholder="0.00"
                      className="w-full text-center border-none outline-none bg-transparent font-semibold" style={{fontSize:'10px',color:'#dc2626'}} />
                  </td>
                  <td className="border border-orange-100 px-1 py-1">
                    <input value={sp.comentario} onChange={e=>updSpec(i,'comentario',e.target.value)} placeholder="Obs..."
                      className="w-full border-none outline-none bg-transparent italic" style={{fontSize:'9px',color:'#4a3a6b'}} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* NOTA Y DESCRIPCIÓN */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 mb-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-700 whitespace-nowrap">NOTA:</span>
          <input value={nota} onChange={e=>setNota(e.target.value)} placeholder="Observaciones generales del corte..."
            className="flex-1 border-b border-gray-200 text-sm py-0.5 focus:outline-none bg-transparent" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-700 whitespace-nowrap">Descripción del lote:</span>
          <input value={descripcion} onChange={e=>setDescripcion(e.target.value)} placeholder="Opcional: Ej. Pantalones drill azul ref 01"
            className="flex-1 border-b border-gray-200 text-sm py-0.5 focus:outline-none bg-transparent" />
        </div>
      </div>

      {/* FIRMA */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Firma — Entregado por Corte</p>
          {firmaImg && <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded-full">✓ Firma guardada</span>}
        </div>
        <FirmaCanvas label="Dibuja tu firma:" onSave={setFirmaImg} />
        <div className="mt-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Tu nombre completo</label>
          <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Escribe tu nombre..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
        </div>
      </div>

      {/* Resumen */}
      <div className="bg-blue-50 rounded-xl p-3 mb-4 flex items-center justify-between">
        <span className="text-xs text-blue-700">Total del lote:</span>
        <span className="text-base font-black text-blue-900">{totalPiezas.toLocaleString('es-CO')} piezas</span>
      </div>

      <button onClick={enviar} disabled={saving}
        className="w-full py-3 text-white rounded-xl text-sm font-bold disabled:opacity-50"
        style={{background:'#1a3a6b'}}>
        {saving ? 'Creando lote y guardando formato...' : '📤 Crear Corte y enviar para Alistamiento'}
      </button>
    </div>
  );
}

// ─── PENDIENTES FIRMA ADMIN ────────────────────────────────────────────────────
function PendientesFormato({ formatosCorte, profile }) {
  const [sel, setSel]         = useState(null);
  const [firmaImg, setFirmaImg] = useState(null);
  const [nombre, setNombre]   = useState(profile?.name||'');
  const [saving, setSaving]   = useState(false);

  const firmar = async (fc) => {
    if (!firmaImg){ toast.error('Dibuja y guarda tu firma'); return; }
    if (!nombre)  { toast.error('Escribe tu nombre'); return; }
    setSaving(true);
    try {
      await updateDocument('formatosCorte', fc.id, {
        status:'completado', firmaAdmin:firmaImg, nombreAdmin:nombre, fechaAdmin:nowStr(),
      });
      if (fc.lotId) {
        await advanceLotStatus(fc.lotId, 'asignacion', profile?.id, profile?.name);
      }
      toast.success('✅ Formato firmado — lote listo para asignar a satélite');
      setSel(null); setFirmaImg(null);
    } catch { toast.error('Error al firmar'); }
    finally { setSaving(false); }
  };

  if (formatosCorte.length === 0)
    return <EmptyState emoji="✅" title="Sin formatos pendientes" sub="No hay formatos de corte por firmar" />;

  return (
    <div className="space-y-3">
      {formatosCorte.map(fc=>(
        <div key={fc.id} className="bg-white rounded-xl border-2 border-amber-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-xs font-bold" style={{color:'#1a3a6b'}}>{fc.nombreDoc}</span>
                <span className="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">⏳ Pendiente firma</span>
              </div>
              <p className="text-xs text-gray-500">Lote: {fc.lotCode} · {fc.date} · {fc.operarioNombre}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>printFormato(fc)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">🖨️ Ver</button>
              <button onClick={()=>setSel(sel?.id===fc.id?null:fc)}
                className="text-xs px-3 py-1.5 rounded-lg text-white font-bold" style={{background:'#1a3a6b'}}>
                ✍ Firmar
              </button>
            </div>
          </div>
          {sel?.id===fc.id && (
            <div className="border-t border-amber-100 pt-3 mt-2">
              <FirmaCanvas label="Tu firma de recepción:" onSave={setFirmaImg} />
              <div className="mt-2 mb-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tu nombre completo</label>
                <input value={nombre} onChange={e=>setNombre(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <button onClick={()=>firmar(fc)} disabled={saving}
                className="w-full py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                style={{background:'#15803d'}}>
                {saving?'Guardando...':'✅ Confirmar recepción y firmar'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── HISTORIAL ────────────────────────────────────────────────────────────────
function HistorialFormatos({ formatosCorte }) {
  if (formatosCorte.length===0)
    return <EmptyState emoji="📋" title="Sin formatos registrados" sub="Los formatos enviados aparecerán aquí" />;

  return (
    <div className="space-y-2">
      {formatosCorte.map(fc=>(
        <div key={fc.id} className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-xs font-bold" style={{color:'#1a3a6b'}}>{fc.nombreDoc}</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${fc.status==='completado'?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
                  {fc.status==='completado'?'✓ Firmado':'⏳ Pendiente'}
                </span>
              </div>
              <p className="text-xs text-gray-500">Lote: {fc.lotCode} · {fc.date} · {fc.operarioNombre}</p>
            </div>
            <button onClick={()=>printFormato(fc)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">🖨️ Imprimir</button>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="text-xs">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">Entregado por (Corte)</p>
              {fc.firmaCorte && <img src={fc.firmaCorte} alt="firma" style={{height:28,borderBottom:'1px solid #e5e7eb',marginBottom:2,maxWidth:'100%'}} />}
              <p className="font-medium text-gray-700">{fc.operarioNombre||'—'}</p>
              <p className="text-[9px] text-gray-400">{fc.fechaCorte||'—'}</p>
            </div>
            <div className="text-xs">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">Recibido por (Admin)</p>
              {fc.firmaAdmin ? (
                <><img src={fc.firmaAdmin} alt="firma" style={{height:28,borderBottom:'1px solid #e5e7eb',marginBottom:2,maxWidth:'100%'}} />
                <p className="font-medium text-gray-700">{fc.nombreAdmin}</p>
                <p className="text-[9px] text-gray-400">{fc.fechaAdmin}</p></>
              ) : <p className="text-gray-300 italic text-[10px]">Pendiente</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
