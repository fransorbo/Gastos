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
