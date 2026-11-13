/**
 * Painel de gestão (#/painel): lista de artigos com filtros, perfil (nome e foto) e equipe (só administrador)
 */

/** Filtros e ordenação da lista; ficam guardados enquanto você navega pelo painel. */
const PF = { q: '', cat: '', author: '', status: '', feat: '', from: '', to: '', sort: 'date', dir: 'desc' };

const STATUS_LABEL = { published: 'Publicado', draft: 'Rascunho', review: 'Em revisão', returned: 'Devolvido' };
const ROLE_LABEL = { admin: 'Administrador', creator: 'Criador', invite: 'Convite pendente' };

/** Nome para mostrar de um autor (pelo id). */
const authorName = (id) => (id ? (db.profiles[id] || {}).display_name || 'Sem nome' : 'Sem autor');

/** Data curta no fuso local: 05/11/2026. */
const shortDate = (d) => new Date(d).toLocaleDateString('pt-BR');

/** Desenha o painel e a seção escolhida ('' artigos, 'categorias', 'perfil', 'escritores[/id]' ou 'equipe'). */
function panel(v) {
  let [tab, sub] = String(v || '').split('/');
  if (!['perfil', 'equipe', 'categorias', 'escritores', 'avisos'].includes(tab)) tab = '';
  if (['equipe', 'categorias', 'escritores', 'avisos'].includes(tab) && !admin) tab = '';
  const tabs = [
    ['', 'Artigos'],
    ...(admin ? [['categorias', 'Categorias']] : []),
    ['perfil', 'Meu perfil'],
    ...(admin ? [['avisos', 'Caixas'], ['escritores', 'Escritores'], ['equipe', 'Equipe']] : []),
  ];
  $('#main').innerHTML = `<div class="panel"><h1>Painel</h1>
   <nav class="ptabs" aria-label="Seções do painel">${tabs
     .map(
       ([k, l]) =>
         `<a href="#/painel${k ? '/' + k : ''}"${k === tab ? ' class="on" aria-current="page"' : ''}>${l}</a>`,
     )
     .join('')}</nav><div id="pbody"></div></div>`;
  if (tab === 'perfil') panelProfile();
  else if (tab === 'equipe') panelTeam();
  else if (tab === 'categorias') panelCategories();
  else if (tab === 'escritores') panelWriters(sub);
  else if (tab === 'avisos') panelBoxes();
  else panelPosts();
}

/** Pede ao admin a observação ao devolver um artigo. Devolve o texto ou null se cancelar. */
function askReturnNote() {
  return new Promise((resolve) => {
    const d = $('#rdlg');
    $('#rnote').value = '';
    d.showModal();
    $('#rok').onclick = () => {
      const v = $('#rnote').value.trim();
      if (!v) return toast('Escreva a observação');
      resolve(v);
      d.close();
    };
    $('#rcancel').onclick = () => d.close();
    d.addEventListener('close', () => resolve(null), { once: true });
  });
}

/* ---------------------------------------------------------------- Artigos */

/** Lista compacta de artigos com resumo, filtros e ordenação. */
function panelPosts() {
  const mine = admin ? db.posts : db.posts.filter((p) => me && p.author_id === me.id);
  const count = (...st) => mine.filter((p) => st.includes(postStatus(p))).length;
  const total = mine.reduce((n, p) => n + viewsOf(p), 0);
  const cats = categoryNames();
  const authors = [...new Set(mine.map((p) => p.author_id || ''))].sort((a, b) =>
    authorName(a).localeCompare(authorName(b), 'pt-BR'),
  );
  const opt = (v, l, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`;
  const pend = count('review');

  const cols = [
    ['title', 'Título'],
    ['cat', 'Categorias'],
    ...(admin ? [['author', 'Autor']] : []),
    ['status', 'Situação'],
    ['feat', 'Destaque'],
    ['date', 'Data'],
    ...(db.viewsOn ? [['views', 'Leituras']] : []),
  ];

  $('#pbody').innerHTML = `
   ${pend && admin ? `<div class="box notice"><b>${pend}</b> ${pend === 1 ? 'artigo aguarda' : 'artigos aguardam'} sua revisão. <a href="#/painel" id="seerev">Ver somente esses</a></div>` : ''}
   ${
     !admin
       ? (() => {
           const back = mine.filter((p) => postStatus(p) === 'returned');
           return back.length
             ? `<div class="box notice"><b>Devolvido pelo administrador:</b><ul>${back.map((p) => `<li><a href="#/editar/${p.id}">${esc(p.title)}</a> — ${esc(p.review_note)}</li>`).join('')}</ul></div>`
             : '';
         })()
       : ''
   }
   <div class="pstats">
     <div><b>${mine.length}</b><span>${admin ? 'Artigos' : 'Meus artigos'}</span></div>
     <div><b>${count('published')}</b><span>Publicados</span></div>
     <div><b>${count('draft', 'returned')}</b><span>Rascunhos</span></div>
     <div><b>${pend}</b><span>Em revisão</span></div>
     ${db.viewsOn ? `<div><b>${total.toLocaleString('pt-BR')}</b><span>Leituras</span></div>` : ''}
   </div>
   <form class="pfilters" id="pf" onsubmit="return false" aria-label="Filtros">
     <label>Buscar<input type="text" id="pf-q" value="${esc(PF.q)}" placeholder="Título, categoria…"></label>
     <label>Categoria<select id="pf-cat">${opt('', 'Todas', PF.cat)}${cats.map((c) => opt(c, c, PF.cat)).join('')}</select></label>
     ${admin ? `<label>Autor<select id="pf-author">${opt('', 'Todos', PF.author)}${authors.map((a) => opt(a || '-', authorName(a), PF.author || '')).join('')}</select></label>` : ''}
     <label>Situação<select id="pf-status">${opt('', 'Todas', PF.status)}${Object.entries(STATUS_LABEL)
       .map(([k, l]) => opt(k, l, PF.status))
       .join('')}</select></label>
     <label>Destaque<select id="pf-feat">${opt('', 'Todos', PF.feat)}${opt('1', 'Só em destaque', PF.feat)}${opt('0', 'Sem destaque', PF.feat)}</select></label>
     <label>De<input type="date" id="pf-from" value="${esc(PF.from)}"></label>
     <label>Até<input type="date" id="pf-to" value="${esc(PF.to)}"></label>
     <button type="button" class="btn sm alt" id="pf-clear">Limpar filtros</button>
   </form>
   <div class="pcount" id="pcount" role="status"></div>
   <div class="ptable-wrap"><table class="ptable">
     <caption class="sr">Artigos</caption>
     <thead><tr>${cols.map(([k, l]) => `<th scope="col" data-k="${k}"><button type="button" data-sort="${k}">${l}<i aria-hidden="true"></i></button></th>`).join('')}</tr></thead>
     <tbody id="prows"></tbody>
   </table></div>`;

  /** Aplica filtros e ordenação. */
  const list = () => {
    const t = PF.q.trim().toLowerCase();
    const cmp = {
      title: (a, b) => a.title.localeCompare(b.title, 'pt-BR'),
      cat: (a, b) => catsOf(a).join().localeCompare(catsOf(b).join(), 'pt-BR'),
      author: (a, b) => authorName(a.author_id).localeCompare(authorName(b.author_id), 'pt-BR'),
      status: (a, b) => postStatus(a).localeCompare(postStatus(b)),
      feat: (a, b) => Number(a.featured) - Number(b.featured),
      date: (a, b) => a.date.localeCompare(b.date),
      views: (a, b) => viewsOf(a) - viewsOf(b),
    }[PF.sort];
    const day = (p) => new Date(p.date).toLocaleDateString('sv-SE'); // AAAA-MM-DD no fuso local
    return mine
      .filter(
        (p) =>
          (!t || `${p.title} ${catsOf(p).join(' ')} ${authorName(p.author_id)}`.toLowerCase().includes(t)) &&
          (!PF.cat || catsOf(p).includes(PF.cat)) &&
          (!PF.author || (p.author_id || '-') === PF.author || (!p.author_id && PF.author === '-')) &&
          (!PF.status || postStatus(p) === PF.status) &&
          (PF.feat !== '1' || p.featured) &&
          (PF.feat !== '0' || !p.featured) &&
          (!PF.from || day(p) >= PF.from) &&
          (!PF.to || day(p) <= PF.to),
      )
      .sort((a, b) => (PF.dir === 'asc' ? 1 : -1) * (cmp(a, b) || b.date.localeCompare(a.date)));
  };

  const row = (p) => {
    const st = postStatus(p),
      a = authorOf(p);
    const who = a
      ? `${a.avatar_url ? `<img class="avatar" src="${esc(a.avatar_url)}" alt="" width="20" height="20" loading="lazy">` : `<span class="avatar avatar--ph" aria-hidden="true">${esc([...a.display_name][0].toUpperCase())}</span>`}${esc(a.display_name)}`
      : '<span class="mut">—</span>';
    return `<tr>
     <td class="pt" data-l="Título"><div class="pt-wrap">${
       p.img
         ? `<img class="pt-capa" src="${esc(p.img)}" alt="" loading="lazy">`
         : `<span class="pt-capa pt-capa--cor" style="background:${colorOf(p.cat)}" aria-hidden="true"></span>` /* sem capa: a cor da categoria, como nos cards */
     }<div class="pt-txt"><a href="#/post/${esc(p.slug || p.id)}">${esc(p.title)}</a>${st === 'returned' ? `<div class="pnote">${esc(p.review_note)}</div>` : ''}
       <div class="pt-acts">${[
         canEdit(p) ? `<a href="#/editar/${p.id}">Editar</a>` : '',
         admin && p.pub ? `<button type="button" data-pact="unpub" data-id="${p.id}">Tirar do ar</button>` : '',
         admin && !p.pub ? `<button type="button" data-pact="pub" data-id="${p.id}">Publicar</button>` : '',
         admin && p.submitted && !p.pub ? `<button type="button" data-pact="ret" data-id="${p.id}">Devolver</button>` : '',
         canEdit(p) ? `<button type="button" class="pt-del" data-del="${p.id}">Excluir</button>` : '',
       ]
         .filter(Boolean)
         .join('')}</div></div></div></td>
     <td data-l="Categoria">${esc(catsOf(p).join(', '))}</td>
     ${admin ? `<td data-l="Autor"><span class="who">${who}</span></td>` : ''}
     <td data-l="Situação"><span class="st st--${st}">${STATUS_LABEL[st]}</span></td>
     <td data-l="Destaque">${p.featured ? '<span title="Em destaque">★</span>' : '<span class="mut">—</span>'}</td>
     <td data-l="Data">${shortDate(p.date)}</td>
     ${db.viewsOn ? `<td class="num" data-l="Leituras">${p.pub ? viewsOf(p).toLocaleString('pt-BR') : '<span class="mut">—</span>'}</td>` : ''}
    </tr>`;
  };

  const draw = () => {
    const l = list();
    $('#prows').innerHTML =
      l.map(row).join('') ||
      `<tr><td class="empty" colspan="${cols.length}">Nenhum artigo com esses filtros.</td></tr>`;
    $('#pcount').textContent = `${l.length} de ${mine.length} ${mine.length === 1 ? 'artigo' : 'artigos'}`;
    document.querySelectorAll('.ptable th[data-k]').forEach((th) => {
      const on = th.dataset.k === PF.sort;
      th.setAttribute('aria-sort', on ? (PF.dir === 'asc' ? 'ascending' : 'descending') : 'none');
      th.querySelector('i').textContent = on ? (PF.dir === 'asc' ? ' ▲' : ' ▼') : '';
    });
    bindDel();
  };

  // filtros
  const bind = (id, key) => {
    const el = $(id);
    if (el) el.oninput = () => ((PF[key] = el.value), draw());
  };
  bind('#pf-q', 'q');
  bind('#pf-cat', 'cat');
  bind('#pf-author', 'author');
  bind('#pf-status', 'status');
  bind('#pf-feat', 'feat');
  bind('#pf-from', 'from');
  bind('#pf-to', 'to');
  $('#pf-clear').onclick = () => {
    Object.assign(PF, { q: '', cat: '', author: '', status: '', feat: '', from: '', to: '' });
    panelPosts();
  };
  const see = $('#seerev');
  if (see)
    see.onclick = (e) => {
      e.preventDefault();
      PF.status = 'review';
      panelPosts();
    };
  document.querySelectorAll('[data-sort]').forEach(
    (b) =>
      (b.onclick = () => {
        const k = b.dataset.sort;
        if (PF.sort === k) PF.dir = PF.dir === 'asc' ? 'desc' : 'asc';
        else {
          PF.sort = k;
          PF.dir = k === 'date' || k === 'views' || k === 'feat' ? 'desc' : 'asc';
        }
        draw();
      }),
  );

  // ações do admin: publicar, tirar do ar, devolver
  $('#prows').onclick = async (e) => {
    const b = e.target.closest('[data-pact]');
    if (!b) return;
    const id = b.dataset.id,
      act = b.dataset.pact;
    try {
      if (act === 'ret') {
        const n = await askReturnNote();
        if (n === null) return;
        await savePost({ id, pub: false, submitted: false, review_note: n });
        toast('Devolvido ao criador');
      } else {
        await savePost({ id, pub: act === 'pub' });
        toast(act === 'pub' ? 'Artigo publicado' : 'Artigo tirado do ar');
      }
      route();
    } catch (err) {
      toast('Não foi possível salvar: ' + (err.message || 'erro'));
    }
  };
  draw();
}

/* ----------------------------------------------------------------- Perfil */

/** Meu perfil: nome, foto e o card da página Escritores (texto e redes), mais o atalho para trocar a senha. */
function panelProfile() {
  profileForm(me.id, { back: '#/painel', after: () => panel('perfil') });
  $('#pbody').insertAdjacentHTML(
    'beforeend',
    `<div class="box" style="max-width:640px;margin-top:20px">
     <h3>Senha</h3>
     <p class="hint">Troque a senha que você usa para entrar no blog.</p>
     <div class="acts"><a class="btn alt" href="#/conta">Alterar senha</a></div>
    </div>`,
  );
}

/**
 * Formulário do perfil de um escritor (o próprio ou, para o administrador, o de qualquer pessoa da equipe).
 * Nome e foto aparecem nos artigos; nome, foto, texto e redes formam o card da página Escritores.
 */
function profileForm(userId, { back, after, who = '' }) {
  const cur = db.profiles[userId] || {};
  const links = cur.links || {};
  let avatar = cur.avatar_url || '';
  let pending = null; // nova foto escolhida, ainda não enviada
  const own = userId === me.id;
  $('#pbody').innerHTML = `<form id="pp" class="art art--edit" style="max-width:640px" novalidate>
   ${who ? `<h2 class="pp-who">Card de ${esc(who)}</h2>` : ''}
   <p class="hint">${own ? 'Seu nome e sua foto aparecem nos artigos que você criar.' : 'O nome e a foto aparecem nos artigos dessa pessoa.'} Nome, foto, texto e redes formam o card da página <a href="#/escritores">Escritores</a>.</p>
   <label for="pn">Nome de exibição</label>
   <input type="text" id="pn" required maxlength="60" value="${esc(cur.display_name || '')}"${own ? ' autocomplete="name"' : ''}>
   <label>Foto</label>
   <div class="avatar-edit">
     <div class="avatar avatar--lg" id="pav" aria-hidden="true"></div>
     <div>
       <input type="file" id="pfile" accept="image/*" aria-label="Escolher foto">
       <div class="acts"><button type="button" class="btn sm del" id="prm" hidden>Remover foto</button></div>
       <div class="hint">A foto é recortada em quadrado e reduzida automaticamente.</div>
     </div>
   </div>
   <label for="pbio">Texto de apresentação</label>
   <textarea id="pbio" rows="6" maxlength="1200" placeholder="Quem é você, sua formação, sobre o que escreve…">${esc(cur.bio || '')}</textarea>
   <div class="hint"><span id="pbion"></span> Deixe uma linha em branco para começar outro parágrafo.</div>
   <fieldset class="pp-links"><legend>Redes sociais e site</legend>
     <p class="hint">Preencha só o que quiser mostrar no card.</p>
     ${WRITER_NETS.map(
       (n) => `<div class="pp-link"><label for="pl-${n.k}"><span class="wr-ico wr-ico--${n.k}" aria-hidden="true"></span>${n.label}</label>
       <input type="${n.k === 'email' ? 'email' : 'text'}" id="pl-${n.k}" data-net="${n.k}" maxlength="200" placeholder="${esc(n.ph)}" value="${esc(links[n.k] || '')}" aria-describedby="pe-${n.k}">
       <span class="pp-err" id="pe-${n.k}" role="alert"></span></div>`,
     ).join('')}
   </fieldset>
   <div class="acts" style="margin-top:18px"><button class="btn" type="submit">Salvar</button><a class="btn alt" href="${back}">Cancelar</a></div>
  </form>`;
  const show = () => {
    const name = $('#pn').value.trim() || '?';
    const src = pending ? URL.createObjectURL(pending) : avatar;
    $('#pav').innerHTML = src ? `<img src="${esc(src)}" alt="">` : esc([...name][0].toUpperCase());
    $('#prm').hidden = !src;
  };
  const count = () => ($('#pbion').textContent = `${$('#pbio').value.length} de 1200 caracteres.`);
  $('#pn').oninput = show;
  $('#pbio').oninput = count;
  $('#pfile').onchange = () => {
    const f = $('#pfile').files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast('Escolha um arquivo de imagem');
    squareImage(f, 480)
      .then((b) => {
        pending = b;
        show();
      })
      .catch(() => toast('Não foi possível ler essa imagem'));
  };
  $('#prm').onclick = () => {
    avatar = '';
    pending = null;
    $('#pfile').value = '';
    show();
  };
  show();
  count();
  /** Confere cada rede: vazio ou um endereço válido. Devolve o objeto a salvar, ou null se houver erro. */
  const readLinks = () => {
    const out = {};
    let bad = null;
    document.querySelectorAll('#pp [data-net]').forEach((i) => {
      const v = i.value.trim(),
        ok = !v || !!writerLinkUrl(i.dataset.net, v);
      $('#pe-' + i.dataset.net).textContent = ok ? '' : i.dataset.net === 'email' ? 'E-mail inválido' : 'Endereço inválido';
      i.setAttribute('aria-invalid', String(!ok));
      if (!ok) bad = bad || i;
      else if (v) out[i.dataset.net] = v;
    });
    if (bad) bad.focus();
    return bad ? null : out;
  };
  $('#pp').onsubmit = async (e) => {
    e.preventDefault();
    const name = $('#pn').value.trim();
    if (!name) {
      $('#pn').focus();
      return toast('Preencha o nome de exibição');
    }
    const lk = readLinks();
    if (!lk) return toast('Confira os endereços marcados');
    const btn = $('#pp button[type=submit]');
    btn.disabled = true;
    let uploaded = '';
    try {
      if (pending) avatar = uploaded = await uploadAvatar(pending, userId);
      await saveProfile({ display_name: name, avatar_url: avatar, bio: $('#pbio').value.trim(), links: lk }, userId);
      if (cur.avatar_url && cur.avatar_url !== avatar) deleteCover(cur.avatar_url); // foto antiga
      toast('Perfil salvo');
      renderNav(); // nome e foto no topo já atualizados
      after();
    } catch (err) {
      if (uploaded) deleteCover(uploaded);
      toast(
        /bio|links|column/i.test(err.message || '')
          ? 'Falta aplicar o supabase/escritores.sql no Supabase'
          : 'Não foi possível salvar: ' + (err.message || 'erro'),
      );
    } finally {
      btn.disabled = false;
    }
  };
}

/* ---------------------------------------------------------------- Caixas */

/**
 * Caixas da coluna lateral: Avisos (fixa, logo abaixo da busca) e as caixas livres (depois de todas as outras).
 * Cada caixa é um cartão empilhado: recolhido mostra ícone, título e situação; expandido, edita título, ícone e texto.
 * Só um cartão fica aberto por vez (o editor de texto é um só). Só administrador.
 */
function panelBoxes() {
  if (!db.boxesOn) {
    $('#pbody').innerHTML = `<div class="box"><h3>Falta um passo no Supabase</h3>
      <p>Para criar caixas livres na lateral, rode o arquivo <code>supabase/caixas-da-lateral.sql</code> no SQL Editor do Supabase e recarregue esta página. O Avisos de hoje passa a ser a primeira caixa, com o mesmo texto.</p></div>`;
    return;
  }
  let aberto = null; // id do cartão expandido ('novo' para uma caixa ainda não salva)
  let rte = null;
  const livres = () => db.boxes.filter((b) => b.kind === 'livre').sort((x, y) => x.sort - y.sort || String(x.created_at).localeCompare(String(y.created_at)));
  const avisos = () => db.boxes.find((b) => b.kind === 'avisos');
  const icone = (k) => SIDE_ICONS[k] || SIDE_ICONS.flecha;
  const SETA = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  /** Cartão (recolhido) de uma caixa. */
  const cartao = (b, i, n) => {
    const fixa = b.kind === 'avisos';
    const vazio = !String(b.body || '').trim();
    const tag = b.hidden ? 'Oculta' : vazio ? 'Sem texto (não aparece)' : fixa ? 'Fixa · abaixo da busca' : 'No fim da lateral';
    return `<section class="cx${b.hidden ? ' cx--oculta' : ''}" data-id="${b.id}">
     <div class="cx-cab">
       <button type="button" class="cx-abrir" aria-expanded="false" aria-controls="cx-corpo-${b.id}">
         <span class="cx-ico">${icone(b.icon)}</span><span class="cx-nome">${esc(b.title || 'Sem título')}</span>
         <span class="cx-tag">${tag}</span><span class="cx-seta">${SETA}</span>
       </button>
       <span class="cx-acts">${
         fixa
           ? ''
           : `<button type="button" class="btn sm alt" data-cx="up" title="Subir" aria-label="Subir"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" class="btn sm alt" data-cx="down" title="Descer" aria-label="Descer"${i === n - 1 ? ' disabled' : ''}>↓</button>`
       }<button type="button" class="btn sm alt" data-cx="vis">${b.hidden ? 'Mostrar' : 'Ocultar'}</button>${
         fixa ? '' : '<button type="button" class="btn sm del" data-cx="del">Excluir</button>'
       }</span>
     </div>
     <div class="cx-corpo" id="cx-corpo-${b.id}" hidden></div>
    </section>`;
  };

  /** Formulário de edição dentro do cartão expandido. */
  const formulario = (b) => `<form class="art art--edit cx-form">
     <label for="cx-t">Título</label><input type="text" id="cx-t" required maxlength="60" value="${esc(b.title || '')}">
     <span class="lbl" id="cx-il">Ícone (no modo leitura e antes do título)</span>
     <div class="cx-icones" role="radiogroup" aria-labelledby="cx-il">${BOX_ICONS.map(
       ([k, nome]) =>
         `<label class="cx-icone" title="${nome}"><input type="radio" name="cx-i" value="${k}"${(b.icon || 'flecha') === k ? ' checked' : ''}><span aria-hidden="true">${icone(k)}</span><span class="sr">${nome}</span></label>`,
     ).join('')}</div>
     <label id="cx-bl">Texto</label>
     <div class="rte-wrap" id="cx-rte"></div>
     <div class="acts"><button class="btn" type="submit">Salvar</button><button class="btn alt" type="button" data-cx="fechar">Cancelar</button>${
       b.kind === 'avisos' ? '<button class="btn alt" type="button" data-cx="boasvindas">Voltar ao texto de boas-vindas</button>' : ''
     }</div>
    </form>`;

  /** Desenha a lista inteira (Avisos primeiro, depois as livres na ordem). */
  function desenhar() {
    const a = avisos();
    const ls = livres();
    $('#pbody').innerHTML = `<div class="cx-layout"><div class="cx-col">
     <p class="hint">As caixas aparecem na coluna lateral de todas as páginas: <b>Avisos</b> logo abaixo da busca, e as caixas livres depois de todas as outras, nesta ordem. Clique numa caixa para editá-la.</p>
     <div class="cx-lista" id="cx-lista">
       ${a ? cartao(a, 0, 1) : ''}
       ${ls.length ? '<h3 class="cx-sub">Caixas livres</h3>' : ''}
       ${ls.map((b, i) => cartao(b, i, ls.length)).join('')}
       <div id="cx-nova"></div>
     </div>
     <button type="button" class="btn" id="cx-add">+ Adicionar caixa</button>
    </div>
    <aside class="cx-previa" aria-label="Prévia da coluna lateral">
     <p class="cx-previa-tit">Prévia da lateral <span>(atualiza enquanto você edita)</span></p>
     <div class="cx-previa-side" id="cx-previa" inert></div>
    </aside></div>`;
    aberto = null;
    rte = null;
    $('#cx-add').onclick = adicionar;
    previa();
  }

  /**
   * Prévia da coluna lateral como os leitores vão ver. `rascunho`: a caixa aberta, com o que está no formulário
   * (ainda não salvo), para a prévia acompanhar a edição.
   */
  function previa(rascunho) {
    const el = $('#cx-previa');
    if (!el) return;
    let boxes = db.boxes.map((b) => ({ ...b }));
    if (rascunho) {
      const i = boxes.findIndex((b) => b.id === rascunho.id);
      if (i >= 0) boxes[i] = { ...boxes[i], ...rascunho };
      else boxes.push({ kind: 'livre', hidden: false, sort: Math.max(0, ...boxes.map((b) => b.sort)) + 10, created_at: '9', ...rascunho });
    }
    // sem ids repetidos (o campo de busca da prévia não pode roubar o da lateral de verdade)
    el.innerHTML = sideBoxesHTML(boxes).replace(/ id="[^"]*"/g, '');
    const alvo = rascunho && el.querySelector(`[data-lado="${rascunho.kind === 'avisos' ? 'avisos' : 'livre-' + (rascunho.id || 'undefined')}"]`);
    el.querySelectorAll('.box').forEach((b) => b.classList.toggle('cx-previa-alvo', b === alvo));
    // a caixa em edição fica à vista dentro da prévia (só a prévia rola, a página fica onde está)
    if (alvo) {
      const topo = alvo.offsetTop - el.offsetTop - 8,
        fim = topo + alvo.offsetHeight + 16;
      const visivel = Math.min(el.clientHeight, innerHeight - el.getBoundingClientRect().top); // parte da prévia na tela
      if (topo < el.scrollTop || fim > el.scrollTop + visivel) el.scrollTop = Math.max(0, topo);
    }
  }
  /** Lê o formulário aberto e atualiza a prévia (com uma pequena pausa enquanto se digita). */
  let previaTimer = null;
  function previaDoFormulario(b, form) {
    clearTimeout(previaTimer);
    previaTimer = setTimeout(() => {
      if (!form.isConnected) return; // o cartão foi recolhido (Cancelar): vale o que está salvo
      const ed = form.querySelector('.rte');
      previa({
        id: b.id,
        kind: b.kind || 'livre',
        title: form.querySelector('#cx-t').value.trim() || 'Sem título',
        icon: (form.querySelector('input[name="cx-i"]:checked') || {}).value || 'flecha',
        body: ed ? htmlToMd(ed) : b.body || '',
      });
    }, 150);
  }

  /** Recolhe o cartão aberto (descarta o que não foi salvo). */
  function recolher() {
    const sec = aberto && document.querySelector(`.cx[data-id="${aberto}"]`);
    if (sec) {
      if (aberto === 'novo') sec.remove();
      else {
        const corpo = sec.querySelector('.cx-corpo');
        corpo.innerHTML = '';
        corpo.hidden = true;
        sec.classList.remove('cx--aberta');
        sec.querySelector('.cx-abrir').setAttribute('aria-expanded', 'false');
      }
    }
    aberto = null;
    rte = null;
    clearTimeout(previaTimer); // descarta a atualização pendente do formulário que acabou de fechar
    previa(); // volta a mostrar o que está salvo
  }

  /** Expande o cartão `sec` da caixa `b` para editar. */
  function expandir(sec, b) {
    recolher();
    aberto = b.id || 'novo';
    const corpo = sec.querySelector('.cx-corpo');
    corpo.innerHTML = formulario(b);
    corpo.hidden = false;
    sec.classList.add('cx--aberta');
    sec.querySelector('.cx-abrir')?.setAttribute('aria-expanded', 'true');
    rte = createRichEditor(corpo.querySelector('#cx-rte'), b.body || '', 'cx-bl');
    const form = corpo.querySelector('form');
    form.querySelector('[data-cx="fechar"]').onclick = recolher;
    // a prévia acompanha o que se digita, o ícone escolhido e as formatações do texto
    const atualizar = () => previaDoFormulario(b, form);
    form.addEventListener('input', atualizar);
    form.addEventListener('change', atualizar);
    form.addEventListener('click', atualizar); // botões da barra do editor (negrito, listas…)
    atualizar();
    const bv = form.querySelector('[data-cx="boasvindas"]');
    if (bv)
      bv.onclick = () => {
        form.querySelector('#cx-t').value = NOTICE_DEFAULT.title;
        corpo.querySelector('#cx-rte').innerHTML = '';
        rte = createRichEditor(corpo.querySelector('#cx-rte'), NOTICE_DEFAULT.body, 'cx-bl');
        previaDoFormulario(b, form);
        toast('Texto de boas-vindas restaurado. Salve para aplicar.');
      };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const title = form.querySelector('#cx-t').value.trim();
      if (!title) return form.querySelector('#cx-t').focus();
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      const uploaded = [];
      const old = mdImages(b.body || '');
      try {
        const body = (await rte.getBody(uploaded)).trim();
        const icon = (form.querySelector('input[name="cx-i"]:checked') || {}).value || 'flecha';
        const fields = { title, body, icon };
        if (!b.id) Object.assign(fields, { kind: 'livre', sort: (Math.max(0, ...livres().map((x) => x.sort)) || 0) + 10 });
        await saveBox(b.id ? { id: b.id, ...fields } : fields);
        deleteUnusedImages(old);
        renderSide();
        desenhar();
        toast(body ? 'Caixa salva' : 'Caixa salva (sem texto, não aparece na lateral)');
      } catch (err) {
        uploaded.forEach(deleteCover);
        btn.disabled = false;
        toast('Não foi possível salvar: ' + (err.message || 'erro'));
      }
    };
    form.querySelector('#cx-t').focus();
  }

  /** Nova caixa: um cartão já aberto no fim da lista; só vai para o banco ao salvar. */
  function adicionar() {
    recolher();
    const slot = $('#cx-nova');
    slot.innerHTML = `<section class="cx cx--aberta cx--nova" data-id="novo"><div class="cx-cab"><span class="cx-nome">Nova caixa</span></div><div class="cx-corpo"></div></section>`;
    expandir(slot.querySelector('.cx'), { title: '', body: '', icon: 'flecha' });
    slot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  $('#pbody').onclick = async (e) => {
    const sec = e.target.closest('.cx');
    if (!sec || sec.dataset.id === 'novo') return;
    const b = db.boxes.find((x) => x.id === sec.dataset.id);
    if (!b) return;
    if (e.target.closest('.cx-abrir')) return aberto === b.id ? recolher() : expandir(sec, b);
    const act = e.target.closest('[data-cx]')?.dataset.cx;
    if (!act || e.target.closest('.cx-corpo')) return;
    try {
      if (act === 'vis') {
        await saveBox({ id: b.id, hidden: !b.hidden });
        renderSide();
        toast(b.hidden ? `"${b.title}" aparece na lateral` : `"${b.title}" oculta`);
        desenhar();
      } else if (act === 'up' || act === 'down') {
        const ids = livres().map((x) => x.id);
        const i = ids.indexOf(b.id),
          j = act === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= ids.length) return;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        await saveBoxOrder(ids);
        renderSide();
        desenhar();
      } else if (act === 'del') {
        const btn = e.target.closest('[data-cx]');
        if (btn.dataset.ok !== '1') {
          btn.dataset.ok = '1';
          btn.textContent = 'Confirmar exclusão';
          setTimeout(() => {
            btn.dataset.ok = '';
            btn.textContent = 'Excluir';
          }, 3000);
          return;
        }
        await deleteBox(b.id);
        deleteUnusedImages(mdImages(b.body || ''));
        renderSide();
        toast('Caixa excluída');
        desenhar();
      }
    } catch (err) {
      toast('Não foi possível salvar: ' + (err.message || 'erro'));
    }
  };
  desenhar();
}

/* ------------------------------------------------------------- Escritores */

/** Ordem e visibilidade dos cards da página Escritores, e edição do card de cada pessoa (só administrador). */
async function panelWriters(editId) {
  if (editId) {
    const pr = db.profiles[editId] || {};
    return profileForm(editId, {
      back: '#/painel/escritores',
      after: () => (location.hash = '#/painel/escritores'),
      who: pr.display_name || 'escritor',
    });
  }
  $('#pbody').innerHTML = `<p class="hint">Cada pessoa da equipe tem um card na página <a href="#/escritores">Escritores</a>. Cada um edita o próprio em <b>Meu perfil</b>; aqui você edita qualquer card, muda a ordem e oculta quem não deve aparecer. Quem ainda não tem nome não aparece.</p>
  <div class="ptable-wrap"><table class="ptable ptable--writers"><caption class="sr">Escritores</caption>
   <thead><tr><th scope="col">Ordem</th><th scope="col">Escritor</th><th scope="col">Na página</th><th scope="col">Ações</th></tr></thead>
   <tbody id="wrows"><tr><td colspan="4" class="empty">Carregando…</td></tr></tbody></table></div>`;
  let list = [];
  const draw = () => {
    $('#wrows').innerHTML = list
      .map((m, i) => {
        const pr = db.profiles[m.user_id] || {};
        const state = !pr.display_name ? ['none', 'Sem nome'] : pr.hidden ? ['hidden', 'Oculto'] : ['shown', 'Aparece'];
        return `<tr>
         <td data-l="Ordem"><div class="acts wr-order">
           <button class="btn sm alt" data-up="${i}" ${i ? '' : 'disabled'} aria-label="Subir ${esc(pr.display_name || m.email)}">↑</button>
           <button class="btn sm alt" data-down="${i}" ${i < list.length - 1 ? '' : 'disabled'} aria-label="Descer ${esc(pr.display_name || m.email)}">↓</button></div></td>
         <td data-l="Escritor">${esc(pr.display_name) || '<span class="mut">—</span>'}<div class="mut wr-mail">${esc(m.email)}</div></td>
         <td data-l="Na página"><span class="st st--w-${state[0]}">${state[1]}</span></td>
         <td class="pa"><div class="acts">
           <a class="btn sm alt" href="#/painel/escritores/${esc(m.user_id)}">Editar card</a>
           <button class="btn sm alt" data-hide="${i}">${pr.hidden ? 'Mostrar' : 'Ocultar'}</button></div></td></tr>`;
      })
      .join('') || '<tr><td colspan="4" class="empty">Ninguém na equipe ainda.</td></tr>';
  };
  try {
    list = (await loadTeam()).filter((m) => m.role !== 'invite');
  } catch (e) {
    $('#wrows').innerHTML = '<tr><td colspan="4" class="empty">Não foi possível carregar a equipe.</td></tr>';
    return;
  }
  const sortOf = (m) => (db.profiles[m.user_id] || {}).sort || 0;
  const nameOf = (m) => (db.profiles[m.user_id] || {}).display_name || m.email;
  list.sort((a, b) => sortOf(a) - sortOf(b) || nameOf(a).localeCompare(nameOf(b), 'pt-BR'));
  draw();
  $('#wrows').onclick = async (e) => {
    const b = e.target.closest('[data-up],[data-down],[data-hide]');
    if (!b) return;
    b.disabled = true;
    try {
      if (b.dataset.hide) {
        const m = list[+b.dataset.hide];
        await saveProfile({ hidden: !(db.profiles[m.user_id] || {}).hidden }, m.user_id);
      } else {
        const i = +(b.dataset.up ?? b.dataset.down),
          j = b.dataset.up ? i - 1 : i + 1;
        [list[i], list[j]] = [list[j], list[i]];
        await saveWriterOrder(list.map((m) => m.user_id));
      }
      draw();
      const f = b.dataset.hide ? $(`[data-hide="${b.dataset.hide}"]`) : $(`[data-${b.dataset.up ? 'up' : 'down'}="${b.dataset.up ? +b.dataset.up - 1 : +b.dataset.down + 1}"]`);
      (f && !f.disabled ? f : $('#wrows button:not([disabled])'))?.focus();
    } catch (err) {
      toast(/sort|hidden|column/i.test(err.message || '') ? 'Falta aplicar o supabase/escritores.sql no Supabase' : 'Não foi possível salvar: ' + (err.message || 'erro'));
      draw();
    }
  };
}

/* ----------------------------------------------------------------- Equipe */

/** Libera e remove criadores (só administrador). */
async function panelTeam() {
  $('#pbody').innerHTML = `<div class="box">
   <h3>Liberar um criador</h3>
   <p class="hint">Informe o e-mail da pessoa. Ela entra pelo botão <b>Entrar</b> › <b>Primeiro acesso</b>, escolhe uma senha e confirma pelo e-mail que receber. Só e-mails liberados aqui ganham acesso. Criadores escrevem artigos e enviam para a sua revisão; só você publica.</p>
   <form id="pi" class="pinvite"><input type="email" id="pie" required placeholder="email@exemplo.com" aria-label="E-mail do criador"><button class="btn" type="submit">Liberar</button></form>
  </div>
  <div class="ptable-wrap"><table class="ptable ptable--team"><caption class="sr">Equipe</caption>
   <thead><tr><th scope="col">Nome</th><th scope="col">E-mail</th><th scope="col">Papel</th><th scope="col">Ações</th></tr></thead>
   <tbody id="trows"><tr><td colspan="4" class="empty">Carregando…</td></tr></tbody></table></div>`;
  const draw = async () => {
    let team;
    try {
      team = await loadTeam();
    } catch (e) {
      $('#trows').innerHTML =
        '<tr><td colspan="4" class="empty">Não foi possível carregar a equipe. O SQL do painel já foi aplicado no Supabase?</td></tr>';
      return;
    }
    const order = { admin: 0, creator: 1, invite: 2 };
    team.sort((a, b) => order[a.role] - order[b.role] || a.email.localeCompare(b.email));
    $('#trows').innerHTML = team
      .map(
        (m) => `<tr>
       <td data-l="Nome">${esc(m.display_name) || '<span class="mut">—</span>'}</td>
       <td data-l="E-mail">${esc(m.email)}</td>
       <td data-l="Papel"><span class="st st--${m.role}">${ROLE_LABEL[m.role]}</span></td>
       <td class="pa"><div class="acts">${
         m.role === 'creator'
           ? `<button class="btn sm del" data-rm="${esc(m.user_id)}">Remover acesso</button>`
           : m.role === 'invite'
             ? `<button class="btn sm del" data-cancel="${esc(m.email)}">Cancelar convite</button>`
             : ''
       }</div></td></tr>`,
      )
      .join('');
  };
  $('#trows').onclick = async (e) => {
    const b = e.target.closest('[data-rm],[data-cancel]');
    if (!b) return;
    if (b.dataset.ok !== '1') {
      b.dataset.ok = '1';
      const t = b.textContent;
      b.textContent = 'Confirmar';
      setTimeout(() => {
        b.dataset.ok = '';
        b.textContent = t;
      }, 3000);
      return;
    }
    try {
      if (b.dataset.rm) await removeCreator(b.dataset.rm);
      else await cancelInvite(b.dataset.cancel);
      toast(b.dataset.rm ? 'Acesso removido' : 'Convite cancelado');
      draw();
    } catch (err) {
      toast('Não foi possível concluir: ' + (err.message || 'erro'));
    }
  };
  $('#pi').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#pi button');
    btn.disabled = true;
    try {
      const r = await inviteCreator($('#pie').value);
      toast(
        r === 'ativo'
          ? 'Criador liberado (já tinha conta)'
          : r === 'admin'
            ? 'Esse e-mail já é de administrador'
            : 'E-mail liberado: peça para a pessoa usar "Primeiro acesso"',
      );
      $('#pie').value = '';
      draw();
    } catch (err) {
      toast(/inválido/i.test(err.message || '') ? 'E-mail inválido' : 'Não foi possível liberar: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  };
  draw();
}

/* ------------------------------------------------------------- Categorias */

/** Gerencia a lista de categorias: criar, renomear (ou mesclar), excluir e ver os artigos de cada uma (só administrador). */
function panelCategories() {
  const countOf = (n) => db.posts.filter((p) => catsOf(p).includes(n)).length;
  $('#pbody').innerHTML = `<div class="box">
   <h3>Nova categoria</h3>
   <p class="hint">Só o administrador cria categorias. Criadores e você escolhem entre elas ao editar um artigo (até ${MAX_CATS} por artigo).</p>
   <form id="ci" class="pinvite"><input type="text" id="cin" required maxlength="40" placeholder="Nome da categoria" aria-label="Nome da nova categoria"><button class="btn" type="submit">Criar</button></form>
  </div>
  <div class="ptable-wrap"><table class="ptable ptable--cats"><caption class="sr">Categorias</caption>
   <thead><tr><th scope="col">Categoria</th><th scope="col" class="num">Artigos</th><th scope="col">Ações</th></tr></thead>
   <tbody id="crows"></tbody></table></div>
  <p class="hint">Renomear para um nome que já existe mescla as duas categorias. Só é possível excluir categorias sem artigos.</p>`;
  const draw = () => {
    const names = categoryNames();
    $('#crows').innerHTML =
      names
        .map((n) => {
          const k = countOf(n);
          return `<tr data-name="${esc(n)}">
       <td class="pt" data-l="Categoria"><span class="cname">${esc(n)}</span></td>
       <td class="num" data-l="Artigos">${k ? `<a href="#/painel" data-see="${esc(n)}">${k}</a>` : '0'}</td>
       <td class="pa"><div class="acts">
         <button class="btn sm alt" data-ren="${esc(n)}">Renomear</button>
         <button class="btn sm del" data-delcat="${esc(n)}"${k ? ' disabled title="Em uso: renomeie/mescle antes de excluir"' : ''}>Excluir</button>
       </div></td></tr>`;
        })
        .join('') || '<tr><td colspan="3" class="empty">Nenhuma categoria ainda.</td></tr>';
  };
  const fail = (err) => toast('Não foi possível concluir: ' + (err.message || 'erro'));
  $('#ci').onsubmit = async (e) => {
    e.preventDefault();
    const n = $('#cin').value.trim();
    if (categoryNames().some((x) => x.toLowerCase() === n.toLowerCase())) return toast('Essa categoria já existe');
    try {
      await addCategory(n);
      $('#cin').value = '';
      toast('Categoria criada');
      draw();
    } catch (err) {
      fail(err);
    }
  };
  $('#crows').onclick = async (e) => {
    const see = e.target.closest('[data-see]');
    if (see) {
      PF.cat = see.dataset.see; // abre a lista de artigos já filtrada por essa categoria
      return;
    }
    const ren = e.target.closest('[data-ren]');
    if (ren) {
      const tr = ren.closest('tr'),
        old = ren.dataset.ren;
      tr.querySelector('.cname').innerHTML = `<input type="text" class="cedit" maxlength="40" value="${esc(old)}" aria-label="Novo nome de ${esc(old)}">`;
      tr.querySelector('.acts').innerHTML =
        '<button class="btn sm" data-save>Salvar</button><button class="btn sm alt" data-cancel>Cancelar</button>';
      const inp = tr.querySelector('.cedit');
      inp.focus();
      inp.select();
      inp.onkeydown = (ev) => {
        if (ev.key === 'Enter') tr.querySelector('[data-save]').click();
        if (ev.key === 'Escape') draw();
      };
      tr.querySelector('[data-cancel]').onclick = draw;
      tr.querySelector('[data-save]').onclick = async (b) => {
        const nn = inp.value.trim(),
          btn = b.currentTarget;
        if (!nn || nn === old) return draw();
        const exists = categoryNames().find((x) => x !== old && x.toLowerCase() === nn.toLowerCase());
        if (exists && btn.dataset.ok !== '1') {
          // nome que já existe: pede confirmação antes de mesclar
          btn.dataset.ok = '1';
          btn.textContent = `Mesclar em "${exists}"?`;
          return;
        }
        try {
          await renameCategory(old, exists || nn);
          toast(exists ? 'Categorias mescladas' : 'Categoria renomeada');
          draw();
        } catch (err) {
          fail(err);
        }
      };
      return;
    }
    const del = e.target.closest('[data-delcat]');
    if (del && !del.disabled) {
      if (del.dataset.ok !== '1') {
        del.dataset.ok = '1';
        del.textContent = 'Confirmar';
        setTimeout(() => {
          del.dataset.ok = '';
          del.textContent = 'Excluir';
        }, 3000);
        return;
      }
      try {
        await deleteCategory(del.dataset.delcat);
        toast('Categoria excluída');
        draw();
      } catch (err) {
        fail(err);
      }
    }
  };
  draw();
}
