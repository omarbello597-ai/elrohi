import { useData }       from '../contexts/DataContext';
import { advanceLot }    from '../services/db';
import { EmptyState }    from '../components/ui';
import { cLabel }        from '../utils';
import { LOT_PRIORITY, ACCENT } from '../constants';
import toast from 'react-hot-toast';

// ─── SHARED LOT CARD ─────────────────────────────────────────────────────────
function LotCard({ lot, clients, accentColor = ACCENT, children }) {
  const pr = LOT_PRIORITY[lot.priority];
  return (
    <div className="bg-white rounded-xl border-2 p-4" style={{ borderColor: accentColor + '33' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-black" style={{ color: accentColor }}>{lot.code}</span>
            <span className={`${pr.cls} px-2 py-0.5 rounded-full text-[9px] font-semibold`}>{pr.label}</span>
          </div>
          <p className="text-sm font-semibold text-gray-900">{cLabel(clients, lot.clientId)}</p>
          <p className="text-[10px] text-gray-400">{lot.totalPieces?.toLocaleString('es-CO')} piezas · Vence: {lot.deadline}</p>
          {lot.notes && <p className="text-[10px] text-gray-500 mt-1 italic">"{lot.notes}"</p>}
        </div>
        <div className="flex-shrink-0">{children}</div>
      </div>
    </div>
  );
}

// ─── CORTE ───────────────────────────────────────────────────────────────────
export function CorteScreen() {
  const { lots, clients } = useData();
  const queue = lots.filter((l) => ['activacion', 'corte'].includes(l.status));

  const advance = async (lot, action) => {
    try { await advanceLot(lot, action, []); toast.success('Lote actualizado'); }
    catch { toast.error('Error al actualizar'); }
  };

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Área de Corte</h1>
      {queue.length === 0 && <EmptyState emoji="✂" title="Sin lotes en cola" sub="¡Todo al día! No hay lotes pendientes de corte 🎉" />}
      <div className="space-y-3">
        {queue.map((l) => (
          <LotCard key={l.id} lot={l} clients={clients} accentColor="#ea580c">
            <div className="flex flex-col gap-2">
              {l.status === 'activacion' && (
                <button onClick={() => advance(l, 'a_corte')}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600">
                  ▶ Activar Corte
                </button>
              )}
              {l.status === 'corte' && (
                <button onClick={() => advance(l, 'a_asignacion')}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700">
                  ✓ Corte Listo
                </button>
              )}
            </div>
          </LotCard>
        ))}
      </div>
    </div>
  );
}

// ─── TINTORERÍA ──────────────────────────────────────────────────────────────
export function TintoriaScreen() {
  const { lots, clients } = useData();
  const queue = lots.filter((l) => l.status === 'tintoreria');

  const advance = async (lot) => {
    try { await advanceLot(lot, 'de_tintoreria', []); toast.success('Lote enviado a validación'); }
    catch { toast.error('Error al actualizar'); }
  };

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Área de Tintorería</h1>
      {queue.length === 0 && <EmptyState emoji="🎨" title="Sin lotes en tintorería" sub="No hay lotes en proceso de tinte actualmente" />}
      <div className="space-y-3">
        {queue.map((l) => (
          <LotCard key={l.id} lot={l} clients={clients} accentColor="#4f46e5">
            <button onClick={() => advance(l)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">
              ✓ Proceso Listo
            </button>
          </LotCard>
        ))}
      </div>
    </div>
  );
}

// ─── PESPUNTE ────────────────────────────────────────────────────────────────
export function PespunteScreen() {
  const { lots, clients } = useData();
  const queue = lots.filter((l) => l.status === 'pespunte');

  const advance = async (lot) => {
    try { await advanceLot(lot, 'a_bodega', []); toast.success('Lote ingresado a bodega'); }
    catch { toast.error('Error al actualizar'); }
  };

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Área de Pespunte</h1>
      <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 mb-4 text-xs text-pink-700">
        🪡 Operaciones de pespunte: <strong>Planchar → Poner botones → Doblar → Empacar</strong>
      </div>
      {queue.length === 0 && <EmptyState emoji="🪡" title="Sin lotes en pespunte" sub="No hay lotes pendientes de terminación" />}
      <div className="space-y-3">
        {queue.map((l) => (
          <LotCard key={l.id} lot={l} clients={clients} accentColor="#db2777">
            <button onClick={() => advance(l)}
              className="px-4 py-2 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600">
              📦 Enviar a Bodega
            </button>
          </LotCard>
        ))}
      </div>
    </div>
  );
}

// ─── BODEGA ──────────────────────────────────────────────────────────────────
export function BodegaScreen() {
  const { lots, clients } = useData();
  const inBodega    = lots.filter((l) => l.status === 'bodega');
  const dispatched  = lots.filter((l) => l.status === 'despachado');

  const dispatch = async (lot) => {
    try { await advanceLot(lot, 'despachar', []); toast.success('Lote despachado al cliente'); }
    catch { toast.error('Error al despachar'); }
  };

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Bodega — Stock y Despacho</h1>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-black text-gray-900">{inBodega.length}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Lotes en bodega</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-black text-gray-900">{inBodega.reduce((a, l) => a + l.totalPieces, 0).toLocaleString('es-CO')}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Piezas disponibles</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-black text-gray-900">{dispatched.length}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Despachados</p>
        </div>
      </div>

      {/* In stock */}
      {inBodega.length > 0 && (
        <div className="mb-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Listos para despacho</p>
          <div className="space-y-2">
            {inBodega.map((l) => (
              <LotCard key={l.id} lot={l} clients={clients} accentColor="#16a34a">
                <div>
                  {l.novelties?.length > 0 && (
                    <p className="text-[9px] text-red-500 font-semibold mb-1">⚠ {l.novelties.length} novedad{l.novelties.length > 1 ? 'es' : ''}</p>
                  )}
                  <button onClick={() => dispatch(l)}
                    className="px-4 py-2 text-white rounded-lg text-xs font-bold"
                    style={{ background: ACCENT }}>
                    🚚 Despachar
                  </button>
                </div>
              </LotCard>
            ))}
          </div>
        </div>
      )}

      {/* Dispatch history */}
      {dispatched.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Historial de despachos</p>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-gray-50">{['Código', 'Cliente', 'Piezas', 'Vence'].map((c) => <th key={c} className="text-left px-3 py-2 text-[10px] text-gray-400 font-medium">{c}</th>)}</tr></thead>
              <tbody>
                {dispatched.map((l) => (
                  <tr key={l.id} className="border-t border-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-400">{l.code}</td>
                    <td className="px-3 py-2 text-gray-600">{cLabel(clients, l.clientId)}</td>
                    <td className="px-3 py-2 text-gray-600">{l.totalPieces?.toLocaleString('es-CO')}</td>
                    <td className="px-3 py-2 text-gray-400">{l.deadline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {inBodega.length === 0 && dispatched.length === 0 && (
        <EmptyState emoji="📫" title="Bodega vacía" sub="Los lotes completados aparecerán aquí" />
      )}
    </div>
  );
}
