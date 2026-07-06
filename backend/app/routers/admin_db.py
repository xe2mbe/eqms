from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.auth import get_current_user
from app import models
import json, io, gzip, logging
from datetime import datetime

router = APIRouter()
logger = logging.getLogger("qms")

# Columnas que nunca deben salir en claro en un backup descargable.
_SENSITIVE_COLUMNS = {"password_hash", "irlp_password", "bm_api_key", "irlp_user"}


def require_admin(current_user: models.Usuario = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acceso solo para administradores")
    return current_user


def _tabla_existe(db: Session, table: str) -> bool:
    return db.execute(
        text("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = :n"),
        {"n": table},
    ).fetchone() is not None


def _columnas_de_tabla(db: Session, table: str) -> set:
    rows = db.execute(
        text("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :n"),
        {"n": table},
    ).fetchall()
    return {r[0] for r in rows}


def _serialize_row(row: dict) -> dict:
    """Convert non-JSON-serializable types."""
    out = {}
    for k, v in row.items():
        if hasattr(v, "isoformat"):
            out[k] = v.isoformat()
        elif v is None or isinstance(v, (str, int, float, bool)):
            out[k] = v
        elif isinstance(v, (dict, list)):
            # Columnas JSONB (ya vienen deserializadas como dict/list desde psycopg2):
            # se guardan como texto JSON valido (comillas dobles) para que el INSERT
            # del restore las pueda castear de vuelta a jsonb. str(v) produciria el
            # repr de Python (comillas simples), que Postgres rechaza como JSON invalido.
            out[k] = json.dumps(v)
        else:
            out[k] = str(v)
    return out


# ─── Tables ──────────────────────────────────────────────────────────────────

@router.get("/tables")
def list_tables(db: Session = Depends(get_db), _=Depends(require_admin)):
    result = db.execute(text("""
        SELECT t.table_name,
               (SELECT COUNT(*) FROM information_schema.columns c
                WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS col_count
        FROM information_schema.tables t
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name
    """))
    tables = []
    for row in result:
        name = row[0]
        try:
            cnt = db.execute(text(f'SELECT COUNT(*) FROM "{name}"')).scalar()
        except Exception:
            cnt = 0
        tables.append({"name": name, "columns": row[1], "rows": cnt})
    return tables


@router.get("/tables/{table_name}")
def get_table_data(
    table_name: str,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    # Validate table exists
    exists = db.execute(text("""
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = :n
    """), {"n": table_name}).fetchone()
    if not exists:
        raise HTTPException(404, "Tabla no encontrada")

    offset = (page - 1) * page_size
    total = db.execute(text(f'SELECT COUNT(*) FROM "{table_name}"')).scalar()
    result = db.execute(
        text(f'SELECT * FROM "{table_name}" LIMIT :lim OFFSET :off'),
        {"lim": page_size, "off": offset},
    )
    cols = list(result.keys())
    rows = [_serialize_row(dict(zip(cols, row))) for row in result]
    for row in rows:
        for col in _SENSITIVE_COLUMNS:
            if col in row and row[col] is not None:
                row[col] = "••••••••"

    # Column types
    col_info = db.execute(text("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = :n
        ORDER BY ordinal_position
    """), {"n": table_name}).fetchall()
    col_types = {r[0]: r[1] for r in col_info}

    return {
        "columns": [{"key": c, "type": col_types.get(c, "")} for c in cols],
        "rows": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ─── Backup ───────────────────────────────────────────────────────────────────

@router.get("/backup")
def backup(db: Session = Depends(get_db), _=Depends(require_admin)):
    tables_result = db.execute(text("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """))
    table_names = [r[0] for r in tables_result]

    backup_data: dict = {"_meta": {"created_at": datetime.utcnow().isoformat(), "tables": table_names}}

    for table in table_names:
        result = db.execute(text(f'SELECT * FROM "{table}"'))
        cols = list(result.keys())
        rows = [_serialize_row(dict(zip(cols, row))) for row in result]
        for row in rows:
            for col in _SENSITIVE_COLUMNS:
                if col in row and row[col] is not None:
                    row[col] = None
        backup_data[table] = {"columns": cols, "rows": rows}

    json_bytes = json.dumps(backup_data, ensure_ascii=False, indent=2).encode("utf-8")
    gz_buf = io.BytesIO()
    with gzip.GzipFile(fileobj=gz_buf, mode="wb") as gz:
        gz.write(json_bytes)
    gz_buf.seek(0)

    filename = f"qms_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json.gz"
    return StreamingResponse(
        gz_buf,
        media_type="application/gzip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ─── Restore ──────────────────────────────────────────────────────────────────

@router.post("/restore")
async def restore(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    try:
        raw = await file.read()
        if file.filename and file.filename.endswith(".gz"):
            raw = gzip.decompress(raw)
        backup_data: dict = json.loads(raw.decode("utf-8"))
    except Exception as e:
        logger.error(f"Restore: archivo inválido: {e}")
        raise HTTPException(400, "Archivo inválido o corrupto")

    meta = backup_data.pop("_meta", {})
    tables = list(backup_data.keys())

    # Validar cada tabla y columna contra el catálogo real ANTES de interpolar nada en SQL.
    # Los nombres vienen de un archivo subido por el cliente: no son un identificador de confianza.
    for table in tables:
        if not _tabla_existe(db, table):
            raise HTTPException(400, f"Tabla desconocida en el backup: {table}")
        td = backup_data[table]
        cols = td.get("columns") or []
        columnas_validas = _columnas_de_tabla(db, table)
        cols_desconocidas = set(cols) - columnas_validas
        if cols_desconocidas:
            raise HTTPException(400, f"Columnas desconocidas en tabla {table}: {sorted(cols_desconocidas)}")

    try:
        # Disable FK triggers temporarily
        db.execute(text("SET session_replication_role = 'replica'"))

        # Truncar TODAS las tablas primero, antes de insertar nada. Si se trunca
        # e inserta tabla por tabla, el CASCADE de truncar una tabla "catalogo"
        # (ej. zonas) mas tarde en la lista borra en cadena los datos ya
        # restaurados en tablas que la referencian (ej. reportes.zona_id), sin
        # volver a insertarlos. Con session_replication_role='replica' los
        # triggers de FK estan desactivados, asi que el orden de los INSERT
        # despues no importa.
        for table in tables:
            # Truncate — table ya validada contra information_schema arriba.
            db.execute(text(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE'))

        for table in tables:
            td = backup_data[table]
            cols = td["columns"]
            rows = td["rows"]
            # Re-insert — cols ya validadas contra information_schema arriba; solo los
            # valores (parametrizados) vienen del archivo subido.
            if rows and cols:
                col_list = ", ".join(f'"{c}"' for c in cols)
                placeholders = ", ".join(f":{c}" for c in cols)
                stmt = text(f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders})')
                for row in rows:
                    db.execute(stmt, row)

        db.execute(text("SET session_replication_role = 'replica'"))

        # Truncar TODAS las tablas primero, antes de insertar nada. Si se trunca
        # e inserta tabla por tabla, el CASCADE de truncar una tabla "catalogo"
        # (ej. zonas) mas tarde en la lista borra en cadena los datos ya
        # restaurados en tablas que la referencian (ej. reportes.zona_id), sin
        # volver a insertarlos. Con session_replication_role='replica' los
        # triggers de FK estan desactivados, asi que el orden de los INSERT
        # despues no importa.
        for table in tables:
            # Truncate — table ya validada contra information_schema arriba.
            db.execute(text(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE'))

        for table in tables:
            td = backup_data[table]
            cols = td["columns"]
            rows = td["rows"]
            # Re-insert — cols ya validadas contra information_schema arriba; solo los
            # valores (parametrizados) vienen del archivo subido.
            if rows and cols:
                col_list = ", ".join(f'"{c}"' for c in cols)
                placeholders = ", ".join(f":{c}" for c in cols)
                stmt = text(f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders})')
                for row in rows:
                    db.execute(stmt, row)

        # Insertar con "id" explicito NO avanza la secuencia de auto-incremento
        # de la tabla (nextval() nunca se llama), asi que sin esto la siguiente
        # insercion normal de la app (login -> audit_logs, un nuevo reporte,
        # etc.) colisiona con un id que ya vino del backup restaurado.
        for table in tables:
            seq = db.execute(text("SELECT pg_get_serial_sequence(:t, 'id')"), {"t": table}).scalar()
            if seq:
                db.execute(
                    text(f'SELECT setval(:seq, COALESCE((SELECT MAX(id) FROM "{table}"), 1))'),
                    {"seq": seq},
                )

        db.execute(text("SET session_replication_role = 'origin'"))
        db.commit()
    except Exception as e:
        db.rollback()
        db.execute(text("SET session_replication_role = 'origin'"))
        logger.error(f"Restore: error al restaurar: {e}")
        raise HTTPException(500, "Error al restaurar el backup. Revisa los logs del servidor.")

    return {"ok": True, "tables_restored": len(tables), "backup_date": meta.get("created_at")}


# ─── Parameters ───────────────────────────────────────────────────────────────

EDITABLE_CONTEXTS = {"user", "superuser", "suset"}

@router.get("/params")
def get_params(db: Session = Depends(get_db), _=Depends(require_admin)):
    result = db.execute(text("""
        SELECT name, setting, unit, category, short_desc, context,
               vartype, min_val, max_val, enumvals, boot_val, reset_val
        FROM pg_settings
        ORDER BY category, name
    """))
    cols = list(result.keys())
    rows = []
    for row in result:
        d = dict(zip(cols, row))
        d["editable"] = d["context"] in EDITABLE_CONTEXTS
        if d["enumvals"] is not None:
            d["enumvals"] = list(d["enumvals"])
        rows.append(d)
    return rows


@router.put("/params")
def set_param(
    body: dict,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    name = body.get("name", "").strip()
    value = body.get("value")
    permanent = body.get("permanent", False)

    if not name or value is None:
        raise HTTPException(400, "name y value requeridos")

    # Validate param exists and is editable
    row = db.execute(
        text("SELECT context, vartype FROM pg_settings WHERE name = :n"), {"n": name}
    ).fetchone()
    if not row:
        raise HTTPException(404, "Parámetro no encontrado")
    if row[0] not in EDITABLE_CONTEXTS:
        raise HTTPException(400, f"'{name}' requiere reinicio del servidor para cambiar")

    try:
        if permanent:
            # ALTER SYSTEM persists across restarts
            db.execute(text(f"ALTER SYSTEM SET {name} = :v"), {"v": str(value)})
            db.execute(text("SELECT pg_reload_conf()"))
        else:
            db.execute(text(f"SET {name} = :v"), {"v": str(value)})
        db.commit()
        # Return new value
        new_val = db.execute(
            text("SELECT setting FROM pg_settings WHERE name = :n"), {"n": name}
        ).scalar()
        return {"ok": True, "name": name, "new_value": new_val, "permanent": permanent}
    except Exception as e:
        db.rollback()
        logger.error(f"set_param: error al aplicar '{name}': {e}")
        raise HTTPException(400, "Error al aplicar el parámetro")


@router.post("/params/reset")
def reset_param(
    body: dict,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(400, "name requerido")

    # Validar contra pg_settings (mismo patrón que set_param) antes de interpolar en el SQL.
    row = db.execute(text("SELECT context FROM pg_settings WHERE name = :n"), {"n": name}).fetchone()
    if not row:
        raise HTTPException(404, "Parámetro no encontrado")
    if row[0] not in EDITABLE_CONTEXTS:
        raise HTTPException(400, f"'{name}' requiere reinicio del servidor para cambiar")

    try:
        db.execute(text(f"ALTER SYSTEM RESET {name}"))
        db.execute(text("SELECT pg_reload_conf()"))
        db.commit()
        return {"ok": True}
    except Exception as e:
        db.rollback()
        logger.error(f"reset_param: error al resetear '{name}': {e}")
        raise HTTPException(400, "Error al resetear el parámetro")
