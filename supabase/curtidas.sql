-- Arcar.se: curtidas anônimas nos artigos.
-- Rode UMA vez no Supabase (SQL Editor > New query > cole TODO o conteúdo > Run). Pode rodar de novo sem estragar nada.

create table if not exists public.post_likes (
  post_id uuid primary key references public.posts (id) on delete cascade,
  likes bigint not null default 0 check (likes >= 0)
);
alter table public.post_likes enable row level security;
drop policy if exists "curtidas: leitura" on public.post_likes;
create policy "curtidas: leitura" on public.post_likes for select using (true); -- sem política de escrita: só a função abaixo altera

-- Curte (p_like = true) ou desfaz a curtida (false) de um artigo publicado; devolve o total
create or replace function public.like_post(p_slug text, p_like boolean default true) returns bigint
language plpgsql security definer set search_path = public as $$
declare pid uuid; total bigint;
begin
  select id into pid from public.posts where slug = p_slug and pub;
  if pid is null then return 0; end if;
  if p_like then
    insert into public.post_likes (post_id, likes) values (pid, 1)
    on conflict (post_id) do update set likes = public.post_likes.likes + 1
    returning likes into total;
  else
    update public.post_likes set likes = greatest(likes - 1, 0) where post_id = pid returning likes into total;
  end if;
  return coalesce(total, 0);
end
$$;
grant execute on function public.like_post(text, boolean) to anon, authenticated;
