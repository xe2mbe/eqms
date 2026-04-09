from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.auth import get_current_user
from app import models
import json, io, gzip
from datetime import datetime

router = APIRouter()


def require_admin(current_user: models.Usuario = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acceso solo para administradores")
    return current_user


def _serialize_row(row: dict) -> dict:
    """Convert non-JSON-serializable types."""
    out = {}
    for k, v in row.items():
        if hasattr(v, "isoformat"):
            out[k] = v.isoformat()
        elif v is None or isinstance(v, (str, int, float, bool)):
            out[k] = v
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
        raise HTTPException(400, f"Archivo inválido: {e}")

    meta = backup_data.pop("_meta", {})
    tables = list(backup_data.keys())

    try:
        # Disable FK triggers temporarily
        db.execute(text("SET session_replication_role = 'replica'"))

        for table in tables:
            td = backup_data[table]
            cols = td["columns"]
            rows = td["rows"]
            # Truncate
            db.execute(text(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE'))
            # Re-insert
            if rows and cols:
                col_list = ", ".join(f'"{c}"' for c in cols)
                placeholders = ", ".join(f":{c}" for c in cols)
                stmt = text(f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders})')
                for row in rows:
                    db.execute(stmt, row)

        db.execute(text("SET session_replication_role = 'DEFAULT'"))
        db.commit()
    except Exception as e:
        db.rollback()
        db.execute(text("SET session_replication_role = 'DEFAULT'"))
        raise HTTPException(500, f"Error al restaurar: {e}")

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
        raise HTTPException(400, f"Error al aplicar: {e}")


@router.post("/params/reset")
def reset_param(
    body: dict,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(400, "name requerido")
    try:
        db.execute(text(f"ALTER SYSTEM RESET {name}"))
        db.execute(text("SELECT pg_reload_conf()"))
        db.commit()
        return {"ok": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(400, str(e))
