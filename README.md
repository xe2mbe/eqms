# QMS v3 – Sistema de Gestión de QSO

**Federación Mexicana de Radioexperimentadores A.C.**

Stack: **FastAPI + PostgreSQL + React + Ant Design**

---

## Estructura del proyecto

```
Q/
├── backend/          # API REST – FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── main.py         # Punto de entrada
│   │   ├── models.py       # Modelos SQLAlchemy
│   │   ├── schemas.py      # Esquemas Pydantic
│   │   ├── auth.py         # JWT + bcrypt
│   │   ├── config.py       # Configuración por env
│   │   ├── database.py     # Sesión SQLAlchemy
│   │   ├── routers/        # Endpoints por dominio
│   │   ├── services/       # Lógica de negocio
│   │   └── utils/          # Validadores, seed
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/         # React + Vite + Ant Design
│   ├── src/
│   │   ├── api/            # Clientes HTTP (axios)
│   │   ├── components/     # Layout, componentes comunes
│   │   ├── pages/          # Páginas de la aplicación
│   │   ├── store/          # Estado global (zustand)
│   │   ├── types/          # Tipos TypeScript
│   │   └── utils/          # Validadores cliente
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```

---

## Requisitos previos

- [Node.js 20+](https://nodejs.org/)
- [Python 3.12+](https://python.org/)
- [PostgreSQL 16+](https://postgresql.org/) — o usar Docker
- [Docker + Docker Compose](https://docker.com/) (opcional pero recomendado)

---

## Inicio rápido con Docker

```bash
# 1. Clonar el repo y entrar a la carpeta
cd Q

# 2. Copiar y editar el .env del backend
cp backend/.env.example backend/.env

# 3. Levantar todo con Docker
docker compose up --build

# 4. Cargar datos iniciales (catálogos + admin)
docker compose exec backend python -m app.utils.seed
```

Accesos:
- **Frontend:** http://localhost:5173
- **API Docs:** http://localhost:8000/api/docs
- **Usuario admin:** `admin` / `Cambiar@123` *(cambiar en primer login)*

---

## Inicio en modo desarrollo (sin Docker)

### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Editar .env con tu DATABASE_URL

# Levantar API
uvicorn app.main:app --reload --port 8000

# Cargar catálogos y admin
python -m app.utils.seed
```

### Frontend

```bash
# Instalar Node.js desde https://nodejs.org/ si aún no está instalado

cd frontend
npm install
npm run dev
```

El frontend queda en http://localhost:5173 y el proxy apunta automáticamente al backend en puerto 8000.

---

## API disponible

| Módulo | Prefijo | Descripción |
|--------|---------|-------------|
| Auth | `/api/auth` | Login, logout, refresh, cambio de contraseña |
| Reportes | `/api/reportes` | CRUD de reportes tradicionales con filtros y paginación |
| Usuarios | `/api/usuarios` | Gestión de usuarios (solo admin) |
| Catálogos | `/api/catalogos` | Eventos, estaciones, zonas, sistemas, estados |
| Estadísticas | `/api/estadisticas` | Resumen, por estado, por sistema, tendencia, RS |

Documentación interactiva: `http://localhost:8000/api/docs`

---

## Seguridad implementada

- Contraseñas hasheadas con **bcrypt** (rounds=12)
- Tokens **JWT** con access + refresh token
- Bloqueo de cuenta tras 5 intentos fallidos (15 min)
- Cambio de contraseña obligatorio en primer login
- **Audit log** de todas las operaciones críticas
- CORS configurado por lista blanca de orígenes

---

## Variables de entorno (backend)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Cadena de conexión PostgreSQL | `postgresql://quser:qpassword@localhost:5432/qmsdb` |
| `SECRET_KEY` | Clave secreta para JWT | Cambiar en producción |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Expiración del access token | `480` (8h) |
| `ALLOWED_ORIGINS` | Orígenes permitidos CORS | `http://localhost:5173` |
| `SMTP_HOST` | Servidor de correo | — |
