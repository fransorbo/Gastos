# Gastos Fran & Cami

App para el iPhone que sirve para cargar un gasto o un ingreso en menos de 10 segundos y que escribe directamente en vuestros Google Sheets.

- **La app** (`/app`) es una página web que se instala en la pantalla de inicio del iPhone. Funciona sin conexión: lo que cargas se guarda en el móvil y se envía al sheet cuando vuelve internet.
- **El "backend"** (`/apps-script`) es un script de Google que corre con tu cuenta. Lee y escribe en los dos sheets.
- **No hay nada de pago** ni ningún servidor que mantener.

```
iPhone (app) ──► Apps Script (tu cuenta de Google) ──► Sheet compartido "Finanzas - registro gastos e ingresos."
                                                   └─► Sheet "Cuentas Esp" (tab Gastos Fran)
```

---

## Índice

1. [Qué hace con tus sheets](#1-qué-hace-con-tus-sheets)
2. [Instalar el backend (Apps Script)](#2-instalar-el-backend-apps-script) — una sola vez, unos 15 minutos
3. [Publicar la app en GitHub Pages](#3-publicar-la-app-en-github-pages) — una sola vez, unos 10 minutos
4. [Instalar la app en tu iPhone](#4-instalar-la-app-en-tu-iphone)
5. [Pasársela a Cami](#5-pasársela-a-cami)
6. [Uso diario](#6-uso-diario)
7. [Cambiar cosas sin tocar código (tab Config)](#7-cambiar-cosas-sin-tocar-código-tab-config)
8. [Actualizar la app o el script](#8-actualizar-la-app-o-el-script)
9. [Problemas frecuentes](#9-problemas-frecuentes)
10. [Pruebas](#10-pruebas)
11. [Ingresos: cómo enlazar la tab Ingresos con Movimientos](#11-ingresos-cómo-enlazar-la-tab-ingresos-con-movimientos)

---

## 1. Qué hace con tus sheets

**Sheet compartido** (`Finanzas - registro gastos e ingresos.`):

| Tab | Qué pasa |
|---|---|
| `Movimientos` | **Nueva.** Es el registro maestro y la fuente de verdad: todo lo que entra por la app, gastos e ingresos de los dos. |
| `Config` | **Nueva.** Categorías y su mapeo, formas de pago, excepciones de reparto y parámetros. Se edita a mano (ver sección 7). |
| `Fijos` | **Nueva.** Gastos que se cargan solos cada mes. Viene con 5 ejemplos **desactivados**. |
| `Detalle Ambos` | Los gastos compartidos se copian aquí (columnas A–G). Se añade la columna **`id_app`** en **H**. |
| `Detalle Camila` | Los gastos personales de Cami se copian aquí. Se añade **`id_app`** en **H**. |
| `Detalle Ambos respaldo AAAA-MM-DD` y `Detalle Camila respaldo AAAA-MM-DD` | **Copias de seguridad** que se hacen antes de escribir nada. |
| `Ingresos` | Se lee el % de cada uno. Desde nov-26 sus ingresos se calculan con fórmulas sobre `Movimientos` (ver sección 11). Hay respaldo: `Ingresos respaldo 2026-11-19`. |
| `PPTO`, `map` | **Solo se leen.** De `PPTO` sale el presupuesto. |
| `TD AMBOS`, `TD CAMILA`, `Fran`, `diferencia`, `COMPRAS CONTROL` | No se tocan. |

**Sheet "Cuentas Esp":** solo se crea la tab nueva **`Gastos Fran`**, con las mismas columnas A–G más `id_app`. No se toca ninguna otra tab.

**Cómo se escribe en las tabs Detalle:**
- **A–C:** Categoria Principal y Subcategoría salen del mapeo de `Config`. El detalle lleva la forma de pago entre corchetes, por ejemplo `Mercadona [Revolut]`.
- **D (Periodo):** el **día 1 del mes** del gasto, igual que hacéis ahora (`nov-26`). La fecha exacta queda en `Movimientos`. Así las tablas dinámicas siguen agrupando por mes.
- **E:** el importe.
- **F–G (AÑO y MES):** se copia la fórmula de la fila de arriba (`=YEAR(D…)`, `=MONTH(D…)`).
- **H (`id_app`):** el identificador del movimiento. Sirve para editar o borrar después.
- **Dónde escribe:** en la primera fila vacía real, sin dejar huecos.
- **Cuando la hoja se llena:** si quedan menos de 20 filas libres, inserta 200 filas **dentro** del rango de la tabla dinámica (`TD AMBOS` usa `A1:E1008`), así la tabla las sigue incluyendo.
- **Dos cargas a la vez:** si Fran y Cami guardan al mismo tiempo, una espera a la otra (LockService) y no se pisan.

**Reparto de los gastos compartidos:**
- **Regla general:** el % de ingresos del mes, que se lee de `Ingresos`. Si el mes no tiene datos, usa el último mes que sí tiene. Hoy noviembre y diciembre de 2026 están en 0 %, así que usa octubre: **60 % Fran / 40 % Cami**.
- **Excepciones:** se definen en `Config` → `reparto_categoria`. Vienen cargadas *Alquiler* y *Servicios de Casa* al **100 % Fran**.
- **Cambio puntual:** en cada gasto puedes cambiar el reparto antes de guardar.
- **Qué no hace:** la app no calcula saldos ni "quién debe a quién". Solo guarda `pagado_por`, `pct_fran` y `pct_cami` en `Movimientos`.

---

## 2. Instalar el backend (Apps Script)

> Necesitas permiso de **edición** en los dos sheets con tu cuenta de Google.

### 2.1 Crear el proyecto

1. Abre el **sheet compartido** → menú **Extensiones → Apps Script**.
2. Se abre un editor con un archivo `Código.gs`. Borra todo su contenido.
3. Pega **todo** el contenido de [`apps-script-un-archivo/Gastos.gs`](apps-script-un-archivo/Gastos.gs). Es el backend completo en un solo archivo.
   Si cambias algo en `/apps-script`, vuelve a generarlo con `tests/combinar.sh`.
4. **Manifiesto:** ⚙️ *Configuración del proyecto* → activa **"Mostrar el archivo de manifiesto appsscript.json en el editor"** → vuelve al editor, abre `appsscript.json` y reemplázalo por el de este repo. Ahí se fija la zona horaria Europe/Madrid.
5. Guarda (💾).

> *Opcional, si sabes usar la terminal:* puedes subir los archivos con [clasp](https://github.com/google/clasp). Copia `.clasp.json.example` a `.clasp.json`, pon el ID del script y ejecuta `clasp push`.

### 2.2 Ejecutar el setup (crea tabs, respaldo y token)

1. Arriba, en el desplegable de funciones, elige **`setup`** y pulsa **▶ Ejecutar**.
2. Google te pedirá permisos: **Revisar permisos** → elige tu cuenta → aparecerá **"Google no ha verificado esta aplicación"** → **Configuración avanzada** → **Ir a … (no seguro)** → **Permitir**.
   Es normal: la "aplicación" es tu propio script.
3. Abajo, en el **Registro de ejecución**, verás lo que hizo y una línea como esta:
   `Token NUEVO generado. Cópialo en la app → Ajustes: 3f9a…`
   **Guarda ese token** (por ejemplo en Notas). Es la contraseña de la app. Si lo pierdes, ejecuta `verToken`.
4. Comprueba en el sheet que aparecieron `Movimientos`, `Config`, `Fijos`, las dos tabs de respaldo y `id_app` en la columna H. En **Cuentas Esp** debe aparecer la tab `Gastos Fran`.

> El token se guarda en *Configuración del proyecto → Propiedades de la secuencia de comandos* (`APP_TOKEN`), **no** en el código. Si alguna vez se filtra, ejecuta `regenerarToken` y pon el nuevo en los dos móviles.

### 2.3 Probar que todo funciona

Elige la función **`testTodo`** y pulsa ▶. Tarda alrededor de un minuto. En el registro deben salir 5 líneas con ✅. Las pruebas crean movimientos con el detalle *"PRUEBA APP – se borra sola"* en cada tab destino, los editan, los borran y lo limpian todo al terminar.

### 2.4 Publicar como aplicación web

1. Arriba a la derecha: **Implementar → Nueva implementación**.
2. ⚙️ junto a "Selecciona el tipo" → **Aplicación web**.
3. **Descripción:** `v1`. **Ejecutar como:** **Yo**. **Quién tiene acceso:** **Cualquier usuario**.
4. **Implementar** → copia la **URL de la aplicación web**, que termina en `/exec`.

> "Cualquier usuario" significa que cualquiera con la URL puede **llamar** al script. Sin el token, el script rechaza la petición, y el token no está en el código ni en GitHub.

### 2.5 Gastos fijos automáticos

El `setup` ya instaló un **activador diario** sobre las 7:00 que ejecuta `generarFijosDiario`. Se puede ver en ⏰ *Activadores*.

---

## 3. Publicar la app en GitHub Pages

1. Crea una cuenta en [github.com](https://github.com) si no tienes.
2. Arriba a la derecha: **＋ → New repository**. Nombre: `gastos`. **Public**: GitHub Pages gratis lo necesita, y el repo no tiene nada secreto. **Create repository**.
3. En la página del repo vacío: **"uploading an existing file"**. Arrastra **todo el contenido** de esta carpeta: `app`, `apps-script`, `tests`, `.github`, `README.md`, `.gitignore`.
   Si `.github` no se ve, en el Finder pulsa **Cmd + Shift + .** para mostrar los archivos ocultos.
   Luego **Commit changes**.
4. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. Ve a la pestaña **Actions**. En 1 o 2 minutos aparece "Publicar app en GitHub Pages" en verde ✅. Tu app queda en:
   `https://TU-USUARIO.github.io/gastos/`

---

## 4. Instalar la app en tu iPhone

1. Abre la URL de la app en **Safari**. Tiene que ser Safari, no Chrome.
2. Botón **Compartir** (cuadrado con flecha) → **Añadir a pantalla de inicio** → **Añadir**.
3. **Abre la app desde el icono nuevo.** Importante: la app instalada tiene su propio almacenamiento, separado de Safari. Configúrala **desde el icono**.
4. Te pregunta **"¿Quién eres?"** → **Fran**.
5. Ve a **Ajustes**, pega la **URL** (`…/exec`) y el **token** → **Guardar y probar conexión**. Debe decir *Conectado ✓*.

---

## 5. Pasársela a Cami

1. En **tu** app: **Ajustes → Copiar código de configuración**. Copia un texto que empieza por `GFC1:`.
2. Mándale a Cami por WhatsApp **la URL de la app** y **ese código**.
3. Cami abre la URL en **Safari** → **Compartir → Añadir a pantalla de inicio** → abre la app desde el icono → elige **Cami** → en **Ajustes** pega el código en "…o pega aquí el código". La app se configura y prueba la conexión sola.

> Cami **no** necesita acceso al Apps Script. El script corre con tu cuenta.

---

## 6. Uso diario

**Perfiles:** arriba a la derecha aparece **F** (Fran) o **C** (Cami). Tócalo para cambiar de perfil en ese móvil. Cada perfil tiene sus formas de pago y su orden (ver sección 7). **Pagó** y **Quién lo recibe** vienen marcados con el nombre del perfil.

**Cargar un gasto:** importe → (forma de pago, Personal/Compartido, ya vienen recordados) → **categoría** → **Guardar**.
- **La forma de pago** y **Personal/Compartido** se recuerdan por persona.
- **Fijo/Variable** se propone según la categoría.
- **Cuotas:** elige **Cuotas** junto a Variable/Fijo, pon el **precio total** y ajusta el contador (− / ＋).
  - **Qué se genera:** una línea por cuota. La 1ª con la fecha del gasto y cada una de las siguientes 30 días después.
  - **Ejemplo:** una mesa de 300 € en 3 cuotas da 3 líneas de 100 €. Si no divide exacto, los céntimos de más van a la 1ª.
  - **Cómo se ven en el sheet:** el detalle queda como "Mesa (cuota 2/3)" y `fijo_o_variable` como `Cuotas`. Cada cuota cae en el mes de su fecha en las tabs Detalle.
  - **Borrar:** al borrar una cuota, la app pregunta si borrar también las demás.
- **En un gasto compartido** eliges quién pagó. El reparto se rellena solo; tócalo (`F 60% · C 40%`) para cambiarlo en ese gasto.
- **Categoría en dos pasos:** primero tocas una de las 7 categorías (Vivienda, Alimentación, Transporte, Cuidado personal, Educación, Ocio, Viajes y otros) y después su **subcategoría**, que es la que se guarda. Si la categoría tiene una sola subcategoría (Educación), se elige sola.
- **El detalle** sugiere los últimos que usaste en esa categoría.
- **Un gasto personal** va a `Detalle Camila` o a `Gastos Fran` según quién eres en ese móvil.

**Cargar un ingreso:** pestaña **Ingreso** → importe → tipo (Sueldo / Paro / Extra-freelance / Reembolso-devolución) → quién lo recibe → cuenta → Guardar. Los ingresos **solo** van a `Movimientos` (ver sección 11).

**Sin conexión:** guarda igual. Arriba aparece **⏳ N pendientes**. Se envían solos al recuperar internet o al abrir la app; también puedes tocar el aviso. Si algo falla, sale **⚠️** y el motivo en *Movimientos*.

**Movimientos:** los últimos movimientos de los dos, con el filtro *Solo míos*. Toca uno para **Editar** o **Borrar**.
- **Editar** actualiza `Movimientos` y la fila copiada. Si cambias de Personal a Compartido, la mueve de tab.
- **Borrar** marca `estado = borrado` en `Movimientos` y **elimina** la fila de la tab destino.

**Resumen:** gastado en el mes por categoría vs `PPTO`. Muestra lo compartido y tu personal por separado, más los totales del mes. Se cambia de mes con ‹ y ›. Lee las tabs Detalle, así que incluye también lo que cargues a mano en el sheet.

**Fijos:** activa o desactiva los gastos fijos. Para cambiar importes, días u otros datos, edita la tab **Fijos** del sheet. **Antes de activar**, revisa los importes y quién paga. Los 5 de ejemplo están como *Compartido, pagó Fran*.
- **Cuándo se crean:** a partir del `dia_del_mes`, una vez por mes y por fijo, con `cargado_por = Auto` e id `fijo-<fila>-<AAAA-MM>`.
- **Si borras uno desde la app:** ese mes no se vuelve a crear.
- **Fijos nuevos:** añádelos **al final** de la tab Fijos. No insertes filas en medio, porque el id usa el número de fila.

---

## 7. Cambiar cosas sin tocar código (tab Config)

| Columnas | Para qué |
|---|---|
| **A–H** `categoria_app …` | Categorías en dos niveles. Filas con `mostrar = grupo`: los 7 botones grandes (`categoria_app` es el nombre corto que se ve y `categoria_excel` el nombre completo). Filas con `mostrar = sub`: las subcategorías; `padre` es el nombre corto de su grupo y `categoria_app` es lo que se guarda. `oculta`: existe pero no se muestra. `orden` define la posición. |
| **J–L** `forma_pago`, `orden_fran`, `orden_cami` | Botones de forma de pago **por perfil**, en ese orden. Si una persona tiene la celda vacía, no ve esa forma de pago (hoy Cami no ve *Monedas*). |
| **M–O** `reparto_categoria`, `pct_fran`, `pct_cami` | Excepciones al reparto por ingresos. **Borra las filas** cuando Alquiler y Servicios dejen de ser 100 % Fran. |
| **Q–R** `clave`, `valor` | `tipos_ingreso` (separados por comas) y `reparto_defecto_fran`, que se usa solo si `Ingresos` no tiene ningún dato. |

Después de cambiar `Config`, en la app ve a **Ajustes → Recargar configuración**. La app también la recarga sola cada vez que se abre con internet.

**Añadir una subcategoría nueva** (por ejemplo *Mascotas* dentro de Vivienda): añade una fila con `Mascotas | Vivienda_y_Servicios | Mascotas | Variable | 18 | 🐶 | sub | Vivienda`. La pareja Categoria Principal + Subcategoría debe existir en `PPTO`/`map` para que aparezca en el resumen.

---

## 8. Actualizar la app o el script

- **App:** sube los archivos cambiados al repo (*Add file → Upload files*). Para que los iPhone descarguen la versión nueva, cambia `VERSION` en `app/sw.js` (por ejemplo `gfc-v1.0.1`). Los móviles la toman la **segunda** vez que abren la app.
- **Script:** pega los cambios en el editor y luego **Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión → Implementar**. Así la **URL no cambia** y no hay que tocar los móviles. Si haces "Nueva implementación", la URL cambia.

---

## 9. Problemas frecuentes

| Síntoma | Solución |
|---|---|
| *Token incorrecto* | Revisa el token en Ajustes. `verToken` en el editor lo muestra. |
| *No existe la tab "…". ¿Ejecutaste setup()?* | Ejecuta `setup`. Es seguro repetirlo: no duplica nada. |
| *Categoría desconocida* | La categoría se borró o renombró en `Config`. Edita el movimiento y elige otra. |
| La app no se actualiza | Ciérrala del todo (desliza hacia arriba) y ábrela dos veces. ¿Cambiaste `VERSION` en `sw.js`? |
| El teclado no aparece solo al abrir | iOS no permite abrir el teclado sin tocar la pantalla. Toca el importe. |
| No vibra | La vibración funciona en iOS 18 o superior. En versiones anteriores solo ves el botón en verde y un aviso. |
| Ajustes vacíos tras instalar | Configúrala **desde el icono**, no en Safari (ver sección 4). |
| Un gasto aparece dos veces en el sheet | No debería pasar: cada id es único. Si pasa, mira la columna `id_app` y avísame. |

---

## 10. Pruebas

- **En Google:** `testTodo` (sección 2.3). Hace altas, ediciones y borrados en las 3 tabs destino; cambia un gasto de tab; prueba ingresos, idempotencia (el mismo id dos veces y que una versión vieja no pise una nueva), una cola offline simulada con reintento, fijos sin duplicar y el reparto. Todo se limpia al final.
- **En el Mac, sin Google** (para desarrollo): `tests/correr.sh` ejecuta el mismo código contra una simulación de Google Sheets.
- **La app sin backend real:** `python3 tests/servidor_simulado.py app 8765` → abre `http://localhost:8765`, con URL `http://localhost:8765/exec` y token `tok123`.

---

## 11. Ingresos: cómo enlazar la tab Ingresos con Movimientos

**Hecho el 19-11-2026, desde noviembre 2026.**
- **Respaldo:** antes de tocar nada se duplicó la tab como `Ingresos respaldo 2026-11-19`.
- **Qué celdas cambiaron:** solo **AJ4:AK5** (CAMI/FRAN de noviembre y diciembre 2026), que estaban vacías. Ahora tienen fórmulas.
- **Qué se dejó igual:** hasta octubre 2026 siguen los valores escritos a mano. TOTAL (fila 6) y los % (filas 10–11) ya eran fórmulas y se recalculan solas.
- **Tab Movimientos:** se creó ya, con sus encabezados, porque las fórmulas la necesitan. `setup()` la detecta y comprueba que los encabezados coincidan.

La fórmula de cada celda (ejemplo: FRAN, noviembre 2026, `AJ5`) suma los ingresos **activos** de esa persona en ese mes:

```
=SUMIFS(Movimientos!$F:$F;Movimientos!$D:$D;"Ingreso";Movimientos!$S:$S;"activo";Movimientos!$M:$M;$A5;Movimientos!$E:$E;">="&DATE(2026;11;1);Movimientos!$E:$E;"<"&DATE(2026;12;1))
```

Cuenta **todos** los tipos de ingreso: sueldo, paro, extra y reembolso. Para contar solo sueldos, añade `;Movimientos!$Q:$Q;"Sueldo"` antes del último paréntesis.

**Importante, para que el reparto sea correcto:** cargad en la app **los dos sueldos de cada mes** como *Ingreso*.
- Mientras falte uno, la matriz mostrará por ejemplo 100 % / 0 %.
- La app **no usa** ese mes: solo toma en cuenta los meses donde los dos tienen ingresos. Si no, usa el último mes completo; hoy es octubre, con 60/40.
- El reparto se guarda en cada gasto en el momento de cargarlo. Un gasto compartido cargado antes de que estén los dos sueldos se queda con el reparto del último mes completo. Puedes editarlo después.

**Para 2027:** cuando añadas las columnas de 2027 a la derecha (año en la fila 1, meses en la fila 3), copia las fórmulas de AJ4:AK5 y cambia las fechas de `DATE(…)`. También copia las de TOTAL y %. La app detecta sola las columnas nuevas.
