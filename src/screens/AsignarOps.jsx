import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { updateLotOp } from '../services/db';
import { Modal, EmptyState } from '../components/ui';
import { fmtM, getOpVal, lotProgress } from '../utils';
import toast from 'react-hot-toast';

export default function AsignarOpsScreen() {
  const { profile }                              = useAuth();
  const { lots, ops, satOpVals, users }          = useData();
  const [selLotId, setSelLotId]                  = useState(null);
  const [assigning, setAssigning]                = useState(null); // loId being assigned

  const myLots    = lots.filter((l) => l.satId === profile.satId && l.status === 'costura');
  const myWorkers = users.filter((u) => u.satId === profile.satId && u.role === 'operario');
  const lot       = myLots.find((l) => l.id === (selLotId || myLots[0]?.id));

  const assign = async (loId, wId) => {
    try {
      await updateLotOp(lot.id, loId, { wId, status: 'en_proceso' });
      toast.success('Operación asignada');
      setAssigning(null);
    } catch { toast.error('Error al asignar'); }
  };

  if (myLots.length === 0) return <EmptyState emoji="🔧" title="Sin cortes activos" sub="Cuando el Admin ELROHI te asigne un corte aparecerá aquí" />;

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Asignar Operaciones a Operarios</h1>

      {/* Lot selector */}
      {myLots.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {myLots.map((l) => (
            <button key={l.id} onClick={() => setSelLotId(l.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border-none cursor-pointer"
              style={{ background: (selLotId || myLots[0]?.id) === l.id ? '#e85d26' : '#f1f0ec', color: (selLotId || myLots[0]?.id) === l.id ? '#fff' : '#374151' }}>
              {l.code}
            </button>
          ))}
        </div>
      )}

      {lot && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Operations list */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Operaciones del corte</p>
              <span className="text-xs font-bold text-gray-700">{lotProgress(lot)}% completado</span>
            </div>
            <div className="space-y-1.5">
              {lot.lotOps?.map((lo) => {
                const op      = ops.find((o) => o.id === lo.opId);
                const worker  = users.find((u) => u.id === lo.wId);
                const valUnit = getOpVal(ops, satOpVals, lot.satId, lo.opId);
                const valTot  = valUnit * lo.qty;
                const stCls   = { completado: 'bg-green-100 text-green-800', en_proceso: 'bg-blue-100 text-blue-800', pendiente: 'bg-gray-100 text-gray-600' };
                return (
                  <div key={lo.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-xs">
                    <span className={`${stCls[lo.status]} px-2 py-0.5 rounded-full text-[9px] font-semibold min-w-[55px] text-center`}>
                      {lo.status === 'completado' ? '✓ Listo' : lo.status === 'en_proceso' ? '⚡ Activa' : 'Pend.'}
                    </span>
                    <span className="font-medium text-gray-800 flex-1">{op?.name || lo.opId}</span>
                    <span className="font-mono text-gray-500">{fmtM(valTot)}</span>
                    <span className="text-gray-400 min-w-[70px] text-right">{worker?.name || 'Sin asignar'}</span>
                    {lo.status === 'pendiente' && (
                      <button onClick={() => setAssigning(lo.id)}
                        className="text-[9px] bg-blue-50 text-blue-700 hover:bg-blue-100 rounded px-2 py-0.5 font-semibold">
                        Asignar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Workers */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Mis Operarios</p>
            <div className="space-y-2">
              {myWorkers.map((w) => {
                const active = lot.lotOps?.filter((lo) => lo.wId === w.id && lo.status !== 'completado').length || 0;
                const done   = lot.lotOps?.filter((lo) => lo.wId === w.id && lo.status === 'completado').length || 0;
                return (
                  <div key={w.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 flex-shrink-0">
                      {w.initials}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-900">{w.name}</p>
                      <p className="text-[9px] text-gray-400">{active} activas · {done} listas</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assigning && lot && (
        <Modal title="Asignar Operario" onClose={() => setAssigning(null)}>
          <p className="text-sm text-gray-600 mb-3">
            {ops.find((o) => o.id === lot.lotOps?.find((lo) => lo.id === assigning)?.opId)?.name}
          </p>
          <div className="space-y-2">
            {myWorkers.map((w) => (
              <button key={w.id} onClick={() => assign(assigning, w.id)}
                className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-left transition-colors">
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                  {w.initials}
                </div>
                <span className="text-sm font-medium text-gray-900">{w.name}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
