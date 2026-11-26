// Datos de prueba que imitan la estructura real de los sheets.
const hoy = new Date();
const Y = hoy.getFullYear(), M = hoy.getMonth() + 1;
const d = (y, m, dd) => new Date(y, m - 1, dd, 12);
const H = ['Categoria Principal', 'Subcategoría', 'Detalle', 'Periodo', ' Valor', 'AÑO', 'MES'];

const ambosRows = [H,
  ['Alimentación', 'Supermercado', 'Mercadona', d(Y, M, 2), 50, Y, M],
  ['Vivienda_y_Servicios', 'Alquiler', 'Mes', d(Y, M, 1), 1055, Y, M],
  ['Transporte', 'Uber,etc', 'Bolt', d(Y, M, 3), 7.5, Y, M],
  ['Alimentación', 'Supermercado', 'Carrefour', d(Y, M - 1 || 12, 10), 20, M - 1 ? Y : Y - 1, M - 1 || 12],
];
const camiRows = [['Categoria Principal', 'Subcategoría', 'detalle', 'fecha', ' valor', 'AÑO', 'MES'],
  ['Alimentación', 'Supermercado', 'Agua', d(Y, M, 4), 0.75, Y, M],
];
const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre ', 'Noviembre ', 'Diciembre'];
const fila = (lab, arr) => [lab].concat(arr);
const ingresos = [
  fila(' ', ['2025'].concat(Array(11).fill('')).concat(['2026']).concat(Array(11).fill(''))),
  fila('INGRESOS', Array(24).fill('')),
  fila('Columna 1', meses.concat(meses)),
  fila('CAMI', Array(24).fill(1944)),
  fila('FRAN', Array(24).fill(2900)),
  fila('TOTAL ', Array(24).fill(4844)),
  [],
  fila('', ['PORCENTAJE DE INGRESO DEL TOTAL'].concat(Array(23).fill(''))),
  fila('', meses.concat(meses)),
  fila('CAMI', Array(12).fill(0.5).concat(Array(10).fill(0.4)).concat([0, 0])),
  fila('FRAN', Array(12).fill(0.5).concat(Array(10).fill(0.6)).concat([1, 0])), // nov-26: solo un sueldo cargado
];
const ppto = [['Categoria Principal', 'Subcategoría', 'TIPO', 'PPTO compartido', 'PPTO personal'],
  ['Vivienda_y_Servicios', 'Alquiler', 'Fijo', 1055, ''],
  ['Alimentación', 'Supermercado', 'Variable', 300, 20],
  ['Transporte', 'Uber,etc', 'Variable', 25, 25],
  ['Cuidado_Personal_y_Bienestar', 'Ropa y calzado', 'Variable', '', 100],
];

FAKE[SHEET_COMPARTIDO_ID] = new FakeSS(SHEET_COMPARTIDO_ID, [
  { name: 'Ingresos', rows: ingresos, maxCols: 37 },
  { name: 'Detalle Ambos', rows: ambosRows, maxRows: 8, maxCols: 28 },
  { name: 'Detalle Camila', rows: camiRows, maxRows: 1005, maxCols: 24 },
  { name: 'PPTO', rows: ppto },
]);
// Ambos usa fórmulas en AÑO/MES
const amb = FAKE[SHEET_COMPARTIDO_ID].getSheetByName('Detalle Ambos');
for (let r = 2; r <= 5; r++) { amb.formulas[r + ',6'] = '=YEAR(R[0]C[-2])'; amb.formulas[r + ',7'] = '=MONTH(R[0]C[-3])'; }
FAKE[SHEET_FRAN_ID] = new FakeSS(SHEET_FRAN_ID, [{ name: 'Ahorros ESP', rows: [['x']] }]);

function check(c, m) { if (!c) throw new Error('CHECK: ' + m); print('  ok - ' + m); }

print('== setup()');
setup().forEach(l => print('  ' + l));
print('== setup() otra vez (idempotente)');
setup().forEach(l => print('  ' + l));
const ss = FAKE[SHEET_COMPARTIDO_ID];
check(ss.getSheetByName('Detalle Ambos').getRange(1, 8).getValue() === 'id_app', 'id_app en H de Detalle Ambos');
check(ss.getSheetByName('Detalle Camila').getRange(1, 8).getValue() === 'id_app', 'id_app en H de Detalle Camila');
check(ss.sheets.filter(s => /respaldo/.test(s.name)).length === 2, '2 respaldos (no duplicados)');
check(FAKE[SHEET_FRAN_ID].getSheetByName('Gastos Fran').getRange(1, 8).getValue() === 'id_app', 'Gastos Fran creada con id_app');
const token = _props.APP_TOKEN;
check(!!token, 'token generado');

const parcial = repartoPara_('Supermercado', '2026-11-10');
check(parcial.fran === 0.6 && parcial.cami === 0.4, 'mes con un solo sueldo cargado (100/0) se ignora → usa octubre 60/40');
print('== testTodo()');
_cache.config = null; _cache.pct = null;
testTodo().forEach(l => print('  ' + l));
check(ss.getSheetByName('Detalle Ambos').getLastRow() === 5, 'Detalle Ambos limpio tras tests (5 filas)');
check(ss.getSheetByName('Movimientos').getLastRow() === 1, 'Movimientos limpio tras tests');
check(FAKE[SHEET_FRAN_ID].getSheetByName('Gastos Fran').getLastRow() === 1, 'Gastos Fran limpio tras tests');

print('== doPost');
const post = body => JSON.parse(doPost({ postData: { contents: JSON.stringify(body) } }).s);
check(post({ token: 'malo', action: 'bootstrap' }).ok === false, 'token incorrecto rechazado');
const boot = post({ token, action: 'bootstrap' });
check(boot.ok && boot.data.categorias.length === 31, 'bootstrap devuelve 7 grupos + 24 subcategorías');
check(boot.data.categorias.filter(c => c.mostrar === 'grupo').map(c => c.categoria_app).join(',') === 'Vivienda,Alimentación,Transporte,Cuidado personal,Educación,Ocio,Viajes y otros', 'los 7 grupos en orden');
check(JSON.stringify(boot.data.formasPagoPorPersona.Fran) === '["Santander","Revolut","Cash","Sabadell","Monedas"]', 'formas de pago de Fran en su orden');
check(JSON.stringify(boot.data.formasPagoPorPersona.Cami) === '["Santander","Sabadell","Cash","Revolut"]', 'formas de pago de Cami en su orden, sin Monedas');
// Formato viejo de Config (una sola columna "orden"): ambos ven la misma lista
{
  const cfgSh = ss.getSheetByName('Config');
  cfgSh._set(1, 11, 'orden'); cfgSh._set(1, 12, '');
  _cache.config = null;
  const viejo = leerConfig_();
  check(viejo.formasPagoPorPersona.Cami.length === 5 && viejo.formasPagoPorPersona.Fran[0] === 'Santander', 'Config con formato viejo sigue funcionando');
  cfgSh._set(1, 11, 'orden_fran'); cfgSh._set(1, 12, 'orden_cami');
  _cache.config = null;
}
const key = Y + '-' + String(M).padStart(2, '0');
print('  pctIngresos keys: ' + Object.keys(boot.data.pctIngresos).join(','));

// Llenar Detalle Ambos (maxRows 8) para forzar inserción de filas, y probar fórmulas
const items = [];
for (let i = 0; i < 6; i++) items.push({ id: 'u-' + i, cargado_por: 'Cami', tipo: 'Gasto', fecha: key + '-05', importe_eur: '10,5', categoria_app: i % 2 ? 'Uber/taxi' : 'Supermercado', detalle: 'Test ' + i, forma_pago: 'Cash', personal_o_compartido: 'Compartido', pagado_por: 'Cami', editado_en: '2026-01-01T00:00:0' + i + 'Z' });
const r = post({ token, action: 'sync', items });
check(r.ok && r.data.every(x => x.ok), 'sync de 6 compartidos ok: ' + JSON.stringify(r.data.map(x => x.destino)));
const ambos = ss.getSheetByName('Detalle Ambos');
check(ambos.getLastRow() === 11, 'Detalle Ambos tiene 11 filas con datos');
check(ambos.getMaxRows() > 200, 'se insertaron filas dentro del rango (antes de la primera libre)');
check(ambos.getRange(6, 4).getValue() === key + '-01', 'Periodo (D) = día 1 del mes, no la fecha exacta');
check(ambos.getRange(6, 7).getValue() === M, 'MES calculado por la fórmula copiada');
check(ambos.getRange(6, 3).getValue() === 'Test 0 [Cash]', 'detalle con [forma]');
check(ambos.getRange(6, 5).getValue() === 10.5, 'importe "10,5" → 10.5');
check(ambos.formulas['6,6'] === '=YEAR(R[0]C[-2])', 'AÑO copia la fórmula de la fila de arriba');
const mov = ss.getSheetByName('Movimientos');
const m0 = filaAObjeto_(mov.getRange(2, 1, 1, MOV_COLS.length).getValues()[0]);
check(m0.pct_fran === 0.6 && m0.pct_cami === 0.4, 'reparto por ingresos aplicado (' + m0.pct_fran + '/' + m0.pct_cami + ')');
const alq = post({ token, action: 'sync', items: [{ id: 'alq', cargado_por: 'Fran', tipo: 'Gasto', fecha: key + '-01', importe_eur: 1055, categoria_app: 'Alquiler', personal_o_compartido: 'Compartido', pagado_por: 'Fran' }] });
const ma = filaAObjeto_(mov.getRange(8, 1, 1, MOV_COLS.length).getValues()[0]);
check(ma.pct_fran === 1 && ma.pct_cami === 0 && ma.fijo_o_variable === 'Fijo', 'Alquiler 100% Fran y Fijo');
const manual = post({ token, action: 'sync', items: [{ id: 'man', cargado_por: 'Fran', tipo: 'Gasto', fecha: key + '-01', importe_eur: 20, categoria_app: 'Salidas', personal_o_compartido: 'Compartido', pagado_por: 'Fran', pct_fran: 0.5, pct_cami: 0.5 }] });
check(filaAObjeto_(mov.getRange(9, 1, 1, MOV_COLS.length).getValues()[0]).pct_fran === 0.5, 'reparto manual 50/50 respetado');
const malo = post({ token, action: 'sync', items: [{ id: 'bad', cargado_por: 'Fran', tipo: 'Gasto', fecha: key + '-01', importe_eur: 5, categoria_app: 'Inventada' }] });
check(malo.ok && malo.data[0].ok === false, 'categoría desconocida → error por item, no rompe el lote');
check(filaAObjeto_(mov.getRange(9, 1, 1, MOV_COLS.length).getValues()[0]).categoria_app === 'Food & Drinks', 'alias viejo "Salidas" se guarda como "Food & Drinks"');
{
  const g = post({ token, action: 'sync', items: [{ id: 'grp', cargado_por: 'Fran', tipo: 'Gasto', fecha: key + '-01', importe_eur: 5, categoria_app: 'Vivienda', personal_o_compartido: 'Personal' }] });
  check(g.data[0].ok === false, 'un grupo (Vivienda) no se puede guardar sin subcategoría');
  const ed = post({ token, action: 'sync', items: [{ id: 'edu', cargado_por: 'Fran', tipo: 'Gasto', fecha: key + '-01', importe_eur: 5, categoria_app: 'Educación', personal_o_compartido: 'Personal', estado: 'activo' }] });
  check(ed.data[0].ok, 'subcategoría Educación (mismo nombre que su grupo) se acepta');
  const sv = post({ token, action: 'sync', items: [{ id: 'srv', cargado_por: 'Cami', tipo: 'Gasto', fecha: key + '-01', importe_eur: 60, categoria_app: 'Servicios', personal_o_compartido: 'Compartido', pagado_por: 'Fran' }] });
  const filaSrv = filaAObjeto_(mov.getRange(mov.getLastRow(), 1, 1, MOV_COLS.length).getValues()[0]);
  check(sv.data[0].ok && filaSrv.pct_fran === 1, 'Servicios sigue al 100% Fran');
  post({ token, action: 'sync', items: [{ id: 'edu', estado: 'borrado', editado_en: '2099-01-01T00:00:00Z' }, { id: 'srv', estado: 'borrado', editado_en: '2099-01-01T00:00:00Z' }] });
}

const cu = post({ token, action: 'sync', items: [1, 2, 3].map(i => ({ id: 'cuo-c' + i, cargado_por: 'Fran', tipo: 'Gasto', fecha: key + '-0' + i, importe_eur: 100, categoria_app: 'Hogar', detalle: 'Mesa (cuota ' + i + '/3)', personal_o_compartido: 'Personal', pagado_por: 'Fran', fijo_o_variable: 'Cuotas' })) });
check(cu.data.every(x => x.ok && x.destino.indexOf('Gastos Fran!') === 0), 'cuotas se copian a Gastos Fran');
{
  const ult = filaAObjeto_(mov.getRange(mov.getLastRow(), 1, 1, MOV_COLS.length).getValues()[0]);
  check(ult.fijo_o_variable === 'Cuotas', 'fijo_o_variable = Cuotas se respeta');
}
const lst = post({ token, action: 'list', limite: 50 });
check(lst.ok && lst.data.length === 11, 'list devuelve 11 movimientos');
const res = post({ token, action: 'resumen', mes: key, usuario: 'Cami' });
check(res.ok, 'resumen ok');
const sup = res.data.compartido.find(x => x.nombre === 'Supermercado');
print('  compartido: ' + JSON.stringify(res.data.compartido.map(x => [x.nombre, x.gastado, x.ppto])));
print('  personal: ' + JSON.stringify(res.data.personal.map(x => [x.nombre, x.gastado, x.ppto])));
print('  totales: ' + JSON.stringify(res.data.totales));
check(sup.gastado === 50 + 31.5 && sup.ppto === 300, 'resumen suma Supermercado del mes (incluye filas manuales) vs PPTO');
check(sup.movimientos.length === 4, 'Supermercado trae sus 4 movimientos (1 manual + 3 de la app)');
check(sup.movimientos.filter(x => x.fecha === key + '-05' && x.cargado_por === 'Cami' && x.id).length === 3, 'los de la app traen fecha exacta, quién cargó e id');
check(sup.movimientos.some(x => !x.fecha && !x.id && x.detalle === 'Mercadona' && x.importe === 50), 'la fila manual aparece sin fecha (a mano)');
check(Math.round(sup.movimientos.reduce((s, x) => s + x.importe, 0) * 100) / 100 === sup.gastado, 'los movimientos suman lo gastado');
const fj = post({ token, action: 'fijos' });
check(fj.ok && fj.data.length === 5 && fj.data.every(x => !x.activo), '5 fijos precargados desactivados');
const tg = post({ token, action: 'fijoToggle', fila: 2, activo: true });
check(tg.data[0].activo === true, 'activar fijo');
generarFijos_(new Date(Y, M - 1, 28));
generarFijos_(new Date(Y, M - 1, 28));
check(mov.getRange(2, 1, mov.getLastRow() - 1, 1).getValues().filter(x => x[0] === 'fijo-2-' + key).length === 1, 'fijo de alquiler creado una sola vez');
print('\nTODO OK');
