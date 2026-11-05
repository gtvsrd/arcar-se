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

/** Desenha o painel e a seção escolhida ('' artigos, 'perfil' ou 'equipe'). */
function panel(tab) {
  if (tab !== 'perfil' && tab !== 'equipe') tab = '';
  if (tab === 'equipe' && !admin) tab = '';
  const tabs = [
    ['', 'Artigos'],
    ['perfil', 'Meu perfil'],
    ...(admin ? [['equipe', 'Equipe']] : []),
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
  const cats = [...new Set(mine.map((p) => p.cat))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const authors = [...new Set(mine.map((p) => p.author_id || ''))].sort((a, b) =>
    authorName(a).localeCompare(authorName(b), 'pt-BR'),
  );
  const opt = (v, l, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`;
  const pend = count('review');

  const cols = [
    ['title', 'Título'],
    ['cat', 'Categoria'],
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
     <thead><tr>${cols.map(([k, l]) => `<th scope="col" data-k="${k}"><button type="button" data-sort="${k}">${l}<i aria-hidden="true"></i></button></th>`).join('')}<th scope="col">Ações</th></tr></thead>
     <tbody id="prows"></tbody>
   </table></div>`;

  /** Aplica filtros e ordenação. */
  const list = () => {
    const t = PF.q.trim().toLowerCase();
    const cmp = {
      title: (a, b) => a.title.localeCompare(b.title, 'pt-BR'),
      cat: (a, b) => a.cat.localeCompare(b.cat, 'pt-BR'),
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
          (!t || `${p.title} ${p.cat} ${authorName(p.author_id)}`.toLowerCase().includes(t)) &&
          (!PF.cat || p.cat === PF.cat) &&
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
     <td class="pt" data-l="Título"><a href="#/post/${esc(p.slug || p.id)}">${esc(p.title)}</a>${st === 'returned' ? `<div class="pnote">${esc(p.review_note)}</div>` : ''}</td>
     <td data-l="Categoria">${esc(p.cat)}</td>
     ${admin ? `<td data-l="Autor"><span class="who">${who}</span></td>` : ''}
     <td data-l="Situação"><span class="st st--${st}">${STATUS_LABEL[st]}</span></td>
     <td data-l="Destaque">${p.featured ? '<span title="Em destaque">★</span>' : '<span class="mut">—</span>'}</td>
     <td data-l="Data">${shortDate(p.date)}</td>
     ${db.viewsOn ? `<td class="num" data-l="Leituras">${p.pub ? viewsOf(p).toLocaleString('pt-BR') : '<span class="mut">—</span>'}</td>` : ''}
     <td class="pa"><div class="acts">
       ${canEdit(p) ? `<a class="btn sm alt" href="#/editar/${p.id}">Editar</a>` : ''}
       ${admin && p.pub ? `<button class="btn sm alt" data-pact="unpub" data-id="${p.id}">Tirar do ar</button>` : ''}
       ${admin && !p.pub ? `<button class="btn sm alt" data-pact="pub" data-id="${p.id}">Publicar</button>` : ''}
       ${admin && p.submitted && !p.pub ? `<button class="btn sm alt" data-pact="ret" data-id="${p.id}">Devolver</button>` : ''}
       ${canEdit(p) ? `<button class="btn sm del" data-del="${p.id}">Excluir</button>` : ''}
     </div></td></tr>`;
  };

  const draw = () => {
    const l = list();
    $('#prows').innerHTML =
      l.map(row).join('') ||
      `<tr><td class="empty" colspan="${cols.length + 1}">Nenhum artigo com esses filtros.</td></tr>`;
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

/** Nome de exibição e foto do usuário logado. */
function panelProfile() {
  const cur = db.profiles[me.id] || { display_name: '', avatar_url: '' };
  let avatar = cur.avatar_url || '';
  let pending = null; // nova foto escolhida, ainda não enviada
  $('#pbody').innerHTML = `<form id="pp" class="art art--edit" style="max-width:560px">
   <p class="hint">Seu nome e sua foto aparecem nas informações dos artigos que você criar.</p>
   <label for="pn">Nome de exibição</label>
   <input type="text" id="pn" required maxlength="60" value="${esc(cur.display_name)}" autocomplete="name">
   <label>Foto de perfil</label>
   <div class="avatar-edit">
     <div class="avatar avatar--lg" id="pav" aria-hidden="true"></div>
     <div>
       <input type="file" id="pfile" accept="image/*" aria-label="Escolher foto de perfil">
       <div class="acts"><button type="button" class="btn sm del" id="prm" hidden>Remover foto</button></div>
       <div class="hint">A foto é recortada em quadrado e reduzida automaticamente.</div>
     </div>
   </div>
   <div class="acts" style="margin-top:18px"><button class="btn" type="submit">Salvar perfil</button><a class="btn alt" href="#/painel">Cancelar</a></div>
   <p class="hint">Para trocar a senha, use <a href="#/conta">Alterar senha</a>.</p>
  </form>`;
  const show = () => {
    const name = $('#pn').value.trim() || '?';
    const src = pending ? URL.createObjectURL(pending) : avatar;
    $('#pav').innerHTML = src ? `<img src="${esc(src)}" alt="">` : esc([...name][0].toUpperCase());
    $('#prm').hidden = !src;
  };
  $('#pn').oninput = show;
  $('#pfile').onchange = () => {
    const f = $('#pfile').files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast('Escolha um arquivo de imagem');
    squareImage(f)
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
  $('#pp').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#pp button[type=submit]');
    btn.disabled = true;
    let uploaded = '';
    try {
      if (pending) avatar = uploaded = await uploadAvatar(pending);
      await saveProfile($('#pn').value.trim(), avatar);
      if (cur.avatar_url && cur.avatar_url !== avatar) deleteCover(cur.avatar_url); // foto antiga
      toast('Perfil salvo');
      panel('perfil');
    } catch (err) {
      if (uploaded) deleteCover(uploaded);
      toast('Não foi possível salvar: ' + (err.message || 'erro'));
    } finally {
      btn.disabled = false;
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
       <td class="pa">${
         m.role === 'creator'
           ? `<button class="btn sm del" data-rm="${esc(m.user_id)}">Remover acesso</button>`
           : m.role === 'invite'
             ? `<button class="btn sm del" data-cancel="${esc(m.email)}">Cancelar convite</button>`
             : ''
       }</td></tr>`,
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
