import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { addDocument, updateDocument } from '../services/db';
import { advanceLotStatus } from '../services/db_timeline';
import { durationSince, fmtDuration } from '../services/consecutivos';
import { ACCENT } from '../constants';
import { gLabel, fmtM } from '../utils';
import toast from 'react-hot-toast';

const SIZES_REF = ['XS/6','S/8','M/10','L/12','XL/14','XXL/16','28','30','32','34','36','38','40','42','44'];
const nowStr   = () => new Date().toLocaleString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const todayFmt = () => { const h=new Date(); return `${String(h.getDate()).padStart(2,'0')}/${String(h.getMonth()+1).padStart(2,'0')}/${String(h.getFullYear()).slice(-2)}`; };

function FirmaCanvas({ onSave, label }) {
  const ref = useRef(null); const drawing = useRef(false); const [has, setHas] = useState(false);
  const gp  = (e,c) => { const r=c.getBoundingClientRect(); const s=e.touches?e.touches[0]:e; return {x:s.clientX-r.left,y:s.clientY-r.top}; };
  const start=(e)=>{e.preventDefault();drawing.current=true;const c=ref.current;const ctx=c.getContext('2d');const p=gp(e,c);ctx.beginPath();ctx.moveTo(p.x,p.y);};
  const draw=(e)=>{e.preventDefault();if(!drawing.current)return;const c=ref.current;const ctx=c.getContext('2d');ctx.strokeStyle='#1a3a6b';ctx.lineWidth=2.5;ctx.lineCap='round';const p=gp(e,c);ctx.lineTo(p.x,p.y);ctx.stroke();setHas(true);};
  const stop=()=>{drawing.current=false;};
  const clear=()=>{ref.current.getContext('2d').clearRect(0,0,ref.current.width,ref.current.height);setHas(false);onSave(null);};
  const save=()=>{onSave(ref.current.toDataURL('image/png'));toast.success('Firma guardada');};
  return (
    <div style={{marginBottom:8}}>
      <p style={{fontSize:11,fontWeight:600,color:'#374151',marginBottom:4}}>{label}</p>
      <div style={{border:'1px solid #d1d5db',borderRadius:8,background:'#fff',overflow:'hidden'}}>
        <canvas ref={ref} width={1200} height={160} style={{display:'block',touchAction:'none',cursor:'crosshair',width:'100%'}}
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

function printRemisionTinto(lot, satName, remData) {
  const conteoRows = remData.conteo.map(g => {
    const faltante = g.original - g.enviado;
    return `<tr>
      <td style="border:1px solid #1a3a6b;padding:4px 8px;font-size:11px;font-weight:500;color:#1a3a6b">${gLabel(g.gtId)}</td>
      <td style="border:1px solid #1a3a6b;padding:4px 8px;text-align:center;font-size:11px;font-weight:700;color:#1a3a6b;background:#dce6f5">${g.original}</td>
      <td style="border:1px solid #1a3a6b;padding:4px 8px;text-align:center;font-size:11px;font-weight:700;color:#15803d;background:#f0fdf4">${g.enviado}</td>
      <td style="border:1px solid #1a3a6b;padding:4px 8px;text-align:center;font-size:11px;font-weight:700;${faltante>0?'color:#dc2626;background:#fef2f2':'color:#15803d;background:#f0fdf4'}">${faltante>0?`-${faltante}`:'✓'}</td>
      <td style="border:1px solid #1a3a6b;padding:4px 8px;font-size:10px;color:#374151;font-style:italic">${g.novedad||''}</td>
    </tr>`;
  }).join('');
  const firmaBox = (label,img,nombre,fecha) => `<div style="padding:10px 16px;text-align:center">${img?`<img src="${img}" style="height:70px;display:block;margin:0 auto 5px;border-bottom:1.5px solid #1a3a6b;width:85%;object-fit:contain">`:`<div style="height:70px;border-bottom:1.5px solid #1a3a6b;margin:0 20px"></div>`}<div style="font-size:10px;font-weight:700;color:#1a3a6b;letter-spacing:0.08em;margin-top:5px">${label}</div>${nombre?`<div style="font-size:11px;color:#374151;margin-top:2px;font-weight:500">${nombre}</div>`:''}${fecha?`<div style="font-size:9px;color:#6b7280;margin-top:1px">${fecha}</div>`:''}</div>`;
  const hayFaltantes = remData.conteo.some(g => g.enviado < g.original);
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Remisión Tintorería</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif}@media print{body{print-color-adjust:exact}}</style></head><body>
  <div style="max-width:900px;margin:12px auto;border:1.5px solid #1a3a6b">
    <div style="border-bottom:2px solid #1a3a6b;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div style="width:76px;height:58px;border:1.5px dashed #9ca3af;border-radius:4px;display:flex;align-items:center;justify-content:center"><span style="font-size:8px;color:#9ca3af;text-align:center">Logo<br>cliente</span></div>
      <div style="text-align:center;flex:1"><div style="font-size:18px;font-weight:900;color:#1a3a6b">Dotaciones <span style="color:#e85d26">EL ROHI</span></div><div style="font-size:9px;color:#1a3a6b;margin-top:2px">NIT. 901.080.234-7 · Calle 39 A Sur No. 5-63 Este La Victoria · Cel.: 313 372 5739</div></div>
      <div style="border:2px solid #4338ca;padding:5px 12px;text-align:center;border-radius:4px"><div style="font-size:9px;font-weight:700;color:#4338ca;letter-spacing:0.1em">REMISIÓN</div><div style="font-size:11px;font-weight:900;color:#4338ca">TINTORERÍA</div></div>
    </div>
    <div style="display:flex;border-bottom:1px solid #1a3a6b;flex-wrap:wrap">
      <div style="border-right:1px solid #1a3a6b;padding:5px 12px;display:flex;align-items:center;gap:8px"><span style="font-size:9px;font-weight:700;color:#1a3a6b">FECHA</span><span style="font-size:12px;font-weight:700;color:#1a3a6b;font-family:monospace">${todayFmt()}</span></div>
      <div style="flex:1;padding:5px 14px;display:flex;align-items:center;gap:8px"><span style="font-size:10px;font-weight:700;color:#1a3a6b">Satélite:</span><span style="font-size:14px;font-weight:700;color:#1a3a6b">${satName}</span></div>
      <div style="padding:5px 14px;border-left:1px solid #1a3a6b;display:flex;align-items:center;gap:6px"><span style="font-size:10px;font-weight:700;color:#1a3a6b">Corte N°:</span><span style="font-size:13px;font-weight:900;color:#e85d26;font-family:monospace">${lot.code}</span></div>
      <div style="padding:5px 14px;border-left:1px solid #1a3a6b;display:flex;align-items:center;gap:6px"><span style="font-size:10px;font-weight:700;color:#1a3a6b">Recibe:</span><span style="font-size:12px;font-weight:700;color:#4338ca">${remData.nombreTinto||'___'}</span></div>
    </div>
    <div style="background:#1a3a6b;color:#fff;font-size:9px;font-weight:700;letter-spacing:0.12em;padding:4px 10px">CONTEO DE PRENDAS</div>
    <table style="width:100%;border-collapse:collapse"><thead><tr style="background:#e8eef7">
      <th style="border:1px solid #1a3a6b;padding:5px 10px;font-size:10px;font-weight:700;color:#1a3a6b;text-align:left">Referencia</th>
      <th style="border:1px solid #1a3a6b;padding:5px 8px;font-size:10px;font-weight:700;color:#1a3a6b;text-align:center;background:#dce6f5">Originales</th>
      <th style="border:1px solid #1a3a6b;padding:5px 8px;font-size:10px;font-weight:700;color:#15803d;text-align:center;background:#f0fdf4">Enviadas</th>
      <th style="border:1px solid #1a3a6b;padding:5px 8px;font-size:10px;font-weight:700;color:#374151;text-align:center">Diferencia</th>
      <th style="border:1px solid #1a3a6b;padding:5px 8px;font-size:9px;font-weight:700;color:#4a3a6b;text-align:center;font-style:italic;background:#f5f0fa">Novedad</th>
    </tr></thead><tbody>${conteoRows}</tbody></table>
    <div style="border-top:1px solid #1a3a6b;padding:8px 14px;background:${hayFaltantes?'#fef9c3':'#f0fdf4'}">
      <span style="font-size:10px;font-weight:700;color:${hayFaltantes?'#92400e':'#15803d'}">${hayFaltantes?'⚠ ENVÍO PARCIAL — Hay prendas faltantes':'✓ ENVÍO COMPLETO'}</span>
    </div>
    ${remData.nota?`<div style="border-top:1px solid #1a3a6b;padding:7px 14px;display:flex;gap:8px"><span style="font-size:10px;font-weight:700;color:#1a3a6b">NOTA:</span><span style="font-size:11px">${remData.nota}</span></div>`:''}
    <div style="background:#1a3a6b;color:#fff;font-size:9px;font-weight:700;letter-spacing:0.12em;padding:4px 10px">FIRMAS</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:0.5px solid #1a3a6b">
      ${firmaBox('Entregado por — Admin Satélite',remData.firmaSat,remData.nombreSat,remData.fechaSat)}
      <div style="border-left:1px solid #1a3a6b">${firmaBox('Recibido por — Tintorería',remData.firmaTinto,remData.nombreTinto,remData.fechaTinto)}</div>
    </div>
  </div>
  <script>window.onload=()=>window.print();</script></body></html>`;
  const win=window.open('','_blank'); win.document.write(html); win.document.close();
}

export default function TallerScreen() {
  const { profile }             = useAuth();
  const { lots, users, satellites } = useData();
  const [tab, setTab]           = useState('activos');
  const [showRemision, setShowRemision] = useState(null);

  const sat       = satellites.find(s => s.id === profile?.satId);
  const myWorkers = users.filter(u => u.satId === profile?.satId && u.role === 'operario');
  const myLots    = lots.filter(l => l.satId === profile?.satId);
  const activeLots = myLots.filter(l => l.status === 'costura');
  const listoLots  = myLots.filter(l => l.status === 'listo_remision_tintoreria');
  const totalPieces = activeLots.reduce((a,l) => a+(l.totalPieces||0), 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 bg-white rounded-xl border border-gray-100 p-4">
        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl flex-shrink-0">🏭</div>
        <div className="flex-1">
          <p className="font-bold text-gray-900">{sat?.name || 'Mi Taller'}</p>
          <p className="text-xs text-gray-400">{myWorkers.length} operarios · {sat?.city}</p>
        </div>
        {listoLots.length > 0 && (
          <span className="text-xs font-bold bg-green-100 text-green-700 px-3 py-1.5 rounded-full">
            ✓ {listoLots.length} listo{listoLots.length>1?'s':''} para remisión
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[['Cortes activos',activeLots.length,'#2563eb'],['Operarios',myWorkers.length,'#7c3aed'],['Piezas en curso',totalPieces.toLocaleString('es-CO'),'#059669']].map(([l,v,c])=>(
          <div key={l} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-2xl font-black" style={{color:c}}>{v}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{l}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        {[['activos',`En Costura (${activeLots.length})`],['listos',`Listos p/Tintorería (${listoLots.length})`],['operarios','Operarios']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:tab===k?'#fff':'transparent',color:tab===k?'#111827':'#6b7280',fontWeight:tab===k?700:400,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {tab==='activos' && (
        <div className="space-y-3">
          {activeLots.length===0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-4xl mb-3">🏭</p>
              <p className="font-medium text-gray-700">Sin cortes en costura</p>
              <p className="text-sm text-gray-400 mt-1">Espera a que el Admin ELROHI asigne un corte</p>
            </div>
          )}
          {activeLots.map(lot => {
            const ops  = lot.lotOps || [];
            const done = ops.filter(o=>o.status==='completado').length;
            const prog = ops.length > 0 ? Math.round(done/ops.length*100) : 0;
            const inTimeline = lot.timeline?.find(t=>t.status==='costura'&&!t.salió);
            const tiempoSat  = inTimeline ? durationSince(inTimeline.entró) : null;
            return (
              <div key={lot.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                      <span className="text-[9px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-bold">En Costura</span>
                      {tiempoSat && <span className="text-[9px] text-gray-400">⏱ {tiempoSat} en taller</span>}
                    </div>
                    <p className="text-xs text-gray-500">{lot.totalPieces?.toLocaleString('es-CO')} piezas · Vence: {lot.deadline}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-black" style={{color:prog===100?'#15803d':'#7c3aed'}}>{prog}%</p>
                    <p className="text-[9px] text-gray-400">{done}/{ops.length} ops</p>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div className="h-full rounded-full transition-all" style={{width:`${prog}%`,background:prog===100?'#10b981':'#7c3aed'}} />
                </div>
                {ops.length > 0 && (
                  <div className="space-y-1">
                    {ops.map((op,i)=>{
                      const worker = users.find(u=>u.id===op.wId);
                      return (
                        <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs"
                          style={{background:op.status==='completado'?'#f0fdf4':op.status==='en_proceso'?'#eff6ff':'#f9f9f7'}}>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${op.status==='completado'?'bg-green-500':op.status==='en_proceso'?'bg-blue-500':'bg-gray-300'}`} />
                          <span className="flex-1 font-medium text-gray-700">{op.name||op.opId}</span>
                          {worker && <span className="text-gray-500">{worker.name}</span>}
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

      {tab==='listos' && (
        <div className="space-y-3">
          {listoLots.length===0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-4xl mb-3">✅</p>
              <p className="font-medium text-gray-700">Sin cortes listos aún</p>
              <p className="text-sm text-gray-400 mt-1">Cuando todas las operaciones estén al 100% aparecerán aquí</p>
            </div>
          )}
          {listoLots.map(lot=>(
            <div key={lot.id} className="bg-white rounded-xl border-2 border-green-200 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                    <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✓ Ops completadas</span>
                  </div>
                  <p className="text-xs text-gray-500">{lot.totalPieces?.toLocaleString('es-CO')} piezas · Vence: {lot.deadline}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {lot.garments?.map((g,i)=>(
                      <span key={i} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {gLabel(g.gtId)}: {g.total}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={()=>setShowRemision(lot)}
                  className="text-xs font-bold px-4 py-2 rounded-lg text-white flex-shrink-0"
                  style={{background:'#4338ca'}}>
                  🎨 Hacer Remisión a Tintorería
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='operarios' && <OperariosTab satId={profile?.satId} workers={myWorkers} />}

      {showRemision && (
        <RemisionTintoreriaModal
          lot={showRemision}
          satName={sat?.name||'Satélite'}
          profile={profile}
          onClose={()=>setShowRemision(null)}
        />
      )}
    </div>
  );
}

// ─── OPERARIOS TAB ────────────────────────────────────────────────────────────
function OperariosTab({ satId, workers }) {
  const [showNew, setShowNew] = useState(false);
  const [form,    setForm]    = useState({ nombre:'', apellido:'', cedula:'', telefono:'' });
  const [saving,  setSaving]  = useState(false);

  const crear = async () => {
    if (!form.nombre || !form.cedula) { toast.error('Nombre y cédula son obligatorios'); return; }
    setSaving(true);
    try {
      await addDocument('users', {
        nombre:   form.nombre.trim(),
        apellido: form.apellido.trim(),
        name:     `${form.nombre.trim()} ${form.apellido.trim()}`,
        initials: `${form.nombre.trim()[0]}${form.apellido.trim()[0]}`.toUpperCase(),
        cedula:   form.cedula.trim(),
        telefono: form.telefono.trim(),
        role:     'operario',
        satId,
        active:   true,
      });
      toast.success('✅ Operario creado');
      setShowNew(false);
      setForm({ nombre:'', apellido:'', cedula:'', telefono:'' });
    } catch(e) { console.error(e); toast.error('Error al crear'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mis Operarios ({workers.length})</p>
        <button onClick={() => setShowNew(!showNew)}
          className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
          style={{ background: ACCENT }}>
          + Nuevo Operario
        </button>
      </div>

      {showNew && (
        <div className="bg-white rounded-xl border border-orange-200 p-4 mb-4">
          <p className="text-xs font-bold text-gray-700 mb-3">Nuevo operario para este taller</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre *</label>
              <input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}
                placeholder="Carlos"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Apellido</label>
              <input value={form.apellido} onChange={e=>setForm(f=>({...f,apellido:e.target.value}))}
                placeholder="Rodríguez"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Cédula *</label>
              <input value={form.cedula} onChange={e=>setForm(f=>({...f,cedula:e.target.value}))}
                placeholder="1.234.567.890"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Teléfono</label>
              <input value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))}
                placeholder="310-555-0000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowNew(false)}
              className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
            <button onClick={crear} disabled={saving}
              className="flex-1 py-2 text-white rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: ACCENT }}>
              {saving ? 'Guardando...' : 'Crear Operario'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {workers.length === 0 && !showNew && (
          <div className="col-span-2 flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-gray-100">
            <p className="text-4xl mb-3">👥</p>
            <p className="font-medium text-gray-700">Sin operarios registrados</p>
            <p className="text-sm text-gray-400 mt-1">Usa el botón de arriba para agregar</p>
          </div>
        )}
        {workers.map(w => (
          <div key={w.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 flex-shrink-0">
                {w.initials||w.name?.slice(0,2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{w.name}</p>
                {w.cedula   && <p className="text-[10px] text-gray-400 font-mono">CC: {w.cedula}</p>}
                {w.telefono && <p className="text-[10px] text-gray-400">{w.telefono}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MODAL REMISIÓN A TINTORERÍA ──────────────────────────────────────────────
function RemisionTintoreriaModal({ lot, satName, profile, onClose }) {
  const [conteo,      setConteo]      = useState((lot.garments||[]).map(g=>({gtId:g.gtId,original:g.total,enviado:g.total,novedad:''})));
  const [nota,        setNota]        = useState('');
  const [nombreSat,   setNombreSat]   = useState(profile?.name||'');
  const [firmaSat,    setFirmaSat]    = useState(null);
  const [nombreTinto, setNombreTinto] = useState('');
  const [firmaTinto,  setFirmaTinto]  = useState(null);
  const [saving,      setSaving]      = useState(false);

  const updConteo = (i,k,v) => setConteo(c=>{const n=[...c];n[i]={...n[i],[k]:v};return n;});
  const hayFaltantes = conteo.some(g => (+g.enviado||0) < g.original);
  const esCompleto   = conteo.every(g => (+g.enviado||0) >= g.original);

  const enviar = async () => {
    if (!firmaSat)    { toast.error('El Admin Satélite debe firmar'); return; }
    if (!nombreSat)   { toast.error('Escribe el nombre del Admin Satélite'); return; }
    if (!firmaTinto)  { toast.error('El responsable de Tintorería debe firmar'); return; }
    if (!nombreTinto) { toast.error('Escribe el nombre del responsable de Tintorería'); return; }
    setSaving(true);
    try {
      const remData = {
        lotId: lot.id, lotCode: lot.code,
        satId: profile?.satId, satName,
        conteo: conteo.map(g=>({...g,enviado:+g.enviado||0})),
        esCompleto, hayFaltantes, nota,
        nombreSat, firmaSat, fechaSat: nowStr(),
        nombreTinto, firmaTinto, fechaTinto: nowStr(),
        status: 'completado',
      };
      await addDocument('remisionesTinto', remData);
      await advanceLotStatus(lot.id, 'tintoreria', profile?.id, profile?.name, { remisionTinto: remData });
      printRemisionTinto(lot, satName, remData);
      toast.success('✅ Remisión generada — lote en tintorería');
      onClose();
    } catch(e) { console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'16px',overflowY:'auto'}}>
      <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:560,marginTop:16,marginBottom:16}}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900">Remisión a Tintorería</h2>
          <button onClick={onClose} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
            <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✓ Ops completadas</span>
          </div>
          <p className="text-xs text-indigo-700">Satélite: <strong>{satName}</strong> · {lot.totalPieces?.toLocaleString('es-CO')} piezas</p>
        </div>

        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Conteo de prendas</p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3 text-xs text-amber-700">
          💡 Por defecto se envía todo completo. Ajusta si hay faltantes.
        </div>
        <div className="space-y-2 mb-4">
          {conteo.map((g,i)=>{
            const faltante = g.original - (+g.enviado||0);
            return (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-3">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-bold text-gray-800 flex-1">{gLabel(g.gtId)}</span>
                  <span className="text-xs text-gray-500">Original: <strong>{g.original}</strong></span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-600">Enviar:</span>
                    <input type="number" min={0} max={g.original} value={g.enviado}
                      onChange={e=>updConteo(i,'enviado',e.target.value)}
                      className="w-16 text-center border border-gray-200 rounded-lg px-2 py-1 text-sm font-bold focus:outline-none"
                      style={{color:faltante>0?'#dc2626':'#15803d'}} />
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${faltante===0?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
                    {faltante===0?'✓ Completo':`-${faltante}`}
                  </span>
                </div>
                {faltante>0 && (
                  <input type="text" value={g.novedad} onChange={e=>updConteo(i,'novedad',e.target.value)}
                    placeholder="Novedad: ¿por qué faltan?"
                    className="w-full border border-amber-200 rounded-lg px-3 py-1.5 text-xs bg-amber-50 focus:outline-none" />
                )}
              </div>
            );
          })}
        </div>

        <div className={`p-3 rounded-xl text-xs font-bold mb-4 ${esCompleto?'bg-green-50 text-green-700 border border-green-200':'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          {esCompleto ? '✓ ENVÍO COMPLETO' : '⚠ ENVÍO PARCIAL — hay faltantes'}
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1">Nota (opcional)</label>
          <textarea value={nota} onChange={e=>setNota(e.target.value)} placeholder="Observaciones..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-14 focus:outline-none" />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-blue-800">Firma — Admin Satélite (Entrega)</p>
            {firmaSat && <span className="text-[10px] text-green-600 font-bold">✓ Firmado</span>}
          </div>
          <FirmaCanvas label="Dibuja tu firma:" onSave={setFirmaSat} />
          <input value={nombreSat} onChange={e=>setNombreSat(e.target.value)} placeholder="Tu nombre completo"
            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white mt-2" />
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-indigo-800">Firma — Tintorería (Recibe)</p>
            {firmaTinto && <span className="text-[10px] text-green-600 font-bold">✓ Firmado</span>}
          </div>
          <FirmaCanvas label="Firma del responsable de Tintorería:" onSave={setFirmaTinto} />
          <input value={nombreTinto} onChange={e=>setNombreTinto(e.target.value)} placeholder="Nombre del responsable en Tintorería"
            className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white mt-2" />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
          <button onClick={enviar} disabled={saving}
            className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
            style={{background:'#4338ca'}}>
            {saving?'Generando...':'🎨 Confirmar y generar remisión'}
          </button>
        </div>
      </div>
    </div>
  );
}
