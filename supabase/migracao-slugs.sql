-- Arcar.se: endereços legíveis (slug) para os artigos.
-- Rode UMA vez no Supabase (SQL Editor > New query > Run). Os artigos existentes ganham o slug a partir do título.

-- 1) Coluna (ainda opcional, para podermos preencher os artigos antigos)
alter table public.posts add column if not exists slug text;

-- 2) Transforma um texto em slug: minúsculas, sem acentos, hífen no lugar de espaços e símbolos (máx. 80 caracteres)
create or replace function public.slugify(t text) returns text
language sql immutable as $$
  select trim(both '-' from left(trim(both '-' from regexp_replace(
    translate(lower(coalesce(t, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ', 'aaaaaaeeeeiiiiooooouuuucnyy'),
    '[^a-z0-9]+', '-', 'g')), 80))
$$;

-- 3) Garante um slug em todo artigo salvo: usa o enviado (ou o título) e acrescenta -2, -3… se já existir
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
drop trigger if exists posts_set_slug on public.posts;
create trigger posts_set_slug before insert or update on public.posts
  for each row execute function public.set_post_slug();

-- 4) Preenche os artigos que já existem (o gatilho acima gera o slug de cada um)
update public.posts set slug = '' where slug is null or slug = '';

-- 5) Trava: slug obrigatório, único e só com letras minúsculas, números e hífens
alter table public.posts alter column slug set not null;
alter table public.posts add constraint posts_slug_key unique (slug);
alter table public.posts add constraint posts_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Conferir o resultado:
-- select title, slug from public.posts order by date desc;
