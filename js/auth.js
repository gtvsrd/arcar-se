/**
 * Entrada da equipe (janela modal): login de administradores e criadores e primeiro acesso de criadores
 */

/** Liga os eventos da janela de login. */
function initAuth() {
  const ok = $('#lok'),
    first = $('#lfirst');
  let firstMode = false;

  // alterna entre "Entrar" e "Primeiro acesso"
  const setMode = (isFirst) => {
    firstMode = isFirst;
    $('#ltitle').textContent = isFirst ? 'Primeiro acesso de criador' : 'Entrar';
    $('#lhelp').hidden = !isFirst;
    ok.textContent = isFirst ? 'Criar acesso' : 'Entrar';
    first.textContent = isFirst ? 'Já tenho acesso' : 'Primeiro acesso';
    $('#p').autocomplete = isFirst ? 'new-password' : 'current-password';
    $('#lerr').textContent = '';
    $('#lerr').classList.remove('ok');
  };
  first.onclick = () => setMode(!firstMode);
  $('#dlg').addEventListener('close', () => setMode(false));

  ok.onclick = async () => {
    ok.disabled = true;
    const err = $('#lerr');
    err.textContent = '';
    err.classList.remove('ok');
    try {
      const email = $('#u').value.trim(),
        pass = $('#p').value;
      if (firstMode) {
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
          route();
        } else if (r === 'semacesso')
          err.textContent = 'Este e-mail ainda não foi liberado. Peça ao administrador para liberar o acesso.';
        else err.textContent = 'E-mail ou senha incorretos.';
      }
    } catch (e) {
      err.textContent = 'Não foi possível concluir. Tente novamente.';
    }
    ok.disabled = false;
  };
  $('#p').onkeydown = (e) => {
    if (e.key === 'Enter') ok.click();
  };
  $('#lcancel').onclick = () => $('#dlg').close();
}
