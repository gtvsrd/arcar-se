-- Arcar.se: página "Escritores" (antiga Contato) com um card por escritor.
-- Rode UMA vez no Supabase (SQL Editor > New query > cole TODO o conteúdo > Run). Pode rodar de novo sem estragar nada.
-- Depende do painel-e-criadores.sql (profiles, admins, creators, is_admin(), is_creator()).

-- 1. Campos do card: texto de apresentação, redes/site, ordem e "ocultar"
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists links jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists sort integer not null default 0;
alter table public.profiles add column if not exists hidden boolean not null default false;
alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles add constraint profiles_bio_len check (char_length(bio) <= 1200);
alter table public.profiles drop constraint if exists profiles_links_obj;
alter table public.profiles add constraint profiles_links_obj check (jsonb_typeof(links) = 'object');

-- 2. O administrador edita o card de qualquer escritor (cada escritor continua editando o próprio)
drop policy if exists "perfis: admin edita todos" on public.profiles;
create policy "perfis: admin edita todos" on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- Ordem e "ocultar" são decisões do administrador: o escritor não muda esses dois campos
-- (sem usuário logado = SQL Editor do Supabase, que pode tudo; visitantes não gravam por causa do RLS)
create or replace function public.guard_profile() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.sort := 0;
      new.hidden := false;
    else
      new.sort := old.sort;
      new.hidden := old.hidden;
    end if;
  end if;
  return new;
end
$$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.guard_profile();

-- 3. Lista pública da página: só quem é da equipe hoje (admin ou criador), tem nome e não está oculto
create or replace function public.writers()
returns table (user_id uuid, display_name text, avatar_url text, bio text, links jsonb, sort integer)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.display_name, p.avatar_url, p.bio, p.links, p.sort
    from public.profiles p
   where not p.hidden
     and p.display_name <> ''
     and (exists (select 1 from public.admins a where a.user_id = p.user_id)
          or exists (select 1 from public.creators c where c.user_id = p.user_id))
   order by p.sort, p.display_name
$$;
grant execute on function public.writers() to anon, authenticated;

-- 4. O texto da antiga página Contato vai para o fim da página Sobre, e a página Contato sai
--    (o endereço antigo /pagina/contato/ passa a levar para /escritores/)
update public.pages s
   set body = s.body || E'\n\n' || c.body
  from public.pages c
 where s.slug = 'sobre' and c.slug = 'contato'
   and position(c.body in s.body) = 0; -- não duplica se rodar de novo
delete from public.pages where slug = 'contato';

notify pgrst, 'reload schema';

-- Conferência: deve listar os escritores (aparecem depois de preencher o nome no painel)
select display_name, sort, hidden, bio <> '' as tem_texto, links from public.profiles order by sort, display_name;
