# Arcar.se

Blog em HTML, CSS e JavaScript puros, com **Supabase** como back-end (banco, login e imagens).
Funciona no **GitHub Pages** e continua funcionando quando você trocar para um domínio da Hostinger.

Repositório: `github.com/gtvsrd/arcar-se` · Site: `https://gtvsrd.github.io/arcar-se/`

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
- `pagina/sobre/` e `pagina/contato/`, `sitemap.xml`, `robots.txt` e `404.html`;
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
