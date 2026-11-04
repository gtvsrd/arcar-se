-- Arcar.se: troca o nome antigo ("Diário de Bordo") nos textos que já estão salvos no banco.
-- Rode UMA vez no Supabase (SQL Editor > New query > Run). Os endereços (slugs) dos artigos NÃO mudam.

-- 1) Confira primeiro o que será alterado (rode só este trecho para ver a lista):
select 'artigo' as tipo, slug, title from public.posts
  where concat(title, ' ', excerpt, ' ', body) ~* 'di[aá]rio de bordo'
union all
select 'página', slug, title from public.pages
  where concat(title, ' ', body) ~* 'di[aá]rio de bordo';

-- 2) Aplicar a troca
update public.posts set
  title   = regexp_replace(title,   'di[aá]rio de bordo', 'Arcar.se', 'gi'),
  excerpt = regexp_replace(excerpt, 'di[aá]rio de bordo', 'Arcar.se', 'gi'),
  body    = regexp_replace(body,    'di[aá]rio de bordo', 'Arcar.se', 'gi')
where concat(title, ' ', excerpt, ' ', body) ~* 'di[aá]rio de bordo';

update public.pages set
  title = regexp_replace(title, 'di[aá]rio de bordo', 'Arcar.se', 'gi'),
  body  = regexp_replace(body,  'di[aá]rio de bordo', 'Arcar.se', 'gi')
where concat(title, ' ', body) ~* 'di[aá]rio de bordo';
