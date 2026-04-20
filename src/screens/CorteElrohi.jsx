import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { addDocument, updateDocument } from '../services/db';
import { GARMENT_TYPES, SIZES, LOT_PRIORITY, ACCENT } from '../constants';
import { Modal, Input, Select, Btn, EmptyState, LotStatusBadge, PriorityBadge } from '../components/ui';
import { gLabel, cLabel, genLotCode, today, fmtM } from '../utils';
import toast from 'react-hot-toast';

const CORTE_STATES = [
  { key: 'nuevo',                 label: 'Nuevo',                  cls: 'bg-gray-100 text-gray-600'     },
  { key: 'recibido_alistamiento', label: 'Recibido Alistamiento',  cls: 'bg-blue-100 text-blue-700'     },
  { key: 'en_corte',              label: 'En Corte',               cls: 'bg-orange-100 text-orange-800' },
  { key: 'entregar_admin',        label: 'Entregar a Admin',       cls: 'bg-amber-100 text-amber-800'   },
];

export default function CorteElrohiScreen() {
  const { profile }                  = useAuth();
  const { lots, clients, users }     = useData();
  const [tab, setTab]                = useState('lista');
  const [showNew, setShowNew]        = useState(false);
  const [filterStatus, setFilter]    = useState('all');
  const [saving, setSaving]          = useState(false);

  const isAdmin = ['gerente','admin_elrohi'].includes(profile?.role);
  const isCorte = profile?.role === 'corte' || isAdmin;

  const corteLots = lots.filter(l =>
    ['nuevo','recibido_alistamiento','en_corte','entregar_admin'].includes(l.status)
  );

  const filtered = filterStatus === 'all'
    ? corteLots
    : corteLots.filter(l => l.status === filterStatus);

  // Form state
  const [form, setForm] = useState({
    clientId: '', deadline: '', priority: 'normal', notes: '',
    items: [{ gtId: 'gt1', sizes: {}, total: 0 }],
  });

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { gtId: 'gt1', sizes: {}, total: 0 }] }));
  const updItem = (i, k, v) => setForm(f => {
    const items = [...f.items];
    items[i] = { ...items[i], [k]: v };
    if (k === 'sizes') items[i].total = Object.values(v).reduce((a, b) => a + (+b || 0), 0);
    return { ...f, items };
  });

  const createLot = async () => {
    if (!form.clientId || !form.deadline) { toast.error('Completa cliente y fecha'); return; }
    const total = form.items.reduce((a, i) => a + i.total, 0);
    if (total === 0) { toast.error('Agrega al menos una prenda'); return; }
    setSaving(true);
    try {
      await addDocument('lots', {
        code:        genLotCode(),
        clientId:    form.clientId,
        status:      'nuevo',
        priority:    form.priority,
        satId:       null,
        created:     today(),
        deadline:    form.deadline,
        garments:    form.items.filter(i => i.total > 0),
        totalPieces: total,
        lotOps:      [],
        opsElrohi:   [],
        notes:       form.notes,
        novelties:   [],
        bodega:      null,
        createdBy:   profile?.id,
      });
      toast.success('✅ Lote de corte creado');
      setShowNew(false);
      setForm({ clientId: '', deadline: '', priority: 'normal', notes: '', items: [{ gtId: 'gt1', sizes: {}, total: 0 }] });
    } catch(e) { toast.error('Error al crear'); }
    finally { setSaving(false); }
  };

  const advance = async (lot, nextStatus) => {
    try {
      await updateDocument('lots', lot.id, { status: nextStatus });
      toast.success('Estado actualizado');
    } catch { toast.error('Error'); }
  };

  const nextStateMap = {
    nuevo:                 { next: 'recibido_alistamiento', label: '📥 Recibir para alistamiento', color: '#2563eb' },
    recibido_alistamiento: { next: 'en_corte',              label: '✂ Iniciar corte',              color: '#ea580c' },
    en_corte:              { next: 'entregar_admin',        label: '📦 Entregar al Admin',          color: '#d97706' },
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
        {[['all','Todos'], ...CORTE_STATES.map(s => [s.key, s.label])].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className="px-2.5 py-1 rounded-full text-[10px] font-medium border-none cursor-pointer"
            style={{ background: filterStatus === k ? ACCENT : '#f1f0ec', color: filterStatus === k ? '#fff' : '#6b7280' }}>
            {l} {k !== 'all' && `(${corteLots.filter(l => l.status === k).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <EmptyState emoji="✂" title="Sin lotes" sub="No hay lotes en esta etapa" />}

      <div className="space-y-2">
        {filtered.map(lot => {
          const st   = CORTE_STATES.find(s => s.key === lot.status);
          const pr   = LOT_PRIORITY[lot.priority];
          const next = nextStateMap[lot.status];
          const canAct = isAdmin || (profile?.role === 'corte' && lot.status !== 'nuevo');

          return (
            <div key={lot.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                    <span className={`${st?.cls} px-2 py-0.5 rounded-full text-[9px] font-semibold`}>{st?.label}</span>
                    <span className={`${pr.cls} px-2 py-0.5 rounded-full text-[9px] font-semibold`}>{pr.label}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{cLabel(clients, lot.clientId)}</p>
                  <p className="text-[10px] text-gray-400">
                    {[...new Set(lot.garments?.map(g => gLabel(g.gtId)))].join(', ')}
                    {' · '}{lot.totalPieces?.toLocaleString('es-CO')} piezas
                    {' · Vence: '}{lot.deadline}
                  </p>
                  {lot.notes && <p className="text-[10px] text-gray-400 italic mt-0.5">"{lot.notes}"</p>}
                </div>

                {/* Acción */}
                {canAct && next && (
                  <button onClick={() => advance(lot, next.next)}
                    className="text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex-shrink-0"
                    style={{ background: next.color }}>
                    {next.label}
                  </button>
                )}
                {isAdmin && lot.status === 'entregar_admin' && (
                  <button onClick={() => advance(lot, 'asignacion')}
                    className="text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex-shrink-0"
                    style={{ background: '#7c3aed' }}>
                    ✓ Recibido — Asignar Satélite
                  </button>
                )}
              </div>

              {/* Desglose prendas */}
              <div className="mt-3 overflow-x-auto">
                <table className="text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-2 py-1 text-left text-gray-500 font-medium border border-gray-200">Prenda</th>
                      {SIZES.map(s => <th key={s} className="px-2 py-1 text-center text-gray-500 font-medium border border-gray-200 w-8">{s}</th>)}
                      <th className="px-2 py-1 text-center text-gray-600 font-bold border border-gray-200">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lot.garments?.map((g, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-2 py-1 font-medium text-gray-700 border border-gray-200 whitespace-nowrap">{gLabel(g.gtId)}</td>
                        {SIZES.map(s => (
                          <td key={s} className="px-2 py-1 text-center border border-gray-200"
                            style={{ color: (g.sizes?.[s] || 0) > 0 ? '#1a3a6b' : '#d1d5db', fontWeight: (g.sizes?.[s] || 0) > 0 ? 600 : 400 }}>
                            {g.sizes?.[s] || '—'}
                          </td>
                        ))}
                        <td className="px-2 py-1 text-center font-bold text-gray-800 border border-gray-200">{g.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal nuevo lote */}
      {showNew && (
        <Modal title="Nuevo Lote de Corte" onClose={() => setShowNew(false)} wide>
          <Select label="Cliente" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} required>
            <option value="">— Seleccionar cliente —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha límite" type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} required />
            <Select label="Prioridad" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              <option value="normal">Normal</option>
              <option value="urgente">Urgente</option>
              <option value="critico">Crítico</option>
            </Select>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Prendas</label>
              <button onClick={addItem} className="text-xs text-blue-600 font-medium">+ Agregar prenda</button>
            </div>
            {form.items.map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2">
                <select value={item.gtId} onChange={e => updItem(i, 'gtId', e.target.value)}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white mb-2">
                  {GARMENT_TYPES.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <div className="flex flex-wrap gap-2">
                  {SIZES.slice(1, 5).map(sz => (
                    <div key={sz} className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500 w-4">{sz}</span>
                      <input type="number" min={0} value={item.sizes[sz] || ''}
                        onChange={e => updItem(i, 'sizes', { ...item.sizes, [sz]: +e.target.value || 0 })}
                        className="w-12 border border-gray-200 rounded px-1 py-1 text-xs text-center" />
                    </div>
                  ))}
                  <span className="text-[10px] text-gray-400 self-center">= {item.total} pzs</span>
                </div>
              </div>
            ))}
          </div>

          <textarea placeholder="Notas..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-14 mb-4" />

          <div className="flex gap-2 justify-end">
            <Btn variant="secondary" onClick={() => setShowNew(false)}>Cancelar</Btn>
            <Btn onClick={createLot} disabled={saving}>{saving ? 'Guardando...' : 'Crear Lote'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
