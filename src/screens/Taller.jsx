import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { updateLotOp } from '../services/db';
import { GARMENT_TYPES, ACCENT } from '../constants';
import { Tabs, StatCard, ProgressBar, Modal, Btn, EmptyState } from '../components/ui';
import { fmtM, gLabel, getOpVal, lotProgress, lotTotalValue, lotDoneValue, workerQuincena } from '../utils';
import toast from 'react-hot-toast';

export default function TallerScreen() {
  const { profile }                                    = useAuth();
  const { lots, satellites, ops, satOpVals, updateSatOpVal, users } = useData();
  const [tab,       setTab]       = useState('resumen');
  const [expanded,  setExpanded]  = useState(null);
  const [editingOp, setEditingOp] = useState(null);
  const [editVal,   setEditVal]   = useState('');

  const sat       = satellites.find((s) => s.id === profile.satId);
  const myLots    = lots.filter((l) => l.satId === profile.satId && l.status === 'costura');
  const myWorkers = users.filter((u) => u.satId === profile.satId && u.role === 'operario');

  // All garment types present in active lots
  const activeGtIds = [...new Set(myLots.flatMap((l) => l.garments.map((g) => g.gtId)))];
  const myOps = ops.filter((o) => activeGtIds.includes(o.gtId) && o.active);

  const getEffVal = (opId) => getOpVal(ops, satOpVals, profile.satId, opId);

  const saveCustomVal = (opId) => {
    updateSatOpVal(profile.satId, opId, editVal === '' ? null : +editVal);
    setEditingOp(null);
    setEditVal('');
    toast.success('Tarifa actualizada');
  };

  const resetVal = (opId) => {
    updateSatOpVal(profile.satId, opId, null);
    toast.success('Tarifa restablecida al valor global');
  };

  const workerOps = (wId) =>
    myLots.flatMap((l) =>
      l.lotOps?.filter((lo) => lo.wId === wId).map((lo) => ({
        ...lo, lotCode: l.code, lotId: l.id, satId: l.satId,
        op: ops.find((o) => o.id === lo.opId),
      }))
    );

  const TABS = [['resumen', 'Resumen'], ['operarios', 'Operarios'], ['tarifas', 'Mis Tarifas']];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl">🏭</div>
        <div>
          <h1 className="text-sm font-bold text-gray-900">{sat?.name || 'Mi Taller'}</h1>
          <p className="text-xs text-gray-400">{myWorkers.length} operarios · {sat?.city}</p>
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* ── RESUMEN ── */}
      {tab === 'resumen' && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Lotes activos"   value={myLots.length} sub="En costura" />
            <StatCard label="Operarios"        value={myWorkers.length} />
            <StatCard label="Piezas en curso" value={myLots.reduce((a, l) => a + l.totalPieces, 0).toLocaleString('es-CO')} />
          </div>

          {myLots.length === 0 && <EmptyState emoji="🏭" title="Sin lotes asignados" sub="Espera a que el Admin ELROHI te asigne un lote" />}

          <div className="space-y-3">
            {myLots.map((l) => {
              const prog    = lotProgress(l);
              const total   = lotTotalValue(l, ops, satOpVals);
              const paid    = lotDoneValue(l, ops, satOpVals);
              return (
                <div key={l.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-blue-700">{l.code}</span>
                      <p className="text-[10px] text-gray-400 mt-0.5">{l.totalPieces} piezas · Vence: {l.deadline}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">Valor total</p>
                      <p className="text-base font-black text-gray-800">{fmtM(total)}</p>
                    </div>
                  </div>
                  <ProgressBar value={prog} color={prog === 100 ? 'bg-green-500' : 'bg-blue-500'} />
                  <div className="flex gap-4 mt-2 text-[10px] text-gray-500">
                    <span className="text-green-600 font-medium">✓ Pagado: {fmtM(paid)}</span>
                    <span>⚡ {l.lotOps?.filter((o) => o.status === 'en_proceso').length || 0} activas</span>
                    <span>○ {l.lotOps?.filter((o) => o.status === 'pendiente').length || 0} pendientes</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── OPERARIOS ── */}
      {tab === 'operarios' && (
        <div className="space-y-2">
          {myWorkers.length === 0 && <EmptyState emoji="👥" title="Sin operarios registrados" />}
          {myWorkers.map((w) => {
            const wOps     = workerOps(w.id);
            const earnings = workerQuincena(w.id, lots, ops, satOpVals);
            const inProc   = wOps.filter((o) => o.status === 'en_proceso');
            const comp     = wOps.filter((o) => o.status === 'completado');
            const isOpen   = expanded === w.id;

            return (
              <div key={w.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                     onClick={() => setExpanded(isOpen ? null : w.id)}>
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                    {w.initials}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{w.name}</p>
                    <div className="flex gap-3 text-[10px] text-gray-500 mt-0.5">
                      {inProc.length > 0 && <span style={{ color: ACCENT }} className="font-semibold">⚡ {inProc.length} activa{inProc.length > 1 ? 's' : ''}</span>}
                      <span>✓ {comp.length} completadas</span>
                      {wOps.length === 0 && <span className="text-gray-300">Sin operaciones</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-gray-400">Quincena</p>
                    <p className="text-sm font-black text-green-600">{fmtM(earnings)}</p>
                  </div>
                  <span className="text-gray-400 text-sm" style={{ transform: isOpen ? 'rotate(90deg)' : '', display: 'inline-block', transition: 'transform .15s' }}>›</span>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    {wOps.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">Operario sin operaciones asignadas</p>
                    ) : (
                      <div className="space-y-1.5">
                        {wOps.map((lo) => {
                          const valUnit = getOpVal(ops, satOpVals, lo.satId, lo.opId);
                          const valTot  = valUnit * lo.qty;
                          const stCls   = { completado: 'bg-green-100 text-green-800', en_proceso: 'bg-blue-100 text-blue-800', pendiente: 'bg-gray-100 text-gray-600' };
                          return (
                            <div key={lo.id} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg text-xs">
                              <span className={`${stCls[lo.status]} px-2 py-0.5 rounded-full text-[9px] font-semibold min-w-[55px] text-center`}>
                                {lo.status === 'completado' ? '✓ Listo' : lo.status === 'en_proceso' ? '⚡ Activa' : 'Pend.'}
                              </span>
                              <span className="font-medium text-gray-800 flex-1">{lo.op?.name || lo.opId}</span>
                              <span className="text-gray-400 font-mono">{lo.qty} pzs × {fmtM(valUnit)}</span>
                              <span className="font-bold font-mono" style={{ color: lo.status === 'completado' ? '#10b981' : '#374151' }}>{fmtM(valTot)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── TARIFAS ── */}
      {tab === 'tarifas' && (
        <div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 text-xs text-blue-700">
            💡 Establece las tarifas de tu taller para cada operación. Si defines un valor, reemplaza la tarifa global solo para tu taller.
          </div>

          {activeGtIds.length === 0 && (
            <EmptyState emoji="⚙" title="Sin lotes activos" sub="Asigna un lote para ver las operaciones y editar tarifas" />
          )}

          {GARMENT_TYPES.filter((g) => activeGtIds.includes(g.id)).map((g) => (
            <div key={g.id} className="bg-white rounded-xl border border-gray-100 p-4 mb-3">
              <p className="text-xs font-bold text-gray-700 mb-3">{g.name}</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    {['Operación', 'Tarifa global', 'Tu tarifa', ''].map((c) => (
                      <th key={c} className="text-left px-2 py-1.5 text-[10px] text-gray-400 font-medium border-b border-gray-100">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myOps.filter((o) => o.gtId === g.id).map((op) => {
                    const globalVal = op.val;
                    const myVal     = satOpVals?.[profile.satId]?.[op.id];
                    const hasCustom = myVal !== undefined && myVal !== null;
                    const isEditing = editingOp === op.id;

                    return (
                      <tr key={op.id} className="border-b border-gray-50">
                        <td className="px-2 py-2 font-medium text-gray-800">{op.name}</td>
                        <td className="px-2 py-2 font-mono text-gray-500">{fmtM(globalVal)}</td>
                        <td className="px-2 py-2">
                          {isEditing ? (
                            <input autoFocus type="number" value={editVal}
                              onChange={(e) => setEditVal(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && saveCustomVal(op.id)}
                              className="w-24 border border-blue-400 rounded px-2 py-0.5 text-xs font-mono focus:outline-none" />
                          ) : (
                            <span className="font-mono" style={{ fontWeight: hasCustom ? 700 : 400, color: hasCustom ? ACCENT : '#9ca3af' }}>
                              {hasCustom ? fmtM(myVal) : '(igual global)'}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex gap-1.5">
                            {isEditing ? (
                              <>
                                <button onClick={() => saveCustomVal(op.id)} className="text-[9px] px-2 py-0.5 bg-green-100 text-green-700 rounded font-semibold">Guardar</button>
                                <button onClick={() => setEditingOp(null)} className="text-[9px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded">✕</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => { setEditingOp(op.id); setEditVal(getEffVal(op.id)); }}
                                  className="text-[9px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">Editar</button>
                                {hasCustom && (
                                  <button onClick={() => resetVal(op.id)}
                                    className="text-[9px] px-2 py-0.5 bg-red-50 text-red-500 rounded">Reset</button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
