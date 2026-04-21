import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { updateDocument, addDocument } from '../services/db';
import { advanceLotStatus } from '../services/db_timeline';
import { gLabel, fmtM } from '../utils';
import { ACCENT } from '../constants';
import toast from 'react-hot-toast';

const BODEGAS = [
  { id: 'bodega_lonas',   label: 'Bodega Lonas',             color: '#2563eb', icon: '📦' },
  { id: 'bodega_calidad', label: 'Bodega Control de Calidad', color: '#7c3aed', icon: '🔍' },
];

const OPS_INTERNAS = [
  { id: 'pegar_boton',   name: 'Pegar botón',     val: 200 },
  { id: 'quitar_hebras', name: 'Quitar hebras',    val: 150 },
  { id: 'doblar',        name: 'Doblar',           val: 100 },
  { id: 'empacar',       name: 'Empacar',          val: 200 },
  { id: 'revisar',       name: 'Revisión calidad', val: 150 },
  { id: 'planchar',      name: 'Planchar',         val: 250 },
  { id: 'etiquetar',     name: 'Etiquetar',        val: 150 },
  { id: 'pegar_talla',   name: 'Pegar talla',      val: 100 },
];

const statusLabel = (s) => {
  const map = {
    bodega_lonas:          { label:'Bodega Lonas',           cls:'bg-blue-100 text-blue-700'    },
    bodega_calidad:        { label:'Bodega Control Calidad', cls:'bg-purple-100 text-purple-700' },
    en_operaciones_elrohi: { label:'Operaciones ELROHI',     cls:'bg-orange-100 text-orange-700' },
  };
  return map[s] || { label: s, cls: 'bg-gray-100 text-gray-600' };
};

export default function BodegasScreen() {
  const { profile }     = useAuth();
  const { lots, users } = useData();
  const [selLot,      setSelLot]      = useState(null);
  const [tab,         setTab]         = useState('bodega');
  const [bodegaDest,  setBodegaDest]  = useState('bodega_lonas');
  const [saving,      setSaving]      = useState(false);

  // Para flujo parcial: cantidades por prenda a bodega y a operaciones
  const [cantBodega,  setCantBodega]  = useState({});
  const [cantOps,     setCantOps]     = useState({});

  // Operaciones seleccionadas con su operario asignado
  const [opsConOperario, setOpsConOperario] = useState([]);
  const [customOp,    setCustomOp]    = useState({ name:'', val:'' });

  const isAdmin = ['gerente','admin_elrohi'].includes(profile?.role);

  const listoBodega = lots.filter(l => l.status === 'listo_bodega');
  const enBodega    = lots.filter(l => ['bodega_lonas','bodega_calidad','en_operaciones_elrohi'].includes(l.status));

  // Operarios internos de ELROHI
  const operariosElrohi = users.filter(u =>
    ['corte','bodega_op','terminacion','operario'].includes(u.role) && u.active !== false && !u.satId
  );

  const openLot = (lot) => {
    setSelLot(lot);
    setTab('bodega');
    setBodegaDest('bodega_lonas');
    const initB = {}; const initO = {};
    lot.garments?.forEach(g => { initB[g.gtId] = g.total; initO[g.gtId] = 0; });
    setCantBodega(initB);
    setCantOps(initO);
    setOpsConOperario([]);
    setCustomOp({ name:'', val:'' });
  };

  const totalBodega = Object.values(cantBodega).reduce((a,b) => a+(+b||0), 0);
  const totalOps    = Object.values(cantOps).reduce((a,b) => a+(+b||0), 0);

  const updCantBodega = (gtId, val) => {
    const lot = selLot;
    const g   = lot.garments?.find(x => x.gtId === gtId);
    const max = g?.total || 0;
    const vB  = Math.min(+val||0, max);
    const vO  = max - vB;
    setCantBodega(f => ({...f, [gtId]: vB}));
    setCantOps(f => ({...f, [gtId]: vO}));
  };

  const toggleOp = (opId) => {
    setOpsConOperario(prev => {
      const exists = prev.find(o => o.opId === opId);
      if (exists) return prev.filter(o => o.opId !== opId);
      const op = OPS_INTERNAS.find(o => o.id === opId);
      return [...prev, { opId, name: op?.name||opId, val: op?.val||0, operarioId: '', operarioName: '' }];
    });
  };

  const setOperario = (opId, operarioId) => {
    const worker = operariosElrohi.find(u => u.id === operarioId);
    setOpsConOperario(prev => prev.map(o =>
      o.opId === opId ? { ...o, operarioId, operarioName: worker?.name||'' } : o
    ));
  };

  const asignarBodega = async () => {
    if (!selLot) return;
    setSaving(true);
    try {
      await advanceLotStatus(selLot.id, bodegaDest, profile?.id, profile?.name, {
        bodega: bodegaDest,
        cantidadesBodega: cantBodega,
      });
      toast.success(`✅ Lote asignado a ${BODEGAS.find(b=>b.id===bodegaDest)?.label}`);
      setSelLot(null);
    } catch(e) { console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  const asignarOperaciones = async () => {
    if (!selLot) return;
    if (opsConOperario.length === 0) { toast.error('Selecciona al menos una operación'); return; }
    const sinOperario = opsConOperario.filter(o => !o.operarioId);
    if (sinOperario.length > 0) { toast.error(`Asigna un operario a: ${sinOperario.map(o=>o.name).join(', ')}`); return; }
    setSaving(true);
    try {
      const allOps = [...OPS_INTERNAS];
      if (customOp.name && customOp.val) allOps.push({ id:`custom_${Date.now()}`, name:customOp.name, val:+customOp.val });
      const opsElrohi = opsConOperario.map(o => ({
        id:          `oe_${selLot.id}_${o.opId}`,
        opId:        o.opId,
        name:        o.name,
        val:         o.val,
        qty:         totalOps || selLot.totalPieces,
        status:      'pendiente',
        wId:         o.operarioId,
        workerName:  o.operarioName,
        assignments: [],
      }));
      await advanceLotStatus(selLot.id, 'en_operaciones_elrohi', profile?.id, profile?.name, { opsElrohi });
      toast.success('✅ Lote enviado a Operaciones ELROHI');
      setSelLot(null);
    } catch(e) { console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  const asignarParcial = async () => {
    if (!selLot) return;
    if (opsConOperario.length === 0) { toast.error('Selecciona operaciones para ELROHI'); return; }
    const sinOperario = opsConOperario.filter(o => !o.operarioId);
    if (sinOperario.length > 0) { toast.error(`Asigna un operario a: ${sinOperario.map(o=>o.name).join(', ')}`); return; }
    if (totalBodega === 0) { toast.error('Ingresa cuántas prendas van a bodega'); return; }
    if (totalOps === 0)    { toast.error('Ingresa cuántas prendas van a operaciones'); return; }
    setSaving(true);
    try {
      const opsElrohi = opsConOperario.map(o => ({
        id:          `oe_${selLot.id}_${o.opId}`,
        opId:        o.opId,
        name:        o.name,
        val:         o.val,
        qty:         totalOps,
        status:      'pendiente',
        wId:         o.operarioId,
        workerName:  o.operarioName,
        assignments: [],
      }));
      await advanceLotStatus(selLot.id, 'en_operaciones_elrohi', profile?.id, profile?.name, {
        opsElrohi,
        bodegaSecundaria:  bodegaDest,
        cantidadesBodega:  cantBodega,
        cantidadesOps:     cantOps,
        esParcial:         true,
      });
      toast.success('✅ Asignación parcial completada');
      setSelLot(null);
    } catch(e) { console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Bodegas y Operaciones</h1>

      {/* LISTOS */}
      {listoBodega.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Listos para asignar ({listoBodega.length})</p>
          <div className="space-y-2">
            {listoBodega.map(lot => (
              <div key={lot.id} className="bg-white rounded-xl border-2 border-amber-200 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                      <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">⏳ Pendiente asignación</span>
                    </div>
                    <p className="text-xs text-gray-500">{lot.totalPieces?.toLocaleString('es-CO')} piezas · Vence: {lot.deadline}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {lot.garments?.map((g,i) => (
                        <span key={i} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {gLabel(g.gtId)}: {g.total}
                        </span>
                      ))}
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => openLot(lot)}
                      className="text-xs font-bold px-4 py-2 rounded-lg text-white flex-shrink-0"
                      style={{ background: ACCENT }}>
                      📦 Asignar destino
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EN BODEGAS */}
      {enBodega.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">En bodegas / operaciones ({enBodega.length})</p>
          <div className="space-y-2">
            {enBodega.map(lot => {
              const st = statusLabel(lot.status);
              return (
                <div key={lot.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                    <span className={`${st.cls} text-[9px] px-2 py-0.5 rounded-full font-bold`}>{st.label}</span>
                    <span className="text-xs text-gray-400">{lot.totalPieces?.toLocaleString('es-CO')} piezas</span>
                    {lot.esParcial && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">Parcial</span>}
                  </div>
                  {/* Desglose parcial */}
                  {lot.cantidadesBodega && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(lot.cantidadesBodega).map(([gtId,qty]) => +qty>0 && (
                        <span key={gtId} className="text-[9px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                          {gLabel(gtId)}: <strong>{qty}</strong> → bodega
                        </span>
                      ))}
                      {lot.cantidadesOps && Object.entries(lot.cantidadesOps).map(([gtId,qty]) => +qty>0 && (
                        <span key={gtId} className="text-[9px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded border border-orange-100">
                          {gLabel(gtId)}: <strong>{qty}</strong> → ops
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {listoBodega.length === 0 && enBodega.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-4xl mb-3">📦</p>
          <p className="font-medium text-gray-700">Sin lotes en bodegas</p>
          <p className="text-sm text-gray-400 mt-1">Los lotes recibidos de tintorería aparecerán aquí</p>
        </div>
      )}

      {/* MODAL */}
      {selLot && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'16px',overflowY:'auto'}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:600,marginTop:16,marginBottom:16}}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Asignar destino</h2>
                <p className="text-xs text-gray-500 font-mono">{selLot.code} · {selLot.totalPieces?.toLocaleString('es-CO')} piezas</p>
              </div>
              <button onClick={() => setSelLot(null)} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg">
              {[['bodega','📦 A Bodega'],['operaciones','⚡ A Operaciones'],['parcial','🔀 Parcial']].map(([k,l])=>(
                <button key={k} onClick={()=>setTab(k)}
                  className="flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-all"
                  style={{background:tab===k?'#fff':'transparent',color:tab===k?'#111827':'#6b7280',fontWeight:tab===k?700:400,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
                  {l}
                </button>
              ))}
            </div>

            {/* ── A BODEGA COMPLETO ── */}
            {tab==='bodega' && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-3">Selecciona la bodega:</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {BODEGAS.map(b => (
                    <button key={b.id} onClick={() => setBodegaDest(b.id)}
                      className="p-4 rounded-xl border-2 text-left transition-all"
                      style={{borderColor:bodegaDest===b.id?b.color:'#e5e7eb',background:bodegaDest===b.id?`${b.color}10`:'#fff'}}>
                      <p className="text-2xl mb-1">{b.icon}</p>
                      <p className="text-xs font-bold" style={{color:bodegaDest===b.id?b.color:'#374151'}}>{b.label}</p>
                    </button>
                  ))}
                </div>
                <div className="bg-blue-50 rounded-xl p-3 mb-4">
                  <p className="text-xs text-blue-700">Se envía el lote completo (<strong>{selLot.totalPieces?.toLocaleString('es-CO')} piezas</strong>) a {BODEGAS.find(b=>b.id===bodegaDest)?.label}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selLot.garments?.map((g,i) => (
                      <span key={i} className="text-[10px] bg-white border border-blue-200 px-2 py-0.5 rounded text-blue-700">
                        {gLabel(g.gtId)}: <strong>{g.total}</strong>
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={asignarBodega} disabled={saving}
                  className="w-full py-3 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{background:BODEGAS.find(b=>b.id===bodegaDest)?.color}}>
                  {saving?'Asignando...':`📦 Enviar a ${BODEGAS.find(b=>b.id===bodegaDest)?.label}`}
                </button>
              </div>
            )}

            {/* ── OPERACIONES / PARCIAL ── */}
            {(tab==='operaciones' || tab==='parcial') && (
              <div>

                {/* CONTEO PARCIAL */}
                {tab==='parcial' && (
                  <div className="mb-4">
                    <p className="text-xs font-bold text-gray-700 mb-2">¿Cuántas prendas van a cada destino?</p>
                    <div className="bg-gray-50 rounded-xl p-3 mb-2">
                      {selLot.garments?.map(g => (
                        <div key={g.gtId} className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-medium text-gray-700 w-32 flex-shrink-0">{gLabel(g.gtId)}</span>
                          <span className="text-[10px] text-gray-400">Total: {g.total}</span>
                          <div className="flex items-center gap-1.5 flex-1">
                            <span className="text-[10px] text-blue-600 whitespace-nowrap">📦 Bodega:</span>
                            <input type="number" min={0} max={g.total}
                              value={cantBodega[g.gtId]||0}
                              onChange={e => updCantBodega(g.gtId, e.target.value)}
                              className="w-16 text-center border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:border-blue-400" />
                            <span className="text-[10px] text-orange-600 whitespace-nowrap">⚡ Ops:</span>
                            <span className="w-16 text-center text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1">
                              {cantOps[g.gtId]||0}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 text-xs mb-3">
                      <div className="flex-1 bg-blue-50 rounded-lg p-2 text-center">
                        <p className="text-blue-600 font-bold text-sm">{totalBodega}</p>
                        <p className="text-blue-500">pzas → bodega</p>
                      </div>
                      <div className="flex-1 bg-orange-50 rounded-lg p-2 text-center">
                        <p className="text-orange-600 font-bold text-sm">{totalOps}</p>
                        <p className="text-orange-500">pzas → operaciones</p>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">Bodega para las {totalBodega} prendas:</p>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {BODEGAS.map(b => (
                        <button key={b.id} onClick={() => setBodegaDest(b.id)}
                          className="p-3 rounded-xl border-2 text-left"
                          style={{borderColor:bodegaDest===b.id?b.color:'#e5e7eb',background:bodegaDest===b.id?`${b.color}10`:'#fff'}}>
                          <p className="text-xs font-bold" style={{color:bodegaDest===b.id?b.color:'#374151'}}>{b.icon} {b.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* OPERACIONES */}
                <p className="text-xs font-bold text-gray-700 mb-2">
                  Operaciones a realizar {tab==='parcial'?`(${totalOps} prendas):`:`(${selLot.totalPieces} prendas):`}
                </p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {OPS_INTERNAS.map(op => {
                    const sel = opsConOperario.find(o => o.opId === op.id);
                    return (
                      <button key={op.id} onClick={() => toggleOp(op.id)}
                        className="p-2.5 rounded-xl border-2 text-left transition-all"
                        style={{borderColor:sel?ACCENT:'#e5e7eb',background:sel?`${ACCENT}10`:'#fff'}}>
                        <p className="text-xs font-bold" style={{color:sel?ACCENT:'#374151'}}>{op.name}</p>
                        <p className="text-[10px] text-gray-400">{fmtM(op.val)}/pza</p>
                      </button>
                    );
                  })}
                </div>

                {/* Op personalizada */}
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">+ Operación personalizada</p>
                  <div className="flex gap-2">
                    <input value={customOp.name} onChange={e=>setCustomOp(f=>({...f,name:e.target.value}))}
                      placeholder="Nombre de la operación"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none" />
                    <input type="number" value={customOp.val} onChange={e=>setCustomOp(f=>({...f,val:e.target.value}))}
                      placeholder="$/pza"
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                    {customOp.name && customOp.val && (
                      <button onClick={() => {
                        const id = `custom_${Date.now()}`;
                        OPS_INTERNAS.push({id, name:customOp.name, val:+customOp.val});
                        toggleOp(id);
                        setCustomOp({name:'',val:''});
                      }} className="px-3 py-1.5 text-white text-xs rounded-lg font-bold" style={{background:ACCENT}}>
                        + Agregar
                      </button>
                    )}
                  </div>
                </div>

                {/* ASIGNAR OPERARIO A CADA OP */}
                {opsConOperario.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4">
                    <p className="text-xs font-bold text-gray-700 mb-3">Asignar operario ELROHI a cada operación:</p>
                    {opsConOperario.map((op,i) => (
                      <div key={i} className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-medium text-gray-700 flex-1">{op.name}</span>
                        <select value={op.operarioId} onChange={e => setOperario(op.opId, e.target.value)}
                          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-orange-400"
                          style={{minWidth:150,color:op.operarioId?'#111827':'#9ca3af'}}>
                          <option value="">— Seleccionar operario —</option>
                          {operariosElrohi.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                        {op.operarioId
                          ? <span className="text-[10px] text-green-600 font-bold">✓</span>
                          : <span className="text-[10px] text-red-400">Requerido</span>
                        }
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={tab==='parcial' ? asignarParcial : asignarOperaciones}
                  disabled={saving}
                  className="w-full py-3 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{background:ACCENT}}>
                  {saving ? 'Asignando...' : tab==='parcial'
                    ? `🔀 Confirmar — ${totalBodega} a bodega · ${totalOps} a operaciones`
                    : '⚡ Enviar a Operaciones ELROHI'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
