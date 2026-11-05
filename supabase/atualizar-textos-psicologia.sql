-- Arcar.se: troca os textos de exemplo (sobre escrita e viagens) pelos do tema de psicologia.
-- Rode UMA vez no Supabase (SQL Editor > New query > Run), colando o conteúdo deste arquivo.
-- Só muda os textos que ainda estão como no modelo inicial; o que você já reescreveu não é tocado.

-- 1) Conferir o que será alterado (pode rodar só este trecho):
select 'página' as tipo, slug, title from public.pages
  where body like '%um blog pessoal sobre escrita, viagens e curiosidades%'
union all
select 'artigo', slug, title from public.posts
  where excerpt = 'Um espaço para registrar ideias, projetos e aprendizados.';

-- 2) Aplicar a troca
update public.pages
  set body = replace(body, 'um blog pessoal sobre escrita, viagens e curiosidades',
                           'um blog de psicologia, com textos para o público em geral, estudantes e profissionais')
  where body like '%um blog pessoal sobre escrita, viagens e curiosidades%';

update public.posts
  set excerpt = 'Um espaço de psicologia para se entender melhor e assumir a própria história.'
  where excerpt = 'Um espaço para registrar ideias, projetos e aprendizados.';
