/**
 * Ponto de entrada: carrega os dados do Supabase e inicia o blog
 */

let ready = false; // só roteia depois que os dados chegaram

$('#yr').textContent = new Date().getFullYear();
initAuth();
initThemeToggle();
window.addEventListener('hashchange', () => ready && route());

/** Carrega artigos e páginas e mostra a tela da URL atual. */
async function start() {
  if (!isConfigured()) {
    $('#main').innerHTML =
      '<div class="box"><h3>Configure o Supabase</h3><p>Preencha <code>js/config.js</code> com a URL e a chave do seu projeto. Veja o README.</p></div>';
    return;
  }
  // o build deixa a lista de artigos pronta na home; em outras rotas (busca, categoria…) ela não deve piscar na tela
  const onHome = !location.hash || location.hash === '#/';
  if (!onHome || !$('#main').children.length) $('#main').innerHTML = '<div class="box">Carregando…</div>';
  try {
    await checkRole();
    await Promise.all([loadAll(), loadManifest()]);
    ready = true;
    route();
  } catch (e) {
    $('#main').innerHTML = '<div class="box">Não foi possível carregar os artigos. Recarregue a página.</div>';
  }
}
start();
