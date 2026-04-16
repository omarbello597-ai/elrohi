import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { advanceLot, updateLotOp } from '../services/db';
import { LOT_STATUS, LOT_PRIORITY, GARMENT_TYPES, SIZES, ACCENT } from '../constants';
import {
  Modal, Select, Btn, ProgressBar, LotStatusBadge, PriorityBadge,
  LotSteps, PageHeader, EmptyState,
} from '../components/ui';
import { gLabel, cLabel, sLabel, uLabel, fmtM, lotProgress, getOpVal, lotTotalValue, lotDoneValue } from '../utils';
import toast from 'react-hot-toast';

export default function LotesScreen() {
  const { profile }                            = useAuth();
  const { lots, clients, satellites, ops, satOpVals, users } = useData();
  const [filter,   setFilter]   = useState('all');
  const [selLotId, setSelLotId] = useState(null);

  const filtered = filter === 'all' ? lots : lots.filter((l) => l.status === filter);
  const detail   = lots.find((l) => l.id === selLotId);

  if (detail) {
    return <LoteDetail lot={detail} lots={lots} clients={clients} satellites={satellites}
                       ops={ops} satOpVals={satOpVals} users={users} profile={profile}
                       onBack={() => setSelLotId(null)} />;
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h1 className="text-sm font-bold text-gray-900 flex-1">Control de Lotes</h1>
        {['all', ...Object.keys(LOT_STATUS)].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-2.5 py-1 rounded-full text-[10px] font-medium border-none cursor-pointer transition-colors"
            style={{ background: filter === f ? ACCENT : '#f1f0ec', color: filter === f ? '#fff' : '#6b7280' }}>
            {f === 'all' ? 'Todos' : LOT_STATUS[f]?.label || f}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <EmptyState emoji="📦" title="No hay lotes en este estado" />}

      <div className="space-y-2">
        {filtered.map((l) => {
          const prog  = lotProgress(l);
          const satN  = satellites.find((s) => s.id === l.satId)?.name;
          return (
            <div key={l.id} onClick={() => setSelLotId(l.id)}
              className="bg-white rounded-xl border border-gray-100 p-3 cursor-pointer hover:border-gray-300 transition-colors flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-blue-700">{l.code}</span>
                  <LotStatusBadge status={l.status} />
                  <PriorityBadge priority={l.priority} />
                </div>
                <p className="text-sm font-semibold text-gray-900 truncate">{cLabel(clients, l.clientId)}</p>
                <p className="text-[10px] text-gray-400">
                  {[...new Set(l.garments.map((g) => gLabel(g.gtId)))].join(', ')}
                  {' · '}{l.totalPieces?.toLocaleString('es-CO')} piezas
                  {satN && ' · ' + satN}
                </p>
              </div>
              {l.lotOps?.length > 0 && (
                <div className="w-24 flex-shrink-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-[9px] text-gray-400">Progreso</span>
                    <span className="text-[10px] font-bold text-gray-700">{prog}%</span>
                  </div>
                  <ProgressBar value={prog} color={prog === 100 ? 'bg-green-500' : prog > 50 ? 'bg-blue-500' : 'bg-amber-500'} />
                </div>
              )}
              <div className="text-right flex-shrink-0">
                <p className="text-[9px] text-gray-400">Vence</p>
                <p className="text-xs font-semibold" style={{ color: new Date(l.deadline) < new Date() ? '#dc2626' : '#374151' }}>
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

// ─── LOT DETAIL ──────────────────────────────────────────────────────────────
function LoteDetail({ lot, lots, clients, satellites, ops, satOpVals, users, profile, onBack }) {
  const [showAssign, setShowAssign] = useState(false);
  const [selSat,     setSelSat]     = useState('');

  const cl   = clients.find((c) => c.id === lot.clientId);
  const sat  = satellites.find((s) => s.id === lot.satId);
  const prog = lotProgress(lot);
  const totalVal = lotTotalValue(lot, ops, satOpVals);
  const doneVal  = lotDoneValue(lot, ops, satOpVals);

  const can = {
    corte:      ['corte', 'admin_elrohi', 'gerente'].includes(profile.role),
    asignacion: ['admin_elrohi', 'gerente'].includes(profile.role),
    tintoreria: ['tintoreria', 'admin_elrohi'].includes(profile.role),
    validacion: ['admin_elrohi', 'gerente'].includes(profile.role),
    pespunte:   ['pespunte', 'admin_elrohi'].includes(profile.role),
    bodega:     ['bodega', 'admin_elrohi'].includes(profile.role),
    reasignar:  ['admin_elrohi', 'gerente'].includes(profile.role),
  };

  const advance = async (action, extra = {}) => {
    try {
      await advanceLot(lot, action, ops, extra);
      toast.success('✅ Lote actualizado');
      if (action === 'asignar_sat') setShowAssign(false);
    } catch (e) { toast.error('Error al actualizar el lote'); }
  };

  const handleOpAction = async (loId, action) => {
    const today = new Date().toISOString().split('T')[0];
    try {
      if (action === 'tomar')     await updateLotOp(lot.id, loId, { wId: profile.id, status: 'en_proceso' });
      if (action === 'completar') await updateLotOp(lot.id, loId, { status: 'completado', done: today });
      toast.success('Operación actualizada');
    } catch (e) { toast.error('Error al actualizar'); }
  };

  return (
    <div>
      <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1">
        ← Volver a lotes
      </button>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-3">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-black text-blue-700">{lot.code}</span>
              <LotStatusBadge status={lot.status} />
              <PriorityBadge priority={lot.priority} />
            </div>
            <p className="text-base font-bold text-gray-900">{cl?.name}</p>
            <p className="text-xs text-gray-400">Creado: {lot.created} · Vence: {lot.deadline}{sat ? ' · ' + sat.name : ''}</p>
          </div>

          {lot.lotOps?.length > 0 && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Valor total del lote</p>
              <p className="text-lg font-black text-gray-800">{fmtM(totalVal)}</p>
              <p className="text-xs text-green-600">Pagado: {fmtM(doneVal)}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap mb-4">
          {lot.status === 'activacion' && can.corte && <Btn onClick={() => advance('a_corte')}>✂ Enviar a Corte</Btn>}
          {lot.status === 'corte' && can.corte && <Btn onClick={() => advance('a_asignacion')}>✓ Corte Listo → Asignar Satélite</Btn>}
          {lot.status === 'asignacion' && can.asignacion && <Btn onClick={() => setShowAssign(true)}>🏭 Asignar a Satélite</Btn>}
          {lot.status === 'tintoreria' && can.tintoreria && <Btn onClick={() => advance('de_tintoreria')}>✓ Tintorería Lista → Validación</Btn>}
          {lot.status === 'validacion' && can.validacion && <Btn onClick={() => advance('a_pespunte')}>🪡 Enviar a Pespunte</Btn>}
          {lot.status === 'pespunte' && can.pespunte && <Btn onClick={() => advance('a_bodega')}>📦 Ingresar a Bodega</Btn>}
          {lot.status === 'bodega' && can.bodega && <Btn onClick={() => advance('despachar')}>🚚 Despachar al Cliente</Btn>}
          {lot.status === 'costura' && can.reasignar && (
            <Btn variant="secondary" onClick={() => advance('reasignar')}>↩ Re-asignar Satélite</Btn>
          )}
        </div>

        {/* Progress steps */}
        <LotSteps status={lot.status} />
      </div>

      {/* Garments + Novelties */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Prendas del Lote</h3>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>{['Prenda', 'Tallas', 'Total'].map((c) => <th key={c} className="text-left px-2 py-1.5 text-gray-400 font-medium border-b border-gray-100">{c}</th>)}</tr>
            </thead>
            <tbody>
              {lot.garments.map((g, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-2 py-1.5 font-medium">{gLabel(g.gtId)}</td>
                  <td className="px-2 py-1.5 text-gray-500">
                    {Object.entries(g.sizes).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(' ')}
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
            {lot.novelties.map((n) => (
              <div key={n.id} className="bg-white rounded-lg p-2.5 mb-2 text-xs">
                <p className="text-red-600 font-semibold">{n.type === 'faltante' ? 'Faltante' : 'Novedad'}: {n.qty} unidades</p>
                <p className="text-gray-500">{n.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Operations */}
      {lot.lotOps?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Operaciones de Costura</h3>
            <span className="text-xs font-bold text-gray-700">{prog}% · {fmtM(totalVal)}</span>
          </div>
          <ProgressBar value={prog} color={prog === 100 ? 'bg-green-500' : 'bg-blue-500'} />

          <div className="mt-3 space-y-1.5">
            {lot.lotOps.map((lo) => {
              const op      = ops.find((o) => o.id === lo.opId);
              const worker  = users.find((u) => u.id === lo.wId);
              const valUnit = getOpVal(ops, satOpVals, lot.satId, lo.opId);
              const valTot  = valUnit * lo.qty;
              const stCls   = {
                completado: 'bg-green-100 text-green-800',
                en_proceso: 'bg-blue-100 text-blue-800',
                pendiente:  'bg-gray-100 text-gray-600',
              };

              const isMyOp = profile.role === 'operario' && (lo.wId === profile.id || lo.status === 'pendiente');

              return (
                <div key={lo.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-xs">
                  <span className={`${stCls[lo.status]} px-2 py-0.5 rounded-full text-[9px] font-semibold min-w-[60px] text-center`}>
                    {lo.status === 'completado' ? '✓ Listo' : lo.status === 'en_proceso' ? '⚡ Activa' : 'Pendiente'}
                  </span>
                  <span className="font-medium text-gray-800 flex-1">{op?.name || lo.opId}</span>
                  <span className="text-gray-400">{lo.qty} pzs</span>
                  <span className="font-mono text-gray-500">{fmtM(valUnit)}/pza</span>
                  <span className="font-mono font-bold" style={{ color: lo.status === 'completado' ? '#10b981' : '#374151' }}>{fmtM(valTot)}</span>
                  <span className="text-gray-400 min-w-[80px]">{worker?.name || 'Sin asignar'}</span>
                  {/* Actions for operario */}
                  {profile.role === 'operario' && lo.status === 'pendiente' && !lo.wId && (
                    <button onClick={() => handleOpAction(lo.id, 'tomar')}
                      className="text-[9px] px-2 py-0.5 rounded text-blue-700 bg-blue-100 hover:bg-blue-200 font-semibold">
                      Tomar
                    </button>
                  )}
                  {profile.role === 'operario' && lo.status === 'en_proceso' && lo.wId === profile.id && (
                    <button onClick={() => handleOpAction(lo.id, 'completar')}
                      className="text-[9px] px-2 py-0.5 rounded text-green-700 bg-green-100 hover:bg-green-200 font-semibold">
                      Terminé
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assign satellite modal */}
      {showAssign && (
        <Modal title="Asignar a Satélite" onClose={() => setShowAssign(false)}>
          <p className="text-sm text-gray-500 mb-3">{lot.code} · {lot.totalPieces?.toLocaleString('es-CO')} piezas</p>
          <Select label="Seleccionar Satélite" value={selSat} onChange={(e) => setSelSat(e.target.value)}>
            <option value="">— Elegir satélite —</option>
            {satellites.filter((s) => s.active).map((s) => {
              const activeLots = lots.filter((l) => l.satId === s.id && l.status === 'costura').length;
              return <option key={s.id} value={s.id}>{s.name} ({s.city}) — {activeLots} lotes activos</option>;
            })}
          </Select>
          <div className="flex gap-2 mt-3">
            <Btn variant="secondary" onClick={() => setShowAssign(false)} className="flex-1">Cancelar</Btn>
            <Btn onClick={() => advance('asignar_sat', { satId: selSat })} disabled={!selSat} className="flex-1">Asignar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
