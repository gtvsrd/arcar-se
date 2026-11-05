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
  renderNav();
  renderSide();
  window.scrollTo(0, 0);
  const guard = ['novo', 'editar', 'editarpagina', 'conta', 'painel'];
  if (guard.includes(a) && (a === 'editarpagina' ? !admin : !staff())) {
    $('#main').innerHTML = '<div class="box">Esta área é restrita. Use o botão <b>Entrar</b> no topo da página.</div>';
    return;
  }
  if (a === 'post') post(v);
  else if (a === 'pagina') page(v);
  else if (a === 'cat')
    cards(
      visible().filter((p) => p.cat === v),
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
  else home();
}
