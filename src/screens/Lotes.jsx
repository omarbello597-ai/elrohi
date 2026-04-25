import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { advanceLot, updateLotOp } from '../services/db';
import { advanceLotStatus } from '../services/db_timeline';
import { LOT_STATUS, LOT_STATUS_STEPS, LOT_PRIORITY, ACCENT } from '../constants';
import { Modal, Select, Btn, ProgressBar, EmptyState } from '../components/ui';
import { gLabel, fmtM, lotProgress, getOpVal, lotTotalValue, lotDoneValue } from '../utils';
import { durationSince, fmtDuration } from '../services/consecutivos';
import toast from 'react-hot-toast';

// Badge de estado
function LotStatusBadge({ status }) {
  const s = LOT_STATUS[status];
  if (!s) return <span className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{status}</span>;
  return <span className={`${s.cls} text-[9px] px-2 py-0.5 rounded-full font-semibold`}>{s.label}</span>;
}

// Badge de prioridad
function PriorityBadge({ priority }) {
  const p = LOT_PRIORITY[priority];
  if (!p) return null;
  return <span className={`${p.cls} text-[9px] px-2 py-0.5 rounded-full font-semibold`}>{p.label}</span>;
}

// Timeline de pasos
function LotSteps({ status, timeline }) {
  const currentStep = LOT_STATUS[status]?.step || 0;
  return (
    <div>
      <div className="flex items-center gap-0 overflow-x-auto pb-1">
        {LOT_STATUS_STEPS.map(([key, label], i) => {
          const step  = LOT_STATUS[key]?.step || i+1;
          const done  = currentStep > step;
          const active = currentStep === step || status === key;
          return (
            <div key={key} className="flex items-center flex-shrink-0">
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  done?'bg-green-500 text-white':active?'bg-blue-500 text-white':'bg-gray-100 text-gray-400'}`}>
                  {done?'✓':i+1}
                </div>
                <p className={`text-[8px] mt-0.5 text-center whitespace-nowrap ${active?'text-blue-600 font-bold':'text-gray-400'}`}>{label}</p>
              </div>
              {i < LOT_STATUS_STEPS.length-1 && (
                <div className={`w-8 h-0.5 mx-0.5 flex-shrink-0 ${done?'bg-green-400':'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>
      {/* Timeline de tiempos */}
      {timeline?.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-2">
          {timeline.map((t,i) => {
            const st = LOT_STATUS[t.status];
            return (
              <div key={i} className="flex items-center gap-1 text-[9px]">
                <span className={`${st?.cls||'bg-gray-100 text-gray-500'} px-1.5 py-0.5 rounded font-medium`}>{st?.label||t.status}</span>
                {t.duracion && <span className="text-gray-400">{t.duracion}</span>}
                {!t.salió && <span className="text-blue-500 italic">⏱ en curso</span>}
                {i < timeline.length-1 && <span className="text-gray-300">→</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function LotesScreen() {
  const { profile } = useAuth();
  const { lots, satellites, ops, satOpVals, users } = useData();
  const [filter,   setFilter]   = useState('all');
  const [selLotId, setSelLotId] = useState(null);

  // Excluir lotes en Bodega Lonas y Despachados del panel de producción
  const STATUS_PRODUCCION = Object.keys(LOT_STATUS).filter(s => !['bodega_lonas','bodega_calidad','en_operaciones_elrohi','en_revision_calidad','despachado'].includes(s));
  const lotsEnProd = lots.filter(l => STATUS_PRODUCCION.includes(l.status));
  const filtered = filter === 'all' ? lotsEnProd : lots.filter(l => l.status === filter);
  const detail   = lots.find(l => l.id === selLotId);

  if (detail) {
    return <LoteDetail lot={detail} lots={lots} satellites={satellites}
                       ops={ops} satOpVals={satOpVals} users={users} profile={profile}
                       onBack={() => setSelLotId(null)} />;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h1 className="text-sm font-bold text-gray-900 flex-1">Control de Lotes</h1>
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        <button onClick={() => setFilter('all')}
          className="px-2.5 py-1 rounded-full text-[10px] font-medium border-none cursor-pointer"
          style={{ background: filter==='all'?ACCENT:'#f1f0ec', color: filter==='all'?'#fff':'#6b7280' }}>
          Todos ({lotsEnProd.length})
        </button>
        {Object.entries(LOT_STATUS).map(([key, val]) => {
          const count = lots.filter(l => l.status === key).length;
          if (count === 0) return null;
          return (
            <button key={key} onClick={() => setFilter(key)}
              className="px-2.5 py-1 rounded-full text-[10px] font-medium border-none cursor-pointer"
              style={{ background: filter===key?ACCENT:'#f1f0ec', color: filter===key?'#fff':'#6b7280' }}>
              {val.label} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && <EmptyState emoji="📦" title="No hay lotes en este estado" />}

      <div className="space-y-2">
        {filtered.map(l => {
          const prog = lotProgress(l);
          const sat  = satellites.find(s => s.id === l.satId);
          const statusInfo = LOT_STATUS[l.status];
          return (
            <div key={l.id} onClick={() => setSelLotId(l.id)}
              className="bg-white rounded-xl border border-gray-100 p-3 cursor-pointer hover:border-gray-300 transition-colors flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-xs font-bold text-blue-700">{l.code}</span>
                  <LotStatusBadge status={l.status} />
                  <PriorityBadge priority={l.priority} />
                </div>
                <p className="text-[10px] text-gray-500">
                  {[...new Set(l.garments?.map(g => gLabel(g.gtId)))].join(', ')}
                  {' · '}{l.totalPieces?.toLocaleString('es-CO')} piezas
                  {sat ? ' · ' + sat.name : ''}
                </p>
              </div>
              {l.lotOps?.length > 0 && (
                <div className="w-24 flex-shrink-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-[9px] text-gray-400">Progreso</span>
                    <span className="text-[10px] font-bold text-gray-700">{prog}%</span>
                  </div>
                  <ProgressBar value={prog} color={prog===100?'bg-green-500':prog>50?'bg-blue-500':'bg-amber-500'} />
                </div>
              )}
              <div className="text-right flex-shrink-0">
                <p className="text-[9px] text-gray-400">Vence</p>
                <p className="text-xs font-semibold" style={{color:new Date(l.deadline)<new Date()?'#dc2626':'#374151'}}>
                  {l.deadline}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DETALLE DE LOTE ─────────────────────────────────────────────────────────
function LoteDetail({ lot, lots, satellites, ops, satOpVals, users, profile, onBack }) {
  const [showAssign, setShowAssign] = useState(false);
  const [selSat,     setSelSat]     = useState('');
  const [saving,     setSaving]     = useState(false);

  const sat      = satellites.find(s => s.id === lot.satId);
  const prog     = lotProgress(lot);
  const totalVal = lotTotalValue(lot, ops, satOpVals);
  const doneVal  = lotDoneValue(lot, ops, satOpVals);

  const isAdmin = ['admin_elrohi','gerente'].includes(profile.role);

  const advance = async (newStatus, extra = {}) => {
    setSaving(true);
    try {
      await advanceLotStatus(lot.id, newStatus, profile.id, profile.name, extra);
      toast.success('✅ Lote actualizado');
      if (newStatus === 'costura') setShowAssign(false);
    } catch { toast.error('Error al actualizar'); }
    finally { setSaving(false); }
  };

  const handleOpAction = async (loId, action) => {
    const today = new Date().toISOString().split('T')[0];
    try {
      if (action === 'tomar')     await updateLotOp(lot.id, loId, { wId:profile.id, status:'en_proceso', startedAt: new Date().toISOString() });
      if (action === 'completar') await updateLotOp(lot.id, loId, { status:'completado', done:today, doneAt: new Date().toISOString() });
      toast.success('Operación actualizada');
    } catch { toast.error('Error al actualizar'); }
  };

  return (
    <div>
      <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1">
        ← Volver a lotes
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-3">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-sm font-black text-blue-700">{lot.code}</span>
              <LotStatusBadge status={lot.status} />
              <PriorityBadge priority={lot.priority} />
            </div>
            <p className="text-xs text-gray-400">
              Creado: {lot.created} · Vence: {lot.deadline}
              {sat ? ' · ' + sat.name : ''}
            </p>
            {lot.descripcion && lot.descripcion !== lot.code && (
              <p className="text-sm font-semibold text-gray-700 mt-0.5">{lot.descripcion}</p>
            )}
          </div>
          {lot.lotOps?.length > 0 && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Valor total del corte</p>
              <p className="text-lg font-black text-gray-800">{fmtM(totalVal)}</p>
              <p className="text-xs text-green-600">Pagado: {fmtM(doneVal)}</p>
            </div>
          )}
        </div>

        {/* Botones de acción según estado */}
        <div className="flex gap-2 flex-wrap mb-4">
          {lot.status === 'asignacion' && isAdmin && (
            <button onClick={() => setShowAssign(true)}
              className="text-xs font-bold px-3 py-2 text-white rounded-lg"
              style={{background:'#7c3aed'}}>
              🏭 Asignar a Satélite
            </button>
          )}
          {lot.status === 'costura' && isAdmin && (
            <button onClick={() => advance('reasignar')} disabled={saving}
              className="text-xs font-bold px-3 py-2 bg-gray-100 text-gray-700 rounded-lg">
              ↩ Re-asignar Satélite
            </button>
          )}
          {lot.status === 'listo_bodega' && isAdmin && (
            <span className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg font-medium">
              ⏳ Ir a Bodegas para asignar destino
            </span>
          )}
          {lot.status === 'en_revision_calidad' && isAdmin && (
            <button onClick={() => advance('bodega_lonas')} disabled={saving}
              className="text-xs font-bold px-3 py-2 text-white rounded-lg"
              style={{background:'#15803d'}}>
              ✓ Aprobar calidad → Bodega Lonas
            </button>
          )}

        </div>

        {/* Timeline de pasos */}
        <LotSteps status={lot.status} timeline={lot.timeline} />
      </div>

      {/* Prendas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Prendas del Lote</h3>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>{['Prenda','Tallas','Total'].map(c=><th key={c} className="text-left px-2 py-1.5 text-gray-400 font-medium border-b border-gray-100">{c}</th>)}</tr>
            </thead>
            <tbody>
              {lot.garments?.map((g,i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-2 py-1.5 font-medium">{gLabel(g.gtId)}</td>
                  <td className="px-2 py-1.5 text-gray-500">
                    {Object.entries(g.sizes||{}).filter(([,v])=>v>0).map(([k,v])=>`${k}:${v}`).join(' ')}
                  </td>
                  <td className="px-2 py-1.5 font-bold">{g.total}</td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td className="px-2 py-1.5 font-bold" colSpan={2}>TOTAL</td>
                <td className="px-2 py-1.5 font-black">{lot.totalPieces}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {lot.novelties?.length > 0 && (
          <div className="bg-red-50 rounded-xl border border-red-200 p-4">
            <h3 className="text-xs font-bold text-red-600 mb-2">⚠ Novedades</h3>
            {lot.novelties.map((n,i) => (
              <div key={i} className="bg-white rounded-lg p-2.5 mb-2 text-xs">
                <p className="text-red-600 font-semibold">Faltante: {n.qty} unidades</p>
                <p className="text-gray-500">{n.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Operaciones de costura */}
      {lot.lotOps?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Operaciones de Costura</h3>
            <span className="text-xs font-bold text-gray-700">{prog}% · {fmtM(totalVal)}</span>
          </div>
          <ProgressBar value={prog} color={prog===100?'bg-green-500':'bg-blue-500'} />
          <div className="mt-3 space-y-1.5">
            {lot.lotOps.map(lo => {
              const worker  = users.find(u => u.id === lo.wId);
              const valUnit = getOpVal(ops, satOpVals, lot.satId, lo.opId);
              const valTot  = valUnit * lo.qty;
              const stCls   = { completado:'bg-green-100 text-green-800', en_proceso:'bg-blue-100 text-blue-800', pendiente:'bg-gray-100 text-gray-600' };
              return (
                <div key={lo.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-xs">
                  <span className={`${stCls[lo.status]} px-2 py-0.5 rounded-full text-[9px] font-semibold min-w-[60px] text-center`}>
                    {lo.status==='completado'?'✓ Listo':lo.status==='en_proceso'?'⚡ Activa':'Pendiente'}
                  </span>
                  <span className="font-medium text-gray-800 flex-1">{lo.name||lo.opId}</span>
                  <span className="text-gray-400">{lo.qty} pzs</span>
                  <span className="font-mono text-gray-500">{fmtM(valUnit)}/pza</span>
                  <span className="font-mono font-bold" style={{color:lo.status==='completado'?'#10b981':'#374151'}}>{fmtM(valTot)}</span>
                  <span className="text-gray-400 min-w-[80px]">{worker?.name||'Sin asignar'}</span>
                  {profile.role==='operario' && lo.status==='pendiente' && !lo.wId && (
                    <button onClick={()=>handleOpAction(lo.id,'tomar')}
                      className="text-[9px] px-2 py-0.5 rounded text-blue-700 bg-blue-100 font-semibold">Tomar</button>
                  )}
                  {profile.role==='operario' && lo.status==='en_proceso' && lo.wId===profile.id && (
                    <button onClick={()=>handleOpAction(lo.id,'completar')}
                      className="text-[9px] px-2 py-0.5 rounded text-green-700 bg-green-100 font-semibold">Terminé</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Operaciones internas ELROHI */}
      {lot.opsElrohi?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Operaciones Internas ELROHI</h3>
          <div className="space-y-1.5">
            {lot.opsElrohi.map((op,i) => {
              const worker = users.find(u=>u.id===op.wId);
              return (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-xs">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${op.status==='completado'?'bg-green-100 text-green-700':'bg-orange-100 text-orange-700'}`}>
                    {op.status==='completado'?'✓ Listo':'En proceso'}
                  </span>
                  <span className="font-medium text-gray-800 flex-1">{op.name}</span>
                  <span className="text-gray-400">{op.qty?.toLocaleString('es-CO')} pzas</span>
                  {worker && <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">{worker.name}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal asignar satélite */}
      {showAssign && (
        <Modal title="Asignar a Satélite" onClose={()=>setShowAssign(false)}>
          <p className="text-sm text-gray-500 mb-3">{lot.code} · {lot.totalPieces?.toLocaleString('es-CO')} piezas</p>
          <Select label="Seleccionar Satélite" value={selSat} onChange={e=>setSelSat(e.target.value)}>
            <option value="">— Elegir satélite —</option>
            {satellites.filter(s=>s.active).map(s=>{
              const activeLots = lots.filter(l=>l.satId===s.id&&l.status==='costura').length;
              return <option key={s.id} value={s.id}>{s.name} ({s.city}) — {activeLots} cortes activos</option>;
            })}
          </Select>
          <div className="flex gap-2 mt-3">
            <Btn variant="secondary" onClick={()=>setShowAssign(false)} className="flex-1">Cancelar</Btn>
            <Btn onClick={async()=>{
              // Build lotOps from global operations
              const lotOps = ops.filter(o=>o.active!==false).map(o=>({
                id: `lo_${lot.id}_${o.id}`,
                opId: o.id,
                name: o.name,
                qty: lot.totalPieces || 0,
                status: 'pendiente',
                wId: null,
              }));
              advance('costura',{satId:selSat, lotOps});
            }} disabled={!selSat||saving} className="flex-1">Asignar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
