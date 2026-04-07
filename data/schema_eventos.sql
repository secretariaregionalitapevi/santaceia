-- Tabela para armazenar os metadados do atendimento (Cabeçalho do Relatório)
CREATE TABLE IF NOT EXISTS public.santa_ceia_eventos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  data_evento date NOT NULL,
  municipio text NOT NULL,
  comum text NOT NULL,
  atendimento text,
  hora text,
  palavra text,
  oracao_pao text,
  oracao_calice text,
  diaconos text,
  ano_anterior integer DEFAULT 0,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT santa_ceia_eventos_pkey PRIMARY KEY (id),
  CONSTRAINT santa_ceia_eventos_unique_key UNIQUE (data_evento, municipio, comum)
);

-- Habilitar RLS (Row Level Security) se necessário no futuro
ALTER TABLE public.santa_ceia_eventos ENABLE ROW LEVEL SECURITY;

-- Política de acesso simples (pode ser refinada conforme necessário)
CREATE POLICY "Allow all for authenticated" ON public.santa_ceia_eventos
  FOR ALL TO authenticated USING (true);
