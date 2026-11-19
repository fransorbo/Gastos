#!/bin/bash
# Ejecuta los .gs contra una simulación de Google Sheets (solo macOS, sin instalar nada).
cd "$(dirname "$0")/.."
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
TMP=$(mktemp -t gastos-tests).js
cat tests/simulador_sheets.js apps-script/Config.gs apps-script/Code.gs apps-script/Movimientos.gs \
    apps-script/Resumen.gs apps-script/Fijos.gs apps-script/Setup.gs apps-script/Tests.gs \
    tests/pruebas_locales.js > "$TMP"
"$JSC" "$TMP"; rc=$?
rm -f "$TMP"; exit $rc
