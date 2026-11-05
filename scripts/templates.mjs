/**
 * Modelos de HTML das páginas geradas pelo build (artigos, páginas fixas, 404 e a home pré-pronta).
 * O visual vem dos mesmos arquivos CSS do app; aqui só montamos o HTML.
 */

/** Monta o <head> comum (título, descrição, link canônico, prévias de link e dados estruturados). */
export function headMeta({ title, description, canonical, type = 'website', image, site, jsonLd, noindex = false }) {
  const { esc } = site.helpers;
  const meta = (attr, name, value) => `<meta ${attr}="${name}" content="${esc(value)}" />`;
  const ld = jsonLd ? `<script type="application/ld+json">${safeJson(jsonLd)}</script>` : '';
  return [
    `<meta name="description" content="${esc(description)}" />`,
    noindex ? '<meta name="robots" content="noindex" />' : '',
    canonical ? `<link rel="canonical" href="${esc(canonical)}" />` : '',
    meta('property', 'og:site_name', site.config.siteName),
    meta('property', 'og:locale', site.config.locale),
    meta('property', 'og:type', type),
    meta('property', 'og:title', title),
    meta('property', 'og:description', description),
    canonical ? meta('property', 'og:url', canonical) : '',
    meta('property', 'og:image', image),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', title),
    meta('name', 'twitter:description', description),
    meta('name', 'twitter:image', image),
    ld,
  ]
    .filter(Boolean)
    .join('\n    ');
}

/** JSON seguro para ficar dentro de <script> (impede fechar a tag por engano). */
const safeJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

const isHttp = (u) => /^https?:\/\//i.test(u || '');

/** Faixa do topo do card/artigo: imagem de capa (se houver) ou cor da categoria. `root` é o caminho até a raiz do site. */
export function coverHTML(p, { large = false, root, site }) {
  const { esc, colorOf } = site.helpers;
  const img = isHttp(p.img) ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : '';
  const cat = large
    ? `<a class="cover-cat" href="${root}#/cat/${encodeURIComponent(p.cat)}">${esc(p.cat)}</a>`
    : `<span class="cover-cat">${esc(p.cat)}</span>`;
  return `<div class="cover${large ? ' cover--lg' : ''}${isHttp(p.img) ? ' has-img' : ''}" style="background:${colorOf(p.cat)}">${img}${cat}</div>`;
}

/** Autor com foto pequena (iniciais se não houver foto); vazio se o autor não definiu o nome. */
export function bylineHTML(p, site) {
  const { esc } = site.helpers;
  const a = p.author_id && site.profiles && site.profiles[p.author_id];
  if (!a || !a.display_name) return '';
  const av = isHttp(a.avatar_url)
    ? `<img class="avatar" src="${esc(a.avatar_url)}" alt="" width="24" height="24" loading="lazy">`
    : `<span class="avatar avatar--ph" aria-hidden="true">${esc([...a.display_name][0].toUpperCase())}</span>`;
  return `<span class="byline">${av}<span>${esc(a.display_name)}</span></span>`;
}

/** Card de artigo (mesmo HTML do app, sem os botões de administrador). */
export function cardHTML(p, { root, site }) {
  const { esc, fmt } = site.helpers;
  const href = `${root}post/${p.slug}/`;
  return `
   <article class="card">${coverHTML(p, { root, site })}
   <div class="cb"><h2><a href="${href}">${esc(p.title)}</a></h2>
   <div class="meta">${bylineHTML(p, site)}<span>${fmt(p.date)}</span></div><p>${esc(p.excerpt)}</p>
   <div class="card-foot"><a href="${href}">Ler artigo</a></div></div></article>`;
}

/** Itens do menu do topo. */
export function navHTML(site, root) {
  const { esc } = site.helpers;
  return (
    `<a href="${root || './'}">Início</a>` +
    site.pages.map((g) => `<a href="${root}pagina/${g.slug}/">${esc(g.title)}</a>`).join('')
  );
}

/** Coluna lateral: sobre, busca, categorias, recentes e páginas (links para as páginas geradas). */
export function sideHTML(site, root) {
  const { esc } = site.helpers;
  const cats = {};
  site.posts.forEach((p) => (cats[p.cat] = (cats[p.cat] || 0) + 1));
  return `<div class="box"><h3>Sobre o blog</h3><p>Textos de psicologia para quem quer se entender melhor e assumir a própria história. Para o público em geral, estudantes e profissionais.</p></div>
   <div class="box"><h3>Buscar</h3><input type="text" id="q" placeholder="Digite e tecle Enter" aria-label="Buscar artigos"></div>
   <div class="box"><h3>Categorias</h3><ul>${
     Object.keys(cats)
       .sort()
       .map((c) => `<li><a href="${root}#/cat/${encodeURIComponent(c)}">${esc(c)}</a><span>${cats[c]}</span></li>`)
       .join('') || '<li>Nenhuma ainda</li>'
   }</ul></div>
   <div class="box"><h3>Artigos recentes</h3><ul>${site.posts
     .slice(0, 5)
     .map((p) => `<li><a href="${root}post/${p.slug}/">${esc(p.title)}</a></li>`)
     .join('')}</ul></div>
   <div class="box"><h3>Páginas</h3><ul>${site.pages
     .map((g) => `<li><a href="${root}pagina/${g.slug}/">${esc(g.title)}</a></li>`)
     .join('')}</ul></div>`;
}

/** Nome com o ponto em destaque (ocre): "Arcar.se" vira Arcar<span>.</span>se. */
const logoName = (name, esc) => esc(name).replace(/\./, '<span class="logo-dot">.</span>');

/** Documento completo de uma página gerada. `root` é o caminho até a raiz ("../../" ou "/arcar-se/"). */
export function pageShell({ site, root, title, head, main, adminHref, bodyAttrs = '', withViews = false }) {
  const { esc } = site.helpers;
  const c = site.config;
  return `<!doctype html>
<html lang="${esc(c.language)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(title)}</title>
    ${head}
    <link rel="icon" type="image/svg+xml" href="${root}assets/favicon.svg" />
    <link rel="icon" type="image/png" href="${root}assets/favicon.png" />
    <link rel="apple-touch-icon" href="${root}assets/apple-touch-icon.png" />
    <meta name="theme-color" content="#1e3b3a" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link
      href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Source+Sans+3:wght@400;600&family=Fraunces:opsz,wght@9..144,600&family=DM+Sans:wght@500&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="${root}css/variables.css" />
    <link rel="stylesheet" href="${root}css/base.css" />
    <link rel="stylesheet" href="${root}css/layout.css" />
    <link rel="stylesheet" href="${root}css/components.css" />
    <link rel="stylesheet" href="${root}css/featured.css" />
    <link rel="stylesheet" href="${root}css/responsive.css" />
    <script src="${root}js/theme.js"></script>
  </head>
  <body data-root="${esc(root)}"${bodyAttrs}>
    <header class="top">
      <div class="bar">
        <a class="logo" href="${root}" aria-label="${esc(c.siteName)}, ${esc(c.tagline.toLowerCase())}"><img class="logo-mark" src="${root}assets/logo/arcar-se-simbolo-negativo.svg" alt="" /><span class="logo-text"><span class="logo-name">${logoName(c.siteName, esc)}</span><small>${esc(c.tagline.toLowerCase())}</small></span></a>
        <div class="bar-actions">
          <nav id="nav">${navHTML(site, root)}</nav>
          <button id="theme-toggle" class="theme-btn" type="button"></button>
        </div>
      </div>
    </header>
    <div class="wrap">
      <main id="main">${main}</main>
      <aside id="side">${sideHTML(site, root)}</aside>
    </div>
    <footer>© <span id="yr">${site.year}</span> ${esc(c.siteName)} · Todos os direitos reservados${
      adminHref ? ` · <a href="${esc(adminHref)}" rel="nofollow">Admin</a>` : ''
    }</footer>
    ${withViews ? `<script src="${root}js/config.js"></script>\n    ` : ''}<script defer src="${root}js/static-page.js"></script>
  </body>
</html>
`;
}

/** Página de um artigo. */
export function postPage(p, site) {
  const { esc, fmt, md } = site.helpers;
  const root = '../../';
  const c = site.config;
  const url = `${site.base}/post/${p.slug}/`;
  const image = isHttp(p.img) ? p.img : `${site.base}/assets/og-default.png`;
  const description = (p.excerpt || '').trim().slice(0, 200) || c.description;
  const title = `${p.title} — ${c.siteName}`;
  const author = p.author_id && site.profiles && site.profiles[p.author_id] && site.profiles[p.author_id].display_name ? site.profiles[p.author_id] : null;
  const head = headMeta({
    title: p.title,
    description,
    canonical: url,
    type: 'article',
    image,
    site,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: p.title,
      description,
      image: [image],
      datePublished: p.date,
      articleSection: p.cat,
      inLanguage: c.language,
      mainEntityOfPage: url,
      publisher: { '@type': 'Organization', name: c.siteName },
      author: author ? { '@type': 'Person', name: author.display_name } : { '@type': 'Organization', name: c.siteName },
    },
  }).concat(`\n    <meta property="article:published_time" content="${esc(p.date)}" />`)
    .concat(`\n    <meta property="article:section" content="${esc(p.cat)}" />`);
  const main = `<article class="art">${coverHTML(p, { large: true, root, site })}<div class="meta">${bylineHTML(p, site)}<span>${fmt(p.date)}</span><span class="views" id="views" hidden></span></div>
   <h1>${esc(p.title)}</h1><div class="body">${md(p.body)}</div>
   <p><a href="${root}">← Voltar aos artigos</a></p></article>`;
  return pageShell({
    site,
    root,
    title,
    head,
    main,
    adminHref: `${root}#/editar/${p.slug}`,
    bodyAttrs: ` data-post="${esc(p.id)}" data-slug="${esc(p.slug)}"`,
    withViews: true,
  });
}

/** Página fixa (Sobre, Contato). */
export function fixedPage(g, site) {
  const { esc, md, plainText } = site.helpers;
  const root = '../../';
  const url = `${site.base}/pagina/${g.slug}/`;
  const firstText = plainText(g.body).slice(0, 160);
  const head = headMeta({
    title: g.title,
    description: firstText || site.config.description,
    canonical: url,
    image: `${site.base}/assets/og-default.png`,
    site,
  });
  const main = `<article class="art"><h1>${esc(g.title)}</h1><div class="body">${md(g.body)}</div></article>`;
  return pageShell({ site, root, title: `${g.title} — ${site.config.siteName}`, head, main });
}

/** Página 404 (o GitHub Pages usa o arquivo 404.html na raiz para qualquer endereço inexistente). */
export function notFoundPage(site) {
  const root = site.basePath + '/';
  const head = headMeta({
    title: 'Página não encontrada',
    description: site.config.description,
    image: `${site.base}/assets/og-default.png`,
    site,
    noindex: true,
  });
  const main = `<div class="box"><h1>Página não encontrada</h1><p>O endereço que você abriu não existe ou o artigo foi removido.</p><p><a href="${root}">← Voltar aos artigos</a></p></div>`;
  return pageShell({ site, root, title: `Página não encontrada — ${site.config.siteName}`, head, main });
}

/** Conteúdo pré-pronto da home (para buscadores e prévias; o app troca por sua própria versão ao carregar). */
export function homeMain(site) {
  const root = '';
  return (
    '<h1>Últimos artigos</h1>' +
    (site.posts.length
      ? '<div class="grid">' + site.posts.map((p) => cardHTML(p, { root, site })).join('') + '</div>'
      : '<div class="box">Nenhum artigo encontrado.</div>')
  );
}
