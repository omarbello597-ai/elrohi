import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { addDocument } from '../services/db';
import { ACCENT } from '../constants';
import toast from 'react-hot-toast';

const downloadTemplate = (tipo) => {
  let csv, nombre;
  if (tipo === 'clientes') {
    csv   = 'RAZON_SOCIAL;NIT;DIRECCION;TELEFONO;CIUDAD;FORMA_PAGO;IMPUESTO\nEMPRESA SAS;900123456;Calle 10 # 5-20;3001234567;Bogotá;Contado;IVA';
    nombre = 'Plantilla_Clientes_ELROHI.csv';
  } else if (tipo === 'operarios') {
    csv   = 'NOMBRE;APELLIDO;CEDULA;TELEFONO;EMAIL;ROL;TIPO_SALARIO;SALARIO_FIJO\nJuan;Pérez;12345678;3001234567;jperez@elrohi.com;terminacion;fijo_mas_ops;1600000';
    nombre = 'Plantilla_Operarios_ELROHI.csv';
  } else if (tipo === 'operaciones') {
    csv   = 'NOMBRE_OPERACION;VALOR_UNITARIO\nPegar cremallera;8000\nPegar botones;4000\nDoblar;3000';
    nombre = 'Plantilla_Operaciones_ELROHI.csv';
  } else if (tipo === 'listas_precios') {
    csv   = '#;DESCRIPCIÓN PRODUCTO;TALLAS;PRECIO;TIPO\n1;Camisa Jean Economica 7oz;S-XL;20200;Camisas\n1;Camisa Jean Economica 7oz;2XL - 3XL;22200;Camisas\n2;Pantalon Dril 100% alg;28-38;45000;Pantalones';
    nombre = 'Plantilla_ListasPrecios_ELROHI.csv';
  }
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
};

const parseCSV = (text) => {
  // Remove BOM
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('Archivo vacío');
  // Detect separator: semicolon first, then tab, then comma
  const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, '').toUpperCase());
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
};

const parsePrecio = (raw) => {
  // Colombian format: 20.200 = twenty thousand two hundred
  const s = String(raw).trim()
    .replace(/\./g, '')    // remove dots (thousands separator)
    .replace(',', '.')     // comma to decimal if any
    .replace(/[^\d.]/g, '');
  return +s || 0;
};

const normFormaPago = (v) => String(v).toLowerCase().includes('cred') ? 'credito' : 'contado';
const normImpuesto  = (v) => {
  const s = String(v).toLowerCase();
  if (s.includes('mayor')) return 'remision_mayorista';
  if (s.includes('iva'))   return 'iva';
  return 'ninguno';
};
const normRol = (v) => {
  const s = String(v).toLowerCase();
  if (s.includes('termin')||s.includes('calidad')) return 'terminacion';
  if (s.includes('bodega'))  return 'bodega_op';
  if (s.includes('corte'))   return 'corte';
  if (s.includes('desp'))    return 'despachos';
  return 'terminacion';
};
const normSalario = (v) => {
  const s = String(v).toLowerCase();
  if (s.includes('fijo_mas')||s.includes('mixto')) return 'fijo_mas_ops';
  if (s.includes('fijo')) return 'solo_fijo';
  return 'solo_operaciones';
};

const fmtPrecio = (n) => '$' + (+n).toLocaleString('es-CO');

export default function CargaMasivaScreen() {
  const { profile } = useAuth();
  const [tab,       setTab]       = useState('clientes');
  const [preview,   setPreview]   = useState([]);
  const [errors,    setErrors]    = useState([]);
  const [saving,    setSaving]    = useState(false);
  const [resultado, setResultado] = useState(null);
  const [file,      setFile]      = useState(null);

  const handleFile = async (e, tipo) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f); setResultado(null); setErrors([]); setPreview([]);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target.result);
        if (!rows.length) { toast.error('Archivo vacío'); return; }
        let parsed = []; let errs = [];

        if (tipo === 'clientes') {
          parsed = rows.map((r, i) => {
            const nombre = (r['RAZON_SOCIAL']||r['RAZÓN SOCIAL']||r['NOMBRE']||'').trim();
            const nit    = (r['NIT']||'').trim();
            if (!nombre) errs.push(`Fila ${i+2}: falta Razón Social`);
            if (!nit)    errs.push(`Fila ${i+2}: falta NIT`);
            return {
              nombre, nit,
              direccion: (r['DIRECCION']||r['DIRECCIÓN']||'').trim(),
              telefono:  (r['TELEFONO']||'').trim(),
              ciudad:    (r['CIUDAD']||'').trim(),
              formaPago: normFormaPago(r['FORMA_PAGO']||r['CONDICION']||r['CONDICIÓN']||''),
              impuesto:  normImpuesto(r['IMPUESTO']||r['TIPO DOC']||''),
              active: true,
            };
          });
        } else if (tipo === 'operarios') {
          parsed = rows.map((r, i) => {
            const nombre = (r['NOMBRE']||'').trim();
            const ap     = (r['APELLIDO']||'').trim();
            if (!nombre) errs.push(`Fila ${i+2}: falta Nombre`);
            return {
              name: `${nombre} ${ap}`.trim(),
              cedula:      (r['CEDULA']||'').trim(),
              telefono:    (r['TELEFONO']||'').trim(),
              email:       (r['EMAIL']||'').toLowerCase().trim(),
              role:        normRol(r['ROL']||''),
              salarioTipo: normSalario(r['TIPO_SALARIO']||''),
              salarioFijo: parsePrecio(r['SALARIO_FIJO']||'0'),
              initials:    `${nombre.charAt(0)}${ap.charAt(0)}`.toUpperCase(),
              active: true, satId: null,
            };
          });
        } else if (tipo === 'operaciones') {
          parsed = rows.map((r, i) => {
            const nombre = (r['NOMBRE_OPERACION']||r['NOMBRE']||'').trim();
            const val    = parsePrecio(r['VALOR_UNITARIO']||r['VALOR']||'0');
            if (!nombre) errs.push(`Fila ${i+2}: falta nombre`);
            return { name: nombre, val, active: true };
          });
        } else if (tipo === 'listas_precios') {
          // Group by # (product number)
          const map = {};
          rows.forEach((r, i) => {
            const num   = (r['#']||'').trim();
            const desc  = (r['DESCRIPCIÓN PRODUCTO']||r['DESCRIPCION PRODUCTO']||r['DESCRIPCION']||'').trim();
            const talla = (r['TALLAS']||r['TALLA']||'').trim();
            const tipo2 = (r['TIPO']||'').trim();
            const precio = parsePrecio(r['PRECIO']||'0');
            if (!desc && !num) return;
            const key = num || desc.slice(0,20);
            if (!map[key]) map[key] = { num, descripcion: desc, tipo: tipo2, precios: [] };
            if (talla && precio > 0) map[key].precios.push({ talla, precio });
          });
          parsed = Object.values(map).filter(p => p.descripcion && p.precios.length > 0);
          if (!parsed.length) errs.push('No se encontraron productos válidos');
      } else if (tipo === 'tarifas_satelite') {
        parsed = rows.map((r, i) => {
          // headers are uppercased by parser so try both cases
          const desc = (r['DESCRIPCION'] || r['descripcion'] || r['DESCRIPCIÓN'] || '').trim().toUpperCase();
          if (!desc) { errs.push(`Fila ${i+2}: falta descripcion`); return null; }
          const conf = parsePrecio(r['CONFECCION'] || r['confeccion'] || '0');
          const term = parsePrecio(r['TERMINACION'] || r['terminacion'] || '0');
          const rem  = parsePrecio(r['REMATE']      || r['remate']      || '0');
          const tot  = parsePrecio(r['TOTAL']        || r['total']        || '0') || (conf + term + rem);
          return { descripcion: desc, confeccion: conf, terminacion: term, remate: rem, total: tot, active: true };
        }).filter(Boolean);
        if (!parsed.length) errs.push('No se encontraron tarifas válidas');
        }

        setErrors(errs);
        setPreview(parsed);
        if (!errs.length) toast.success(`✅ ${parsed.length} registros listos`);
        else toast.error(`${errs.length} errores — revisa el archivo`);
      } catch(err) {
        toast.error('Error al leer el archivo: ' + err.message);
      }
    };
    reader.readAsText(f, 'UTF-8');
  };

  const cargar = async (tipo) => {
    if (!preview.length)  { toast.error('Primero selecciona un archivo'); return; }
    if (errors.length)    { toast.error('Corrige los errores antes de cargar'); return; }
    setSaving(true);
    let ok = 0; let fail = 0;
    try {
      if (tipo === 'listas_precios') {
        const nombreLista = window.prompt('¿Nombre de esta lista de precios?\nEj: Lista Contado IVA');
        if (!nombreLista) { setSaving(false); return; }
        const descripcion = window.prompt('Descripción (opcional)\nEj: Clientes contado con IVA') || '';
        await addDocument('listasPrecios', { nombre: nombreLista, descripcion, productos: preview, active: true });
        ok = preview.length;
      } else {
        const col = tipo==='clientes'?'clients':tipo==='operarios'?'users':'operations';
        for (const item of preview) {
          try { await addDocument(col, item); ok++; } catch { fail++; }
        }
      }
      setResultado({ ok, fail, tipo });
      setPreview([]); setFile(null);
      toast.success(`✅ ${ok} registros cargados${fail>0?` · ${fail} fallaron`:''}`);
    } catch(e) { console.error(e); toast.error('Error al cargar'); }
    finally { setSaving(false); }
  };

  const TABS = [
    { key:'clientes',        label:'🏢 Clientes'        },
    { key:'operarios',       label:'👷 Operarios'       },
    { key:'operaciones',     label:'⚡ Operaciones'     },
    { key:'listas_precios',  label:'💰 Listas Precios'  },
    { key:'tarifas_satelite',label:'🏭 Tarifas Satélite'},
  ];

  const DESCS = {
    clientes:        'Columnas: RAZON_SOCIAL; NIT; DIRECCION; TELEFONO; CIUDAD; FORMA_PAGO; IMPUESTO',
    operarios:       'Columnas: NOMBRE; APELLIDO; CEDULA; TELEFONO; EMAIL; ROL; TIPO_SALARIO; SALARIO_FIJO',
    operaciones:     'Columnas: NOMBRE_OPERACION; VALOR_UNITARIO',
    listas_precios:  'Columnas: #; DESCRIPCIÓN PRODUCTO; TALLAS; PRECIO; TIPO — separador punto y coma (;)',
    tarifas_satelite:'Columnas: descripcion; confeccion; terminacion; remate; total',
  };

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-1">Carga Masiva</h1>
      <p className="text-xs text-gray-400 mb-4">Importa datos desde archivos CSV (separado por punto y coma)</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPreview([]); setErrors([]); setResultado(null); setFile(null); }}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:tab===t.key?'#fff':'transparent',color:tab===t.key?'#111827':'#6b7280',
              fontWeight:tab===t.key?700:400,boxShadow:tab===t.key?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Instrucciones */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
        <p className="text-xs font-bold text-blue-800 mb-1">📋 Formato requerido</p>
        <p className="text-[10px] text-blue-700 mb-2">{DESCS[tab]}</p>
        <button onClick={() => downloadTemplate(tab)}
          className="text-[10px] font-bold px-3 py-1.5 bg-blue-600 text-white rounded-lg">
          ⬇ Descargar plantilla CSV
        </button>
      </div>

      {/* Upload */}
      <div className="mb-4">
        <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-orange-400 transition-colors">
          {file ? (
            <div className="text-center">
              <p className="text-2xl mb-1">📊</p>
              <p className="text-sm font-bold text-gray-800">{file.name}</p>
              <p className="text-xs text-gray-500 mt-1">{preview.length} registros encontrados</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-3xl mb-2">📂</p>
              <p className="text-sm font-medium text-gray-600">Clic para seleccionar archivo CSV</p>
              <p className="text-xs text-gray-400 mt-1">Archivo .csv separado por punto y coma (;)</p>
            </div>
          )}
          <input type="file" accept=".csv,.txt" onChange={e => handleFile(e, tab)} className="hidden" />
        </label>
      </div>

      {/* Errores */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <p className="text-xs font-bold text-red-700 mb-1">⚠ {errors.length} errores:</p>
          {errors.map((e,i) => <p key={i} className="text-[10px] text-red-600">{e}</p>)}
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && !errors.length && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-gray-100" style={{background:'#1a3a6b'}}>
            <p className="text-[10px] font-bold text-white uppercase tracking-wider">
              Vista previa — {preview.length} registros
            </p>
          </div>
          <div className="overflow-x-auto max-h-72">
            {tab === 'listas_precios' ? (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    {['#','Descripción','Tipo','Tallas y Precios'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium border-b border-gray-100">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0,15).map((row, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-gray-500 text-center">{row.num}</td>
                      <td className="px-3 py-1.5 text-gray-800 max-w-xs" style={{maxWidth:300}}>
                        <p className="truncate text-[10px]">{row.descripcion}</p>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{row.tipo}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {row.precios.map((p, j) => (
                            <span key={j} className="text-[9px] bg-green-50 border border-green-200 text-green-700 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                              {p.talla}: {fmtPrecio(p.precio)}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    {Object.keys(preview[0]).filter(k=>!['active','satId','initials'].includes(k)).map(k => (
                      <th key={k} className="px-3 py-2 text-left text-gray-500 font-medium border-b border-gray-100 whitespace-nowrap">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0,10).map((row, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      {Object.entries(row).filter(([k])=>!['active','satId','initials'].includes(k)).map(([k,v]) => (
                        <td key={k} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {preview.length > 15 && (
            <p className="text-[10px] text-gray-400 text-center py-2">... y {preview.length-15} más</p>
          )}
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-black text-green-700">✅ Carga completada</p>
          <p className="text-xs text-green-600 mt-1">
            {resultado.ok} registros cargados{resultado.fail>0?` · ${resultado.fail} fallaron`:''}
          </p>
        </div>
      )}

      {/* Botón cargar */}
      {preview.length > 0 && !errors.length && (
        <button onClick={() => cargar(tab)} disabled={saving}
          className="w-full py-3 text-white text-sm font-bold rounded-xl disabled:opacity-50"
          style={{background:ACCENT}}>
          {saving ? 'Cargando...' : `📤 Cargar ${preview.length} registros a ELROHI`}
        </button>
      )}
    </div>
  );
}
