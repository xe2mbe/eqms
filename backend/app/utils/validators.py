import re
import unicodedata


def validate_password(password: str) -> tuple[bool, str]:
    """Valida que la contraseña cumpla con los requisitos mínimos de seguridad."""
    if len(password) < 8:
        return False, "La contraseña debe tener al menos 8 caracteres."
    if not re.search(r"[A-Z]", password):
        return False, "La contraseña debe contener al menos una letra mayúscula."
    if not re.search(r"[a-z]", password):
        return False, "La contraseña debe contener al menos una letra minúscula."
    if not re.search(r"\d", password):
        return False, "La contraseña debe contener al menos un número."
    return True, "OK"


def validate_callsign(callsign: str) -> dict:
    """
    Valida un indicativo mexicano o extranjero.
    Retorna: { valid, complete, zona, tipo }
    """
    callsign = callsign.strip().upper()

    if callsign == "SWL":
        return {"valid": True, "complete": True, "zona": "Definir", "tipo": "SWL"}

    xe123 = re.compile(r'^(XE[123])([A-Z]{1,3})?$')
    mex_general = re.compile(r'^(?:XE|XF|XB)[4-9][A-Z]{1,3}$')
    mex_especial = re.compile(r'^(?:4[ABC]|6[D-J])\d[A-Z0-9]{1,3}$')

    m = xe123.match(callsign)
    if m:
        return {
            "valid": True,
            "complete": bool(m.group(2)),
            "zona": m.group(1),
            "tipo": "ham",
        }

    if mex_general.match(callsign) or mex_especial.match(callsign):
        return {"valid": True, "complete": True, "zona": "Especial", "tipo": "ham"}

    if callsign.startswith(("XE", "XF", "XB", "4", "6")):
        return {"valid": False, "complete": False, "zona": "Error", "tipo": "Error"}

    ext = re.compile(r'^[A-Z][A-Z0-9]{2,}$')
    if ext.match(callsign):
        return {"valid": True, "complete": True, "zona": "Extranjero", "tipo": "ham"}

    return {"valid": False, "complete": False, "zona": "Error", "tipo": "Error"}


def normalize_text(text: str) -> str:
    """Elimina acentos y convierte a minúsculas."""
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()
