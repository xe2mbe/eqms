"""
Router: Premios y Distinciones QMS-FMRE
Evalúa reconocimientos basados en actividad real de los reportes.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from app.database import get_db
from app.auth import get_current_user, decode_token
from app import models
from datetime import datetime, timezone
from typing import Optional

router = APIRouter()


# ─── Catálogo de reconocimientos ─────────────────────────────────────────────

CATALOGO = [
    {
        "id": "centurion",
        "nombre": "Centurión de la Red",
        "descripcion": "Alcanzó 100 o más contactos registrados en la red QMS-FMRE.",
        "niveles": [
            {"nivel": "Bronce", "umbral": 100,  "color": "#cd7f32"},
            {"nivel": "Plata",  "umbral": 500,  "color": "#aaa9ad"},
            {"nivel": "Oro",    "umbral": 1000, "color": "#d4af37"},
        ],
        "icono": "🏆",
        "categoria": "Actividad",
    },
    {
        "id": "explorador",
        "nombre": "Explorador Nacional",
        "descripcion": "Ha sido reportado desde al menos 20 estados diferentes de la República Mexicana.",
        "niveles": [
            {"nivel": "Bronce", "umbral": 10, "color": "#cd7f32"},
            {"nivel": "Plata",  "umbral": 20, "color": "#aaa9ad"},
            {"nivel": "Oro",    "umbral": 30, "color": "#d4af37"},
        ],
        "icono": "🗺️",
        "categoria": "Cobertura",
    },
    {
        "id": "zonas_completas",
        "nombre": "Cobertura Total FMRE",
        "descripcion": "Ha sido reportado desde las 5 zonas de la FMRE (XE1, XE2, XE3, XE4, XE5).",
        "niveles": [
            {"nivel": "Único", "umbral": 5, "color": "#d4af37"},
        ],
        "icono": "📡",
        "categoria": "Cobertura",
    },
    {
        "id": "racha",
        "nombre": "Racha de Hierro",
        "descripcion": "Reportado en la red durante al menos 30 días consecutivos.",
        "niveles": [
            {"nivel": "Bronce", "umbral": 7,  "color": "#cd7f32"},
            {"nivel": "Plata",  "umbral": 30, "color": "#aaa9ad"},
            {"nivel": "Oro",    "umbral": 90, "color": "#d4af37"},
        ],
        "icono": "⚡",
        "categoria": "Constancia",
    },
    {
        "id": "veterano",
        "nombre": "Veterano de la Red",
        "descripcion": "Participación activa a lo largo de varios años en la red QMS-FMRE.",
        "niveles": [
            {"nivel": "1 Año",   "umbral": 1, "color": "#cd7f32"},
            {"nivel": "3 Años",  "umbral": 3, "color": "#aaa9ad"},
            {"nivel": "5 Años",  "umbral": 5, "color": "#d4af37"},
        ],
        "icono": "🎖️",
        "categoria": "Constancia",
    },
    {
        "id": "embajador",
        "nombre": "Embajador de Zona",
        "descripcion": "Operador con más contactos registrados en su zona FMRE durante el año.",
        "niveles": [
            {"nivel": "Zonal", "umbral": 1, "color": "#1A569E"},
        ],
        "icono": "🌟",
        "categoria": "Liderazgo",
    },
    {
        "id": "diversidad",
        "nombre": "Propágador Naciónal",
        "descripcion": "Ha logrado contactos registrados desde 25 o más estados en un solo año.",
        "niveles": [
            {"nivel": "Plata", "umbral": 15, "color": "#aaa9ad"},
            {"nivel": "Oro",   "umbral": 25, "color": "#d4af37"},
        ],
        "icono": "📻",
        "categoria": "Cobertura",
    },
    {
        "id": "pionero",
        "nombre": "Pionero QMS",
        "descripcion": "Uno de los primeros 20 operadores registrados en la red QMS-FMRE.",
        "niveles": [
            {"nivel": "Fundador", "umbral": 20, "color": "#d4af37"},
        ],
        "icono": "🔰",
        "categoria": "Histórico",
    },
]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _evaluar_centurion(db: Session, indicativo: str):
    total = db.execute(
        text("SELECT COUNT(*) FROM reportes WHERE indicativo = :ind"),
        {"ind": indicativo}
    ).scalar() or 0
    nivel = None
    for n in reversed(CATALOGO[0]["niveles"]):
        if total >= n["umbral"]:
            nivel = n; break
    return {"califica": nivel is not None, "valor": total, "nivel": nivel,
            "progreso": min(total / 1000 * 100, 100)}


def _evaluar_explorador(db: Session, indicativo: str):
    estados = db.execute(
        text("SELECT COUNT(DISTINCT estado) FROM reportes WHERE indicativo = :ind AND estado IS NOT NULL"),
        {"ind": indicativo}
    ).scalar() or 0
    nivel = None
    for n in reversed(CATALOGO[1]["niveles"]):
        if estados >= n["umbral"]:
            nivel = n; break
    return {"califica": nivel is not None, "valor": estados, "nivel": nivel,
            "progreso": min(estados / 32 * 100, 100)}


def _evaluar_zonas(db: Session, indicativo: str):
    zonas = db.execute(
        text("SELECT COUNT(DISTINCT zona) FROM reportes WHERE indicativo = :ind AND zona IS NOT NULL"),
        {"ind": indicativo}
    ).scalar() or 0
    nivel = CATALOGO[2]["niveles"][0] if zonas >= 5 else None
    return {"califica": nivel is not None, "valor": zonas, "nivel": nivel,
            "progreso": min(zonas / 5 * 100, 100)}


def _evaluar_racha(db: Session, indicativo: str):
    result = db.execute(text("""
        WITH daily AS (
            SELECT DISTINCT DATE(fecha_reporte AT TIME ZONE 'UTC') AS day
            FROM reportes WHERE indicativo = :ind
        ),
        numbered AS (
            SELECT day,
                   day - (ROW_NUMBER() OVER (ORDER BY day) * INTERVAL '1 day') AS grp
            FROM daily
        )
        SELECT MAX(cnt) AS max_racha FROM (
            SELECT COUNT(*) AS cnt FROM numbered GROUP BY grp
        ) t
    """), {"ind": indicativo}).scalar() or 0
    nivel = None
    for n in reversed(CATALOGO[3]["niveles"]):
        if result >= n["umbral"]:
            nivel = n; break
    return {"califica": nivel is not None, "valor": result, "nivel": nivel,
            "progreso": min(result / 90 * 100, 100)}


def _evaluar_veterano(db: Session, indicativo: str):
    row = db.execute(
        text("SELECT MIN(fecha_reporte), MAX(fecha_reporte) FROM reportes WHERE indicativo = :ind"),
        {"ind": indicativo}
    ).fetchone()
    if not row or not row[0]:
        return {"califica": False, "valor": 0, "nivel": None, "progreso": 0}
    anos = (row[1] - row[0]).days / 365.25
    nivel = None
    for n in reversed(CATALOGO[4]["niveles"]):
        if anos >= n["umbral"]:
            nivel = n; break
    return {"califica": nivel is not None, "valor": round(anos, 1), "nivel": nivel,
            "progreso": min(anos / 5 * 100, 100)}


def _evaluar_embajador(db: Session, indicativo: str):
    year = datetime.now(timezone.utc).year
    row = db.execute(text("""
        WITH zona_op AS (
            SELECT zona, indicativo, COUNT(*) AS cnt
            FROM reportes
            WHERE EXTRACT(YEAR FROM fecha_reporte) = :yr AND zona IS NOT NULL
            GROUP BY zona, indicativo
        ),
        top AS (
            SELECT zona, indicativo, cnt,
                   RANK() OVER (PARTITION BY zona ORDER BY cnt DESC) AS rk
            FROM zona_op
        )
        SELECT zona, cnt FROM top WHERE indicativo = :ind AND rk = 1
    """), {"yr": year, "ind": indicativo}).fetchone()
    if row:
        return {"califica": True, "valor": row[0], "nivel": CATALOGO[5]["niveles"][0],
                "detalle": f"Zona {row[0]} · {row[1]} contactos", "progreso": 100}
    return {"califica": False, "valor": None, "nivel": None, "progreso": 0}


def _evaluar_diversidad(db: Session, indicativo: str):
    year = datetime.now(timezone.utc).year
    estados = db.execute(text("""
        SELECT COUNT(DISTINCT estado) FROM reportes
        WHERE indicativo = :ind AND EXTRACT(YEAR FROM fecha_reporte) = :yr AND estado IS NOT NULL
    """), {"ind": indicativo, "yr": year}).scalar() or 0
    nivel = None
    for n in reversed(CATALOGO[6]["niveles"]):
        if estados >= n["umbral"]:
            nivel = n; break
    return {"califica": nivel is not None, "valor": estados, "nivel": nivel,
            "progreso": min(estados / 25 * 100, 100)}


def _evaluar_pionero(db: Session, indicativo: str):
    # Get the rank of this indicativo by first appearance
    row = db.execute(text("""
        WITH primeras AS (
            SELECT indicativo, MIN(fecha_reporte) AS primera
            FROM reportes GROUP BY indicativo
        ),
        ranked AS (
            SELECT indicativo, primera,
                   RANK() OVER (ORDER BY primera) AS rk
            FROM primeras
        )
        SELECT rk, primera FROM ranked WHERE indicativo = :ind
    """), {"ind": indicativo}).fetchone()
    if row and row[0] <= 20:
        return {"califica": True, "valor": int(row[0]), "nivel": CATALOGO[7]["niveles"][0],
                "detalle": f"Registro #{row[0]} · {row[1].strftime('%d/%m/%Y')}", "progreso": 100}
    return {"califica": False, "valor": row[0] if row else None, "nivel": None, "progreso": 0}


EVALUADORES = [
    _evaluar_centurion, _evaluar_explorador, _evaluar_zonas, _evaluar_racha,
    _evaluar_veterano, _evaluar_embajador, _evaluar_diversidad, _evaluar_pionero,
]


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/catalogo")
def catalogo():
    return CATALOGO


@router.get("/evaluar/{indicativo}")
def evaluar(indicativo: str, db: Session = Depends(get_db)):
    indicativo = indicativo.upper()
    # Check the callsign exists
    exists = db.execute(
        text("SELECT COUNT(*) FROM reportes WHERE indicativo = :ind"),
        {"ind": indicativo}
    ).scalar()
    if not exists:
        raise HTTPException(404, f"No se encontraron reportes para {indicativo}")

    resultados = []
    for i, cat in enumerate(CATALOGO):
        ev = EVALUADORES[i](db, indicativo)
        resultados.append({
            "premio": cat,
            "resultado": ev,
        })

    # Get operator name
    op = db.execute(
        text("SELECT nombre_completo FROM radioexperimentadores WHERE indicativo = :ind"),
        {"ind": indicativo}
    ).fetchone()
    nombre = op[0] if op else None

    return {"indicativo": indicativo, "nombre": nombre, "premios": resultados}


@router.get("/ranking/{premio_id}")
def ranking(premio_id: str, limite: int = 20, db: Session = Depends(get_db)):
    if premio_id == "centurion":
        rows = db.execute(text("""
            SELECT indicativo, COUNT(*) AS total
            FROM reportes GROUP BY indicativo
            ORDER BY total DESC LIMIT :lim
        """), {"lim": limite}).fetchall()
        return [{"indicativo": r[0], "valor": r[1], "label": f"{r[1]} contactos"} for r in rows]

    elif premio_id == "explorador":
        rows = db.execute(text("""
            SELECT indicativo, COUNT(DISTINCT estado) AS estados
            FROM reportes WHERE estado IS NOT NULL
            GROUP BY indicativo ORDER BY estados DESC LIMIT :lim
        """), {"lim": limite}).fetchall()
        return [{"indicativo": r[0], "valor": r[1], "label": f"{r[1]} estados"} for r in rows]

    elif premio_id == "zonas_completas":
        rows = db.execute(text("""
            SELECT indicativo, COUNT(DISTINCT zona) AS zonas
            FROM reportes WHERE zona IS NOT NULL
            GROUP BY indicativo HAVING COUNT(DISTINCT zona) >= 5
            ORDER BY zonas DESC LIMIT :lim
        """), {"lim": limite}).fetchall()
        return [{"indicativo": r[0], "valor": r[1], "label": f"{r[1]}/5 zonas"} for r in rows]

    elif premio_id == "racha":
        rows = db.execute(text("""
            WITH daily AS (
                SELECT indicativo, DISTINCT DATE(fecha_reporte AT TIME ZONE 'UTC') AS day
                FROM reportes
            )
            SELECT indicativo, day FROM daily ORDER BY indicativo, day
        """), {}).fetchall()
        # Python-side streak computation for simplicity
        from itertools import groupby
        from datetime import timedelta
        streaks: dict = {}
        for ind, group in groupby(rows, key=lambda r: r[0]):
            days = sorted(r[1] for r in group)
            max_s, cur_s = 1, 1
            for i in range(1, len(days)):
                if (days[i] - days[i-1]).days == 1:
                    cur_s += 1; max_s = max(max_s, cur_s)
                else:
                    cur_s = 1
            streaks[ind] = max_s
        top = sorted(streaks.items(), key=lambda x: -x[1])[:limite]
        return [{"indicativo": k, "valor": v, "label": f"{v} días consecutivos"} for k, v in top]

    elif premio_id == "diversidad":
        year = datetime.now(timezone.utc).year
        rows = db.execute(text("""
            SELECT indicativo, COUNT(DISTINCT estado) AS estados
            FROM reportes
            WHERE EXTRACT(YEAR FROM fecha_reporte) = :yr AND estado IS NOT NULL
            GROUP BY indicativo ORDER BY estados DESC LIMIT :lim
        """), {"yr": year, "lim": limite}).fetchall()
        return [{"indicativo": r[0], "valor": r[1], "label": f"{r[1]} estados en {year}"} for r in rows]

    elif premio_id == "pionero":
        rows = db.execute(text("""
            SELECT indicativo, MIN(fecha_reporte) AS primera
            FROM reportes GROUP BY indicativo
            ORDER BY primera LIMIT :lim
        """), {"lim": limite}).fetchall()
        return [{"indicativo": r[0], "valor": i+1,
                 "label": f"#{i+1} · {r[1].strftime('%d/%m/%Y')}"} for i, r in enumerate(rows)]

    raise HTTPException(404, "Premio no encontrado")


@router.get("/resumen-global")
def resumen_global(db: Session = Depends(get_db)):
    total_reportes = db.execute(text("SELECT COUNT(*) FROM reportes")).scalar()
    total_indicativos = db.execute(text("SELECT COUNT(DISTINCT indicativo) FROM reportes")).scalar()
    top5 = db.execute(text("""
        SELECT indicativo, COUNT(*) FROM reportes
        GROUP BY indicativo ORDER BY COUNT(*) DESC LIMIT 5
    """)).fetchall()
    return {
        "total_reportes": total_reportes,
        "total_indicativos": total_indicativos,
        "top5": [{"indicativo": r[0], "total": r[1]} for r in top5],
    }


# ─── Certificado HTML (imprimible / guardar como PDF) ─────────────────────────

@router.get("/certificado/{premio_id}/{indicativo}", response_class=HTMLResponse)
def certificado(
    premio_id: str,
    indicativo: str,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    # Validate token passed as query param (used when opening in new tab)
    if token:
        try:
            decode_token(token)
        except Exception:
            raise HTTPException(status_code=401, detail="Token inválido")
    else:
        raise HTTPException(status_code=401, detail="Not authenticated")
    indicativo = indicativo.upper()

    cat = next((c for c in CATALOGO if c["id"] == premio_id), None)
    if not cat:
        raise HTTPException(404, "Premio no encontrado")

    ev = EVALUADORES[CATALOGO.index(cat)](db, indicativo)
    if not ev["califica"]:
        raise HTTPException(400, f"{indicativo} no califica para este reconocimiento")

    op = db.execute(
        text("SELECT nombre_completo FROM radioexperimentadores WHERE indicativo = :ind"),
        {"ind": indicativo}
    ).fetchone()
    nombre = op[0] if op else indicativo

    nivel_nombre = ev["nivel"]["nivel"] if ev["nivel"] else ""
    nivel_color = ev["nivel"]["color"] if ev["nivel"] else "#d4af37"
    fecha_hoy = datetime.now(timezone.utc).strftime("%d de %B de %Y")
    # Spanish month names
    meses = {"January":"enero","February":"febrero","March":"marzo","April":"abril",
             "May":"mayo","June":"junio","July":"julio","August":"agosto",
             "September":"septiembre","October":"octubre","November":"noviembre","December":"diciembre"}
    for en, es in meses.items():
        fecha_hoy = fecha_hoy.replace(en, es)

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Certificado – {cat['nombre']} – {indicativo}</title>
<style>
  @media print {{
    body {{ margin: 0; }}
    .no-print {{ display: none !important; }}
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    background: #f5f0e8;
    font-family: 'Georgia', serif;
    display: flex; flex-direction: column;
    align-items: center; min-height: 100vh;
    padding: 20px;
  }}
  .no-print {{
    margin-bottom: 16px;
  }}
  .no-print button {{
    padding: 8px 24px; font-size: 15px;
    background: #1A569E; color: #fff;
    border: none; border-radius: 6px; cursor: pointer;
  }}
  .cert {{
    width: 794px; min-height: 562px;
    background: #fff;
    position: relative;
    padding: 50px 60px;
    border: 2px solid #b8960c;
    box-shadow: 0 8px 32px rgba(0,0,0,.18);
  }}
  /* Outer decorative border */
  .cert::before {{
    content: '';
    position: absolute; inset: 8px;
    border: 1px solid #d4af37;
    pointer-events: none;
  }}
  /* Corner ornaments */
  .corner {{
    position: absolute;
    width: 40px; height: 40px;
    font-size: 28px; line-height: 40px;
    text-align: center; color: {nivel_color};
    opacity: .8;
  }}
  .tl {{ top: 12px; left: 12px; }}
  .tr {{ top: 12px; right: 12px; }}
  .bl {{ bottom: 12px; left: 12px; }}
  .br {{ bottom: 12px; right: 12px; }}

  .header {{
    display: flex; align-items: center;
    justify-content: center; gap: 20px;
    margin-bottom: 16px;
  }}
  .logo-diamond {{
    width: 54px; height: 70px;
    background: linear-gradient(180deg, #2e7d32 33%, #fff 33% 66%, #c62828 66%);
    clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
    display: flex; align-items: center; justify-content: center;
    position: relative;
  }}
  .logo-text {{
    font-size: 9px; font-weight: 900;
    color: #000; letter-spacing: 1px;
    position: absolute;
    top: 50%; left: 50%; transform: translate(-50%, -50%);
  }}
  .org-name {{
    text-align: left;
    color: #1A569E;
  }}
  .org-name .fmre {{
    font-size: 22px; font-weight: 900; letter-spacing: 3px;
  }}
  .org-name .full {{
    font-size: 9px; letter-spacing: 1px; color: #555;
  }}

  .divider {{
    height: 2px;
    background: linear-gradient(90deg, transparent, {nivel_color}, transparent);
    margin: 12px 0;
  }}

  .certifica {{
    text-align: center;
    font-size: 11px; letter-spacing: 4px;
    color: #888; text-transform: uppercase;
    margin-bottom: 8px;
  }}
  .premio-icono {{
    text-align: center; font-size: 42px; margin: 8px 0 4px;
  }}
  .premio-nombre {{
    text-align: center;
    font-size: 30px; font-weight: 700;
    color: {nivel_color};
    letter-spacing: 1px;
    margin-bottom: 4px;
  }}
  .nivel-badge {{
    text-align: center; margin-bottom: 16px;
  }}
  .nivel-badge span {{
    display: inline-block;
    background: {nivel_color};
    color: #fff; font-size: 11px; font-weight: 700;
    padding: 3px 16px; border-radius: 20px;
    letter-spacing: 2px;
  }}

  .otorgado-a {{
    text-align: center;
    font-size: 11px; letter-spacing: 3px; color: #888;
    text-transform: uppercase; margin-bottom: 4px;
  }}
  .callsign {{
    text-align: center;
    font-size: 42px; font-weight: 900;
    color: #1A569E; letter-spacing: 6px;
    margin-bottom: 4px;
  }}
  .nombre-op {{
    text-align: center;
    font-size: 18px; color: #333;
    font-style: italic; margin-bottom: 12px;
  }}

  .descripcion {{
    text-align: center;
    font-size: 13px; color: #555;
    line-height: 1.6; margin: 0 40px 16px;
    font-style: italic;
  }}

  .logro {{
    text-align: center;
    font-size: 13px; color: #222; font-weight: 700;
    margin-bottom: 20px;
  }}

  .footer {{
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px solid #eee;
  }}
  .firma {{
    text-align: center; width: 180px;
  }}
  .firma-linea {{
    border-bottom: 1px solid #333;
    margin-bottom: 4px; height: 36px;
  }}
  .firma-cargo {{
    font-size: 10px; color: #666; letter-spacing: 1px;
  }}
  .fecha-cert {{
    text-align: center;
    font-size: 11px; color: #666;
  }}
  .fecha-cert .fecha {{
    font-size: 13px; color: #333; font-weight: 700;
  }}
  .qr-placeholder {{
    width: 60px; height: 60px;
    border: 1px solid #ddd; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; color: #bbb; text-align: center;
  }}
</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
</div>

<div class="cert">
  <span class="corner tl">❧</span>
  <span class="corner tr">❧</span>
  <span class="corner bl">❦</span>
  <span class="corner br">❦</span>

  <div class="header">
    <div class="logo-diamond">
      <span class="logo-text">FMRE</span>
    </div>
    <div class="org-name">
      <div class="fmre">FMRE</div>
      <div class="full">Federación Mexicana de Radioexperimentadores A.C.</div>
      <div class="full">Sistema de Gestión QMS · Red Nacional</div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="certifica">otorga el presente reconocimiento</div>

  <div class="premio-icono">{cat['icono']}</div>
  <div class="premio-nombre">{cat['nombre']}</div>
  <div class="nivel-badge"><span>{nivel_nombre}</span></div>

  <div class="otorgado-a">al operador</div>
  <div class="callsign">{indicativo}</div>
  <div class="nombre-op">{nombre}</div>

  <div class="descripcion">"{cat['descripcion']}"</div>

  <div class="logro">Mérito alcanzado: {_logro_texto(premio_id, ev)}</div>

  <div class="divider"></div>

  <div class="footer">
    <div class="firma">
      <div class="firma-linea"></div>
      <div class="firma-cargo">PRESIDENTE NACIONAL FMRE</div>
    </div>
    <div class="fecha-cert">
      <div>Ciudad de México</div>
      <div class="fecha">{fecha_hoy}</div>
      <div style="font-size:9px;color:#aaa;margin-top:4px">Generado por QMS-FMRE</div>
    </div>
    <div class="firma">
      <div class="firma-linea"></div>
      <div class="firma-cargo">SECRETARIO GENERAL FMRE</div>
    </div>
  </div>
</div>
</body>
</html>"""
    return HTMLResponse(content=html)


def _logro_texto(premio_id: str, ev: dict) -> str:
    v = ev.get("valor")
    mapping = {
        "centurion":    f"{v} contactos registrados en la red",
        "explorador":   f"Reportado desde {v} estados de la República Mexicana",
        "zonas_completas": f"Cobertura confirmada en {v}/5 zonas FMRE",
        "racha":        f"{v} días consecutivos en la red",
        "veterano":     f"{v} años de participación en la red",
        "embajador":    ev.get("detalle", "Operador líder de su zona"),
        "diversidad":   f"{v} estados distintos en el año en curso",
        "pionero":      ev.get("detalle", f"Registro #{v} en la red QMS-FMRE"),
    }
    return mapping.get(premio_id, str(v))
