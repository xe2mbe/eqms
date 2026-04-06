"""
Script de seed: pobla la base de datos con catálogos iniciales y usuario admin.
Ejecutar: python -m app.utils.seed
"""
from app.database import SessionLocal
from app import models
from app.auth import hash_password


ZONAS = [
    ("XE1", "Zona 1 – Centro"),
    ("XE2", "Zona 2 – Norte"),
    ("XE3", "Zona 3 – Sur-Sureste"),
    ("Extranjero", "Extranjero"),
]

SISTEMAS = [
    ("HF", "HF – Onda Corta"),
    ("DMR", "DMR – Digital Mobile Radio"),
    ("DSTAR", "D-Star"),
    ("FUSION", "Yaesu System Fusion"),
    ("IRLP", "IRLP – Internet Radio Linking Project"),
    ("P25", "P25 – APCO Project 25"),
    ("M17", "M17 Project"),
    ("ECHOLINK", "EchoLink"),
]

ESTADOS = [
    ("AGS", "Aguascalientes", "21.8853", "-102.2916"),
    ("BC", "Baja California", "30.8406", "-115.2838"),
    ("BCS", "Baja California Sur", "24.1426", "-110.3128"),
    ("CAMP", "Campeche", "19.8301", "-90.5349"),
    ("CHIS", "Chiapas", "16.7520", "-93.1167"),
    ("CHIH", "Chihuahua", "28.6320", "-106.0691"),
    ("CDMX", "Ciudad de México", "19.4326", "-99.1332"),
    ("COAH", "Coahuila", "27.0587", "-101.7068"),
    ("COL", "Colima", "19.1223", "-104.0072"),
    ("DGO", "Durango", "24.0277", "-104.6532"),
    ("GTO", "Guanajuato", "21.0190", "-101.2574"),
    ("GRO", "Guerrero", "17.4392", "-99.5451"),
    ("HGO", "Hidalgo", "20.1011", "-98.7624"),
    ("JAL", "Jalisco", "20.6597", "-103.3496"),
    ("MEX", "Estado de México", "19.2832", "-99.6557"),
    ("MICH", "Michoacán", "19.5665", "-101.7068"),
    ("MOR", "Morelos", "18.6813", "-99.1013"),
    ("NAY", "Nayarit", "21.7514", "-104.8455"),
    ("NL", "Nuevo León", "25.5922", "-99.9962"),
    ("OAX", "Oaxaca", "17.0732", "-96.7266"),
    ("PUE", "Puebla", "19.0413", "-98.2062"),
    ("QRO", "Querétaro", "20.5888", "-100.3899"),
    ("QROO", "Quintana Roo", "19.1817", "-88.4791"),
    ("SLP", "San Luis Potosí", "22.1565", "-100.9855"),
    ("SIN", "Sinaloa", "24.8091", "-107.3940"),
    ("SON", "Sonora", "29.0729", "-110.9559"),
    ("TAB", "Tabasco", "17.8409", "-92.6189"),
    ("TAMPS", "Tamaulipas", "24.2669", "-98.8363"),
    ("TLAX", "Tlaxcala", "19.3182", "-98.2374"),
    ("VER", "Veracruz", "19.1738", "-96.1342"),
    ("YUC", "Yucatán", "20.7099", "-89.0943"),
    ("ZAC", "Zacatecas", "22.7709", "-102.5833"),
    ("EXT", "Extranjero", "21.0", "-89.0"),
]

EVENTOS = [
    ("Boletín Semanal", "Boletín dominical de la FMRE"),
    ("Práctica RNE", "Práctica de la Red Nacional de Emergencias"),
    ("Retransmisión 40m", "Retransmisión en banda de 40 metros"),
    ("Retransmisión 80m", "Retransmisión en banda de 80 metros"),
    ("Actividad Digital", "Actividad en sistemas digitales (DMR, D-Star, Fusion, etc.)"),
]

ESTACIONES = [
    ("XE1LM", "Federación Mexicana de Radioexperimentadores A.C."),
    ("XE1FMRE", "Estación de red FMRE"),
]

PLATAFORMAS_RS = [
    ("Facebook", "Página oficial de Facebook"),
    ("Twitter / X", "Cuenta oficial de Twitter/X"),
    ("Instagram", "Cuenta oficial de Instagram"),
    ("YouTube", "Canal oficial de YouTube"),
    ("Telegram", "Canal de Telegram"),
]


def run_seed():
    db = SessionLocal()
    try:
        # Admin
        admin = db.query(models.Usuario).filter(models.Usuario.username == "admin").first()
        if not admin:
            admin = models.Usuario(
                username="admin",
                password_hash=hash_password("Cambiar@123"),
                full_name="Administrador del Sistema",
                role="admin",
                must_change_password=True,
            )
            db.add(admin)
            print("✓ Usuario admin creado (contraseña: Cambiar@123 — cámbiala al primer login)")

        # Zonas
        for codigo, nombre in ZONAS:
            if not db.query(models.Zona).filter_by(codigo=codigo).first():
                db.add(models.Zona(codigo=codigo, nombre=nombre))
        print("✓ Zonas")

        # Sistemas
        for codigo, nombre in SISTEMAS:
            if not db.query(models.Sistema).filter_by(codigo=codigo).first():
                db.add(models.Sistema(codigo=codigo, nombre=nombre))
        print("✓ Sistemas")

        # Estados
        for abr, nombre, lat, lng in ESTADOS:
            if not db.query(models.Estado).filter_by(abreviatura=abr).first():
                db.add(models.Estado(abreviatura=abr, nombre=nombre, lat=lat, lng=lng))
        print("✓ Estados")

        # Eventos
        for tipo, desc in EVENTOS:
            if not db.query(models.Evento).filter_by(tipo=tipo).first():
                db.add(models.Evento(tipo=tipo, descripcion=desc))
        print("✓ Eventos")

        # Estaciones
        for qrz, desc in ESTACIONES:
            if not db.query(models.Estacion).filter_by(qrz=qrz).first():
                db.add(models.Estacion(qrz=qrz, descripcion=desc))
        print("✓ Estaciones")

        # Plataformas RS
        for nombre, desc in PLATAFORMAS_RS:
            if not db.query(models.PlataformaRS).filter_by(nombre=nombre).first():
                db.add(models.PlataformaRS(nombre=nombre, descripcion=desc))
        print("✓ Plataformas de Redes Sociales")

        db.commit()
        print("\n✅ Seed completado exitosamente.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error en seed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
