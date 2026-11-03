/**
 * Telas de leitura: cards, artigo completo e páginas
 */

/** Faixa do topo do card/artigo: imagem de capa (se houver) ou cor da categoria, com a categoria em destaque. */
function coverHTML(p, large) {
  const img = p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : '';
  const cat = large
    ? `<a class="cover-cat" href="#/cat/${encodeURIComponent(p.cat)}">${esc(p.cat)}</a>`
    : `<span class="cover-cat">${esc(p.cat)}</span>`;
  return `<div class="cover${large ? ' cover--lg' : ''}${p.img ? ' has-img' : ''}" style="background:${colorOf(p.cat)}">${img}${cat}</div>`;
}

/** HTML de um card de artigo (usado na grade e no carrossel de destaques). */
function cardHTML(p) {
  return `
   <article class="card">${coverHTML(p)}
   <div class="cb"><h2><a href="${postUrl(p)}">${esc(p.title)}</a>${p.pub ? '' : '<span class="draft">rascunho</span>'}</h2>
   <div class="meta">${fmt(p.date)}</div><p>${esc(p.excerpt)}</p>
   <div class="card-foot"><a href="${postUrl(p)}">Ler artigo</a>
   ${admin ? `<div class="acts"><a class="btn sm alt" href="#/editar/${p.id}">Editar</a><button class="btn sm del" data-del="${p.id}">Excluir</button></div>` : ''}</div></div></article>`;
}

/** Desenha a grade de cards (home, categoria e busca). `prefix` é o HTML mostrado acima (destaques). */
function cards(list, title, prefix = '') {
  const grid = list.length
    ? '<div class="grid">' + list.map(cardHTML).join('') + '</div>'
    : prefix
      ? ''
      : '<div class="box">Nenhum artigo encontrado.</div>';
  $('#main').innerHTML = prefix + (title && (list.length || !prefix) ? `<h1>${title}</h1>` : '') + grid;
  bindDel();
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
          location.hash = '#/';
          route();
        } catch (err) {
          toast('Não foi possível excluir: ' + err.message);
        }
      }),
  );
}

/** Desenha um artigo completo. */
function post(key) {
  const p = findPost(key);
  if (!p || (!p.pub && !admin)) {
    $('#main').innerHTML = '<div class="box">Artigo não encontrado. <a href="#/">Voltar ao início</a></div>';
    return;
  }
  $('#main').innerHTML =
    `<article class="art">${coverHTML(p, true)}<div class="meta">${fmt(p.date)}${p.pub ? '' : '<span class="draft">rascunho</span>'}</div>
   <h1>${esc(p.title)}</h1><div class="body">${md(p.body)}</div>
   ${admin ? `<div class="acts"><a class="btn sm alt" href="#/editar/${p.id}">Editar</a><button class="btn sm del" data-del="${p.id}">Excluir</button></div>` : ''}
   <p><a href="#/">← Voltar aos artigos</a></p></article>`;
  bindDel();
}
/** Desenha uma página fixa (Sobre, Contato). */
function page(k) {
  const pg = db.pages[k];
  if (!pg) {
    location.hash = '#/';
    return;
  }
  $('#main').innerHTML = `<article class="art"><h1>${esc(pg.title)}</h1><div class="body">${md(pg.body)}</div>
   ${admin ? `<div class="acts"><a class="btn sm alt" href="#/editarpagina/${k}">Editar página</a></div>` : ''}</article>`;
}
