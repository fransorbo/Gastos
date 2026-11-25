/* Gastos F&C — PWA para cargar gastos e ingresos en Google Sheets. */
'use strict';

const VERSION = '1.1.1';

/* ============================ Utilidades ============================ */

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const LS = {
  get(k, d) { try { const v = localStorage.getItem('gfc.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('gfc.' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
};

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const fmtEUR = n => eur.format(Number(n) || 0);

function hoyStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function fmtCorta(s) { // AAAA-MM-DD → DD/MM
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? m[3] + '/' + m[2] : '';
}
function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
function parseImporte(txt) {
  let s = String(txt || '').replace(/[€\s]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const n = Number(s);
  return isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer;
function toast(msg, ms = 1800) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function haptic() {
  try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) { /* nada */ }
  // iOS 18+: activar un <input switch> produce vibración háptica
  try { $('.haptic').click(); } catch (e) { /* nada */ }
}

/* ============================ Configuración ============================ */

const CONFIG_POR_DEFECTO = {
  categorias: [
    ['Supermercado', 'Alimentación', 'Supermercado', 'Variable', '🛒', 'chip', ''],
    ['Comida', 'Alimentación', 'Delivery', 'Variable', '🍔', 'chip', ''],
    ['Salidas', 'Ocio_y_Entretenimiento', 'Food & Drinks', 'Variable', '🍻', 'chip', ''],
    ['Transporte', 'Transporte', 'Transporte público', 'Variable', '🚇', 'chip', ''],
    ['Uber/taxi', 'Transporte', 'Uber,etc', 'Variable', '🚕', 'sub', 'Transporte'],
    ['Ropa', 'Cuidado_Personal_y_Bienestar', 'Ropa y calzado', 'Variable', '👕', 'chip', ''],
    ['Hogar', 'Vivienda_y_Servicios', 'Hogar compras y mantenimiento', 'Variable', '🛋️', 'chip', ''],
    ['Salud', 'Cuidado_Personal_y_Bienestar', 'Salud', 'Variable', '💊', 'chip', ''],
    ['Gym', 'Cuidado_Personal_y_Bienestar', 'Deporte', 'Fijo', '🏋️', 'chip', ''],
    ['Viaje', 'Viajes_Eventos_Otros', 'Viajes', 'Variable', '✈️', 'chip', ''],
    ['Alquiler', 'Vivienda_y_Servicios', 'Alquiler', 'Fijo', '🏠', 'chip', ''],
    ['Servicios de Casa', 'Vivienda_y_Servicios', 'Servicios', 'Fijo', '💡', 'chip', ''],
    ['Subscripciones', 'Vivienda_y_Servicios', 'Suscripciones', 'Fijo', '📺', 'chip', ''],
    ['Celular', 'Vivienda_y_Servicios', 'Internet y Movil', 'Fijo', '📱', 'chip', ''],
    ['Random', 'Viajes_Eventos_Otros', 'Otros', 'Variable', '🎲', 'chip', ''],
    ['IKEA cuotas', 'Vivienda_y_Servicios', 'Muebles IKEA cuotas', 'Fijo', '🪑', 'oculta', ''],
  ].map(([categoria_app, categoria_excel, subcategoria_excel, fijo_o_variable, icono, mostrar, padre], i) =>
    ({ categoria_app, categoria_excel, subcategoria_excel, fijo_o_variable, icono, mostrar, padre, orden: i + 1 })),
  formasPago: ['Santander', 'Revolut', 'Cash', 'Sabadell', 'Monedas'],
  formasPagoPorPersona: {
    Fran: ['Santander', 'Revolut', 'Cash', 'Sabadell', 'Monedas'],
    Cami: ['Santander', 'Sabadell', 'Cash', 'Revolut'],
  },
  reparto: { 'Alquiler': { fran: 1, cami: 0 }, 'Servicios de Casa': { fran: 1, cami: 0 } },
  pctIngresos: {},
  tiposIngreso: ['Sueldo', 'Paro', 'Extra-freelance', 'Reembolso-devolución'],
};

let cfg = LS.get('config', null) || CONFIG_POR_DEFECTO;
let quien = LS.get('quien', null);
let recientes = LS.get('recientes', []); // última lista que vino del servidor

const backend = () => ({ url: LS.get('url', ''), token: LS.get('token', '') });
const configurado = () => !!(backend().url && backend().token);

const catPorNombre = n => cfg.categorias.find(c => c.categoria_app === n);
const iconoDe = m => m.tipo === 'Ingreso' ? '💶' : ((catPorNombre(m.categoria_app) || {}).icono || '•');

function repartoDefecto(cat, fecha) {
  if (cfg.reparto && cfg.reparto[cat]) return cfg.reparto[cat];
  const pct = cfg.pctIngresos || {};
  const key = String(fecha || hoyStr()).slice(0, 7);
  if (pct[key]) return pct[key];
  const keys = Object.keys(pct).sort();
  const previas = keys.filter(k => k <= key);
  const k = previas.length ? previas[previas.length - 1] : keys[keys.length - 1];
  return k ? pct[k] : { fran: 0.6, cami: 0.4 };
}

/** Formas de pago del perfil, en su orden (tab Config: orden_fran / orden_cami). */
function formasDe(p) {
  const pp = cfg.formasPagoPorPersona || CONFIG_POR_DEFECTO.formasPagoPorPersona;
  return (pp[p] && pp[p].length ? pp[p] : cfg.formasPago) || [];
}

/* ---------- Cuotas ---------- */
const CUOTAS_MIN = 2, CUOTAS_MAX = 48;

/** Reparte el total en n cuotas en céntimos exactos; el resto de céntimos va a la primera. */
function dividirCuotas(total, n) {
  const cent = Math.round(total * 100);
  const base = Math.floor(cent / n);
  const out = Array(n).fill(base);
  out[0] += cent - base * n;
  return out.map(c => c / 100);
}
function sumarDias(fechaStr, dias) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}
const esCuota = m => /-c\d+$/.test(String(m.id || ''));
const grupoCuota = m => String(m.id).replace(/-c\d+$/, '');

/* ============================ API ============================ */

async function api(action, data = {}) {
  const { url, token } = backend();
  if (!url || !token) throw new Error('Falta configurar URL y token (Ajustes)');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // sin preflight CORS
      body: JSON.stringify(Object.assign({ token, action }, data)),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Error del servidor');
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

async function cargarConfig() {
  const data = await api('bootstrap');
  cfg = data;
  LS.set('config', cfg);
  renderFormEstatico();
  pintarForm();
  return data;
}

/* ============================ Formulario ============================ */

let f; // estado del formulario

function nuevoForm(tipo = 'Gasto') {
  const formas = formasDe(quien);
  const recordada = LS.get('forma.' + (quien || 'x'), null);
  const forma = formas.includes(recordada) ? recordada : (formas[0] || '');
  f = {
    id: null, creado_en: null, cargado_por: null,
    tipo,
    importe: '',
    forma_pago: forma,
    personal_o_compartido: LS.get('pc.' + (quien || 'x'), 'Personal'),
    pagado_por: quien || 'Fran',
    pct_fran: 60, repartoManual: false,
    categoria_app: '',
    fijo_o_variable: 'Variable',
    cuotas: 3,
    detalle: '',
    fecha: hoyStr(),
    tipo_ingreso: (cfg.tiposIngreso || [])[0] || 'Sueldo',
  };
  recalcularReparto();
}

function recalcularReparto() {
  if (f.repartoManual) return;
  const r = repartoDefecto(f.categoria_app, f.fecha);
  f.pct_fran = Math.round((r.fran || 0) * 100);
}

function categoriaPadre(nombre) {
  const c = catPorNombre(nombre);
  return c && c.mostrar === 'sub' ? c.padre : nombre;
}

function renderFormEstatico() {
  $('#cats').innerHTML = cfg.categorias.filter(c => c.mostrar === 'chip').map(c =>
    `<button type="button" class="cat" data-v="${esc(c.categoria_app)}"><span class="ico">${esc(c.icono)}</span><span class="txt">${esc(c.categoria_app)}</span></button>`).join('');
  $('#tiposIngreso').innerHTML = (cfg.tiposIngreso || []).map(n =>
    `<button type="button" class="chip" data-v="${esc(n)}">${esc(n)}</button>`).join('');
}

function marcar(contenedor, valor) {
  contenedor.querySelectorAll('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === valor));
}

function pintarForm() {
  const ingreso = f.tipo === 'Ingreso';
  document.body.classList.toggle('modo-ingreso', ingreso);
  marcar($('#segTipo'), f.tipo);
  $('.solo-gasto').hidden = ingreso;
  $('.solo-ingreso').hidden = !ingreso;
  $('#importe').value = f.importe;
  // Formas de pago del perfil (+ la del movimiento que se edita, si es de otra persona)
  const formas = formasDe(quien).slice();
  if (f.forma_pago && !formas.includes(f.forma_pago)) formas.push(f.forma_pago);
  $('#formas').style.setProperty('--n', Math.min(Math.max(formas.length, 1), 5));
  $('#formas').classList.toggle('muchas', formas.length >= 5);
  $('#formas').innerHTML = formas.map(n =>
    `<button type="button" class="chip" data-v="${esc(n)}">${esc(n)}</button>`).join('');
  marcar($('#formas'), f.forma_pago);
  marcar($('#segPC'), f.personal_o_compartido);
  marcar($('#segFV'), f.fijo_o_variable);
  // Cuotas: solo al crear; al editar un gasto normal no se ofrece
  $('#segFV [data-v="Cuotas"]').hidden = !!f.id && f.fijo_o_variable !== 'Cuotas';
  pintarCuotas();
  const comp = f.personal_o_compartido === 'Compartido';
  $('#compartidoBox').hidden = !comp;
  if (!comp) $('#repartoEdit').hidden = true;
  marcar($('#segPagado'), f.pagado_por);
  $('#repartoBtn').textContent = `F ${f.pct_fran}% · C ${100 - f.pct_fran}%`;
  $('#rango').value = f.pct_fran;
  $('#rFran').textContent = f.pct_fran;
  $('#rCami').textContent = 100 - f.pct_fran;

  const padre = categoriaPadre(f.categoria_app);
  marcar($('#cats'), padre);
  const subs = cfg.categorias.filter(c => c.mostrar === 'sub' && c.padre === padre);
  $('#subcats').hidden = !subs.length;
  $('#subcats').innerHTML = subs.map(s =>
    `<button type="button" class="chip${s.categoria_app === f.categoria_app ? ' on' : ''}" data-v="${esc(s.categoria_app)}">${esc(s.icono)} ${esc(s.categoria_app)}</button>`).join('');

  marcar($('#tiposIngreso'), f.tipo_ingreso);
  marcar($('#segRecibe'), f.pagado_por);
  $('#detalle').value = f.detalle;
  $('#detalle').placeholder = ingreso ? 'Detalle (opcional)' : 'Detalle (opcional)';
  $('#fecha').value = f.fecha;
  $('#editando').hidden = !f.id;
  $('#guardar').textContent = f.id ? 'Guardar cambios'
    : (f.tipo === 'Gasto' && f.fijo_o_variable === 'Cuotas' ? `Guardar ${f.cuotas} cuotas` : 'Guardar');
  pintarPerfil();
  sugerencias();
}

function pintarCuotas() {
  const activo = f.tipo === 'Gasto' && f.fijo_o_variable === 'Cuotas' && !f.id;
  $('#cuotasBox').hidden = !activo;
  if (!activo) return;
  $('#cuotasN').textContent = f.cuotas;
  const total = parseImporte(f.importe);
  if (!(total > 0)) { $('#cuotasResumen').textContent = 'Pon el precio total arriba'; return; }
  const partes = dividirCuotas(total, f.cuotas);
  const ultima = sumarDias(f.fecha, 30 * (f.cuotas - 1));
  const iguales = partes.every(p => p === partes[partes.length - 1]);
  $('#cuotasResumen').textContent = `${f.cuotas} × ${fmtEUR(partes[partes.length - 1])}${iguales ? '' : ' (1ª ' + fmtEUR(partes[0]) + ')'} · cada 30 días hasta el ${fmtCorta(ultima)}/${ultima.slice(2, 4)}`;
  if (!f.id) $('#guardar').textContent = `Guardar ${f.cuotas} cuotas`;
}

function pintarPerfil() {
  const p = $('#perfil');
  p.textContent = quien ? quien[0] : '?';
  p.classList.toggle('cami', quien === 'Cami');
  p.setAttribute('aria-label', 'Perfil: ' + (quien || 'sin elegir') + ' (toca para cambiar)');
}

function cambiarPerfil(p) {
  quien = p;
  LS.set('quien', quien);
  marcar($('#segQuien'), quien);
  if (!f.id) { nuevoForm(f.tipo); }
  pintarForm();
  if (vistaActual === 'movs') renderMovs();
  if (vistaActual === 'resumen') cargarResumen();
  toast('Perfil de ' + quien);
}

async function sugerencias() {
  const cola = await DB.all().catch(() => []);
  const vistos = new Set();
  const opts = [];
  [...cola, ...recientes]
    .filter(m => m.tipo === f.tipo && (f.tipo === 'Ingreso' || m.categoria_app === f.categoria_app) && m.detalle)
    .sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en)))
    .forEach(m => {
      const d = String(m.detalle).trim();
      if (d && !vistos.has(d.toLowerCase()) && opts.length < 8) { vistos.add(d.toLowerCase()); opts.push(d); }
    });
  $('#sugerencias').innerHTML = opts.map(d => `<option value="${esc(d)}"></option>`).join('');
}

function enlazarForm() {
  const seg = (sel, fn) => $(sel).addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    fn(b.dataset.v);
    pintarForm();
  });

  seg('#segTipo', v => {
    if (f.tipo === v) return;
    const importe = f.importe;
    const editId = f.id;
    if (editId) return; // no se cambia el tipo de un movimiento ya creado
    nuevoForm(v);
    f.importe = importe;
    if (v === 'Ingreso') f.pagado_por = quien || 'Fran';
  });
  seg('#formas', v => { f.forma_pago = v; });
  seg('#segPC', v => {
    f.personal_o_compartido = v;
    if (v === 'Personal' && !f.id) f.pagado_por = quien || 'Fran';
    recalcularReparto();
  });
  seg('#segFV', v => { f.fijo_o_variable = v; });
  seg('#segPagado', v => { f.pagado_por = v; });
  seg('#segRecibe', v => { f.pagado_por = v; });
  seg('#tiposIngreso', v => { f.tipo_ingreso = v; });
  const elegirCat = v => {
    f.categoria_app = v;
    const c = catPorNombre(v);
    if (c && f.fijo_o_variable !== 'Cuotas') f.fijo_o_variable = c.fijo_o_variable || 'Variable';
    recalcularReparto();
  };
  seg('#cats', v => {
    // tocar de nuevo el padre cuando hay una sub elegida → vuelve al padre
    elegirCat(v);
  });
  seg('#subcats', v => elegirCat(f.categoria_app === v ? categoriaPadre(v) : v));

  const moverCuotas = d => {
    f.cuotas = Math.min(CUOTAS_MAX, Math.max(CUOTAS_MIN, (f.cuotas || 3) + d));
    pintarCuotas();
  };
  $('#cuotasMenos').addEventListener('click', () => moverCuotas(-1));
  $('#cuotasMas').addEventListener('click', () => moverCuotas(1));

  $('#repartoBtn').addEventListener('click', () => { $('#repartoEdit').hidden = !$('#repartoEdit').hidden; });
  $('#rango').addEventListener('input', e => {
    f.pct_fran = Number(e.target.value);
    f.repartoManual = true;
    $('#rFran').textContent = f.pct_fran;
    $('#rCami').textContent = 100 - f.pct_fran;
    $('#repartoBtn').textContent = `F ${f.pct_fran}% · C ${100 - f.pct_fran}%`;
  });

  $('#importe').addEventListener('input', e => {
    // solo dígitos y un separador decimal
    let v = e.target.value.replace(/[^\d.,]/g, '');
    const i = v.search(/[.,]/);
    if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/[.,]/g, '').slice(0, 2);
    e.target.value = v;
    f.importe = v;
    pintarCuotas();
  });
  $('#importe').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
  $('#detalle').addEventListener('input', e => { f.detalle = e.target.value; });
  $('#detalle').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
  $('#fecha').addEventListener('change', e => {
    f.fecha = e.target.value || hoyStr();
    recalcularReparto();
    pintarForm();
  });
  $('#cancelarEdicion').addEventListener('click', () => { nuevoForm(); pintarForm(); });
  $('#form').addEventListener('submit', e => { e.preventDefault(); guardar(); });
}

async function guardar() {
  const importe = parseImporte($('#importe').value);
  if (!(importe > 0)) { toast('Pon un importe'); $('#importe').focus(); return; }
  if (f.tipo === 'Gasto' && !f.categoria_app) { toast('Elige una categoría'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) { toast('Fecha inválida'); return; }
  haptic();

  const ahora = new Date().toISOString();
  const gasto = f.tipo === 'Gasto';
  const comp = gasto && f.personal_o_compartido === 'Compartido';
  const mov = {
    id: f.id || uuid(),
    creado_en: f.creado_en || ahora,
    cargado_por: f.cargado_por || quien,
    tipo: f.tipo,
    fecha: f.fecha,
    importe_eur: importe,
    categoria_app: gasto ? f.categoria_app : '',
    detalle: (f.detalle || '').trim(),
    forma_pago: f.forma_pago || '',
    personal_o_compartido: gasto ? f.personal_o_compartido : 'Personal',
    pagado_por: f.pagado_por || quien,
    pct_fran: comp ? f.pct_fran / 100 : '',
    pct_cami: comp ? (100 - f.pct_fran) / 100 : '',
    fijo_o_variable: gasto ? f.fijo_o_variable : '',
    tipo_ingreso: gasto ? '' : f.tipo_ingreso,
    estado: 'activo',
    editado_en: ahora,
    _sync: 'pendiente',
  };
  const eraEdicion = !!f.id;

  // Cuotas: una línea por cuota, la 1ª hoy y cada una 30 días después, ids <grupo>-c1..cN
  let movs = [mov];
  if (gasto && f.fijo_o_variable === 'Cuotas' && !eraEdicion) {
    const n = f.cuotas;
    const partes = dividirCuotas(importe, n);
    const base = mov.detalle || mov.categoria_app;
    movs = partes.map((imp, i) => Object.assign({}, mov, {
      id: mov.id + '-c' + (i + 1),
      fecha: sumarDias(f.fecha, 30 * i),
      importe_eur: imp,
      detalle: `${base} (cuota ${i + 1}/${n})`,
    }));
  }

  try {
    for (const m of movs) await DB.put(m);
  } catch (err) {
    toast('No se pudo guardar en el móvil: ' + err.message, 4000);
    return;
  }
  if (gasto) {
    LS.set('forma.' + quien, mov.forma_pago);
    LS.set('pc.' + quien, mov.personal_o_compartido);
  }

  const btn = $('#guardar');
  btn.classList.add('hecho');
  btn.textContent = '✓ Guardado';
  setTimeout(() => { btn.classList.remove('hecho'); pintarForm(); }, 700);
  toast(movs.length > 1
    ? `${movs.length} cuotas de ${fmtEUR(movs[movs.length - 1].importe_eur)} guardadas`
    : `${gasto ? 'Gasto' : 'Ingreso'} de ${fmtEUR(importe)} guardado`);

  nuevoForm(eraEdicion ? 'Gasto' : f.tipo);
  pintarForm();
  if (eraEdicion) irA('movs');
  else $('#importe').focus();
  actualizarBadge();
  sincronizar();
}

function editar(mov) {
  f = {
    id: mov.id, creado_en: mov.creado_en, cargado_por: mov.cargado_por,
    tipo: mov.tipo,
    importe: String(mov.importe_eur).replace('.', ','),
    forma_pago: mov.forma_pago || '',
    personal_o_compartido: mov.personal_o_compartido || 'Personal',
    pagado_por: mov.pagado_por || quien,
    pct_fran: mov.pct_fran === '' || mov.pct_fran == null ? 60 : Math.round(Number(mov.pct_fran) * 100),
    repartoManual: true,
    categoria_app: mov.categoria_app || '',
    fijo_o_variable: mov.fijo_o_variable || 'Variable',
    cuotas: 3,
    detalle: mov.detalle || '',
    fecha: String(mov.fecha).slice(0, 10),
    tipo_ingreso: mov.tipo_ingreso || 'Sueldo',
  };
  irA('cargar');
  pintarForm();
}

async function borrar(movOLista) {
  const lista = Array.isArray(movOLista) ? movOLista : [movOLista];
  const ahora = new Date().toISOString();
  for (const mov of lista) {
    const borrado = Object.assign({}, mov, { estado: 'borrado', editado_en: ahora, _sync: 'pendiente' });
    delete borrado._error;
    // Siempre se manda al servidor (si nunca llegó, el servidor responde "no existía").
    await DB.put(borrado);
  }
  const ids = new Set(lista.map(m => m.id));
  recientes = recientes.filter(r => !ids.has(r.id));
  LS.set('recientes', recientes);
  toast(lista.length > 1 ? `${lista.length} cuotas borradas` : 'Borrado');
  renderMovs();
  actualizarBadge();
  sincronizar();
}

/* ============================ Sincronización ============================ */

let sincronizando = false;
let repetirSync = false; // se guardó algo mientras sincronizábamos → otra vuelta al terminar

async function sincronizar({ avisar = false } = {}) {
  if (sincronizando) { repetirSync = true; return; }
  if (!configurado()) { actualizarBadge(); if (avisar) toast('Configura URL y token en Ajustes'); return; }
  const cola = await DB.all().catch(() => []);
  if (!cola.length) { actualizarBadge(); if (avisar) toast('Todo sincronizado ✓'); return; }
  sincronizando = true;
  actualizarBadge();
  try {
    const items = cola.map(({ _sync, _error, ...m }) => m);
    const res = await api('sync', { items });
    let errores = 0;
    for (const r of res) {
      const enviado = items.find(m => m.id === r.id);
      const actual = await DB.get(r.id);
      if (!actual || !enviado) continue;
      if (r.ok) {
        // Si se editó mientras sincronizábamos, se queda en cola para el próximo envío
        if (actual.editado_en === enviado.editado_en) await DB.del(r.id);
        recientes = recientes.filter(x => x.id !== r.id);
        if (r.estado !== 'borrado') recientes.unshift(Object.assign({}, enviado, { destino: r.destino, estado: r.estado }));
      } else {
        errores++;
        await DB.put(Object.assign(actual, { _sync: 'error', _error: r.error }));
      }
    }
    recientes = recientes.slice(0, 200);
    LS.set('recientes', recientes);
    if (avisar) toast(errores ? `${errores} con error (ver Movimientos)` : 'Sincronizado ✓');
  } catch (err) {
    if (avisar) toast('Sin conexión con el sheet: ' + err.message, 3500);
  } finally {
    sincronizando = false;
    actualizarBadge();
    if (vistaActual === 'movs') renderMovs();
    if (repetirSync) { repetirSync = false; setTimeout(() => sincronizar(), 50); }
  }
}

async function actualizarBadge() {
  const cola = await DB.all().catch(() => []);
  const b = $('#syncBadge');
  const errores = cola.filter(m => m._sync === 'error').length;
  if (!cola.length) {
    b.hidden = !!configurado();
    b.textContent = 'Sin configurar';
    b.classList.toggle('error', !configurado());
  } else {
    b.hidden = false;
    b.classList.toggle('error', errores > 0);
    b.textContent = sincronizando ? `Sincronizando ${cola.length}…`
      : errores ? `⚠️ ${errores} con error` : `⏳ ${cola.length} pendiente${cola.length > 1 ? 's' : ''}`;
  }
  const e = $('#estadoCola');
  if (e) e.textContent = cola.length ? `${cola.length} movimiento(s) pendiente(s) de sincronizar.` : 'No hay nada pendiente. ✓';
}

/* ============================ Vistas ============================ */

let vistaActual = 'cargar';
const TITULOS = { cargar: 'Cargar', movs: 'Movimientos', resumen: 'Resumen', fijos: 'Fijos', ajustes: 'Ajustes' };

function irA(v) {
  vistaActual = v;
  $$('.vista').forEach(s => s.classList.toggle('activa', s.id === 'v-' + v));
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.vista === v));
  $('#titulo').textContent = TITULOS[v];
  window.scrollTo(0, 0);
  if (v === 'movs') { renderMovs(); refrescarMovs(); }
  if (v === 'resumen') cargarResumen();
  if (v === 'fijos') cargarFijos();
  if (v === 'ajustes') pintarAjustes();
}

/* ---------- Movimientos ---------- */

let movsMostrados = [];

async function renderMovs() {
  const cola = await DB.all().catch(() => []);
  const ids = new Set(cola.map(m => m.id));
  let lista = [...cola, ...recientes.filter(r => !ids.has(r.id))]
    .filter(m => m.estado !== 'borrado');
  if ($('#soloMios').checked) lista = lista.filter(m => m.cargado_por === quien || (m.cargado_por === 'Auto' && m.pagado_por === quien));
  lista.sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en)));
  lista = lista.slice(0, 60);
  movsMostrados = lista;
  $('#movsVacio').hidden = lista.length > 0;
  $('#listaMovs').innerHTML = lista.map((m, i) => {
    const ing = m.tipo === 'Ingreso';
    const titulo = m.detalle || (ing ? m.tipo_ingreso : m.categoria_app);
    const partes = [fmtCorta(m.fecha)];
    if (ing) partes.push('Ingreso · ' + (m.tipo_ingreso || ''), 'para ' + m.pagado_por);
    else partes.push(m.categoria_app, m.personal_o_compartido === 'Compartido' ? 'Compartido · pagó ' + m.pagado_por : 'Personal ' + m.pagado_por);
    partes.push('por ' + m.cargado_por);
    const st = m._sync === 'error' ? `<span class="st err">⚠️ ${esc(m._error || 'error')}</span>`
      : m._sync ? '<span class="st pend">⏳ pendiente</span>' : '<span class="st">✓</span>';
    return `<li data-i="${i}">
      <span class="ico">${esc(iconoDe(m))}</span>
      <div class="main"><div class="l1">${esc(titulo)}</div><div class="l2">${esc(partes.filter(Boolean).join(' · '))}</div></div>
      <div><div class="monto${ing ? ' ing' : ''}">${ing ? '+' : ''}${fmtEUR(m.importe_eur)}</div>${st}</div>
    </li>`;
  }).join('');
}

async function refrescarMovs(avisar) {
  if (!configurado() || !navigator.onLine) return;
  try {
    recientes = await api('list', { limite: 100 });
    LS.set('recientes', recientes);
    renderMovs();
    if (avisar) toast('Actualizado');
  } catch (err) {
    if (avisar) toast('No se pudo actualizar: ' + err.message, 3000);
  }
}

let movSeleccionado = null;

/** Las demás cuotas activas de la misma compra (cola local + lista del servidor). */
async function otrasCuotas(m) {
  const cola = await DB.all().catch(() => []);
  const g = grupoCuota(m);
  const vistos = new Set([m.id]);
  return [...cola, ...recientes].filter(x => {
    if (vistos.has(x.id) || x.estado === 'borrado' || !esCuota(x) || grupoCuota(x) !== g) return false;
    vistos.add(x.id);
    return true;
  });
}
function abrirMov(m) {
  movSeleccionado = m;
  $('#dlgMovTexto').textContent = `${m.detalle || m.categoria_app || m.tipo_ingreso} · ${fmtEUR(m.importe_eur)} · ${fmtCorta(m.fecha)}`;
  $('#dlgMov').showModal();
}

/* ---------- Resumen ---------- */

let mesResumen = hoyStr().slice(0, 7);

function moverMes(delta) {
  const [y, m] = mesResumen.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  mesResumen = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  cargarResumen();
}

async function cargarResumen() {
  const [y, m] = mesResumen.split('-').map(Number);
  const etiqueta = new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  $('#mesLabel').textContent = etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
  const clave = 'resumen.' + mesResumen + '.' + quien;
  const cache = LS.get(clave, null);
  if (cache) pintarResumen(cache, true);
  else $('#resumen').innerHTML = '<p class="vacio">Cargando…</p>';
  try {
    const data = await api('resumen', { mes: mesResumen, usuario: quien });
    LS.set(clave, data);
    if (data.mes === mesResumen) pintarResumen(data, false);
  } catch (err) {
    if (!cache) $('#resumen').innerHTML = `<p class="vacio">No se pudo cargar el resumen.<br>${esc(err.message)}</p>`;
  }
}

function pintarResumen(d, desdeCache) {
  const t = d.totales;
  const barras = filas => {
    if (!filas.length) return '<p class="vacio">Sin gastos ni presupuesto este mes.</p>';
    return '<div class="barras">' + filas.map(r => {
      const pct = r.ppto > 0 ? r.gastado / r.ppto : (r.gastado > 0 ? 1.01 : 0);
      const cls = pct > 1 ? 'over' : pct > 0.85 ? 'warn' : '';
      const ancho = Math.min(100, Math.round(pct * 100));
      return `<div class="row"><div class="top2"><span class="n">${esc(r.icono || '')} ${esc(r.nombre)}</span>
        <span class="m"><b>${fmtEUR(r.gastado)}</b>${r.ppto ? ' / ' + fmtEUR(r.ppto) : ''}</span></div>
        <div class="bar"><i class="${cls}" style="width:${ancho}%"></i></div></div>`;
    }).join('') + '</div>';
  };
  $('#resumen').innerHTML = `
    <div class="totales">
      <div class="tot"><div class="k">Compartidos</div><div class="v">${fmtEUR(t.compartido)}</div><div class="p">de ${fmtEUR(t.compartidoPpto)}</div></div>
      <div class="tot"><div class="k">Personales (${esc(d.usuario)})</div><div class="v">${fmtEUR(t.personal)}</div><div class="p">de ${fmtEUR(t.personalPpto)}</div></div>
      <div class="tot"><div class="k">Ingresos</div><div class="v">${fmtEUR(t.ingresos)}</div><div class="p">tuyos ${fmtEUR(t.ingresosUsuario)}</div></div>
    </div>
    <div class="bloque"><h3>Compartido</h3>${barras(d.compartido)}</div>
    <div class="bloque"><h3>Personal de ${esc(d.usuario)}</h3>${barras(d.personal)}</div>
    ${desdeCache ? '<p class="vacio">Mostrando la última versión guardada…</p>' : ''}`;
}

/* ---------- Fijos ---------- */

async function cargarFijos() {
  const cache = LS.get('fijos', null);
  if (cache) pintarFijos(cache);
  try {
    const data = await api('fijos');
    LS.set('fijos', data);
    pintarFijos(data);
  } catch (err) {
    if (!cache) $('#listaFijos').innerHTML = `<li><span class="main l2">No se pudieron cargar: ${esc(err.message)}</span></li>`;
  }
}

function pintarFijos(lista) {
  $('#listaFijos').innerHTML = lista.map(x => {
    const c = catPorNombre(x.categoria_app);
    return `<li>
      <span class="ico">${esc(c ? c.icono : '🔁')}</span>
      <div class="main"><div class="l1">${esc(x.descripcion)} · ${fmtEUR(x.importe)}</div>
        <div class="l2">${esc(x.categoria_app)} · ${esc(x.personal_o_compartido)} · pagó ${esc(x.pagado_por)} · día ${esc(x.dia_del_mes)}</div></div>
      <label class="switch"><input type="checkbox" data-fila="${x.fila}" ${x.activo ? 'checked' : ''} aria-label="Activo"></label>
    </li>`;
  }).join('') || '<li><span class="main l2">No hay fijos en la tab Fijos.</span></li>';
}

/* ---------- Ajustes ---------- */

function pintarAjustes() {
  marcar($('#segQuien'), quien);
  $('#cfgUrl').value = LS.get('url', '');
  $('#cfgToken').value = LS.get('token', '');
  $('#version').textContent = 'Versión ' + VERSION;
  actualizarBadge();
}

async function probarConexion() {
  $('#cfgEstado').textContent = 'Probando conexión…';
  try {
    await cargarConfig();
    $('#cfgEstado').textContent = 'Conectado ✓ Configuración cargada.';
    sincronizar();
    refrescarMovs();
  } catch (err) {
    $('#cfgEstado').textContent = '❌ ' + err.message;
  }
}

function codigoConfig() {
  return 'GFC1:' + btoa(unescape(encodeURIComponent(JSON.stringify({ u: LS.get('url', ''), t: LS.get('token', '') }))));
}
function leerCodigo(txt) {
  // Tolerante: el prefijo puede llegar en minúsculas (iOS/WhatsApp) y con espacios o saltos de línea
  const limpio = String(txt || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '');
  const m = /GFC1:([A-Za-z0-9+/=_-]+)/i.exec(limpio);
  if (!m) return null;
  let b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  try {
    const c = JSON.parse(decodeURIComponent(escape(atob(b64))));
    return c && c.u && c.t ? c : null;
  } catch (e) { return null; }
}

function enlazarAjustes() {
  $('#segQuien').addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    if (b.dataset.v !== quien) cambiarPerfil(b.dataset.v);
  });
  $('#guardarCfg').addEventListener('click', () => {
    LS.set('url', $('#cfgUrl').value.trim());
    LS.set('token', $('#cfgToken').value.trim());
    probarConexion();
  });
  $('#copiarCodigo').addEventListener('click', async () => {
    if (!configurado()) { toast('Primero configura URL y token'); return; }
    try { await navigator.clipboard.writeText(codigoConfig()); toast('Código copiado. Mándaselo por WhatsApp'); }
    catch (e) { $('#pegarCodigo').value = codigoConfig(); $('#pegarCodigo').select(); toast('Cópialo del recuadro'); }
  });
  const aplicarCodigo = e => {
    const c = leerCodigo(e.target.value);
    if (!c) {
      if (e.type === 'change' && e.target.value.trim()) toast('Ese código no es válido. Cópialo entero de nuevo.', 3500);
      return;
    }
    LS.set('url', c.u); LS.set('token', c.t);
    e.target.value = '';
    pintarAjustes();
    probarConexion();
  };
  $('#pegarCodigo').addEventListener('input', aplicarCodigo);
  $('#pegarCodigo').addEventListener('change', aplicarCodigo);
  $('#forzarSync').addEventListener('click', () => sincronizar({ avisar: true }));
  $('#recargarCfg').addEventListener('click', async () => {
    try { await cargarConfig(); toast('Configuración recargada ✓'); }
    catch (err) { toast('Error: ' + err.message, 3000); }
  });
}

/* ============================ Arranque ============================ */

function enlazarGeneral() {
  $$('.tabs button').forEach(b => b.addEventListener('click', () => irA(b.dataset.vista)));
  $('#syncBadge').addEventListener('click', () => configurado() ? sincronizar({ avisar: true }) : irA('ajustes'));
  $('#soloMios').checked = LS.get('soloMios', false);
  $('#soloMios').addEventListener('change', e => { LS.set('soloMios', e.target.checked); renderMovs(); });
  $('#refrescarMovs').addEventListener('click', () => refrescarMovs(true));
  $('#listaMovs').addEventListener('click', e => {
    const li = e.target.closest('li[data-i]');
    if (li) abrirMov(movsMostrados[Number(li.dataset.i)]);
  });
  $('#dlgCerrar').addEventListener('click', () => $('#dlgMov').close());
  $('#dlgEditar').addEventListener('click', () => { $('#dlgMov').close(); editar(movSeleccionado); });
  $('#dlgBorrar').addEventListener('click', async () => {
    const m = movSeleccionado;
    $('#dlgMov').close();
    if (!confirm(`¿Borrar "${m.detalle || m.categoria_app || m.tipo_ingreso}" de ${fmtEUR(m.importe_eur)}?\nSe elimina también del sheet.`)) return;
    if (esCuota(m)) {
      const otras = await otrasCuotas(m);
      if (otras.length && confirm(`Es parte de una compra en cuotas.\n¿Borrar también las otras ${otras.length} cuotas?`)) {
        borrar([m, ...otras]);
        return;
      }
    }
    borrar(m);
  });
  $('#perfil').addEventListener('click', () => {
    if (!quien) return;
    const otro = quien === 'Fran' ? 'Cami' : 'Fran';
    if (f.id) { toast('Termina o cancela la edición antes de cambiar de perfil'); return; }
    if (confirm(`¿Cambiar al perfil de ${otro}?`)) cambiarPerfil(otro);
  });
  $('#mesPrev').addEventListener('click', () => moverMes(-1));
  $('#mesNext').addEventListener('click', () => moverMes(1));
  $('#listaFijos').addEventListener('change', async e => {
    const inp = e.target.closest('input[data-fila]');
    if (!inp) return;
    inp.disabled = true;
    try {
      const data = await api('fijoToggle', { fila: Number(inp.dataset.fila), activo: inp.checked });
      LS.set('fijos', data);
      pintarFijos(data);
      toast(inp.checked ? 'Fijo activado' : 'Fijo desactivado');
    } catch (err) {
      inp.checked = !inp.checked;
      inp.disabled = false;
      toast('No se pudo cambiar (¿sin conexión?)', 3000);
    }
  });

  window.addEventListener('online', () => sincronizar());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { sincronizar(); if (!f.id && !f.importe) { f.fecha = hoyStr(); pintarForm(); } }
  });
  setInterval(() => { if (navigator.onLine) sincronizar(); }, 60000);
}

function pedirQuien() {
  const dlg = $('#dlgQuien');
  dlg.addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    quien = b.dataset.v;
    LS.set('quien', quien);
    dlg.close();
    nuevoForm();
    pintarForm();
    irA(configurado() ? 'cargar' : 'ajustes');
    if (!configurado()) toast('Ahora pega la URL y el token (o el código de configuración)', 4000);
  });
  dlg.addEventListener('cancel', e => e.preventDefault());
  dlg.showModal();
}

function iniciar() {
  renderFormEstatico();
  nuevoForm();
  enlazarForm();
  enlazarAjustes();
  enlazarGeneral();
  pintarForm();
  actualizarBadge();
  $('#version').textContent = 'Versión ' + VERSION;

  if (!quien) pedirQuien();
  else $('#importe').focus();

  if (configurado() && navigator.onLine) {
    sincronizar();
    cargarConfig().catch(() => { /* seguimos con la config guardada */ });
    refrescarMovs();
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin offline */ });
  }
}

iniciar();
