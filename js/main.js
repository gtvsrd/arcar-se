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
  // o build deixa a lista de artigos pronta na home; em outras rotas (busca, categoria, painel…) ela não deve piscar
  // na tela: enquanto os dados chegam, a tela já fica com o formato certo (sem a lateral no painel, editor recolhido)
  // e um esqueleto do conteúdo, em vez de "Carregando…"
  const onHome = !location.hash || location.hash === '#/';
  prepararTela();
  if (!onHome || !$('#main').children.length) $('#main').innerHTML = esqueletoHTML();
  try {
    // papel do usuário e dados ao mesmo tempo (antes era um depois do outro: uma ida ao servidor a mais)
    await Promise.all([checkRole(), loadAll(), loadManifest()]);
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
/** Formato da tela da rota atual antes de os dados chegarem (o route() confirma depois). */
function prepararTela() {
  const a = location.hash.replace(/^#\/?/, '').split('/')[0];
  const editando = a === 'novo' || a === 'editar';
  document.body.classList.toggle('on-panel', a === 'painel');
  document.body.classList.toggle('pagina-artigo', a === 'post' || editando);
  document.documentElement.classList.toggle('lado-recolhido', editando);
  // quem tem sessão neste navegador: no lugar do "Entrar", já aparece a barra da equipe (o nome chega com os dados)
  let logado = false;
  try {
    logado = Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k));
  } catch (e) {}
  if (!logado) return;
  document.querySelectorAll('#in, #authnav').forEach((e) => e.remove());
  const bar = $('#staffbar');
  if (bar && bar.hidden) {
    bar.innerHTML = `<span class="nav-me"><span class="avatar avatar--ph esq" aria-hidden="true"></span><span class="esq esq-linha" style="width:90px"></span></span>
     <div class="staffbar-links"><a href="#/painel">Painel</a><a href="#/novo" title="Novo artigo">Novo</a></div>`;
    bar.hidden = false;
  }
}

/** Esqueleto do conteúdo enquanto carrega: blocos cinza que pulsam, no formato da tela que vai abrir. */
function esqueletoHTML() {
  const a = location.hash.replace(/^#\/?/, '').split('/')[0];
  const linhas = (n) => Array.from({ length: n }, (_, i) => `<span class="esq esq-linha" style="width:${[92, 100, 84, 96, 70][i % 5]}%"></span>`).join('');
  if (a === 'painel')
    return `<div class="panel esq-tela" aria-busy="true" aria-label="Carregando o painel"><h1>Painel</h1>
      <div class="esq-abas">${'<span class="esq esq-linha"></span>'.repeat(5)}</div>
      <div class="esq-cards">${'<span class="esq esq-card"></span>'.repeat(5)}</div>
      <div class="box">${linhas(6)}</div></div>`;
  if (a === 'novo' || a === 'editar' || a === 'post' || a === 'pagina')
    return `<div class="art esq-tela" aria-busy="true" aria-label="Carregando"><span class="esq esq-titulo"></span>${linhas(8)}</div>`;
  return `<div class="esq-tela" aria-busy="true" aria-label="Carregando"><span class="esq esq-titulo"></span><div class="grid">${'<div class="card"><span class="esq esq-capa"></span><div class="cb">' + linhas(3) + '</div></div>'}${'<div class="card"><span class="esq esq-capa"></span><div class="cb">' + linhas(3) + '</div></div>'}</div></div>`;
}

start();
