-- Banco da Nuvem: uma tabela só, porque uma nota, uma ideia e um projeto são
-- a mesma coisa com etiquetas diferentes.
-- Rode isto no SQL Editor do Supabase (uma vez só).

create table if not exists public.itens (
  id uuid primary key default gen_random_uuid(),

  -- O slug é a identidade do item para o CLI. O arquivo local pode mudar de
  -- pasta (quando o tipo muda) ou de nome sem quebrar a sincronização, porque
  -- quem manda é isto aqui, não o caminho.
  slug text not null unique,

  tipo text not null default 'nota'
    check (tipo in ('projeto','ideia','nota','referencia')),
  titulo text not null,
  conteudo text not null default '',
  tags text[] not null default '{}',
  status text not null default 'ativo'
    check (status in ('ativo','pausado','feito','arquivado')),

  -- Impressão digital do conteúdo + metadados. É com ela que o `nuvem push`
  -- descobre se alguém mexeu no item pelo celular enquanto você editava aqui.
  hash text not null,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- Apagar é marcar, não sumir. Sem isso o `nuvem pull` não teria como saber
  -- que um arquivo local precisa ser removido — só veria um item "ausente",
  -- que é exatamente o que um item novo em outro aparelho também parece.
  apagado_em timestamptz
);

create index if not exists itens_atualizado_em_idx on public.itens (atualizado_em desc);
create index if not exists itens_tipo_idx on public.itens (tipo);
create index if not exists itens_tags_idx on public.itens using gin (tags);

-- Busca por texto no título e no conteúdo (o ilike do painel).
create index if not exists itens_titulo_idx on public.itens (lower(titulo));

-- ─────────────────────────────────────────────────────────────────────────
-- Segurança: RLS ligado e NENHUMA policy criada.
--
-- Sem policy, as chaves públicas (anon / authenticated) não leem nem escrevem
-- nada. A service_role key, usada só no servidor, ignora RLS por design e
-- continua funcionando.
--
-- Aqui dentro estão suas ideias e seus projetos. O padrão seguro é ninguém
-- ver, e abrir exceção só quando houver motivo.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.itens enable row level security;
