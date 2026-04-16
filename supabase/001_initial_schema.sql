-- =============================================
-- Andrómeda — Sprint 1 Schema
-- Ejecutar en: Supabase → SQL Editor
-- =============================================

-- Crear schema dedicado para Andrómeda
CREATE SCHEMA IF NOT EXISTS andromeda;

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- Tabla: receipts
-- =============================================
CREATE TABLE IF NOT EXISTS andromeda.receipts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_type     TEXT NOT NULL CHECK (service_type IN ('luz', 'agua', 'gas')),
  provider         TEXT,
  issue_date       DATE,
  period_start     DATE,
  period_end       DATE,
  consumption      NUMERIC(10, 2),
  consumption_unit TEXT,
  amount           NUMERIC(10, 2) NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'MXN',
  raw_text         TEXT,
  ai_confidence    NUMERIC(3, 2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS receipts_user_id_idx     ON andromeda.receipts(user_id);
CREATE INDEX IF NOT EXISTS receipts_service_idx     ON andromeda.receipts(service_type);
CREATE INDEX IF NOT EXISTS receipts_issue_date_idx  ON andromeda.receipts(issue_date DESC);

-- Updated_at automático
CREATE OR REPLACE FUNCTION andromeda.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER receipts_updated_at
  BEFORE UPDATE ON andromeda.receipts
  FOR EACH ROW EXECUTE FUNCTION andromeda.set_updated_at();

-- =============================================
-- Row Level Security (RLS)
-- Cada usuario solo ve sus propios recibos
-- =============================================
ALTER TABLE andromeda.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios ven sus recibos"
  ON andromeda.receipts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "usuarios insertan sus recibos"
  ON andromeda.receipts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "usuarios actualizan sus recibos"
  ON andromeda.receipts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "usuarios eliminan sus recibos"
  ON andromeda.receipts FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- Permisos para el rol anon y authenticated
-- =============================================
GRANT USAGE ON SCHEMA andromeda TO anon, authenticated;
GRANT ALL ON andromeda.receipts TO authenticated;

-- =============================================
-- Verificar
-- =============================================
SELECT 'Schema andromeda creado correctamente ✓' AS status;
