import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { addDocument, updateDocument, listenCol } from '../services/db';
import { gLabel, fmtM } from '../utils';
import { GARMENT_TYPES, SIZES, ACCENT } from '../constants';
import { orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';

const todayISO = () => new Date().toISOString().split('T')[0];
const nowStr   = () => new Date().toLocaleString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});

function printFactura(factura) {
  const itemRows = factura.items.map(item => {
    const subtotal = item.qty * item.precioUnitario;
    return `<tr>
      <td style="border:1px solid #e5e7eb;padding:6px 10px;font-size:11px">${gLabel(item.gtId)}</td>
      <td style="border:1px solid #e5e7eb;padding:6px 10px;text-align:center;font-size:11px">${item.talla||'—'}</td>
      <td style="border:1px solid #e5e7eb;padding:6px 10px;text-align:center;font-size:11px;font-weight:600">${item.qty}</td>
      <td style="border:1px solid #e5e7eb;padding:6px 10px;text-align:right;font-size:11px">${fmtM(item.precioUnitario)}</td>
      <td style="border:1px solid #e5e7eb;padding:6px 10px;text-align:right;font-size:11px;font-weight:700">${fmtM(subtotal)}</td>
    </tr>`;
  }).join('');

  const subtotalVal = factura.items.reduce((a,i) => a + i.qty * i.precioUnitario, 0);
  const ivaVal      = factura.aplicaIva ? Math.round(subtotalVal * 0.19) : 0;
  const totalVal    = subtotalVal + ivaVal;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>Factura ${factura.numero}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif}@media print{body{print-color-adjust:exact}}</style>
  </head><body>
  <div style="max-width:800px;margin:20px auto;padding:0 20px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #1a3a6b">
      <div>
        <div style="font-size:20px;font-weight:900;color:#1a3a6b">Dotaciones <span style="color:#e85d26">EL ROHI</span></div>
        <div style="font-size:10px;color:#6b7280;margin-top:4px">NIT. 901.080.234-7</div>
        <div style="font-size:10px;color:#6b7280">Calle 39 A Sur No. 5-63 Este La Victoria</div>
        <div style="font-size:10px;color:#6b7280">Cel.: 313 372 5739</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:0.1em">FACTURA DE VENTA</div>
        <div style="font-size:24px;font-weight:900;color:#e85d26;font-family:monospace">N° ${factura.numero}</div>
        <div style="font-size:11px;color:#6b7280">Fecha: ${factura.fecha}</div>
        ${factura.esParcial?`<div style="font-size:10px;color:#d97706;font-weight:700;margin-top:4px">⚠ DESPACHO PARCIAL</div>`:''}
      </div>
    </div>

    <div style="background:#f9fafb;border-radius:8px;padding:12px 16px;margin-bottom:20px">
      <p style="font-size:11px;font-weight:700;color:#374151;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">Datos del Cliente</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><span style="font-size:10px;color:#6b7280">Nombre:</span><br><span style="font-size:12px;font-weight:600;color:#111827">${factura.clienteNombre}</span></div>
        <div><span style="font-size:10px;color:#6b7280">NIT / Cédula:</span><br><span style="font-size:12px;font-weight:600;color:#111827">${factura.clienteNit||'—'}</span></div>
        <div><span style="font-size:10px;color:#6b7280">Dirección:</span><br><span style="font-size:12px;font-weight:600;color:#111827">${factura.clienteDireccion||'—'}</span></div>
        <div><span style="font-size:10px;color:#6b7280">Ciudad:</span><br><span style="font-size:12px;font-weight:600;color:#111827">${factura.clienteCiudad||'—'}</span></div>
        ${factura.guia?`<div style="grid-column:span 2"><span style="font-size:10px;color:#6b7280">Guía de envío:</span><br><span style="font-size:12px;font-weight:600;color:#2563eb">${factura.guia}</span></div>`:''}
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

    <div style="margin-top:30px;text-align:center;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px">
      Dotaciones EL ROHI · NIT 901.080.234-7 · Factura generada el ${factura.fecha}
    </div>
  </div>
  <script>window.onload=()=>window.print();</script>
  </body></html>`;
  const win=window.open('','_blank'); win.document.write(html); win.document.close();
}

export default function PedidosScreen() {
  const { profile } = useAuth();
  const { lots }    = useData();
  const [despachos,  setDespachos]  = useState([]);
  const [facturas,   setFacturas]   = useState([]);
  const [tab, setTab] = useState('pedidos');
  const [showNew, setShowNew]   = useState(false);
  const [showFact, setShowFact] = useState(null);
  const [saving, setSaving]     = useState(false);

  // Formulario nuevo despacho
  const [form, setForm] = useState({
    clienteNombre:'', clienteNit:'', clienteDireccion:'', clienteCiudad:'', guia:'',
    items: [{ gtId:'gt1', talla:'', qty:1, precioUnitario:0 }],
    notas:'', esParcial: false,
  });

  // Formulario factura
  const [factForm, setFactForm] = useState({ aplicaIva: false, notas:'' });

  useEffect(() => {
    const u1 = listenCol('despachos', setDespachos, orderBy('createdAt','desc'));
    const u2 = listenCol('facturas',  setFacturas,  orderBy('createdAt','desc'));
    return () => { u1(); u2(); };
  }, []);

  const isAdmin = ['gerente','admin_elrohi'].includes(profile?.role);
  const pendientes   = despachos.filter(d => d.status === 'pendiente');
  const listasEnviar = despachos.filter(d => d.status === 'lista_enviar');

  const addItem = () => setForm(f => ({...f, items:[...f.items,{gtId:'gt1',talla:'',qty:1,precioUnitario:0}]}));
  const removeItem = (i) => setForm(f => ({...f, items:f.items.filter((_,idx)=>idx!==i)}));
  const updItem = (i,k,v) => setForm(f => { const items=[...f.items]; items[i]={...items[i],[k]:v}; return {...f,items}; });

  const crearDespacho = async () => {
    if (!form.clienteNombre) { toast.error('Nombre del cliente es obligatorio'); return; }
    if (form.items.some(i => !i.qty || i.qty < 1)) { toast.error('Revisa las cantidades'); return; }
    setSaving(true);
    try {
      const numero = String(despachos.length + 1).padStart(4,'0');
      await addDocument('despachos', {
        numero, ...form,
        status: 'pendiente',
        creadoPor: profile?.name,
        fecha: todayISO(),
      });
      toast.success(`✅ Orden de despacho OD-${numero} creada`);
      setShowNew(false);
      setForm({ clienteNombre:'',clienteNit:'',clienteDireccion:'',clienteCiudad:'',guia:'', items:[{gtId:'gt1',talla:'',qty:1,precioUnitario:0}], notas:'', esParcial:false });
    } catch(e) { console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  const generarFactura = async (despacho) => {
    setSaving(true);
    try {
      const numero = String(facturas.length + 1).padStart(4,'0');
      const factura = {
        numero,
        despachoId: despacho.id,
        clienteNombre:    despacho.clienteNombre,
        clienteNit:       despacho.clienteNit,
        clienteDireccion: despacho.clienteDireccion,
        clienteCiudad:    despacho.clienteCiudad,
        guia:             despacho.guia,
        items:            despacho.items,
        esParcial:        despacho.esParcial || false,
        aplicaIva:        factForm.aplicaIva,
        notas:            factForm.notas,
        fecha:            todayISO(),
        facturadoPor:     profile?.name,
        status:           'facturado',
      };
      await addDocument('facturas', factura);
      await updateDocument('despachos', despacho.id, { status: 'despachado', facturaNumero: numero });
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
          <button onClick={() => setShowNew(true)}
            className="text-xs font-bold px-4 py-2 rounded-lg text-white"
            style={{background:ACCENT}}>
            + Nueva Orden de Despacho
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          ['Pendientes preparar', pendientes.length, '#e85d26'],
          ['Listas para enviar', listasEnviar.length, '#15803d'],
          ['Facturas emitidas', facturas.length, '#2563eb'],
        ].map(([l,v,c])=>(
          <div key={l} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-2xl font-black" style={{color:c}}>{v}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{l}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[['pedidos','Órdenes de Despacho'],['facturas','Facturas']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:tab===k?'#fff':'transparent',color:tab===k?'#111827':'#6b7280',fontWeight:tab===k?700:400,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {/* ÓRDENES DE DESPACHO */}
      {tab==='pedidos' && (
        <div className="space-y-3">
          {despachos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-medium text-gray-700">Sin órdenes de despacho</p>
              <p className="text-sm text-gray-400 mt-1">Crea una nueva orden con el botón de arriba</p>
            </div>
          )}
          {despachos.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs font-bold text-blue-700">OD-{d.numero}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                      d.status==='lista_enviar'?'bg-green-100 text-green-700':
                      d.status==='despachado'?'bg-blue-100 text-blue-700':
                      'bg-amber-100 text-amber-700'}`}>
                      {d.status==='lista_enviar'?'✓ Lista para enviar':d.status==='despachado'?'✅ Despachado':'⏳ Preparando'}
                    </span>
                    {d.esParcial && <span className="text-[9px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">Despacho parcial</span>}
                    {d.facturaNumero && <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">Fact. N°{d.facturaNumero}</span>}
                  </div>
                  <p className="text-sm font-bold text-gray-900">{d.clienteNombre}</p>
                  {d.clienteDireccion && <p className="text-[10px] text-gray-400">{d.clienteDireccion} · {d.clienteCiudad}</p>}
                  {d.guia && <p className="text-[10px] text-blue-600 font-medium">Guía: {d.guia}</p>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {d.items?.map((item,i) => (
                      <span key={i} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {gLabel(item.gtId)} {item.talla}: <strong>{item.qty}</strong> × {fmtM(item.precioUnitario)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {isAdmin && d.status === 'lista_enviar' && (
                    <button onClick={() => { setShowFact(d); setFactForm({aplicaIva:false,notas:''}); }}
                      className="text-xs font-bold px-3 py-2 rounded-lg text-white"
                      style={{background:'#1a3a6b'}}>
                      🧾 Generar Factura
                    </button>
                  )}
                  {d.facturaNumero && (
                    <button onClick={() => {
                      const f = facturas.find(x => x.numero === d.facturaNumero);
                      if (f) printFactura(f);
                    }}
                      className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                      🖨️ Reimprimir
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FACTURAS */}
      {tab==='facturas' && (
        <div className="space-y-3">
          {facturas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-4xl mb-3">🧾</p>
              <p className="font-medium text-gray-700">Sin facturas emitidas</p>
            </div>
          )}
          {facturas.map(f => {
            const subtotal = f.items?.reduce((a,i) => a+i.qty*i.precioUnitario, 0) || 0;
            const iva      = f.aplicaIva ? Math.round(subtotal*0.19) : 0;
            const total    = subtotal + iva;
            return (
              <div key={f.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold" style={{color:'#e85d26'}}>Factura N° {f.numero}</span>
                      <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✅ Emitida</span>
                      {f.esParcial && <span className="text-[9px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">Parcial</span>}
                    </div>
                    <p className="text-sm font-bold text-gray-900">{f.clienteNombre}</p>
                    <p className="text-[10px] text-gray-400">{f.fecha} · {f.facturadoPor}</p>
                    <p className="text-sm font-black text-green-600 mt-1">{fmtM(total)}</p>
                  </div>
                  <button onClick={() => printFactura(f)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex-shrink-0">
                    🖨️ Imprimir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL NUEVA ORDEN */}
      {showNew && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'16px',overflowY:'auto'}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:560,marginTop:16,marginBottom:16}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Nueva Orden de Despacho</h2>
              <button onClick={()=>setShowNew(false)} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
            </div>

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Datos del cliente</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre del cliente *</label>
                <input value={form.clienteNombre} onChange={e=>setForm(f=>({...f,clienteNombre:e.target.value}))}
                  placeholder="Empresa o persona"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">NIT / Cédula</label>
                <input value={form.clienteNit} onChange={e=>setForm(f=>({...f,clienteNit:e.target.value}))}
                  placeholder="900.123.456"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Ciudad</label>
                <input value={form.clienteCiudad} onChange={e=>setForm(f=>({...f,clienteCiudad:e.target.value}))}
                  placeholder="Bogotá"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Dirección de entrega</label>
                <input value={form.clienteDireccion} onChange={e=>setForm(f=>({...f,clienteDireccion:e.target.value}))}
                  placeholder="Calle 10 # 5-20"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Guía de envío</label>
                <input value={form.guia} onChange={e=>setForm(f=>({...f,guia:e.target.value}))}
                  placeholder="Opcional"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="esParcial" checked={form.esParcial} onChange={e=>setForm(f=>({...f,esParcial:e.target.checked}))} />
                <label htmlFor="esParcial" className="text-xs text-gray-600 cursor-pointer">Despacho parcial</label>
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Referencias a despachar</p>
              <button onClick={addItem} className="text-xs text-blue-600 font-medium hover:underline">+ Agregar</button>
            </div>

            {form.items.map((item,i) => (
              <div key={i} className="flex gap-2 mb-2 items-end">
                <div className="flex-1">
                  <select value={item.gtId} onChange={e=>updItem(i,'gtId',e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none">
                    {GARMENT_TYPES.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div style={{width:60}}>
                  <select value={item.talla} onChange={e=>updItem(i,'talla',e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none">
                    <option value="">Talla</option>
                    {SIZES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{width:60}}>
                  <input type="number" min={1} value={item.qty} onChange={e=>updItem(i,'qty',+e.target.value)}
                    placeholder="Cant"
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none" />
                </div>
                <div style={{width:90}}>
                  <input type="number" min={0} value={item.precioUnitario} onChange={e=>updItem(i,'precioUnitario',+e.target.value)}
                    placeholder="$/pza"
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none" />
                </div>
                {form.items.length > 1 && (
                  <button onClick={()=>removeItem(i)} className="text-red-400 font-bold text-sm bg-transparent border-none cursor-pointer pb-1">✕</button>
                )}
              </div>
            ))}

            <div className="bg-blue-50 rounded-xl p-3 my-3 text-xs">
              <p className="font-bold text-blue-800 mb-1">Resumen:</p>
              {form.items.map((item,i) => (
                <p key={i} className="text-blue-600">{gLabel(item.gtId)} T{item.talla}: {item.qty} × {fmtM(item.precioUnitario)} = <strong>{fmtM(item.qty*item.precioUnitario)}</strong></p>
              ))}
              <p className="font-black text-blue-900 mt-1 text-sm">Total: {fmtM(form.items.reduce((a,i)=>a+i.qty*i.precioUnitario,0))}</p>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notas</label>
              <textarea value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}
                placeholder="Instrucciones especiales de entrega..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-14 focus:outline-none" />
            </div>

            <div className="flex gap-2">
              <button onClick={()=>setShowNew(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={crearDespacho} disabled={saving}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                style={{background:ACCENT}}>
                {saving?'Creando...':'📋 Crear Orden de Despacho'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GENERAR FACTURA */}
      {showFact && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:480}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Generar Factura de Venta</h2>
              <button onClick={()=>setShowFact(null)} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-xs font-bold text-gray-700">{showFact.clienteNombre}</p>
              <p className="text-[10px] text-gray-400">{showFact.clienteDireccion}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {showFact.items?.map((item,i) => (
                  <span key={i} className="text-[9px] bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-600">
                    {gLabel(item.gtId)} {item.talla}: {item.qty} × {fmtM(item.precioUnitario)}
                  </span>
                ))}
              </div>
              <p className="text-sm font-black text-gray-900 mt-2">
                Subtotal: {fmtM(showFact.items?.reduce((a,i)=>a+i.qty*i.precioUnitario,0)||0)}
              </p>
            </div>

            <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
              <input type="checkbox" id="iva" checked={factForm.aplicaIva} onChange={e=>setFactForm(f=>({...f,aplicaIva:e.target.checked}))} />
              <label htmlFor="iva" className="text-sm font-medium text-gray-700 cursor-pointer">Aplicar IVA 19%</label>
              {factForm.aplicaIva && (
                <span className="text-sm font-bold text-orange-600 ml-auto">
                  + {fmtM(Math.round((showFact.items?.reduce((a,i)=>a+i.qty*i.precioUnitario,0)||0)*0.19))}
                </span>
              )}
            </div>

            {factForm.aplicaIva && (
              <div className="bg-green-50 rounded-xl p-3 mb-4 text-center">
                <p className="text-[10px] text-green-600">TOTAL CON IVA</p>
                <p className="text-xl font-black text-green-700">
                  {fmtM(Math.round((showFact.items?.reduce((a,i)=>a+i.qty*i.precioUnitario,0)||0)*1.19))}
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notas de factura</label>
              <textarea value={factForm.notas} onChange={e=>setFactForm(f=>({...f,notas:e.target.value}))}
                placeholder="Condiciones de pago, observaciones..."
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
