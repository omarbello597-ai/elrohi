import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { updateDocument } from '../services/db';
import { fmtM, lotProgress } from '../utils';
import { ACCENT } from '../constants';
import toast from 'react-hot-toast';

const genId = () => 'lo_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);

export default function AsignarOpsScreen() {
  const { profile }             = useAuth();
  const { lots, ops, users }    = useData();
  const [selLotId, setSelLotId] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [editingVal, setEditingVal] = useState(null);
  const [editVal,    setEditVal]    = useState('');
  const [showAddOp,  setShowAddOp]  = useState(false);
  const [newOpName,  setNewOpName]  = useState('');
  const [newOpVal,   setNewOpVal]   = useState('');
  const [saving,     setSaving]     = useState(false);

  const myLots    = lots.filter(l => l.satId === profile?.satId && l.status === 'costura');
  const myWorkers = users.filter(u => u.satId === profile?.satId && u.role === 'operario');
  const lot       = myLots.find(l => l.id === (selLotId || myLots[0]?.id));

  // Asignar operario a operación
  const assign = async (loId, wId) => {
    try {
      const lotOps = (lot.lotOps||[]).map(lo =>
        lo.id === loId ? {...lo, wId, status:'en_proceso'} : lo
      );
      await updateDocument('lots', lot.id, { lotOps });
      toast.success('✅ Operación asignada');
      setAssigning(null);
    } catch { toast.error('Error al asignar'); }
  };

  // Editar valor de operación
  const guardarVal = async (loId) => {
    try {
      const lotOps = (lot.lotOps||[]).map(lo =>
        lo.id === loId ? {...lo, val: +editVal||0} : lo
      );
      await updateDocument('lots', lot.id, { lotOps });
      toast.success('✅ Valor actualizado');
      setEditingVal(null); setEditVal('');
    } catch { toast.error('Error'); }
  };

  // Eliminar operación del corte
  const eliminarOp = async (loId) => {
    if (!window.confirm('¿Eliminar esta operación del corte?')) return;
    const lotOps = (lot.lotOps||[]).filter(lo => lo.id !== loId);
    await updateDocument('lots', lot.id, { lotOps });
    toast.success('Operación eliminada');
  };

  // Agregar operación propia del satélite
  const agregarOp = async () => {
    if (!newOpName) { toast.error('Escribe el nombre'); return; }
    setSaving(true);
    try {
      const newOp = {
        id:     genId(),
        opId:   genId(),
        name:   newOpName.trim(),
        val:    +newOpVal||0,
        qty:    lot.totalPieces||0,
        status: 'pendiente',
        wId:    null,
      };
      const lotOps = [...(lot.lotOps||[]), newOp];
      await updateDocument('lots', lot.id, { lotOps });
      toast.success('✅ Operación agregada');
      setNewOpName(''); setNewOpVal(''); setShowAddOp(false);
    } catch(e){ toast.error('Error'); }
    finally { setSaving(false); }
  };

  if (myLots.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
      <p className="text-4xl mb-3">🔧</p>
      <p className="font-medium text-gray-700">Sin cortes activos</p>
      <p className="text-sm text-gray-400 mt-1">Cuando el Admin ELROHI te asigne un corte aparecerá aquí</p>
    </div>
  );

  const stCls = {
    completado: 'bg-green-100 text-green-800',
    en_proceso: 'bg-blue-100 text-blue-800',
    pendiente:  'bg-gray-100 text-gray-600',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold text-gray-900">Asignar Operaciones</h1>
        {lot && (
          <button onClick={()=>setShowAddOp(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{background:ACCENT}}>
            + Agregar operación
          </button>
        )}
      </div>

      {/* Selector de corte */}
      {myLots.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {myLots.map(l=>(
            <button key={l.id} onClick={()=>setSelLotId(l.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{background:(selLotId||myLots[0]?.id)===l.id?ACCENT:'#f1f0ec',
                color:(selLotId||myLots[0]?.id)===l.id?'#fff':'#374151'}}>
              {l.code}
            </button>
          ))}
        </div>
      )}

      {lot && (
        <div className="grid grid-cols-1 gap-4">
          {/* Operaciones */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Operaciones del corte</p>
              <span className="text-xs font-bold text-gray-700">{lotProgress(lot)}% completado</span>
            </div>

            {(!lot.lotOps||lot.lotOps.length===0) && (
              <p className="text-xs text-gray-400 italic text-center py-4">Sin operaciones — agrega una con el botón de arriba</p>
            )}

            <div className="space-y-2">
              {(lot.lotOps||[]).map(lo=>{
                const worker = users.find(u=>u.id===lo.wId);
                const valTot = (lo.val||0) * (lo.qty||0);
                return (
                  <div key={lo.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`${stCls[lo.status]||stCls.pendiente} px-2 py-0.5 rounded-full text-[9px] font-semibold`}>
                        {lo.status==='completado'?'✓ Listo':lo.status==='en_proceso'?'⚡ Activa':'Pend.'}
                      </span>
                      <span className="font-medium text-gray-800 text-xs flex-1">{lo.name||lo.opId}</span>
                      <button onClick={()=>eliminarOp(lo.id)}
                        className="text-red-400 text-[10px] hover:text-red-600">🗑</button>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Valor editable */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500">Valor:</span>
                        {editingVal===lo.id ? (
                          <div className="flex items-center gap-1">
                            <input type="number" value={editVal} onChange={e=>setEditVal(e.target.value)}
                              className="w-20 border border-orange-300 rounded px-1.5 py-0.5 text-xs text-center focus:outline-none" />
                            <button onClick={()=>guardarVal(lo.id)}
                              className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">✓</button>
                            <button onClick={()=>{setEditingVal(null);setEditVal('');}}
                              className="text-[10px] text-gray-400">✕</button>
                          </div>
                        ) : (
                          <button onClick={()=>{setEditingVal(lo.id);setEditVal(String(lo.val||0));}}
                            className="text-xs font-bold px-2 py-0.5 rounded border border-gray-200 bg-gray-50 hover:bg-orange-50 hover:border-orange-300 text-gray-700">
                            {fmtM(lo.val||0)} <span style={{color:'#e85d26'}}>✏️</span>
                          </button>
                        )}
                      </div>

                      <span className="text-[10px] text-gray-400">× {lo.qty?.toLocaleString('es-CO')} = <strong>{fmtM(valTot)}</strong></span>

                      {/* Operario asignado */}
                      <div className="flex items-center gap-1 ml-auto">
                        {worker ? (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{worker.name}</span>
                        ) : (
                          <span className="text-[10px] text-gray-400">Sin asignar</span>
                        )}
                        {lo.status === 'pendiente' && (
                          <button onClick={()=>setAssigning(lo.id)}
                            className="text-[10px] font-bold px-2 py-0.5 rounded text-white ml-1"
                            style={{background:'#2878B4'}}>
                            Asignar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mis Operarios */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Mis Operarios</p>
            {myWorkers.length===0 && <p className="text-xs text-gray-400 italic">Sin operarios registrados</p>}
            <div className="space-y-2">
              {myWorkers.map(w=>{
                const activas = (lot.lotOps||[]).filter(lo=>lo.wId===w.id&&lo.status!=='completado').length;
                const listas  = (lot.lotOps||[]).filter(lo=>lo.wId===w.id&&lo.status==='completado').length;
                const total   = (lot.lotOps||[]).filter(lo=>lo.wId===w.id&&lo.status==='completado').reduce((a,lo)=>a+(lo.val||0)*(lo.qty||0),0);
                return (
                  <div key={w.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 flex-shrink-0">
                      {w.initials}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-gray-900">{w.name}</p>
                      <p className="text-[9px] text-gray-400">{activas} activas · {listas} listas</p>
                    </div>
                    {total>0 && <span className="text-xs font-black text-green-700">{fmtM(total)}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL ASIGNAR OPERARIO */}
      {assigning && lot && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:400}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">
                Asignar — {(lot.lotOps||[]).find(lo=>lo.id===assigning)?.name}
              </h2>
              <button onClick={()=>setAssigning(null)} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
            </div>
            <div className="space-y-2">
              {myWorkers.map(w=>(
                <button key={w.id} onClick={()=>assign(assigning,w.id)}
                  className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl transition-all">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                    {w.initials}
                  </div>
                  <span className="text-sm font-medium text-gray-900">{w.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL AGREGAR OPERACIÓN PROPIA */}
      {showAddOp && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:400}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Agregar Operación</h2>
              <button onClick={()=>setShowAddOp(false)} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre de la operación *</label>
                <input value={newOpName} onChange={e=>setNewOpName(e.target.value)}
                  placeholder="Ej: Plana, Fileteado, Pegar cremallera..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Valor por pieza ($)</label>
                <input type="number" min={0} value={newOpVal} onChange={e=>setNewOpVal(e.target.value)}
                  placeholder="Ej: 6000"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              {newOpVal>0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex justify-between">
                  <span className="text-xs font-bold text-green-700">Total estimado</span>
                  <span className="text-sm font-black text-green-800">{fmtM((+newOpVal||0)*(lot?.totalPieces||0))}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setShowAddOp(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={agregarOp} disabled={saving}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                style={{background:ACCENT}}>
                {saving?'Agregando...':'✅ Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
