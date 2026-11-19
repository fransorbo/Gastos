/**
 * API de la app. Todas las peticiones son POST con Content-Type text/plain y
 * un JSON en el body: { token, action, ...datos }.
 *
 * Acciones:
 *   bootstrap  → configuración (categorías, formas de pago, reparto, % ingresos)
 *   sync       → { items: [movimiento, ...] } crea/edita/borra (idempotente por id)
 *   list       → últimos movimientos
 *   resumen    → { mes: 'AAAA-MM', usuario: 'Fran'|'Cami' }
 *   fijos      → lista de la tab Fijos
 *   fijoToggle → { fila, activo }
 */

function doGet() {
  return json_({ ok: true, msg: 'Backend de gastos funcionando. Usa la app para cargar datos.' });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'JSON inválido' });
  }
  if (!tokenValido_(req.token)) return json_({ ok: false, error: 'Token incorrecto' });

  try {
    switch (req.action) {
      case 'bootstrap': return json_({ ok: true, data: bootstrap_() });
      case 'sync': return json_({ ok: true, data: sincronizar(req.items || []) });
      case 'list': return json_({ ok: true, data: listarMovimientos_(req.limite || 50) });
      case 'resumen': return json_({ ok: true, data: resumenMes_(req.mes, req.usuario) });
      case 'fijos': return json_({ ok: true, data: listarFijos_() });
      case 'fijoToggle': return json_({ ok: true, data: toggleFijo_(req.fila, req.activo) });
      default: return json_({ ok: false, error: 'Acción desconocida: ' + req.action });
    }
  } catch (err) {
    console.error(err && err.stack || err);
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function tokenValido_(token) {
  const real = PropertiesService.getScriptProperties().getProperty('APP_TOKEN');
  return !!real && typeof token === 'string' && token === real;
}

/* ================================ Acceso a sheets ================================ */

const _cache = {};

function ssCompartido_() {
  return _cache.ssC || (_cache.ssC = SpreadsheetApp.openById(SHEET_COMPARTIDO_ID));
}
function ssFran_() {
  return _cache.ssF || (_cache.ssF = SpreadsheetApp.openById(SHEET_FRAN_ID));
}
function hoja_(nombre) {
  const ss = nombre === TAB.FRAN ? ssFran_() : ssCompartido_();
  const sh = ss.getSheetByName(nombre);
  if (!sh) throw new Error('No existe la tab "' + nombre + '". ¿Ejecutaste setup()?');
  return sh;
}

function fmtFecha_(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}
function fmtFechaHora_(d) {
  if (!d) return '';
  if (typeof d === 'string') return d;
  return Utilities.formatDate(d, TZ, "yyyy-MM-dd'T'HH:mm:ss");
}
function parseFecha_(s) {
  // 'AAAA-MM-DD' → Date a mediodía (evita saltos por zona horaria)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (!m) throw new Error('Fecha inválida: ' + s);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}
function num_(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined || v === '') return 0;
  let s = String(v).replace(/[€$\s]/g, '');
  if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+%?$/.test(s)) s = s.replace(/\./g, ''); // 1.055 → 1055
  else s = s.replace(',', '.');
  const pct = s.endsWith('%');
  const n = parseFloat(s.replace('%', ''));
  if (isNaN(n)) return 0;
  return pct ? n / 100 : n;
}

/* ================================ Config ================================ */

function leerConfig_() {
  if (_cache.config) return _cache.config;
  const values = hoja_(TAB.CONFIG).getDataRange().getValues();
  const head = values[0].map(h => String(h).trim());
  const col = name => head.indexOf(name);
  const bloque = (start, n) => {
    const out = [];
    if (start < 0) return out;
    for (let r = 1; r < values.length; r++) {
      const fila = values[r].slice(start, start + n);
      if (String(fila[0]).trim() === '') continue;
      out.push(fila);
    }
    return out;
  };

  const categorias = bloque(col('categoria_app'), 8).map(f => ({
    categoria_app: String(f[0]).trim(),
    categoria_excel: String(f[1]).trim(),
    subcategoria_excel: String(f[2]).trim(),
    fijo_o_variable: String(f[3]).trim() || 'Variable',
    orden: num_(f[4]),
    icono: String(f[5]).trim(),
    mostrar: String(f[6]).trim() || 'chip',
    padre: String(f[7]).trim(),
  })).sort((a, b) => a.orden - b.orden);

  const formasPago = bloque(col('forma_pago'), 2)
    .map(f => ({ nombre: String(f[0]).trim(), orden: num_(f[1]) }))
    .sort((a, b) => a.orden - b.orden).map(f => f.nombre);

  const reparto = {};
  bloque(col('reparto_categoria'), 3).forEach(f => {
    reparto[String(f[0]).trim()] = { fran: num_(f[1]), cami: num_(f[2]) };
  });

  const parametros = {};
  bloque(col('clave'), 2).forEach(f => { parametros[String(f[0]).trim()] = f[1]; });

  _cache.config = { categorias, formasPago, reparto, parametros };
  return _cache.config;
}

function categoriaPorNombre_(nombre) {
  return leerConfig_().categorias.find(c => c.categoria_app === nombre) || null;
}

/* ============================ % de ingresos por mes ============================ */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Lee la tab Ingresos y devuelve { 'AAAA-MM': { fran: 0.6, cami: 0.4 } } solo para
 * meses completos (los dos con % > 0).
 */
function leerPctIngresos_() {
  if (_cache.pct) return _cache.pct;
  const v = hoja_(TAB.INGRESOS).getDataRange().getValues();
  const out = {};

  // Fila del título "PORCENTAJE..."
  let rTitulo = -1;
  for (let r = 0; r < v.length && rTitulo < 0; r++) {
    if (v[r].some(c => /PORCENTAJE/i.test(String(c)))) rTitulo = r;
  }
  if (rTitulo < 0) { _cache.pct = out; return out; }
  const rMeses = rTitulo + 1;
  let rCami = -1, rFran = -1;
  for (let r = rMeses + 1; r < Math.min(v.length, rMeses + 6); r++) {
    const a = String(v[r][0]).trim().toUpperCase();
    if (a === 'CAMI' && rCami < 0) rCami = r;
    if (a === 'FRAN' && rFran < 0) rFran = r;
  }
  if (rCami < 0 || rFran < 0) { _cache.pct = out; return out; }

  // Años: primera fila, rellenando hacia la derecha
  let anio = null;
  for (let c = 1; c < v[0].length; c++) {
    const y = parseInt(String(v[0][c]).trim(), 10);
    if (y > 2000 && y < 2100) anio = y;
    const nombreMes = String(v[rMeses][c]).trim().toLowerCase().replace(/\s*\d+$/, '');
    const m = MESES.indexOf(nombreMes);
    if (!anio || m < 0) continue;
    const fran = num_(v[rFran][c]);
    const cami = num_(v[rCami][c]);
    // Un mes solo cuenta si los DOS tienen ingresos: desde nov-26 la matriz se rellena sola
    // desde Movimientos, y a principio de mes puede estar cargado solo un sueldo (daría 100/0).
    if (!(fran > 0 && cami > 0)) continue;
    const key = anio + '-' + String(m + 1).padStart(2, '0');
    out[key] = { fran: Math.round(fran * 1000) / 1000, cami: Math.round(cami * 1000) / 1000 };
  }
  _cache.pct = out;
  return out;
}

/** Reparto para un gasto compartido: excepción por categoría o % de ingresos del mes. */
function repartoPara_(categoriaApp, fechaStr) {
  const cfg = leerConfig_();
  if (cfg.reparto[categoriaApp]) return cfg.reparto[categoriaApp];
  const pct = leerPctIngresos_();
  const key = String(fechaStr).slice(0, 7);
  if (pct[key]) return pct[key];
  const keys = Object.keys(pct).sort();
  const previas = keys.filter(k => k <= key);
  const usar = previas.length ? previas[previas.length - 1] : keys[keys.length - 1];
  if (usar) return pct[usar];
  const f = num_(cfg.parametros.reparto_defecto_fran) || 0.6;
  return { fran: f, cami: Math.round((1 - f) * 1000) / 1000 };
}

/* ================================ Bootstrap ================================ */

function bootstrap_() {
  const cfg = leerConfig_();
  const tipos = String(cfg.parametros.tipos_ingreso || 'Sueldo,Paro,Extra-freelance,Reembolso-devolución')
    .split(',').map(s => s.trim()).filter(Boolean);
  return {
    categorias: cfg.categorias,
    formasPago: cfg.formasPago,
    reparto: cfg.reparto,
    pctIngresos: leerPctIngresos_(),
    tiposIngreso: tipos,
    servidor: fmtFechaHora_(new Date()),
  };
}
