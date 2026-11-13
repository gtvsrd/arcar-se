/**
 * Barra de edição rápida, acima do artigo (na coluna dele), para quem pode editá-lo.
 * Mesmo visual da barra da equipe. Atalhos: Editar, Excluir e, só para o administrador, Destaque e Publicado.
 * Usada no app (tela do artigo) e nas páginas geradas de cada artigo (carregada por static-page.js quando há sessão).
 *
 * Depende de: api.js (admin, canEdit, db, savePost, deletePost, deleteUnusedImages), markdown.js (mdImages),
 * helpers.js (esc, toast) e featured-views.js (HERO_MAX).
 */

/** Rótulo da situação do artigo, à esquerda da barra. */
function editBarStatus(p) {
  return { published: 'Publicado', review: 'Em revisão', returned: 'Devolvido', draft: 'Rascunho' }[postStatus(p)];
}

/** HTML da barra. `editHref`: endereço da tela de edição. Vazio se o usuário não pode editar o artigo. */
function editBarHTML(p, editHref) {
  if (!p || !canEdit(p)) return '';
  const toggle = (k, on, label, hint) =>
    `<button type="button" class="eb-toggle" data-eb="${k}" aria-pressed="${on}" title="${hint}"><span class="eb-switch" aria-hidden="true"></span>${label}</button>`;
  return `<div class="editbar" role="toolbar" aria-label="Edição rápida do artigo">
   <span class="editbar-title"><span class="eb-label">Edição rápida</span> <span class="editbar-status">${editBarStatus(p)}</span></span>
   <div class="editbar-links"><a href="${esc(editHref)}">Editar</a><button type="button" data-eb="del">Excluir</button>${
     admin
       ? `<span class="eb-toggles">${toggle('feat', !!p.featured, 'Destaque', 'Mostrar no carrossel da página inicial')}${toggle('pub', !!p.pub, 'Publicado', 'Visível para os leitores')}</span>`
       : ''
   }</div>
  </div>`;
}

/**
 * Liga os botões da barra `el` do artigo `p`.
 * `onChange(p)`: depois de salvar Destaque/Publicado (com o artigo atualizado). `onDelete()`: depois de excluir.
 */
function initEditBar(el, p, { onChange, onDelete }) {
  if (!el || !p) return;
  ajustarEditBar(el);
  const del = el.querySelector('[data-eb="del"]');
  del.onclick = async () => {
    if (del.dataset.ok !== '1') {
      del.dataset.ok = '1';
      del.textContent = 'Confirmar exclusão';
      setTimeout(() => {
        del.dataset.ok = '';
        del.textContent = 'Excluir';
      }, 3000);
      return;
    }
    del.disabled = true;
    try {
      await deletePost(p.id);
      deleteUnusedImages([p.img, ...mdImages(p.body)]);
      toast('Artigo excluído');
      onDelete();
    } catch (err) {
      del.disabled = false;
      toast('Não foi possível excluir: ' + (err.message || 'erro'));
    }
  };
  el.querySelectorAll('.eb-toggle').forEach((b) => {
    b.onclick = async () => {
      const k = b.dataset.eb,
        on = b.getAttribute('aria-pressed') !== 'true';
      if (k === 'feat' && on && db.posts.filter((x) => x.featured && x.id !== p.id).length >= HERO_MAX) {
        toast(`Já existem ${HERO_MAX} artigos em destaque. Tire o destaque de outro antes.`);
        return;
      }
      b.disabled = true;
      try {
        await savePost({ id: p.id, ...(k === 'feat' ? { featured: on } : { pub: on }) });
        const novo = db.posts.find((x) => x.id === p.id) || { ...p, [k === 'feat' ? 'featured' : 'pub']: on };
        Object.assign(p, novo);
        b.setAttribute('aria-pressed', String(on));
        el.querySelector('.editbar-status').textContent = editBarStatus(p);
        toast(
          k === 'feat'
            ? on
              ? 'Artigo em destaque na página inicial'
              : 'Destaque removido'
            : on
              ? 'Artigo publicado'
              : 'Artigo tirado do ar',
        );
        onChange(p, k);
      } catch (err) {
        toast('Não foi possível salvar: ' + (err.message || 'erro'));
      }
      b.disabled = false;
    };
  });
}

/**
 * Barra compacta enquanto o conteúdo completo não cabe numa linha só: sai o título "Edição rápida" e tudo vai
 * para o centro. Se nem assim couber, fica em duas linhas: a situação e Editar/Excluir em pontas opostas em cima,
 * as chaves Destaque e Publicado centralizadas embaixo. Mede de verdade, a cada mudança de largura: o ponto de troca acompanha os atalhos que a barra tem
 * (o do administrador é mais largo que o do autor) e o tamanho da fonte.
 */
function ajustarEditBar(el) {
  if (el._medirBarra) return el._medirBarra(); // já ligada (a tela foi redesenhada): só mede de novo
  // cabe tudo numa linha só? (mede a largura de tudo lado a lado; nada disso chega a ser pintado)
  const cabe = (disponivel) => {
    el.classList.add('eb-medir');
    const precisa = el.getBoundingClientRect().width;
    el.classList.remove('eb-medir');
    return precisa <= disponivel + 0.5;
  };
  const medir = (el._medirBarra = () => {
    el.classList.remove('compacta', 'duas-linhas');
    const disponivel = el.getBoundingClientRect().width;
    if (cabe(disponivel)) return; // completa, numa linha
    el.classList.add('compacta'); // sem o título
    if (!cabe(disponivel)) el.classList.add('duas-linhas'); // situação | Editar Excluir  /  chaves embaixo
  });
  medir();
  if (window.ResizeObserver) {
    let largura = el.clientWidth;
    new ResizeObserver(() => {
      if (el.clientWidth !== largura) {
        largura = el.clientWidth;
        medir();
      }
    }).observe(el);
  }
}
