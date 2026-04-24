"""
migrate_sqlite.py
-----------------
Migra registros RF y RS del sistema QMS antiguo (SQLite) al nuevo eQMS (PostgreSQL).

Uso (desde dentro del contenedor backend):
    python migrate_sqlite.py --sqlite /tmp/qms.db [--dry-run]

Flujo previo requerido:
    1. Crear los usuarios en eQMS (xe2by, xe2mbj, xe1aqy, xe2mbe, xe2nch)
    2. Copiar el archivo SQLite al contenedor:
           docker cp /var/www/qms/qms.db $(docker compose ps -q backend):/tmp/qms.db
    3. Correr dry-run para verificar:
           docker compose exec backend python migrate_sqlite.py --sqlite /tmp/qms.db --dry-run
    4. Correr la migracion real:
           docker compose exec backend python migrate_sqlite.py --sqlite /tmp/qms.db

Mapeo RF (reportes):
    indicativo      -> indicativo
    nombre          -> operador
    zona            -> zona          (texto libre, sin FK)
    sistema         -> sistema       (texto libre, sin FK)
    ciudad          -> ciudad
    estado          -> estado
    senal           -> senal
    observaciones   -> observaciones
    tipo_reporte    -> tipo_reporte  (texto libre, sin FK)
    fecha_reporte   -> fecha_reporte (sin conversion de TZ)
    qrz_station     -> qrz_station   (texto libre, sin FK)
    qrz_captured_by -> capturado_por (resuelto por username en usuarios)
    evento_id       -> NULL
    pais            -> NULL

Mapeo RS (reportes_rs):
    indicativo      -> indicativo
    operador        -> operador
    zona            -> zona
    estado          -> estado
    ciudad          -> ciudad
    senal           -> senal
    observaciones   -> observaciones
    qrz_station     -> qrz_station
    plataforma_nombre -> plataforma_id (creada/encontrada en plataformas_rs)
    fecha_reporte   -> fecha_reporte
    qrz_captured_by -> capturado_por (resuelto por username en usuarios)
    pais            -> NULL
    tipo_reporte    -> NULL
    evento_id       -> NULL
    url_publicacion -> NULL
"""

import argparse
import re
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

import psycopg2
import psycopg2.extras

DB_CONFIG = {
    "host":     "db",
    "port":     5432,
    "dbname":   "qmsdb",
    "user":     "quser",
    "password": "qpassword",
}

ZONAS_VALIDAS = {"XE1", "XE2", "XE3", "XE4", "XE5", "EXT"}
SOURCE_TAG    = re.compile(r'\[Source:[^\]]*\]', re.IGNORECASE)


def limpiar(valor):
    if not valor or not str(valor).strip():
        return None
    return SOURCE_TAG.sub('', str(valor)).strip() or None


def normalizar_zona(valor):
    if not valor:
        return None
    z = str(valor).strip().upper()
    return z if z in ZONAS_VALIDAS else None


def parsear_fecha(valor):
    if not valor:
        return None
    valor = str(valor).strip()
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f",
                "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y"]:
        try:
            return datetime.strptime(valor, fmt)
        except ValueError:
            continue
    return None


def parsear_senal(valor):
    try:
        return int(float(str(valor)))
    except Exception:
        return 59


# ── Conexion ──────────────────────────────────────────────────────────────────

def conectar_postgres():
    try:
        return psycopg2.connect(**DB_CONFIG)
    except Exception as e:
        print(f"ERROR: No se pudo conectar a PostgreSQL: {e}")
        print("  Asegurate de correr este script dentro del contenedor backend:")
        print("  docker compose exec backend python migrate_sqlite.py --sqlite /tmp/qms.db")
        sys.exit(1)


# ── Resolucion de usuarios ────────────────────────────────────────────────────

def cargar_mapa_usuarios(cur):
    """Devuelve {username: id} para todos los usuarios en eQMS."""
    cur.execute("SELECT username, id FROM usuarios")
    return {row[0]: row[1] for row in cur.fetchall()}


def resolver_usuario(username, mapa, no_encontrados):
    if not username:
        return None
    uid = mapa.get(str(username).strip().lower())
    if uid is None and username not in no_encontrados:
        no_encontrados.add(username)
    return uid


# ── Migracion RF ─────────────────────────────────────────────────────────────

def migrar_rf(src_cur, pg_cur, mapa_usuarios, dry_run, batch_size):
    print("\n[RF] Leyendo reportes del SQLite...")
    src_cur.execute("""
        SELECT indicativo, nombre, zona, sistema, ciudad, estado,
               senal, observaciones, tipo_reporte, fecha_reporte,
               qrz_station, qrz_captured_by
        FROM reportes
        WHERE indicativo IS NOT NULL AND TRIM(indicativo) != ''
        ORDER BY fecha_reporte
    """)
    rows = src_cur.fetchall()

    registros = []
    sin_fecha  = 0
    no_encontrados = set()

    for row in rows:
        indicativo = str(row["indicativo"]).strip().upper()
        fecha = parsear_fecha(row["fecha_reporte"])
        if fecha is None:
            fecha = datetime(2000, 1, 1)
            sin_fecha += 1

        registros.append({
            "indicativo":    indicativo,
            "operador":      limpiar(row["nombre"]),
            "zona":          normalizar_zona(row["zona"]),
            "sistema":       limpiar(row["sistema"]),
            "ciudad":        limpiar(row["ciudad"]),
            "estado":        limpiar(row["estado"]),
            "senal":         parsear_senal(row["senal"]),
            "observaciones": limpiar(row["observaciones"]),
            "tipo_reporte":  limpiar(row["tipo_reporte"]),
            "fecha_reporte": fecha,
            "qrz_station":   str(row["qrz_station"]).strip().upper() if row["qrz_station"] else None,
            "capturado_por": resolver_usuario(row["qrz_captured_by"], mapa_usuarios, no_encontrados),
            "pais":          None,
            "evento_id":     None,
        })

    print(f"  Leidos:           {len(registros):>6,}")
    print(f"  Sin fecha valida: {sin_fecha:>6,}  (se usa 2000-01-01)")
    if no_encontrados:
        print(f"  Usuarios no encontrados en eQMS (capturado_por = NULL): {sorted(no_encontrados)}")

    if dry_run:
        print("  [DRY RUN] No se insertara nada.")
        return len(registros)

    INSERT = """
        INSERT INTO reportes
            (indicativo, operador, zona, sistema, ciudad, estado,
             senal, observaciones, tipo_reporte, fecha_reporte,
             qrz_station, capturado_por, pais, evento_id)
        VALUES
            (%(indicativo)s, %(operador)s, %(zona)s, %(sistema)s,
             %(ciudad)s, %(estado)s, %(senal)s, %(observaciones)s,
             %(tipo_reporte)s, %(fecha_reporte)s, %(qrz_station)s,
             %(capturado_por)s, %(pais)s, %(evento_id)s)
    """

    total = 0
    for i in range(0, len(registros), batch_size):
        psycopg2.extras.execute_batch(pg_cur, INSERT, registros[i:i + batch_size], page_size=batch_size)
        total += len(registros[i:i + batch_size])
        print(f"  RF: {total:,}/{len(registros):,} insertados...", end="\r")
    print(f"  RF: {total:,} registros insertados.          ")
    return total


# ── Migracion RS ─────────────────────────────────────────────────────────────

def resolver_plataformas(src_cur, pg_cur, dry_run):
    """
    Lee las plataformas del SQLite viejo, las crea en plataformas_rs si no existen,
    y devuelve {plataforma_nombre_viejo: nuevo_plataforma_id}.
    """
    src_cur.execute("SELECT id, plataforma, nombre FROM rs WHERE is_active = 1 OR is_active IS NULL")
    plataformas_viejas = src_cur.fetchall()

    mapa = {}
    for pv in plataformas_viejas:
        nombre_completo = f"{pv['plataforma']} - {pv['nombre']}"

        if not dry_run:
            pg_cur.execute("""
                INSERT INTO plataformas_rs (nombre, is_active)
                VALUES (%s, true)
                ON CONFLICT (nombre) DO NOTHING
            """, (nombre_completo,))
            pg_cur.execute("SELECT id FROM plataformas_rs WHERE nombre = %s", (nombre_completo,))
            row = pg_cur.fetchone()
            if row:
                mapa[nombre_completo] = row[0]
                mapa[pv["nombre"]] = row[0]
        else:
            mapa[nombre_completo] = -1
            mapa[pv["nombre"]] = -1

    print(f"  Plataformas en SQLite: {len(plataformas_viejas)}")
    for k, v in mapa.items():
        print(f"    '{k}' -> plataforma_id={v}")
    return mapa


def migrar_rs(src_cur, pg_cur, mapa_usuarios, dry_run, batch_size):
    print("\n[RS] Leyendo reportes_rs del SQLite...")

    mapa_plataformas = resolver_plataformas(src_cur, pg_cur, dry_run)

    src_cur.execute("""
        SELECT indicativo, operador, zona, estado, ciudad, senal,
               observaciones, qrz_station, plataforma_nombre,
               fecha_reporte, qrz_captured_by
        FROM reportes_rs
        WHERE indicativo IS NOT NULL AND TRIM(indicativo) != ''
        ORDER BY fecha_reporte
    """)
    rows = src_cur.fetchall()

    registros      = []
    sin_fecha      = 0
    sin_plataforma = 0
    no_encontrados = set()

    for row in rows:
        indicativo = str(row["indicativo"]).strip().upper()
        fecha = parsear_fecha(row["fecha_reporte"])
        if fecha is None:
            fecha = datetime(2000, 1, 1)
            sin_fecha += 1

        plat_nombre = str(row["plataforma_nombre"]).strip() if row["plataforma_nombre"] else None
        plat_id = mapa_plataformas.get(plat_nombre) if plat_nombre else None
        if plat_id is None:
            sin_plataforma += 1
            continue

        registros.append({
            "indicativo":      indicativo,
            "operador":        limpiar(row["operador"]),
            "zona":            normalizar_zona(row["zona"]),
            "estado":          limpiar(row["estado"]),
            "ciudad":          limpiar(row["ciudad"]),
            "senal":           parsear_senal(row["senal"]),
            "observaciones":   limpiar(row["observaciones"]),
            "qrz_station":     str(row["qrz_station"]).strip().upper() if row["qrz_station"] else None,
            "plataforma_id":   plat_id,
            "fecha_reporte":   fecha,
            "capturado_por":   resolver_usuario(row["qrz_captured_by"], mapa_usuarios, no_encontrados),
            "pais":            None,
            "tipo_reporte":    None,
            "evento_id":       None,
            "url_publicacion": None,
        })

    print(f"  Leidos:              {len(rows):>6,}")
    print(f"  Sin fecha valida:    {sin_fecha:>6,}  (se usa 2000-01-01)")
    print(f"  Sin plataforma map:  {sin_plataforma:>6,}  (omitidos)")
    print(f"  A insertar:          {len(registros):>6,}")
    if no_encontrados:
        print(f"  Usuarios no encontrados en eQMS (capturado_por = NULL): {sorted(no_encontrados)}")

    if dry_run:
        print("  [DRY RUN] No se insertara nada.")
        return len(registros)

    INSERT = """
        INSERT INTO reportes_rs
            (indicativo, operador, zona, estado, ciudad, senal,
             observaciones, qrz_station, plataforma_id, fecha_reporte,
             capturado_por, pais, tipo_reporte, evento_id, url_publicacion)
        VALUES
            (%(indicativo)s, %(operador)s, %(zona)s, %(estado)s,
             %(ciudad)s, %(senal)s, %(observaciones)s, %(qrz_station)s,
             %(plataforma_id)s, %(fecha_reporte)s, %(capturado_por)s,
             %(pais)s, %(tipo_reporte)s, %(evento_id)s, %(url_publicacion)s)
    """

    total = 0
    for i in range(0, len(registros), batch_size):
        psycopg2.extras.execute_batch(pg_cur, INSERT, registros[i:i + batch_size], page_size=batch_size)
        total += len(registros[i:i + batch_size])
        print(f"  RS: {total:,}/{len(registros):,} insertados...", end="\r")
    print(f"  RS: {total:,} registros insertados.          ")
    return total


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Migrar QMS antiguo (SQLite) -> eQMS (PostgreSQL)")
    parser.add_argument("--sqlite",  default="/tmp/qms.db", help="Ruta al qms.db del sistema viejo")
    parser.add_argument("--dry-run", action="store_true",   help="Solo simular, no insertar")
    parser.add_argument("--batch",   type=int, default=200, help="Tamano de lote (default 200)")
    args = parser.parse_args()

    path = Path(args.sqlite)
    if not path.exists():
        print(f"ERROR: No se encontro el archivo: {args.sqlite}")
        sys.exit(1)

    print(f"\n{'='*55}")
    print(f"  Migracion QMS -> eQMS")
    print(f"  Fuente:   {args.sqlite}")
    print(f"  Modo:     {'DRY RUN' if args.dry_run else 'REAL'}")
    print(f"{'='*55}")

    # SQLite
    src = sqlite3.connect(str(path))
    src.row_factory = sqlite3.Row

    # PostgreSQL
    conn = conectar_postgres()
    conn.autocommit = False
    pg_cur = conn.cursor()

    # Verificar que las tablas destino esten vacias
    pg_cur.execute("SELECT COUNT(*) FROM reportes")
    rf_existentes = pg_cur.fetchone()[0]
    pg_cur.execute("SELECT COUNT(*) FROM reportes_rs")
    rs_existentes = pg_cur.fetchone()[0]

    if (rf_existentes > 0 or rs_existentes > 0) and not args.dry_run:
        print(f"\nAVISO: El destino ya tiene datos:")
        print(f"  reportes:    {rf_existentes:,}")
        print(f"  reportes_rs: {rs_existentes:,}")
        confirm = input("Continuar de todas formas? [s/N]: ").strip().lower()
        if confirm != 's':
            print("Cancelado.")
            conn.close()
            src.close()
            sys.exit(0)

    mapa_usuarios = cargar_mapa_usuarios(pg_cur)
    print(f"\nUsuarios en eQMS: {len(mapa_usuarios)} ({', '.join(sorted(mapa_usuarios.keys()))})")

    src_cur = src.cursor()
    src_cur.row_factory = sqlite3.Row

    try:
        rf_total = migrar_rf(src_cur, pg_cur, mapa_usuarios, args.dry_run, args.batch)
        rs_total = migrar_rs(src_cur, pg_cur, mapa_usuarios, args.dry_run, args.batch)

        if not args.dry_run:
            conn.commit()
            print(f"\n{'='*55}")
            print(f"  Migracion completada:")
            print(f"    RF insertados: {rf_total:,}")
            print(f"    RS insertados: {rs_total:,}")
            print(f"{'='*55}")
        else:
            print(f"\n{'='*55}")
            print(f"  DRY RUN completado (nada insertado):")
            print(f"    RF a insertar: {rf_total:,}")
            print(f"    RS a insertar: {rs_total:,}")
            print(f"{'='*55}")

    except Exception as e:
        print(f"\nERROR durante la migracion: {e}")
        conn.rollback()
        conn.close()
        src.close()
        sys.exit(1)

    conn.close()
    src.close()


if __name__ == "__main__":
    main()
