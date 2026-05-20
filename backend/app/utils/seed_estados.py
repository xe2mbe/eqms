"""
Pobla la tabla estados con los 32 estados/entidades de México y su zona FMRE.
Zonas actuales: XE1 (Norte), XE2 (Centro-Occidente), XE3 (Sur-Sureste).
El modelo admite hasta XE5 para futuras expansiones.

Ejecutar:
  docker exec q-backend-1 python -m app.utils.seed_estados
"""
from app.database import SessionLocal, engine
from app import models

ESTADOS = [
    # (abreviatura, nombre, zona)
    # ── XE1 · Zona Centro ─────────────────────────────────────────────────────
    ("CDMX", "Ciudad De México",      "XE1"),
    ("JAL",  "Jalisco",               "XE1"),
    ("MEX",  "Estado De México",      "XE1"),
    ("GTO",  "Guanajuato",            "XE1"),
    ("QRO",  "Querétaro",             "XE1"),
    ("HGO",  "Hidalgo",               "XE1"),
    ("MICH", "Michoacán",             "XE1"),
    ("COL",  "Colima",                "XE1"),
    ("MOR",  "Morelos",               "XE1"),
    ("TLAX", "Tlaxcala",              "XE1"),
    # ── XE2 · Zona Norte ──────────────────────────────────────────────────────
    ("BC",   "Baja California",       "XE2"),
    ("BCS",  "Baja California Sur",   "XE2"),
    ("SON",  "Sonora",                "XE2"),
    ("CHI",  "Chihuahua",             "XE2"),
    ("COA",  "Coahuila",              "XE2"),
    ("NL",   "Nuevo León",            "XE2"),
    ("TAM",  "Tamaulipas",            "XE2"),
    ("SIN",  "Sinaloa",               "XE2"),
    ("DGO",  "Durango",               "XE2"),
    ("ZAC",  "Zacatecas",             "XE2"),
    ("SLP",  "San Luis Potosí",       "XE2"),
    ("AGS",  "Aguascalientes",        "XE2"),
    ("NAY",  "Nayarit",               "XE2"),
    # ── XE3 · Zona Sur-Sureste ────────────────────────────────────────────────
    ("VER",  "Veracruz",              "XE3"),
    ("PUE",  "Puebla",                "XE3"),
    ("GRO",  "Guerrero",              "XE3"),
    ("OAX",  "Oaxaca",                "XE3"),
    ("CHIS", "Chiapas",               "XE3"),
    ("TAB",  "Tabasco",               "XE3"),
    ("CAM",  "Campeche",              "XE3"),
    ("YUC",  "Yucatán",               "XE3"),
    ("QROO", "Quintana Roo",          "XE3"),
]


def run():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    inserted = updated = 0
    try:
        for abr, nombre, zona in ESTADOS:
            existing = db.query(models.Estado).filter_by(abreviatura=abr).first()
            if existing:
                existing.nombre = nombre
                existing.zona = zona
                updated += 1
            else:
                db.add(models.Estado(abreviatura=abr, nombre=nombre, zona=zona))
                inserted += 1
        db.commit()
        print(f"✅ Estados: {inserted} insertados, {updated} actualizados.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
