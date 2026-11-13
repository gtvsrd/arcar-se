/**
 * Funções auxiliares: seletor, escape de HTML, datas, cores por categoria, aviso e gerador de id
 */

const $ = (s) => document.querySelector(s);
/** Escapa caracteres HTML para evitar injeção de código. */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/** Formata uma data ISO em português. */
const fmt = (d) =>
  new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
/** Data curta para os cards: "16 out 2026". */
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmtShort = (d) => {
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, '0')} ${MESES[x.getMonth()]} ${x.getFullYear()}`;
};
const cols = ['#cfe0d8', '#efddb3', '#d8dcc9', '#e7d3c3', '#c9d9dc', '#ddd6e6'];
/** Escolhe sempre a mesma cor para uma mesma categoria. */
const colorOf = (c) => {
  let h = 0;
  for (const ch of c) h = (h * 31 + ch.charCodeAt(0)) % cols.length;
  return cols[h];
};
/** Mostra um aviso temporário na parte de baixo da tela. */
const toast = (m) => {
  const t = $('#toast');
  t.textContent = m;
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 2200);
};
/** Transforma um título em endereço legível: "Cinco hábitos!" vira "cinco-habitos". */
function slugify(text, max = 80) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

/** Reduz a imagem enviada (máx. 1600px de largura) e devolve um Blob JPEG. */
function resizeImage(file, maxW = 1600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const im = new Image();
      im.onerror = reject;
      im.onload = () => {
        const r = Math.min(1, maxW / im.width);
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * r);
        c.height = Math.round(im.height * r);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(im, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? resolve(b) : reject()), 'image/jpeg', 0.85);
      };
      im.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** "1 leitura", "1.234 leituras". */
const viewsLabel = (n) => (n === 1 ? '1 leitura' : n.toLocaleString('pt-BR') + ' leituras');

/** Recorta o centro da imagem em quadrado (padrão 320px) e devolve um Blob JPEG — usado na foto de perfil. */
function squareImage(file, size = 320) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const im = new Image();
      im.onerror = reject;
      im.onload = () => {
        const side = Math.min(im.width, im.height);
        const c = document.createElement('canvas');
        c.width = c.height = Math.min(size, side);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(im, (im.width - side) / 2, (im.height - side) / 2, side, side, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? resolve(b) : reject()), 'image/jpeg', 0.88);
      };
      im.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Categorias de um artigo (até 3; a primeira é a principal). Funciona também com o banco antigo, que só tem "cat". */
const catsOf = (p) => (Array.isArray(p.cats) && p.cats.length ? p.cats : [p.cat]);

/** Nome das páginas fixas no menu e na lista "Páginas": fixo, independente do título editado na página. */
const PAGE_LABELS = { sobre: 'Sobre', contato: 'Contato' };
const pageLabel = (slug, title) => PAGE_LABELS[slug] || title;

/** Páginas que existem no banco mas não aparecem no menu nem têm página própria (Contato virou Escritores; avisos é o quadro da lateral). */
const HIDDEN_PAGES = ['contato', 'avisos'];

/** Quadro de avisos da lateral: texto padrão até o administrador editar no painel (fica em pages, slug "avisos"). */
const NOTICE_DEFAULT = {
  title: 'Quadro de avisos',
  body: '**Boas-vindas ao Arcar.se!** O blog acaba de ser inaugurado.\n\nAqui você encontra textos de psicologia para se entender melhor e assumir a própria história, escritos para o público em geral, estudantes e profissionais. Leia, curta e compartilhe com quem possa gostar. Novos artigos chegam em breve.',
};
/** HTML do quadro de avisos (vazio se o administrador apagou o texto). */
function noticeHTML(page) {
  const n = page || NOTICE_DEFAULT;
  if (!String(n.body || '').trim()) return '';
  return sideBox('avisos', n.title || NOTICE_DEFAULT.title, `<div class="avisos-body">${md(n.body)}</div>`, 'box--avisos');
}

/* ---------- Coluna lateral e modo leitura (js/utils/lateral.js) ---------- */
const SIDE_SVG = (d) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
/** Ícone de cada caixa da lateral: aparece no lugar da caixa quando a coluna está recolhida (modo leitura). */
const SIDE_ICONS = {
  busca: SIDE_SVG('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
  // a flecha e o ponto da logomarca, que juntos lembram um ponto de exclamação
  avisos: SIDE_SVG(
    '<path d="M12 .8l3.2 5L12 8.8 8.8 5.8z" fill="currentColor" stroke="none"/><path d="M12 7.5v9" stroke-width="2.6" stroke-linecap="butt"/><circle cx="12" cy="20.6" r="2.4" fill="currentColor" stroke="none"/>',
  ),
  categorias: SIDE_SVG('<path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9z"/><circle cx="8.5" cy="8.5" r="1.5"/>'),
  recentes: SIDE_SVG('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  paginas: SIDE_SVG('<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 16h6"/>'),
};
/** Caixa da lateral: o conteúdo de sempre e, para o modo leitura, um botão com ícone que o abre ao lado. */
function sideBox(key, title, inner, cls = '') {
  return `<div class="box${cls ? ' ' + cls : ''}" data-lado="${key}"><button type="button" class="side-btn" aria-label="${esc(title)}" title="${esc(title)}">${SIDE_ICONS[key] || ''}</button><div class="box-conteudo"><h3>${esc(title)}</h3>${inner}</div></div>`;
}
/** Botão que recolhe e mostra a coluna lateral (só em telas grandes). Fica acima de todas as caixas. */
const SIDE_TOGGLE = `<button type="button" class="side-toggle" data-k="side-toggle" aria-label="Modo leitura: recolher ou mostrar a coluna lateral" title="Modo leitura"><span class="side-toggle-txt">Modo leitura</span>${SIDE_SVG('<path d="M9 5l7 7-7 7"/>')}</button>`;
