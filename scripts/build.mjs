/**
 * Gera o site final na pasta _site/:
 *  - copia o app (index.html, css, js, assets)
 *  - lê do Supabase os artigos publicados e as páginas fixas
 *  - cria uma página HTML real para cada artigo (post/<slug>/index.html) e para cada página fixa
 *  - cria sitemap.xml, robots.txt, 404.html e post/manifest.json
 *  - deixa a lista de artigos já pronta dentro do index.html (para buscadores e prévias)
 *
 * Uso:  node scripts/build.mjs            (precisa do Node 18 ou mais novo)
 * Variáveis opcionais: SITE_URL, SUPABASE_URL, SUPABASE_KEY, OUT_DIR
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { cardHTML, homeMain, headMeta, navHTML, sideHTML, postPage, fixedPage, notFoundPage, writersPage, redirectPage } from './templates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.env.OUT_DIR || '_site');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const fail = (msg) => {
  console.error('\nERRO: ' + msg + '\n');
  process.exit(1);
};

// ---------- configuração ----------
const config = JSON.parse(read('site.config.json'));
// o GitHub informa "http://" enquanto o "Enforce HTTPS" não está marcado; o GitHub Pages sempre atende por HTTPS,
// então os links, as prévias e o sitemap usam https (exceto em testes locais)
if (process.env.SITE_URL) config.siteUrl = process.env.SITE_URL.replace(/^http:\/\/(?!localhost|127\.)/i, 'https://');
process.env.TZ = config.timezone || 'America/Sao_Paulo'; // as datas saem no mesmo fuso que o leitor vê no app

const base = config.siteUrl.replace(/\/+$/, '');
if (!/^https?:\/\//.test(base)) fail('"siteUrl" em site.config.json precisa começar com https://');
const basePath = new URL(base).pathname.replace(/\/+$/, ''); // "/arcar-se" ou "" (domínio próprio)

const cfgJs = read('js/config.js');
const grab = (name) => (cfgJs.match(new RegExp(`const ${name}\\s*=\\s*["']([^"']+)["']`)) || [])[1];
const SUPABASE_URL = (process.env.SUPABASE_URL || grab('SUPABASE_URL') || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_KEY || grab('SUPABASE_ANON_KEY');
if (!SUPABASE_URL || !SUPABASE_KEY || /SEU-PROJETO|SUA-CHAVE/.test(SUPABASE_URL + SUPABASE_KEY))
  fail('js/config.js não está preenchido com a URL e a chave do Supabase.');

// ---------- funções compartilhadas com o app (mesmo código do navegador, para o texto sair idêntico) ----------
const helpers = vm.runInNewContext(
  read('js/utils/helpers.js') + '\n' + read('js/utils/markdown.js') + '\n({ esc, fmt, fmtShort, colorOf, md, plainText, slugify, catsOf, hyphenateJustified, pageLabel, noticeHTML })',
  {},
);

// ---------- dados ----------
async function getJson(url, tries = 3) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
      if (r.ok) return await r.json();
      last = new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
    } catch (e) {
      last = e;
    }
    await new Promise((ok) => setTimeout(ok, 1500 * i));
  }
  throw last;
}

let posts, pages;
try {
  [posts, pages] = await Promise.all([
    getJson(`${SUPABASE_URL}/rest/v1/posts?select=*&pub=eq.true&order=date.desc&limit=1000`),
    getJson(`${SUPABASE_URL}/rest/v1/pages?select=*&order=slug.asc`),
  ]);
} catch (e) {
  fail('não foi possível ler os dados do Supabase (' + e.message + ').\nSe a mensagem citar a coluna "slug", rode supabase/migracao-slugs.sql no SQL Editor.');
}
// perfis (nome e foto dos autores): opcionais; se o SQL do painel ainda não foi aplicado, o site sai sem autor
let profileRows = [];
try {
  profileRows = await getJson(`${SUPABASE_URL}/rest/v1/profiles?select=*`, 1);
} catch (e) {
  console.warn('Aviso: perfis indisponíveis (rode supabase/painel-e-criadores.sql). O site sai sem nome de autor.');
}
const profiles = Object.fromEntries(profileRows.map((x) => [x.user_id, x]));
// escritores (página /escritores/): opcional; sem o supabase/escritores.sql a página sai vazia e o navegador tenta de novo
let writers = [];
try {
  writers = await getJson(`${SUPABASE_URL}/rest/v1/rpc/writers`, 1);
} catch (e) {
  console.warn('Aviso: lista de escritores indisponível (rode supabase/escritores.sql). A página sai sem cards.');
}
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
for (const p of posts)
  if (!SLUG.test(p.slug || '')) fail(`o artigo "${p.title}" não tem um slug válido. Rode supabase/migracao-slugs.sql no Supabase.`);
for (const g of pages) if (!SLUG.test(g.slug || '')) fail(`a página "${g.title}" tem um slug inválido: ${g.slug}`);
if (new Set(posts.map((p) => p.slug)).size !== posts.length) fail('há slugs repetidos nos artigos.');

const notice = pages.find((g) => g.slug === 'avisos') || null; // quadro de avisos da lateral
pages = pages.filter((g) => !['contato', 'avisos'].includes(g.slug)); // Contato virou Escritores; avisos não tem página própria
const pageOrder = ['sobre']; // Sobre primeiro, como no app; outras páginas depois
pages.sort((a, b) => {
  const i = (g) => (pageOrder.includes(g.slug) ? pageOrder.indexOf(g.slug) : pageOrder.length);
  return i(a) - i(b) || a.slug.localeCompare(b.slug);
});

// Carrossel de destaques: usa o mesmo featured-views.js do app, com o card estático do build
const featCtx = {};
vm.createContext(featCtx);
vm.runInContext(
  fs.readFileSync(path.join(ROOT, 'js/views/featured-views.js'), 'utf8') + '\n;this.featuredHTML = featuredHTML; this.HERO_MAX = HERO_MAX;',
  featCtx,
);
const site = { config, base, basePath, helpers, posts, pages, profiles, notice, year: new Date().getFullYear() };
featCtx.cardHTML = (p, hero) => cardHTML(p, { root: '', site, hero });
// faixa de curtir/compartilhar: mesmo HTML do app (js/post-actions.js)
const paCtx = { document: { addEventListener() {} } };
vm.createContext(paCtx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/post-actions.js'), 'utf8') + '\n;this.postActionsHTML = postActionsHTML;', paCtx);
site.postActions = paCtx.postActionsHTML;
site.featured = { HERO_MAX: featCtx.HERO_MAX, html: (list) => featCtx.featuredHTML(list) };
// cards de Escritores: mesmo writers-views.js do app
const wrCtx = { URL };
vm.createContext(wrCtx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/views/writers-views.js'), 'utf8') + '\n;this.writersPageHTML = writersPageHTML;', wrCtx);
site.writers = writers;
site.writersHTML = wrCtx.writersPageHTML;

// ---------- saída ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const dir of ['assets', 'css', 'js']) fs.cpSync(path.join(ROOT, dir), path.join(OUT, dir), { recursive: true });
// Cada CSS/JS/imagem do site ganha "?v=<impressão do conteúdo>" no HTML. Quando um arquivo muda, o endereço muda e o
// navegador é obrigado a baixar a versão nova (sem isso ele pode misturar arquivos novos e antigos do cache por ~10 min).
const hashes = {};
const versionOf = (rel) =>
  (hashes[rel] ??= crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex').slice(0, 10));
const bust = (html) =>
  html.replace(
    /((?:href|src)=")([^"#?]*?)((?:css|js|assets)\/[^"#?]+\.(?:css|js|svg|png|ico))"/g,
    (m, attr, prefix, rel) => (fs.existsSync(path.join(ROOT, rel)) ? `${attr}${prefix}${rel}?v=${versionOf(rel)}"` : m),
  );
const write = (rel, text) => {
  if (rel.endsWith('.html')) text = bust(text);
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
};

// páginas dos artigos e páginas fixas
// Imagem de prévia de cada artigo com capa (WhatsApp, Instagram, Facebook, X): 960×504 (proporção 1,91:1,
// ainda exibida como prévia grande), JPEG bem comprimido para carregar rápido, num arquivo
// do próprio site. Usa a biblioteca "sharp" (instalada no GitHub Actions); sem ela, a prévia usa a capa original.
let sharp = null;
const OG_L = 960, OG_A = 504; // tamanho das prévias de artigos
try {
  sharp = (await import('sharp')).default;
} catch (e) {
  console.warn('Aviso: "sharp" não instalado; as prévias usam a capa original.');
}
site.ogImages = {};
if (sharp)
  await Promise.all(
    posts
      .filter((p) => /^https?:\/\//i.test(p.img || ''))
      .map(async (p) => {
        try {
          const r = await fetch(p.img);
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const buf = Buffer.from(await r.arrayBuffer());
          // o nome muda quando a capa muda, para WhatsApp e cia. não mostrarem a prévia antiga guardada
          const name = `og/${p.slug}-${crypto.createHash('sha1').update(p.img).digest('hex').slice(0, 8)}.jpg`;
          fs.mkdirSync(path.join(OUT, 'og'), { recursive: true });
          const info = await sharp(buf)
            .rotate()
            .resize(OG_L, OG_A, { fit: 'cover', position: 'attention' })
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 68, mozjpeg: true, progressive: true, chromaSubsampling: '4:2:0' })
            .toFile(path.join(OUT, name));
          console.log(`Prévia de "${p.slug}": ${OG_L}x${OG_A}, ${Math.round(info.size / 1024)} KB (capa original ${Math.round(buf.length / 1024)} KB)`);
          site.ogImages[p.slug] = { url: `${base}/${name}`, width: OG_L, height: OG_A, type: 'image/jpeg' };
        } catch (e) {
          console.warn(`Aviso: prévia de "${p.slug}" não gerada (${e.message}); usando a capa original.`);
        }
      }),
  );

for (const p of posts) write(`post/${p.slug}/index.html`, postPage(p, site));
for (const g of pages) write(`pagina/${g.slug}/index.html`, fixedPage(g, site));
write('escritores/index.html', writersPage(site));
write('pagina/contato/index.html', redirectPage(site, `${base}/escritores/`));
write('post/manifest.json', JSON.stringify({ generatedAt: new Date().toISOString(), slugs: posts.map((p) => p.slug) }));
write('404.html', notFoundPage(site));

// home: o app (index.html) com meta tags e a lista de artigos já dentro
let index = read('index.html');
const swap = (from, to) => {
  if (!index.includes(from)) fail(`index.html mudou e o build não achou o trecho: ${from}`);
  index = index.replace(from, () => to);
};
const homeHead = headMeta({
  title: `${config.siteName} — ${config.tagline}`,
  description: config.description,
  canonical: base + '/',
  image: `${base}/assets/og-default.png`,
  site,
  jsonLd: { '@context': 'https://schema.org', '@type': 'Blog', name: config.siteName, description: config.description, url: base + '/', inLanguage: config.language },
});
swap('<link rel="icon" type="image/svg+xml"', homeHead + '\n    <link rel="icon" type="image/svg+xml"');
swap('<nav id="nav"></nav>', `<nav id="nav">${navHTML(site, '')}</nav>`);
swap('<main id="main"></main>', `<main id="main">${homeMain(site)}</main>`);
swap('<aside id="side"></aside>', `<aside id="side">${sideHTML(site, '')}</aside>`);
// versão do site no rodapé (site.config.json > version)
swap('<span class="ver"></span>', config.version ? `<span class="ver">v${config.version}</span>` : '');
write('index.html', index);

// sitemap e robots
const day = (d) => new Date(d).toISOString().slice(0, 10);
const url = (loc, lastmod) => `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${day(lastmod)}</lastmod>` : ''}</url>`;
write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    [
      url(base + '/', posts[0] && posts[0].date),
      ...pages.map((g) => url(`${base}/pagina/${g.slug}/`)),
      url(`${base}/escritores/`),
      ...posts.map((p) => url(`${base}/post/${p.slug}/`, p.date)),
    ].join('\n') +
    '\n</urlset>\n',
);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);

console.log(`Site gerado em ${path.relative(process.cwd(), OUT) || '.'}: ${posts.length} artigo(s), ${pages.length} página(s). Endereço base: ${base}`);
