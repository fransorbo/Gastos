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
  rec.fijo_o_variable = it.fijo_o_variable === 'Fijo' || it.fijo_o_variable === 'Variable'
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
