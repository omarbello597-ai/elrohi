import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { addDocument, updateDocument } from '../services/db';
import { advanceLotStatus } from '../services/db_timeline';
import { durationSince, fmtDuration } from '../services/consecutivos';
import { GARMENT_TYPES, ACCENT } from '../constants';
import { gLabel, fmtM } from '../utils';
import toast from 'react-hot-toast';

const SIZES_REF = ['XS/6','S/8','M/10','L/12','XL/14','XXL/16','28','30','32','34','36','38','40','42','44'];

const nowStr = () => new Date().toLocaleString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const todayFmt = () => { const h=new Date(); return `${String(h.getDate()).padStart(2,'0')}/${String(h.getMonth()+1).padStart(2,'0')}/${String(h.getFullYear()).slice(-2)}`; };

// ─── FIRMA CANVAS ──────────────────────────────────────────────────────────────
function FirmaCanvas({ onSave, label }) {
  const ref = useRef(null); const drawing = useRef(false); const [has, setHas] = useState(false);
  const gp = (e,c) => { const r=c.getBoundingClientRect(); const s=e.touches?e.touches[0]:e; return {x:s.clientX-r.left,y:s.clientY-r.top}; };
  const start=(e)=>{e.preventDefault();drawing.current=true;const c=ref.current;const ctx=c.getContext('2d');const p=gp(e,c);ctx.beginPath();ctx.moveTo(p.x,p.y);};
  const draw=(e)=>{e.preventDefault();if(!drawing.current)return;const c=ref.current;const ctx=c.getContext('2d');ctx.strokeStyle='#1a3a6b';ctx.lineWidth=2;ctx.lineCap='round';const p=gp(e,c);ctx.lineTo(p.x,p.y);ctx.stroke();setHas(true);};
  const stop=()=>{drawing.current=false;};
  const clear=()=>{const c=ref.current;c.getContext('2d').clearRect(0,0,c.width,c.height);setHas(false);onSave(null);};
  const save=()=>{onSave(ref.current.toDataURL('image/png'));toast.success('Firma guardada');};
  return (
    <div style={{marginBottom:10}}>
      <p style={{fontSize:11,fontWeight:600,color:'#374151',marginBottom:5}}>{label}</p>
      <div style={{border:'1px solid #d1d5db',borderRadius:8,background:'#fff',overflow:'hidden'}}>
        <canvas ref={ref} width={1200} height={120} style={{display:'block',touchAction:'none',cursor:'crosshair',width:'100%'}}
          onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={stop} />
      </div>
      <div style={{display:'flex',gap:6,marginTop:4}}>
        <button onClick={clear} style={{fontSize:10,padding:'2px 9px',background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:4,cursor:'pointer',fontWeight:600}}>Borrar</button>
        {has && <button onClick={save} style={{fontSize:10,padding:'2px 9px',background:'#dcfce7',color:'#15803d',border:'none',borderRadius:4,cursor:'pointer',fontWeight:600}}>✓ Guardar firma</button>}
      </div>
    </div>
  );
}

// ─── IMPRIMIR REMISIÓN SATÉLITE → TINTORERÍA ───────────────────────────────────
function printRemisionTinto(lot, satName, tintoNombre, remData) {
  const garmentRows = (lot.garments||[]).map(g => {
    const sizes = SIZES_REF.map(s => {
      const key = s.split('/')[0];
      const val = g.sizes?.[key] || '';
      return `<td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px">${val||''}</td>`;
    }).join('');
    return `<tr><td style="border:1px solid #1a3a6b;padding:3px 6px;font-size:10px;font-weight:500">${gLabel(g.gtId)}</td>${sizes}<td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px;font-weight:700;background:#dce6f5">${g.total?.toLocaleString('es-CO')}</td></tr>`;
  }).join('');

  const firmaBox = (label,img,nombre,fecha) => `<div style="text-align:center;padding:6px 14px">${img?`<img src="${img}" style="height:44px;display:block;margin:0 auto 3px;border-bottom:1px solid #1a3a6b;width:80%">`:`<div style="height:44px;border-bottom:1px solid #1a3a6b;margin:0 16px"></div>`}<div style="font-size:9px;font-weight:700;color:#1a3a6b">${label}</div>${nombre?`<div style="font-size:9px;color:#374151">${nombre}</div>`:''}${fecha?`<div style="font-size:8px;color:#6b7280">${fecha}</div>`:''}</div>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Remisión Satélite → Tintorería</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif}@media print{body{print-color-adjust:exact}}</style></head><body>
  <div style="max-width:900px;margin:10px auto;border:1.5px solid #1a3a6b">
    <div style="border-bottom:2px solid #1a3a6b;padding:8px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div style="width:72px;height:56px;border:1.5px dashed #9ca3af;border-radius:4px;display:flex;align-items:center;justify-content:center"><span style="font-size:8px;color:#9ca3af;text-align:center">Logo</span></div>
      <div style="text-align:center;flex:1"><div style="font-size:17px;font-weight:900;color:#1a3a6b">Dotaciones <span style="color:#e85d26">EL ROHI</span></div><div style="font-size:9px;color:#1a3a6b">NIT. 901.080.234-7 · Calle 39 A Sur No. 5-63 Este La Victoria · Cel.: 313 372 5739</div></div>
      <div style="border:2px solid #1a3a6b;padding:4px 10px;text-align:center"><div style="font-size:9px;font-weight:700;color:#1a3a6b">ENTREGA A</div><div style="font-size:12px;font-weight:900;color:#4338ca">TINTORERÍA</div></div>
    </div>
    <div style="display:flex;border-bottom:1px solid #1a3a6b;flex-wrap:wrap">
      <div style="border-right:1px solid #1a3a6b;padding:4px 10px;display:flex;align-items:center;gap:6px"><span style="font-size:8px;font-weight:700;color:#1a3a6b">FECHA</span><span style="font-size:12px;font-weight:700;color:#1a3a6b;font-family:monospace">${todayFmt()}</span></div>
      <div style="flex:1;padding:6px 14px;display:flex;align-items:center;gap:8px"><span style="font-size:10px;font-weight:700;color:#1a3a6b">Satélite:</span><span style="font-size:13px;font-weight:700;color:#1a3a6b">${satName}</span></div>
      <div style="padding:6px 14px;border-left:1px solid #1a3a6b;display:flex;align-items:center;gap:6px"><span style="font-size:10px;font-weight:700;color:#1a3a6b">Lote:</span><span style="font-size:11px;font-weight:700;color:#e85d26;font-family:monospace">${lot.code}</span></div>
      <div style="padding:6px 14px;border-left:1px solid #1a3a6b;display:flex;align-items:center;gap:6px"><span style="font-size:10px;font-weight:700;color:#1a3a6b">Entrega a:</span><span style="font-size:11px;font-weight:700;color:#4338ca">${tintoNombre||'Tintorería'}</span></div>
    </div>
    <div style="background:#1a3a6b;color:#fff;font-size:9px;font-weight:700;letter-spacing:0.12em;padding:3px 8px">PRENDAS ENTREGADAS</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed"><thead><tr>
      <th style="width:100px;border:1px solid #1a3a6b;padding:3px 6px;background:#e8eef7;font-size:9px;font-weight:700;color:#1a3a6b;text-align:left">Referencia</th>
      ${SIZES_REF.map(s=>`<th style="width:${s.includes('/')?'32':'27'}px;border:1px solid #1a3a6b;padding:3px 1px;background:#e8eef7;font-size:7px;font-weight:700;color:#1a3a6b;text-align:center">${s}</th>`).join('')}
      <th style="width:50px;border:1px solid #1a3a6b;padding:3px 2px;background:#dce6f5;font-size:9px;font-weight:700;color:#1a3a6b;text-align:center">TOTAL</th>
    </tr></thead><tbody>${garmentRows}</tbody></table>
    ${remData.nota ? `<div style="border-top:1px solid #1a3a6b;padding:7px 12px;display:flex;align-items:center;gap:6px"><span style="font-size:10px;font-weight:700;color:#1a3a6b">NOTA:</span><span style="font-size:11px">${remData.nota}</span></div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #1a3a6b">
      ${firmaBox('Entregado por (Satélite)',remData.firmaSat,remData.nombreSat,remData.fechaSat)}
      <div style="border-left:1px solid #1a3a6b">${firmaBox('Recibido por (Tintorería)',remData.firmaTinto,remData.nombreTinto,remData.fechaTinto)}</div>
    </div>
  </div>
  <script>window.onload=()=>window.print();</script></body></html>`;
  const win=window.open('','_blank'); win.document.write(html); win.document.close();
}

// ─── TALLER SCREEN ─────────────────────────────────────────────────────────────
export default function TallerScreen() {
  const { profile } = useAuth();
  const { lots, users, satellites } = useData();
  const [tab, setTab] = useState('activos');
  const [showEnvio, setShowEnvio] = useState(null);

  const sat = satellites.find(s => s.id === profile?.satId);
  const myWorkers = users.filter(u => u.satId === profile?.satId && u.role === 'operario');
  const myLots = lots.filter(l => l.satId === profile?.satId && ['costura','tintoreria'].includes(l.status));
  const activeLots = myLots.filter(l => l.status === 'costura');
  const readyLots  = myLots.filter(l => {
    if (l.status !== 'costura') return false;
    const ops = l.lotOps || [];
    if (ops.length === 0) return false;
    return ops.every(o => o.status === 'completado');
  });

  // Stats
  const totalPieces = activeLots.reduce((a,l) => a + (l.totalPieces||0), 0);
  const totalEarnings = activeLots.reduce((a,l) => {
    const done = (l.lotOps||[]).filter(o=>o.status==='completado').reduce((s,o)=>s+o.qty,0);
    return a + done * 100; // simplified
  }, 0);

  return (
    <div>
      {/* Header taller */}
      <div className="flex items-center gap-3 mb-5 bg-white rounded-xl border border-gray-100 p-4">
        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl flex-shrink-0">🏭</div>
        <div className="flex-1">
          <p className="font-bold text-gray-900">{sat?.name || 'Mi Taller'}</p>
          <p className="text-xs text-gray-400">{myWorkers.length} operarios · {sat?.city}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          ['Lotes activos', activeLots.length, '#2563eb'],
          ['Operarios', myWorkers.length, '#7c3aed'],
          ['Piezas en curso', totalPieces.toLocaleString('es-CO'), '#059669'],
        ].map(([l,v,c]) => (
          <div key={l} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-2xl font-black" style={{color:c}}>{v}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{l}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[['activos',`Lotes Activos (${activeLots.length})`],['listos',`Listos p/Tintorería (${readyLots.length})`],['operarios','Operarios']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:tab===k?'#fff':'transparent',color:tab===k?'#111827':'#6b7280',fontWeight:tab===k?700:400,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {/* LOTES ACTIVOS */}
      {tab === 'activos' && (
        <div className="space-y-3">
          {activeLots.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-4xl mb-3">🏭</p>
              <p className="font-medium text-gray-700">Sin lotes asignados</p>
              <p className="text-sm text-gray-400 mt-1">Espera a que el Admin ELROHI asigne un lote</p>
            </div>
          )}
          {activeLots.map(lot => {
            const ops = lot.lotOps || [];
            const done = ops.filter(o=>o.status==='completado').length;
            const prog = ops.length > 0 ? Math.round(done/ops.length*100) : 0;
            const inTimeline = lot.timeline?.find(t => t.status === 'costura' && !t.salió);
            const tiempoEnSat = inTimeline ? durationSince(inTimeline.entró) : null;

            return (
              <div key={lot.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                      {lot.corteNumero && <span className="text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">Corte #{lot.corteNumero}</span>}
                      <span className="text-[9px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-bold">En Costura</span>
                      {tiempoEnSat && <span className="text-[9px] text-gray-400">⏱ {tiempoEnSat} en satélite</span>}
                    </div>
                    <p className="text-xs text-gray-500">{lot.totalPieces?.toLocaleString('es-CO')} piezas · Vence: {lot.deadline}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black" style={{color:prog===100?'#15803d':'#7c3aed'}}>{prog}%</p>
                    <p className="text-[9px] text-gray-400">{done}/{ops.length} ops</p>
                  </div>
                </div>

                {/* Barra progreso */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div className="h-full rounded-full transition-all" style={{width:`${prog}%`,background:prog===100?'#10b981':'#7c3aed'}} />
                </div>

                {/* Operaciones con tiempo */}
                {ops.length > 0 && (
                  <div className="space-y-1">
                    {ops.map((op,i) => {
                      const worker = users.find(u=>u.id===op.wId);
                      const tiempoOp = op.startedAt && !op.doneAt ? durationSince(op.startedAt) : op.doneAt && op.startedAt ? fmtDuration(new Date(op.doneAt)-new Date(op.startedAt)) : null;
                      return (
                        <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs" style={{background:op.status==='completado'?'#f0fdf4':op.status==='en_proceso'?'#eff6ff':'#f9f9f7'}}>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${op.status==='completado'?'bg-green-500':op.status==='en_proceso'?'bg-blue-500':'bg-gray-300'}`} />
                          <span className="flex-1 font-medium text-gray-700">{op.opId}</span>
                          {worker && <span className="text-gray-500">{worker.name}</span>}
                          {tiempoOp && <span className="text-[10px] text-gray-400 italic">⏱ {tiempoOp}</span>}
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${op.status==='completado'?'bg-green-100 text-green-700':op.status==='en_proceso'?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-500'}`}>
                            {op.status==='completado'?'✓ Listo':op.status==='en_proceso'?'⚡ Activa':'Pend.'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* LISTOS PARA TINTORERÍA */}
      {tab === 'listos' && (
        <div className="space-y-3">
          {readyLots.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-4xl mb-3">✅</p>
              <p className="font-medium text-gray-700">Sin lotes listos aún</p>
              <p className="text-sm text-gray-400 mt-1">Cuando todas las operaciones estén al 100% aparecerán aquí</p>
            </div>
          )}
          {readyLots.map(lot => (
            <div key={lot.id} className="bg-white rounded-xl border-2 border-green-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                    {lot.corteNumero && <span className="text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">Corte #{lot.corteNumero}</span>}
                    <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✓ 100% Completado</span>
                  </div>
                  <p className="text-xs text-gray-500">{lot.totalPieces?.toLocaleString('es-CO')} piezas · Vence: {lot.deadline}</p>
                </div>
                <button onClick={() => setShowEnvio(lot)}
                  className="text-xs font-bold px-4 py-2 rounded-lg text-white"
                  style={{background:'#4338ca'}}>
                  🎨 Enviar a Tintorería
                </button>
              </div>
            </div>
          ))}

          {/* Todos los lotes con progreso parcial también visibles */}
          {activeLots.filter(l => !readyLots.find(r=>r.id===l.id)).map(lot => {
            const ops = lot.lotOps || [];
            const prog = ops.length > 0 ? Math.round(ops.filter(o=>o.status==='completado').length/ops.length*100) : 0;
            return (
              <div key={lot.id} className="bg-white rounded-xl border border-gray-100 p-3 opacity-60">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                    <p className="text-[10px] text-gray-400">En progreso: {prog}% · Aún no listo para tintorería</p>
                  </div>
                  <span className="text-[10px] text-gray-400">{prog}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-purple-400 rounded-full" style={{width:`${prog}%`}} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* OPERARIOS */}
      {tab === 'operarios' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {myWorkers.length === 0 && (
            <div className="col-span-2 flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-4xl mb-3">👥</p>
              <p className="font-medium text-gray-700">Sin operarios registrados</p>
            </div>
          )}
          {myWorkers.map(w => {
            const myOps = activeLots.flatMap(l => (l.lotOps||[]).filter(o=>o.wId===w.id));
            const doneOps = myOps.filter(o=>o.status==='completado');
            const activeOps = myOps.filter(o=>o.status==='en_proceso');
            return (
              <div key={w.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 flex-shrink-0">
                    {w.initials||w.name?.slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{w.name}</p>
                    <p className="text-[10px] text-gray-400">{activeOps.length} activas · {doneOps.length} listas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-gray-400">Ganado</p>
                    <p className="text-sm font-black text-green-600">{fmtM(doneOps.reduce((a,o)=>a+o.qty*100,0))}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL ENVÍO A TINTORERÍA */}
      {showEnvio && <EnvioTintoreriaModal lot={showEnvio} satName={sat?.name||'Satélite'} profile={profile} onClose={()=>setShowEnvio(null)} />}
    </div>
  );
}

// ─── MODAL ENVÍO A TINTORERÍA ──────────────────────────────────────────────────
function EnvioTintoreriaModal({ lot, satName, profile, onClose }) {
  const [tintoNombre, setTintoNombre] = useState('');
  const [nota,        setNota]        = useState('');
  const [firmaSat,    setFirmaSat]    = useState(null);
  const [nombreSat,   setNombreSat]   = useState(profile?.name||'');
  const [saving,      setSaving]      = useState(false);

  const enviar = async () => {
    if (!firmaSat)    { toast.error('Dibuja y guarda tu firma'); return; }
    if (!nombreSat)   { toast.error('Escribe tu nombre'); return; }
    setSaving(true);
    try {
      const remData = {
        lotId: lot.id, lotCode: lot.code,
        satId: profile?.satId, satName,
        tintoNombre, nota,
        firmaSat, nombreSat, fechaSat: nowStr(),
        firmaTinto: null, nombreTinto: null, fechaTinto: null,
        status: 'enviado',
      };
      await addDocument('remisionesTinto', remData);
      await advanceLotStatus(lot.id, 'tintoreria', profile?.id, profile?.name);
      printRemisionTinto(lot, satName, tintoNombre, remData);
      toast.success('✅ Lote enviado a Tintorería y remisión generada');
      onClose();
    } catch(e) { console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:500,maxHeight:'90vh',overflowY:'auto'}}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900">Enviar a Tintorería</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
        </div>

        {/* Resumen lote */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
            {lot.corteNumero && <span className="text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">Corte #{lot.corteNumero}</span>}
          </div>
          <p className="text-xs text-indigo-700">{lot.totalPieces?.toLocaleString('es-CO')} piezas · Todas las operaciones completadas ✓</p>
          <div className="mt-2 space-y-0.5">
            {lot.garments?.map((g,i) => (
              <p key={i} className="text-[10px] text-indigo-600">{gLabel(g.gtId)}: <strong>{g.total?.toLocaleString('es-CO')}</strong> pzs</p>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre del responsable en Tintorería</label>
          <input value={tintoNombre} onChange={e=>setTintoNombre(e.target.value)}
            placeholder="¿A quién le entregaste el lote?"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
        </div>

        <div className="mb-3">
          <label className="block text-xs font-semibold text-gray-700 mb-1">Nota (opcional)</label>
          <textarea value={nota} onChange={e=>setNota(e.target.value)} placeholder="Observaciones del lote..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-14 focus:outline-none focus:border-indigo-400" />
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tu firma — Satélite entrega</p>
            {firmaSat && <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded-full">✓ Guardada</span>}
          </div>
          <FirmaCanvas label="Dibuja tu firma:" onSave={setFirmaSat} />
          <input value={nombreSat} onChange={e=>setNombreSat(e.target.value)} placeholder="Tu nombre completo"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-2 focus:outline-none focus:border-indigo-400" />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
          <button onClick={enviar} disabled={saving}
            className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
            style={{background:'#4338ca'}}>
            {saving?'Enviando...':'🎨 Enviar y generar remisión'}
          </button>
        </div>
      </div>
    </div>
  );
}
