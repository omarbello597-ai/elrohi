import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { saveOrder, updateOrderStatus, saveLot } from '../services/db';
import { GARMENT_TYPES, SIZES, ACCENT } from '../constants';
import { Modal, Select, Input, Btn, PageHeader, EmptyState } from '../components/ui';
import { gLabel, cLabel, genLotCode, today } from '../utils';
import toast from 'react-hot-toast';

const ORDER_STATUS = {
  pendiente:      { label: 'Pendiente',      cls: 'bg-yellow-100 text-yellow-800' },
  en_produccion:  { label: 'En Producción',  cls: 'bg-blue-100 text-blue-800'    },
  completado:     { label: 'Completado',     cls: 'bg-green-100 text-green-800'  },
};

export default function PedidosScreen() {
  const { profile }             = useAuth();
  const { orders, clients, lots } = useData();
  const [showNew,  setShowNew]  = useState(false);
  const [showDet,  setShowDet]  = useState(null);
  const [saving,   setSaving]   = useState(false);

  const canEdit = ['gerente', 'admin_elrohi'].includes(profile.role);

  const [form, setForm] = useState({
    clientId: '', deadline: '', priority: 'normal', notes: '',
    items: [{ gtId: 'gt1', sizes: {}, total: 0 }],
  });

  const addItem = () =>
    setForm((f) => ({ ...f, items: [...f.items, { gtId: 'gt1', sizes: {}, total: 0 }] }));

  const updateItem = (i, key, val) =>
    setForm((f) => {
      const items = [...f.items];
      items[i] = { ...items[i], [key]: val };
      if (key === 'sizes') items[i].total = Object.values(val).reduce((a, b) => a + (+b || 0), 0);
      return { ...f, items };
    });

  const removeItem = (i) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const createOrder = async () => {
    if (!form.clientId || !form.deadline || form.items.every((i) => i.total === 0)) {
      toast.error('Completa cliente, fecha y al menos una prenda');
      return;
    }
    setSaving(true);
    try {
      await saveOrder({
        clientId: form.clientId,
        date:     today(),
        status:   'pendiente',
        deadline: form.deadline,
        priority: form.priority,
        items:    form.items.filter((i) => i.total > 0),
        notes:    form.notes,
      });
      toast.success('Pedido creado');
      setShowNew(false);
      setForm({ clientId: '', deadline: '', priority: 'normal', notes: '', items: [{ gtId: 'gt1', sizes: {}, total: 0 }] });
    } catch {
      toast.error('Error al crear el pedido');
    } finally {
      setSaving(false);
    }
  };

  const activateLot = async (order) => {
    setSaving(true);
    try {
      const code = genLotCode();
      await saveLot({
        code,
        clientId:    order.clientId,
        orderId:     order.id,
        status:      'activacion',
        priority:    order.priority || 'normal',
        satId:       null,
        created:     today(),
        deadline:    order.deadline,
        garments:    order.items,
        totalPieces: order.items.reduce((a, i) => a + i.total, 0),
        lotOps:      [],
        notes:       order.notes || '',
        novelties:   [],
      });
      await updateOrderStatus(order.id, 'en_produccion');
      toast.success(`Lote activado: ${code}`);
    } catch {
      toast.error('Error al activar el lote');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Gestión de Pedidos"
        action={canEdit && (
          <Btn onClick={() => setShowNew(true)}>+  Nuevo Pedido</Btn>
        )}
      />

      {orders.length === 0 && <EmptyState emoji="📋" title="No hay pedidos" sub="Crea el primer pedido para comenzar" />}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              {['Cliente', 'Prendas', 'Piezas', 'Estado', 'Vence', 'Acciones'].map((c) => (
                <th key={c} className="text-left px-3 py-2.5 text-gray-400 font-medium text-[10px] uppercase tracking-wide">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const st       = ORDER_STATUS[o.status] || { label: o.status, cls: 'bg-gray-100 text-gray-600' };
              const gNames   = [...new Set(o.items?.map((i) => gLabel(i.gtId)) || [])].slice(0, 2).join(', ');
              const total    = o.items?.reduce((a, i) => a + i.total, 0) || 0;
              const lotsForO = lots.filter((l) => l.orderId === o.id);
              return (
                <tr key={o.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-semibold text-gray-900">{cLabel(clients, o.clientId)}</td>
                  <td className="px-3 py-2.5 text-gray-500">{gNames}</td>
                  <td className="px-3 py-2.5 font-semibold">{total.toLocaleString('es-CO')}</td>
                  <td className="px-3 py-2.5">
                    <span className={`${st.cls} px-2 py-0.5 rounded-full text-[10px] font-medium`}>{st.label}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-400">{o.deadline}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setShowDet(o)}
                        className="text-[10px] text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded font-medium">
                        Ver
                      </button>
                      {o.status === 'pendiente' && canEdit && (
                        <button onClick={() => activateLot(o)} disabled={saving}
                          className="text-[10px] text-white px-2 py-0.5 rounded font-semibold disabled:opacity-50"
                          style={{ background: ACCENT }}>
                          → Activar Lote
                        </button>
                      )}
                      {lotsForO.length > 0 && (
                        <span className="text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          {lotsForO.length} lote{lotsForO.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* New Order Modal */}
      {showNew && (
        <Modal title="Nuevo Pedido" onClose={() => setShowNew(false)} wide>
          <Select label="Cliente" value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} required>
            <option value="">— Seleccionar cliente —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha límite" type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} required />
            <Select label="Prioridad" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
              <option value="normal">Normal</option>
              <option value="urgente">Urgente</option>
              <option value="critico">Crítico</option>
            </Select>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Prendas del pedido</label>
              <button onClick={addItem} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Agregar prenda</button>
            </div>
            {form.items.map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <select value={item.gtId} onChange={(e) => updateItem(i, 'gtId', e.target.value)}
                    className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm bg-white">
                    {GARMENT_TYPES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  {form.items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-xs font-bold px-1">✕</button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {SIZES.slice(1, 6).map((sz) => (
                    <div key={sz} className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500 w-5">{sz}</span>
                      <input type="number" min={0} value={item.sizes[sz] || ''}
                        onChange={(e) => updateItem(i, 'sizes', { ...item.sizes, [sz]: +e.target.value || 0 })}
                        className="w-12 border border-gray-200 rounded px-1.5 py-1 text-xs text-center" />
                    </div>
                  ))}
                  <span className="text-[10px] text-gray-400 self-center ml-1">= {item.total} pzs</span>
                </div>
              </div>
            ))}
          </div>

          <textarea placeholder="Notas del pedido..." value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-16 mb-4" />

          <div className="flex gap-2 justify-end">
            <Btn variant="secondary" onClick={() => setShowNew(false)}>Cancelar</Btn>
            <Btn onClick={createOrder} disabled={saving}>{saving ? 'Guardando...' : 'Crear Pedido'}</Btn>
          </div>
        </Modal>
      )}

      {/* Detail Modal */}
      {showDet && (
        <Modal title={`Pedido — ${cLabel(clients, showDet.clientId)}`} onClose={() => setShowDet(null)} wide>
          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            {[['Cliente', cLabel(clients, showDet.clientId)], ['Fecha', showDet.date], ['Vence', showDet.deadline], ['Estado', showDet.status]].map(([l, v]) => (
              <div key={l}><p className="text-xs text-gray-400">{l}</p><p className="font-medium">{v}</p></div>
            ))}
          </div>
          <table className="w-full text-xs border-collapse">
            <thead><tr>{['Prenda', 'S', 'M', 'L', 'XL', 'Total'].map((c) => <th key={c} className="text-left px-2 py-1.5 text-gray-400 border-b">{c}</th>)}</tr></thead>
            <tbody>
              {showDet.items?.map((it, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-2 py-1.5 font-medium">{gLabel(it.gtId)}</td>
                  {['S', 'M', 'L', 'XL'].map((sz) => <td key={sz} className="px-2 py-1.5 text-center text-gray-600">{it.sizes?.[sz] || '—'}</td>)}
                  <td className="px-2 py-1.5 text-center font-bold">{it.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {showDet.notes && <p className="text-xs text-gray-500 mt-3 italic">"{showDet.notes}"</p>}
        </Modal>
      )}
    </div>
  );
}
