import { useState, useEffect } from 'react';
import { useAuth }   from '../contexts/AuthContext';
import { useData }   from '../contexts/DataContext';
import { updateDocument, listenCol } from '../services/db';
import { ACCENT }    from '../constants';
import { fmtM }      from '../utils';
import { orderBy }   from 'firebase/firestore';
import toast         from 'react-hot-toast';

const genOpId = () => 'oe_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);

const CATEGORIAS = [
  { key:'camisa',   label:'👔 Camisa'   },
  { key:'pantalon', label:'👖 Pantalón' },
  { key:'fusion',   label:'🔥 Fusión'   },
  { key:'corte',    label:'✂️ Corte'    },
];

export default function OperacionesElrohiScreen() {
  const { profile }          = useAuth();
  const { lots, users }      = useData();
  const [catalogo,  setCatalogo]  = useState([]);
  const [selLotId,  setSelLotId]  = useState(null);
  const [showAddOp, setShowAddOp] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [catFilter, setCatFilter] = useState('todos');
  const [mainTab,   setMainTab]   = useState('lotes');
  const [editOp,    setEditOp]    = useState(null);
  const [editVal,   setEditVal]   = useState('');

  // Formulario nueva operación
  const [selCat,    setSelCat]    = useState('camisa');
  const [selRef,    setSelRef]    = useState('');
  const [selOp,     setSelOp]     = useState('');
  const [qty,       setQty]       = useState('');

  useEffect(()=>{
    const unsub = listenCol('operacionesElrohi', setCatalogo, orderBy('categoria','asc'));
    return unsub;
  },[]);

  const isAdmin    = ['gerente','admin_elrohi'].includes(profile?.role);
  const isOperario = ['terminacion','bodega_op','corte'].includes(profile?.role);

  // Operarios ELROHI internos
  const operariosElrohi = users.filter(u =>
    ['terminacion','bodega_op','corte'].includes(u.role) && u.active !== false
  );

  // Lotes en operaciones ELROHI
  const opLots = lots.filter(l =>
    ['en_operaciones_elrohi','bodega_calidad','en_revision_calidad'].includes(l.status)
  );

  const selLot = lots.find(l => l.id === selLotId);

  // Catálogo filtrado por categoría
  const refs = [...new Set(catalogo.filter(o=>o.categoria===selCat).map(o=>o.referencia))];
  const opsDeRef = catalogo.filter(o=>o.categoria===selCat && o.referencia===selRef);
  const opSelData = opsDeRef.find(o=>o.operacion===selOp);

  // Valor calculado
  const valorTotal = opSelData ? (opSelData.valorUnitario * (+qty||0)) : 0;

  const resetForm = () => { setSelCat('camisa'); setSelRef(''); setSelOp(''); setQty(''); };

  // ── AGREGAR OPERACIÓN AL LOTE ──────────────────────────────────────────────
  const agregarOp = async (operarioId) => {
    if (!selRef||!selOp||!qty) { toast.error('Completa todos los campos'); return; }
    if (!opSelData)             { toast.error('Operación no encontrada'); return; }
    setSaving(true);
    try {
      const operario = users.find(u=>u.id===operarioId);
      const newOp = {
        id:            genOpId(),
        categoria:     selCat,
        referencia:    selRef,
        operacion:     selOp,
        valorUnitario: opSelData.valorUnitario,
        valorDesc:     opSelData.valorDesc||'',
        metaLV:        opSelData.metaLV||0,
        metaSab:       opSelData.metaSab||0,
        qty:           +qty,
        vrTotal:       valorTotal,
        wId:           operarioId,
        workerName:    operario?.name||'',
        status:        'pendiente',
        startedAt:     null,
        doneAt:        null,
      };
      const opsElrohi = [...(selLot.opsElrohi||[]), newOp];
      await updateDocument('lots', selLot.id, { opsElrohi });
      toast.success('✅ Operación asignada');
      setShowAddOp(false);
      resetForm();
    } catch(e){ console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  // ── VISTA OPERARIO ─────────────────────────────────────────────────────────
  if (isOperario && !isAdmin) {
    const misLots = lots.filter(l =>
      ['en_operaciones_elrohi','bodega_calidad'].includes(l.status)
    );
    const misOps = misLots.flatMap(l =>
      (l.opsElrohi||[])
        .filter(op=>op.wId===profile?.id)
        .map(op=>({...op, lotId:l.id, lotCode:l.code}))
    );

    const iniciar = async (lotId, opId) => {
      const lot = lots.find(l=>l.id===lotId);
      if (!lot) return;
      const upd = (lot.opsElrohi||[]).map(op=>
        op.id===opId ? {...op, status:'en_proceso', startedAt:new Date().toISOString()} : op
      );
      await updateDocument('lots', lotId, {opsElrohi:upd});
      toast.success('¡Operación iniciada!');
    };

    const terminar = async (lotId, opId) => {
      const lot = lots.find(l=>l.id===lotId);
      if (!lot) return;
      const upd = (lot.opsElrohi||[]).map(op=>
        op.id===opId ? {...op, status:'completado', doneAt:new Date().toISOString()} : op
      );
      const allDone = upd.every(op=>op.status==='completado');
      await updateDocument('lots', lotId, {
        opsElrohi: upd,
        ...(allDone ? {status:'en_revision_calidad'} : {}),
      });
      toast.success(allDone?'✅ ¡Todas las operaciones completadas!':'✅ ¡Operación completada!');
    };

    return (
      <div>
        <h1 className="text-sm font-bold text-gray-900 mb-1">Mis Operaciones</h1>
        <p className="text-xs text-gray-400 mb-4">{misOps.length} operaciones asignadas</p>

        {misOps.length===0 && (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
            <p className="text-3xl mb-2">⚡</p>
            <p className="font-medium text-gray-700">Sin operaciones asignadas</p>
          </div>
        )}

        <div className="space-y-3">
          {misOps.map((op,i)=>(
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-blue-700">{op.lotCode}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                      op.status==='completado'?'bg-green-100 text-green-700':
                      op.status==='en_proceso' ?'bg-blue-100 text-blue-700':
                      'bg-gray-100 text-gray-600'}`}>
                      {op.status==='completado'?'✅ Completado':op.status==='en_proceso'?'🔄 En proceso':'⏳ Pendiente'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{op.referencia}</p>
                  <p className="text-xs text-gray-600">{op.operacion}</p>
                  {op.valorDesc && <p className="text-[10px] text-gray-400 italic">{op.valorDesc}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-500">{op.qty?.toLocaleString('es-CO')} pzas</p>
                  <p className="text-xs text-gray-500">× {fmtM(op.valorUnitario)}</p>
                  <p className="text-sm font-black text-green-700">{fmtM(op.vrTotal||op.qty*op.valorUnitario)}</p>
                </div>
              </div>

              {op.metaLV > 0 && (
                <p className="text-[10px] text-gray-400 mb-2">
                  Meta: {op.metaLV}/día Lun-Vie · {op.metaSab}/día Sáb
                </p>
              )}

              {op.status === 'pendiente' && (
                <button onClick={()=>iniciar(op.lotId, op.id)}
                  className="w-full py-2 text-white text-xs font-bold rounded-lg"
                  style={{background:'#2878B4'}}>
                  ▶ Iniciar
                </button>
              )}
              {op.status === 'en_proceso' && (
                <button onClick={()=>terminar(op.lotId, op.id)}
                  className="w-full py-2 text-white text-xs font-bold rounded-lg"
                  style={{background:'#15803d'}}>
                  ✓ Terminé
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── EDITAR VALOR OPERACIÓN ────────────────────────────────────────────────
  const guardarEdicion = async () => {
    if (!editOp || !editVal) return;
    setSaving(true);
    try {
      const { updateDocument: upd } = await import('../services/db');
      await upd('operacionesElrohi', editOp.id, { valorUnitario: +editVal||0 });
      toast.success('✅ Valor actualizado');
      setEditOp(null); setEditVal('');
    } catch { toast.error('Error'); }
    finally { setSaving(false); }
  };

  // ── VISTA ADMIN ────────────────────────────────────────────────────────────
  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-1">Operaciones ELROHI</h1>
      <p className="text-xs text-gray-400 mb-4">Catálogo de operaciones y asignación a lotes</p>

      {/* Main tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[['lotes','📦 Lotes en proceso'],['catalogo','⚙️ Catálogo de operaciones']].map(([k,l])=>(
          <button key={k} onClick={()=>setMainTab(k)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:mainTab===k?'#fff':'transparent',color:mainTab===k?'#111827':'#6b7280',
              fontWeight:mainTab===k?700:400,boxShadow:mainTab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {/* CATÁLOGO */}
      {mainTab==='catalogo' && (
        <div>
          {/* Filtro por categoría */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {[{key:'todos',label:'Todos'},...CATEGORIAS].map(c=>(
              <button key={c.key} onClick={()=>setCatFilter(c.key)}
                className="text-xs px-3 py-1.5 rounded-lg border-2 font-medium transition-all"
                style={{borderColor:catFilter===c.key?ACCENT:'#e5e7eb',background:catFilter===c.key?'#fff5f0':'#fff',color:catFilter===c.key?ACCENT:'#374151'}}>
                {c.label}
              </button>
            ))}
          </div>

          {/* Tabla por categoría */}
          {CATEGORIAS.filter(c=>catFilter==='todos'||catFilter===c.key).map(cat=>{
            const refs2 = [...new Set(catalogo.filter(o=>o.categoria===cat.key).map(o=>o.referencia))];
            if (!refs2.length) return null;
            return (
              <div key={cat.key} className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
                <div className="px-4 py-2.5 flex items-center gap-2" style={{background:'#14405A'}}>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">{cat.label}</span>
                  <span className="text-[10px] text-blue-200">{catalogo.filter(o=>o.categoria===cat.key).length} operaciones</span>
                </div>
                {refs2.map(ref=>{
                  const opsRef = catalogo.filter(o=>o.categoria===cat.key&&o.referencia===ref);
                  return (
                    <div key={ref} className="border-b border-gray-50 last:border-0">
                      <div className="px-4 py-2 bg-gray-50">
                        <p className="text-xs font-bold text-gray-700">{ref}</p>
                        {opsRef[0]?.metaLV > 0 && (
                          <p className="text-[10px] text-gray-400">Meta: {opsRef[0].metaLV}/día Lun-Vie · {opsRef[0].metaSab}/día Sáb</p>
                        )}
                      </div>
                      <div className="divide-y divide-gray-50">
                        {opsRef.map((op,i)=>(
                          <div key={i} className="flex items-center px-4 py-2 hover:bg-gray-50">
                            <span className="text-xs text-gray-600 flex-1">{op.operacion}</span>
                            {op.valorDesc && <span className="text-[10px] text-gray-400 mr-3 italic">{op.valorDesc}</span>}
                            {editOp?.id===op.id ? (
                              <div className="flex items-center gap-2">
                                <input type="number" value={editVal} onChange={e=>setEditVal(e.target.value)}
                                  className="w-24 border border-orange-300 rounded px-2 py-1 text-xs text-right focus:outline-none" />
                                <button onClick={guardarEdicion} disabled={saving}
                                  className="text-[10px] px-2 py-1 bg-green-100 text-green-700 rounded font-bold">✓</button>
                                <button onClick={()=>{setEditOp(null);setEditVal('');}}
                                  className="text-[10px] px-2 py-1 bg-gray-100 text-gray-600 rounded">✕</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-green-700">{fmtM(op.valorUnitario)}</span>
                                <button onClick={()=>{setEditOp(op);setEditVal(String(op.valorUnitario));}}
                                  className="text-[10px] px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">✏️</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* LOTES */}
      {mainTab==='lotes' && (
      <>
      {/* Lista de lotes */}
      {!selLotId && (
        <div className="space-y-3">
          {opLots.length===0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-3xl mb-2">⚡</p>
              <p className="font-medium text-gray-700">Sin lotes en operaciones internas</p>
              <p className="text-xs text-gray-400 mt-1">Los lotes aparecen aquí cuando salen de Bodega Control Calidad</p>
            </div>
          )}
          {opLots.map(lot=>{
            const opsElrohi = lot.opsElrohi||[];
            const total     = opsElrohi.length;
            const hechas    = opsElrohi.filter(o=>o.status==='completado').length;
            return (
              <div key={lot.id} className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:border-orange-300 transition-all"
                onClick={()=>setSelLotId(lot.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                      <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                        ⚡ Operaciones ELROHI
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{lot.totalPieces?.toLocaleString('es-CO')} piezas</p>
                    <p className="text-xs text-gray-400 mt-0.5">{hechas}/{total} operaciones completadas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400">Ver detalle →</p>
                    {total > 0 && (
                      <div className="mt-1 w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-green-500 transition-all"
                          style={{width:`${total>0?Math.round(hechas/total*100):0}%`}} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detalle del lote */}
      {selLotId && selLot && (
        <div>
          <button onClick={()=>setSelLotId(null)} className="text-xs text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">← Volver</button>

          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="font-mono text-sm font-bold text-blue-700">{selLot.code}</span>
                <p className="text-xs text-gray-500">{selLot.totalPieces?.toLocaleString('es-CO')} piezas</p>
              </div>
              <button onClick={()=>setShowAddOp(true)}
                className="text-xs font-bold px-3 py-2 rounded-lg text-white"
                style={{background:ACCENT}}>
                + Asignar operación
              </button>
            </div>

            {/* Operaciones asignadas */}
            {(selLot.opsElrohi||[]).length===0 && (
              <p className="text-xs text-gray-400 italic text-center py-4">Sin operaciones asignadas</p>
            )}
            <div className="space-y-2">
              {(selLot.opsElrohi||[]).map((op,i)=>(
                <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-xs font-bold text-gray-800">{op.referencia}</span>
                        <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{op.operacion}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                          op.status==='completado'?'bg-green-100 text-green-700':
                          op.status==='en_proceso' ?'bg-blue-100 text-blue-700':
                          'bg-gray-100 text-gray-500'}`}>
                          {op.status==='completado'?'✅':op.status==='en_proceso'?'🔄':'⏳'}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500">
                        {op.workerName} · {op.qty?.toLocaleString('es-CO')} pzas × {fmtM(op.valorUnitario)}
                        {op.valorDesc && ` (${op.valorDesc})`}
                      </p>
                    </div>
                    <span className="text-sm font-black text-green-700 flex-shrink-0">
                      {fmtM((op.vrTotal||op.qty*op.valorUnitario)||0)}
                    </span>
                  </div>
                  {op.metaLV > 0 && (
                    <p className="text-[9px] text-gray-400 mt-0.5">Meta: {op.metaLV}/día Lun-Vie · {op.metaSab}/día Sáb</p>
                  )}
                </div>
              ))}
            </div>

            {/* Total */}
            {(selLot.opsElrohi||[]).length > 0 && (
              <div className="flex justify-between text-sm font-black mt-3 pt-3 border-t border-gray-100">
                <span className="text-gray-700">Total operaciones</span>
                <span style={{color:'#15803d'}}>
                  {fmtM((selLot.opsElrohi||[]).reduce((a,op)=>a+(op.vrTotal||op.qty*op.valorUnitario||0),0))}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL AGREGAR OPERACIÓN */}
      {showAddOp && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:16,overflowY:'auto'}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:480,marginTop:16,marginBottom:16}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Asignar Operación — {selLot?.code}</h2>
              <button onClick={()=>{setShowAddOp(false);resetForm();}} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              {/* Categoría */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Categoría</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIAS.map(c=>(
                    <button key={c.key} onClick={()=>{setSelCat(c.key);setSelRef('');setSelOp('');}}
                      className="text-xs px-3 py-1.5 rounded-lg border-2 font-medium transition-all"
                      style={{borderColor:selCat===c.key?ACCENT:'#e5e7eb',background:selCat===c.key?'#fff5f0':'#fff',color:selCat===c.key?ACCENT:'#374151'}}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Referencia */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Referencia</label>
                <select value={selRef} onChange={e=>{setSelRef(e.target.value);setSelOp('');}}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-orange-400">
                  <option value="">— Seleccionar referencia —</option>
                  {refs.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Operación */}
              {selRef && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Operación</label>
                  <div className="flex flex-wrap gap-1.5">
                    {opsDeRef.map(o=>(
                      <button key={o.operacion} onClick={()=>setSelOp(o.operacion)}
                        className="text-xs px-3 py-1.5 rounded-lg border-2 font-medium transition-all text-left"
                        style={{borderColor:selOp===o.operacion?'#15803d':'#e5e7eb',background:selOp===o.operacion?'#f0fdf4':'#fff',color:selOp===o.operacion?'#15803d':'#374151'}}>
                        {o.operacion}
                        <span className="block text-[9px] font-normal opacity-70">
                          {fmtM(o.valorUnitario)}{o.valorDesc?` (${o.valorDesc})`:''}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cantidad */}
              {selOp && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Cantidad de prendas</label>
                  <input type="number" min={1} value={qty} onChange={e=>setQty(e.target.value)}
                    placeholder="Ej: 50"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                </div>
              )}

              {/* Total calculado */}
              {selOp && qty > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-green-700">Total a pagar</span>
                  <span className="text-lg font-black text-green-800">{fmtM(valorTotal)}</span>
                </div>
              )}
            </div>

            {/* Seleccionar operario */}
            {selOp && qty > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Asignar a:</p>
                <div className="space-y-2">
                  {operariosElrohi.map(op=>(
                    <button key={op.id} onClick={()=>agregarOp(op.id)} disabled={saving}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl transition-all disabled:opacity-50">
                      <div className="text-left">
                        <p className="text-sm font-bold text-gray-800">{op.name}</p>
                        <p className="text-[10px] text-gray-400">{op.role}</p>
                      </div>
                      <span className="text-xs font-bold text-blue-600">Asignar →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={()=>{setShowAddOp(false);resetForm();}} className="w-full mt-3 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">
              Cancelar
            </button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
