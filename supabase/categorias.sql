-- Arcar.se: categorias gerenciadas pelo administrador e até 3 categorias por artigo.
-- Rode UMA vez no Supabase (SQL Editor > New query > cole TODO o conteúdo > Run). Pode rodar de novo sem estragar nada.
-- Depende do schema.sql e do painel-e-criadores.sql.

-- Lista oficial de categorias (todos leem; só o administrador cria, renomeia e exclui)
create table if not exists public.categories (
  name text primary key check (char_length(name) between 1 and 40 and name = btrim(name)),
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
drop policy if exists "categorias: leitura" on public.categories;
drop policy if exists "categorias: admin escreve" on public.categories;
create policy "categorias: leitura" on public.categories for select using (true);
create policy "categorias: admin escreve" on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

-- Cada artigo passa a ter uma lista de até 3 categorias; "cat" continua sendo a principal (a primeira da lista)
alter table public.posts add column if not exists cats text[] not null default '{}';
update public.posts set cats = array[btrim(cat)] where cardinality(cats) = 0;
insert into public.categories (name)
  select distinct btrim(c) from public.posts, unnest(cats) c where btrim(c) <> ''
on conflict do nothing;

-- Regras no banco: 1 a 3 categorias, sem repetir, todas da lista oficial; a primeira vira a categoria principal
create or replace function public.normalize_post_cats() returns trigger language plpgsql as $$
declare c text[];
begin
  if new.cats is null or cardinality(new.cats) = 0 then new.cats := array[coalesce(new.cat, '')]; end if; -- cliente antigo manda só "cat"
  select coalesce(array_agg(x order by o), '{}') into c from (
    select distinct on (x) x, o from (select btrim(v) as x, o from unnest(new.cats) with ordinality as t(v, o)) s
     where x <> '' order by x, o
  ) d;
  if cardinality(c) = 0 then raise exception 'Escolha ao menos uma categoria'; end if;
  if cardinality(c) > 3 then raise exception 'No máximo 3 categorias por artigo'; end if;
  if exists (select 1 from unnest(c) x where x not in (select name from public.categories)) then
    raise exception 'Categoria inexistente. Peça ao administrador para criá-la.';
  end if;
  new.cats := c;
  new.cat := c[1];
  return new;
end
$$;
drop trigger if exists posts_cats on public.posts;
create trigger posts_cats before insert or update on public.posts
  for each row execute function public.normalize_post_cats();
update public.posts set cat = btrim(cat) where cat <> btrim(cat); -- o gatilho também acerta "cats"

-- Renomear (ou mesclar, se o nome novo já existir): troca o nome em todos os artigos
create or replace function public.rename_category(p_old text, p_new text) returns void
language plpgsql security definer set search_path = public as $$
declare n text := btrim(coalesce(p_new, ''));
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  if n = '' or char_length(n) > 40 then raise exception 'Nome inválido (1 a 40 caracteres)'; end if;
  if not exists (select 1 from public.categories where name = p_old) then raise exception 'Categoria não encontrada'; end if;
  if p_old = n then return; end if;
  insert into public.categories (name) values (n) on conflict do nothing;
  update public.posts set cats = array_replace(cats, p_old, n) where p_old = any (cats);
  delete from public.categories where name = p_old;
end
$$;

-- Excluir: só categorias que nenhum artigo usa
create or replace function public.delete_category(p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  if exists (select 1 from public.posts where p_name = any (cats)) then
    raise exception 'Categoria em uso: troque ou mescle antes de excluir';
  end if;
  delete from public.categories where name = p_name;
end
$$;
