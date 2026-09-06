#!/usr/bin/env python3
"""Regenera las muestras de `/dev` desde UNA sola lectura de producción.

Por qué existe
--------------
Las páginas de `/dev/*` renderizan los componentes reales con datos congelados,
y de ahí salen dos capturas del manual. El problema que lo motivó: **cada muestra
venía de un corte distinto** —24-ago, 25-ago, 1-set— así que dos pantallas del
mismo panel decían **887**, **904** y **882** de la misma cosa, y **9.096** contra
**9.290** contactos.

El QA que recorrió el panel sin conocerlo lo reportó como que el panel se
contradice. En producción **no se contradice**: son 912 en las tres pantallas. Lo
que no cuadraba eran las muestras entre sí — y como el manual se ilustra con
ellas, un lector habría sacado la misma conclusión que el QA.

Este script lee producción **una vez** y reescribe con esa foto todas las
muestras que puede, de modo que las capturas no puedan volver a contradecirse.

La guarda que importa
---------------------
**El script se niega a escribir cualquier cosa que parezca un dato de persona.**
No por una lista de archivos que hay que acordarse de mantener, sino mirando el
contenido: si el JSON trae un campo de nombre o algo con forma de teléfono de 8
dígitos, ese destino se salta y se dice por qué.

Por eso **Leads e Inspecciones no están acá**: sus respuestas traen nombres y
teléfonos de clientes reales. Sus muestras siguen con identidades inventadas y se
mantienen a mano; sus agregados se revisan con `--auditar`.

Uso
---
    python3 herramientas/fixtures.py --auditar      # solo compara, no escribe
    python3 herramientas/fixtures.py                # reescribe
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# (archivo, constante, query de Convex)
#
# Cada constante es el espejo del retorno de esa query, así que la muestra se
# regenera copiando la respuesta tal cual. Las que exigen sesión de admin
# —`admin:getDashboardMetrics`, `financeForm:listFinanceEntries`— no se pueden
# leer desde el CLI y no están acá.
DESTINOS: list[tuple[str, str, str]] = [
    # La portada. `RESUMEN` es lo que más importa: es donde el QA de usuario
    # cero vio «887 revisiones» al lado de las 912 de Canales y concluyó que el
    # panel se contradice. `METRICS` NO está acá — sale de
    # `admin:getDashboardMetrics`, que exige sesión, y además trae nombres de
    # técnicos; su muestra usa identidades inventadas a propósito.
    ("app/dev/admin/preview.tsx", "RESUMEN", "bi/metrics:executiveSummary"),
    ("app/dev/canales/page.tsx", "MUESTRA", "bi/channels:channelRevenue"),
    ("app/dev/operacion/preview.tsx", "DATOS", "bi/operacion:operacion"),
    ("app/dev/calidad/page.tsx", "MUESTRA", "bi/calidad:calidad"),
    ("app/dev/estado/preview.tsx", "SANO", "bi/estadoDatos:estadoDatos"),
    ("app/dev/feriados/preview.tsx", "PANEL", "bi/feriados:feriados"),
    ("app/dev/filtros/preview.tsx", "OPCIONES", "bi/filtros:filterOptions"),
]

# Muestras con identidades inventadas a propósito. No se regeneran; se auditan.
CON_IDENTIDADES = [
    ("app/dev/leads/preview.tsx", "bi/leads:leadsStats", "total"),
    ("app/dev/inspecciones/preview.tsx", "bi/inspecciones:inspecciones", "total"),
]

# Nombres de campo que llevan datos de persona. Si aparecen, no se escribe.
CAMPOS_DE_PERSONA = {
    "name", "clientname", "clientphone", "rawphone", "phone", "phone8",
    "email", "telefono", "tecnico", "technicianname",
}
# `nombre` NO está en la lista de arriba: en Feriados es el nombre del feriado
# («Día de la Madre»), no el de una persona, y meterlo bloqueaba una muestra sana.
# El filtro de teléfonos sigue aplicando a su contenido igual.
# Ocho dígitos seguidos: la forma de un teléfono de Costa Rica.
TELEFONO = re.compile(r"\b\d{8}\b")


def leer(query: str) -> object:
    """Lee una query de PRODUCCIÓN. Solo lectura, nunca mutations."""
    r = subprocess.run(
        ["npx", "convex", "run", "--prod", query, "{}"],
        cwd=RAIZ, capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise RuntimeError(f"{query}: {r.stderr.strip().splitlines()[:2]}")
    return json.loads(r.stdout)


def datos_de_persona(obj: object, ruta: str = "") -> list[str]:
    """Devuelve las rutas donde hay algo que parece un dato de persona."""
    hallados: list[str] = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.lower() in CAMPOS_DE_PERSONA and v not in (None, "", 0):
                hallados.append(f"{ruta}.{k}")
            hallados += datos_de_persona(v, f"{ruta}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj[:50]):
            hallados += datos_de_persona(v, f"{ruta}[{i}]")
    elif isinstance(obj, str) and TELEFONO.search(obj):
        hallados.append(f"{ruta} (parece teléfono)")
    return hallados


def bloque(texto: str, const: str) -> tuple[int, int]:
    """Los límites del literal de esa constante, por conteo de llaves."""
    m = re.search(rf"^const {const}\b[^=]*= ", texto, re.M)
    if not m:
        raise RuntimeError(f"no encontré `const {const}`")
    i = m.end()
    if texto[i] not in "{[":
        raise RuntimeError(f"`{const}` no abre en un literal")
    abre, cierra = texto[i], "}" if texto[i] == "{" else "]"
    prof, j, en_texto, escape = 0, i, False, False
    while j < len(texto):
        c = texto[j]
        if en_texto:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == '"':
                en_texto = False
        elif c == '"':
            en_texto = True
        elif c == abre:
            prof += 1
        elif c == cierra:
            prof -= 1
            if prof == 0:
                return i, j + 1
        j += 1
    raise RuntimeError(f"`{const}` no cierra")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--auditar", action="store_true",
                    help="compara sin escribir")
    args = ap.parse_args()
    hoy = date.today().isoformat()
    escritos, saltados = 0, 0

    print(f"Lectura de producción del {hoy}\n")

    for rel, const, query in DESTINOS:
        ruta = RAIZ / rel
        try:
            datos = leer(query)
        except RuntimeError as e:
            print(f"  ✗ {rel}: {e}")
            saltados += 1
            continue

        fugas = datos_de_persona(datos)
        if fugas:
            print(f"  ⛔ {rel}: NO se escribe — {query} trae datos de persona")
            for f in fugas[:4]:
                print(f"       {f}")
            saltados += 1
            continue

        texto = ruta.read_text(encoding="utf-8")
        try:
            i, j = bloque(texto, const)
        except RuntimeError as e:
            print(f"  ✗ {rel}: {e}")
            saltados += 1
            continue

        nuevo = json.dumps(datos, indent=2, ensure_ascii=False, sort_keys=True)
        if texto[i:j].strip() == nuevo.strip():
            print(f"  = {rel} · {const} — ya estaba al día")
            continue
        if args.auditar:
            print(f"  ~ {rel} · {const} — cambiaría ({len(nuevo)} bytes)")
            continue

        ruta.write_text(texto[:i] + nuevo + texto[j:], encoding="utf-8")
        print(f"  ✓ {rel} · {const} ← {query}")
        escritos += 1

    print("\nMuestras con identidades inventadas — se auditan, no se tocan:")
    for rel, query, campo in CON_IDENTIDADES:
        try:
            v = leer(query)
            print(f"  · {rel}: {query}.{campo} en producción = {v.get(campo)}")
        except (RuntimeError, AttributeError) as e:
            print(f"  · {rel}: no se pudo leer {query} ({e})")

    print(f"\n{escritos} escritas, {saltados} saltadas.")
    print("Después: `pnpm build` y revisar /dev en el build de producción.")
    return 1 if saltados else 0


if __name__ == "__main__":
    sys.exit(main())
