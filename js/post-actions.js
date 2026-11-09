/**
 * Curtir e compartilhar (abaixo do artigo). Usado no app e nas páginas geradas de cada artigo.
 * - Curtida anônima: como a contagem de visualizações, não precisa de login; o navegador guarda que já curtiu
 *   (uma curtida por navegador, que pode ser desfeita).
 * - Compartilhar: um botão ao lado de curtir abre um pequeno menu com "Copiar link" e "WhatsApp".
 *   O link compartilhado é sempre o da página gerada do artigo, que tem as tags de prévia (Open Graph).
 */

const PA_ICONS = {
  heart:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 6.9 4.5c2 0 3.4 1.1 5.1 3 1.7-1.9 3.1-3 5.1-3 3.5 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>',
  share:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3.5M7.5 8L12 3.5 16.5 8M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
};

/** HTML da faixa de curtir/compartilhar. `url` é o endereço público do artigo. */
function postActionsHTML({ id, slug, url, title }) {
  const e = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  return `<section class="post-actions" data-id="${e(id)}" data-slug="${e(slug)}" data-url="${e(url)}" data-title="${e(title)}" aria-label="Curtir e compartilhar">
   <button type="button" class="pa-like" aria-pressed="false" aria-label="Curtir" title="Curtir" hidden>${PA_ICONS.heart}<span class="pa-like-count"></span></button>
   <div class="pa-share">
     <button type="button" class="pa-btn pa-share-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="pa-menu-${e(slug)}">${PA_ICONS.share}<span>Compartilhar</span></button>
     <div class="pa-menu" id="pa-menu-${e(slug)}" role="menu" hidden>
       <button type="button" role="menuitem" class="pa-item" data-share="link">${PA_ICONS.link}<span>Copiar link</span></button>
       <a role="menuitem" class="pa-item" data-share="whatsapp" href="https://wa.me/?text=${encodeURIComponent(title + '\n' + url)}" target="_blank" rel="noopener"><span class="pa-ico pa-ico-wa" aria-hidden="true"></span><span>WhatsApp</span></a>
     </div>
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
  // o botão mostra só o coração (e o número, se houver); o nome para leitores de tela fica no aria-label
  const show = () => {
    like.setAttribute('aria-pressed', String(liked));
    like.querySelector('.pa-like-count').textContent = total ? total.toLocaleString('pt-BR') : '';
    like.setAttribute('aria-label', `${liked ? 'Desfazer curtida' : 'Curtir'} (${total === 1 ? '1 curtida' : total.toLocaleString('pt-BR') + ' curtidas'})`);
    like.title = liked ? 'Desfazer curtida' : 'Curtir';
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

  // ---- compartilhar: botão que abre um menu pequeno (Copiar link, WhatsApp)
  const btn = el.querySelector('.pa-share-btn'),
    menu = el.querySelector('.pa-menu'),
    hint = el.querySelector('.pa-hint');
  const items = () => [...menu.querySelectorAll('[role=menuitem]')];
  const onDoc = (ev) => {
    if (!el.querySelector('.pa-share').contains(ev.target)) close();
  };
  const open = () => {
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    items()[0].focus();
    document.addEventListener('pointerdown', onDoc);
  };
  const close = (focusBtn) => {
    if (menu.hidden) return;
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onDoc);
    if (focusBtn) btn.focus();
  };
  btn.onclick = () => (menu.hidden ? open() : close(true));
  btn.onkeydown = (ev) => {
    if (ev.key === 'ArrowDown' && menu.hidden) {
      ev.preventDefault();
      open();
    }
  };
  menu.onkeydown = (ev) => {
    const list = items(),
      i = list.indexOf(document.activeElement);
    if (ev.key === 'Escape') {
      ev.preventDefault();
      close(true);
    } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      list[(i + (ev.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length].focus();
    } else if (ev.key === 'Tab') close();
  };
  const say = (text) => {
    hint.textContent = text;
    clearTimeout(say.t);
    say.t = setTimeout(() => (hint.textContent = ''), 2500);
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
  menu.querySelector('[data-share=link]').onclick = async () => {
    const done = await copy();
    close(true);
    say(done ? 'Link copiado!' : 'Não foi possível copiar o link');
  };
  menu.querySelector('[data-share=whatsapp]').onclick = () => close();
}

document.addEventListener('DOMContentLoaded', () => document.querySelectorAll('.post-actions').forEach(initPostActions));
