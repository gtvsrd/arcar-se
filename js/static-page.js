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
 *   duas colunas, com o perfil à esquerda e "Painel", "Novo" (e "Editar este artigo", na página de um artigo) e "Sair".
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
    // Na página de um artigo, a equipe ganha o atalho para editá-lo
    const slug = document.body.dataset.slug;
    const editar = slug ? `<a href="${ROOT}#/editar/${encodeURIComponent(slug)}">Editar este artigo</a>` : '';
    box.innerHTML = '';
    if (!bar) return;
    bar.innerHTML = `${meLink(fallback, '')}
     <div class="staffbar-links"><a href="${ROOT}#/painel">Painel</a><a href="${ROOT}#/novo" title="Novo artigo">Novo</a>${editar}<button type="button" id="out">Sair</button></div>`;
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
      render();
    };
  };
  render();
})();
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
