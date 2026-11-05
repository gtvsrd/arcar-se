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
    // link recebido por e-mail: redefinição de senha (ou link com erro) abre a tela própria; confirmação de cadastro avisa
    if (AUTH_LINK.recovery || AUTH_LINK.error) location.replace(location.pathname + location.search + '#/redefinir');
    else if (/[#&]access_token=/.test(location.hash) || AUTH_LINK.signup) {
      history.replaceState(null, '', location.pathname + location.search + '#/');
      if (AUTH_LINK.signup && staff()) toast('E-mail confirmado. Você já está logado.');
      else if (AUTH_LINK.signup) toast('E-mail confirmado. Agora use Entrar.');
    }
    route();
  } catch (e) {
    $('#main').innerHTML = '<div class="box">Não foi possível carregar os artigos. Recarregue a página.</div>';
  }
}
start();
