#!/bin/bash
# Junta todos los .gs en un único archivo para pegarlo en el editor de Apps Script.
cd "$(dirname "$0")/.."
OUT=apps-script-un-archivo/Gastos.gs
mkdir -p apps-script-un-archivo
{
  echo "// ============================================================================"
  echo "// Gastos Fran & Cami — backend completo en UN archivo (generado por tests/combinar.sh)."
  echo "// Pega TODO esto en el editor de Apps Script. El código fuente está en /apps-script."
  echo "// ============================================================================"
  for f in Config Code Movimientos Resumen Fijos Setup Tests; do
    echo; echo "// ----------------------------- $f.gs -----------------------------"; echo
    cat "apps-script/$f.gs"
  done
} > "$OUT"
echo "Generado $OUT ($(wc -l < "$OUT") líneas)"
