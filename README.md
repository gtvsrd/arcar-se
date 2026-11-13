# Arcar.se

Blog em HTML, CSS e JavaScript puros, com **Supabase** como back-end (banco, login e imagens).
Funciona no **GitHub Pages** e continua funcionando quando você trocar para um domínio da Hostinger.

Repositório: `github.com/gtvsrd/arcar-se` · Site: `https://arcar.se/` (o endereço antigo `https://gtvsrd.github.io/arcar-se/` redireciona para ele)

## Estrutura

```
blog/
├── index.html           Esqueleto e ordem dos scripts
├── site.config.json     Endereço do site, nome e descrição (usado nas páginas geradas)  <-- você edita
├── .nojekyll            Faz o GitHub Pages servir os arquivos como estão
├── .github/workflows/   publicar-site.yml: gera as páginas e publica no GitHub Pages
├── scripts/             build.mjs e templates.mjs: gerador das páginas de cada artigo
├── supabase/            schema.sql (banco novo) e arquivos de migração (banco já existente), incl. painel-e-criadores.sql
├── assets/              favicon.svg, favicon.png e og-default.png (imagem padrão de prévia de link)
├── css/                 variables, base, layout, components, featured, responsive
└── js/
    ├── vendor/supabase.js   Cliente Supabase 2.45.4 (arquivo local, sem CDN)
    ├── config.js            URL e chave do SEU projeto  <-- você edita
    ├── data/api.js          Artigos, páginas, capas e login
    ├── utils/               helpers.js, markdown.js, rich-editor.js (editor visual de artigos)
    ├── views/               layout-views.js, post-views.js, featured-views.js, editor-views.js
    ├── theme.js, auth.js, router.js, main.js, static-page.js (usado nas páginas geradas)
```

## Passo a passo

### 1. Criar o projeto no Supabase (grátis)
1. Crie uma conta em supabase.com e clique em **New project** (guarde a senha do banco).
2. Aguarde o projeto ficar pronto.

### 2. Criar o banco
1. Menu **SQL Editor > New query**.
2. Cole todo o conteúdo de `supabase/schema.sql` e clique em **Run** (rode só uma vez).

### 3. Ligar o blog ao projeto
1. Em **Project Settings > API**, copie a **Project URL** e a chave **anon / publishable**.
2. Cole os dois valores em `js/config.js`.

A chave anon é pública por natureza e pode ir para o GitHub: quem protege os dados são as regras do banco
(só o administrador consegue escrever). **Nunca** use a chave `service_role` no site.

### 4. Criar o administrador
1. **Authentication > Users > Add user > Create new user**: informe seu e-mail e senha e marque *Auto Confirm User*.
2. No **SQL Editor**, rode (troque o e-mail):
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'seu@email.com';
   ```
3. **Authentication > Sign In / Providers** (ou *Settings*): desligue **Allow new users to sign up**,
   para ninguém mais criar contas.

Pronto: no blog, clique em **Entrar** e use esse e-mail e senha.

### 5. Publicar no GitHub Pages
1. Crie um repositório **público** e envie todo o conteúdo da pasta `blog/` na raiz (incluindo `.nojekyll`, `.github/` e `scripts/`).
2. **Settings > Pages > Build and deployment > Source**: escolha **GitHub Actions** (não use mais *Deploy from a branch*).
3. Aba **Actions**: o workflow *Publicar site* roda sozinho a cada envio. Se não rodar, clique em **Run workflow**.
4. O site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`. Confira o endereço em `site.config.json` (campo `siteUrl`).

### 6. Páginas reais para cada artigo (SEO e prévia de links)
O workflow lê os artigos publicados no Supabase e gera, a cada execução:
- `post/<slug>/index.html`: uma página HTML completa por artigo, com título, descrição, imagem e prévia de link (Open Graph);
- `pagina/sobre/`, `escritores/` (cards da equipe; o endereço antigo `pagina/contato/` leva para lá), `sitemap.xml`, `robots.txt` e `404.html`;
- a home com a lista de artigos já dentro do HTML.

**Quando ele roda:** a cada envio ao GitHub, a cada 30 minutos e manualmente. Um artigo novo aparece no blog na hora,
mas só ganha página própria na próxima execução (até ~30 min). Para publicar imediatamente: Actions > Publicar site > Run workflow.
Observação: o GitHub desliga workflows agendados depois de 60 dias sem nenhuma atividade no repositório; se acontecer, reative na aba Actions.

**Endereços legíveis (slug):** o endereço vem do título (`/post/cinco-habitos-para-escrever-melhor/`). Mudar o título **não** muda o endereço;
só muda se você editar o campo "Endereço do artigo" no editor. Em banco já existente, rode `supabase/migracao-slugs.sql` uma vez.

**Testar o gerador no seu computador** (precisa do Node 18+): `node scripts/build.mjs` cria a pasta `_site/`; para ver,
`cd _site` e `python3 -m http.server 8000`.

**Google:** em search.google.com/search-console adicione o site (prefixo de URL com o endereço do blog) e envie o `sitemap.xml`.
Atenção: o `robots.txt` só é lido na raiz de um domínio; em `usuario.github.io/blog/` ele é ignorado (não atrapalha), e passa a valer com domínio próprio.

### 7. Depois: domínio da Hostinger
1. No GitHub: **Settings > Pages > Custom domain**, informe o domínio e marque *Enforce HTTPS*.
2. Na Hostinger (**Domínios > DNS / Zona DNS**):
   - 4 registros **A** no domínio raiz: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - 1 registro **CNAME** `www` apontando para `SEU-USUARIO.github.io`
3. Troque o `siteUrl` em `site.config.json` para o novo endereço (ex.: `https://meublog.com.br`). Nada muda no Supabase. Só se algum dia usar e-mail de recuperação de senha,
   adicione o domínio em **Authentication > URL Configuration**.

## Renomear o repositório ou trocar o domínio
O workflow descobre o endereço do site sozinho (usa o que o GitHub Pages informa), então canonical, sitemap e prévias de link se ajustam
na próxima execução. Depois de renomear o repositório ou ligar um domínio, faça apenas:
1. Actions > Publicar site > **Run workflow**;
2. No Supabase, **Authentication > URL Configuration**: ponha o novo endereço em *Site URL* e adicione-o em *Redirect URLs* (e-mails de senha usam esse endereço);
3. No Search Console, adicione o novo endereço e envie o `sitemap.xml` de novo;
4. Mude o `siteUrl` em `site.config.json` (só é usado quando você roda o build no seu computador).

Importante: o endereço antigo do GitHub Pages deixa de funcionar quando o repositório é renomeado (o GitHub não redireciona sites).

## Versão do site

A versão aparece no rodapé (ex.: `v1.0.1`) e fica em `site.config.json`, no campo `version`. Ela muda a cada alteração publicada:

- **correção** (ajuste visual, conserto de erro): sobe o último número — `1.0.0` → `1.0.1`;
- **novidade** (recurso ou página nova): sobe o do meio e zera o último — `1.0.1` → `1.1.0`;
- **reformulação grande** (visual ou estrutura inteira nova): sobe o primeiro — `1.4.2` → `2.0.0`.

Histórico:

- `1.3.1` — painel (e as outras telas do app) abre mais rápido: papel do usuário e dados carregados ao mesmo tempo; enquanto carrega, a tela já tem o formato certo e um esqueleto do conteúdo no lugar de "Carregando…".
- `1.3.0` — caixas da lateral editáveis no painel (aba Caixas): Avisos fixo abaixo da busca, que pode ser ocultado, e caixas livres no fim da lateral, que podem ser adicionadas, excluídas, reordenadas e ocultadas, cada uma com seu ícone. Requer `supabase/caixas-da-lateral.sql`.
- `1.2.1` — modo leitura também na edição de artigos (Novo e Editar), onde já abre com a coluna lateral recolhida. Quadro de avisos passa a se chamar "Avisos", com ícone da flecha e o ponto da logomarca; os ícones também aparecem antes dos títulos das caixas da lateral.
- `1.2.0` — modo leitura só nas páginas dos artigos. Botão "Ref." no editor: os parágrafos selecionados ficam no formato das referências bibliográficas (letra menor, alinhados à esquerda, espaço simples).
- `1.1.0` — modo leitura (telas grandes): a seta acima da coluna lateral a recolhe em botões com ícones, e a coluna principal ocupa o lugar das duas; cada ícone abre a sua caixa ao lado. Toda página abre com as duas colunas.
- `1.0.3` — todos os laranjas do site no ocre da logomarca (`#E0A84A`), nos dois temas: ponto do nome, filetes, sublinhados, chaves, selos e contadores (os selos usam o mesmo tom clareado ou escurecido).
- `1.0.2` — Entrar abre a janela de login na própria página em que a pessoa está (artigos, Sobre, Escritores), sem passar pela página inicial; depois de entrar, continua ali, já com as barras da equipe. Janela redesenhada: X de fechar no alto, links à esquerda e Entrar à direita. Topo sem o slogan, com símbolo, nome e menu alinhados.
- `1.0.1` — elementos surgem com esmaecer suave e em sequência; imagens aparecem aos poucos; o que muda de lugar desliza. Também: nova descrição do site, links de artigos sem `#` e imagem de prévia mais leve. Botão de tema só com o símbolo (sol ou lua), na mesma linha do menu no celular. Para a equipe logada, perfil, Painel, Novo e Sair saem do topo e vão para uma barra própria acima das duas colunas; acima de cada artigo, uma barra de edição rápida (Editar, Excluir, Destaque, Publicado) substitui os botões dos cards.
- `1.0.0` — primeira versão numerada.

## Observações
- Tudo o que você escreve fica salvo no Supabase, e as imagens de capa e do texto, no Storage (limite de 5 MB por imagem; o blog já as reduz antes de enviar).
- O editor é visual, com botões de negrito, sublinhado, listas, alinhamento, links e imagens. Imagens também podem ser coladas ou arrastadas para o texto, e são enviadas só ao salvar. Clique em uma imagem para subir, descer, editar ou remover; para mudá-la de linha, também dá para arrastá-la. O texto continua guardado em Markdown no banco, então artigos antigos abrem normalmente.
- Rascunhos só aparecem para o administrador logado.
- Plano grátis do Supabase: projetos sem uso por cerca de uma semana podem ser pausados; é só reativar no painel.
- Artigos criados na versão anterior (salvos no navegador) não são migrados. Recrie-os pelo painel.

## Painel, criadores e visualizações

Rode `supabase/painel-e-criadores.sql` uma vez no SQL Editor (banco já existente; em banco novo o `schema.sql` já inclui tudo).

- **Painel** (`#/painel`): lista compacta de artigos com filtros (busca, categoria, autor, situação, destaque, período) e ordenação; aba **Meu perfil** (nome de exibição e foto) e aba **Equipe** (só administrador).
- **Papéis**: administrador (tudo) e criador (cria artigos, envia para revisão, edita e exclui só os seus; não publica nem destaca). O administrador publica ou devolve com observação.
- **Liberar um criador**: Painel › Equipe › e-mail. A pessoa usa **Entrar › Primeiro acesso**, escolhe a senha e confirma pelo e-mail. Só e-mails liberados ganham acesso.
- **Visualizações**: cada artigo soma 1 leitura por visitante a cada 24h (equipe logada não conta). O número aparece no artigo, nos cards e no painel.
- O build do site tolera o banco sem esse SQL (sai sem autor e sem contador), mas o painel e as leituras dependem dele.
- **Esqueci a senha**: em **Entrar › Esqueci a senha** a pessoa recebe um e-mail com o link para criar uma nova senha (a resposta é sempre a mesma, exista ou não a conta). No Supabase, em Authentication › URL Configuration, o Site URL deve ser `https://arcar.se` e o Redirect URLs deve incluir `https://arcar.se/**`.
- **Categorias**: Painel › Categorias (só administrador) cria, renomeia (ou mescla, se o nome já existir) e exclui categorias; só dá para excluir as que nenhum artigo usa. No editor, o artigo recebe de 1 a 3 categorias escolhidas entre as cadastradas (a primeira é a principal). Rode `supabase/categorias.sql` uma vez.
- **Trocar autoria**: `supabase/trocar-autoria.sql` passa os artigos do administrador que mais assina para o outro administrador (só com exatamente 2 administradores).
- **Curtir e compartilhar** (abaixo do artigo): curtida anônima, uma por navegador e que pode ser desfeita (rode `supabase/curtidas.sql`); botão **Compartilhar** ao lado, que abre um menu com **Copiar link** e **WhatsApp**. O link compartilhado é sempre a página gerada do artigo, que tem as tags de prévia.
- **Imagens de prévia**: o build gera `og/<artigo>-<código>.jpg` (1200×630, JPEG leve) a partir da capa, com a biblioteca `sharp` instalada no GitHub Actions. Sem ela (ex.: build local), a prévia usa a capa original.
- **Imagem no texto do artigo**: no máximo uma por artigo (a capa é à parte). Fica sempre centralizada, num parágrafo só dela, e só muda de lugar entre parágrafos (Subir/Descer, Alt+↑/↓ ou arrastando). Selecionada, mostra alças nas bordas e nos cantos para redimensionar (20% a 100% da coluna, proporcional); em **Cortar**, as mesmas alças escolhem a parte que aparece (o corte é feito só na exibição, a imagem original continua inteira). **Legenda** aparece embaixo, centralizada. No Markdown: `![descrição](endereço){w=60 c=x,y,largura,altura r=proporção}` e a legenda na linha de baixo.

## Domínio

- Principal: **arcar.se** (sem www), publicado pelo GitHub Pages. DNS na Hostinger: 4 registros A e 4 AAAA no `@` apontando para o GitHub Pages e `www` como CNAME para `gtvsrd.github.io` (o GitHub redireciona o www para o endereço sem www).
- **arcarse.com**, **arcarse.org** e **arcarse.online** redirecionam (301) para `https://arcar.se`, pelo recurso de redirecionamento da Hostinger.
- O build usa o endereço que o GitHub Pages informa (`configure-pages`), então segue o domínio configurado em Settings › Pages; `siteUrl` em `site.config.json` é só a reserva para builds locais.
