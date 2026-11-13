/**
 * Comportamento mínimo das páginas geradas pelo build (artigos e páginas fixas):
 * botão de tema, ano do rodapé e busca (que leva ao app na rota #/busca/...).
 */

const ROOT = document.body.dataset.root || './';

initThemeToggle();

/**
 * Entrar / Sair no cabeçalho das páginas geradas.
 * - Sem sessão: "Entrar" abre o app com a janela de login e, depois de entrar, volta para esta mesma página.
 * - Com sessão (equipe logada neste navegador): o "Entrar" sai do cabeçalho e aparece a barra da equipe acima das
 *   duas colunas, com o perfil à esquerda e "Painel", "Novo" e "Sair". Na página de um artigo, quem pode editá-lo ganha também a barra de edição rápida (editBar, abaixo).
 */
(function authNav() {
  const box = document.getElementById('authnav');
  const bar = document.getElementById('staffbar');
  if (!box) return;
  const tokenKey = () => {
    try {
      return Object.keys(localStorage).find((k) => /^sb-.+-auth-token$/.test(k));
    } catch (e) {
      return null;
    }
  };
  const render = () => {
    const k = tokenKey();
    if (!k) {
      box.innerHTML = `<a href="${ROOT}#/entrar/${encodeURIComponent(location.pathname)}">Entrar</a>`;
      if (bar) {
        bar.hidden = true;
        bar.innerHTML = '';
      }
      return;
    }
    let sess = {};
    try {
      sess = JSON.parse(localStorage.getItem(k) || '{}');
    } catch (e) {}
    const user = sess.user || {};
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const meLink = (name, photo) =>
      `<a class="nav-me" href="${ROOT}#/painel/perfil" title="Meu perfil">${
        photo
          ? `<img class="avatar" src="${esc(photo)}" alt="" width="28" height="28">`
          : `<span class="avatar avatar--ph" aria-hidden="true">${esc([...name][0].toUpperCase())}</span>`
      }<span class="nav-me-name">${esc(name)}</span></a>`;
    const fallback = user.email ? user.email.split('@')[0] : 'Meu perfil';
    box.innerHTML = '';
    if (!bar) return;
    bar.innerHTML = `${meLink(fallback, '')}
     <div class="staffbar-links"><a href="${ROOT}#/painel">Painel</a><a href="${ROOT}#/novo" title="Novo artigo">Novo</a><button type="button" id="out">Sair</button></div>`;
    bar.hidden = false;
    // nome e foto do perfil (tabela pública "profiles")
    if (user.id && typeof SUPABASE_URL !== 'undefined')
      fetch(`${SUPABASE_URL}/rest/v1/profiles?select=display_name,avatar_url&user_id=eq.${encodeURIComponent(user.id)}`, {
        headers: { apikey: SUPABASE_ANON_KEY },
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => {
          const p = d[0];
          const cur = bar.querySelector('.nav-me');
          if (p && cur && (p.display_name || p.avatar_url))
            cur.outerHTML = meLink(p.display_name || fallback, /^https?:\/\//.test(p.avatar_url || '') ? p.avatar_url : '');
        })
        .catch(() => {});
    document.getElementById('out').onclick = async () => {
      try {
        const s = JSON.parse(localStorage.getItem(k) || '{}');
        if (typeof SUPABASE_URL !== 'undefined' && s.access_token)
          await fetch(SUPABASE_URL + '/auth/v1/logout', {
            method: 'POST',
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + s.access_token },
          });
      } catch (e) {}
      try {
        localStorage.removeItem(k);
      } catch (e) {}
      document.querySelector('#main .editbar')?.remove();
      render();
    };
  };
  render();
  if (tokenKey()) editBar();
})();

/**
 * Barra de edição rápida acima do artigo (Editar, Excluir, Destaque, Publicado), para quem pode editá-lo.
 * Só para quem tem sessão: carrega o Supabase e o mesmo código do app (listado no <template id="edicao-js">).
 */
async function editBar() {
  const slug = document.body.dataset.slug;
  const tpl = document.getElementById('edicao-js');
  const art = document.querySelector('#main .art');
  if (!slug || !tpl || !art || typeof SUPABASE_URL === 'undefined') return;
  try {
    for (const s of tpl.content.querySelectorAll('script')) {
      await new Promise((ok, falha) => {
        const el = document.createElement('script');
        el.src = s.getAttribute('src');
        el.onload = ok;
        el.onerror = falha;
        document.head.appendChild(el);
      });
    }
    await checkRole();
    if (!staff()) return;
    await loadAll();
    const p = db.posts.find((x) => x.slug === slug);
    const html = editBarHTML(p, `${ROOT}#/editar/${encodeURIComponent(slug)}`);
    if (!html) return;
    art.insertAdjacentHTML('beforebegin', html);
    // o artigo desce para dar lugar à barra deslizando, em vez de pular
    const bar = document.querySelector('#main .editbar');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const h = bar.getBoundingClientRect().height + parseFloat(getComputedStyle(bar).marginBottom);
      art.animate([{ transform: `translateY(${-h}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2, .7, .2, 1)' });
    }
    initEditBar(bar, p, {
      onChange: (q, k) => {
        if (k === 'pub' && !q.pub) toast('Tirado do ar. Esta página sai do site na próxima atualização (em até 30 minutos).');
      },
      onDelete: () => setTimeout(() => location.replace(ROOT), 900),
    });
  } catch (e) {
    /* sem a barra: o resto da página continua funcionando */
  }
}
document.getElementById('yr').textContent = new Date().getFullYear();
document.getElementById('q').addEventListener('keydown', (e) => {
  const q = e.target.value.trim();
  if (e.key === 'Enter' && q) location.href = ROOT + '#/busca/' + encodeURIComponent(q);
});

/**
 * Contador de visualizações do artigo: soma 1 (no máximo uma vez por visitante a cada 24h; equipe logada não conta)
 * e mostra o total. Se o contador ainda não existir no banco, nada aparece.
 */
(async function views() {
  const id = document.body.dataset.post,
    slug = document.body.dataset.slug,
    el = document.getElementById('views');
  if (!id || !el || typeof SUPABASE_URL === 'undefined') return;
  const h = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
  const show = (n) => {
    el.textContent = n === 1 ? '1 leitura' : n.toLocaleString('pt-BR') + ' leituras';
    el.hidden = false;
  };
  const key = 'arcar:view:' + slug;
  let skip = false;
  try {
    const t = Number(localStorage.getItem(key));
    skip = (t && Date.now() - t < 864e5) || Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k));
  } catch (e) {}
  try {
    if (!skip) {
      const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/register_view', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ p_slug: slug }),
      });
      if (r.ok) {
        show(Number(await r.json()));
        try {
          localStorage.setItem(key, String(Date.now()));
        } catch (e) {}
        return;
      }
    }
    const r = await fetch(SUPABASE_URL + '/rest/v1/post_views?select=views&post_id=eq.' + encodeURIComponent(id), {
      headers: h,
    });
    if (r.ok) {
      const d = await r.json();
      show(d.length ? Number(d[0].views) : 0);
    }
  } catch (e) {}
})();

/** Página Escritores: troca os cards gerados no build pela lista atual do banco (mudanças feitas no painel aparecem na hora). */
(function refreshWriters() {
  const box = document.getElementById('writers-list');
  if (!box || typeof writersHTML !== 'function' || typeof SUPABASE_URL === 'undefined') return;
  fetch(`${SUPABASE_URL}/rest/v1/rpc/writers`, { headers: { apikey: SUPABASE_ANON_KEY } })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((list) => trocar(box, writersHTML(list)))
    .catch(() => {});
})();
