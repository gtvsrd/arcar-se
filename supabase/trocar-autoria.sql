-- Arcar.se: passa a autoria dos artigos para um administrador escolhido pelo e-mail.
-- Passo 1: rode como está. Aparece a lista de administradores (com e-mail) e quantos artigos cada um tem; "(sem autor)" são os artigos antigos.
-- Passo 2: troque o e-mail na linha marcada abaixo pelo do administrador que vai assinar os artigos e rode de novo.
-- Artigos de criadores (colaboradores) não são alterados.

do $$
declare
  novo_email text := 'COLOQUE-AQUI-O-EMAIL-DO-ADMINISTRADOR';  -- <<< troque só este texto, mantendo as aspas
  novo uuid;
begin
  if novo_email like 'COLOQUE-AQUI%' then return; end if; -- passo 1: só mostra a lista
  select a.user_id into novo from public.admins a join auth.users u on u.id = a.user_id
   where lower(u.email) = lower(btrim(novo_email));
  if novo is null then
    raise exception 'O e-mail % não é de um administrador. Confira a lista do passo 1.', novo_email;
  end if;
  -- o gatilho posts_guard protege o autor contra alterações; aqui a troca é intencional, então ele fica desligado só durante o UPDATE
  alter table public.posts disable trigger posts_guard;
  update public.posts set author_id = novo
   where author_id is null or author_id in (select user_id from public.admins);
  alter table public.posts enable trigger posts_guard;
end
$$;

select u.email, coalesce(p.display_name, '(sem nome de exibição)') as nome,
       (select count(*) from public.posts where author_id = a.user_id) as artigos
  from public.admins a
  join auth.users u on u.id = a.user_id
  left join public.profiles p on p.user_id = a.user_id
union all
select '(sem autor)', '', count(*) from public.posts where author_id is null
order by 1;
