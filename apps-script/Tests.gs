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
