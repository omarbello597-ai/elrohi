import { useState, useEffect } from 'react';
import { useAuth }   from '../contexts/AuthContext';
import { useData }   from '../contexts/DataContext';
import { addDocument, updateDocument, listenCol } from '../services/db';
import { fmtM }      from '../utils';
import { ACCENT }    from '../constants';
import { orderBy }   from 'firebase/firestore';
import toast         from 'react-hot-toast';

const HOY = new Date();
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const periodoDefault = () => {
  const d = HOY.getDate();
  const m = MESES[HOY.getMonth()];
  const y = HOY.getFullYear();
  return d <= 15 ? `1-15 ${m} ${y}` : `16-${new Date(y,HOY.getMonth()+1,0).getDate()} ${m} ${y}`;
};

export default function NominaSateliteScreen() {
  const { profile }          = useAuth();
  const { lots, users }      = useData();
  const [nominas,  setNominas]  = useState([]);
  const [tab,      setTab]      = useState('nueva');
  const [periodo,  setPeriodo]  = useState(periodoDefault());
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin,    setFechaFin]    = useState('');
  const [ajustes,  setAjustes]  = useState({});
  const [saving,   setSaving]   = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [configPeriodos, setConfigPeriodos] = useState([
    { nombre: 'Primera quincena', inicio: '1', fin: '15' },
    { nombre: 'Segunda quincena', inicio: '16', fin: '30' },
  ]);

  useEffect(()=>{
    const unsub = listenCol('nominasSatelite', setNominas, orderBy('createdAt','desc'));
    return unsub;
  },[]);

  const isSat   = profile?.role === 'admin_satelite';
  const isAdmin = ['gerente','admin_elrohi'].includes(profile?.role);

  // Operarios del satélite
  const operarios = users.filter(u =>
    u.role === 'operario' && u.satId === profile?.satId && u.active !== false
  );

  // Cortes completados del satélite en el período
  const cortesCompletados = lots.filter(l =>
    l.satId === profile?.satId &&
    ['listo_remision_tintoreria','tintoreria','listo_recepcion_admin',
     'listo_bodega','bodega_lonas','bodega_calidad','en_operaciones_elrohi',
     'en_revision_calidad','despachado'].includes(l.status)
  );

  // Calcular operaciones por operario
  const calcularOperario = (operarioId) => {
    let ops = [];
    cortesCompletados.forEach(lot => {
      (lot.lotOps||[]).forEach(op => {
        if (op.wId === operarioId && op.status === 'completado') {
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
    const subtotalOps = ops.reduce((a,o)=>a+o.subtotal, 0);
    const aj = ajustes[operarioId] || {};
    const salarioFijo  = +aj.salarioFijo  || 0;
    const incentivos   = +aj.incentivos   || 0;
    const descuentos   = +aj.descuentos   || 0;
    const total = subtotalOps + salarioFijo + incentivos - descuentos;
    return { ops, subtotalOps, salarioFijo, incentivos, descuentos, total };
  };

  const totalNomina = operarios.reduce((a,op)=>a+calcularOperario(op.id).total,0);

  const updAjuste = (opId, key, val) => {
    setAjustes(prev=>({...prev,[opId]:{...prev[opId],[key]:val}}));
  };

  const generarNomina = async () => {
    if (!periodo) { toast.error('Define el período'); return; }
    setSaving(true);
    try {
      const detalle = operarios.map(op=>{
        const calc = calcularOperario(op.id);
        return {
          operarioId:   op.id,
          operarioName: op.name,
          ...calc,
        };
      });
      await addDocument('nominasSatelite', {
        satId:    profile?.satId,
        satName:  profile?.name,
        periodo,
        fechaInicio,
        fechaFin,
        detalle,
        total:    totalNomina,
        status:   'generada',
      });
      toast.success('✅ Nómina generada');
      setTab('historial');
    } catch(e){ console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  const printNomina = (nomina) => {
    const rows = (nomina.detalle||[]).map(d=>`
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:8px;font-size:12px;font-weight:600">${d.operarioName}</td>
        <td style="padding:8px;text-align:right;font-size:12px">${fmtM(d.subtotalOps)}</td>
        <td style="padding:8px;text-align:right;font-size:12px">${d.salarioFijo>0?fmtM(d.salarioFijo):'—'}</td>
        <td style="padding:8px;text-align:right;font-size:12px;color:#15803d">${d.incentivos>0?'+'+fmtM(d.incentivos):'—'}</td>
        <td style="padding:8px;text-align:right;font-size:12px;color:#dc2626">${d.descuentos>0?'-'+fmtM(d.descuentos):'—'}</td>
        <td style="padding:8px;text-align:right;font-size:13px;font-weight:900;color:#14405A">${fmtM(d.total)}</td>
      </tr>`).join('');
    const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Nómina ${nomina.periodo}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif}@media print{body{print-color-adjust:exact}}</style>
    </head><body><div style="max-width:800px;margin:20px auto;padding:0 20px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #14405A">
        <div>
          <div style="font-size:18px;font-weight:900"><span style="color:#2878B4">Dotaciones </span><span style="color:#14405A">EL·ROHI</span></div>
          <div style="font-size:11px;color:#6b7280;margin-top:4px">Nómina Satélite</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;font-weight:700;color:#6b7280">LIQUIDACIÓN DE NÓMINA</div>
          <div style="font-size:14px;font-weight:900;color:#2878B4">${nomina.periodo}</div>
          <div style="font-size:11px;color:#6b7280">Satélite: ${nomina.satName}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead><tr style="background:#14405A;color:#fff">
          <th style="padding:8px;font-size:11px;text-align:left">Operario</th>
          <th style="padding:8px;font-size:11px;text-align:right">Operaciones</th>
          <th style="padding:8px;font-size:11px;text-align:right">S. Fijo</th>
          <th style="padding:8px;font-size:11px;text-align:right;color:#86efac">Incentivos</th>
          <th style="padding:8px;font-size:11px;text-align:right;color:#fca5a5">Descuentos</th>
          <th style="padding:8px;font-size:11px;text-align:right">TOTAL</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end">
        <div style="min-width:240px;border-top:2px solid #14405A;padding-top:12px">
          <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900">
            <span style="color:#14405A">TOTAL NÓMINA</span>
            <span style="color:#e85d26">${fmtM(nomina.total)}</span>
          </div>
        </div>
      </div>
    </div><script>window.onload=()=>window.print();</script></body></html>`;
    const win=window.open('','_blank'); win.document.write(html); win.document.close();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-sm font-bold text-gray-900">Nómina del Taller</h1>
          <p className="text-xs text-gray-400">{operarios.length} operarios</p>
        </div>
        <button onClick={()=>setShowConfig(true)}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600">
          ⚙️ Configurar períodos
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[['nueva','📋 Nueva nómina'],['historial','📁 Historial']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:tab===k?'#fff':'transparent',color:tab===k?'#111827':'#6b7280',
              fontWeight:tab===k?700:400,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {/* NUEVA NÓMINA */}
      {tab==='nueva' && (
        <div>
          {/* Período */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Período de liquidación</p>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre del período</label>
                <input value={periodo} onChange={e=>setPeriodo(e.target.value)}
                  placeholder="Ej: 1-15 Abril 2026"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha inicio</label>
                  <input type="date" value={fechaInicio} onChange={e=>setFechaInicio(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha fin</label>
                  <input type="date" value={fechaFin} onChange={e=>setFechaFin(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              {/* Períodos rápidos */}
              <div className="flex flex-wrap gap-2">
                {configPeriodos.map((p,i)=>{
                  const m = MESES[HOY.getMonth()];
                  const y = HOY.getFullYear();
                  const label = `${p.inicio}-${p.fin} ${m} ${y}`;
                  return (
                    <button key={i} onClick={()=>setPeriodo(label)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-orange-400 hover:text-orange-600">
                      {p.nombre}: {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Operarios */}
          {operarios.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center mb-4">
              <p className="text-2xl mb-2">👷</p>
              <p className="text-sm text-gray-500">Sin operarios registrados en este taller</p>
            </div>
          )}

          {operarios.map(op=>{
            const calc = calcularOperario(op.id);
            const aj   = ajustes[op.id]||{};
            return (
              <div key={op.id} className="bg-white rounded-xl border border-gray-100 p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{op.name}</p>
                    <p className="text-[10px] text-gray-400">{calc.ops.length} operaciones completadas</p>
                  </div>
                  <p className="text-lg font-black" style={{color:'#14405A'}}>{fmtM(calc.total)}</p>
                </div>

                {/* Detalle operaciones */}
                {calc.ops.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-3 mb-3">
                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Operaciones</p>
                    {calc.ops.map((o,i)=>(
                      <div key={i} className="flex justify-between text-xs text-gray-600 py-0.5">
                        <span>{o.lotCode} · {o.opName} × {o.qty?.toLocaleString('es-CO')}</span>
                        <span className="font-bold">{fmtM(o.subtotal)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-bold text-gray-800 pt-2 border-t border-gray-200 mt-1">
                      <span>Subtotal operaciones</span>
                      <span>{fmtM(calc.subtotalOps)}</span>
                    </div>
                  </div>
                )}

                {/* Ajustes */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Salario fijo</label>
                    <input type="number" min={0} value={aj.salarioFijo||''}
                      onChange={e=>updAjuste(op.id,'salarioFijo',e.target.value)}
                      placeholder="0"
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Incentivos +</label>
                    <input type="number" min={0} value={aj.incentivos||''}
                      onChange={e=>updAjuste(op.id,'incentivos',e.target.value)}
                      placeholder="0"
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-green-400" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Descuentos -</label>
                    <input type="number" min={0} value={aj.descuentos||''}
                      onChange={e=>updAjuste(op.id,'descuentos',e.target.value)}
                      placeholder="0"
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-red-400" />
                  </div>
                </div>

                {/* Observaciones */}
                <div className="mt-2">
                  <input value={aj.obs||''} onChange={e=>updAjuste(op.id,'obs',e.target.value)}
                    placeholder="Observaciones..."
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                </div>
              </div>
            );
          })}

          {/* Total */}
          {operarios.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-blue-800">TOTAL NÓMINA — {periodo}</span>
                <span className="text-2xl font-black" style={{color:'#e85d26'}}>{fmtM(totalNomina)}</span>
              </div>
            </div>
          )}

          <button onClick={generarNomina} disabled={saving||!periodo||operarios.length===0}
            className="w-full py-3 text-white text-sm font-bold rounded-xl disabled:opacity-50"
            style={{background:ACCENT}}>
            {saving?'Generando...':'📋 Generar y guardar nómina'}
          </button>
        </div>
      )}

      {/* HISTORIAL */}
      {tab==='historial' && (
        <div className="space-y-3">
          {nominas.filter(n=>n.satId===profile?.satId).length===0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-3xl mb-2">📋</p>
              <p className="font-medium text-gray-700">Sin nóminas generadas</p>
            </div>
          )}
          {nominas.filter(n=>n.satId===profile?.satId).map(n=>(
            <div key={n.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">{n.periodo}</p>
                  <p className="text-[10px] text-gray-400">{n.detalle?.length} operarios</p>
                  <p className="text-sm font-black mt-1" style={{color:'#14405A'}}>{fmtM(n.total)}</p>
                </div>
                <button onClick={()=>printNomina(n)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 flex-shrink-0">
                  🖨️ Imprimir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CONFIGURAR PERÍODOS */}
      {showConfig && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:440}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Configurar Períodos de Pago</h2>
              <button onClick={()=>setShowConfig(false)} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
            </div>
            <div className="space-y-3 mb-4">
              {configPeriodos.map((p,i)=>(
                <div key={i} className="bg-gray-50 rounded-xl p-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">Nombre</label>
                      <input value={p.nombre} onChange={e=>{const n=[...configPeriodos];n[i]={...n[i],nombre:e.target.value};setConfigPeriodos(n);}}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">Día inicio</label>
                      <input type="number" min={1} max={31} value={p.inicio} onChange={e=>{const n=[...configPeriodos];n[i]={...n[i],inicio:e.target.value};setConfigPeriodos(n);}}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-center focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">Día fin</label>
                      <input type="number" min={1} max={31} value={p.fin} onChange={e=>{const n=[...configPeriodos];n[i]={...n[i],fin:e.target.value};setConfigPeriodos(n);}}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-center focus:outline-none" />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={()=>setConfigPeriodos(p=>[...p,{nombre:'Nuevo período',inicio:'1',fin:'15'}])}
                className="text-xs text-blue-600 font-medium hover:underline">+ Agregar período</button>
            </div>
            <button onClick={()=>setShowConfig(false)}
              className="w-full py-2.5 text-white rounded-xl text-sm font-bold"
              style={{background:ACCENT}}>
              ✅ Guardar configuración
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
