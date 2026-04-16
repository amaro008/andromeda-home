# Andrómeda 🏠

Control inteligente de tu hogar — recibos, energía y mantenimiento.

## Setup en 5 pasos

### 1. Clonar y instalar
```bash
git clone https://github.com/TU_USUARIO/andromeda-home.git
cd andromeda-home
npm install
```

### 2. Configurar Supabase
En tu proyecto Supabase, ve a **SQL Editor** y ejecuta el contenido de:
```
supabase/001_initial_schema.sql
```

Luego ve a **Settings → API** y copia:
- `Project URL`
- `anon public key`

### 3. Variables de entorno locales
```bash
cp .env.example .env.local
```
Edita `.env.local` con tus valores:
```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
ANTHROPIC_API_KEY=sk-ant-...
```

### 4. Crear usuarios en Supabase
Ve a **Authentication → Users → Add user** y crea los dos usuarios:
- Tu email + contraseña
- Email de tu esposa + contraseña

### 5. Correr localmente
```bash
npm run dev
```
Abre http://localhost:3000

---

## Deploy en Vercel

1. Conecta el repo en vercel.com
2. En **Settings → Environment Variables** agrega las mismas 3 variables
3. Deploy automático en cada push a `main`

---

## Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública Supabase |
| `ANTHROPIC_API_KEY` | API key de Anthropic para leer recibos |

---

## Stack

- **Next.js 14** — App Router
- **Supabase** — Auth + PostgreSQL + RLS
- **Anthropic Claude** — Extracción de datos de recibos (Vision)
- **Tailwind CSS** — Estilos
- **Vercel** — Deploy

---

## Sprints

- ✅ **Sprint 1** — Auth, recibos con IA, dashboard
- 🔜 **Sprint 2** — Tareas de mantenimiento
- 🔜 **Sprint 3** — Integración Home Assistant (Tapo + Shelly)
- 🔜 **Sprint 4** — Dashboard de consumo con gráficas
