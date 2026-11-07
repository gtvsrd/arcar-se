/**
 * Curtir e compartilhar (abaixo do artigo). Usado no app e nas páginas geradas de cada artigo.
 * - Curtida anônima: como a contagem de visualizações, não precisa de login; o navegador guarda que já curtiu
 *   (uma curtida por navegador, que pode ser desfeita).
 * - Compartilhar: copiar link, WhatsApp, Instagram (pelo menu de compartilhar do celular ou copiando o link) e X.
 *   O link compartilhado é sempre o da página gerada do artigo, que tem as tags de prévia (Open Graph).
 */

const PA_ICONS = {
  heart:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 6.9 4.5c2 0 3.4 1.1 5.1 3 1.7-1.9 3.1-3 5.1-3 3.5 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>',
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5l1.3-3.8A8 8 0 1 1 8.5 19z"/></svg>',
  camera:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.6"/></svg>',
  post: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4L7 20M17 4l-2 16M4 9h16M3.5 15h16"/></svg>',
};

/** HTML da faixa de curtir/compartilhar. `url` é o endereço público do artigo. */
function postActionsHTML({ id, slug, url, title }) {
  const e = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const u = encodeURIComponent(url),
    t = encodeURIComponent(title);
  return `<section class="post-actions" data-id="${e(id)}" data-slug="${e(slug)}" data-url="${e(url)}" data-title="${e(title)}" aria-label="Curtir e compartilhar">
   <button type="button" class="pa-like" aria-pressed="false" hidden>${PA_ICONS.heart}<span class="pa-like-label">Curtir</span><span class="pa-like-count" aria-live="polite"></span></button>
   <div class="pa-share"><span class="pa-share-label">Compartilhar</span>
     <button type="button" class="pa-btn" data-share="link">${PA_ICONS.link}<span>Copiar link</span></button>
     <a class="pa-btn" data-share="whatsapp" href="https://wa.me/?text=${encodeURIComponent(title + '\n' + url)}" target="_blank" rel="noopener">${PA_ICONS.chat}<span>WhatsApp</span></a>
     <button type="button" class="pa-btn" data-share="instagram">${PA_ICONS.camera}<span>Instagram</span></button>
     <a class="pa-btn" data-share="x" href="https://x.com/intent/tweet?text=${t}&amp;url=${u}" target="_blank" rel="noopener">${PA_ICONS.post}<span>X</span></a>
     <span class="pa-hint" role="status"></span>
   </div>
  </section>`;
}

/** Liga os botões de uma faixa (uma vez só por elemento). */
function initPostActions(el) {
  if (!el || el.dataset.ready) return;
  el.dataset.ready = '1';
  const { id, slug, url, title } = el.dataset;
  const ok = typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined';
  const h = ok ? { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' } : {};
  const key = 'arcar:like:' + slug;
  const store = {
    get: () => {
      try {
        return localStorage.getItem(key) === '1';
      } catch (e) {
        return false;
      }
    },
    set: (v) => {
      try {
        v ? localStorage.setItem(key, '1') : localStorage.removeItem(key);
      } catch (e) {}
    },
  };

  // ---- curtir
  const like = el.querySelector('.pa-like');
  let liked = store.get(),
    total = 0,
    busy = false;
  const show = () => {
    like.setAttribute('aria-pressed', String(liked));
    like.querySelector('.pa-like-label').textContent = liked ? 'Curtido' : 'Curtir';
    like.querySelector('.pa-like-count').textContent = total ? total.toLocaleString('pt-BR') : '';
    like.setAttribute('aria-label', `${liked ? 'Desfazer curtida' : 'Curtir'} (${total === 1 ? '1 curtida' : total.toLocaleString('pt-BR') + ' curtidas'})`);
  };
  if (ok)
    fetch(`${SUPABASE_URL}/rest/v1/post_likes?select=likes&post_id=eq.${encodeURIComponent(id)}`, { headers: h })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        total = d.length ? Number(d[0].likes) : 0;
        if (liked && !total) liked = false; // contagem zerada no banco: o navegador esquece a curtida antiga
        like.hidden = false; // só aparece se o contador existir no banco
        show();
      })
      .catch(() => {});
  like.onclick = async () => {
    if (busy) return;
    busy = true;
    const want = !liked;
    liked = want;
    total = Math.max(0, total + (want ? 1 : -1)); // mostra na hora; o banco confirma em seguida
    show();
    like.classList.toggle('pa-pop', want);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/like_post`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ p_slug: slug, p_like: want }),
      });
      if (!r.ok) throw 0;
      total = Number(await r.json());
      store.set(want);
    } catch (e) {
      liked = !want; // falhou: volta como estava
      total = Math.max(0, total + (want ? -1 : 1));
    }
    show();
    busy = false;
  };

  // ---- compartilhar
  const flash = (btn, text) => {
    const s = btn.querySelector('span'),
      old = s.textContent;
    s.textContent = text;
    btn.classList.add('pa-done');
    setTimeout(() => {
      s.textContent = old;
      btn.classList.remove('pa-done');
    }, 2200);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch (e) {
      // navegadores antigos ou sem permissão: seleção temporária
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      let done = false;
      try {
        done = document.execCommand('copy');
      } catch (err) {}
      ta.remove();
      return done;
    }
  };
  el.querySelector('[data-share=link]').onclick = async (ev) => {
    flash(ev.currentTarget, (await copy()) ? 'Link copiado!' : 'Não foi possível copiar');
  };
  // Instagram não tem link de compartilhamento na web: no celular abre o menu de compartilhar do sistema
  // (onde aparece o Instagram); no computador, copia o link para colar no Instagram.
  el.querySelector('[data-share=instagram]').onclick = async (ev) => {
    const btn = ev.currentTarget;
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // a pessoa fechou o menu
      }
    }
    const done = await copy();
    flash(btn, done ? 'Link copiado!' : 'Não foi possível copiar');
    if (done) {
      const hint = el.querySelector('.pa-hint');
      hint.textContent = 'Agora é só colar o link no Instagram (Direct, story ou bio).';
      setTimeout(() => (hint.textContent = ''), 5000);
    }
  };
}

document.addEventListener('DOMContentLoaded', () => document.querySelectorAll('.post-actions').forEach(initPostActions));
