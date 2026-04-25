import { useState, useRef, useEffect } from 'react';
import { useAuth }   from '../contexts/AuthContext';
import { useData }   from '../contexts/DataContext';
import { addDocument, listenCol } from '../services/db';
import { fmtM }      from '../utils';
import { gLabel }    from '../utils';
import { ACCENT }    from '../constants';
import { orderBy }   from 'firebase/firestore';
import toast         from 'react-hot-toast';

const nowStr = () => new Date().toLocaleString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const MESES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ─── FIRMA CANVAS ─────────────────────────────────────────────────────────────
function FirmaCanvas({ onSave, label }) {
  const ref = useRef(null); const drawing = useRef(false); const [has, setHas] = useState(false);
  const gp  = (e,c) => { const r=c.getBoundingClientRect(); const s=e.touches?e.touches[0]:e; return {x:s.clientX-r.left,y:s.clientY-r.top}; };
  const start=(e)=>{e.preventDefault();drawing.current=true;const c=ref.current;const ctx=c.getContext('2d');const p=gp(e,c);ctx.beginPath();ctx.moveTo(p.x,p.y);};
  const draw=(e)=>{e.preventDefault();if(!drawing.current)return;const c=ref.current;const ctx=c.getContext('2d');ctx.strokeStyle='#14405A';ctx.lineWidth=2.5;ctx.lineCap='round';const p=gp(e,c);ctx.lineTo(p.x,p.y);ctx.stroke();setHas(true);};
  const stop=()=>{drawing.current=false;};
  const clear=()=>{ref.current.getContext('2d').clearRect(0,0,ref.current.width,ref.current.height);setHas(false);onSave(null);};
  const save=()=>{onSave(ref.current.toDataURL('image/png'));toast.success('Firma guardada');};
  return (
    <div style={{marginBottom:8}}>
      <p style={{fontSize:11,fontWeight:600,color:'#374151',marginBottom:4}}>{label}</p>
      <div style={{border:'1px solid #d1d5db',borderRadius:8,background:'#fff',overflow:'hidden'}}>
        <canvas ref={ref} width={900} height={120} style={{display:'block',touchAction:'none',cursor:'crosshair',width:'100%'}}
          onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={stop} />
      </div>
      <div style={{display:'flex',gap:6,marginTop:4}}>
        <button onClick={clear} style={{fontSize:10,padding:'2px 9px',background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:4,cursor:'pointer',fontWeight:600}}>Borrar</button>
        {has && <button onClick={save} style={{fontSize:10,padding:'2px 9px',background:'#dcfce7',color:'#15803d',border:'none',borderRadius:4,cursor:'pointer',fontWeight:600}}>✓ Guardar firma</button>}
      </div>
    </div>
  );
}

// ─── PRINT RECIBO ─────────────────────────────────────────────────────────────
function printRecibo(operario, detalle, satName, periodo, firmaAdmin, firmaSat) {
  const rows = detalle.ops.map(o=>`
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:5px 8px;font-size:11px;color:#14405A">${o.lotCode}</td>
      <td style="padding:5px 8px;font-size:11px">${o.opName}</td>
      <td style="padding:5px 8px;font-size:11px;text-align:center">${o.qty?.toLocaleString('es-CO')}</td>
      <td style="padding:5px 8px;font-size:11px;text-align:right">${fmtM(o.valUnit)}</td>
      <td style="padding:5px 8px;font-size:11px;text-align:right;font-weight:700">${fmtM(o.subtotal)}</td>
    </tr>`).join('');

  const firmaBox = (label,img,nombre) => `
    <div style="text-align:center;padding:8px">
      ${img?`<img src="${img}" style="height:60px;display:block;margin:0 auto 4px;border-bottom:1.5px solid #14405A;width:80%;object-fit:contain">`
           :`<div style="height:60px;border-bottom:1.5px solid #14405A;margin:0 16px"></div>`}
      <div style="font-size:9px;font-weight:700;color:#14405A;margin-top:4px">${label}</div>
      ${nombre?`<div style="font-size:10px;color:#374151;margin-top:2px">${nombre}</div>`:''}
    </div>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Recibo de Pago</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif}@media print{body{print-color-adjust:exact}}</style>
  </head><body><div style="max-width:800px;margin:16px auto;border:1.5px solid #14405A">
    <div style="background:#F7F7F7;border-bottom:2px solid #14405A;padding:10px 16px;display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-size:18px;font-weight:900;color:#14405A">${satName}</div>
        <div style="font-size:9px;color:#14405A">Taller Satélite · Recibo de pago operario</div></div>
      <div style="text-align:right">
        <div style="font-size:9px;font-weight:700;color:#6b7280">RECIBO DE PAGO OPERARIO</div>
        <div style="font-size:13px;font-weight:900;color:#2878B4">${periodo}</div>
      </div>
    </div>
    <div style="padding:10px 16px;border-bottom:1px solid #e5e7eb;display:flex;gap:24px">
      <div><span style="font-size:9px;color:#6b7280">OPERARIO</span><div style="font-size:14px;font-weight:700;color:#14405A">${operario.name}</div></div>
      <div><span style="font-size:9px;color:#6b7280">CÉDULA</span><div style="font-size:12px;font-weight:600">${operario.cedula||'—'}</div></div>
      <div><span style="font-size:9px;color:#6b7280">FECHA</span><div style="font-size:12px">${nowStr()}</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#14405A;color:#fff">
        <th style="padding:6px 8px;font-size:10px;text-align:left">Corte</th>
        <th style="padding:6px 8px;font-size:10px;text-align:left">Operación</th>
        <th style="padding:6px 8px;font-size:10px;text-align:center">Piezas</th>
        <th style="padding:6px 8px;font-size:10px;text-align:right">Valor/pza</th>
        <th style="padding:6px 8px;font-size:10px;text-align:right">Subtotal</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="padding:10px 16px;border-top:1px solid #e5e7eb">
      ${detalle.salarioFijo>0?`<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>Salario fijo</span><span>${fmtM(detalle.salarioFijo)}</span></div>`:''}
      ${detalle.incentivos>0?`<div style="display:flex;justify-content:space-between;font-size:12px;color:#15803d;margin-bottom:4px"><span>Incentivos</span><span>+${fmtM(detalle.incentivos)}</span></div>`:''}
      ${detalle.descuentos>0?`<div style="display:flex;justify-content:space-between;font-size:12px;color:#dc2626;margin-bottom:4px"><span>Descuentos</span><span>-${fmtM(detalle.descuentos)}</span></div>`:''}
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900;border-top:2px solid #14405A;padding-top:8px;margin-top:4px">
        <span style="color:#14405A">TOTAL A PAGAR</span>
        <span style="color:#e85d26">${fmtM(detalle.total)}</span>
      </div>
      ${detalle.obs?`<div style="margin-top:8px;font-size:10px;color:#6b7280">Nota: ${detalle.obs}</div>`:''}
    </div>
    <div style="border-top:1px solid #14405A;display:grid;grid-template-columns:1fr 1fr">
      ${firmaBox('Pagado por — Admin Satélite', firmaAdmin, satName)}
      <div style="border-left:1px solid #14405A">${firmaBox('Recibido por — Operario', firmaSat, operario.name)}</div>
    </div>
  </div><script>window.onload=()=>window.print();</script></body></html>`;
  const win=window.open('','_blank'); win.document.write(html); win.document.close();
}

// ─── MODAL PAGO OPERARIO ──────────────────────────────────────────────────────
function ModalPago({ operario, detalle, satName, periodo, onClose, onGuardar }) {
  const [firmaAdmin, setFirmaAdmin] = useState(null);
  const [firmaOp,    setFirmaOp]    = useState(null);
  const [saving,     setSaving]     = useState(false);

  const confirmar = async () => {
    if (!firmaAdmin) { toast.error('El Admin Satélite debe firmar'); return; }
    if (!firmaOp)    { toast.error('El operario debe firmar'); return; }
    setSaving(true);
    try {
      printRecibo(operario, detalle, satName, periodo, firmaAdmin, firmaOp);
      await onGuardar(firmaAdmin, firmaOp);
      toast.success('✅ Pago registrado y recibo generado');
      onClose();
    } catch(e) { console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:16,overflowY:'auto'}}>
      <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:500,marginTop:16,marginBottom:16}}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Pago a {operario.name}</h2>
            <p className="text-xs text-gray-400">{periodo}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
        </div>

        {/* Resumen */}
        <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1">
          {detalle.ops.map((o,i)=>(
            <div key={i} className="flex justify-between text-xs text-gray-600">
              <span>{o.lotCode} · {o.opName} × {o.qty?.toLocaleString('es-CO')} pzas</span>
              <span className="font-bold">{fmtM(o.subtotal)}</span>
            </div>
          ))}
          {detalle.ops.length===0 && <p className="text-xs text-gray-400 italic text-center">Sin operaciones completadas</p>}
          <div className="border-t border-gray-200 pt-2 mt-2 space-y-1">
            {detalle.salarioFijo>0 && <div className="flex justify-between text-xs"><span>Salario fijo</span><span>{fmtM(detalle.salarioFijo)}</span></div>}
            {detalle.incentivos>0  && <div className="flex justify-between text-xs text-green-700"><span>Incentivos</span><span>+{fmtM(detalle.incentivos)}</span></div>}
            {detalle.descuentos>0  && <div className="flex justify-between text-xs text-red-600"><span>Descuentos</span><span>-{fmtM(detalle.descuentos)}</span></div>}
          </div>
          <div className="flex justify-between text-sm font-black border-t border-gray-300 pt-2 mt-1">
            <span style={{color:'#14405A'}}>TOTAL</span>
            <span style={{color:'#e85d26'}}>{fmtM(detalle.total)}</span>
          </div>
        </div>

        {/* Firmas */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-blue-800">Firma Admin Satélite (Paga)</p>
            {firmaAdmin && <span className="text-[10px] text-green-600 font-bold">✓ Firmado</span>}
          </div>
          <FirmaCanvas label="Firma del Admin Satélite:" onSave={setFirmaAdmin} />
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-green-800">Firma Operario — {operario.name} (Recibe)</p>
            {firmaOp && <span className="text-[10px] text-green-600 font-bold">✓ Firmado</span>}
          </div>
          <FirmaCanvas label="Firma del operario:" onSave={setFirmaOp} />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
          <button onClick={confirmar} disabled={saving}
            className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
            style={{background:'#15803d'}}>
            {saving?'Generando...':'💰 Confirmar y generar recibo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PANTALLA PRINCIPAL ───────────────────────────────────────────────────────
export default function NominaSateliteScreen() {
  const { profile }       = useAuth();
  const { lots, users }   = useData();
  const [nominas, setNominas] = useState([]);
  const [tab,     setTab]     = useState('nueva');
  const [periodo, setPeriodo] = useState('');
  const [ajustes, setAjustes] = useState({});
  const [modalPago, setModalPago] = useState(null); // {operario, detalle}
  const [saving,  setSaving]  = useState(false);

  const HOY = new Date();
  const periodoDefault = () => {
    const d = HOY.getDate(); const m = MESES[HOY.getMonth()]; const y = HOY.getFullYear();
    return d<=15 ? `1-15 ${m} ${y}` : `16-${new Date(y,HOY.getMonth()+1,0).getDate()} ${m} ${y}`;
  };

  useEffect(()=>{ setPeriodo(periodoDefault()); },[]);

  useEffect(()=>{
    const unsub = listenCol('nominasSatelite', setNominas, orderBy('createdAt','desc'));
    return unsub;
  },[]);

  const sat       = profile?.satId;
  const satInfo   = (typeof satellites !== 'undefined' ? satellites : []).find(s=>s.id===profile?.satId);
  const satName   = satInfo?.name || profile?.name || 'Mi Taller';

  // Operarios del satélite
  const operarios = users.filter(u => u.role==='operario' && u.satId===sat && u.active!==false);

  // Cortes del satélite con operaciones completadas
  const misLots = lots.filter(l => l.satId===sat);

  const calcularOperario = (operarioId) => {
    let ops = [];
    misLots.forEach(lot => {
      (lot.lotOps||[]).forEach(op => {
        if (op.wId===operarioId && op.status==='completado') {
          ops.push({
            lotCode:  lot.code,
            opName:   op.name,
            qty:      op.qty||0,
            valUnit:  op.val||0,
            subtotal: (op.qty||0)*(op.val||0),
          });
        }
      });
    });
    const aj = ajustes[operarioId]||{};
    const subtotalOps = ops.reduce((a,o)=>a+o.subtotal,0);
    const salarioFijo = +aj.salarioFijo||0;
    const incentivos  = +aj.incentivos||0;
    const descuentos  = +aj.descuentos||0;
    const total = subtotalOps + salarioFijo + incentivos - descuentos;
    return { ops, subtotalOps, salarioFijo, incentivos, descuentos, total, obs: aj.obs||'' };
  };

  const updAjuste = (opId, key, val) => setAjustes(p=>({...p,[opId]:{...p[opId],[key]:val}}));
  const totalNomina = operarios.reduce((a,op)=>a+calcularOperario(op.id).total,0);

  const guardarPago = async (operario, detalle, firmaAdmin, firmaOp) => {
    const docData = {
      satId: sat, satName, periodo,
      operarioId:   operario.id,
      operarioName: operario.name,
      detalle, total: detalle.total,
      firmaAdmin, firmaOp,
      fechaPago: nowStr(),
      status: 'pagado',
    };
    await addDocument('nominasSatelite', docData);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-sm font-bold text-gray-900">Nómina del Taller</h1>
          <p className="text-xs text-gray-400">{operarios.length} operarios</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[['nueva','📋 Liquidar'],['historial','📁 Historial']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:tab===k?'#fff':'transparent',color:tab===k?'#111827':'#6b7280',
              fontWeight:tab===k?700:400,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {/* LIQUIDAR */}
      {tab==='nueva' && (
        <div>
          {/* Período */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Período</p>
            <input value={periodo} onChange={e=>setPeriodo(e.target.value)}
              placeholder="Ej: 1-15 Abril 2026"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
            <div className="flex gap-2 mt-2 flex-wrap">
              {[`1-15 ${MESES[HOY.getMonth()]} ${HOY.getFullYear()}`,`16-${new Date(HOY.getFullYear(),HOY.getMonth()+1,0).getDate()} ${MESES[HOY.getMonth()]} ${HOY.getFullYear()}`].map(p=>(
                <button key={p} onClick={()=>setPeriodo(p)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-orange-400 hover:text-orange-600">
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Operarios */}
          {operarios.length===0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <p className="text-2xl mb-2">👷</p>
              <p className="text-sm text-gray-500">Sin operarios en este taller</p>
            </div>
          )}

          {operarios.map(op=>{
            const calc = calcularOperario(op.id);
            const aj   = ajustes[op.id]||{};
            const pagado = nominas.some(n=>n.operarioId===op.id && n.periodo===periodo && n.status==='pagado');
            if (pagado) return (
              <div key={op.id} className="bg-white rounded-xl border border-green-200 p-4 mb-3 opacity-70">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{op.name}</p>
                    <p className="text-[10px] text-gray-400">{periodo}</p>
                  </div>
                  <span className="text-[9px] bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold">✅ Pagado</span>
                </div>
              </div>
            );
            return (
              <div key={op.id} className="bg-white rounded-xl border border-gray-100 p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{op.name}</p>
                    <p className="text-[10px] text-gray-400">{calc.ops.length} operaciones completadas</p>
                  </div>
                  <p className="text-lg font-black" style={{color:'#14405A'}}>{fmtM(calc.total)}</p>
                </div>

                {/* Operaciones completadas */}
                {calc.ops.length>0 && (
                  <div className="bg-gray-50 rounded-xl p-3 mb-3">
                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Operaciones completadas</p>
                    {calc.ops.map((o,i)=>(
                      <div key={i} className="flex justify-between text-xs text-gray-600 py-0.5">
                        <span>{o.lotCode} · {o.opName} × {o.qty?.toLocaleString('es-CO')} pzas</span>
                        <span className="font-bold">{fmtM(o.subtotal)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-bold text-gray-800 pt-2 border-t border-gray-200 mt-1">
                      <span>Subtotal</span><span>{fmtM(calc.subtotalOps)}</span>
                    </div>
                  </div>
                )}

                {/* Ajustes */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[['salarioFijo','Salario fijo','#6b7280'],['incentivos','Incentivos +','#15803d'],['descuentos','Descuentos -','#dc2626']].map(([key,label,color])=>(
                    <div key={key}>
                      <label className="block text-[10px] font-semibold mb-1" style={{color}}>{label}</label>
                      <input type="number" min={0} value={aj[key]||''}
                        onChange={e=>updAjuste(op.id,key,e.target.value)}
                        placeholder="0"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none" />
                    </div>
                  ))}
                </div>
                <input value={aj.obs||''} onChange={e=>updAjuste(op.id,'obs',e.target.value)}
                  placeholder="Observaciones..."
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none mb-3" />

                <button onClick={()=>setModalPago({operario:op, detalle:calc})}
                  disabled={calc.total<=0}
                  className="w-full py-2.5 text-white text-xs font-bold rounded-xl disabled:opacity-40"
                  style={{background:'#15803d'}}>
                  💰 Generar pago y recibo — {fmtM(calc.total)}
                </button>
              </div>
            );
          })}

          {operarios.length>0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-blue-800">Total nómina — {periodo}</span>
                <span className="text-xl font-black" style={{color:'#e85d26'}}>{fmtM(totalNomina)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HISTORIAL */}
      {tab==='historial' && (
        <div className="space-y-3">
          {nominas.filter(n=>n.satId===sat).length===0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-3xl mb-2">📋</p>
              <p className="font-medium text-gray-700">Sin pagos registrados</p>
            </div>
          )}
          {nominas.filter(n=>n.satId===sat).map(n=>(
            <div key={n.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">{n.operarioName}</p>
                  <p className="text-xs text-gray-400">{n.periodo}</p>
                  <p className="text-xs text-gray-400">{n.fechaPago}</p>
                  <p className="text-sm font-black mt-1" style={{color:'#14405A'}}>{fmtM(n.total)}</p>
                </div>
                <button onClick={()=>printRecibo(
                    {name:n.operarioName,cedula:''}, n.detalle, n.satName||satName, n.periodo, n.firmaAdmin, n.firmaOp
                  )}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 flex-shrink-0">
                  🖨️ Reimprimir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL PAGO */}
      {modalPago && (
        <ModalPago
          operario={modalPago.operario}
          detalle={modalPago.detalle}
          satName={satName}
          periodo={periodo}
          onClose={()=>setModalPago(null)}
          onGuardar={(fAdmin,fOp)=>guardarPago(modalPago.operario, modalPago.detalle, fAdmin, fOp)}
        />
      )}
    </div>
  );
}
