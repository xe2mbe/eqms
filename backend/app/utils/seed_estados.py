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
    # ── XE1 · Zona Norte ───────────────────────────────────────────────────────
    ("BC",   "Baja California",       "XE1"),
    ("BCS",  "Baja California Sur",   "XE1"),
    ("SON",  "Sonora",                "XE1"),
    ("CHI",  "Chihuahua",             "XE1"),
    ("COA",  "Coahuila",              "XE1"),
    ("NL",   "Nuevo León",            "XE1"),
    ("TAM",  "Tamaulipas",            "XE1"),
    ("SIN",  "Sinaloa",               "XE1"),
    ("DGO",  "Durango",               "XE1"),
    ("ZAC",  "Zacatecas",             "XE1"),
    ("SLP",  "San Luis Potosí",       "XE1"),
    ("AGS",  "Aguascalientes",        "XE1"),
    ("NAY",  "Nayarit",               "XE1"),
    # ── XE2 · Zona Centro-Occidente ───────────────────────────────────────────
    ("CDMX", "Ciudad de México",      "XE2"),
    ("JAL",  "Jalisco",               "XE2"),
    ("MEX",  "Estado de México",      "XE2"),
    ("GTO",  "Guanajuato",            "XE2"),
    ("QRO",  "Querétaro",             "XE2"),
    ("HGO",  "Hidalgo",               "XE2"),
    ("MICH", "Michoacán",             "XE2"),
    ("COL",  "Colima",                "XE2"),
    ("MOR",  "Morelos",               "XE2"),
    ("TLAX", "Tlaxcala",              "XE2"),
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
