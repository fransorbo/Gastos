// ============================================================================
// Gastos Fran & Cami — backend completo en UN archivo (generado por tests/combinar.sh).
// Pega TODO esto en el editor de Apps Script. El código fuente está en /apps-script.
// ============================================================================

// ----------------------------- Config.gs -----------------------------

/**
 * Constantes del proyecto. Los IDs de los sheets NO son secretos (solo quien
 * tiene permiso puede abrirlos). El token secreto vive en Script Properties.
 */

const SHEET_COMPARTIDO_ID = '19P7CPBqHj_VhZXUBFJDswVSKfDmyxgukBUW3JsHHYyQ';
const SHEET_FRAN_ID = '1LwdI9gft-wjjTgaa8xShdnbhHB3_w_Q7ZEGH2BCOtCs';

const TAB = {
  AMBOS: 'Detalle Ambos',
  CAMILA: 'Detalle Camila',
  FRAN: 'Gastos Fran',           // en Cuentas Esp
  MOVIMIENTOS: 'Movimientos',
  CONFIG: 'Config',
  FIJOS: 'Fijos',
  PPTO: 'PPTO',
  INGRESOS: 'Ingresos',
};

// Tabs donde se copian los gastos (definida aquí para no depender del orden de carga de archivos).
const TABS_DESTINO = [TAB.AMBOS, TAB.CAMILA, TAB.FRAN];

const MOV_COLS = [
  'id', 'creado_en', 'cargado_por', 'tipo', 'fecha', 'importe_eur',
  'categoria_app', 'categoria_excel', 'subcategoria_excel', 'detalle',
  'forma_pago', 'personal_o_compartido', 'pagado_por', 'pct_fran', 'pct_cami',
  'fijo_o_variable', 'tipo_ingreso', 'destino', 'estado', 'editado_en',
];

const FIJOS_COLS = [
  'activo', 'descripcion', 'importe', 'categoria_app', 'personal_o_compartido',
  'pagado_por', 'forma_pago', 'dia_del_mes',
];

const DETALLE_HEADERS = ['Categoria Principal', 'Subcategoría', 'Detalle', 'Periodo', 'Valor', 'AÑO', 'MES'];
const ID_APP_HEADER = 'id_app';
const TZ = 'Europe/Madrid';

/* ---------- Datos iniciales de la tab Config (solo se usan en setup) ---------- */

// categoria_app, categoria_excel, subcategoria_excel, fijo_o_variable, orden, icono, mostrar, padre
// mostrar = 'grupo' → botón de categoría principal (categoria_app es su nombre corto en la app)
// mostrar = 'sub'   → subcategoría; 'padre' es el nombre corto de su grupo. categoria_app = lo que se guarda.
// mostrar = 'oculta'→ existe pero no se muestra.
const CONFIG_CATEGORIAS_INICIALES = [
  ['Vivienda', 'Vivienda_y_Servicios', '', '', 1, '🏠', 'grupo', ''],
  ['Alimentación', 'Alimentación', '', '', 2, '🛒', 'grupo', ''],
  ['Transporte', 'Transporte', '', '', 3, '🚇', 'grupo', ''],
  ['Cuidado personal', 'Cuidado_Personal_y_Bienestar', '', '', 4, '🧴', 'grupo', ''],
  ['Educación', 'Educación', '', '', 5, '📚', 'grupo', ''],
  ['Ocio', 'Ocio_y_Entretenimiento', '', '', 6, '🍻', 'grupo', ''],
  ['Viajes y otros', 'Viajes_Eventos_Otros', '', '', 7, '✈️', 'grupo', ''],

  ['Alquiler', 'Vivienda_y_Servicios', 'Alquiler', 'Fijo', 11, '🏠', 'sub', 'Vivienda'],
  ['Servicios', 'Vivienda_y_Servicios', 'Servicios', 'Variable', 12, '💡', 'sub', 'Vivienda'],
  ['Internet y Movil', 'Vivienda_y_Servicios', 'Internet y Movil', 'Fijo', 13, '📱', 'sub', 'Vivienda'],
  ['Suscripciones', 'Vivienda_y_Servicios', 'Suscripciones', 'Fijo', 14, '📺', 'sub', 'Vivienda'],
  ['Impuestos', 'Vivienda_y_Servicios', 'Impuestos', 'Variable', 15, '🧾', 'sub', 'Vivienda'],
  ['Hogar compras y mantenimiento', 'Vivienda_y_Servicios', 'Hogar compras y mantenimiento', 'Variable', 16, '🛋️', 'sub', 'Vivienda'],
  ['Muebles IKEA cuotas', 'Vivienda_y_Servicios', 'Muebles IKEA cuotas', 'Fijo', 17, '🪑', 'sub', 'Vivienda'],

  ['Supermercado', 'Alimentación', 'Supermercado', 'Variable', 21, '🛒', 'sub', 'Alimentación'],
  ['Delivery', 'Alimentación', 'Delivery', 'Variable', 22, '🛵', 'sub', 'Alimentación'],

  ['Transporte público', 'Transporte', 'Transporte público', 'Variable', 31, '🚇', 'sub', 'Transporte'],
  ['Uber,etc', 'Transporte', 'Uber,etc', 'Variable', 32, '🚕', 'sub', 'Transporte'],

  ['Cuidado Personal', 'Cuidado_Personal_y_Bienestar', 'Cuidado Personal', 'Variable', 41, '💇', 'sub', 'Cuidado personal'],
  ['Deporte', 'Cuidado_Personal_y_Bienestar', 'Deporte', 'Fijo', 42, '🏋️', 'sub', 'Cuidado personal'],
  ['Salud', 'Cuidado_Personal_y_Bienestar', 'Salud', 'Variable', 43, '💊', 'sub', 'Cuidado personal'],
  ['Ropa y calzado', 'Cuidado_Personal_y_Bienestar', 'Ropa y calzado', 'Variable', 44, '👕', 'sub', 'Cuidado personal'],

  ['Educación', 'Educación', 'Educación', 'Variable', 51, '📚', 'sub', 'Educación'],

  ['Food & Drinks', 'Ocio_y_Entretenimiento', 'Food & Drinks', 'Variable', 61, '🍻', 'sub', 'Ocio'],
  ['Cafe', 'Ocio_y_Entretenimiento', 'Cafe', 'Variable', 62, '☕', 'sub', 'Ocio'],
  ['Entretenimiento', 'Ocio_y_Entretenimiento', 'Entretenimiento', 'Variable', 63, '🎬', 'sub', 'Ocio'],

  ['Regalos', 'Viajes_Eventos_Otros', 'Regalos', 'Variable', 71, '🎁', 'sub', 'Viajes y otros'],
  ['Eventos especiales', 'Viajes_Eventos_Otros', 'Eventos especiales', 'Variable', 72, '🎉', 'sub', 'Viajes y otros'],
  ['Viajes', 'Viajes_Eventos_Otros', 'Viajes', 'Variable', 73, '✈️', 'sub', 'Viajes y otros'],
  ['Otros', 'Viajes_Eventos_Otros', 'Otros', 'Variable', 74, '🎲', 'sub', 'Viajes y otros'],
  ['Imprevistos', 'Viajes_Eventos_Otros', 'Imprevistos', 'Variable', 75, '⚠️', 'sub', 'Viajes y otros'],
];

// Nombres de la versión anterior de la app → subcategoría nueva (para móviles sin actualizar y datos viejos).
const ALIAS_CATEGORIAS = {
  'Comida': 'Delivery', 'Salidas': 'Food & Drinks', 'Ropa': 'Ropa y calzado', 'Hogar': 'Hogar compras y mantenimiento',
  'Gym': 'Deporte', 'Viaje': 'Viajes', 'Random': 'Otros', 'Uber/taxi': 'Uber,etc', 'Servicios de Casa': 'Servicios',
  'Subscripciones': 'Suscripciones', 'Celular': 'Internet y Movil', 'IKEA cuotas': 'Muebles IKEA cuotas',
  'Transporte': 'Transporte público',
};

// forma_pago, orden_fran, orden_cami  (vacío = esa persona no la ve)
const CONFIG_FORMAS_PAGO_INICIALES = [
  ['Santander', 1, 1], ['Revolut', 2, 4], ['Cash', 3, 3], ['Sabadell', 4, 2], ['Monedas', 5, ''],
];

// categoria_app, pct_fran, pct_cami  (excepciones a la regla "según ingresos")
const CONFIG_REPARTO_INICIAL = [
  ['Alquiler', 1, 0],
  ['Servicios', 1, 0],
];

const CONFIG_PARAMETROS_INICIALES = [
  ['tipos_ingreso', 'Sueldo,Paro,Extra-freelance,Reembolso-devolución'],
  ['reparto_defecto_fran', 0.6],
  ['nota', 'Si cambias algo aquí, en la app ve a Ajustes → Recargar configuración'],
];

// activo, descripcion, importe, categoria_app, personal_o_compartido, pagado_por, forma_pago, dia_del_mes
const FIJOS_INICIALES = [
  [false, 'Alquiler', 1055, 'Alquiler', 'Compartido', 'Fran', 'Santander', 1],
  [false, 'Muebles IKEA cuotas', 140, 'Muebles IKEA cuotas', 'Compartido', 'Fran', 'Santander', 5],
  [false, 'Internet y Móvil', 25, 'Internet y Movil', 'Compartido', 'Fran', 'Santander', 5],
  [false, 'Suscripciones', 24, 'Suscripciones', 'Compartido', 'Fran', 'Revolut', 5],
  [false, 'Gym', 60, 'Deporte', 'Compartido', 'Fran', 'Santander', 1],
];

// ----------------------------- Code.gs -----------------------------

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

  // Formas de pago: un orden por persona (orden_fran / orden_cami). Vacío = esa persona no la ve.
  // Compatible con el formato viejo (una sola columna "orden" para los dos).
  const filasFp = bloque(col('forma_pago'), 3);
  const porPersona = cIdx => filasFp
    .map(f => ({ nombre: String(f[0]).trim(), orden: f[cIdx] }))
    .filter(x => String(x.orden).trim() !== '')
    .sort((a, b) => num_(a.orden) - num_(b.orden)).map(x => x.nombre);
  const formasPagoPorPersona = col('orden_fran') >= 0
    ? { Fran: porPersona(1), Cami: col('orden_cami') >= 0 ? porPersona(2) : porPersona(1) }
    : { Fran: porPersona(1), Cami: porPersona(1) };
  const formasPago = formasPagoPorPersona.Fran;

  const reparto = {};
  bloque(col('reparto_categoria'), 3).forEach(f => {
    reparto[String(f[0]).trim()] = { fran: num_(f[1]), cami: num_(f[2]) };
  });

  const parametros = {};
  bloque(col('clave'), 2).forEach(f => { parametros[String(f[0]).trim()] = f[1]; });

  _cache.config = { categorias, formasPago, formasPagoPorPersona, reparto, parametros };
  return _cache.config;
}

/** Subcategoría elegible por su nombre (los grupos no se pueden guardar). Acepta nombres de la versión anterior. */
function categoriaPorNombre_(nombre) {
  const elegibles = leerConfig_().categorias.filter(c => c.mostrar !== 'grupo' && c.subcategoria_excel);
  const n = String(nombre || '').trim();
  return elegibles.find(c => c.categoria_app === n)
    || (ALIAS_CATEGORIAS[n] ? elegibles.find(c => c.categoria_app === ALIAS_CATEGORIAS[n]) : null)
    || null;
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
  if (ALIAS_CATEGORIAS[categoriaApp] && cfg.reparto[ALIAS_CATEGORIAS[categoriaApp]]) return cfg.reparto[ALIAS_CATEGORIAS[categoriaApp]];
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
    formasPagoPorPersona: cfg.formasPagoPorPersona,
    reparto: cfg.reparto,
    pctIngresos: leerPctIngresos_(),
    tiposIngreso: tipos,
    servidor: fmtFechaHora_(new Date()),
  };
}

// ----------------------------- Movimientos.gs -----------------------------

/**
 * Alta / edición / borrado de movimientos. Idempotente por id:
 *  - Si el id no existe → se crea en Movimientos y se copia a su tab destino.
 *  - Si existe → se actualiza (y se mueve de tab destino si cambió).
 *  - estado = 'borrado' → se marca en Movimientos y se elimina la fila copiada.
 * Mandar el mismo movimiento dos veces deja exactamente el mismo resultado.
 */

/** Punto de entrada para un lote (la cola offline del móvil). Usa LockService. */
function sincronizar(items) {
  if (!Array.isArray(items)) throw new Error('items debe ser una lista');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('El sheet está ocupado, reintenta en unos segundos');
  try {
    const resultados = items.map(it => {
      try {
        return guardarMovimiento_(it);
      } catch (err) {
        return { id: it && it.id, ok: false, error: String(err && err.message || err) };
      }
    });
    SpreadsheetApp.flush();
    return resultados;
  } finally {
    lock.releaseLock();
  }
}

/** Requiere tener el lock tomado. */
function guardarMovimiento_(it) {
  if (!it || typeof it.id !== 'string' || !it.id.trim() || it.id.length > 100) {
    throw new Error('Movimiento sin id válido');
  }
  const id = it.id.trim();
  const sh = hoja_(TAB.MOVIMIENTOS);
  const fila = buscarFila_(sh, id, 1);
  const previo = fila > 0 ? filaAObjeto_(sh.getRange(fila, 1, 1, MOV_COLS.length).getValues()[0]) : null;
  const ahora = new Date().toISOString();

  if (previo && previo.estado === 'borrado') {
    return { id, ok: true, estado: 'borrado', destino: '', nota: 'ya estaba borrado' };
  }
  if (!previo && it.estado === 'borrado') {
    return { id, ok: true, estado: 'borrado', destino: '', nota: 'no existía' };
  }
  if (previo && previo.editado_en && it.editado_en && String(it.editado_en) < String(previo.editado_en)) {
    return { id, ok: true, estado: previo.estado, destino: previo.destino, nota: 'versión antigua ignorada' };
  }

  let rec;
  if (it.estado === 'borrado') {
    rec = Object.assign({}, previo, { estado: 'borrado', editado_en: it.editado_en || ahora });
    rec.destino = sincronizarDestino_(rec); // elimina la copia
  } else {
    rec = normalizar_(it, ahora);
    rec.creado_en = previo ? previo.creado_en : (it.creado_en || ahora);
    rec.destino = sincronizarDestino_(rec);
  }

  const valores = objetoAFila_(rec);
  if (fila > 0) {
    sh.getRange(fila, 1, 1, MOV_COLS.length).setValues([valores]);
  } else {
    const nueva = sh.getLastRow() + 1;
    if (nueva > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 200);
    sh.getRange(nueva, 1, 1, MOV_COLS.length).setValues([valores]);
  }
  return { id, ok: true, estado: rec.estado, destino: rec.destino };
}

/** Valida y completa un movimiento recibido de la app. */
function normalizar_(it, ahora) {
  const personas = ['Fran', 'Cami'];
  const tipo = it.tipo === 'Ingreso' ? 'Ingreso' : 'Gasto';
  const importe = Math.round(num_(it.importe_eur) * 100) / 100;
  if (!(importe > 0)) throw new Error('Importe inválido');
  const fecha = fmtFecha_(parseFecha_(it.fecha));
  const cargado = ['Fran', 'Cami', 'Auto'].indexOf(it.cargado_por) >= 0 ? it.cargado_por : null;
  if (!cargado) throw new Error('cargado_por inválido');

  const rec = {
    id: it.id.trim(), creado_en: '', cargado_por: cargado, tipo, fecha, importe_eur: importe,
    categoria_app: '', categoria_excel: '', subcategoria_excel: '',
    detalle: String(it.detalle || '').trim().slice(0, 200),
    forma_pago: String(it.forma_pago || '').trim(),
    personal_o_compartido: '', pagado_por: '', pct_fran: '', pct_cami: '',
    fijo_o_variable: '', tipo_ingreso: '', destino: '', estado: 'activo',
    editado_en: it.editado_en || ahora,
  };

  if (tipo === 'Ingreso') {
    rec.tipo_ingreso = String(it.tipo_ingreso || 'Sueldo').trim();
    rec.pagado_por = personas.indexOf(it.pagado_por) >= 0 ? it.pagado_por : (cargado === 'Auto' ? 'Fran' : cargado);
    rec.personal_o_compartido = 'Personal';
    return rec;
  }

  const cat = categoriaPorNombre_(it.categoria_app);
  if (!cat) throw new Error('Categoría desconocida: ' + it.categoria_app);
  rec.categoria_app = cat.categoria_app;
  rec.categoria_excel = cat.categoria_excel;
  rec.subcategoria_excel = cat.subcategoria_excel;
  rec.fijo_o_variable = ['Fijo', 'Variable', 'Cuotas'].indexOf(it.fijo_o_variable) >= 0
    ? it.fijo_o_variable : cat.fijo_o_variable;
  rec.personal_o_compartido = it.personal_o_compartido === 'Compartido' ? 'Compartido' : 'Personal';
  rec.pagado_por = personas.indexOf(it.pagado_por) >= 0 ? it.pagado_por : (cargado === 'Auto' ? 'Fran' : cargado);

  if (rec.personal_o_compartido === 'Compartido') {
    let pf = it.pct_fran === '' || it.pct_fran === undefined || it.pct_fran === null ? NaN : num_(it.pct_fran);
    let pc = it.pct_cami === '' || it.pct_cami === undefined || it.pct_cami === null ? NaN : num_(it.pct_cami);
    if (pf > 1 || pc > 1) { pf = pf / 100; pc = pc / 100; } // aceptar 60 / 40
    if (isNaN(pf) || isNaN(pc) || Math.abs(pf + pc - 1) > 0.011) {
      const r = repartoPara_(rec.categoria_app, rec.fecha);
      pf = r.fran; pc = r.cami;
    }
    rec.pct_fran = Math.round(pf * 1000) / 1000;
    rec.pct_cami = Math.round(pc * 1000) / 1000;
  }
  return rec;
}

/* ============================ Copia en la tab destino ============================ */

function destinoPara_(rec) {
  if (rec.tipo !== 'Gasto' || rec.estado === 'borrado') return null;
  if (rec.personal_o_compartido === 'Compartido') return TAB.AMBOS;
  return rec.pagado_por === 'Cami' ? TAB.CAMILA : TAB.FRAN;
}

/**
 * Deja la copia del movimiento solo donde corresponde. Devuelve "Tab!fila" o ''.
 */
function sincronizarDestino_(rec) {
  const destino = destinoPara_(rec);
  let existente = null;

  TABS_DESTINO.forEach(nombre => {
    const sh = hoja_(nombre);
    const idCol = colIdApp_(sh);
    const filas = buscarFilas_(sh, rec.id, idCol).sort((a, b) => b - a); // de abajo hacia arriba
    filas.forEach((f, i) => {
      const esLaQueSeQueda = nombre === destino && !existente && i === filas.length - 1;
      if (esLaQueSeQueda) existente = { sh, fila: f, idCol };
      else sh.deleteRow(f);
    });
  });

  if (!destino) return '';
  if (existente) {
    escribirFilaDetalle_(existente.sh, existente.fila, rec, existente.idCol, false);
    return destino + '!' + existente.fila;
  }
  const sh = hoja_(destino);
  const idCol = colIdApp_(sh);
  const fila = primeraFilaLibre_(sh);
  escribirFilaDetalle_(sh, fila, rec, idCol, true);
  return destino + '!' + fila;
}

function escribirFilaDetalle_(sh, fila, rec, idCol, nueva) {
  const fecha = parseFecha_(rec.fecha); // solo para AÑO/MES si no hay fórmulas
  let texto = rec.detalle || rec.categoria_app;
  if (rec.forma_pago) texto += ' [' + rec.forma_pago + ']';

  if (nueva && fila > 2) {
    sh.getRange(fila - 1, 1, 1, 7).copyTo(sh.getRange(fila, 1, 1, 7), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  }
  // "Periodo" (D) en las tabs Detalle es SIEMPRE el día 1 del mes (las tablas dinámicas agrupan por ese valor).
  // Se escribe como texto ISO para que Sheets lo convierta a una fecha entera, sin hora ni zona horaria.
  const periodo = rec.fecha.slice(0, 7) + '-01';
  sh.getRange(fila, 1, 1, 5).setValues([[rec.categoria_excel, rec.subcategoria_excel, texto, periodo, rec.importe_eur]]);

  // AÑO y MES: si la fila de arriba usa fórmulas, las replicamos; si no, escribimos el valor.
  const formulas = fila > 2 ? sh.getRange(fila - 1, 6, 1, 2).getFormulasR1C1()[0] : ['', ''];
  const anioMes = [fecha.getFullYear(), fecha.getMonth() + 1];
  [0, 1].forEach(i => {
    const celda = sh.getRange(fila, 6 + i);
    if (formulas[i]) celda.setFormulaR1C1(formulas[i]);
    else celda.setValue(anioMes[i]);
  });
  sh.getRange(fila, idCol).setNumberFormat('@').setValue(rec.id);
}

/**
 * Primera fila sin datos en A–E después de la última usada (las tabs vienen preformateadas).
 * Si quedan menos de 20 filas libres, inserta 200 filas ANTES de la primera libre: así quedan
 * dentro del rango de origen de las tablas dinámicas (TD AMBOS usa A1:E1008), que se amplía solo.
 */
function primeraFilaLibre_(sh) {
  const max = sh.getMaxRows();
  const v = sh.getRange(1, 1, max, 5).getValues();
  let ultima = 1;
  for (let r = v.length - 1; r >= 0; r--) {
    if (v[r].some(c => c !== '' && c !== null)) { ultima = r + 1; break; }
  }
  const fila = ultima + 1;
  if (fila > max) sh.insertRowsAfter(max, 200);
  else if (fila > max - 20) sh.insertRowsBefore(fila, 200);
  return fila;
}

function colIdApp_(sh) {
  _cache.idCols = _cache.idCols || {};
  const key = sh.getParent().getId() + '|' + sh.getName();
  if (_cache.idCols[key]) return _cache.idCols[key];
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const idx = head.indexOf(ID_APP_HEADER);
  if (idx < 0) throw new Error('La tab "' + sh.getName() + '" no tiene columna id_app. Ejecuta setup().');
  _cache.idCols[key] = idx + 1;
  return idx + 1;
}

/* ================================ Utilidades ================================ */

function buscarFilas_(sh, valor, col) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, col, last - 1, 1)
    .createTextFinder(valor).matchEntireCell(true).matchCase(true).findAll()
    .map(r => r.getRow());
}
function buscarFila_(sh, valor, col) {
  const f = buscarFilas_(sh, valor, col);
  return f.length ? f[0] : -1;
}

function filaAObjeto_(fila) {
  const o = {};
  MOV_COLS.forEach((c, i) => { o[c] = fila[i]; });
  o.fecha = fmtFecha_(o.fecha);
  o.creado_en = fmtFechaHora_(o.creado_en);
  o.editado_en = fmtFechaHora_(o.editado_en);
  return o;
}

function objetoAFila_(o) {
  return MOV_COLS.map(c => {
    if (c === 'fecha') return parseFecha_(o.fecha);
    const v = o[c];
    return v === undefined || v === null ? '' : v;
  });
}

/* ================================ Listado ================================ */

function listarMovimientos_(limite) {
  const sh = hoja_(TAB.MOVIMIENTOS);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const filas = sh.getRange(2, 1, last - 1, MOV_COLS.length).getValues()
    .filter(f => f[0] !== '')
    .map(filaAObjeto_)
    .filter(o => o.estado !== 'borrado');
  filas.sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en)));
  return filas.slice(0, Math.min(Number(limite) || 50, 200));
}

// ----------------------------- Resumen.gs -----------------------------

/**
 * Resumen del mes: gastado por categoría vs presupuesto (tab PPTO).
 * Lee las tabs Detalle (incluye lo cargado a mano, no solo lo de la app).
 */

function norm_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function resumenMes_(mes, usuario) {
  const hoy = Utilities.formatDate(new Date(), TZ, 'yyyy-MM');
  mes = /^\d{4}-\d{2}$/.test(String(mes || '')) ? mes : hoy;
  const anio = Number(mes.slice(0, 4));
  const nMes = Number(mes.slice(5, 7));
  usuario = usuario === 'Cami' ? 'Cami' : 'Fran';

  // Presupuesto
  const ppto = {};
  const vp = hoja_(TAB.PPTO).getDataRange().getValues();
  for (let r = 1; r < vp.length; r++) {
    const [cat, sub, tipo, comp, pers] = vp[r];
    if (!String(cat).trim() || !String(sub).trim()) continue;
    ppto[norm_(cat) + '|' + norm_(sub)] = {
      categoria_excel: String(cat).trim(), subcategoria_excel: String(sub).trim(),
      tipo: String(tipo).trim(), compartido: num_(comp), personal: num_(pers),
    };
  }

  // Etiquetas de la app (categoria_app e icono) por Categoria Principal + Subcategoría
  const etiquetas = {};
  leerConfig_().categorias.filter(c => c.mostrar !== 'grupo').forEach(c => {
    const k = norm_(c.categoria_excel) + '|' + norm_(c.subcategoria_excel);
    if (!etiquetas[k]) etiquetas[k] = { nombre: c.categoria_app, icono: c.icono };
  });

  // Movimientos de la app (para dar fecha exacta y quién cargó cada fila copiada en las tabs Detalle)
  const movs = {};
  const shMov = hoja_(TAB.MOVIMIENTOS);
  const lastMov = shMov.getLastRow();
  const filasMov = lastMov >= 2 ? shMov.getRange(2, 1, lastMov - 1, MOV_COLS.length).getValues().map(filaAObjeto_) : [];
  filasMov.forEach(o => { if (o.id) movs[o.id] = o; });

  const sumar = nombreTab => {
    const acc = {};
    const sh = hoja_(nombreTab);
    const last = sh.getLastRow();
    if (last < 2) return acc;
    const idCol = colIdApp_(sh);
    sh.getRange(2, 1, last - 1, Math.max(7, idCol)).getValues().forEach(f => {
      let y = Number(f[5]), m = Number(f[6]);
      if ((!y || !m) && f[3] instanceof Date) { y = f[3].getFullYear(); m = f[3].getMonth() + 1; }
      if (y !== anio || m !== nMes) return;
      const k = norm_(f[0]) + '|' + norm_(f[1]);
      if (!acc[k]) acc[k] = { categoria_excel: String(f[0]).trim(), subcategoria_excel: String(f[1]).trim(), gastado: 0, movimientos: [] };
      const importe = num_(f[4]);
      acc[k].gastado += importe;
      const id = String(f[idCol - 1] || '').trim();
      const mv = id ? movs[id] : null;
      acc[k].movimientos.push({
        id: mv ? id : '',
        detalle: String(f[2] || '').trim(),
        importe: Math.round(importe * 100) / 100,
        fecha: mv ? mv.fecha : '',               // vacío = cargado a mano en el sheet (solo tiene el mes)
        cargado_por: mv ? mv.cargado_por : '',
        pagado_por: mv ? mv.pagado_por : '',
      });
    });
    Object.keys(acc).forEach(k => acc[k].movimientos.sort((a, b) =>
      String(b.fecha).localeCompare(String(a.fecha)) || b.importe - a.importe));
    return acc;
  };

  const armar = (gastos, campoPpto) => {
    const keys = {};
    Object.keys(gastos).forEach(k => { keys[k] = true; });
    Object.keys(ppto).forEach(k => { if (ppto[k][campoPpto] > 0) keys[k] = true; });
    const filas = Object.keys(keys).map(k => {
      const g = gastos[k], p = ppto[k];
      const base = g || p;
      const et = etiquetas[k];
      return {
        categoria_excel: base.categoria_excel,
        subcategoria_excel: base.subcategoria_excel,
        nombre: et ? et.nombre : base.subcategoria_excel,
        icono: et ? et.icono : '',
        gastado: Math.round((g ? g.gastado : 0) * 100) / 100,
        ppto: p ? p[campoPpto] : 0,
        movimientos: g ? g.movimientos : [],
      };
    });
    filas.sort((a, b) => b.gastado - a.gastado || b.ppto - a.ppto);
    return filas;
  };

  const compartido = armar(sumar(TAB.AMBOS), 'compartido');
  const personal = armar(sumar(usuario === 'Cami' ? TAB.CAMILA : TAB.FRAN), 'personal');
  const total = arr => Math.round(arr.reduce((s, f) => s + f.gastado, 0) * 100) / 100;
  const totalPpto = arr => Math.round(arr.reduce((s, f) => s + f.ppto, 0) * 100) / 100;

  // Ingresos del mes (desde Movimientos)
  let ingresosTotal = 0, ingresosUsuario = 0;
  filasMov.forEach(o => {
    if (o.tipo !== 'Ingreso' || o.estado === 'borrado' || o.fecha.slice(0, 7) !== mes) return;
    ingresosTotal += num_(o.importe_eur);
    if (o.pagado_por === usuario) ingresosUsuario += num_(o.importe_eur);
  });

  return {
    mes, usuario,
    compartido, personal,
    totales: {
      compartido: total(compartido), compartidoPpto: totalPpto(compartido),
      personal: total(personal), personalPpto: totalPpto(personal),
      ingresos: Math.round(ingresosTotal * 100) / 100,
      ingresosUsuario: Math.round(ingresosUsuario * 100) / 100,
    },
  };
}

// ----------------------------- Fijos.gs -----------------------------

/**
 * Gastos fijos automáticos. setup() instala un trigger diario que llama a
 * generarFijosDiario(). Cada fijo activo genera un movimiento por mes con id
 * determinista "fijo-<fila>-<AAAA-MM>", así nunca se duplica.
 * Si borras ese movimiento desde la app, no se vuelve a crear ese mes.
 */

function generarFijosDiario() {
  return generarFijos_(new Date());
}

function generarFijos_(hoy) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('No se pudo tomar el lock');
  try {
    const anio = hoy.getFullYear();
    const mes = hoy.getMonth() + 1;
    const ym = anio + '-' + String(mes).padStart(2, '0');
    const diasMes = new Date(anio, mes, 0).getDate();
    const mov = hoja_(TAB.MOVIMIENTOS);
    const creados = [];

    listarFijos_().forEach(f => {
      if (!f.activo) return;
      const dia = Math.min(Math.max(1, Math.round(num_(f.dia_del_mes)) || 1), diasMes);
      if (hoy.getDate() < dia) return;
      const id = 'fijo-' + f.fila + '-' + ym;
      if (buscarFila_(mov, id, 1) > 0) return;
      const r = guardarMovimiento_({
        id,
        cargado_por: 'Auto',
        tipo: 'Gasto',
        fecha: ym + '-' + String(dia).padStart(2, '0'),
        importe_eur: f.importe,
        categoria_app: f.categoria_app,
        detalle: f.descripcion,
        forma_pago: f.forma_pago,
        personal_o_compartido: f.personal_o_compartido,
        pagado_por: f.pagado_por,
        fijo_o_variable: 'Fijo',
        editado_en: new Date().toISOString(),
      });
      creados.push(r);
    });
    SpreadsheetApp.flush();
    console.log('Fijos creados: ' + JSON.stringify(creados));
    return creados;
  } finally {
    lock.releaseLock();
  }
}

function listarFijos_() {
  const sh = hoja_(TAB.FIJOS);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, FIJOS_COLS.length).getValues()
    .map((f, i) => {
      const o = { fila: i + 2 };
      FIJOS_COLS.forEach((c, j) => { o[c] = f[j]; });
      o.activo = o.activo === true || String(o.activo).toUpperCase() === 'TRUE';
      o.importe = num_(o.importe);
      return o;
    })
    .filter(o => String(o.descripcion).trim() !== '');
}

function toggleFijo_(fila, activo) {
  const sh = hoja_(TAB.FIJOS);
  fila = Number(fila);
  if (!(fila >= 2 && fila <= sh.getLastRow())) throw new Error('Fila de fijo inválida');
  sh.getRange(fila, 1).setValue(!!activo);
  return listarFijos_();
}

// ----------------------------- Setup.gs -----------------------------

/**
 * EJECUTAR UNA VEZ: setup()
 *  1. Copia de seguridad de "Detalle Ambos" y "Detalle Camila" (… respaldo AAAA-MM-DD).
 *  2. Crea las tabs Movimientos, Config y Fijos (sheet compartido) y Gastos Fran (Cuentas Esp).
 *  3. Añade la columna id_app a la derecha de lo existente en las tabs Detalle.
 *  4. Genera el token secreto (Script Properties) y lo muestra en el registro.
 *  5. Instala el trigger diario de gastos fijos.
 * Se puede ejecutar varias veces: lo que ya existe no se toca.
 */
function setup() {
  const log = [];
  respaldar_(log);
  crearMovimientos_(log);
  crearConfig_(log);
  crearFijos_(log);
  crearGastosFran_(log);
  [TAB.AMBOS, TAB.CAMILA, TAB.FRAN].forEach(t => asegurarColumnaIdApp_(hoja_(t), log));
  asegurarToken_(log);
  instalarTrigger_(log);
  SpreadsheetApp.flush();
  console.log(log.join('\n'));
  return log;
}

/** Muestra el token en el registro de ejecución (para copiarlo en la app). */
function verToken() {
  const t = PropertiesService.getScriptProperties().getProperty('APP_TOKEN');
  console.log(t ? 'Token: ' + t : 'Aún no hay token: ejecuta setup()');
}

/** Si alguna vez el token se filtra: genera uno nuevo (hay que ponerlo en los dos móviles). */
function regenerarToken() {
  PropertiesService.getScriptProperties().deleteProperty('APP_TOKEN');
  const log = [];
  asegurarToken_(log);
  console.log(log.join('\n'));
}

function respaldar_(log) {
  const ss = ssCompartido_();
  const fecha = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  [TAB.AMBOS, TAB.CAMILA].forEach(nombre => {
    const destino = nombre + ' respaldo ' + fecha;
    if (ss.getSheetByName(destino)) { log.push('Respaldo ya existe: ' + destino); return; }
    const copia = ss.getSheetByName(nombre).copyTo(ss).setName(destino);
    ss.setActiveSheet(copia);
    ss.moveActiveSheet(ss.getNumSheets());
    log.push('Respaldo creado: ' + destino);
  });
}

function nuevaTab_(ss, nombre, headers, log) {
  let sh = ss.getSheetByName(nombre);
  if (sh) { log.push('Ya existe: ' + nombre); return null; }
  sh = ss.insertSheet(nombre, ss.getNumSheets());
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#e8f0fe');
  sh.setFrozenRows(1);
  log.push('Creada: ' + nombre);
  return sh;
}

function crearMovimientos_(log) {
  const sh = nuevaTab_(ssCompartido_(), TAB.MOVIMIENTOS, MOV_COLS, log);
  if (!sh) {
    // Ya existía (p. ej. creada a mano o en una ejecución anterior): comprobar encabezados.
    const head = hoja_(TAB.MOVIMIENTOS).getRange(1, 1, 1, MOV_COLS.length).getValues()[0].map(h => String(h).trim());
    if (head.join('|') !== MOV_COLS.join('|')) {
      throw new Error('La tab Movimientos existe pero sus encabezados no coinciden con: ' + MOV_COLS.join(', '));
    }
    return;
  }
  const col = c => MOV_COLS.indexOf(c) + 1;
  const n = sh.getMaxRows() - 1;
  ['id', 'creado_en', 'editado_en', 'destino'].forEach(c => sh.getRange(2, col(c), n, 1).setNumberFormat('@'));
  sh.getRange(2, col('fecha'), n, 1).setNumberFormat('yyyy-mm-dd');
  sh.getRange(2, col('importe_eur'), n, 1).setNumberFormat('#,##0.00 "€"');
  sh.getRange(2, col('pct_fran'), n, 2).setNumberFormat('0%');
  sh.setColumnWidth(1, 120);
}

function crearConfig_(log) {
  const ss = ssCompartido_();
  if (ss.getSheetByName(TAB.CONFIG)) { log.push('Ya existe: ' + TAB.CONFIG); return; }
  const sh = ss.insertSheet(TAB.CONFIG, ss.getNumSheets());
  const bloques = [
    { col: 1, head: ['categoria_app', 'categoria_excel', 'subcategoria_excel', 'fijo_o_variable', 'orden', 'icono', 'mostrar', 'padre'], rows: CONFIG_CATEGORIAS_INICIALES },
    { col: 10, head: ['forma_pago', 'orden_fran', 'orden_cami'], rows: CONFIG_FORMAS_PAGO_INICIALES },
    { col: 13, head: ['reparto_categoria', 'pct_fran', 'pct_cami'], rows: CONFIG_REPARTO_INICIAL },
    { col: 17, head: ['clave', 'valor'], rows: CONFIG_PARAMETROS_INICIALES },
  ];
  bloques.forEach(b => {
    sh.getRange(1, b.col, 1, b.head.length).setValues([b.head]).setFontWeight('bold').setBackground('#e8f0fe');
    if (b.rows.length) sh.getRange(2, b.col, b.rows.length, b.head.length).setValues(b.rows);
  });
  sh.getRange(2, 14, 50, 2).setNumberFormat('0%');
  sh.setFrozenRows(1);
  sh.getRange(1, 1).setNote(
    'mostrar: chip (botón principal) · sub (opción pequeña bajo su "padre") · oculta (solo para Fijos).\n' +
    'reparto_categoria: excepciones al reparto por ingresos. Vacía la tabla para usar siempre el % de ingresos.');
  log.push('Creada: ' + TAB.CONFIG);
}

function crearFijos_(log) {
  const sh = nuevaTab_(ssCompartido_(), TAB.FIJOS, FIJOS_COLS, log);
  if (!sh) return;
  sh.getRange(2, 1, FIJOS_INICIALES.length, FIJOS_COLS.length).setValues(FIJOS_INICIALES);
  sh.getRange(2, 1, 50, 1).insertCheckboxes();
  sh.getRange(2, 3, 50, 1).setNumberFormat('#,##0.00 "€"');
  sh.getRange(1, 1).setNote('Marca "activo" cuando confirmes el importe. Añade fijos nuevos al FINAL (no insertes filas en medio: el id usa el número de fila).');
}

function crearGastosFran_(log) {
  const sh = nuevaTab_(ssFran_(), TAB.FRAN, DETALLE_HEADERS.concat([ID_APP_HEADER]), log);
  if (!sh) return;
  const n = sh.getMaxRows() - 1;
  sh.getRange(2, 4, n, 1).setNumberFormat('mmm-yy');
  sh.getRange(2, 5, n, 1).setNumberFormat('#,##0.00 "€"');
  sh.getRange(2, 8, n, 1).setNumberFormat('@');
}

/** Añade "id_app" en la primera columna libre a la derecha de cualquier dato existente. */
function asegurarColumnaIdApp_(sh, log) {
  const lastCol = sh.getLastColumn();
  const head = sh.getRange(1, 1, 1, Math.max(lastCol, 1)).getValues()[0].map(h => String(h).trim());
  if (head.indexOf(ID_APP_HEADER) >= 0) { log.push(sh.getName() + ': id_app ya existe'); return; }
  const lastRow = Math.max(sh.getLastRow(), 1);
  const v = sh.getRange(1, 1, lastRow, Math.max(lastCol, 1)).getValues();
  let usada = 0;
  v.forEach(f => f.forEach((c, i) => { if (c !== '' && c !== null && i + 1 > usada) usada = i + 1; }));
  const col = usada + 1;
  if (col > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), 1);
  sh.getRange(1, col).setValue(ID_APP_HEADER).setFontWeight('bold');
  sh.getRange(2, col, sh.getMaxRows() - 1, 1).setNumberFormat('@');
  log.push(sh.getName() + ': id_app añadida en la columna ' + columnaLetra_(col));
}

function columnaLetra_(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function asegurarToken_(log) {
  const props = PropertiesService.getScriptProperties();
  let t = props.getProperty('APP_TOKEN');
  if (!t) {
    t = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 40);
    props.setProperty('APP_TOKEN', t);
    log.push('Token NUEVO generado. Cópialo en la app → Ajustes: ' + t);
  } else {
    log.push('Token ya existía (usa verToken() para verlo).');
  }
}

function instalarTrigger_(log) {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'generarFijosDiario')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('generarFijosDiario').timeBased().everyDays(1).atHour(7).inTimezone(TZ).create();
  log.push('Trigger diario de fijos instalado (≈ 7:00).');
}

// ----------------------------- Tests.gs -----------------------------

/**
 * PRUEBAS. Ejecuta testTodo() desde el editor de Apps Script (después de setup()).
 * Crean movimientos con id "test-…", comprueban las tabs destino y lo limpian todo al final.
 * Cada movimiento de prueba lleva el detalle "PRUEBA APP – se borra sola".
 */

function testTodo() {
  const resultados = [];
  const correr = (nombre, fn) => {
    try { fn(); resultados.push('✅ ' + nombre); }
    catch (e) { resultados.push('❌ ' + nombre + ': ' + (e && e.message || e)); }
    finally { limpiarTests_(); }
  };
  correr('Reparto e ingresos', testReparto);
  correr('Crear / editar / borrar en cada tab destino', testCrudDestinos);
  correr('Idempotencia (mismo id dos veces)', testIdempotencia);
  correr('Cola offline simulada (lote con reintento)', testColaOffline);
  correr('Fijos automáticos sin duplicar', testFijos);
  console.log(resultados.join('\n'));
  if (resultados.some(r => r.indexOf('❌') === 0)) throw new Error('Hay pruebas fallidas:\n' + resultados.join('\n'));
  return resultados;
}

/* ------------------------------------------------------------------ */

const TEST_DETALLE = 'PRUEBA APP – se borra sola';

function mov_(extra) {
  return Object.assign({
    id: 'test-' + Utilities.getUuid(),
    cargado_por: 'Fran',
    tipo: 'Gasto',
    fecha: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'),
    importe_eur: 1.23,
    categoria_app: 'Supermercado',
    detalle: TEST_DETALLE,
    forma_pago: 'Revolut',
    personal_o_compartido: 'Compartido',
    pagado_por: 'Fran',
    editado_en: new Date().toISOString(),
  }, extra || {});
}

function assert_(cond, msg) { if (!cond) throw new Error(msg); }

function copias_(id) {
  const out = {};
  TABS_DESTINO.forEach(t => {
    const sh = hoja_(t);
    out[t] = buscarFilas_(sh, id, colIdApp_(sh));
  });
  return out;
}

function filaMov_(id) {
  const sh = hoja_(TAB.MOVIMIENTOS);
  const filas = buscarFilas_(sh, id, 1);
  return { n: filas.length, obj: filas.length ? filaAObjeto_(sh.getRange(filas[0], 1, 1, MOV_COLS.length).getValues()[0]) : null };
}

function despues_(ms) { return new Date(Date.now() + ms).toISOString(); }

/* ------------------------------------------------------------------ */

function testReparto() {
  const pct = leerPctIngresos_();
  assert_(Object.keys(pct).length > 0, 'No se leyeron % de la tab Ingresos');
  const r = repartoPara_('Supermercado', '2026-10-15');
  assert_(Math.abs(r.fran + r.cami - 1) < 0.02, 'El reparto no suma 100%: ' + JSON.stringify(r));
  const alq = repartoPara_('Alquiler', '2026-10-15');
  const exc = leerConfig_().reparto['Alquiler'];
  if (exc) assert_(alq.fran === exc.fran, 'La excepción de Alquiler no se aplica');
  // mes futuro sin datos → usa el último mes con datos
  const fut = repartoPara_('Supermercado', '2030-01-10');
  assert_(fut.fran + fut.cami > 0.98, 'El mes sin datos no cae al último mes con datos');
}

function testCrudDestinos() {
  const casos = [
    { m: mov_({ personal_o_compartido: 'Compartido' }), tab: TAB.AMBOS },
    { m: mov_({ personal_o_compartido: 'Personal', cargado_por: 'Cami', pagado_por: 'Cami' }), tab: TAB.CAMILA },
    { m: mov_({ personal_o_compartido: 'Personal', cargado_por: 'Fran', pagado_por: 'Fran' }), tab: TAB.FRAN },
  ];
  casos.forEach(c => {
    // Crear
    let res = sincronizar([c.m])[0];
    assert_(res.ok, 'Error creando: ' + res.error);
    let cp = copias_(c.m.id);
    assert_(cp[c.tab].length === 1, 'No se copió a ' + c.tab);
    const sh = hoja_(c.tab);
    const fila = sh.getRange(cp[c.tab][0], 1, 1, 7).getValues()[0];
    assert_(String(fila[2]).indexOf('[Revolut]') > 0, 'El detalle no incluye la forma de pago');
    assert_(Math.abs(num_(fila[4]) - 1.23) < 0.001, 'Importe mal copiado en ' + c.tab);

    // Editar importe
    res = sincronizar([Object.assign({}, c.m, { importe_eur: 4.56, editado_en: despues_(1000) })])[0];
    assert_(res.ok, 'Error editando: ' + res.error);
    cp = copias_(c.m.id);
    assert_(cp[c.tab].length === 1, 'La edición duplicó la fila en ' + c.tab);
    assert_(Math.abs(num_(sh.getRange(cp[c.tab][0], 5).getValue()) - 4.56) < 0.001, 'La edición no actualizó ' + c.tab);
    assert_(filaMov_(c.m.id).obj.importe_eur === 4.56, 'La edición no actualizó Movimientos');

    // Borrar
    res = sincronizar([Object.assign({}, c.m, { estado: 'borrado', editado_en: despues_(2000) })])[0];
    assert_(res.ok, 'Error borrando: ' + res.error);
    cp = copias_(c.m.id);
    assert_(TABS_DESTINO.every(t => cp[t].length === 0), 'La fila no se eliminó de ' + c.tab);
    assert_(filaMov_(c.m.id).obj.estado === 'borrado', 'Movimientos no quedó en estado borrado');
  });

  // Cambiar de destino: compartido → personal de Cami
  const m = mov_();
  sincronizar([m]);
  sincronizar([Object.assign({}, m, { personal_o_compartido: 'Personal', pagado_por: 'Cami', editado_en: despues_(1000) })]);
  const cp = copias_(m.id);
  assert_(cp[TAB.AMBOS].length === 0 && cp[TAB.CAMILA].length === 1, 'Mover de Ambos a Camila no funcionó');

  // Ingreso: solo en Movimientos
  const ing = mov_({ tipo: 'Ingreso', tipo_ingreso: 'Extra-freelance', categoria_app: '', pagado_por: 'Cami' });
  const r = sincronizar([ing])[0];
  assert_(r.ok && r.destino === '', 'El ingreso no debería copiarse a ninguna tab');
  assert_(filaMov_(ing.id).obj.tipo === 'Ingreso', 'El ingreso no quedó en Movimientos');
}

function testIdempotencia() {
  const m = mov_();
  sincronizar([m]);
  sincronizar([m]);
  sincronizar([m, m]);
  assert_(filaMov_(m.id).n === 1, 'Movimientos tiene el id repetido');
  assert_(copias_(m.id)[TAB.AMBOS].length === 1, 'Detalle Ambos tiene el id repetido');
  // Una versión vieja no pisa una nueva
  sincronizar([Object.assign({}, m, { importe_eur: 9.99, editado_en: despues_(5000) })]);
  sincronizar([Object.assign({}, m, { importe_eur: 1.11, editado_en: despues_(-60000) })]);
  assert_(filaMov_(m.id).obj.importe_eur === 9.99, 'Una edición antigua pisó a una nueva');
}

/**
 * Simula el móvil sin conexión: varios movimientos quedan en cola (alta + edición
 * del mismo id + otro alta + un borrado) y se mandan juntos; luego la respuesta "se
 * pierde" y el móvil reintenta el mismo lote completo.
 */
function testColaOffline() {
  const a = mov_({ importe_eur: 10 });
  const aEditado = Object.assign({}, a, { importe_eur: 12.5, editado_en: despues_(1000) });
  const b = mov_({ personal_o_compartido: 'Personal', categoria_app: 'Delivery' });
  const c = mov_();
  const cBorrado = Object.assign({}, c, { estado: 'borrado', editado_en: despues_(1000) });
  const cola = [a, aEditado, b, c, cBorrado];

  const r1 = sincronizar(cola);
  assert_(r1.every(r => r.ok), 'Algún elemento de la cola falló: ' + JSON.stringify(r1));
  const r2 = sincronizar(cola); // reintento
  assert_(r2.every(r => r.ok), 'El reintento falló: ' + JSON.stringify(r2));

  assert_(filaMov_(a.id).n === 1 && filaMov_(a.id).obj.importe_eur === 12.5, 'La edición en cola no quedó aplicada una sola vez');
  assert_(copias_(a.id)[TAB.AMBOS].length === 1, 'La copia de A está duplicada o falta');
  assert_(copias_(b.id)[TAB.FRAN].length === 1, 'B (personal de Fran) no está en Gastos Fran');
  assert_(filaMov_(c.id).obj.estado === 'borrado', 'C no quedó borrado');
  assert_(TABS_DESTINO.every(t => copias_(c.id)[t].length === 0), 'C sigue en una tab destino');
}

function testFijos() {
  const sh = hoja_(TAB.FIJOS);
  const fila = sh.getLastRow() + 1;
  sh.getRange(fila, 1, 1, FIJOS_COLS.length)
    .setValues([[true, TEST_DETALLE, 3.21, 'Suscripciones', 'Compartido', 'Fran', 'Revolut', 1]]);
  try {
    const hoy = new Date();
    generarFijos_(hoy);
    generarFijos_(hoy); // segunda vez el mismo día → no duplica
    const id = 'fijo-' + fila + '-' + Utilities.formatDate(hoy, TZ, 'yyyy-MM');
    assert_(filaMov_(id).n === 1, 'El fijo no se creó o se duplicó');
    assert_(filaMov_(id).obj.cargado_por === 'Auto', 'El fijo no tiene cargado_por = Auto');
    assert_(copias_(id)[TAB.AMBOS].length === 1, 'El fijo no se copió a Detalle Ambos');
    sincronizar([Object.assign(filaMov_(id).obj, { estado: 'borrado', editado_en: despues_(1000) })]);
  } finally {
    sh.deleteRow(fila);
  }
}

/** Elimina físicamente todo rastro de pruebas (Movimientos + tabs destino). */
function limpiarTests_() {
  _cache.idCols = {};
  const borrarPor = (sh, col, pred) => {
    const last = sh.getLastRow();
    if (last < 2) return;
    const v = sh.getRange(2, col, last - 1, 1).getValues();
    for (let i = v.length - 1; i >= 0; i--) if (pred(String(v[i][0]), i + 2)) sh.deleteRow(i + 2);
  };
  TABS_DESTINO.forEach(t => {
    const sh = hoja_(t);
    borrarPor(sh, colIdApp_(sh), id => id.indexOf('test-') === 0);
    borrarPor(sh, 3, d => d.indexOf(TEST_DETALLE) === 0);
  });
  const mov = hoja_(TAB.MOVIMIENTOS);
  const det = MOV_COLS.indexOf('detalle') + 1;
  const last = mov.getLastRow();
  if (last >= 2) {
    const v = mov.getRange(2, 1, last - 1, det).getValues();
    for (let i = v.length - 1; i >= 0; i--) {
      if (String(v[i][0]).indexOf('test-') === 0 || String(v[i][det - 1]) === TEST_DETALLE) mov.deleteRow(i + 2);
    }
  }
  SpreadsheetApp.flush();
}
