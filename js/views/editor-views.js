/**
 * Telas do administrador: editor de artigo/página e troca de senha
 */

/** Máximo de categorias por artigo. */
const MAX_CATS = 3;

/** Formulário de criação/edição de artigo ou página. */
function editor(kind, id) {
  const isPage = kind === 'page';
  const pid = !isPage && id ? (findPost(id) || {}).id : id; // id real no banco (a rota pode trazer o slug)
  const it = isPage
    ? db.pages[id]
    : id
      ? findPost(id)
      : { title: '', cat: '', cats: [], excerpt: '', body: '', pub: admin, featured: false, slug: '' };
  if (!it || (!isPage && id && !canEdit(it))) {
    location.hash = '#/';
    return;
  }
  // avisos no topo: devolução do admin (para o criador) e pedido de revisão (para o admin)
  const note =
    !isPage && it.review_note
      ? `<div class="box notice"><b>Devolvido pelo administrador:</b> ${esc(it.review_note)}</div>`
      : !isPage && admin && it.submitted && !it.pub
        ? `<div class="box notice">Enviado para revisão${authorOf(it) ? ' por <b>' + esc(authorOf(it).display_name) + '</b>' : ''}. Para publicar, marque <b>Publicado</b> abaixo.</div>`
        : '';
  let picked = isPage ? [] : catsOf(it).filter(Boolean); // categorias escolhidas, na ordem (a primeira é a principal)
  const noName =
    creator && !(me && db.profiles[me.id] && db.profiles[me.id].display_name)
      ? '<div class="hint">Defina seu nome de exibição em <a href="#/painel/perfil">Painel › Perfil</a> para ele aparecer neste artigo.</div>'
      : '';
  $('#main').innerHTML = `<div class="art art--edit"><h1>${isPage ? 'Editar página' : id ? 'Editar artigo' : 'Novo artigo'}</h1>${note}${noName}
  <form id="f">
   <label for="t">Título</label><input type="text" id="t" required value="${esc(it.title)}">
   ${
     isPage
       ? ''
       : `<fieldset class="catpick" id="catpick"><legend>Categorias <span class="mut">(escolha de 1 a ${MAX_CATS})</span></legend>${
           categoryNames().length
             ? `<div class="chips">${categoryNames()
                 .map(
                   (c) =>
                     `<label class="chip"><input type="checkbox" name="cat" value="${esc(c)}"${picked.includes(c) ? ' checked' : ''}> ${esc(c)}</label>`,
                 )
                 .join('')}</div><div class="hint" id="cathint" role="status"></div>`
             : `<div class="hint">Nenhuma categoria cadastrada.${admin ? ' Crie em <a href="#/painel/categorias">Painel › Categorias</a>.' : ' Peça ao administrador para criar.'}</div>`
         }</fieldset>
   <label for="sl">Endereço do artigo (slug)</label><input type="text" id="sl" value="${esc(it.slug || '')}" autocomplete="off" spellcheck="false">
   <div class="hint" id="slhint"></div>
   <label for="e">Resumo (aparece no card)</label><input type="text" id="e" maxlength="160" value="${esc(it.excerpt)}">
   <label for="imgfile">Imagem de capa (opcional)</label>
   <div class="img-field">
     <div class="img-row"><input type="file" id="imgfile" accept="image/*"><button type="button" class="btn sm del" id="imgrm" hidden>Remover imagem</button></div>
     <label for="imgurl" class="sub">ou cole o endereço (URL) da imagem</label>
     <input type="text" id="imgurl" placeholder="https://exemplo.com/foto.jpg" value="${esc(/^https?:/.test(it.img || '') ? it.img : '')}">
     <img class="img-prev" id="imgprev" alt="Prévia da imagem de capa" hidden>
     <div class="hint">Aparece no topo do card e do artigo. Imagens enviadas são reduzidas automaticamente.</div>
   </div>`
   }
   <label id="blabel">Conteúdo</label>
   <div class="rte-wrap" id="rte"></div>
   <div class="hint">Tab insere 5 espaços (Shift+Tab remove). Para sair do texto só pelo teclado, aperte Esc e depois Tab.</div>
   ${
     isPage
       ? ''
       : admin
         ? `<label><input type="checkbox" id="pub" ${it.pub ? 'checked' : ''}> Publicado (desmarque para salvar como rascunho)</label>
   <label><input type="checkbox" id="feat" ${it.featured ? 'checked' : ''}> Destacar na página inicial (máximo de ${HERO_MAX})</label><div class="hint" id="feathint"></div>`
         : it.pub
           ? '<div class="hint">Este artigo está publicado. As alterações vão ao ar assim que você salvar.</div>'
           : '<div class="hint">Criadores não publicam: salve como rascunho ou envie para revisão e o administrador publica.</div>'
   }
   <div class="acts" style="margin-top:18px">${
     isPage || admin
       ? `<button class="btn" type="submit">${isPage ? 'Salvar página' : 'Salvar artigo'}</button>`
       : it.pub
         ? '<button class="btn" type="submit" data-act="save">Salvar alterações</button>'
         : '<button class="btn" type="submit" data-act="review">Enviar para revisão</button><button class="btn alt" type="submit" data-act="draft">Salvar rascunho</button>'
   }<a class="btn alt" href="${admin ? '#/' : '#/painel'}">Cancelar</a></div>
  </form></div>`;
  const rte = createRichEditor($('#rte'), it.body, 'blabel');
  $('#blabel').onclick = () => rte.focus();
  let img = it.img || ''; // capa atual (endereço da imagem)
  let pending = null; // novo arquivo escolhido, ainda não enviado
  if (!isPage) {
    const prev = $('#imgprev'),
      url = $('#imgurl'),
      file = $('#imgfile'),
      rm = $('#imgrm');
    const showPreview = () => {
      prev.hidden = rm.hidden = !(img || pending);
      if (pending) prev.src = URL.createObjectURL(pending);
      else if (img) prev.src = img;
    };
    prev.onerror = () => toast('Não foi possível carregar essa imagem');
    url.oninput = () => {
      const v = url.value.trim();
      img = /^https?:\/\//i.test(v) ? v : '';
      if (img) {
        file.value = '';
        pending = null;
      }
      showPreview();
    };
    file.onchange = () => {
      const f = file.files[0];
      if (!f) return;
      if (!f.type.startsWith('image/')) return toast('Escolha um arquivo de imagem');
      resizeImage(f)
        .then((blob) => {
          pending = blob;
          img = '';
          url.value = '';
          showPreview();
        })
        .catch(() => toast('Não foi possível ler essa imagem'));
    };
    rm.onclick = () => {
      img = '';
      pending = null;
      url.value = file.value = '';
      showPreview();
    };
    showPreview();
  }
  if (!isPage) {
    // endereço (slug): novo artigo acompanha o título até você editar o campo; artigo existente mantém o endereço
    const sl = $('#sl'),
      slh = $('#slhint'),
      title = $('#t');
    let slugEdited = !!it.slug;
    const finalSlug = () => uniqueSlug(slugify(sl.value) || slugify(title.value), pid);
    const showSlug = () => {
      const f = finalSlug();
      slh.textContent =
        `Endereço final: …/post/${f}/` +
        (it.slug && f !== it.slug ? ' — atenção: mudar o endereço quebra links já compartilhados.' : '');
    };
    title.addEventListener('input', () => {
      if (!slugEdited) sl.value = slugify(title.value);
      showSlug();
    });
    sl.addEventListener('input', () => {
      slugEdited = true;
      showSlug();
    });
    sl.addEventListener('blur', () => {
      sl.value = slugify(sl.value);
      showSlug();
    });
    showSlug();
  }
  if (!isPage && $('#catpick .chips')) {
    // categorias: até MAX_CATS; a primeira escolhida é a principal (mostrada em destaque na capa)
    const boxes = [...document.querySelectorAll('#catpick input[name=cat]')];
    const refresh = () => {
      boxes.forEach((b) => (b.disabled = !b.checked && picked.length >= MAX_CATS));
      $('#cathint').textContent = picked.length
        ? `Principal: ${picked[0]}${picked.length > 1 ? ' · outras: ' + picked.slice(1).join(', ') : ''} (${picked.length} de ${MAX_CATS})`
        : 'Escolha ao menos uma categoria.';
    };
    boxes.forEach(
      (b) =>
        (b.onchange = () => {
          picked = b.checked ? [...picked, b.value] : picked.filter((c) => c !== b.value);
          refresh();
        }),
    );
    refresh();
  }
  if (admin && !isPage) {
    // limite de destaques: bloqueia a caixa se já houver o máximo em outros artigos
    const others = db.posts.filter((p) => p.featured && p.id !== pid).length;
    const full = others >= HERO_MAX && !it.featured;
    $('#feat').disabled = full;
    $('#feathint').textContent = full
      ? `Já existem ${HERO_MAX} artigos em destaque. Remova o destaque de outro artigo para escolher este.`
      : `Destaques em uso por outros artigos: ${others} de ${HERO_MAX}.`;
  }
  $('#f').onsubmit = async (ev) => {
    ev.preventDefault();
    if (rte.isEmpty()) {
      toast('Escreva o conteúdo antes de salvar');
      rte.focus();
      return;
    }
    const act = ev.submitter && ev.submitter.dataset.act;
    const btns = [...document.querySelectorAll('#f button[type=submit]')];
    btns.forEach((b) => (b.disabled = true));
    const uploaded = [];
    const oldImages = [it.img, ...mdImages(it.body)]; // capa e imagens do texto antes desta edição
    try {
      const body = await rte.getBody(uploaded);
      if (isPage) {
        await savePage(id, $('#t').value.trim(), body);
        deleteUnusedImages(oldImages);
        toast('Página salva');
        location.hash = '#/pagina/' + id;
        return;
      }
      if (!picked.length) {
        toast('Escolha ao menos uma categoria');
        return;
      }
      const d = {
        title: $('#t').value.trim(),
        slug: uniqueSlug(slugify($('#sl').value) || slugify($('#t').value), pid),
        cat: picked[0],
        cats: picked,
        excerpt: $('#e').value.trim() || plainText(body).slice(0, 130).trim() + '…',
        body,
        img,
      };
      if (admin) {
        d.pub = $('#pub').checked;
        d.featured = $('#feat').checked;
      } else if (!it.pub) d.submitted = act === 'review'; // criador: rascunho ou envio para revisão (publicar é com o admin)
      if (pending) {
        d.img = await uploadCover(pending);
        uploaded.push(d.img);
      }
      await savePost(pid ? { id: pid, ...d } : d);
      deleteUnusedImages(oldImages); // imagens trocadas ou removidas nesta edição
      toast(
        admin
          ? d.pub
            ? 'Artigo publicado'
            : 'Rascunho salvo'
          : d.submitted
            ? 'Enviado para revisão'
            : it.pub
              ? 'Alterações salvas'
              : 'Rascunho salvo',
      );
      location.hash = admin ? '#/' : '#/painel';
    } catch (err) {
      uploaded.forEach(deleteCover);
      toast(
        err.code === '23505'
          ? 'Já existe um artigo com esse endereço. Altere o campo de endereço.'
          : 'Não foi possível salvar: ' + (err.message || 'erro desconhecido'),
      );
    } finally {
      btns.forEach((b) => (b.disabled = false));
    }
  };
}
/** Tela aberta pelo link "esqueci a senha" do e-mail: define a nova senha. */
async function resetPassword() {
  const { data } = await sb.auth.getSession();
  if (!data.session || AUTH_LINK.error) {
    $('#main').innerHTML =
      '<div class="art"><h1>Link inválido ou expirado</h1><p>O link para criar uma nova senha vale por pouco tempo e só pode ser usado uma vez. Clique em <b>Entrar</b> › <b>Esqueci a senha</b> para receber outro.</p><p><a href="#/">← Voltar aos artigos</a></p></div>';
    return;
  }
  $('#main').innerHTML = `<div class="art"><h1>Criar nova senha</h1><form id="f"><label for="np">Nova senha (mínimo 6 caracteres)</label><input type="password" id="np" minlength="6" required autocomplete="new-password"><label for="np2">Repita a nova senha</label><input type="password" id="np2" minlength="6" required autocomplete="new-password"><div class="err" id="rerr" role="alert"></div><div class="acts" style="margin-top:18px"><button class="btn" type="submit">Salvar nova senha</button></div></form></div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    if ($('#np').value !== $('#np2').value) {
      $('#rerr').textContent = 'As duas senhas não são iguais.';
      return;
    }
    const btn = $('#f button[type=submit]');
    btn.disabled = true;
    try {
      await changePassword($('#np').value);
      await checkRole();
      if (staff()) {
        await loadAll();
        toast('Senha alterada. Você já está logado.');
        location.hash = '#/painel';
      } else {
        await sb.auth.signOut(); // conta sem acesso à equipe: não deixa sessão aberta
        toast('Senha alterada.');
        location.hash = '#/';
      }
    } catch (err) {
      $('#rerr').textContent = /different from the old/i.test(err.message || '')
        ? 'Escolha uma senha diferente da anterior.'
        : 'Não foi possível salvar a nova senha. Peça um novo link e tente de novo.';
      btn.disabled = false;
    }
  };
}

/** Formulário de troca de senha (admin e criadores). */
function account() {
  $('#main').innerHTML =
    `<div class="art"><h1>Alterar senha</h1><form id="f"><label for="np">Nova senha (mínimo 6 caracteres)</label><input type="password" id="np" minlength="6" required autocomplete="new-password"><div class="acts" style="margin-top:18px"><button class="btn" type="submit">Salvar senha</button><a class="btn alt" href="#/">Cancelar</a></div></form></div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await changePassword($('#np').value);
      toast('Senha alterada');
      location.hash = '#/';
    } catch (err) {
      toast('Não foi possível alterar a senha: ' + err.message);
    }
  };
}
