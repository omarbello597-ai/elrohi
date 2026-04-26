import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { addDocument, updateDocument, listenCol } from '../services/db';
import { fmtM } from '../utils';
import { ACCENT } from '../constants';
import { orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';

// Tallas individuales disponibles
const TODAS_TALLAS = ['XS','S','M','L','XL','2XL','3XL','4XL','5XL',
                      '28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','44','46','48','50'];

// Determinar si una talla cae en un rango
const tallaEnRango = (talla, rango) => {
  if (!rango) return false;
  const r = rango.replace(/\s/g,'').toUpperCase();
  const t = talla.replace(/\s/g,'').toUpperCase();
  // Exact match
  if (r === t) return true;
  // Range like S-XL, 2XL-3XL, 28-36
  if (r.includes('-')) {
    const parts = r.split('-');
    if (parts.length === 2) {
      const idx1 = TODAS_TALLAS.findIndex(x => x.replace(/\s/g,'').toUpperCase() === parts[0]);
      const idx2 = TODAS_TALLAS.findIndex(x => x.replace(/\s/g,'').toUpperCase() === parts[1]);
      const idxT = TODAS_TALLAS.findIndex(x => x.replace(/\s/g,'').toUpperCase() === t);
      if (idx1>=0 && idx2>=0 && idxT>=0) return idxT>=idx1 && idxT<=idx2;
    }
  }
  return false;
};

// Obtener precio de un producto para una talla específica
const getPrecioParaTalla = (producto, talla) => {
  if (!producto?.precios || !talla) return 0;
  // Try exact match first (case insensitive)
  const exact = producto.precios.find(p => 
    p.talla?.replace(/\s/g,'').toUpperCase() === talla.replace(/\s/g,'').toUpperCase()
  );
  if (exact) return +exact.precio || 0;
  // Try range match
  const rango = producto.precios.find(p => tallaEnRango(talla, p.talla));
  if (rango) return +rango.precio || 0;
  // If only one price entry, use it
  if (producto.precios.length === 1) return +producto.precios[0].precio || 0;
  return 0;
};

// Obtener tallas disponibles de un producto
const getTallasProducto = (producto) => {
  if (!producto?.precios) return [];
  const tallas = [];
  TODAS_TALLAS.forEach(t => {
    const enRango = producto.precios.some(p => tallaEnRango(t, p.talla));
    if (enRango) tallas.push(t);
  });
  return tallas;
};

function printFactura(factura) {
  const itemRows = (factura.items||[]).map(item => {
    const subtotal = item.qty * item.precioUnitario;
    return `<tr>
      <td style="border:1px solid #e5e7eb;padding:6px 10px;font-size:11px">${item.descripcion||item.gtId||''}</td>
      <td style="border:1px solid #e5e7eb;padding:6px 10px;text-align:center;font-size:11px">${item.talla||'—'}</td>
      <td style="border:1px solid #e5e7eb;padding:6px 10px;text-align:center;font-size:11px;font-weight:600">${item.qty}</td>
      <td style="border:1px solid #e5e7eb;padding:6px 10px;text-align:right;font-size:11px">${fmtM(item.precioUnitario)}</td>
      <td style="border:1px solid #e5e7eb;padding:6px 10px;text-align:right;font-size:11px;font-weight:700">${fmtM(subtotal)}</td>
    </tr>`;
  }).join('');
  const subtotalVal = (factura.items||[]).reduce((a,i)=>a+i.qty*i.precioUnitario,0);
  const ivaVal      = factura.aplicaIva ? Math.round(subtotalVal*0.19) : 0;
  const totalVal    = subtotalVal + ivaVal;
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Factura ${factura.numero}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif}@media print{body{print-color-adjust:exact}}</style>
  </head><body><div style="max-width:800px;margin:20px auto;padding:0 20px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #14405A">
      <div>
        <div style="font-size:20px;font-weight:900"><span style="color:#2878B4">Dotaciones </span><span style="color:#14405A">EL·ROHI</span></div>
        <div style="font-size:10px;color:#6b7280;margin-top:4px">NIT. 901.080.234-7 · Calle 39 A Sur No. 5-63 Este La Victoria · Cel.: 313 372 5739</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;font-weight:700;color:#6b7280">FACTURA DE VENTA</div>
        <div style="font-size:24px;font-weight:900;color:#e85d26;font-family:monospace">N° ${factura.numero}</div>
        <div style="font-size:11px;color:#6b7280">Fecha: ${factura.fecha}</div>
      </div>
    </div>
    <div style="background:#f9fafb;border-radius:8px;padding:12px 16px;margin-bottom:20px">
      <p style="font-size:11px;font-weight:700;margin-bottom:8px">DATOS DEL CLIENTE</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><span style="font-size:10px;color:#6b7280">Nombre:</span><br><span style="font-size:12px;font-weight:600">${factura.clienteNombre}</span></div>
        <div><span style="font-size:10px;color:#6b7280">NIT:</span><br><span style="font-size:12px;font-weight:600">${factura.clienteNit||'—'}</span></div>
        <div><span style="font-size:10px;color:#6b7280">Dirección:</span><br><span style="font-size:12px;font-weight:600">${factura.clienteDireccion||'—'}</span></div>
        <div><span style="font-size:10px;color:#6b7280">Ciudad:</span><br><span style="font-size:12px;font-weight:600">${factura.clienteCiudad||'—'}</span></div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <thead><tr style="background:#1a3a6b;color:#fff">
        <th style="padding:8px 10px;font-size:11px;text-align:left">Descripción</th>
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
          <span style="font-size:12px;color:#6b7280">Subtotal</span><span style="font-size:12px;font-weight:600">${fmtM(subtotalVal)}</span>
        </div>
        ${factura.aplicaIva?`<div style="display:flex;justify-content:space-between;padding:6px 0"><span style="font-size:12px;color:#6b7280">IVA 19%</span><span style="font-size:12px;font-weight:600">${fmtM(ivaVal)}</span></div>`:''}
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid #1a3a6b">
          <span style="font-size:14px;font-weight:900;color:#1a3a6b">TOTAL</span>
          <span style="font-size:16px;font-weight:900;color:#e85d26">${fmtM(totalVal)}</span>
        </div>
      </div>
    </div>
  </div><script>window.onload=()=>window.print();</script></body></html>`;
  const win=window.open('','_blank'); win.document.write(html); win.document.close();
}

const emptyItem = () => ({ descripcion:'', talla:'', qty:1, precioUnitario:0, productoIdx:-1 });

export default function PedidosScreen() {
  const { profile } = useAuth();
  const { lots, inventario } = useData();
  const [despachos,  setDespachos]  = useState([]);
  const [facturas,   setFacturas]   = useState([]);
  const [clientes,   setClientes]   = useState([]);
  const [listas,     setListas]     = useState([]);
  const [tab,        setTab]        = useState('pedidos');
  const [showNew,    setShowNew]    = useState(false);
  const [showFact,   setShowFact]   = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [factForm,   setFactForm]   = useState({ aplicaIva:false, notas:'' });

  // Formulario nuevo pedido
  const [selClienteId, setSelClienteId] = useState('');
  const [selListaId,   setSelListaId]   = useState('');
  const [busCliente,   setBusCliente]   = useState('');
  const [items,        setItems]        = useState([emptyItem()]);
  const [guia,         setGuia]         = useState('');
  const [notas,        setNotas]        = useState('');

  useEffect(() => {
    const u1 = listenCol('despachos',     setDespachos,  orderBy('createdAt','desc'));
    const u2 = listenCol('facturas',      setFacturas,   orderBy('createdAt','desc'));
    const u3 = listenCol('clients',       setClientes);
    const u4 = listenCol('listasPrecios', setListas,     orderBy('createdAt','desc'));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const isAdmin  = ['gerente','admin_elrohi'].includes(profile?.role);
  const listasActivas = listas.filter(l=>l.active!==false&&!l.eliminado);

  // Cliente seleccionado
  const clienteSel = clientes.find(c=>c.id===selClienteId);
  // Lista seleccionada
  const listaSel   = listas.find(l=>l.id===selListaId);
  // Productos de la lista
  const productos  = listaSel?.productos || [];

  // Clientes filtrados por búsqueda
  const clientesFilt = busCliente
    ? clientes.filter(c=>c.nombre?.toLowerCase().includes(busCliente.toLowerCase())||c.nit?.includes(busCliente))
    : clientes.filter(c=>c.active!==false);

  const selCliente = (c) => {
    setSelClienteId(c.id);
    setBusCliente(c.nombre);
    // Auto-asignar lista según impuesto del cliente
    const listaAuto = listasActivas.find(l =>
      c.impuesto==='remision_mayorista'
        ? l.nombre.toLowerCase().includes('remis')
        : l.nombre.toLowerCase().includes('contado')||l.nombre.toLowerCase().includes('iva')
    );
    if (listaAuto) setSelListaId(listaAuto.id);
  };

  const addItem = () => setItems(prev=>[...prev, emptyItem()]);
  const removeItem = (i) => setItems(prev=>prev.filter((_,idx)=>idx!==i));

  const updItem = (i, key, val) => {
    setItems(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: val };
      // Auto price when producto or talla changes
      if (key==='productoIdx' || key==='talla') {
        const prod = productos[key==='productoIdx' ? +val : next[i].productoIdx];
        const talla = key==='talla' ? val : next[i].talla;
        if (prod && talla) {
          next[i].precioUnitario = +getPrecioParaTalla(prod, talla) || 0;
          next[i].descripcion    = prod.descripcion;
        }
        if (key==='productoIdx') {
          next[i].productoIdx = +val;
          next[i].talla       = ''; // reset talla
          next[i].precioUnitario = 0;
          next[i].descripcion = prod?.descripcion || '';
        }
      }
      return next;
    });
  };

  const totalPedido = items.reduce((a,i)=>a+(i.qty||0)*i.precioUnitario,0);

  // Verificar disponibilidad - usa inventario y cortes en proceso
  const disponibilidad = useMemo(()=>{
    return items.filter(item=>item.descripcion && item.qty>0).map(item=>{
      const desc = (item.descripcion||'').toLowerCase();
      const talla = (item.talla||'').toUpperCase();
      
      // Buscar en inventario por descripcion y talla (match flexible)
      const keyword = desc.split(' ').slice(0,2).join(' '); // primeras 2 palabras
      const enBodega = (inventario||[]).filter(inv=>{
        const invDesc = (inv.descripcion||inv.nombre||'').toLowerCase();
        const invTalla = (inv.talla||'').toUpperCase();
        return invDesc.includes(keyword) && (!talla || invTalla === talla || !invTalla);
      }).reduce((a,inv)=>a+(+inv.qty||+inv.cantidad||0),0);
      
      // Buscar en cortes activos
      const enProceso = (lots||[]).filter(l=>
        !['despachado','nuevo','en_corte'].includes(l.status)
      ).flatMap(l=>l.garments||[]).filter(g=>{
        const gDesc = (g.descripcionRef||'').toLowerCase();
        return gDesc.includes(keyword);
      }).reduce((a,g)=>a+(g.total||0),0);
      
      return {
        descripcion: item.descripcion,
        talla, qty: +item.qty,
        enBodega, enProceso,
        disponible: enBodega >= item.qty,
        parcial: enBodega < item.qty && (enBodega + enProceso) >= item.qty,
      };
    });
  }, [items, inventario, lots]);

  const crearPedido = async () => {
    if (!selClienteId)              { toast.error('Selecciona un cliente'); return; }
    if (items.some(i=>!i.descripcion||!i.talla||!i.qty||i.qty<1)) {
      toast.error('Completa todos los productos — descripción, talla y cantidad'); return;
    }
    setSaving(true);
    try {
      const numero = String(despachos.length+1).padStart(4,'0');
      await addDocument('despachos', {
        numero,
        clienteId:       selClienteId,
        clienteNombre:   clienteSel?.nombre,
        clienteNit:      clienteSel?.nit,
        clienteDireccion:clienteSel?.direccion,
        clienteCiudad:   clienteSel?.ciudad,
        listaId:         selListaId,
        listaNombre:     listaSel?.nombre,
        impuesto:        clienteSel?.impuesto,
        items,
        guia,
        notas,
        status:          'pendiente',
        creadoPor:       profile?.name,
      });
      toast.success(`✅ Orden OD-${numero} creada`);
      setShowNew(false);
      setSelClienteId(''); setSelListaId(''); setBusCliente('');
      setItems([emptyItem()]); setGuia(''); setNotas('');
    } catch(e) { console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  const statusLabel = (s) => ({
    pendiente:       { label:'⏳ Pendiente',      cls:'bg-amber-100 text-amber-700'   },
    en_alistamiento: { label:'📦 Alistando',       cls:'bg-blue-100 text-blue-700'     },
    para_revision:   { label:'🔍 Para revisión',   cls:'bg-purple-100 text-purple-700' },
    para_facturar:   { label:'🧾 Para facturar',   cls:'bg-green-100 text-green-700'   },
    despachado:      { label:'✅ Despachado',       cls:'bg-gray-100 text-gray-500'     },
  }[s]||{label:s,cls:'bg-gray-100 text-gray-500'});

  const generarFactura = async (despacho) => {
    setSaving(true);
    try {
      const numero  = String(facturas.length+1).padStart(4,'0');
      const aplicaIva = despacho.impuesto === 'iva' || factForm.aplicaIva;
      const factura = {
        numero,
        despachoId:       despacho.id,
        clienteNombre:    despacho.clienteNombre,
        clienteNit:       despacho.clienteNit,
        clienteDireccion: despacho.clienteDireccion,
        clienteCiudad:    despacho.clienteCiudad,
        items:            despacho.items,
        listaNombre:      despacho.listaNombre,
        aplicaIva,
        notas:            factForm.notas,
        fecha:            new Date().toISOString().split('T')[0],
        facturadoPor:     profile?.name,
        status:           'facturado',
      };
      await addDocument('facturas', factura);
      await updateDocument('despachos', despacho.id, { status:'despachado', facturaNumero:numero });
      printFactura(factura);
      toast.success(`✅ Factura N° ${numero} generada`);
      setShowFact(null);
    } catch(e) { console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold text-gray-900">Pedidos y Despachos</h1>
        {isAdmin && (
          <button onClick={()=>setShowNew(true)}
            className="text-xs font-bold px-4 py-2 rounded-lg text-white" style={{background:ACCENT}}>
            + Nueva Orden
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          ['Pendientes', despachos.filter(d=>d.status==='pendiente').length, '#e85d26'],
          ['En proceso', despachos.filter(d=>['en_alistamiento','para_revision','para_facturar'].includes(d.status)).length, '#2563eb'],
          ['Facturas emitidas', facturas.length, '#15803d'],
        ].map(([l,v,c])=>(
          <div key={l} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-2xl font-black" style={{color:c}}>{v}</p>
            <p className="text-[9px] text-gray-400 uppercase tracking-wide mt-0.5">{l}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[['pedidos','Órdenes'],['facturas','Facturas']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:tab===k?'#fff':'transparent',color:tab===k?'#111827':'#6b7280',
              fontWeight:tab===k?700:400,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {/* ÓRDENES */}
      {tab==='pedidos' && (
        <div className="space-y-3">
          {despachos.length===0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-medium text-gray-700">Sin órdenes de despacho</p>
            </div>
          )}
          {despachos.map(d=>{
            const st=statusLabel(d.status);
            return (
              <div key={d.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs font-bold text-blue-700">OD-{d.numero}</span>
                      <span className={`${st.cls} text-[9px] px-2 py-0.5 rounded-full font-bold`}>{st.label}</span>
                      {d.listaNombre && <span className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{d.listaNombre}</span>}
                    </div>
                    <p className="text-sm font-bold text-gray-900">{d.clienteNombre}</p>
                    <p className="text-[10px] text-gray-400">{d.clienteCiudad} · NIT: {d.clienteNit}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {d.items?.map((item,i)=>(
                        <span key={i} className="text-[9px] bg-gray-50 border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                          {item.descripcion?.slice(0,25)}... T{item.talla}: <strong>{item.qty}</strong> × {fmtM(item.precioUnitario)}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs font-black text-gray-800 mt-1">
                      Total: {fmtM(d.items?.reduce((a,i)=>a+i.qty*i.precioUnitario,0)||0)}
                    </p>
                  </div>
                  {isAdmin && d.status==='para_facturar' && (
                    <button onClick={()=>{setShowFact(d);setFactForm({aplicaIva:d.impuesto==='iva',notas:''}); }}
                      className="text-xs font-bold px-3 py-2 rounded-lg text-white flex-shrink-0"
                      style={{background:'#1a3a6b'}}>
                      🧾 Facturar
                    </button>
                  )}
                  {d.facturaNumero && (
                    <button onClick={()=>{const f=facturas.find(x=>x.numero===d.facturaNumero);if(f)printFactura(f);}}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 flex-shrink-0">
                      🖨️ Reimprimir
                    </button>
                  )}
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
            const sub=(f.items||[]).reduce((a,i)=>a+i.qty*i.precioUnitario,0);
            const iva=f.aplicaIva?Math.round(sub*0.19):0;
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
                    <p className="text-sm font-black text-green-600 mt-1">{fmtM(sub+iva)}</p>
                  </div>
                  <button onClick={()=>printFactura(f)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 flex-shrink-0">
                    🖨️ Imprimir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL NUEVO PEDIDO */}
      {showNew && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:16,overflowY:'auto'}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:600,marginTop:16,marginBottom:16}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Nueva Orden de Despacho</h2>
              <button onClick={()=>setShowNew(false)} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
            </div>

            {/* Seleccionar cliente */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Cliente *</label>
              <input value={busCliente} onChange={e=>{setBusCliente(e.target.value);setSelClienteId('');}}
                placeholder="Buscar cliente por nombre o NIT..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              {busCliente && !selClienteId && (
                <div className="border border-gray-200 rounded-lg mt-1 max-h-40 overflow-y-auto shadow-lg bg-white">
                  {clientesFilt.slice(0,8).map(c=>(
                    <button key={c.id} onClick={()=>selCliente(c)}
                      className="w-full text-left px-3 py-2 hover:bg-orange-50 border-b border-gray-50 last:border-0">
                      <p className="text-xs font-bold text-gray-800">{c.nombre}</p>
                      <p className="text-[10px] text-gray-400">NIT: {c.nit} · {c.ciudad}</p>
                    </button>
                  ))}
                  {clientesFilt.length===0 && <p className="text-xs text-gray-400 p-3">Sin resultados</p>}
                </div>
              )}
              {clienteSel && (
                <div className="mt-1 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                  <span className="text-[10px] text-green-700 font-bold">✓ {clienteSel.nombre}</span>
                  <span className="text-[9px] text-green-600">· {clienteSel.impuesto==='iva'?'IVA 19%':clienteSel.impuesto==='remision_mayorista'?'Remisión Mayorista':'Sin impuesto'}</span>
                </div>
              )}
            </div>

            {/* Lista de precios */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Lista de precios *</label>
              <select value={selListaId} onChange={e=>setSelListaId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-orange-400">
                <option value="">— Seleccionar lista —</option>
                {listasActivas.map(l=><option key={l.id} value={l.id}>{l.nombre} ({l.productos?.length||0} productos)</option>)}
              </select>
            </div>

            {/* Items del pedido */}
            {selListaId && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Productos del pedido</p>
                  <button onClick={addItem} className="text-xs text-blue-600 font-medium hover:underline">+ Agregar producto</button>
                </div>

                {items.map((item, i) => {
                  const prodSel  = productos[item.productoIdx];
                  const tallasDisp = prodSel ? getTallasProducto(prodSel) : [];
                  return (
                    <div key={i} className="bg-gray-50 rounded-xl p-3 mb-2 border border-gray-100">
                      {/* Producto */}
                      <div className="mb-2">
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1">Producto</label>
                        <select value={item.productoIdx} onChange={e=>updItem(i,'productoIdx',e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-orange-400">
                          <option value={-1}>— Seleccionar producto —</option>
                          {productos.map((p,j)=>(
                            <option key={j} value={j}>{p.descripcion} ({p.tipo})</option>
                          ))}
                        </select>
                      </div>

                      {prodSel && (
                        <div className="grid grid-cols-3 gap-2">
                          {/* Talla */}
                          <div>
                            <label className="block text-[10px] font-semibold text-gray-500 mb-1">Talla exacta</label>
                            <select value={item.talla} onChange={e=>updItem(i,'talla',e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-orange-400">
                              <option value="">— Talla —</option>
                              {tallasDisp.map(t=><option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          {/* Cantidad */}
                          <div>
                            <label className="block text-[10px] font-semibold text-gray-500 mb-1">Cantidad</label>
                            <input type="number" min={1} value={item.qty}
                              onChange={e=>updItem(i,'qty',+e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none" />
                          </div>
                          {/* Precio auto */}
                          <div>
                            <label className="block text-[10px] font-semibold text-gray-500 mb-1">Precio unit.</label>
                            <div className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-right font-bold bg-white"
                              style={{color:item.precioUnitario>0?'#15803d':'#9ca3af'}}>
                              {item.precioUnitario>0 ? fmtM(item.precioUnitario) : '—'}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        {item.precioUnitario>0 && item.qty>0 && (
                          <span className="text-xs font-black text-gray-700">
                            Subtotal: {fmtM(item.qty*item.precioUnitario)}
                          </span>
                        )}
                        {items.length>1 && (
                          <button onClick={()=>removeItem(i)} className="text-red-400 text-xs ml-auto">✕ Quitar</button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Total */}
                {totalPedido>0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-blue-800">Total del pedido</span>
                      <span className="text-lg font-black" style={{color:'#e85d26'}}>{fmtM(totalPedido)}</span>
                    </div>
                    {clienteSel?.impuesto==='iva' && (
                      <p className="text-[10px] text-blue-600 mt-0.5">+ IVA 19%: {fmtM(Math.round(totalPedido*0.19))} = <strong>{fmtM(Math.round(totalPedido*1.19))}</strong></p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Guía y notas */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Guía de envío</label>
                <input value={guia} onChange={e=>setGuia(e.target.value)} placeholder="Opcional"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notas</label>
                <input value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Instrucciones..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={()=>setShowNew(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={crearPedido} disabled={saving}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                style={{background:ACCENT}}>
                {saving?'Creando...':'📋 Crear Orden de Despacho'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FACTURAR */}
      {showFact && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:480}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Generar Factura</h2>
              <button onClick={()=>setShowFact(null)} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-xs font-bold text-gray-800">{showFact.clienteNombre}</p>
              <p className="text-[10px] text-gray-400">{showFact.clienteCiudad} · NIT: {showFact.clienteNit}</p>
              <div className="mt-2 space-y-1">
                {showFact.items?.map((item,i)=>(
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-600 truncate flex-1 mr-2">{item.descripcion?.slice(0,35)}... T{item.talla} × {item.qty}</span>
                    <span className="font-bold text-gray-800 flex-shrink-0">{fmtM(item.qty*item.precioUnitario)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between">
                <span className="text-xs font-bold">Subtotal</span>
                <span className="text-sm font-black">{fmtM(showFact.items?.reduce((a,i)=>a+i.qty*i.precioUnitario,0)||0)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
              <input type="checkbox" id="iva2" checked={factForm.aplicaIva} onChange={e=>setFactForm(f=>({...f,aplicaIva:e.target.checked}))} />
              <label htmlFor="iva2" className="text-sm font-medium text-gray-700 cursor-pointer">Aplicar IVA 19%</label>
              {factForm.aplicaIva && (
                <span className="text-sm font-bold text-orange-600 ml-auto">
                  Total: {fmtM(Math.round((showFact.items?.reduce((a,i)=>a+i.qty*i.precioUnitario,0)||0)*1.19))}
                </span>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Notas</label>
              <textarea value={factForm.notas} onChange={e=>setFactForm(f=>({...f,notas:e.target.value}))}
                placeholder="Condiciones de pago..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-14 focus:outline-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setShowFact(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={()=>generarFactura(showFact)} disabled={saving}
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
