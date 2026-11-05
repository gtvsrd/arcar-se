/**
 * Telas fixas: menu do topo e coluna lateral
 */

/** Quantos artigos de criadores esperam revisão (só o admin vê). */
const pendingReview = () => (admin ? db.posts.filter((p) => p.submitted && !p.pub).length : 0);

/** Desenha o menu do topo (muda conforme o admin está logado ou não). */
function renderNav() {
  $('#nav').innerHTML =
    '<a href="#/">Início</a>' +
    Object.keys(db.pages)
      .map((k) => `<a href="#/pagina/${k}">${esc(db.pages[k].title)}</a>`)
      .join('') +
    (staff()
      ? `<a href="#/painel">Painel${pendingReview() ? ` <span class="pill">${pendingReview()}</span>` : ''}</a><a href="#/novo">Novo artigo</a><button id="out">Sair</button>`
      : '<button id="in">Entrar</button>');
  const i = $('#in'),
    o = $('#out');
  if (i)
    i.onclick = () => {
      $('#lerr').textContent = '';
      $('#dlg').showModal();
      $('#u').focus();
    };
  if (o)
    o.onclick = async () => {
      await logout();
      location.hash = '#/';
      route();
      toast('Você saiu');
    };
}
/** Desenha a coluna lateral: sobre, busca, categorias, recentes, páginas e painel admin. */
function renderSide() {
  const ps = visible(),
    cats = {};
  ps.forEach((p) => (cats[p.cat] = (cats[p.cat] || 0) + 1));
  $('#side').innerHTML =
    `<div class="box"><h3>Sobre o blog</h3><p>Textos de psicologia para quem quer se entender melhor e assumir a própria história. Para o público em geral, estudantes e profissionais.</p></div>
   <div class="box"><h3>Buscar</h3><input type="text" id="q" placeholder="Digite e tecle Enter" aria-label="Buscar artigos"></div>
   <div class="box"><h3>Categorias</h3><ul>${
     Object.keys(cats)
       .sort()
       .map((c) => `<li><a href="#/cat/${encodeURIComponent(c)}">${esc(c)}</a><span>${cats[c]}</span></li>`)
       .join('') || '<li>Nenhuma ainda</li>'
   }</ul></div>
   <div class="box"><h3>Artigos recentes</h3><ul>${ps
     .slice(0, 5)
     .map((p) => `<li><a href="${postUrl(p)}">${esc(p.title)}</a></li>`)
     .join('')}</ul></div>
   <div class="box"><h3>Páginas</h3><ul>${Object.keys(db.pages)
     .map((k) => `<li><a href="#/pagina/${k}">${esc(db.pages[k].title)}</a></li>`)
     .join('')}</ul></div>` +
    (staff()
      ? `<div class="box"><h3>${admin ? 'Painel do administrador' : 'Área do criador'}</h3><div class="acts" style="flex-wrap:wrap"><a class="btn sm" href="#/painel">Painel</a><a class="btn sm alt" href="#/novo">Novo artigo</a><a class="btn sm alt" href="#/conta">Alterar senha</a></div></div>`
      : '');
  $('#q').onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.value.trim())
      location.hash = '#/busca/' + encodeURIComponent(e.target.value.trim());
  };
}
