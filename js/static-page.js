/**
 * Comportamento mínimo das páginas geradas pelo build (artigos e páginas fixas):
 * botão de tema, ano do rodapé e busca (que leva ao app na rota #/busca/...).
 */

const ROOT = document.body.dataset.root || './';

initThemeToggle();
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
