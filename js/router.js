/**
 * Roteador por hash (#/...) e controle de acesso às rotas restritas
 */

/** Lê a URL (#/...) e mostra a tela correspondente. */
function route() {
  const h = location.hash.replace(/^#\/?/, '').split('/'),
    a = h[0],
    v = decodeURIComponent(h.slice(1).join('/'));
  stopCarousel();
  document.body.classList.toggle('on-panel', a === 'painel');
  // modo leitura só nas páginas dos artigos; fora delas a coluna lateral volta sempre ao normal
  document.body.classList.toggle('pagina-artigo', a === 'post');
  if (a !== 'post') document.documentElement.classList.remove('lado-recolhido');
  renderNav();
  renderSide();
  window.scrollTo(0, 0);
  const guard = ['novo', 'editar', 'editarpagina', 'conta', 'painel'];
  if (guard.includes(a) && (a === 'editarpagina' ? !admin : !staff())) {
    $('#main').innerHTML = '<div class="box">Esta área é restrita. Use o botão <b>Entrar</b> no topo da página.</div>';
    return;
  }
  if (a === 'post') {
    // Artigo com página própria: vai para ela (endereço sem #, com prévia de link)
    const p = findPost(v);
    const slug = p ? p.slug : v;
    if (temPaginaGerada(slug)) return location.replace(`post/${slug}/`);
    post(v);
  }
  // visitantes vão para as páginas geradas: o endereço na barra fica com a prévia certa ao compartilhar
  else if (a === 'escritores' || (a === 'pagina' && v === 'contato')) staff() ? (a === 'escritores' ? writersPage() : location.replace('#/escritores')) : location.replace('escritores/');
  else if (a === 'pagina' && v === 'avisos') location.replace(admin ? '#/painel/avisos' : '#/');
  else if (a === 'pagina' && !staff() && db.pages[v]) location.replace(`pagina/${v}/`);
  else if (a === 'pagina') page(v);
  else if (a === 'cat')
    cards(
      visible().filter((p) => catsOf(p).includes(v)),
      'Categoria: ' + esc(v),
    );
  else if (a === 'busca') {
    const q = v.toLowerCase();
    cards(
      visible().filter((p) => (p.title + p.excerpt + p.body).toLowerCase().includes(q)),
      'Resultados para “' + esc(v) + '”',
    );
  } else if (a === 'novo') editor('post');
  else if (a === 'editar') editor('post', v);
  else if (a === 'editarpagina') editor('page', v);
  else if (a === 'conta') account();
  else if (a === 'redefinir') resetPassword();
  else if (a === 'painel') panel(v);
  else if (a === 'entrar') openLogin(v);
  else home();
}
