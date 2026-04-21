import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { addDocument, updateDocument, listenCol } from '../services/db';
import { gLabel, fmtM } from '../utils';
import { GARMENT_TYPES, SIZES, ACCENT } from '../constants';
import { orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';

function printFactura(factura) {
  const itemRows = (factura.items||[]).map(item => {
    const subtotal = item.qty * item.precioUnitario;
    return `<tr>
      <td style="border:1px solid #e5e7eb;padding:6px 10px;font-size:11px">${gLabel(item.gtId)}</td>
      <td style="border:1px solid #e5e7eb;padding:6px 10px;text-align:center;font-size:11px">${item.talla||'—'}</td>
      <td style="border:1px solid #e5e7eb;padding:6px 10px;text-align:center;font-size:11px;font-weight:600">${item.qty}</td>
      <td style="border:1px solid #e5e7eb;padding:6px 10px;text-align:right;font-size:11px">${fmtM(item.precioUnitario)}</td>
      <td style="border:1px solid #e5e7eb;padding:6px 10px;text-align:right;font-size:11px;font-weight:700">${fmtM(subtotal)}</td>
    </tr>`;
  }).join('');
  const subtotalVal = (factura.items||[]).reduce((a,i) => a + i.qty * i.precioUnitario, 0);
  const ivaVal      = factura.aplicaIva ? Math.round(subtotalVal * 0.19) : 0;
  const totalVal    = subtotalVal + ivaVal;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Factura ${factura.numero}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif}@media print{body{print-color-adjust:exact}}</style>
  </head><body><div style="max-width:800px;margin:20px auto;padding:0 20px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #1a3a6b">
      <div>
        <div style="font-size:20px;font-weight:900;color:#1a3a6b">Dotaciones <span style="color:#e85d26">EL ROHI</span></div>
        <div style="font-size:10px;color:#6b7280;margin-top:4px">NIT. 901.080.234-7 · Calle 39 A Sur No. 5-63 Este La Victoria · Cel.: 313 372 5739</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:0.1em">FACTURA DE VENTA</div>
        <div style="font-size:24px;font-weight:900;color:#e85d26;font-family:monospace">N° ${factura.numero}</div>
        <div style="font-size:11px;color:#6b7280">Fecha: ${factura.fecha}</div>
      </div>
    </div>
    <div style="background:#f9fafb;border-radius:8px;padding:12px 16px;margin-bottom:20px">
      <p style="font-size:11px;font-weight:700;color:#374151;margin-bottom:8px">DATOS DEL CLIENTE</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><span style="font-size:10px;color:#6b7280">Nombre:</span><br><span style="font-size:12px;font-weight:600">${factura.clienteNombre}</span></div>
        <div><span style="font-size:10px;color:#6b7280">NIT / Cédula:</span><br><span style="font-size:12px;font-weight:600">${factura.clienteNit||'—'}</span></div>
        <div><span style="font-size:10px;color:#6b7280">Dirección:</span><br><span style="font-size:12px;font-weight:600">${factura.clienteDireccion||'—'}</span></div>
        <div><span style="font-size:10px;color:#6b7280">Ciudad:</span><br><span style="font-size:12px;font-weight:600">${factura.clienteCiudad||'—'}</span></div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <thead><tr style="background:#1a3a6b;color:#fff">
        <th style="padding:8px 10px;font-size:11px;text-align:left">Referencia</th>
        <th style="padding:8px 10px;font-size:11px;text-align:center">Talla</th>
        <th style="padding:8px 10px;font-size:11px;text-align:center">Cantidad</th>
        <th style="padding:8px 10px;font-size:11px;text-align:right">Precio Unit.</th>
        <th style="padding:8px 10px;font-size:11px;text-align:right">Subtotal</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end">
      <div style="min-width:280px">
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e5e7eb">
          <span style="font-size:12px;color:#6b7280">Subtotal</span>
          <span style="font-size:12px;font-weight:600">${fmtM(subtotalVal)}</span>
        </div>
        ${factura.aplicaIva?`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e5e7eb"><span style="font-size:12px;color:#6b7280">IVA 19%</span><span style="font-size:12px;font-weight:600">${fmtM(ivaVal)}</span></div>`:''}
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid #1a3a6b;margin-top:4px">
          <span style="font-size:14px;font-weight:900;color:#1a3a6b">TOTAL</span>
          <span style="font-size:16px;font-weight:900;color:#e85d26">${fmtM(totalVal)}</span>
        </div>
      </div>
    </div>
    ${factura.notas?`<div style="margin-top:16px;padding:10px;background:#fef9c3;border-radius:6px"><span style="font-size:11px;font-weight:700;color:#92400e">Notas:</span><span style="font-size:11px;color:#374151;margin-left:6px">${factura.notas}</span></div>`:''}
  </div><script>window.onload=()=>window.print();</script></body></html>`;
  const win=window.open('','_blank'); win.document.write(html); win.document.close();
}

export default function BodegaLonasScreen() {
  const { profile } = useAuth();
  const { lots } = useData();
  const [pedidos,   setPedidos]   = useState([]);
  const [facturas,  setFacturas]  = useState([]);
  const [listas,    setListas]    = useState([]);
  const [tab, setTab] = useState('inventario');
  const [showFact,  setShowFact]  = useState(null);
  const [factForm,  setFactForm]  = useState({ aplicaIva:false, notas:'', listaId:'' });
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    const u1 = listenCol('despachos',     setPedidos,  orderBy('createdAt','desc'));
    const u2 = listenCol('facturas',      setFacturas, orderBy('createdAt','desc'));
    const u3 = listenCol('listasPrecios', setListas,   orderBy('createdAt','desc'));
    return () => { u1(); u2(); u3(); };
  }, []);

  const isAdmin  = ['gerente','admin_elrohi'].includes(profile?.role);
  const isBodega = profile?.role === 'bodega_op' || isAdmin;

  // Inventario Bodega Lonas
  const inventario = {};
  lots.filter(l => l.status === 'bodega_lonas').forEach(lot => {
    (lot.garments||[]).forEach(g => {
      if (!inventario[g.gtId]) inventario[g.gtId] = { gtId:g.gtId, sizes:{}, total:0 };
      Object.entries(g.sizes||{}).forEach(([sz,qty]) => {
        inventario[g.gtId].sizes[sz] = (inventario[g.gtId].sizes[sz]||0) + (+qty||0);
      });
      inventario[g.gtId].total += g.total||0;
    });
  });

  const totalInventario = Object.values(inventario).reduce((a,g)=>a+g.total,0);
  const pendientes      = pedidos.filter(p => p.status === 'pendiente');
  const enAlistamiento  = pedidos.filter(p => p.status === 'en_alistamiento');
  const paraRevision    = pedidos.filter(p => p.status === 'para_revision');
  const paraFacturar    = pedidos.filter(p => p.status === 'para_facturar');
  const listasActivas   = listas.filter(l => l.active !== false && !l.eliminado);

  const tomarPedido = async (pedidoId) => {
    try {
      await updateDocument('despachos', pedidoId, {
        status: 'en_alistamiento',
        tomadoPor: profile?.name,
        tomadoPorId: profile?.id,
        tomadoAt: new Date().toISOString(),
      });
      toast.success('✅ Pedido tomado para alistamiento');
    } catch { toast.error('Error'); }
  };

  const marcarListoPedido = async (pedidoId) => {
    try {
      await updateDocument('despachos', pedidoId, {
        status: 'para_revision',
        listoPor: profile?.name,
        listoAt: new Date().toISOString(),
      });
      toast.success('✅ Pedido listo — enviado a revisión de Admin');
    } catch { toast.error('Error'); }
  };

  const aprobarPedido = async (pedidoId) => {
    try {
      await updateDocument('despachos', pedidoId, {
        status: 'para_facturar',
        aprobadoPor: profile?.name,
        aprobadoAt: new Date().toISOString(),
      });
      toast.success('✅ Pedido aprobado — listo para facturar');
    } catch { toast.error('Error'); }
  };

  const generarFactura = async (despacho) => {
    setSaving(true);
    try {
      const lista = listas.find(l => l.id === factForm.listaId);
      // Aplicar precios de la lista seleccionada
      const itemsConPrecios = (despacho.items||[]).map(item => ({
        ...item,
        precioUnitario: lista ? (lista.precios?.[item.gtId] || item.precioUnitario || 0) : (item.precioUnitario || 0),
      }));

      const numero   = String(facturas.length + 1).padStart(4,'0');
      const factura  = {
        numero,
        despachoId:       despacho.id,
        clienteNombre:    despacho.clienteNombre,
        clienteNit:       despacho.clienteNit,
        clienteDireccion: despacho.clienteDireccion,
        clienteCiudad:    despacho.clienteCiudad,
        guia:             despacho.guia,
        items:            itemsConPrecios,
        listaId:          factForm.listaId,
        listaNombre:      lista?.nombre || 'Manual',
        aplicaIva:        factForm.aplicaIva,
        notas:            factForm.notas,
        fecha:            new Date().toISOString().split('T')[0],
        facturadoPor:     profile?.name,
        status:           'facturado',
      };
      await addDocument('facturas', factura);
      await updateDocument('despachos', despacho.id, { status:'despachado', facturaNumero: numero });
      printFactura(factura);
      toast.success(`✅ Factura N° ${numero} generada`);
      setShowFact(null);
    } catch(e) { console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  const statusPedidoLabel = (s) => ({
    pendiente:      { label:'⏳ Pendiente alistamiento', cls:'bg-amber-100 text-amber-700' },
    en_alistamiento:{ label:'📦 En alistamiento',        cls:'bg-blue-100 text-blue-700'   },
    para_revision:  { label:'🔍 Para revisión Admin',    cls:'bg-purple-100 text-purple-700'},
    para_facturar:  { label:'🧾 Para facturar',          cls:'bg-green-100 text-green-700'  },
    despachado:     { label:'✅ Despachado',              cls:'bg-gray-100 text-gray-500'    },
  }[s] || { label:s, cls:'bg-gray-100 text-gray-500' });

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-2">Bodega Lonas</h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          ['Inventario', totalInventario.toLocaleString('es-CO')+' pzas', '#2563eb'],
          ['Por alistar', pendientes.length, '#e85d26'],
          ['En alistamiento', enAlistamiento.length, '#7c3aed'],
          ['Para facturar', paraFacturar.length, '#15803d'],
        ].map(([l,v,c])=>(
          <div key={l} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-lg font-black" style={{color:c}}>{v}</p>
            <p className="text-[9px] text-gray-400 uppercase tracking-wide mt-0.5">{l}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        {[
          ['inventario','📦 Inventario'],
          ['pedidos',`📋 Pedidos (${pendientes.length+enAlistamiento.length+paraRevision.length+paraFacturar.length})`],
          ['facturas','🧾 Facturas'],
        ].map(([k,l])=>(
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
                <p className="text-sm font-bold text-gray-900">{gLabel(g.gtId)}</p>
                <div className="text-right">
                  <p className="text-xl font-black text-blue-700">{g.total.toLocaleString('es-CO')}</p>
                  <p className="text-[10px] text-gray-400">piezas disponibles</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      {SIZES.map(s=><th key={s} className="px-3 py-1.5 text-center text-gray-500 font-medium border border-gray-100 w-16">{s}</th>)}
                      <th className="px-3 py-1.5 text-center text-gray-700 font-bold border border-gray-100">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {SIZES.map(s=>{
                        const qty=g.sizes[s]||0;
                        return <td key={s} className="px-3 py-2 text-center border border-gray-100 font-semibold"
                          style={{color:qty>0?'#1a3a6b':'#d1d5db'}}>{qty>0?qty:'—'}</td>;
                      })}
                      <td className="px-3 py-2 text-center font-black text-gray-900 border border-gray-100 bg-gray-50">{g.total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PEDIDOS */}
      {tab==='pedidos' && (
        <div className="space-y-3">
          {[...pedidos].filter(p=>p.status!=='despachado').length===0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-medium text-gray-700">Sin pedidos pendientes</p>
            </div>
          )}
          {pedidos.filter(p=>p.status!=='despachado').map(p => {
            const st = statusPedidoLabel(p.status);
            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs font-bold text-blue-700">OD-{p.numero}</span>
                      <span className={`${st.cls} text-[9px] px-2 py-0.5 rounded-full font-bold`}>{st.label}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{p.clienteNombre}</p>
                    <p className="text-[10px] text-gray-400">{p.clienteDireccion} · {p.clienteCiudad}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.items?.map((item,i)=>(
                        <span key={i} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {gLabel(item.gtId)} {item.talla}: <strong>{item.qty}</strong>
                        </span>
                      ))}
                    </div>
                    {p.tomadoPor && <p className="text-[10px] text-blue-500 mt-1">Alistando: {p.tomadoPor}</p>}
                    {p.guia && <p className="text-[10px] text-blue-600 mt-0.5">Guía: {p.guia}</p>}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {/* Operario Lonas toma el pedido */}
                    {isBodega && p.status==='pendiente' && (
                      <button onClick={()=>tomarPedido(p.id)}
                        className="text-xs font-bold px-3 py-2 rounded-lg text-white"
                        style={{background:'#2563eb'}}>
                        📦 Tomar para alistar
                      </button>
                    )}
                    {/* Operario marca listo */}
                    {isBodega && p.status==='en_alistamiento' && p.tomadoPorId===profile?.id && (
                      <button onClick={()=>marcarListoPedido(p.id)}
                        className="text-xs font-bold px-3 py-2 rounded-lg text-white"
                        style={{background:'#7c3aed'}}>
                        ✓ Pedido listo — enviar a revisión
                      </button>
                    )}
                    {/* Admin aprueba */}
                    {isAdmin && p.status==='para_revision' && (
                      <button onClick={()=>aprobarPedido(p.id)}
                        className="text-xs font-bold px-3 py-2 rounded-lg text-white"
                        style={{background:'#15803d'}}>
                        ✓ Aprobar y preparar factura
                      </button>
                    )}
                    {/* Admin factura */}
                    {isAdmin && p.status==='para_facturar' && (
                      <button onClick={()=>{ setShowFact(p); setFactForm({aplicaIva:false,notas:'',listaId:''}); }}
                        className="text-xs font-bold px-3 py-2 rounded-lg text-white"
                        style={{background:'#1a3a6b'}}>
                        🧾 Generar Factura
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FACTURAS */}
      {tab==='facturas' && (
        <div className="space-y-3">
          {facturas.length===0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-4xl mb-3">🧾</p>
              <p className="font-medium text-gray-700">Sin facturas emitidas</p>
            </div>
          )}
          {facturas.map(f=>{
            const subtotal=(f.items||[]).reduce((a,i)=>a+i.qty*i.precioUnitario,0);
            const iva=f.aplicaIva?Math.round(subtotal*0.19):0;
            return (
              <div key={f.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold" style={{color:'#e85d26'}}>Factura N° {f.numero}</span>
                      <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✅ Emitida</span>
                      {f.listaNombre && <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{f.listaNombre}</span>}
                    </div>
                    <p className="text-sm font-bold text-gray-900">{f.clienteNombre}</p>
                    <p className="text-[10px] text-gray-400">{f.fecha} · {f.facturadoPor}</p>
                    <p className="text-sm font-black text-green-600 mt-1">{fmtM(subtotal+iva)}</p>
                  </div>
                  <button onClick={()=>printFactura(f)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex-shrink-0">
                    🖨️ Imprimir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL FACTURAR */}
      {showFact && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:500}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Generar Factura</h2>
              <button onClick={()=>setShowFact(null)} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
            </div>

            {/* Resumen pedido */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-xs font-bold text-gray-800">{showFact.clienteNombre}</p>
              <p className="text-[10px] text-gray-400">{showFact.clienteDireccion}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {showFact.items?.map((item,i)=>(
                  <span key={i} className="text-[9px] bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-600">
                    {gLabel(item.gtId)} {item.talla}: {item.qty}
                  </span>
                ))}
              </div>
            </div>

            {/* Seleccionar lista de precios */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Lista de precios *</label>
              <select value={factForm.listaId} onChange={e=>setFactForm(f=>({...f,listaId:e.target.value}))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400">
                <option value="">— Seleccionar lista —</option>
                {listasActivas.map(l=>(
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </div>

            {/* Preview precios si hay lista seleccionada */}
            {factForm.listaId && (()=>{
              const lista = listas.find(l=>l.id===factForm.listaId);
              const itemsConPrecios = (showFact.items||[]).map(item=>({
                ...item,
                precioUnitario: lista?.precios?.[item.gtId]||0,
              }));
              const subtotal = itemsConPrecios.reduce((a,i)=>a+i.qty*i.precioUnitario,0);
              const iva = factForm.aplicaIva ? Math.round(subtotal*0.19) : 0;
              return (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
                  <p className="text-[10px] font-bold text-blue-800 mb-2">Vista previa de precios:</p>
                  {itemsConPrecios.map((item,i)=>(
                    <div key={i} className="flex justify-between text-xs text-blue-700 mb-1">
                      <span>{gLabel(item.gtId)} {item.talla} × {item.qty}</span>
                      <span className="font-bold">{fmtM(item.qty*item.precioUnitario)}</span>
                    </div>
                  ))}
                  <div className="border-t border-blue-200 mt-2 pt-2 flex justify-between text-sm font-black text-blue-900">
                    <span>Total{factForm.aplicaIva?' (con IVA)':''}</span>
                    <span style={{color:'#e85d26'}}>{fmtM(subtotal+iva)}</span>
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
              <input type="checkbox" id="iva" checked={factForm.aplicaIva} onChange={e=>setFactForm(f=>({...f,aplicaIva:e.target.checked}))} />
              <label htmlFor="iva" className="text-sm font-medium text-gray-700 cursor-pointer">Aplicar IVA 19%</label>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Notas</label>
              <textarea value={factForm.notas} onChange={e=>setFactForm(f=>({...f,notas:e.target.value}))}
                placeholder="Condiciones de pago, observaciones..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-14 focus:outline-none" />
            </div>

            <div className="flex gap-2">
              <button onClick={()=>setShowFact(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={()=>generarFactura(showFact)} disabled={saving||!factForm.listaId}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                style={{background:'#1a3a6b'}}>
                {saving?'Generando...':'🧾 Facturar y Despachar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
