import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { addDocument, updateDocument, listenCol } from '../services/db';
import { gLabel, fmtM } from '../utils';
import { GARMENT_TYPES, SIZES, ACCENT } from '../constants';
import { orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function BodegaLonasScreen() {
  const { profile } = useAuth();
  const { lots } = useData();
  const [pedidos, setPedidos] = useState([]);
  const [tab, setTab] = useState('inventario');
  const [selPedido, setSelPedido] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = listenCol('despachos', setPedidos, orderBy('createdAt','desc'));
    return unsub;
  }, []);

  const isAdmin = ['gerente','admin_elrohi'].includes(profile?.role);
  const isBodega = profile?.role === 'bodega_op' || isAdmin;

  // Calcular inventario: todos los lotes en bodega_lonas agrupados por prenda y talla
  const inventario = {};
  lots.filter(l => l.status === 'bodega_lonas').forEach(lot => {
    (lot.garments || []).forEach(g => {
      if (!inventario[g.gtId]) inventario[g.gtId] = { gtId: g.gtId, sizes: {}, total: 0, lotes: [] };
      Object.entries(g.sizes || {}).forEach(([sz, qty]) => {
        inventario[g.gtId].sizes[sz] = (inventario[g.gtId].sizes[sz] || 0) + (+qty || 0);
      });
      inventario[g.gtId].total += g.total || 0;
      if (!inventario[g.gtId].lotes.includes(lot.code)) inventario[g.gtId].lotes.push(lot.code);
    });
  });

  const totalInventario = Object.values(inventario).reduce((a,g) => a + g.total, 0);
  const pendientesDespacho = pedidos.filter(p => p.status === 'lista_enviar').length;

  const marcarListaEnviar = async (pedidoId) => {
    setSaving(true);
    try {
      await updateDocument('despachos', pedidoId, { status: 'lista_enviar', preparadoPor: profile?.name, preparadoAt: new Date().toISOString() });
      toast.success('✅ Orden lista para enviar');
    } catch { toast.error('Error'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-2">Bodega Lonas</h1>
      <p className="text-xs text-gray-500 mb-4">Inventario disponible para despacho a clientes</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          ['Total en inventario', totalInventario.toLocaleString('es-CO') + ' pzas', '#2563eb'],
          ['Tipos de prenda', Object.keys(inventario).length, '#7c3aed'],
          ['Órdenes pendientes', pendientesDespacho, '#e85d26'],
        ].map(([l,v,c]) => (
          <div key={l} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-lg font-black" style={{color:c}}>{v}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{l}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[['inventario','📦 Inventario'],['despachos',`📋 Órdenes de Despacho (${pedidos.filter(p=>p.status==='pendiente').length})`]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:tab===k?'#fff':'transparent',color:tab===k?'#111827':'#6b7280',fontWeight:tab===k?700:400,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {/* INVENTARIO */}
      {tab==='inventario' && (
        <div>
          {Object.keys(inventario).length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-4xl mb-3">📦</p>
              <p className="font-medium text-gray-700">Bodega vacía</p>
              <p className="text-sm text-gray-400 mt-1">Los lotes aprobados por calidad aparecerán aquí</p>
            </div>
          )}
          {Object.values(inventario).map(g => (
            <div key={g.gtId} className="bg-white rounded-xl border border-gray-100 p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">{gLabel(g.gtId)}</p>
                  <p className="text-[10px] text-gray-400">Cortes: {g.lotes.join(', ')}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-blue-700">{g.total.toLocaleString('es-CO')}</p>
                  <p className="text-[10px] text-gray-400">piezas disponibles</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      {SIZES.map(s => <th key={s} className="px-2 py-1 text-center text-gray-500 font-medium border border-gray-100">{s}</th>)}
                      <th className="px-2 py-1 text-center text-gray-700 font-bold border border-gray-100">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {SIZES.map(s => {
                        const qty = g.sizes[s] || 0;
                        return (
                          <td key={s} className="px-2 py-1.5 text-center border border-gray-100 font-semibold"
                            style={{color:qty>0?'#1a3a6b':'#d1d5db'}}>
                            {qty > 0 ? qty : '—'}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-center font-black text-gray-900 border border-gray-100 bg-gray-50">{g.total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ÓRDENES DE DESPACHO */}
      {tab==='despachos' && (
        <div className="space-y-3">
          {pedidos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-medium text-gray-700">Sin órdenes de despacho</p>
            </div>
          )}
          {pedidos.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs font-bold text-blue-700">OD-{p.numero}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                      p.status==='lista_enviar'?'bg-green-100 text-green-700':
                      p.status==='despachado'?'bg-blue-100 text-blue-700':
                      'bg-amber-100 text-amber-700'}`}>
                      {p.status==='lista_enviar'?'✓ Lista para enviar':p.status==='despachado'?'Despachado':'⏳ Preparando'}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-gray-800">{p.clienteNombre}</p>
                  <p className="text-[10px] text-gray-400">{p.clienteDireccion}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.items?.map((item,i) => (
                      <span key={i} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {gLabel(item.gtId)} T{item.talla}: <strong>{item.qty}</strong>
                      </span>
                    ))}
                  </div>
                  {p.guia && <p className="text-[10px] text-blue-600 mt-1">Guía: {p.guia}</p>}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {isBodega && p.status === 'pendiente' && (
                    <button onClick={() => marcarListaEnviar(p.id)} disabled={saving}
                      className="text-xs font-bold px-3 py-2 rounded-lg text-white disabled:opacity-50"
                      style={{background:'#15803d'}}>
                      ✓ Lista para enviar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
