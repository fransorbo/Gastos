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
const CONFIG_CATEGORIAS_INICIALES = [
  ['Supermercado', 'Alimentación', 'Supermercado', 'Variable', 1, '🛒', 'chip', ''],
  ['Comida', 'Alimentación', 'Delivery', 'Variable', 2, '🍔', 'chip', ''],
  ['Salidas', 'Ocio_y_Entretenimiento', 'Food & Drinks', 'Variable', 3, '🍻', 'chip', ''],
  ['Transporte', 'Transporte', 'Transporte público', 'Variable', 4, '🚇', 'chip', ''],
  ['Uber/taxi', 'Transporte', 'Uber,etc', 'Variable', 5, '🚕', 'sub', 'Transporte'],
  ['Ropa', 'Cuidado_Personal_y_Bienestar', 'Ropa y calzado', 'Variable', 6, '👕', 'chip', ''],
  ['Hogar', 'Vivienda_y_Servicios', 'Hogar compras y mantenimiento', 'Variable', 7, '🛋️', 'chip', ''],
  ['Salud', 'Cuidado_Personal_y_Bienestar', 'Salud', 'Variable', 8, '💊', 'chip', ''],
  ['Gym', 'Cuidado_Personal_y_Bienestar', 'Deporte', 'Fijo', 9, '🏋️', 'chip', ''],
  ['Viaje', 'Viajes_Eventos_Otros', 'Viajes', 'Variable', 10, '✈️', 'chip', ''],
  ['Alquiler', 'Vivienda_y_Servicios', 'Alquiler', 'Fijo', 11, '🏠', 'chip', ''],
  ['Servicios de Casa', 'Vivienda_y_Servicios', 'Servicios', 'Fijo', 12, '💡', 'chip', ''],
  ['Subscripciones', 'Vivienda_y_Servicios', 'Suscripciones', 'Fijo', 13, '📺', 'chip', ''],
  ['Celular', 'Vivienda_y_Servicios', 'Internet y Movil', 'Fijo', 14, '📱', 'chip', ''],
  ['Random', 'Viajes_Eventos_Otros', 'Otros', 'Variable', 15, '🎲', 'chip', ''],
  ['IKEA cuotas', 'Vivienda_y_Servicios', 'Muebles IKEA cuotas', 'Fijo', 16, '🪑', 'oculta', ''],
];

const CONFIG_FORMAS_PAGO_INICIALES = [
  ['Cash', 1], ['Santander', 2], ['Revolut', 3], ['Sabadell', 4],
];

// categoria_app, pct_fran, pct_cami  (excepciones a la regla "según ingresos")
const CONFIG_REPARTO_INICIAL = [
  ['Alquiler', 1, 0],
  ['Servicios de Casa', 1, 0],
];

const CONFIG_PARAMETROS_INICIALES = [
  ['tipos_ingreso', 'Sueldo,Paro,Extra-freelance,Reembolso-devolución'],
  ['reparto_defecto_fran', 0.6],
  ['nota', 'Si cambias algo aquí, en la app ve a Ajustes → Recargar configuración'],
];

// activo, descripcion, importe, categoria_app, personal_o_compartido, pagado_por, forma_pago, dia_del_mes
const FIJOS_INICIALES = [
  [false, 'Alquiler', 1055, 'Alquiler', 'Compartido', 'Fran', 'Santander', 1],
  [false, 'Muebles IKEA cuotas', 140, 'IKEA cuotas', 'Compartido', 'Fran', 'Santander', 5],
  [false, 'Internet y Móvil', 25, 'Celular', 'Compartido', 'Fran', 'Santander', 5],
  [false, 'Suscripciones', 24, 'Subscripciones', 'Compartido', 'Fran', 'Revolut', 5],
  [false, 'Gym', 60, 'Gym', 'Compartido', 'Fran', 'Santander', 1],
];
