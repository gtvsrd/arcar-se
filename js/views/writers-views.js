/**
 * Página "Escritores": um card por escritor (foto à esquerda, nome, texto e redes/site).
 * Usado no app (#/escritores), no build (página gerada /escritores/) e pela página gerada para se atualizar.
 * Os dados vêm de "profiles" e só são editados no painel.
 */

/** Redes e contatos aceitos no card, na ordem em que aparecem. */
const WRITER_NETS = [
  { k: 'instagram', label: 'Instagram', ph: '@usuario ou endereço do perfil' },
  { k: 'x', label: 'X', ph: '@usuario ou endereço do perfil' },
  { k: 'youtube', label: 'YouTube', ph: '@canal ou endereço do canal' },
  { k: 'site', label: 'Site', ph: 'seusite.com.br' },
  { k: 'email', label: 'E-mail', ph: 'voce@exemplo.com' },
];

/**
 * Transforma o que foi digitado no painel num endereço seguro (ou '' se não der).
 * Aceita @usuario no Instagram, X e YouTube; completa https:// quando faltar; só deixa passar http(s) e mailto.
 */
function writerLinkUrl(k, v) {
  v = String(v || '').trim();
  if (!v) return '';
  if (k === 'email') return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? 'mailto:' + v : '';
  const handle = v.replace(/^@/, '');
  const base = { instagram: 'https://www.instagram.com/', x: 'https://x.com/', youtube: 'https://www.youtube.com/@' }[k];
  if (base && /^@?[\w.-]+$/.test(v)) return base + handle;
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
    return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : '';
  } catch (e) {
    return '';
  }
}

/** Texto do link: nome da rede; no site, o domínio; no e-mail, o endereço. */
function writerLinkText(k, url) {
  if (k === 'email') return url.replace(/^mailto:/, '');
  if (k === 'site') return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
  return (WRITER_NETS.find((n) => n.k === k) || {}).label || k;
}

/** HTML de um card. */
function writerCardHTML(w) {
  const e = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const name = w.display_name || '';
  const photo = /^https?:\/\//.test(w.avatar_url || '') ? w.avatar_url : '';
  const links = WRITER_NETS.map((n) => {
    const url = writerLinkUrl(n.k, (w.links || {})[n.k]);
    if (!url) return '';
    const ext = n.k !== 'email';
    return `<li><a href="${e(url)}"${ext ? ' target="_blank" rel="noopener me"' : ''}><span class="wr-ico wr-ico--${n.k}" aria-hidden="true"></span>${e(writerLinkText(n.k, url))}</a></li>`;
  }).join('');
  const bio = String(w.bio || '')
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => `<p>${e(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<article class="writer">
   <div class="writer-photo">${photo ? `<img src="${e(photo)}" alt="Foto de ${e(name)}" loading="lazy">` : `<span aria-hidden="true">${e([...name][0] || '?').toUpperCase()}</span>`}</div>
   <div class="writer-body">
     <h2>${e(name)}</h2>
     ${bio ? `<div class="writer-bio">${bio}</div>` : ''}
     ${links ? `<ul class="writer-links" aria-label="Redes e contato de ${e(name)}">${links}</ul>` : ''}
   </div>
  </article>`;
}

/** Lista de cards (ou aviso, se ninguém preencheu o perfil ainda). */
function writersHTML(list) {
  return list && list.length
    ? `<div class="writers">${list.map(writerCardHTML).join('')}</div>`
    : '<p class="writers-empty">Em breve, os escritores do blog aparecem aqui.</p>';
}

/** Conteúdo da página: título fixo e os cards. */
function writersPageHTML(list) {
  return `<article class="art art--writers"><h1>Escritores</h1><div id="writers-list">${writersHTML(list)}</div></article>`;
}
