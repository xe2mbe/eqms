"""
migrate_catalogos.py
--------------------
Migra catalogos (zonas, sistemas, eventos, estaciones) desde los datos del repo
local, y radioexperimentadores desde el SQLite del QMS viejo.

Ejecutar dentro del contenedor backend:
    python migrate_catalogos.py [--dry-run] [--sqlite /tmp/qms.db]
    python migrate_catalogos.py --schema-only   # inspeccionar esquema SQLite
"""
import argparse
import sqlite3
import sys
from pathlib import Path

import psycopg2

DB_CONFIG = {
    "host":     "db",
    "port":     5432,
    "dbname":   "qmsdb",
    "user":     "quser",
    "password": "qpassword",
}

SQLITE_PATH = "/tmp/qms.db"

# ── Datos del repo local ──────────────────────────────────────────────────────

ZONAS = [
    ("XE1",        "Zona 1 - Centro",      "#1677ff"),
    ("XE2",        "Zona 2 - Norte",       "#52c41a"),
    ("XE3",        "Zona 3 - Sur-Sureste", "#fa8c16"),
    ("Extranjero", "Extranjero",           "#8c8c8c"),
]

SISTEMAS = [
    ("HF",       "HF - Onda Corta",                     "#1677ff"),
    ("DMR",      "DMR - Digital Mobile Radio",           "#722ed1"),
    ("DSTAR",    "D-Star",                               "#13c2c2"),
    ("FUSION",   "Yaesu System Fusion",                  "#eb2f96"),
    ("IRLP",     "IRLP - Internet Radio Linking Project","#fa8c16"),
    ("P25",      "P25 - APCO Project 25",                "#faad14"),
    ("M17",      "M17 Project",                          "#2f54eb"),
    ("ECHOLINK", "EchoLink",                             "#52c41a"),
]

EVENTOS = [
    ("Boletin Semanal",   "Boletin dominical de la FMRE",                              "#1677ff", True),
    ("Practica RNE",      "Practica de la Red Nacional de Emergencias",                "#52c41a", True),
    ("Retransmision 40m", "Retransmision en banda de 40 metros",                       "#fa8c16", True),
    ("Retransmision 80m", "Retransmision en banda de 80 metros",                       "#722ed1", True),
    ("Actividad Digital", "Actividad en sistemas digitales (DMR, D-Star, Fusion, etc.)","#eb2f96", True),
]

ESTACIONES = [
    ("XE1LM",   "Federacion Mexicana de Radioexperimentadores A.C.", "#1677ff"),
    ("XE1FMRE", "Estacion de red FMRE",                              "#52c41a"),
]


# ── Catalogos ─────────────────────────────────────────────────────────────────

def migrar_catalogos(cur, dry_run):
    for codigo, nombre, color in ZONAS:
        if not dry_run:
            cur.execute(
                "INSERT INTO zonas (codigo, nombre, color, is_active)"
                " VALUES (%s,%s,%s,true) ON CONFLICT (codigo) DO NOTHING",
                (codigo, nombre, color),
            )
    print(f"  Zonas:     {len(ZONAS)}")

    for codigo, nombre, color in SISTEMAS:
        if not dry_run:
            cur.execute(
                "INSERT INTO sistemas (codigo, nombre, color, is_active)"
                " VALUES (%s,%s,%s,true) ON CONFLICT (codigo) DO NOTHING",
                (codigo, nombre, color),
            )
    print(f"  Sistemas:  {len(SISTEMAS)}")

    for tipo, desc, color, activo in EVENTOS:
        if not dry_run:
            cur.execute(
                "INSERT INTO eventos (tipo, descripcion, color, is_active)"
                " VALUES (%s,%s,%s,%s) ON CONFLICT (tipo) DO NOTHING",
                (tipo, desc, color, activo),
            )
    print(f"  Eventos:   {len(EVENTOS)}")

    for qrz, desc, color in ESTACIONES:
        if not dry_run:
            cur.execute(
                "INSERT INTO estaciones (qrz, descripcion, color, is_active)"
                " VALUES (%s,%s,%s,true) ON CONFLICT (qrz) DO NOTHING",
                (qrz, desc, color),
            )
    print(f"  Estaciones:{len(ESTACIONES)}")


# ── Radioexperimentadores ─────────────────────────────────────────────────────

def explorar_sqlite(path):
    con = sqlite3.connect(path)
    cur = con.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [r[0] for r in cur.fetchall()]
    print(f"\n  Tablas en {path}: {tables}")
    for t in tables:
        cur.execute(f"PRAGMA table_info({t})")
        cols = [r[1] for r in cur.fetchall()]
        print(f"    {t}: {cols}")
    con.close()
    return tables


def migrar_radioexperimentadores(src_path, pg_cur, dry_run):
    if not Path(src_path).exists():
        print(f"  AVISO: {src_path} no encontrado, omitiendo radioexperimentadores.")
        return 0

    con = sqlite3.connect(src_path)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [r[0] for r in cur.fetchall()]

    target = None
    for candidate in ("radioexperimentadores", "experimentadores", "ham_operators", "operadores"):
        if candidate in tables:
            target = candidate
            break

    if not target:
        print(f"  AVISO: No se encontro tabla de radioexperimentadores. Tablas: {tables}")
        con.close()
        return 0

    cur.execute(f"PRAGMA table_info({target})")
    cols = {r[1] for r in cur.fetchall()}
    print(f"  Tabla '{target}': {sorted(cols)}")

    def pick(options):
        return next((c for c in options if c in cols), None)

    col_map = {
        "indicativo":      pick(("indicativo", "callsign", "indicativo_llamada")),
        "nombre_completo": pick(("nombre", "nombre_completo", "full_name", "nombre_operador")),
        "municipio":       pick(("municipio", "ciudad", "city")),
        "estado":          pick(("estado", "state")),
        "pais":            pick(("pais", "country", "pais_origen")),
        "tipo_licencia":   pick(("tipo_licencia", "licencia", "clase", "license_type")),
        "tipo_ham":        pick(("tipo_ham", "tipo", "clase_ham", "category")),
        "activo":          pick(("activo", "is_active", "active")),
    }
    print(f"  Mapeo: {col_map}")

    ind_col = col_map["indicativo"]
    if not ind_col:
        print("  ERROR: columna 'indicativo' no encontrada.")
        con.close()
        return 0

    cur.execute(
        f"SELECT * FROM {target}"
        f" WHERE {ind_col} IS NOT NULL AND TRIM({ind_col}) != ''"
    )
    rows = cur.fetchall()
    print(f"  Registros: {len(rows)}")

    if dry_run:
        con.close()
        return len(rows)

    INSERT = """
        INSERT INTO radioexperimentadores
            (indicativo, nombre_completo, municipio, estado, pais,
             tipo_licencia, tipo_ham, activo)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (indicativo) DO NOTHING
    """

    def get(row, key):
        c = col_map.get(key)
        if not c:
            return None
        v = row[c]
        return str(v).strip() or None if v is not None else None

    total = 0
    for row in rows:
        indicativo = str(row[ind_col]).strip().upper()
        pais = get(row, "pais") or "Mexico"
        raw_activo = get(row, "activo")
        if raw_activo is not None:
            activo = bool(int(raw_activo)) if raw_activo.lstrip("-").isdigit() else (raw_activo.lower() in ("1", "true", "si", "yes"))
        else:
            activo = True
        pg_cur.execute(INSERT, (
            indicativo,
            get(row, "nombre_completo"),
            get(row, "municipio"),
            get(row, "estado"),
            pais,
            get(row, "tipo_licencia"),
            get(row, "tipo_ham"),
            activo,
        ))
        total += 1

    con.close()
    return total


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Migrar catalogos y radioexperimentadores a eQMS")
    parser.add_argument("--dry-run",     action="store_true", help="Solo simular, no insertar")
    parser.add_argument("--sqlite",      default=SQLITE_PATH, help="Ruta al qms.db del sistema viejo")
    parser.add_argument("--schema-only", action="store_true", help="Solo mostrar esquema SQLite y salir")
    args = parser.parse_args()

    if args.schema_only:
        explorar_sqlite(args.sqlite)
        return

    print(f"\n{'='*55}")
    print(f"  Migracion de Catalogos eQMS")
    print(f"  Modo: {'DRY RUN' if args.dry_run else 'REAL'}")
    print(f"{'='*55}")

    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        print("\n[Catalogos del repo]")
        migrar_catalogos(cur, args.dry_run)

        print("\n[Radioexperimentadores del QMS viejo]")
        total_rx = migrar_radioexperimentadores(args.sqlite, cur, args.dry_run)

        if not args.dry_run:
            conn.commit()

        print(f"\n{'='*55}")
        if args.dry_run:
            print(f"  DRY RUN completado (nada insertado)")
        else:
            print(f"  Completado exitosamente")
        print(f"  Radioexperimentadores: {total_rx}")
        print(f"{'='*55}\n")

    except Exception as e:
        print(f"\nERROR: {e}")
        conn.rollback()
        conn.close()
        sys.exit(1)

    conn.close()


if __name__ == "__main__":
    main()
