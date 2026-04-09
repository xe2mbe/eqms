"""
Migra radioexperimentadores desde qms.db (SQLite) → PostgreSQL.
Ejecutar desde el contenedor backend:
  docker exec q-backend-1 python -m app.utils.migrate_operadores /data/qms.db
O localmente:
  python -m app.utils.migrate_operadores /ruta/a/qms.db
"""
import sys
import sqlite3
import unicodedata
from app.database import SessionLocal, engine
from app import models


def normalize(text: str) -> str:
    if not text:
        return text
    # Reparar encoding latin1 mal leído
    try:
        fixed = text.encode('latin1').decode('utf-8')
    except Exception:
        fixed = text
    return fixed.strip()


def run(sqlite_path: str):
    # Crear tabla si no existe
    models.Base.metadata.create_all(bind=engine)

    src = sqlite3.connect(sqlite_path)
    src.row_factory = sqlite3.Row
    cur = src.cursor()
    cur.execute("""
        SELECT indicativo, nombre_completo, municipio, estado,
               pais, tipo_licencia, tipo_ham, activo
        FROM radioexperimentadores
        WHERE indicativo IS NOT NULL AND indicativo != ''
    """)
    rows = cur.fetchall()
    src.close()

    db = SessionLocal()
    inserted = 0
    skipped = 0

    try:
        for row in rows:
            indicativo = normalize(row["indicativo"]).upper()
            if not indicativo:
                continue

            exists = db.query(models.Radioexperimentador).filter_by(
                indicativo=indicativo
            ).first()
            if exists:
                skipped += 1
                continue

            op = models.Radioexperimentador(
                indicativo=indicativo,
                nombre_completo=normalize(row["nombre_completo"]),
                municipio=normalize(row["municipio"]),
                estado=normalize(row["estado"]),
                pais=normalize(row["pais"]) or "México",
                tipo_licencia=row["tipo_licencia"],
                tipo_ham=row["tipo_ham"],
                activo=bool(row["activo"]),
            )
            db.add(op)
            inserted += 1

            if inserted % 200 == 0:
                db.commit()
                print(f"  → {inserted} operadores migrados...")

        db.commit()
        print(f"\n✅ Migración completa: {inserted} insertados, {skipped} ya existían.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "qms.db"
    print(f"Migrando desde: {path}")
    run(path)
