-- Arcar.se: passa a autoria dos artigos do administrador atual para o OUTRO administrador.
-- Cole TODO o conteúdo no SQL Editor e clique em Run. Só funciona quando existem exatamente 2 administradores.
-- Artigos de criadores (colaboradores) não são alterados. O resultado final mostra quantos artigos cada administrador tem.

do $$
declare antigo uuid; novo uuid; n int;
begin
  select count(*) into n from public.admins;
  if n <> 2 then
    raise exception 'Esperava exatamente 2 administradores, mas existem %. Me peça a versão com o e-mail escolhido.', n;
  end if;
  -- "antigo" = o administrador que hoje mais assina artigos; "novo" = o outro
  select author_id into antigo from public.posts
   where author_id in (select user_id from public.admins)
   group by author_id order by count(*) desc limit 1;
  if antigo is null then raise exception 'Nenhum artigo de administrador para trocar.'; end if;
  select user_id into novo from public.admins where user_id <> antigo;
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
 order by u.email;
