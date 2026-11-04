-- Arcar.se: troca a grafia "Arcar-se" (com hífen) por "Arcar.se" (com ponto) nos textos já salvos no banco.
-- Rode UMA vez no Supabase (SQL Editor > New query > Run), colando o conteúdo deste arquivo. Os endereços (slugs) não mudam.

-- 1) Conferir o que será alterado (pode rodar só este trecho):
select 'artigo' as tipo, slug, title from public.posts
  where concat(title, ' ', excerpt, ' ', body) like '%Arcar-se%'
union all
select 'página', slug, title from public.pages
  where concat(title, ' ', body) like '%Arcar-se%';

-- 2) Aplicar a troca
update public.posts set
  title   = replace(title,   'Arcar-se', 'Arcar.se'),
  excerpt = replace(excerpt, 'Arcar-se', 'Arcar.se'),
  body    = replace(body,    'Arcar-se', 'Arcar.se')
where concat(title, ' ', excerpt, ' ', body) like '%Arcar-se%';

update public.pages set
  title = replace(title, 'Arcar-se', 'Arcar.se'),
  body  = replace(body,  'Arcar-se', 'Arcar.se')
where concat(title, ' ', body) like '%Arcar-se%';
