-- Table: santa_ceia_contagem
-- Stores the attendance count for Santa Ceia rounds.

CREATE TABLE IF NOT EXISTS public.santa_ceia_contagem (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    data_evento DATE NOT NULL,
    municipio TEXT NOT NULL,
    comum TEXT NOT NULL,
    rodada INTEGER NOT NULL,
    irmas INTEGER NOT NULL DEFAULT 0,
    irmaos INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    responsavel TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_santa_ceia_data ON public.santa_ceia_contagem (data_evento);
CREATE INDEX IF NOT EXISTS idx_santa_ceia_comum ON public.santa_ceia_contagem (comum);

-- Enable Row Level Security (optional, depends on your Supabase setup)
-- ALTER TABLE public.santa_ceia_contagem ENABLE ROW LEVEL SECURITY;

-- Note: Make sure to add appropriate RLS policies if needed.
