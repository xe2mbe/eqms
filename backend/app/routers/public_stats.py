from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
import urllib.request
import json as _json
import httpx
import asyncio
import re
from datetime import datetime

router = APIRouter()

# ── AllScan node status cache ─────────────────────────────────────────────────
_ALLSCAN_URL  = "http://stn8422.ip.irlp.net:8081/allscan/astapi/server.php?nodes=299081"
_HUB_ID       = "299081"
_BOLETIN_NODE = "299080"
_node_cache: dict = {"result": None, "ts": datetime.min}

def _parse_node_info(info_html: str | None):
    """Extrae nombre y URL de stats del campo info HTML de AllScan."""
    if not info_html:
        return {"name": "—", "url": None}
    m = re.search(r'href="([^"]+)"[^>]*>([^<]+)<', info_html)
    if m:
        return {"name": m.group(2).strip(), "url": m.group(1).strip()}
    return {"name": re.sub(r"<[^>]+>", "", info_html).strip(), "url": None}

async def _fetch_node_status() -> dict:
    """
    Lee el SSE de AllScan del hub 299081.
    Devuelve {online, on_air, keyed, connections, nodes[]}.
      - on_air:   el nodo 299080 está conectado al hub
      - keyed:    299080 está transmitiendo activamente
      - nodes:    lista de nodos conectados con nombre, URL y estado
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            async with client.stream("GET", _ALLSCAN_URL) as resp:
                async for raw in resp.aiter_lines():
                    line = raw.strip()
                    if not line.startswith("data:"):
                        continue
                    try:
                        payload = _json.loads(line[5:].strip())
                    except Exception:
                        continue
                    node_data = payload.get(_HUB_ID) if isinstance(payload, dict) else None
                    if not node_data:
                        continue
                    remote_nodes = node_data.get("remote_nodes")
                    if remote_nodes is None:
                        continue

                    boletin = next(
                        (rn for rn in remote_nodes
                         if str(rn.get("node", "")) == _BOLETIN_NODE
                         and rn.get("link") == "Established"),
                        None,
                    )
                    on_air = boletin is not None
                    keyed  = on_air and str(boletin.get("keyed", "no")).lower() == "yes"

                    # Lista de nodos Established (excluye node=1 local)
                    node_list = []
                    for rn in remote_nodes:
                        if rn.get("link") != "Established":
                            continue
                        parsed = _parse_node_info(rn.get("info"))
                        node_list.append({
                            "node":      str(rn.get("node", "")),
                            "name":      parsed["name"],
                            "url":       parsed["url"],
                            "keyed":     str(rn.get("keyed", "no")).lower() == "yes",
                            "direction": rn.get("direction", ""),
                        })

                    return {
                        "online":      True,
                        "on_air":      on_air,
                        "keyed":       keyed,
                        "connections": len(node_list),
                        "nodes":       node_list,
                    }
    except Exception:
        pass
    return {"online": False, "on_air": False, "keyed": False, "connections": 0, "nodes": []}

@router.get("/node-status")
async def node_status():
    global _node_cache
    now = datetime.utcnow()
    if _node_cache["result"] and (now - _node_cache["ts"]).total_seconds() < 5:
        return _node_cache["result"]
    result = await _fetch_node_status()
    _node_cache = {"result": result, "ts": now}
    return result

# ── IRLP node 8422 + reflector 0077 status ───────────────────────────────────
import base64 as _b64
_IRLP_CGI_URL  = "http://stn8422.ip.irlp.net:8080/cgi-bin/irlpvcon/irlpvcon_get"
_IRLP_REF_URL  = "http://85.8.149.218/Chan_Zero_Node_Numbers.html"
_IRLP_AUTH     = _b64.b64encode(b"xe2mbe:Guadiana").decode()
_IRLP_NODE     = "8422"
_irlp_cache: dict = {"result": None, "ts": datetime.min}

async def _fetch_irlp_cgi() -> dict:
    """CGI del nodo 8422: estado en tiempo real de COS/PTT y conexión al reflector."""
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                _IRLP_CGI_URL,
                headers={"Authorization": f"Basic {_IRLP_AUTH}"},
            )
            text = resp.text
        def _int(pattern):
            m = re.search(pattern, text)
            return int(m.group(1)) if m else 0
        def _str(pattern):
            m = re.search(pattern, text)
            return m.group(1) if m else ''
        p0 = _int(r'\bp0=(\d+)')
        p1 = _int(r'\bp1=(\d+)')
        # ac='exp0077' cuando conectado, '' cuando NODE IDLE
        # co NO es confiable: mantiene el valor de la última conexión al desconectarse
        ac = _str(r"\bac='([^']*)'") or _str(r'\bac="([^"]*)"')
        on_air = bool(ac)
        return {
            "online": True,
            "on_air": on_air,
            "cos":    bool(p1 & 0x80),   # COS  = alguien transmitiendo al nodo
            "ptt":    bool(p0 & 0x82),   # PTT  = nodo transmitiendo al reflector
        }
    except Exception:
        return {"online": False, "on_air": False, "cos": False, "ptt": False}

_HTML_TAG_RE    = re.compile(r'<[^>]+>')
_IRLP_WARN_RE   = re.compile(r'\*\*.*?\*\*|sin latido|desconectado', re.IGNORECASE)

async def _fetch_irlp_reflector() -> list:
    """Lista de nodos conectados al reflector 0077 (se cachea 60 s aparte)."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(_IRLP_REF_URL)
            html = resp.text
        node_re = re.compile(
            r'\d+\s+\w+ \d+ \d+:\d+\s+stn(\d+)\s+-.*?-\s+\d+\s+(\w+)\s+(.+?)(?:\s*\n|$)'
        )
        nodes = []
        for m in node_re.finditer(html):
            raw = _HTML_TAG_RE.sub('', m.group(3)).strip()
            warning = bool(_IRLP_WARN_RE.search(raw))
            clean = _IRLP_WARN_RE.sub('', raw).strip(' *')
            nodes.append({
                "node":    m.group(1).strip(),
                "name":    f"{m.group(2).strip()} — {clean}",
                "url":     f"http://status.irlp.net/index.php?PSTART=11&nodeid={m.group(1).strip()}",
                "warning": warning,
            })
        return nodes
    except Exception:
        return []

_irlp_nodes_cache: dict = {"nodes": [], "ts": datetime.min}

async def _fetch_irlp_status() -> dict:
    global _irlp_nodes_cache
    now = datetime.utcnow()
    # Nodos del reflector: refrescar cada 60 s
    if (now - _irlp_nodes_cache["ts"]).total_seconds() > 60:
        nodes = await _fetch_irlp_reflector()
        _irlp_nodes_cache = {"nodes": nodes, "ts": now}
    nodes = _irlp_nodes_cache["nodes"]
    # Estado CGI en tiempo real (on_air/COS/PTT) — co='...0077...' = conectado al reflector
    cgi = await _fetch_irlp_cgi()
    return {
        **cgi,                   # on_air viene del CGI: '0077' in co, actualiza cada 5 s
        "connections": len(nodes),
        "nodes":       nodes,    # lista del reflector: se actualiza cada 60 s
    }

@router.get("/irlp-status")
async def irlp_status():
    global _irlp_cache
    now = datetime.utcnow()
    if _irlp_cache["result"] and (now - _irlp_cache["ts"]).total_seconds() < 5:
        return _irlp_cache["result"]
    result = await _fetch_irlp_status()
    _irlp_cache = {"result": result, "ts": now}
    return result

_visitas_ready = False


@router.post("/visita")
def registrar_visita(request: Request, db: Session = Depends(get_db)):
    global _visitas_ready
    if not _visitas_ready:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS visitas (
                id SERIAL PRIMARY KEY,
                ip VARCHAR(45),
                pais VARCHAR(100),
                timestamp TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        db.commit()
        _visitas_ready = True

    # Detectar IP real detrás de proxy
    ip = (request.headers.get("X-Forwarded-For") or
          request.headers.get("X-Real-IP") or
          (request.client.host if request.client else ""))
    ip = ip.split(",")[0].strip()

    # Consultar país vía ip-api.com (libre, sin key)
    pais = "Desconocido"
    pais_codigo = ""
    try:
        with urllib.request.urlopen(
            f"http://ip-api.com/json/{ip}?fields=country,countryCode&lang=es", timeout=3
        ) as resp:
            data = _json.loads(resp.read())
            pais = data.get("country") or "Desconocido"
            pais_codigo = data.get("countryCode") or ""
    except Exception:
        pass

    db.execute(text("INSERT INTO visitas (ip, pais) VALUES (:ip, :pais)"), {"ip": ip, "pais": pais})
    db.commit()

    total = db.execute(text("SELECT COUNT(*) FROM visitas")).scalar()
    return {"ip": ip, "pais": pais, "pais_codigo": pais_codigo, "total": int(total)}


@router.get("/stats")
def public_stats(db: Session = Depends(get_db)):
    """Estadísticas públicas del sistema — sin autenticación."""

    # Obtener el ID del Boletín Dominical
    boletin = db.execute(text(
        "SELECT id FROM eventos WHERE tipo ILIKE '%dominical%' LIMIT 1"
    )).first()
    ev_id = boletin[0] if boletin else -1

    rf_total = db.execute(text(
        "SELECT COUNT(*) FROM reportes WHERE evento_id = :ev_id"
    ), {"ev_id": ev_id}).scalar() or 0

    rf_indicativos = db.execute(text(
        "SELECT COUNT(DISTINCT indicativo) FROM reportes WHERE evento_id = :ev_id"
    ), {"ev_id": ev_id}).scalar() or 0

    rs_total = db.execute(text("SELECT COUNT(*) FROM reportes_rs")).scalar() or 0
    rs_indicativos = db.execute(text("SELECT COUNT(DISTINCT indicativo) FROM reportes_rs")).scalar() or 0

    por_estado = db.execute(text("""
        SELECT estado, COUNT(*) as total FROM reportes
        WHERE evento_id = :ev_id
          AND estado IS NOT NULL AND estado != '' AND estado != 'Extranjero'
        GROUP BY estado ORDER BY total DESC
    """), {"ev_id": ev_id}).fetchall()

    por_sistema = db.execute(text("""
        SELECT COALESCE(s.codigo, 'N/D') as sistema,
               COALESCE(s.nombre, 'Sin sistema') as nombre,
               COUNT(*) as total
        FROM reportes r LEFT JOIN sistemas s ON s.id = r.sistema_id
        WHERE r.evento_id = :ev_id
        GROUP BY s.codigo, s.nombre ORDER BY total DESC
    """), {"ev_id": ev_id}).fetchall()

    tendencia = db.execute(text("""
        SELECT TO_CHAR(DATE_TRUNC('month', r.fecha_reporte), 'YYYY-MM') as mes,
               COALESCE(s.codigo, 'N/D') as sistema,
               COUNT(*) as total
        FROM reportes r
        LEFT JOIN sistemas s ON s.id = r.sistema_id
        WHERE r.evento_id = :ev_id
          AND r.fecha_reporte >= NOW() - INTERVAL '12 months'
        GROUP BY mes, s.codigo ORDER BY mes, s.codigo
    """), {"ev_id": ev_id}).fetchall()

    top_rf = db.execute(text("""
        SELECT r.indicativo,
               COALESCE(MAX(r.operador), MAX(re.nombre_completo)) as nombre,
               COUNT(*) as total
        FROM reportes r
        LEFT JOIN radioexperimentadores re ON UPPER(re.indicativo) = UPPER(r.indicativo)
        WHERE r.evento_id = :ev_id AND UPPER(r.indicativo) NOT LIKE '%SWL%'
        GROUP BY r.indicativo ORDER BY total DESC LIMIT 10
    """), {"ev_id": ev_id}).fetchall()

    por_plataforma = db.execute(text("""
        SELECT p.nombre, COUNT(*) as total
        FROM reportes_rs r JOIN plataformas_rs p ON p.id = r.plataforma_id
        GROUP BY p.nombre ORDER BY total DESC
    """)).fetchall()

    tendencia_rs = db.execute(text("""
        SELECT TO_CHAR(DATE_TRUNC('month', r.fecha_reporte), 'YYYY-MM') as mes,
               COALESCE(p.nombre, 'N/D') as plataforma,
               COUNT(*) as total
        FROM reportes_rs r
        LEFT JOIN plataformas_rs p ON p.id = r.plataforma_id
        WHERE r.fecha_reporte >= NOW() - INTERVAL '12 months'
        GROUP BY mes, p.nombre ORDER BY mes, p.nombre
    """)).fetchall()

    por_estado_rs = db.execute(text("""
        SELECT estado, COUNT(*) as total FROM reportes_rs
        WHERE estado IS NOT NULL AND estado != '' AND estado != 'Extranjero'
        GROUP BY estado ORDER BY total DESC
    """)).fetchall()

    top_rs = db.execute(text("""
        SELECT r.indicativo,
               COALESCE(MAX(r.operador), MAX(re.nombre_completo)) as nombre,
               COUNT(*) as total
        FROM reportes_rs r
        LEFT JOIN radioexperimentadores re ON UPPER(re.indicativo) = UPPER(r.indicativo)
        GROUP BY r.indicativo ORDER BY total DESC LIMIT 10
    """)).fetchall()

    ultimo_rf = db.execute(text("""
        WITH ult AS (
            SELECT e.tipo, DATE_TRUNC('day', MAX(r.fecha_reporte))::date AS ultima
            FROM reportes r JOIN eventos e ON e.id = r.evento_id
            WHERE r.fecha_reporte >= NOW() - INTERVAL '30 days'
            GROUP BY e.tipo ORDER BY ultima DESC LIMIT 1
        )
        SELECT u.tipo, u.ultima,
               COUNT(DISTINCT r.indicativo) AS estaciones,
               COUNT(*) AS total_qsos
        FROM reportes r
        JOIN eventos e ON e.id = r.evento_id
        JOIN ult u ON e.tipo = u.tipo
        WHERE DATE_TRUNC('day', r.fecha_reporte) = u.ultima
        GROUP BY u.tipo, u.ultima
    """)).first()

    ultimo_rs = db.execute(text("""
        WITH ult AS (
            SELECT e.tipo, DATE_TRUNC('day', MAX(r.fecha_reporte))::date AS ultima
            FROM reportes_rs r JOIN eventos e ON e.id = r.evento_id
            WHERE r.fecha_reporte >= NOW() - INTERVAL '30 days'
            GROUP BY e.tipo ORDER BY ultima DESC LIMIT 1
        )
        SELECT u.tipo, u.ultima,
               COUNT(DISTINCT r.indicativo) AS estaciones,
               COUNT(*) AS total_qsos
        FROM reportes_rs r
        JOIN eventos e ON e.id = r.evento_id
        JOIN ult u ON e.tipo = u.tipo
        WHERE DATE_TRUNC('day', r.fecha_reporte) = u.ultima
        GROUP BY u.tipo, u.ultima
    """)).first()

    paises = db.execute(text("""
        SELECT pais, COUNT(DISTINCT indicativo) as indicativos
        FROM reportes
        WHERE evento_id = :ev_id
          AND pais IS NOT NULL AND pais != '' AND pais != 'México'
        GROUP BY pais ORDER BY indicativos DESC LIMIT 8
    """), {"ev_id": ev_id}).fetchall()

    return {
        "rf": {
            "total": int(rf_total),
            "indicativos": int(rf_indicativos),
            "por_estado": [{"estado": r[0], "total": int(r[1])} for r in por_estado],
            "por_sistema": [{"sistema": r[0], "nombre": r[1], "total": int(r[2])} for r in por_sistema],
            "tendencia": [{"mes": r[0], "sistema": r[1], "total": int(r[2])} for r in tendencia],
            "top_indicativos": [{"indicativo": r[0], "nombre": r[1], "total": int(r[2])} for r in top_rf],
            "paises": [{"pais": r[0], "indicativos": int(r[1])} for r in paises],
        },
        "rs": {
            "total": int(rs_total),
            "indicativos": int(rs_indicativos),
            "por_plataforma": [{"plataforma": r[0], "total": int(r[1])} for r in por_plataforma],
            "tendencia": [{"mes": r[0], "plataforma": r[1], "total": int(r[2])} for r in tendencia_rs],
            "por_estado": [{"estado": r[0], "total": int(r[1])} for r in por_estado_rs],
            "top_indicativos": [{"indicativo": r[0], "nombre": r[1], "total": int(r[2])} for r in top_rs],
        },
        "ultimo_evento_rf": {
            "tipo": ultimo_rf[0],
            "ultima": str(ultimo_rf[1]),
            "estaciones": int(ultimo_rf[2]),
            "total_qsos": int(ultimo_rf[3]),
        } if ultimo_rf else None,
        "ultimo_evento_rs": {
            "tipo": ultimo_rs[0],
            "ultima": str(ultimo_rs[1]),
            "estaciones": int(ultimo_rs[2]),
            "total_qsos": int(ultimo_rs[3]),
        } if ultimo_rs else None,
    }


@router.get("/estaciones-rf")
def estaciones_rf(db: Session = Depends(get_db)):
    boletin = db.execute(text(
        "SELECT id FROM eventos WHERE tipo ILIKE '%dominical%' LIMIT 1"
    )).first()
    ev_id = boletin[0] if boletin else -1
    rows = db.execute(text("""
        SELECT r.indicativo,
               COALESCE(MAX(r.operador), MAX(re.nombre_completo)) as nombre,
               COUNT(*) as total,
               TO_CHAR(MAX(r.fecha_reporte), 'YYYY-MM-DD') as ultima
        FROM reportes r
        LEFT JOIN radioexperimentadores re ON UPPER(re.indicativo) = UPPER(r.indicativo)
        WHERE r.evento_id = :ev_id AND UPPER(r.indicativo) NOT LIKE '%SWL%'
        GROUP BY r.indicativo ORDER BY total DESC
    """), {"ev_id": ev_id}).fetchall()
    return [{"indicativo": r[0], "nombre": r[1], "total": int(r[2]), "ultima": r[3]} for r in rows]


@router.get("/estaciones-rs")
def estaciones_rs(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT r.indicativo,
               COALESCE(MAX(r.operador), MAX(re.nombre_completo)) as nombre,
               COUNT(*) as total,
               TO_CHAR(MAX(r.fecha_reporte), 'YYYY-MM-DD') as ultima
        FROM reportes_rs r
        LEFT JOIN radioexperimentadores re ON UPPER(re.indicativo) = UPPER(r.indicativo)
        GROUP BY r.indicativo ORDER BY total DESC
    """)).fetchall()
    return [{"indicativo": r[0], "nombre": r[1], "total": int(r[2]), "ultima": r[3]} for r in rows]


@router.get("/ultimo-evento-participantes")
def ultimo_evento_participantes(db: Session = Depends(get_db)):
    ultimo = db.execute(text("""
        SELECT e.tipo, DATE_TRUNC('day', MAX(r.fecha_reporte))::date AS fecha
        FROM reportes r JOIN eventos e ON e.id = r.evento_id
        WHERE r.fecha_reporte >= NOW() - INTERVAL '30 days'
        GROUP BY e.tipo ORDER BY fecha DESC LIMIT 1
    """)).first()
    if not ultimo:
        return {"evento": None, "fecha": None, "participantes": []}
    rows = db.execute(text("""
        SELECT r.indicativo,
               COALESCE(MAX(r.operador), MAX(re.nombre_completo), MAX(u.full_name)) as nombre,
               COALESCE(s.codigo, 'N/D') as sistema,
               COUNT(*) as total,
               MAX(r.estado) as estado
        FROM reportes r
        JOIN eventos e ON e.id = r.evento_id
        LEFT JOIN radioexperimentadores re ON UPPER(re.indicativo) = UPPER(r.indicativo)
        LEFT JOIN usuarios u ON UPPER(u.indicativo) = UPPER(r.indicativo)
        LEFT JOIN sistemas s ON s.id = r.sistema_id
        WHERE e.tipo = :tipo AND DATE_TRUNC('day', r.fecha_reporte) = :fecha
        GROUP BY r.indicativo, s.codigo ORDER BY r.indicativo, total DESC
    """), {"tipo": ultimo[0], "fecha": str(ultimo[1])}).fetchall()

    from collections import defaultdict
    indicativos: dict = defaultdict(lambda: {"nombre": None, "total": 0, "sistemas": {}, "estado": None})
    for r in rows:
        ind = r[0]
        indicativos[ind]["nombre"] = r[1]
        indicativos[ind]["total"] += int(r[3])
        indicativos[ind]["sistemas"][r[2]] = int(r[3])
        if r[4] and not indicativos[ind]["estado"]:
            indicativos[ind]["estado"] = r[4]

    participantes = sorted(
        [{"indicativo": k, "nombre": v["nombre"], "total": v["total"],
          "sistemas": v["sistemas"], "estado": v["estado"]}
         for k, v in indicativos.items()],
        key=lambda x: -x["total"]
    )
    return {"evento": ultimo[0], "fecha": str(ultimo[1]), "participantes": participantes}


@router.get("/ultimo-evento-rs-participantes")
def ultimo_evento_rs_participantes(db: Session = Depends(get_db)):
    ultimo = db.execute(text("""
        SELECT e.tipo, DATE_TRUNC('day', MAX(r.fecha_reporte))::date AS fecha
        FROM reportes_rs r JOIN eventos e ON e.id = r.evento_id
        WHERE r.fecha_reporte >= NOW() - INTERVAL '30 days'
        GROUP BY e.tipo ORDER BY fecha DESC LIMIT 1
    """)).first()
    if not ultimo:
        return {"evento": None, "fecha": None, "participantes": []}
    rows = db.execute(text("""
        SELECT r.indicativo,
               COALESCE(MAX(r.operador), MAX(re.nombre_completo)) as nombre,
               COALESCE(p.nombre, 'N/D') as plataforma,
               COUNT(*) as total,
               MAX(r.estado) as estado
        FROM reportes_rs r
        JOIN eventos e ON e.id = r.evento_id
        LEFT JOIN radioexperimentadores re ON UPPER(re.indicativo) = UPPER(r.indicativo)
        LEFT JOIN plataformas_rs p ON p.id = r.plataforma_id
        WHERE e.tipo = :tipo AND DATE_TRUNC('day', r.fecha_reporte) = :fecha
        GROUP BY r.indicativo, p.nombre ORDER BY r.indicativo, total DESC
    """), {"tipo": ultimo[0], "fecha": str(ultimo[1])}).fetchall()

    from collections import defaultdict
    indicativos: dict = defaultdict(lambda: {"nombre": None, "total": 0, "plataformas": {}, "estado": None})
    for r in rows:
        ind = r[0]
        indicativos[ind]["nombre"] = r[1]
        indicativos[ind]["total"] += int(r[3])
        indicativos[ind]["plataformas"][r[2]] = int(r[3])
        if r[4] and not indicativos[ind]["estado"]:
            indicativos[ind]["estado"] = r[4]

    participantes = sorted(
        [{"indicativo": k, "nombre": v["nombre"], "total": v["total"],
          "plataformas": v["plataformas"], "estado": v["estado"]}
         for k, v in indicativos.items()],
        key=lambda x: -x["total"]
    )
    return {"evento": ultimo[0], "fecha": str(ultimo[1]), "participantes": participantes}


@router.get("/estaciones-internacionales")
def estaciones_internacionales(db: Session = Depends(get_db)):
    boletin = db.execute(text(
        "SELECT id FROM eventos WHERE tipo ILIKE '%dominical%' LIMIT 1"
    )).first()
    ev_id = boletin[0] if boletin else -1
    rows = db.execute(text("""
        SELECT r.indicativo,
               COALESCE(MAX(r.operador), MAX(re.nombre_completo)) as nombre,
               MAX(r.pais) as pais,
               COUNT(*) as total,
               TO_CHAR(MAX(r.fecha_reporte), 'YYYY-MM-DD') as ultima
        FROM reportes r
        LEFT JOIN radioexperimentadores re ON UPPER(re.indicativo) = UPPER(r.indicativo)
        WHERE r.evento_id = :ev_id
          AND r.pais IS NOT NULL AND r.pais != '' AND r.pais != 'México'
        GROUP BY r.indicativo ORDER BY pais, total DESC
    """), {"ev_id": ev_id}).fetchall()
    return [{"indicativo": r[0], "nombre": r[1], "pais": r[2], "total": int(r[3]), "ultima": r[4]} for r in rows]


@router.get("/buscar")
def buscar_indicativo(
    indicativo: str = Query(..., min_length=2, max_length=20),
    db: Session = Depends(get_db),
):
    """Búsqueda pública de reportes por indicativo."""
    ind = indicativo.strip().upper()

    # ID del Boletín Dominical
    boletin = db.execute(text(
        "SELECT id FROM eventos WHERE tipo ILIKE '%dominical%' LIMIT 1"
    )).first()
    ev_id = boletin[0] if boletin else -1

    # Datos del operador
    operador = db.execute(text("""
        SELECT nombre_completo, municipio, estado, tipo_licencia
        FROM radioexperimentadores WHERE UPPER(indicativo) = :ind LIMIT 1
    """), {"ind": ind}).first()

    # Resumen RF — solo Boletín Dominical
    rf_resumen = db.execute(text("""
        SELECT COUNT(*) as total,
               MIN(fecha_reporte) as primera,
               MAX(fecha_reporte) as ultima
        FROM reportes WHERE UPPER(indicativo) = :ind AND evento_id = :ev_id
    """), {"ind": ind, "ev_id": ev_id}).first()

    # RF por evento — siempre será Boletín Dominical, se omite agrupación
    rf_por_evento = db.execute(text("""
        SELECT e.tipo, COUNT(*) as total
        FROM reportes r LEFT JOIN eventos e ON e.id = r.evento_id
        WHERE UPPER(r.indicativo) = :ind AND r.evento_id = :ev_id
        GROUP BY e.tipo ORDER BY total DESC
    """), {"ind": ind, "ev_id": ev_id}).fetchall()

    # RF por sistema
    rf_por_sistema = db.execute(text("""
        SELECT s.codigo, COUNT(*) as total
        FROM reportes r LEFT JOIN sistemas s ON s.id = r.sistema_id
        WHERE UPPER(r.indicativo) = :ind AND r.evento_id = :ev_id
          AND r.sistema_id IS NOT NULL
        GROUP BY s.codigo ORDER BY total DESC
    """), {"ind": ind, "ev_id": ev_id}).fetchall()

    # Todos los registros RF
    rf_ultimos = db.execute(text("""
        SELECT r.fecha_reporte, e.tipo as evento, s.codigo as sistema,
               z.nombre as zona, r.ciudad, r.estado, r.senal
        FROM reportes r
        LEFT JOIN eventos e ON e.id = r.evento_id
        LEFT JOIN sistemas s ON s.id = r.sistema_id
        LEFT JOIN zonas z ON z.id = r.zona_id
        WHERE UPPER(r.indicativo) = :ind AND r.evento_id = :ev_id
        ORDER BY r.fecha_reporte DESC
    """), {"ind": ind, "ev_id": ev_id}).fetchall()

    # Resumen RS — solo Boletín Dominical
    rs_resumen = db.execute(text("""
        SELECT COUNT(*) as total,
               MIN(fecha_reporte) as primera,
               MAX(fecha_reporte) as ultima
        FROM reportes_rs WHERE UPPER(indicativo) = :ind AND evento_id = :ev_id
    """), {"ind": ind, "ev_id": ev_id}).first()

    # RS por plataforma
    rs_por_plataforma = db.execute(text("""
        SELECT p.nombre, COUNT(*) as total
        FROM reportes_rs r JOIN plataformas_rs p ON p.id = r.plataforma_id
        WHERE UPPER(r.indicativo) = :ind AND r.evento_id = :ev_id
        GROUP BY p.nombre ORDER BY total DESC
    """), {"ind": ind, "ev_id": ev_id}).fetchall()

    # Todos los registros RS
    rs_ultimos = db.execute(text("""
        SELECT r.fecha_reporte, p.nombre as plataforma, r.ciudad, r.estado, r.senal
        FROM reportes_rs r JOIN plataformas_rs p ON p.id = r.plataforma_id
        WHERE UPPER(r.indicativo) = :ind AND r.evento_id = :ev_id
        ORDER BY r.fecha_reporte DESC
    """), {"ind": ind, "ev_id": ev_id}).fetchall()

    if (rf_resumen[0] or 0) == 0 and (rs_resumen[0] or 0) == 0:
        raise HTTPException(404, f"No se encontraron registros para {ind}")

    def fmt_date(d):
        return str(d)[:10] if d else None

    return {
        "indicativo": ind,
        "operador": {
            "nombre": operador[0] if operador else None,
            "municipio": operador[1] if operador else None,
            "estado": operador[2] if operador else None,
            "licencia": operador[3] if operador else None,
        } if operador else None,
        "rf": {
            "total": int(rf_resumen[0] or 0),
            "primera": fmt_date(rf_resumen[1]),
            "ultima": fmt_date(rf_resumen[2]),
            "por_evento": [{"evento": r[0] or "—", "total": int(r[1])} for r in rf_por_evento],
            "por_sistema": [{"sistema": r[0], "total": int(r[1])} for r in rf_por_sistema],
            "ultimos": [{
                "fecha": fmt_date(r[0]), "evento": r[1], "sistema": r[2],
                "zona": r[3], "ciudad": r[4], "estado": r[5], "senal": r[6],
            } for r in rf_ultimos],
        },
        "rs": {
            "total": int(rs_resumen[0] or 0),
            "primera": fmt_date(rs_resumen[1]),
            "ultima": fmt_date(rs_resumen[2]),
            "por_plataforma": [{"plataforma": r[0], "total": int(r[1])} for r in rs_por_plataforma],
            "ultimos": [{
                "fecha": fmt_date(r[0]), "plataforma": r[1],
                "ciudad": r[2], "estado": r[3], "senal": r[4],
            } for r in rs_ultimos],
        },
    }
