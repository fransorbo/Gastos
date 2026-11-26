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
