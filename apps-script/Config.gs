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
