import { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { gLabel, fmtN } from '../utils';
import { GARMENT_TYPES } from '../constants';

const SIZES_REF = ['XS/6','S/8','M/10','L/12','XL/14','XXL/16','28','30','32','34','36','38','40','42','44'];
const SIZES_INS = ['8','10','12','15','17','20'];

// ─── GENERADOR DE REMISIÓN EN VENTANA DE IMPRESIÓN ───────────────────────────
export function printRemision(lot, satName, remNum, insumos, comentariosRef, comentariosIns, otrosCols) {
  const garmentRows = (lot.garments || []).map((g, i) => {
    const sizes = SIZES_REF.map(s => {
      const key = s.split('/')[0];
      const val = g.sizes?.[key] || g.sizes?.[s] || '';
      return `<td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px">${val || ''}</td>`;
    }).join('');
    const total = g.total || 0;
    const comentario = comentariosRef?.[i] || '';
    return `<tr>
      <td style="border:1px solid #1a3a6b;padding:3px 6px;font-size:10px;font-weight:500;color:#1a3a6b">${gLabel(g.gtId)}</td>
      ${sizes}
      <td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px;font-weight:700;background:#dce6f5;color:#1a3a6b">${total.toLocaleString('es-CO')}</td>
      <td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px;font-weight:700;background:#fff0e0;color:#e85d26"></td>
      <td style="border:1px solid #1a3a6b;padding:3px 4px;font-size:9px;color:#4a3a6b;font-style:italic;background:#fdfbff">${comentario}</td>
    </tr>`;
  }).join('');

  // Filas vacías referencias
  const emptyRefRows = Array(Math.max(0, 5 - (lot.garments||[]).length)).fill(0).map(() => `
    <tr>
      <td style="border:1px solid #1a3a6b;padding:3px 6px;font-size:10px;height:22px">&nbsp;</td>
      ${SIZES_REF.map(() => `<td style="border:1px solid #1a3a6b;padding:3px 2px"></td>`).join('')}
      <td style="border:1px solid #1a3a6b;background:#dce6f5"></td>
      <td style="border:1px solid #1a3a6b;background:#fff0e0"></td>
      <td style="border:1px solid #1a3a6b;background:#fdfbff"></td>
    </tr>`).join('');

  // Filas insumos
  const insRows = (insumos || [{},{},{},{}]).map((ins, i) => {
    const sizesCells = SIZES_INS.map(s => `<td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px">${ins[s]||''}</td>`).join('');
    const otro1Col = otrosCols?.[0]?.name || '';
    const otro2Col = otrosCols?.[1]?.name || '';
    return `<tr>
      <td style="border:1px solid #1a3a6b;padding:3px 6px;font-size:10px;font-weight:500;color:#1a3a6b;height:22px">${ins.nombre||''}</td>
      ${sizesCells}
      <td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px">${ins.marquilla||''}</td>
      <td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px">${ins.boton||''}</td>
      <td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px">${ins.garras||''}</td>
      <td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px;background:#faf8f5">${ins.otro1||''}</td>
      <td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px;background:#faf8f5">${ins.otro2||''}</td>
      <td style="border:1px solid #1a3a6b;padding:3px 4px;font-size:9px;color:#4a3a6b;font-style:italic;background:#fdfbff">${comentariosIns?.[i]||''}</td>
    </tr>`;
  }).join('');

  const hoy = new Date();
  const dd = String(hoy.getDate()).padStart(2,'0');
  const mm = String(hoy.getMonth()+1).padStart(2,'0');
  const yy = String(hoy.getFullYear()).slice(-2);

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>Remisión ${remNum} — ${satName}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;background:#fff;color:#111;font-size:11px}
    @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    table{border-collapse:collapse}
  </style></head><body>
  <div style="max-width:960px;margin:10px auto;border:1.5px solid #1a3a6b">

    <!-- HEADER -->
    <div style="border-bottom:2px solid #1a3a6b;padding:8px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div style="width:72px;height:56px;border:1.5px dashed #9ca3af;border-radius:4px;display:flex;align-items:center;justify-content:center;background:#f9f9f7">
        <span style="font-size:8px;color:#9ca3af;text-align:center;line-height:1.3">Logo<br>cliente</span>
      </div>
      <div style="text-align:center;flex:1">
        <div style="font-size:17px;font-weight:900;color:#1a3a6b">Dotaciones <span style="color:#e85d26">EL ROHI</span></div>
        <div style="font-size:9px;color:#1a3a6b;font-weight:500">NIT. 901.080.234-7</div>
        <div style="font-size:9px;color:#1a3a6b;font-weight:500">Calle 39 A Sur No. 5-63 Este La Victoria &nbsp;·&nbsp; Cel.: 313 372 5739</div>
      </div>
      <div style="border:2px solid #1a3a6b;padding:4px 10px;text-align:center">
        <div style="font-size:9px;font-weight:700;color:#1a3a6b;letter-spacing:0.1em">REMISIÓN</div>
        <div style="font-size:20px;font-weight:900;color:#e85d26;font-family:monospace">${remNum}</div>
      </div>
    </div>

    <!-- META -->
    <div style="display:flex;border-bottom:1px solid #1a3a6b">
      <div style="border-right:1px solid #1a3a6b;padding:4px 10px;display:flex;align-items:center;gap:6px">
        <span style="font-size:8px;font-weight:700;color:#1a3a6b;letter-spacing:0.08em;text-transform:uppercase">Fecha</span>
        <span style="font-size:12px;font-weight:700;color:#1a3a6b;font-family:monospace">${dd}/${mm}/${yy}</span>
      </div>
      <div style="flex:1;padding:6px 14px;display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;font-weight:700;color:#1a3a6b;white-space:nowrap">Satélite:</span>
        <span style="font-size:14px;font-weight:700;color:#1a3a6b;border-bottom:1.5px solid #1a3a6b;padding-bottom:1px;flex:1">${satName}</span>
      </div>
      <div style="padding:6px 14px;display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;font-weight:700;color:#1a3a6b;white-space:nowrap">Lote:</span>
        <span style="font-size:11px;font-weight:700;color:#e85d26;font-family:monospace">${lot.code}</span>
      </div>
    </div>

    <!-- REFERENCIAS -->
    <div style="background:#1a3a6b;color:#fff;font-size:9px;font-weight:700;letter-spacing:0.12em;padding:3px 8px;text-transform:uppercase">Referencias — Prendas</div>
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <thead>
        <tr>
          <th style="width:100px;border:1px solid #1a3a6b;padding:3px 6px;background:#e8eef7;font-size:9px;font-weight:700;color:#1a3a6b;text-align:left">Referencia</th>
          ${SIZES_REF.map(s=>`<th style="width:${s.includes('/')?'32':'28'}px;border:1px solid #1a3a6b;padding:3px 2px;background:#e8eef7;font-size:9px;font-weight:700;color:#1a3a6b;text-align:center">${s}</th>`).join('')}
          <th style="width:46px;border:1px solid #1a3a6b;padding:3px 2px;background:#dce6f5;font-size:9px;font-weight:700;color:#1a3a6b;text-align:center">TOTAL</th>
          <th style="width:44px;border:1px solid #1a3a6b;padding:3px 2px;background:#fff0e0;font-size:9px;font-weight:700;color:#e85d26;text-align:center"># CORTE</th>
          <th style="width:90px;border:1px solid #1a3a6b;padding:3px 2px;background:#f5f0fa;font-size:8px;font-weight:700;color:#4a3a6b;text-align:center;font-style:italic">Comentarios</th>
        </tr>
      </thead>
      <tbody>${garmentRows}${emptyRefRows}</tbody>
    </table>
    </div>

    <!-- INSUMOS -->
    <div style="background:#1a3a6b;color:#fff;font-size:9px;font-weight:700;letter-spacing:0.12em;padding:3px 8px;text-transform:uppercase">Insumos entregados</div>
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <thead>
        <tr>
          <th style="width:100px;border:1px solid #1a3a6b;padding:3px 6px;background:#e8eef7;font-size:9px;font-weight:700;color:#1a3a6b;text-align:left">Insumo</th>
          ${SIZES_INS.map(s=>`<th style="width:36px;border:1px solid #1a3a6b;padding:3px 2px;background:#e8eef7;font-size:9px;font-weight:700;color:#1a3a6b;text-align:center">${s}</th>`).join('')}
          <th style="width:66px;border:1px solid #1a3a6b;padding:3px 2px;background:#e8eef7;font-size:9px;font-weight:700;color:#1a3a6b;text-align:center">Marquilla</th>
          <th style="width:56px;border:1px solid #1a3a6b;padding:3px 2px;background:#e8eef7;font-size:9px;font-weight:700;color:#1a3a6b;text-align:center">Botón</th>
          <th style="width:56px;border:1px solid #1a3a6b;padding:3px 2px;background:#e8eef7;font-size:9px;font-weight:700;color:#1a3a6b;text-align:center">Garras</th>
          <th style="width:66px;border:1px solid #1a3a6b;padding:3px 2px;background:#f0ede8;font-size:8px;font-weight:700;color:#6b5c45;text-align:center">${otrosCols?.[0]?.name||'Otro 1'}</th>
          <th style="width:66px;border:1px solid #1a3a6b;padding:3px 2px;background:#f0ede8;font-size:8px;font-weight:700;color:#6b5c45;text-align:center">${otrosCols?.[1]?.name||'Otro 2'}</th>
          <th style="width:90px;border:1px solid #1a3a6b;padding:3px 2px;background:#f5f0fa;font-size:8px;font-weight:700;color:#4a3a6b;text-align:center;font-style:italic">Comentarios</th>
        </tr>
      </thead>
      <tbody>${insRows}</tbody>
    </table>
    </div>

    <!-- NOTA -->
    <div style="border-top:1px solid #1a3a6b;padding:7px 12px;display:flex;align-items:center;gap:6px">
      <span style="font-size:10px;font-weight:700;color:#1a3a6b;white-space:nowrap">NOTA: Se entregan insumos a:</span>
      <span style="flex:1;border-bottom:1px solid #1a3a6b;min-height:18px;display:inline-block"></span>
    </div>

    <!-- FIRMAS -->
    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #1a3a6b">
      <div style="padding:6px 14px;text-align:center;border-right:1px solid #1a3a6b">
        <div style="height:32px"></div>
        <div style="border-top:1px solid #1a3a6b;margin:0 16px 4px"></div>
        <div style="font-size:9px;font-weight:700;color:#1a3a6b;letter-spacing:0.1em">Aceptada</div>
      </div>
      <div style="padding:6px 14px;text-align:center">
        <div style="height:32px"></div>
        <div style="border-top:1px solid #1a3a6b;margin:0 16px 4px"></div>
        <div style="font-size:9px;font-weight:700;color:#1a3a6b;letter-spacing:0.1em">Entregada</div>
      </div>
    </div>
  </div>
  <script>window.onload=()=>window.print();</script>
  </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}

// ─── PANTALLA REMISIÓN ────────────────────────────────────────────────────────
export function RemisionScreen() {
  const { lots, satellites, clients } = useData();
  const [selLotId, setSelLotId] = useState('');
  const [insumos,  setInsumos]  = useState(Array(4).fill(null).map(() => ({nombre:'',8:'',10:'',12:'',15:'',17:'',20:'',marquilla:'',boton:'',garras:'',otro1:'',otro2:''})));
  const [comentRef, setComentRef] = useState(Array(5).fill(''));
  const [comentIns, setComentIns] = useState(Array(4).fill(''));
  const [otrosCols, setOtrosCols] = useState([{name:'Otro 1'},{name:'Otro 2'}]);
  const [remNum, setRemNum]     = useState('0042');

  const assignedLots = lots.filter(l => ['asignacion','costura','corte'].includes(l.status));
  const selLot = lots.find(l => l.id === selLotId);
  const satName = satellites.find(s => s.id === selLot?.satId)?.name || '_______________';

  const updIns = (i, field, val) => {
    const next = [...insumos];
    next[i] = { ...next[i], [field]: val };
    setInsumos(next);
  };

  const handlePrint = () => {
    if (!selLot) { alert('Selecciona un lote primero'); return; }
    printRemision(selLot, satName, remNum.padStart(4,'0'), insumos, comentRef, comentIns, otrosCols);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold text-gray-900">Remisión de Corte a Satélite</h1>
        <button onClick={handlePrint}
          className="px-4 py-2 text-white rounded-lg text-xs font-bold hover:opacity-90"
          style={{ background: '#1a3a6b' }}>
          🖨️ Generar e Imprimir
        </button>
      </div>

      {/* Selector de lote */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Lote</label>
            <select value={selLotId} onChange={e => setSelLotId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white">
              <option value="">— Seleccionar lote —</option>
              {assignedLots.map(l => (
                <option key={l.id} value={l.id}>{l.code} · {clients.find(c=>c.id===l.clientId)?.name||''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Satélite receptor</label>
            <input type="text" readOnly value={satName}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 font-semibold text-blue-800" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Número de remisión</label>
            <input type="text" value={remNum} onChange={e => setRemNum(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-orange-600 focus:outline-none focus:border-orange-400" />
          </div>
        </div>
      </div>

      {selLot && (
        <>
          {/* Prendas del lote — solo lectura + comentarios */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Referencias del lote</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs" style={{ tableLayout:'fixed' }}>
                <thead>
                  <tr style={{ background:'#e8eef7' }}>
                    <th className="border border-blue-200 px-2 py-1.5 text-left text-[10px] text-blue-800 font-bold" style={{width:'120px'}}>Referencia</th>
                    {SIZES_REF.map(s => <th key={s} className="border border-blue-200 px-1 py-1.5 text-[9px] text-blue-700 font-bold" style={{width:'32px'}}>{s}</th>)}
                    <th className="border border-blue-200 px-1 py-1.5 text-[9px] text-blue-800 font-bold" style={{background:'#dce6f5',width:'46px'}}>TOTAL</th>
                    <th className="border border-blue-200 px-1 py-1.5 text-[9px] font-bold" style={{background:'#fff0e0',color:'#e85d26',width:'50px'}}># CORTE</th>
                    <th className="border border-blue-200 px-1 py-1.5 text-[9px] font-bold italic" style={{background:'#f5f0fa',color:'#4a3a6b',width:'100px'}}>Comentarios</th>
                  </tr>
                </thead>
                <tbody>
                  {selLot.garments.map((g, i) => (
                    <tr key={i}>
                      <td className="border border-blue-100 px-2 py-1 font-medium text-blue-900">{gLabel(g.gtId)}</td>
                      {SIZES_REF.map(s => {
                        const key = s.split('/')[0];
                        const val = g.sizes?.[key] || g.sizes?.[s] || '';
                        return <td key={s} className="border border-blue-100 px-1 py-1 text-center font-semibold" style={{color: val ? '#1a3a6b':'#d1d5db'}}>{val||'—'}</td>;
                      })}
                      <td className="border border-blue-100 px-1 py-1 text-center font-bold text-blue-800" style={{background:'#f0f4f8'}}>{g.total?.toLocaleString('es-CO')}</td>
                      <td className="border border-blue-100 px-1 py-1 text-center" style={{background:'#fff8f0'}}>
                        <input type="text" placeholder="590" className="w-full text-center text-xs font-bold outline-none bg-transparent" style={{color:'#e85d26'}} />
                      </td>
                      <td className="border border-blue-100 px-1 py-1" style={{background:'#fdfbff'}}>
                        <input type="text" placeholder="Observación..." value={comentRef[i]||''} onChange={e=>{const n=[...comentRef];n[i]=e.target.value;setComentRef(n);}}
                          className="w-full text-xs italic outline-none bg-transparent" style={{color:'#4a3a6b'}} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Insumos — editable */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Insumos entregados</p>
              <div className="flex gap-2">
                <input type="text" value={otrosCols[0].name} onChange={e=>setOtrosCols([{name:e.target.value},otrosCols[1]])}
                  className="border border-amber-200 rounded px-2 py-0.5 text-xs font-medium text-amber-700 w-20 focus:outline-none" placeholder="Otro 1" />
                <input type="text" value={otrosCols[1].name} onChange={e=>setOtrosCols([otrosCols[0],{name:e.target.value}])}
                  className="border border-amber-200 rounded px-2 py-0.5 text-xs font-medium text-amber-700 w-20 focus:outline-none" placeholder="Otro 2" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs" style={{tableLayout:'fixed'}}>
                <thead>
                  <tr style={{background:'#e8eef7'}}>
                    <th className="border border-blue-200 px-2 py-1.5 text-left text-[10px] text-blue-800 font-bold" style={{width:'110px'}}>Insumo</th>
                    {SIZES_INS.map(s=><th key={s} className="border border-blue-200 px-1 py-1.5 text-[9px] text-blue-700 font-bold" style={{width:'36px'}}>{s}</th>)}
                    <th className="border border-blue-200 px-1 py-1.5 text-[9px] text-blue-700 font-bold" style={{width:'64px'}}>Marquilla</th>
                    <th className="border border-blue-200 px-1 py-1.5 text-[9px] text-blue-700 font-bold" style={{width:'54px'}}>Botón</th>
                    <th className="border border-blue-200 px-1 py-1.5 text-[9px] text-blue-700 font-bold" style={{width:'54px'}}>Garras</th>
                    <th className="border border-blue-200 px-1 py-1.5 text-[9px] font-bold" style={{background:'#f0ede8',color:'#6b5c45',width:'64px'}}>{otrosCols[0].name}</th>
                    <th className="border border-blue-200 px-1 py-1.5 text-[9px] font-bold" style={{background:'#f0ede8',color:'#6b5c45',width:'64px'}}>{otrosCols[1].name}</th>
                    <th className="border border-blue-200 px-1 py-1.5 text-[9px] font-bold italic" style={{background:'#f5f0fa',color:'#4a3a6b',width:'90px'}}>Comentarios</th>
                  </tr>
                </thead>
                <tbody>
                  {insumos.map((ins,i)=>(
                    <tr key={i}>
                      <td className="border border-blue-100 px-1 py-1">
                        <input type="text" value={ins.nombre} onChange={e=>updIns(i,'nombre',e.target.value)} placeholder={`Insumo ${i+1}`}
                          className="w-full text-xs font-medium outline-none bg-transparent" style={{color:'#1a3a6b'}} />
                      </td>
                      {SIZES_INS.map(s=>(
                        <td key={s} className="border border-blue-100 px-1 py-1">
                          <input type="text" value={ins[s]} onChange={e=>updIns(i,s,e.target.value)}
                            className="w-full text-center text-xs font-semibold outline-none bg-transparent" style={{color:'#1a3a6b'}} />
                        </td>
                      ))}
                      {['marquilla','boton','garras'].map(f=>(
                        <td key={f} className="border border-blue-100 px-1 py-1">
                          <input type="text" value={ins[f]} onChange={e=>updIns(i,f,e.target.value)}
                            className="w-full text-center text-xs font-semibold outline-none bg-transparent" style={{color:'#1a3a6b'}} />
                        </td>
                      ))}
                      {['otro1','otro2'].map(f=>(
                        <td key={f} className="border border-blue-100 px-1 py-1" style={{background:'#faf8f5'}}>
                          <input type="text" value={ins[f]} onChange={e=>updIns(i,f,e.target.value)}
                            className="w-full text-center text-xs outline-none bg-transparent" style={{color:'#6b5c45'}} />
                        </td>
                      ))}
                      <td className="border border-blue-100 px-1 py-1" style={{background:'#fdfbff'}}>
                        <input type="text" placeholder="Observación..." value={comentIns[i]||''} onChange={e=>{const n=[...comentIns];n[i]=e.target.value;setComentIns(n);}}
                          className="w-full text-xs italic outline-none bg-transparent" style={{color:'#4a3a6b'}} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!selLot && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-gray-100">
          <p className="text-4xl mb-3">📄</p>
          <p className="font-medium text-gray-700">Selecciona un lote arriba</p>
          <p className="text-sm text-gray-400 mt-1">La remisión se llenará automáticamente con los datos del lote</p>
        </div>
      )}
    </div>
  );
}
