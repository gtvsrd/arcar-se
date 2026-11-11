/**
 * Telas fixas: menu do topo e coluna lateral
 */

/** Quantos artigos de criadores esperam revisão (só o admin vê). */
const pendingReview = () => (admin ? db.posts.filter((p) => p.submitted && !p.pub).length : 0);

/** Nome e foto de quem está logado (leva a Painel › Meu perfil). Sem nome de exibição, usa o começo do e-mail. */
function meHTML() {
  const pr = (me && db.profiles[me.id]) || {};
  const name = pr.display_name || (me && me.email ? me.email.split('@')[0] : 'Meu perfil');
  const av = pr.avatar_url
    ? `<img class="avatar" src="${esc(pr.avatar_url)}" alt="" width="28" height="28">`
    : `<span class="avatar avatar--ph" aria-hidden="true">${esc([...name][0].toUpperCase())}</span>`;
  return `<a class="nav-me" href="#/painel/perfil" title="Meu perfil">${av}<span class="nav-me-name">${esc(name)}</span></a>`;
}

/**
 * Páginas do menu e da lista "Páginas": as fixas (Sobre…) e Escritores. A antiga Contato virou Escritores.
 * Para visitantes, os links vão para as páginas geradas (pagina/sobre/, escritores/), que têm a prévia de link
 * (WhatsApp e redes ignoram o que vem depois do #). A equipe fica no app, onde edita.
 */
const navPages = () => [
  ...Object.keys(db.pages)
    .filter((k) => k !== 'contato')
    .map((k) => [staff() ? `#/pagina/${k}` : `pagina/${k}/`, pageLabel(k, db.pages[k].title)]),
  [staff() ? '#/escritores' : 'escritores/', 'Escritores'],
];

/** Desenha o menu do topo (muda conforme o admin está logado ou não). */
function renderNav() {
  $('#nav').innerHTML =
    '<a href="#/">Início</a>' +
    navPages()
      .map(([href, label]) => `<a href="${href}">${esc(label)}</a>`)
      .join('') +
    (staff()
      ? `<a href="#/painel">Painel${pendingReview() ? ` <span class="pill">${pendingReview()}</span>` : ''}</a><a href="#/novo">Novo artigo</a>${meHTML()}<button id="out">Sair</button>`
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
/** Desenha a coluna lateral: busca, quadro de avisos, categorias, recentes, páginas e painel admin. */
function renderSide() {
  const ps = visible(),
    cats = {};
  ps.forEach((p) => catsOf(p).forEach((c) => (cats[c] = (cats[c] || 0) + 1)));
  $('#side').innerHTML =
    `<div class="box"><h3>Buscar</h3><input type="text" id="q" placeholder="Digite e tecle Enter" aria-label="Buscar artigos"></div>
   <div class="box box--avisos"><h3>Quadro de avisos</h3><p><b>Boas-vindas ao Arcar.se!</b> O blog acaba de ser inaugurado.</p><p>Aqui você encontra textos de psicologia para se entender melhor e assumir a própria história, escritos para o público em geral, estudantes e profissionais. Leia, curta e compartilhe com quem possa gostar. Novos artigos chegam em breve.</p></div>
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
   <div class="box"><h3>Páginas</h3><ul>${navPages()
     .map(([href, label]) => `<li><a href="${href}">${esc(label)}</a></li>`)
     .join('')}</ul></div>`; // a equipe usa o menu do topo (Painel, Novo artigo); a senha fica em Painel › Meu perfil
  $('#q').onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.value.trim())
      location.hash = '#/busca/' + encodeURIComponent(e.target.value.trim());
  };
}
