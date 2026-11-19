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
