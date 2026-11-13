-- Arcar.se: caixas da coluna lateral editáveis pelo painel (aba "Caixas").
-- Avisos: caixa fixa logo abaixo da busca (pode ser ocultada). Caixas livres: adicionadas e excluídas à vontade,
-- aparecem depois de todas as outras caixas, na ordem escolhida no painel.
-- Rode UMA vez no Supabase (SQL Editor > New query > cole TODO o conteúdo > Run). Pode rodar de novo sem estragar nada.
-- Depende do painel-e-criadores.sql (is_admin()).

create table if not exists public.side_boxes (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'livre',       -- 'avisos' (a fixa, só uma) ou 'livre'
  title text not null default '',
  body text not null default '',            -- texto em Markdown, como o dos artigos
  icon text not null default 'flecha',      -- ícone no modo leitura e antes do título
  sort integer not null default 0,          -- ordem das caixas livres
  hidden boolean not null default false,    -- oculta: não aparece no site
  created_at timestamptz not null default now()
);
alter table public.side_boxes drop constraint if exists side_boxes_kind;
alter table public.side_boxes add constraint side_boxes_kind check (kind in ('avisos', 'livre'));
alter table public.side_boxes drop constraint if exists side_boxes_title_len;
alter table public.side_boxes add constraint side_boxes_title_len check (char_length(title) <= 60);
alter table public.side_boxes drop constraint if exists side_boxes_body_len;
alter table public.side_boxes add constraint side_boxes_body_len check (char_length(body) <= 5000);
create unique index if not exists side_boxes_um_avisos on public.side_boxes (kind) where kind = 'avisos';

-- Quem lê: todos veem as caixas visíveis; o administrador vê também as ocultas. Só o administrador grava.
alter table public.side_boxes enable row level security;
drop policy if exists "caixas: leitura" on public.side_boxes;
create policy "caixas: leitura" on public.side_boxes for select using (not hidden or public.is_admin());
drop policy if exists "caixas: admin escreve" on public.side_boxes;
create policy "caixas: admin escreve" on public.side_boxes for all using (public.is_admin()) with check (public.is_admin());
grant select on public.side_boxes to anon, authenticated;
grant insert, update, delete on public.side_boxes to authenticated;

-- O Avisos de hoje (guardado em pages, slug "avisos") vira a caixa fixa, com o mesmo título e texto.
-- Se nunca foi editado, entra o texto de boas-vindas. Se o texto estava vazio (era assim que se escondia o quadro),
-- a caixa já nasce oculta, com o texto de boas-vindas guardado para quando quiser mostrá-la de novo.
insert into public.side_boxes (kind, title, body, icon, hidden)
select 'avisos',
       case when coalesce(p.title, '') in ('', 'Quadro de avisos') then 'Avisos' else p.title end, -- o nome antigo vira "Avisos"
       coalesce(nullif(p.body, ''), E'**Boas-vindas ao Arcar.se!** O blog acaba de ser inaugurado.\n\nAqui você encontra textos de psicologia para se entender melhor e assumir a própria história, escritos para o público em geral, estudantes e profissionais. Leia, curta e compartilhe com quem possa gostar. Novos artigos chegam em breve.'),
       'flecha',
       p.slug is not null and coalesce(p.body, '') = ''
  from (select 1) x
  left join public.pages p on p.slug = 'avisos'
 where not exists (select 1 from public.side_boxes where kind = 'avisos');

notify pgrst, 'reload schema';

-- Conferência: deve listar a caixa Avisos
select kind, title, icon, hidden, left(body, 60) as inicio_do_texto from public.side_boxes order by kind, sort;
