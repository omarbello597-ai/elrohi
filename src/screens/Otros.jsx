import { useState }    from 'react';
import { useAuth }     from '../contexts/AuthContext';
import { useData }     from '../contexts/DataContext';
import { saveSatellite, toggleSatellite, saveOperation, toggleOperation, updateSupply } from '../services/db';
import { Modal, Input, Select, Btn, PageHeader, EmptyState, ProgressBar, StatCard } from '../components/ui';
import { fmtM, gLabel, lotProgress, workerQuincena, getOpVal } from '../utils';
import { GARMENT_TYPES, SIZES, ACCENT } from '../constants';
import toast from 'react-hot-toast';

// ─── SATÉLITES ────────────────────────────────────────────────────────────────
export function SatelitesScreen() {
  const { profile }            = useAuth();
  const { satellites, lots, users, ops, setOps } = useData();
  const [showNew,  setShowNew] = useState(false);
  const [showOps,  setShowOps] = useState(false);
  const [form, setForm]        = useState({ name: '', city: '', phone: '', cap: 10 });
  const [newOp, setNewOp]      = useState({ gtId: 'gt1', name: '', val: '' });

  const canEdit = ['gerente', 'admin_elrohi'].includes(profile.role);

  const createSat = async () => {
    if (!form.name) return;
    try {
      await saveSatellite({ name: form.name, city: form.city, phone: form.phone, cap: +form.cap, active: true, adminId: null });
      toast.success('Satélite creado');
      setShowNew(false);
      setForm({ name: '', city: '', phone: '', cap: 10 });
    } catch { toast.error('Error al crear'); }
  };

  const addOp = async () => {
    if (!newOp.name || !newOp.val) return;
    try {
      await saveOperation({ gtId: newOp.gtId, name: newOp.name, val: +newOp.val, active: true });
      toast.success('Operación agregada');
      setNewOp((f) => ({ ...f, name: '', val: '' }));
    } catch { toast.error('Error'); }
  };

  return (
    <div>
      <PageHeader title="Red de Satélites" action={canEdit && (
        <div className="flex gap-2">
          <button onClick={() => setShowOps(true)} className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">⚙ Operaciones</button>
          <Btn onClick={() => setShowNew(true)}>+  Nuevo Satélite</Btn>
        </div>
      )} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {satellites.map((s) => {
          const satLots   = lots.filter((l) => l.satId === s.id && l.status === 'costura');
          const satWorkers = users.filter((u) => u.satId === s.id && u.role === 'operario');
          const admin     = users.find((u) => u.id === s.adminId);
          return (
            <div key={s.id} className="bg-white rounded-xl border p-4" style={{ borderColor: s.active ? '#f1f0ec' : '#fecaca', opacity: s.active ? 1 : 0.75 }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-lg flex-shrink-0">🏭</div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{s.name}</p>
                    <p className="text-[10px] text-gray-400">{s.city} · Cap. {s.cap}{admin ? ' · ' + admin.name : ''}</p>
                  </div>
                </div>
                {canEdit && (
                  <button onClick={() => toggleSatellite(s.id, !s.active)}
                    className={`px-2.5 py-1 rounded-full text-[9px] font-bold border-none cursor-pointer ${s.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {s.active ? 'Activo' : 'Inactivo'}
                  </button>
                )}
              </div>
              <div className="flex gap-4 text-[10px] bg-gray-50 rounded-lg px-3 py-2">
                <span className="font-semibold text-blue-600">{satLots.length} lotes activos</span>
                <span className="text-gray-500">{satWorkers.length} operarios</span>
                {satLots.length > 0 && (
                  <div className="flex items-center gap-1 flex-1">
                    <ProgressBar value={satLots.reduce((a, l) => a + lotProgress(l), 0) / satLots.length} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showNew && (
        <Modal title="Nuevo Satélite" onClose={() => setShowNew(false)}>
          <Input label="Nombre" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Taller Rodríguez" />
          <Input label="Ciudad" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Bogotá" />
          <Input label="Teléfono" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <Input label="Capacidad (operarios)" type="number" value={form.cap} onChange={(e) => setForm((f) => ({ ...f, cap: e.target.value }))} />
          <div className="flex gap-2 mt-2">
            <Btn variant="secondary" onClick={() => setShowNew(false)} className="flex-1">Cancelar</Btn>
            <Btn onClick={createSat} className="flex-1">Crear Satélite</Btn>
          </div>
        </Modal>
      )}

      {showOps && (
        <Modal title="Operaciones Globales" onClose={() => setShowOps(false)} wide>
          <div className="flex gap-2 mb-4 flex-wrap items-end bg-gray-50 p-3 rounded-lg">
            <Select value={newOp.gtId} onChange={(e) => setNewOp((f) => ({ ...f, gtId: e.target.value }))}>
              {GARMENT_TYPES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
            <div className="flex-1 min-w-32">
              <Input value={newOp.name} onChange={(e) => setNewOp((f) => ({ ...f, name: e.target.value }))} placeholder="Nombre operación" />
            </div>
            <div className="w-24">
              <Input type="number" value={newOp.val} onChange={(e) => setNewOp((f) => ({ ...f, val: e.target.value }))} placeholder="$ Valor" />
            </div>
            <Btn onClick={addOp} size="sm">+ Agregar</Btn>
          </div>
          {GARMENT_TYPES.map((g) => (
            <div key={g.id} className="mb-3">
              <p className="text-xs font-bold text-gray-600 mb-1.5">{g.name}</p>
              {ops.filter((o) => o.gtId === g.id).map((op) => (
                <div key={op.id} className="flex items-center gap-2 py-1.5 px-2 rounded text-xs" style={{ background: op.active ? '#f9f9f7' : '#fef2f2' }}>
                  <span className="flex-1 font-medium" style={{ color: op.active ? '#374151' : '#9ca3af' }}>{op.name}</span>
                  <span className="font-mono text-green-700 font-bold">{fmtM(op.val)}</span>
                  <button onClick={() => toggleOperation(op.id, !op.active)}
                    className={`text-[9px] px-2 py-0.5 rounded font-semibold ${op.active ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                    {op.active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}

// ─── INVENTARIO ───────────────────────────────────────────────────────────────
export function InventarioScreen() {
  const { invGarments, supplies } = useData();
  const [tab, setTab] = useState('prendas');
  const alertSup = supplies.filter((s) => s.qty <= s.min);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-sm font-bold text-gray-900 flex-1">Inventario</h1>
        {alertSup.length > 0 && <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-full">⚠ {alertSup.length} insumos bajos</span>}
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {[['prendas', 'Prendas'], ['insumos', 'Insumos']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{ background: tab === k ? '#fff' : 'transparent', color: tab === k ? '#111827' : '#6b7280', fontWeight: tab === k ? 700 : 400 }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {tab === 'prendas' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead><tr className="bg-gray-50">{['Prenda', ...SIZES, 'TOTAL'].map((c) => <th key={c} className="text-left px-3 py-2 text-[10px] text-gray-400 font-medium">{c}</th>)}</tr></thead>
            <tbody>
              {GARMENT_TYPES.map((g) => {
                const row = invGarments[g.id] || {};
                const total = Object.values(row).reduce((a, b) => a + b, 0);
                return (
                  <tr key={g.id} className="border-t border-gray-50">
                    <td className="px-3 py-2.5 font-medium text-gray-800">{g.name}</td>
                    {SIZES.map((sz) => <td key={sz} className="px-3 py-2.5 text-center" style={{ color: (row[sz] || 0) === 0 ? '#e5e7eb' : (row[sz] || 0) > 10 ? '#374151' : '#f59e0b', fontWeight: (row[sz] || 0) > 10 ? 600 : 400 }}>{row[sz] || 0}</td>)}
                    <td className="px-3 py-2.5 text-center font-bold text-gray-900">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'insumos' && (
        <div className="space-y-2">
          {supplies.map((s) => {
            const pct   = Math.min(100, Math.round((s.qty / Math.max(1, s.min * 2)) * 100));
            const isLow = s.qty <= s.min;
            return (
              <div key={s.id} className="bg-white rounded-xl border p-3 flex items-center gap-3" style={{ borderColor: isLow ? '#fecaca' : '#f1f0ec' }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold" style={{ color: isLow ? '#dc2626' : '#111827' }}>{s.name}</span>
                    {isLow && <span className="text-[9px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full font-bold">⚠ BAJO</span>}
                  </div>
                  <ProgressBar value={pct} color={isLow ? 'bg-red-400' : 'bg-blue-400'} />
                  <p className="text-[9px] text-gray-400 mt-1">{s.qty} {s.unit} disponibles · mínimo {s.min} {s.unit}</p>
                </div>
                {isLow && <button className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 font-medium whitespace-nowrap">Solicitar compra</button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── NÓMINA ───────────────────────────────────────────────────────────────────
export function NominaScreen() {
  const { lots, satellites, ops, satOpVals, users } = useData();

  const summary = satellites.filter((s) => s.active).map((s) => {
    const satLots    = lots.filter((l) => l.satId === s.id);
    const satWorkers = users.filter((u) => u.satId === s.id && u.role === 'operario');

    // ✅ Total = valor_efectivo × piezas por cada operación completada
    const total = satLots.flatMap((l) =>
      (l.lotOps || []).filter((lo) => lo.status === 'completado').map((lo) => ({ ...lo, satId: l.satId }))
    ).reduce((acc, lo) => acc + getOpVal(ops, satOpVals, lo.satId, lo.opId) * lo.qty, 0);

    const compOps = satLots.flatMap((l) => (l.lotOps || []).filter((lo) => lo.status === 'completado')).length;

    // Worker breakdown
    const workerBreakdown = satWorkers.map((w) => ({
      ...w, earnings: workerQuincena(w.id, lots, ops, satOpVals),
    }));

    return { ...s, total, compOps, workerBreakdown };
  }).sort((a, b) => b.total - a.total);

  const grand = summary.reduce((a, s) => a + s.total, 0);
  const [expanded, setExpanded] = useState(null);

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Nómina — Quincena Actual</h1>

      {/* Grand total */}
      <div className="rounded-2xl p-5 mb-5 text-white" style={{ background: 'linear-gradient(135deg,#1e2d45,#2d4a6e)' }}>
        <p className="text-xs text-blue-300 uppercase tracking-wider mb-1">Total a pagar</p>
        <p className="text-3xl font-black" style={{ letterSpacing: '-0.04em' }}>{fmtM(grand)}</p>
        <p className="text-xs text-blue-300 mt-1">
          {summary.reduce((a, s) => a + s.compOps, 0)} operaciones · {summary.length} satélites activos
        </p>
      </div>

      {/* Satellite breakdown */}
      <div className="space-y-2">
        {summary.map((s) => (
          <div key={s.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                 onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-lg flex-shrink-0">🏭</div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{s.name}</p>
                <p className="text-[10px] text-gray-400">{s.city} · {s.workerBreakdown.length} operarios · {s.compOps} ops completadas</p>
              </div>
              <div className="text-right mr-2">
                <p className="text-[9px] text-gray-400">Monto</p>
                <p className="text-base font-black text-green-600">{fmtM(s.total)}</p>
              </div>
              <button className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-[10px] font-bold hover:bg-green-200">Pagar</button>
            </div>

            {expanded === s.id && s.workerBreakdown.length > 0 && (
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-2">Desglose por operario</p>
                <div className="space-y-1.5">
                  {s.workerBreakdown.map((w) => (
                    <div key={w.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 text-xs">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-700">{w.initials}</div>
                      <span className="flex-1 font-medium text-gray-800">{w.name}</span>
                      <span className="font-bold text-green-600 font-mono">{fmtM(w.earnings)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CONFIG ───────────────────────────────────────────────────────────────────
export function ConfigScreen() {
  const { ops, satellites } = useData();

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Configuración del Sistema</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Tipos de Prenda y Operaciones</p>
          {GARMENT_TYPES.map((g) => {
            const gtOps   = ops.filter((o) => o.gtId === g.id && o.active);
            const totalVal = gtOps.reduce((a, o) => a + o.val, 0);
            return (
              <div key={g.id} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg mb-1.5">
                <div>
                  <p className="text-xs font-semibold text-gray-800">{g.name}</p>
                  <p className="text-[9px] text-gray-400">{g.g === 'H' ? 'Hombre' : 'Mujer'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500">{gtOps.length} operaciones</p>
                  <p className="text-xs font-bold text-green-600">{fmtM(totalVal)}/prenda</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Satélites Registrados</p>
          {satellites.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg mb-1.5">
              <p className="text-xs font-medium text-gray-800">{s.name}</p>
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${s.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {s.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
