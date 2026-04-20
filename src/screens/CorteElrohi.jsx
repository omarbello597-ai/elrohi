import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { addDocument, updateDocument } from '../services/db';
import { GARMENT_TYPES, SIZES, LOT_PRIORITY, ACCENT } from '../constants';
import { Modal, Select, Btn, EmptyState } from '../components/ui';
import { gLabel, genLotCode, today } from '../utils';
import toast from 'react-hot-toast';

const CORTE_STATES = [
  { key: 'nuevo',                 label: 'Nuevo',                 cls: 'bg-gray-100 text-gray-600'     },
  { key: 'recibido_alistamiento', label: 'Recibido Alistamiento', cls: 'bg-blue-100 text-blue-700'     },
  { key: 'en_corte',              label: 'En Corte',              cls: 'bg-orange-100 text-orange-800' },
  { key: 'entregar_admin',        label: 'Entregar a Admin',      cls: 'bg-amber-100 text-amber-800'   },
];

const nextStateMap = {
  nuevo:                 { next: 'recibido_alistamiento', label: '📥 Recibir para alistamiento', color: '#2563eb' },
  recibido_alistamiento: { next: 'en_corte',              label: '✂ Iniciar corte',              color: '#ea580c' },
  en_corte:              { next: 'entregar_admin',        label: '📦 Entregar al Admin',          color: '#d97706' },
};

export default function CorteElrohiScreen() {
  const { profile }         = useAuth();
  const { lots }            = useData();
  const [filterStatus, setFilter] = useState('all');
  const [showNew, setShowNew]     = useState(false);
  const [saving,  setSaving]      = useState(false);

  const isAdmin = ['gerente','admin_elrohi'].includes(profile?.role);
  const isCorte = profile?.role === 'corte' || isAdmin;

  const corteLots = lots.filter(l =>
    ['nuevo','recibido_alistamiento','en_corte','entregar_admin'].includes(l.status)
  );

  const filtered = filterStatus === 'all'
    ? corteLots
    : corteLots.filter(l => l.status === filterStatus);

  // ─── FORM ────────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    descripcion: '', deadline: '', priority: 'normal', notes: '',
    items: [{ gtId: 'gt1', sizes: {}, total: 0 }],
  });

  const addItem = () =>
    setForm(f => ({ ...f, items: [...f.items, { gtId: 'gt1', sizes: {}, total: 0 }] }));

  const removeItem = (i) =>
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const updItem = (i, k, v) =>
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [k]: v };
      if (k === 'sizes') items[i].total = Object.values(v).reduce((a, b) => a + (+b || 0), 0);
      return { ...f, items };
    });

  const createLot = async () => {
    if (!form.deadline) { toast.error('Selecciona la fecha límite'); return; }
    const total = form.items.reduce((a, i) => a + i.total, 0);
    if (total === 0) { toast.error('Agrega al menos una prenda con cantidades'); return; }
    setSaving(true);
    try {
      const code = genLotCode();
      await addDocument('lots', {
        code,
        descripcion:  form.descripcion || code,
        clientId:     null,
        status:       'nuevo',
        priority:     form.priority,
        satId:        null,
        created:      today(),
        deadline:     form.deadline,
        garments:     form.items.filter(i => i.total > 0),
        totalPieces:  total,
        lotOps:       [],
        opsElrohi:    [],
        notes:        form.notes,
        novelties:    [],
        bodega:       null,
        createdBy:    profile?.id,
      });
      toast.success(`✅ Lote ${code} creado`);
      setShowNew(false);
      setForm({ descripcion: '', deadline: '', priority: 'normal', notes: '', items: [{ gtId: 'gt1', sizes: {}, total: 0 }] });
    } catch(e) { console.error(e); toast.error('Error al crear'); }
    finally { setSaving(false); }
  };

  const advance = async (lot, nextStatus) => {
    try {
      await updateDocument('lots', lot.id, { status: nextStatus });
      toast.success('Estado actualizado');
    } catch { toast.error('Error'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold text-gray-900">Área de Corte</h1>
        {isCorte && (
          <button onClick={() => setShowNew(true)}
            className="px-4 py-2 text-white rounded-lg text-xs font-bold"
            style={{ background: ACCENT }}>
            + Nuevo Lote de Corte
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {[['all', `Todos (${corteLots.length})`], ...CORTE_STATES.map(s => [s.key, `${s.label} (${corteLots.filter(l => l.status === s.key).length})`])].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className="px-2.5 py-1 rounded-full text-[10px] font-medium border-none cursor-pointer transition-colors"
            style={{ background: filterStatus === k ? ACCENT : '#f1f0ec', color: filterStatus === k ? '#fff' : '#6b7280' }}>
            {l}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState emoji="✂" title="Sin lotes en esta etapa" sub={isCorte ? "Crea un nuevo lote usando el botón de arriba" : "No hay lotes pendientes"} />
      )}

      <div className="space-y-3">
        {filtered.map(lot => {
          const st   = CORTE_STATES.find(s => s.key === lot.status);
          const pr   = LOT_PRIORITY[lot.priority];
          const next = nextStateMap[lot.status];
          const canAct = isAdmin || (profile?.role === 'corte');

          return (
            <div key={lot.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                    <span className={`${st?.cls} px-2 py-0.5 rounded-full text-[9px] font-semibold`}>{st?.label}</span>
                    <span className={`${pr.cls} px-2 py-0.5 rounded-full text-[9px] font-semibold`}>{pr.label}</span>
                  </div>

                  {/* Prendas */}
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {lot.garments?.map((g, i) => (
                      <span key={i} className="text-[10px] bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full text-gray-700">
                        {gLabel(g.gtId)}: <strong>{g.total?.toLocaleString('es-CO')}</strong> pzs
                      </span>
                    ))}
                  </div>

                  <p className="text-[10px] text-gray-400">
                    Total: <strong>{lot.totalPieces?.toLocaleString('es-CO')} piezas</strong>
                    {' · Vence: '}{lot.deadline}
                    {lot.descripcion && lot.descripcion !== lot.code && ` · ${lot.descripcion}`}
                  </p>
                  {lot.notes && <p className="text-[10px] text-gray-400 italic mt-0.5">"{lot.notes}"</p>}
                </div>

                {/* Botón de acción */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {canAct && next && (
                    <button onClick={() => advance(lot, next.next)}
                      className="text-white text-[10px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap"
                      style={{ background: next.color }}>
                      {next.label}
                    </button>
                  )}
                  {isAdmin && lot.status === 'entregar_admin' && (
                    <button onClick={() => advance(lot, 'asignacion')}
                      className="text-white text-[10px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap"
                      style={{ background: '#7c3aed' }}>
                      ✓ Recibido → Asignar Satélite
                    </button>
                  )}
                </div>
              </div>

              {/* Tabla de tallas */}
              <div className="mt-3 overflow-x-auto">
                <table className="text-[10px] border-collapse w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-2 py-1 text-left text-gray-500 font-medium border border-gray-200">Prenda</th>
                      {SIZES.map(s => (
                        <th key={s} className="px-2 py-1 text-center text-gray-500 font-medium border border-gray-200 w-10">{s}</th>
                      ))}
                      <th className="px-2 py-1 text-center text-gray-700 font-bold border border-gray-200">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lot.garments?.map((g, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-2 py-1.5 font-medium text-gray-700 border border-gray-200 whitespace-nowrap">
                          {gLabel(g.gtId)}
                        </td>
                        {SIZES.map(s => (
                          <td key={s} className="px-2 py-1.5 text-center border border-gray-200"
                            style={{ color: (g.sizes?.[s] || 0) > 0 ? '#1a3a6b' : '#d1d5db', fontWeight: (g.sizes?.[s] || 0) > 0 ? 600 : 400 }}>
                            {g.sizes?.[s] || '—'}
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-center font-bold text-gray-800 border border-gray-200 bg-gray-50">
                          {g.total?.toLocaleString('es-CO')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── MODAL NUEVO LOTE ── */}
      {showNew && (
        <Modal title="Nuevo Lote de Corte" onClose={() => setShowNew(false)} wide>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-700">
            💡 El lote no se asigna a un cliente. La producción va a bodega y desde ahí se despacha cuando llegue un pedido.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción (opcional)</label>
              <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Ej: Pantalones drill azul referencia 01"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha límite *</label>
              <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          <Select label="Prioridad" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
            <option value="normal">Normal</option>
            <option value="urgente">Urgente</option>
            <option value="critico">Crítico</option>
          </Select>

          {/* Prendas */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Prendas a cortar</label>
              <button onClick={addItem} className="text-xs text-blue-600 font-medium hover:text-blue-800">
                + Agregar prenda
              </button>
            </div>
            {form.items.map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3 mb-2 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <select value={item.gtId} onChange={e => updItem(i, 'gtId', e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none">
                    {GARMENT_TYPES.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  {form.items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-xs font-bold px-1">✕</button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {SIZES.map(sz => (
                    <div key={sz} className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500 w-5 text-center">{sz}</span>
                      <input type="number" min={0} value={item.sizes[sz] || ''}
                        onChange={e => updItem(i, 'sizes', { ...item.sizes, [sz]: +e.target.value || 0 })}
                        className="w-14 border border-gray-200 rounded px-1.5 py-1 text-xs text-center focus:outline-none focus:border-blue-300" />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">
                  Total: <strong>{item.total?.toLocaleString('es-CO')} piezas</strong>
                </p>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 mb-1">Notas</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Observaciones del lote..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-14 focus:outline-none focus:border-blue-400" />
          </div>

          {/* Resumen */}
          <div className="bg-blue-50 rounded-xl p-3 mb-4 text-xs">
            <span className="text-blue-700 font-semibold">Total del lote: </span>
            <span className="text-blue-900 font-black text-sm">
              {form.items.reduce((a, i) => a + i.total, 0).toLocaleString('es-CO')} piezas
            </span>
          </div>

          <div className="flex gap-2 justify-end">
            <Btn variant="secondary" onClick={() => setShowNew(false)}>Cancelar</Btn>
            <Btn onClick={createLot} disabled={saving}>{saving ? 'Guardando...' : 'Crear Lote de Corte'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
