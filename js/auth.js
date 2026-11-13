/**
 * Entrada da equipe (janela modal): login de administradores e criadores, primeiro acesso e "esqueci a senha"
 */

/**
 * Liga os eventos da janela de login.
 * `aoEntrar(papel)`: o que fazer depois de entrar. Sem ele (no app), redesenha a tela atual.
 */
function initAuth({ aoEntrar } = {}) {
  const ok = $('#lok'),
    first = $('#lfirst'),
    forgot = $('#lforgot');
  let mode = 'login'; // 'login' | 'first' | 'forgot'

  // alterna entre "Entrar", "Primeiro acesso" e "Esqueci a senha"
  const setMode = (m) => {
    mode = m;
    $('#ltitle').textContent = { login: 'Entrar', first: 'Primeiro acesso de criador', forgot: 'Esqueci a senha' }[m];
    $('#lhelp').hidden = m === 'login';
    $('#lhelp').textContent =
      m === 'first'
        ? 'Use o e-mail que o administrador liberou e escolha uma senha. Depois confirme pelo link que chegar no seu e-mail.'
        : m === 'forgot'
          ? 'Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.'
          : '';
    $('#plabel').hidden = $('#p').hidden = m === 'forgot';
    ok.textContent = { login: 'Entrar', first: 'Criar acesso', forgot: 'Enviar link' }[m];
    first.textContent = m === 'first' ? 'Já tenho acesso' : 'Primeiro acesso';
    forgot.textContent = m === 'forgot' ? 'Voltar para entrar' : 'Esqueci a senha';
    $('#p').autocomplete = m === 'first' ? 'new-password' : 'current-password';
    $('#lerr').textContent = '';
    $('#lerr').classList.remove('ok');
  };
  first.onclick = () => setMode(mode === 'first' ? 'login' : 'first');
  forgot.onclick = () => setMode(mode === 'forgot' ? 'login' : 'forgot');
  $('#dlg').addEventListener('close', () => setMode('login'));

  ok.onclick = async () => {
    ok.disabled = true;
    const err = $('#lerr');
    err.textContent = '';
    err.classList.remove('ok');
    try {
      const email = $('#u').value.trim(),
        pass = $('#p').value;
      if (mode === 'forgot') {
        if (!email) err.textContent = 'Informe o e-mail da sua conta.';
        else {
          await sendPasswordReset(email);
          err.classList.add('ok');
          err.textContent = 'Se este e-mail tiver acesso, enviamos um link para criar uma nova senha. Confira também o spam.';
        }
      } else if (mode === 'first') {
        if (!email || pass.length < 6) err.textContent = 'Informe o e-mail e uma senha de pelo menos 6 caracteres.';
        else {
          await firstAccess(email, pass);
          err.classList.add('ok');
          err.textContent = 'Enviamos um e-mail de confirmação. Clique no link dele e depois use "Entrar".';
        }
      } else {
        const r = await login(email, pass);
        if (r === 'admin' || r === 'creator') {
          $('#dlg').close();
          $('#p').value = '';
          toast(r === 'admin' ? 'Bem-vindo, administrador' : 'Bem-vindo');
          if (aoEntrar) aoEntrar(r);
          else if (loginReturn) {
            const back = loginReturn;
            loginReturn = '';
            location.href = back; // volta para a página de onde clicou em Entrar
          } else {
            if (location.hash.startsWith('#/entrar')) history.replaceState(null, '', location.pathname + '#/');
            route();
          }
        } else if (r === 'semacesso')
          err.textContent = 'Este e-mail ainda não foi liberado. Peça ao administrador para liberar o acesso.';
        else err.textContent = 'E-mail ou senha incorretos.';
      }
    } catch (e) {
      err.textContent =
        e && (e.status === 429 || /rate.?limit/i.test(e.code || e.message || ''))
          ? 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'
          : 'Não foi possível concluir. Tente novamente.';
    }
    ok.disabled = false;
  };
  $('#u').onkeydown = $('#p').onkeydown = (e) => {
    if (e.key === 'Enter') ok.click();
  };
  $('#lcancel').onclick = () => $('#dlg').close();
}

/** Para onde voltar depois do login (página gerada de onde a pessoa clicou em Entrar). Só aceita caminhos deste site. */
let loginReturn = '';

/** Rota #/entrar[/caminho]: mostra a página inicial com a janela de login aberta. */
function openLogin(back) {
  loginReturn = /^\/(?!\/)[^\s]*$/.test(back || '') ? back : '';
  if (staff()) {
    // já está logado: volta direto
    if (loginReturn) location.href = loginReturn;
    else location.replace('#/');
    return;
  }
  home();
  $('#lerr').textContent = '';
  $('#dlg').showModal();
  $('#u').focus();
  $('#dlg').addEventListener(
    'close',
    () => {
      if (!staff() && location.hash.startsWith('#/entrar')) history.replaceState(null, '', location.pathname + '#/');
    },
    { once: true },
  );
}
