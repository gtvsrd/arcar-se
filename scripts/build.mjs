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
import { homeMain, headMeta, navHTML, sideHTML, postPage, fixedPage, notFoundPage } from './templates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.env.OUT_DIR || '_site');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const fail = (msg) => {
  console.error('\nERRO: ' + msg + '\n');
  process.exit(1);
};

// ---------- configuração ----------
const config = JSON.parse(read('site.config.json'));
if (process.env.SITE_URL) config.siteUrl = process.env.SITE_URL;
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
  read('js/utils/helpers.js') + '\n' + read('js/utils/markdown.js') + '\n({ esc, fmt, colorOf, md, plainText, slugify, catsOf })',
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
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
for (const p of posts)
  if (!SLUG.test(p.slug || '')) fail(`o artigo "${p.title}" não tem um slug válido. Rode supabase/migracao-slugs.sql no Supabase.`);
for (const g of pages) if (!SLUG.test(g.slug || '')) fail(`a página "${g.title}" tem um slug inválido: ${g.slug}`);
if (new Set(posts.map((p) => p.slug)).size !== posts.length) fail('há slugs repetidos nos artigos.');

const pageOrder = ['sobre', 'contato']; // Sobre e Contato primeiro, como no app; outras páginas depois
pages.sort((a, b) => {
  const i = (g) => (pageOrder.includes(g.slug) ? pageOrder.indexOf(g.slug) : pageOrder.length);
  return i(a) - i(b) || a.slug.localeCompare(b.slug);
});

const site = { config, base, basePath, helpers, posts, pages, profiles, year: new Date().getFullYear() };

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
for (const p of posts) write(`post/${p.slug}/index.html`, postPage(p, site));
for (const g of pages) write(`pagina/${g.slug}/index.html`, fixedPage(g, site));
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
      ...posts.map((p) => url(`${base}/post/${p.slug}/`, p.date)),
    ].join('\n') +
    '\n</urlset>\n',
);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);

console.log(`Site gerado em ${path.relative(process.cwd(), OUT) || '.'}: ${posts.length} artigo(s), ${pages.length} página(s). Endereço base: ${base}`);
