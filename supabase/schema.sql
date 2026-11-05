-- Arcar.se: banco e regras de segurança. Rode UMA vez no Supabase (SQL Editor > New query > Run).

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), -- endereço legível; gerado do título pelo gatilho abaixo
  cat text not null,
  excerpt text not null default '',
  body text not null default '',
  img text not null default '',
  pub boolean not null default true,
  date timestamptz not null default now(),
  featured boolean not null default false -- destaque na página inicial (máx. 5)
);
create table public.pages (slug text primary key, title text not null, body text not null default '');
create table public.admins (user_id uuid primary key references auth.users (id) on delete cascade);

-- Pergunta usada pelas regras: o usuário logado é administrador?
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

alter table public.posts enable row level security;
alter table public.pages enable row level security;
alter table public.admins enable row level security; -- sem políticas: ninguém lê pela API

create policy "posts: leitura" on public.posts for select using (pub or public.is_admin());
create policy "posts: admin escreve" on public.posts for all using (public.is_admin()) with check (public.is_admin());
create policy "pages: leitura" on public.pages for select using (true);
create policy "pages: admin escreve" on public.pages for all using (public.is_admin()) with check (public.is_admin());

-- Limite de 5 artigos em destaque, garantido no banco
create or replace function public.limit_featured() returns trigger language plpgsql as $$
begin
  if new.featured and (select count(*) from public.posts where featured and id is distinct from new.id) >= 5 then
    raise exception 'Limite de 5 artigos em destaque';
  end if;
  return new;
end
$$;
drop trigger if exists posts_limit_featured on public.posts;
create trigger posts_limit_featured before insert or update on public.posts
  for each row execute function public.limit_featured();


-- Slug (endereço legível): gerado a partir do título; acrescenta -2, -3… se já existir
create or replace function public.slugify(t text) returns text
language sql immutable as $$
  select trim(both '-' from left(trim(both '-' from regexp_replace(
    translate(lower(coalesce(t, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ', 'aaaaaaeeeeiiiiooooouuuucnyy'),
    '[^a-z0-9]+', '-', 'g')), 80))
$$;
create or replace function public.set_post_slug() returns trigger language plpgsql as $$
declare
  base text := public.slugify(coalesce(nullif(new.slug, ''), new.title));
  cand text;
  n int := 1;
begin
  if base = '' then base := 'artigo'; end if;
  cand := base;
  while exists (select 1 from public.posts where slug = cand and id is distinct from new.id) loop
    n := n + 1;
    cand := base || '-' || n;
  end loop;
  new.slug := cand;
  return new;
end
$$;
create trigger posts_set_slug before insert or update on public.posts
  for each row execute function public.set_post_slug();

-- Imagens de capa (bucket público; só admin envia/altera/apaga; máx. 5 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif']);
create policy "capas: leitura" on storage.objects for select using (bucket_id = 'covers');
create policy "capas: admin envia" on storage.objects for insert with check (bucket_id = 'covers' and public.is_admin());
create policy "capas: admin altera" on storage.objects for update using (bucket_id = 'covers' and public.is_admin());
create policy "capas: admin apaga" on storage.objects for delete using (bucket_id = 'covers' and public.is_admin());

-- Conteúdo inicial
insert into public.pages (slug, title, body) values
('sobre', 'Sobre', $$## Sobre o blog

O **Arcar.se** é um blog de psicologia, com textos para o público em geral, estudantes e profissionais.$$),
('contato', 'Contato', $$## Fale comigo

Sugestões, críticas e parcerias são bem-vindas.

E-mail: contato@exemplo.com$$);
insert into public.posts (title, cat, excerpt, body) values
('Bem-vindo ao Arcar.se', 'Novidades', 'Um espaço de psicologia para se entender melhor e assumir a própria história.', $$## Olá!

Este é o primeiro artigo. Entre como administrador para criar, editar e excluir artigos.$$);

-- Painel de gestão, criadores, autoria e visualizações (o mesmo conteúdo de painel-e-criadores.sql, que serve para quem já tinha o banco)
-- ============================================================
-- 1. Perfis (nome de exibição e foto) e criadores
-- ============================================================
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  avatar_url text not null default '' check (avatar_url = '' or avatar_url ~ '^https?://')
);
create table if not exists public.creators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
-- e-mails liberados que ainda não criaram a conta (o acesso vale assim que a conta existir)
create table if not exists public.creator_invites (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.creators enable row level security;
alter table public.creator_invites enable row level security;

-- Pergunta usada pelas regras: o usuário logado é criador?
create or replace function public.is_creator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.creators where user_id = auth.uid())
$$;

-- Papel do usuário logado: 'admin', 'creator' ou nulo
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then 'admin' when public.is_creator() then 'creator' end
$$;

-- Perfis são públicos (só nome e foto; o e-mail nunca fica aqui). Cada um edita apenas o próprio.
drop policy if exists "perfis: leitura" on public.profiles;
drop policy if exists "perfis: edita o próprio" on public.profiles;
create policy "perfis: leitura" on public.profiles for select using (true);
create policy "perfis: edita o próprio" on public.profiles for all
  using (user_id = auth.uid() and (public.is_admin() or public.is_creator()))
  with check (user_id = auth.uid() and (public.is_admin() or public.is_creator()));

-- Criadores e convites: só o administrador lê; quem escreve são as funções abaixo
drop policy if exists "criadores: admin lê" on public.creators;
drop policy if exists "convites: admin lê" on public.creator_invites;
create policy "criadores: admin lê" on public.creators for select using (public.is_admin());
create policy "convites: admin lê" on public.creator_invites for select using (public.is_admin());

-- Administrador libera um e-mail como criador. Retorna 'ativo' (já tinha conta), 'convidado' (vale no primeiro acesso) ou 'admin'.
create or replace function public.invite_creator(p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare
  e text := lower(trim(coalesce(p_email, '')));
  uid uuid;
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido'; end if;
  select id into uid from auth.users where lower(email) = e limit 1;
  if uid is not null then
    if exists (select 1 from public.admins where user_id = uid) then return 'admin'; end if;
    insert into public.creators (user_id) values (uid) on conflict do nothing;
    return 'ativo';
  end if;
  insert into public.creator_invites (email) values (e) on conflict do nothing;
  return 'convidado';
end
$$;

-- Administrador tira o acesso de um criador (os artigos dele continuam no blog)
create or replace function public.remove_creator(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  delete from public.creators where user_id = p_user;
end
$$;

-- Administrador cancela um convite que ainda não foi usado
create or replace function public.cancel_invite(p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  delete from public.creator_invites where email = lower(trim(p_email));
end
$$;

-- Lista da equipe (com e-mail) só para o administrador
create or replace function public.team() returns table (user_id uuid, email text, display_name text, role text)
language sql stable security definer set search_path = public as $$
  select a.user_id, u.email::text, coalesce(p.display_name, ''), 'admin'::text
    from public.admins a join auth.users u on u.id = a.user_id left join public.profiles p on p.user_id = a.user_id
   where public.is_admin()
  union all
  select c.user_id, u.email::text, coalesce(p.display_name, ''), 'creator'::text
    from public.creators c join auth.users u on u.id = c.user_id left join public.profiles p on p.user_id = c.user_id
   where public.is_admin()
  union all
  select null::uuid, i.email, '', 'invite'::text from public.creator_invites i where public.is_admin()
$$;

-- Quando uma conta nova é criada com um e-mail liberado, ela já nasce como criadora
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.creator_invites where email = lower(new.email)) then
    insert into public.creators (user_id) values (new.id) on conflict do nothing;
    delete from public.creator_invites where email = lower(new.email);
  end if;
  return new;
end
$$;
drop trigger if exists on_auth_user_created_creator on auth.users;
create trigger on_auth_user_created_creator after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. Autoria e fluxo de revisão nos artigos
-- ============================================================
alter table public.posts add column if not exists author_id uuid references auth.users (id) on delete set null;
alter table public.posts add column if not exists submitted boolean not null default false; -- criador enviou para revisão
alter table public.posts add column if not exists review_note text not null default '';     -- observação do admin ao devolver

-- Artigos antigos passam a ser do administrador (se houver só um)
update public.posts set author_id = (select user_id from public.admins limit 1)
 where author_id is null and (select count(*) from public.admins) = 1;

-- Regras que não dependem do que o navegador envia
create or replace function public.guard_post() returns trigger language plpgsql as $$
begin
  if public.is_admin() then
    if tg_op = 'INSERT' and new.author_id is null then new.author_id := auth.uid(); end if;
  else
    -- criador: não publica, não destaca, não troca o autor nem escreve a observação do admin
    if tg_op = 'INSERT' then
      new.author_id := auth.uid();
      new.pub := false;
      new.featured := false;
      new.review_note := '';
    else
      new.author_id := old.author_id;
      new.pub := old.pub;
      new.featured := old.featured;
      new.review_note := old.review_note;
      if new.submitted and not old.submitted then new.review_note := ''; end if; -- reenviou: limpa a devolução
    end if;
  end if;
  if new.pub then new.submitted := false; new.review_note := ''; end if; -- publicado: sem pendências
  return new;
end
$$;
drop trigger if exists posts_guard on public.posts;
create trigger posts_guard before insert or update on public.posts
  for each row execute function public.guard_post();

-- Quem lê e quem escreve: admin em tudo; criador só nos próprios artigos (e sem publicar)
drop policy if exists "posts: leitura" on public.posts;
drop policy if exists "posts: admin escreve" on public.posts;
drop policy if exists "posts: criador escreve" on public.posts;
create policy "posts: leitura" on public.posts for select
  using (pub or public.is_admin() or author_id = auth.uid());
create policy "posts: admin escreve" on public.posts for all
  using (public.is_admin()) with check (public.is_admin());
create policy "posts: criador escreve" on public.posts for all
  using (public.is_creator() and author_id = auth.uid())
  with check (public.is_creator() and author_id = auth.uid());

-- ============================================================
-- 3. Contador de visualizações
-- ============================================================
create table if not exists public.post_views (
  post_id uuid primary key references public.posts (id) on delete cascade,
  views bigint not null default 0
);
alter table public.post_views enable row level security;
drop policy if exists "visualizações: leitura" on public.post_views;
create policy "visualizações: leitura" on public.post_views for select using (true); -- sem política de escrita: só a função abaixo soma

-- Soma uma visualização a um artigo publicado e devolve o total
create or replace function public.register_view(p_slug text) returns bigint
language plpgsql security definer set search_path = public as $$
declare total bigint;
begin
  insert into public.post_views (post_id, views)
    select id, 1 from public.posts where slug = p_slug and pub
  on conflict (post_id) do update set views = public.post_views.views + 1
  returning views into total;
  return coalesce(total, 0);
end
$$;
grant execute on function public.register_view(text) to anon, authenticated;

-- ============================================================
-- 4. Imagens: criadores também enviam (capas, fotos de perfil) e mexem só no que enviaram
-- ============================================================
drop policy if exists "capas: admin envia" on storage.objects;
drop policy if exists "capas: admin altera" on storage.objects;
drop policy if exists "capas: admin apaga" on storage.objects;
drop policy if exists "capas: equipe envia" on storage.objects;
drop policy if exists "capas: equipe altera" on storage.objects;
drop policy if exists "capas: equipe apaga" on storage.objects;
create policy "capas: equipe envia" on storage.objects for insert
  with check (bucket_id = 'covers' and (public.is_admin() or public.is_creator()));
create policy "capas: equipe altera" on storage.objects for update
  using (bucket_id = 'covers' and (public.is_admin() or (public.is_creator() and owner_id = auth.uid()::text)));
create policy "capas: equipe apaga" on storage.objects for delete
  using (bucket_id = 'covers' and (public.is_admin() or (public.is_creator() and owner_id = auth.uid()::text)));

-- DEPOIS de criar seu usuário em Authentication > Users, torne-o administrador (troque o e-mail):
-- insert into public.admins (user_id) select id from auth.users where email = 'seu@email.com';
