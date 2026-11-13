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
   <span class="editbar-title">Edição rápida <span class="editbar-status">· ${editBarStatus(p)}</span></span>
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
        el.querySelector('.editbar-status').textContent = '· ' + editBarStatus(p);
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
