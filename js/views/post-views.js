/**
 * Telas de leitura: cards, artigo completo e páginas
 */

/** Faixa do topo do card/artigo: imagem de capa (se houver) ou cor da categoria, com a categoria em destaque. */
function coverHTML(p, large) {
  const img = p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : '';
  const cat =
    '<div class="cover-cats">' +
    catsOf(p)
      .map((c, i) => {
        const cls = 'cover-cat' + (i ? ' cover-cat--more' : '');
        return large
          ? `<a class="${cls}" href="#/cat/${encodeURIComponent(c)}">${esc(c)}</a>`
          : `<span class="${cls}">${esc(c)}</span>`;
      })
      .join('') +
    '</div>';
  return `<div class="cover${large ? ' cover--lg' : ''}${p.img ? ' has-img' : ''}" style="background:${colorOf(p.cat)}">${img}${cat}</div>`;
}

/** Selo de situação do artigo (nada se estiver publicado). */
function badgeHTML(p) {
  const st = postStatus(p);
  const label = { draft: 'rascunho', review: 'em revisão', returned: 'devolvido' }[st];
  return label ? `<span class="draft draft--${st}">${label}</span>` : '';
}

/** Autor com foto pequena (iniciais se não houver foto). Vazio se o autor não definiu o nome. */
function bylineHTML(p) {
  const a = authorOf(p);
  if (!a) return '';
  const av = a.avatar_url
    ? `<img class="avatar" src="${esc(a.avatar_url)}" alt="" width="24" height="24" loading="lazy">`
    : `<span class="avatar avatar--ph" aria-hidden="true">${esc([...a.display_name][0].toUpperCase())}</span>`;
  return `<span class="byline">${av}<span>Por <strong>${esc(a.display_name)}</strong></span></span>`;
}

/** Linha de informações do artigo: autor, data e leituras. */
const viewsHTML = (p) =>
  p.pub && db.viewsOn ? `<span class="views" data-views="${p.id}">${viewsLabel(viewsOf(p))}</span>` : '';
const metaHTML = (p, short = false, withViews = true) =>
  `<div class="meta">${bylineHTML(p)}<span>${short ? fmtShort(p.date) : fmt(p.date)}</span>${withViews ? viewsHTML(p) : ''}</div>`;

/** HTML de um card de artigo (usado na grade e no carrossel de destaques). */
function cardHTML(p, hero = false) {
  return `
   <article class="card">${coverHTML(p)}
   <div class="cb"><h2><a href="${postUrl(p)}">${esc(p.title)}</a>${badgeHTML(p)}</h2>
   ${metaHTML(p, !hero, false)}<p>${esc(p.excerpt)}</p>
   <div class="card-foot"><a class="more" href="${postUrl(p)}">Ler artigo</a>${viewsHTML(p)}</div></div></article>`;
}

/** Desenha a grade de cards (home, categoria e busca). `prefix` é o HTML mostrado acima (destaques). */
function cards(list, title, prefix = '') {
  const grid = list.length
    ? '<div class="grid">' + list.map((p) => cardHTML(p)).join('') + '</div>'
    : prefix
      ? ''
      : '<div class="box">Nenhum artigo encontrado.</div>';
  trocar('#main', prefix + (title && (list.length || !prefix) ? `<h1>${title}</h1>` : '') + grid);
  initCarousel();
}

/** Página inicial: destaques (carrossel) no topo e os demais artigos na grade abaixo. */
function home() {
  const all = visible();
  const feat = all.filter((p) => p.featured).slice(0, HERO_MAX);
  cards(
    all.filter((p) => !feat.includes(p)),
    'Últimos artigos',
    featuredHTML(feat),
  );
}

/** Liga os botões Excluir, com confirmação no segundo clique. */
function bindDel() {
  document.querySelectorAll('[data-del]').forEach(
    (b) =>
      (b.onclick = async () => {
        if (b.dataset.ok !== '1') {
          b.dataset.ok = '1';
          b.textContent = 'Confirmar exclusão';
          setTimeout(() => {
            b.dataset.ok = '';
            b.textContent = 'Excluir';
          }, 3000);
          return;
        }
        try {
          const gone = db.posts.find((p) => p.id === b.dataset.del);
          await deletePost(b.dataset.del);
          if (gone) deleteUnusedImages([gone.img, ...mdImages(gone.body)]);
          toast('Artigo excluído');
          if (!location.hash.startsWith('#/painel')) location.hash = '#/'; // no painel, continua na lista
          route();
        } catch (err) {
          toast('Não foi possível excluir: ' + err.message);
        }
      }),
  );
}

/** Endereço para compartilhar: a página gerada do artigo (tem as prévias); se ainda não foi gerada, o endereço do app. */
function shareUrl(p) {
  const base = location.href.split('#')[0].replace(/index\.html$/, '');
  return builtSlugs.has(p.slug) ? new URL(`post/${p.slug}/`, base).href : `${base}#/post/${p.slug}`;
}

/** Desenha um artigo completo. */
function post(key) {
  const p = findPost(key);
  if (!p || !(p.pub || admin || canEdit(p))) {
    $('#main').innerHTML = '<div class="box">Artigo não encontrado. <a href="#/">Voltar ao início</a></div>';
    return;
  }
  trocar(
    '#main',
    editBarHTML(p, `#/editar/${p.id}`) +
      `<article class="art">${coverHTML(p, true)}${metaHTML(p).replace('</div>', badgeHTML(p) + '</div>')}
   <h1>${esc(p.title)}</h1><div class="body">${hyphenateJustified(md(p.body))}</div>
   ${p.pub ? postActionsHTML({ id: p.id, slug: p.slug, url: shareUrl(p), title: p.title }) : ''}
   <p><a href="#/">← Voltar aos artigos</a></p></article>`,
  );
  initEditBar(document.querySelector('#main .editbar'), p, {
    onChange: () => post(key),
    onDelete: () => (location.hash = '#/'),
  });
  initPostActions(document.querySelector('.art .post-actions'));
  registerView(p).then((n) => {
    const el = document.querySelector('.art [data-views]');
    if (el && n !== null) el.textContent = viewsLabel(n);
  });
}
/** Página Escritores: mostra o que já tem em memória e atualiza com a lista do banco. */
async function writersPage() {
  trocar(
    '#main',
    writersPageHTML(db.writers || []).replace('</article>', staff() ? `<div class="acts"><a class="btn sm alt" href="#/painel/${admin ? 'escritores' : 'perfil'}">${admin ? 'Editar escritores' : 'Editar meu card'}</a></div></article>` : '</article>'),
  );
  if (!db.writers) $('#writers-list').innerHTML = '<p class="writers-empty">Carregando…</p>';
  try {
    db.writers = await loadWriters();
  } catch (e) {
    db.writers = db.writers || [];
  }
  const box = $('#writers-list');
  if (box && location.hash.startsWith('#/escritores')) trocar(box, writersHTML(db.writers));
}
/** Desenha uma página fixa (Sobre). */
function page(k) {
  const pg = db.pages[k];
  if (!pg) {
    location.hash = '#/';
    return;
  }
  trocar(
    '#main',
    `<article class="art"><h1>${esc(pg.title)}</h1><div class="body">${hyphenateJustified(md(pg.body))}</div>
   ${admin ? `<div class="acts"><a class="btn sm alt" href="#/editarpagina/${k}">Editar página</a></div>` : ''}</article>`,
  );
}
