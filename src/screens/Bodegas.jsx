import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { updateDocument } from '../services/db';
import { LOT_PRIORITY, ACCENT } from '../constants';
import { EmptyState, ProgressBar } from '../components/ui';
import { gLabel, cLabel, fmtM, getOpVal } from '../utils';
import toast from 'react-hot-toast';

const BODEGAS = [
  { key: 'en_bodega_1', label: 'Bodega 1', color: '#059669', bg: '#d1fae5', border: '#6ee7b7' },
  { key: 'en_bodega_2', label: 'Bodega 2', color: '#0d9488', bg: '#ccfbf1', border: '#5eead4' },
];

export default function BodegasScreen() {
  const { profile }              = useAuth();
  const { lots, clients, ops, satOpVals } = useData();
  const [activeTab, setActiveTab] = useState('en_bodega_1');

  const isAdmin = ['gerente','admin_elrohi'].includes(profile?.role);

  // Lotes que llegan de tintorería listos para asignar bodega
  const readyLots = lots.filter(l => l.status === 'listo_bodega');

  // Lotes en cada bodega
  const bodegas1 = lots.filter(l => l.status === 'en_bodega_1');
  const bodegas2 = lots.filter(l => l.status === 'en_bodega_2');
  const enOps    = lots.filter(l => l.status === 'en_operaciones');

  const assignBodega = async (lotId, bodega) => {
    try {
      await updateDocument('lots', lotId, { status: bodega });
      toast.success(`Lote asignado a ${BODEGAS.find(b => b.key === bodega)?.label}`);
    } catch { toast.error('Error'); }
  };

  const sendToOps = async (lotId) => {
    try {
      await updateDocument('lots', lotId, { status: 'en_operaciones' });
      toast.success('Lote enviado a Operaciones ELROHI');
    } catch { toast.error('Error'); }
  };

  const currentLots = activeTab === 'en_bodega_1' ? bodegas1 : bodegas2;
  const activeBodega = BODEGAS.find(b => b.key === activeTab);

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Bodegas ELROHI</h1>

      {/* Listos para asignar bodega */}
      {isAdmin && readyLots.length > 0 && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 mb-5">
          <p className="text-xs font-bold text-cyan-700 uppercase tracking-wider mb-3">
            📥 Lotes llegando de Tintorería — Asignar bodega ({readyLots.length})
          </p>
          <div className="space-y-2">
            {readyLots.map(lot => (
              <div key={lot.id} className="bg-white rounded-xl border border-cyan-200 p-3 flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                    <span className={`${LOT_PRIORITY[lot.priority]?.cls} px-1.5 py-0.5 rounded-full text-[9px] font-semibold`}>
                      {LOT_PRIORITY[lot.priority]?.label}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-gray-800">{cLabel(clients, lot.clientId)}</p>
                  <p className="text-[10px] text-gray-400">{lot.totalPieces?.toLocaleString('es-CO')} piezas</p>
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap">
                  <button onClick={() => assignBodega(lot.id, 'en_bodega_1')}
                    className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: '#059669' }}>
                    → Bodega 1
                  </button>
                  <button onClick={() => assignBodega(lot.id, 'en_bodega_2')}
                    className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: '#0d9488' }}>
                    → Bodega 2
                  </button>
                  <button onClick={() => sendToOps(lot.id)}
                    className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: '#7c3aed' }}>
                    ⚡ Directo a Ops
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          ['Bodega 1', bodegas1.length, '#059669'],
          ['Bodega 2', bodegas2.length, '#0d9488'],
          ['En Operaciones', enOps.length, '#7c3aed'],
        ].map(([l, v, c]) => (
          <div key={l} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-2xl font-black" style={{ color: c }}>{v}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{l}</p>
          </div>
        ))}
      </div>

      {/* Tabs bodegas */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {BODEGAS.map(b => (
          <button key={b.key} onClick={() => setActiveTab(b.key)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{ background: activeTab === b.key ? '#fff' : 'transparent', color: activeTab === b.key ? '#111827' : '#6b7280', fontWeight: activeTab === b.key ? 700 : 400, boxShadow: activeTab === b.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {b.label} ({b.key === 'en_bodega_1' ? bodegas1.length : bodegas2.length})
          </button>
        ))}
      </div>

      {/* Lotes en bodega activa */}
      {currentLots.length === 0 ? (
        <EmptyState emoji="📦" title={`${activeBodega?.label} vacía`} sub="No hay lotes almacenados aquí" />
      ) : (
        <div className="space-y-2">
          {currentLots.map(lot => {
            const prog = lot.opsElrohi?.length > 0
              ? Math.round(lot.opsElrohi.flatMap(o => o.assignments || []).filter(a => a.status === 'completado').length /
                  Math.max(1, lot.opsElrohi.flatMap(o => o.assignments || []).length) * 100)
              : 0;

            return (
              <div key={lot.id} className="bg-white rounded-xl border-2 p-4" style={{ borderColor: activeBodega?.border }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                      <span className={`${LOT_PRIORITY[lot.priority]?.cls} px-1.5 py-0.5 rounded-full text-[9px] font-semibold`}>
                        {LOT_PRIORITY[lot.priority]?.label}
                      </span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: activeBodega?.bg, color: activeBodega?.color }}>
                        {activeBodega?.label}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{cLabel(clients, lot.clientId)}</p>
                    <p className="text-[10px] text-gray-400">
                      {[...new Set(lot.garments?.map(g => gLabel(g.gtId)))].join(', ')}
                      {' · '}{lot.totalPieces?.toLocaleString('es-CO')} piezas · Vence: {lot.deadline}
                    </p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => sendToOps(lot.id)}
                      className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white flex-shrink-0"
                      style={{ background: '#7c3aed' }}>
                      ⚡ Enviar a Operaciones
                    </button>
                  )}
                </div>

                {lot.opsElrohi?.length > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-[9px] text-gray-400">Operaciones</span>
                      <span className="text-[10px] font-bold text-gray-600">{prog}%</span>
                    </div>
                    <ProgressBar value={prog} color={prog === 100 ? 'bg-green-500' : 'bg-purple-500'} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
