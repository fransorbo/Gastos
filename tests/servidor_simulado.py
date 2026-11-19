"""Servidor local para probar la PWA sin Google: sirve /app y simula el backend en POST /exec.
Uso: python3 tests/servidor_simulado.py app 8765  → abre http://localhost:8765 (URL backend: http://localhost:8765/exec, token: tok123)
POST /offline/on y /offline/off simulan quedarse sin conexión."""
import json, sys, os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial

APP_DIR = sys.argv[1]
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765
TOKEN = 'tok123'
STATE = {'movs': {}, 'offline': False, 'fijos': [
    {'fila': 2, 'activo': False, 'descripcion': 'Alquiler', 'importe': 1055, 'categoria_app': 'Alquiler', 'personal_o_compartido': 'Compartido', 'pagado_por': 'Fran', 'forma_pago': 'Santander', 'dia_del_mes': 1},
    {'fila': 3, 'activo': False, 'descripcion': 'Gym', 'importe': 60, 'categoria_app': 'Gym', 'personal_o_compartido': 'Compartido', 'pagado_por': 'Fran', 'forma_pago': 'Santander', 'dia_del_mes': 1},
]}

CATS = [
    ('Supermercado', 'Alimentación', 'Supermercado', 'Variable', '🛒', 'chip', ''), ('Comida', 'Alimentación', 'Delivery', 'Variable', '🍔', 'chip', ''),
    ('Salidas', 'Ocio_y_Entretenimiento', 'Food & Drinks', 'Variable', '🍻', 'chip', ''), ('Transporte', 'Transporte', 'Transporte público', 'Variable', '🚇', 'chip', ''),
    ('Uber/taxi', 'Transporte', 'Uber,etc', 'Variable', '🚕', 'sub', 'Transporte'), ('Ropa', 'Cuidado_Personal_y_Bienestar', 'Ropa y calzado', 'Variable', '👕', 'chip', ''),
    ('Hogar', 'Vivienda_y_Servicios', 'Hogar compras y mantenimiento', 'Variable', '🛋️', 'chip', ''), ('Salud', 'Cuidado_Personal_y_Bienestar', 'Salud', 'Variable', '💊', 'chip', ''),
    ('Gym', 'Cuidado_Personal_y_Bienestar', 'Deporte', 'Fijo', '🏋️', 'chip', ''), ('Viaje', 'Viajes_Eventos_Otros', 'Viajes', 'Variable', '✈️', 'chip', ''),
    ('Alquiler', 'Vivienda_y_Servicios', 'Alquiler', 'Fijo', '🏠', 'chip', ''), ('Servicios de Casa', 'Vivienda_y_Servicios', 'Servicios', 'Fijo', '💡', 'chip', ''),
    ('Subscripciones', 'Vivienda_y_Servicios', 'Suscripciones', 'Fijo', '📺', 'chip', ''), ('Celular', 'Vivienda_y_Servicios', 'Internet y Movil', 'Fijo', '📱', 'chip', ''),
    ('Random', 'Viajes_Eventos_Otros', 'Otros', 'Variable', '🎲', 'chip', ''), ('IKEA cuotas', 'Vivienda_y_Servicios', 'Muebles IKEA cuotas', 'Fijo', '🪑', 'oculta', ''),
]

class H(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        if self.path.startswith('/offline/'):
            STATE['offline'] = self.path.endswith('on'); return self._send({'ok': True})
        if STATE['offline']:
            self.send_response(503); self.end_headers(); return
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])) or b'{}')
        if body.get('token') != TOKEN: return self._send({'ok': False, 'error': 'Token incorrecto'})
        a = body.get('action')
        if a == 'bootstrap':
            return self._send({'ok': True, 'data': {
                'categorias': [dict(categoria_app=c[0], categoria_excel=c[1], subcategoria_excel=c[2], fijo_o_variable=c[3], icono=c[4], mostrar=c[5], padre=c[6], orden=i) for i, c in enumerate(CATS)],
                'formasPago': ['Cash', 'Santander', 'Revolut', 'Sabadell'],
                'reparto': {'Alquiler': {'fran': 1, 'cami': 0}, 'Servicios de Casa': {'fran': 1, 'cami': 0}},
                'pctIngresos': {'2026-10': {'fran': 0.6, 'cami': 0.4}},
                'tiposIngreso': ['Sueldo', 'Paro', 'Extra-freelance', 'Reembolso-devolución']}})
        if a == 'sync':
            out = []
            for it in body['items']:
                prev = STATE['movs'].get(it['id'])
                if it.get('estado') == 'borrado':
                    if prev: prev['estado'] = 'borrado'
                    out.append({'id': it['id'], 'ok': True, 'estado': 'borrado', 'destino': ''}); continue
                if it['tipo'] == 'Gasto' and not it.get('categoria_app'):
                    out.append({'id': it['id'], 'ok': False, 'error': 'Categoría desconocida'}); continue
                it['estado'] = 'activo'
                dest = '' if it['tipo'] == 'Ingreso' else ('Detalle Ambos!700' if it['personal_o_compartido'] == 'Compartido' else ('Detalle Camila!800' if it['pagado_por'] == 'Cami' else 'Gastos Fran!2'))
                it['destino'] = dest
                STATE['movs'][it['id']] = it
                out.append({'id': it['id'], 'ok': True, 'estado': 'activo', 'destino': dest})
            return self._send({'ok': True, 'data': out})
        if a == 'list':
            l = [m for m in STATE['movs'].values() if m.get('estado') != 'borrado']
            l.sort(key=lambda m: m['creado_en'], reverse=True)
            return self._send({'ok': True, 'data': l})
        if a == 'resumen':
            return self._send({'ok': True, 'data': {'mes': body['mes'], 'usuario': body['usuario'],
                'compartido': [{'nombre': 'Alquiler', 'icono': '🏠', 'gastado': 1055, 'ppto': 1055}, {'nombre': 'Supermercado', 'icono': '🛒', 'gastado': 280, 'ppto': 300}, {'nombre': 'Salidas', 'icono': '🍻', 'gastado': 95, 'ppto': 70}, {'nombre': 'Viaje', 'icono': '✈️', 'gastado': 0, 'ppto': 250}],
                'personal': [{'nombre': 'Ropa', 'icono': '👕', 'gastado': 45, 'ppto': 100}],
                'totales': {'compartido': 1430, 'compartidoPpto': 1675, 'personal': 45, 'personalPpto': 100, 'ingresos': 4844, 'ingresosUsuario': 2900}}})
        if a == 'fijos': return self._send({'ok': True, 'data': STATE['fijos']})
        if a == 'fijoToggle':
            for f in STATE['fijos']:
                if f['fila'] == body['fila']: f['activo'] = body['activo']
            return self._send({'ok': True, 'data': STATE['fijos']})
        return self._send({'ok': False, 'error': 'accion'})
    def do_GET(self):
        if self.path.startswith('/state'): return self._send(STATE)
        return super().do_GET()
    def _send(self, obj):
        b = json.dumps(obj).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)

ThreadingHTTPServer(('127.0.0.1', PORT), partial(H, directory=APP_DIR)).serve_forever()
