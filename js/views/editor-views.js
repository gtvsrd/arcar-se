/**
 * Telas do administrador: editor de artigo/página e troca de senha
 */

/** Formulário de criação/edição de artigo ou página. */
function editor(kind, id) {
  const isPage = kind === 'page';
  const pid = !isPage && id ? (findPost(id) || {}).id : id; // id real no banco (a rota pode trazer o slug)
  const it = isPage
    ? db.pages[id]
    : id
      ? findPost(id)
      : { title: '', cat: '', excerpt: '', body: '', pub: true, featured: false, slug: '' };
  if (!it) {
    location.hash = '#/';
    return;
  }
  $('#main').innerHTML = `<div class="art art--edit"><h1>${isPage ? 'Editar página' : id ? 'Editar artigo' : 'Novo artigo'}</h1>
  <form id="f">
   <label for="t">Título</label><input type="text" id="t" required value="${esc(it.title)}">
   ${
     isPage
       ? ''
       : `<label for="c">Categoria</label><input type="text" id="c" required value="${esc(it.cat)}" list="cl"><datalist id="cl">${[...new Set(db.posts.map((p) => p.cat))].map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
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
   ${
     isPage
       ? ''
       : `<label><input type="checkbox" id="pub" ${it.pub ? 'checked' : ''}> Publicado (desmarque para salvar como rascunho)</label>
   <label><input type="checkbox" id="feat" ${it.featured ? 'checked' : ''}> Destacar na página inicial (máximo de ${HERO_MAX})</label><div class="hint" id="feathint"></div>`
   }
   <div class="acts" style="margin-top:18px"><button class="btn" type="submit">${isPage ? 'Salvar página' : 'Salvar artigo'}</button><a class="btn alt" href="#/">Cancelar</a></div>
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
  if (!isPage) {
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
    const btn = $('#f button[type=submit]');
    btn.disabled = true;
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
      const d = {
        title: $('#t').value.trim(),
        slug: uniqueSlug(slugify($('#sl').value) || slugify($('#t').value), pid),
        cat: $('#c').value.trim(),
        excerpt: $('#e').value.trim() || plainText(body).slice(0, 130).trim() + '…',
        body,
        pub: $('#pub').checked,
        featured: $('#feat').checked,
        img,
      };
      if (pending) {
        d.img = await uploadCover(pending);
        uploaded.push(d.img);
      }
      await savePost(pid ? { id: pid, ...d } : d);
      deleteUnusedImages(oldImages); // imagens trocadas ou removidas nesta edição
      toast(d.pub ? 'Artigo publicado' : 'Rascunho salvo');
      location.hash = '#/';
    } catch (err) {
      uploaded.forEach(deleteCover);
      toast(
        err.code === '23505'
          ? 'Já existe um artigo com esse endereço. Altere o campo de endereço.'
          : 'Não foi possível salvar: ' + (err.message || 'erro desconhecido'),
      );
    } finally {
      btn.disabled = false;
    }
  };
}
/** Formulário de troca de senha do admin. */
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
