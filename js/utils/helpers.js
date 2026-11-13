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
  title: 'Avisos',
  body: '**Boas-vindas ao Arcar.se!** O blog acaba de ser inaugurado.\n\nAqui você encontra textos de psicologia para se entender melhor e assumir a própria história, escritos para o público em geral, estudantes e profissionais. Leia, curta e compartilhe com quem possa gostar. Novos artigos chegam em breve.',
};
/** HTML do quadro de avisos (vazio se o administrador apagou o texto). Usado enquanto o SQL das caixas não foi rodado. */
function noticeHTML(page) {
  const n = page || NOTICE_DEFAULT;
  if (!String(n.body || '').trim()) return '';
  return sideBox('avisos', n.title || NOTICE_DEFAULT.title, `<div class="avisos-body">${md(n.body)}</div>`, 'box--avisos', 'flecha');
}
/**
 * Caixas editáveis da lateral (tabela side_boxes; ver o painel, aba Caixas).
 * `boxes`: as linhas do banco, ou null se a tabela ainda não existe (aí vale o Avisos antigo, `oldNotice`).
 */
function avisosHTML(boxes, oldNotice) {
  if (!boxes) return noticeHTML(oldNotice);
  const a = boxes.find((b) => b.kind === 'avisos');
  if (!a || a.hidden || !String(a.body || '').trim()) return '';
  return sideBox('avisos', a.title || 'Avisos', `<div class="avisos-body">${md(a.body)}</div>`, 'box--avisos', a.icon || 'flecha');
}
/** Caixas livres, depois de todas as outras, na ordem do painel (as ocultas e as sem texto ficam de fora). */
function livresHTML(boxes) {
  return (boxes || [])
    .filter((b) => b.kind === 'livre' && !b.hidden && String(b.body || '').trim())
    .sort((x, y) => x.sort - y.sort || String(x.created_at).localeCompare(String(y.created_at)))
    .map((b) => sideBox('livre-' + b.id, b.title || 'Sem título', `<div class="avisos-body">${md(b.body)}</div>`, 'box--livre', b.icon || 'flecha'))
    .join('');
}

/* ---------- Coluna lateral e modo leitura (js/utils/lateral.js) ---------- */
const SIDE_SVG = (d) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
/** Ícone de cada caixa da lateral: aparece no lugar da caixa quando a coluna está recolhida (modo leitura). */
const SIDE_ICONS = {
  busca: SIDE_SVG('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
  // a flecha e o ponto da logomarca, que juntos lembram um ponto de exclamação
  flecha: SIDE_SVG(
    '<path d="M12 .8l3.2 5L12 8.8 8.8 5.8z" fill="currentColor" stroke="none"/><path d="M12 7.5v9" stroke-width="2.6" stroke-linecap="butt"/><circle cx="12" cy="20.6" r="2.4" fill="currentColor" stroke="none"/>',
  ),
  categorias: SIDE_SVG('<path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9z"/><circle cx="8.5" cy="8.5" r="1.5"/>'),
  recentes: SIDE_SVG('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  paginas: SIDE_SVG('<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 16h6"/>'),
  // o arco da logomarca: os dois braços e a corda
  arco: SIDE_SVG(
    '<path d="M1.8 16c1.7 0 2.4-.8 3.1-2.1C6.8 10.3 9.4 8 12 7.4M22.2 16c-1.7 0-2.4-.8-3.1-2.1C17.2 10.3 14.6 8 12 7.4"/><path d="M2.4 16h19.2" stroke-width="1.4"/>',
  ),
  estrela: SIDE_SVG('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
  livro: SIDE_SVG('<path d="M4 5.5A2 2 0 0 1 6 3.5h13v14H6a2 2 0 0 0-2 2zM4 19.5a2 2 0 0 0 2 2h13v-4"/>'),
  calendario: SIDE_SVG('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  coracao: SIDE_SVG('<path d="M12 20s-7.5-4.6-9.3-9.2C1.4 7.5 3.4 4 6.9 4c2 0 3.4 1.1 5.1 3 1.7-1.9 3.1-3 5.1-3 3.5 0 5.5 3.5 4.2 6.8C19.5 15.4 12 20 12 20z"/>'),
  balao: SIDE_SVG('<path d="M4 5.5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>'),
  lampada: SIDE_SVG('<path d="M9 17.5h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2v1.5h5V16c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>'),
  link: SIDE_SVG('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>'),
};
SIDE_ICONS.avisos = SIDE_ICONS.flecha;
/** Ícones que o painel oferece para as caixas editáveis, com o nome de cada um. */
const BOX_ICONS = [
  ['flecha', 'Flecha da logo'],
  ['arco', 'Arco da logo'],
  ['estrela', 'Estrela'],
  ['livro', 'Livro'],
  ['calendario', 'Calendário'],
  ['coracao', 'Coração'],
  ['balao', 'Conversa'],
  ['lampada', 'Ideia'],
  ['link', 'Link'],
];
/** Caixa da lateral: título com o ícone antes do nome e, para o modo leitura, um botão com o mesmo ícone que a abre ao lado. */
function sideBox(key, title, inner, cls = '', icon = key) {
  const svg = SIDE_ICONS[icon] || SIDE_ICONS.flecha;
  return `<div class="box${cls ? ' ' + cls : ''}" data-lado="${esc(key)}"><button type="button" class="side-btn" aria-label="${esc(title)}" title="${esc(title)}">${svg}</button><div class="box-conteudo"><h3><span class="box-ico">${svg}</span>${esc(title)}</h3>${inner}</div></div>`;
}
/** Botão que recolhe e mostra a coluna lateral (só em telas grandes). Fica acima de todas as caixas. */
const SIDE_TOGGLE = `<button type="button" class="side-toggle" data-k="side-toggle" aria-label="Modo leitura: recolher ou mostrar a coluna lateral" title="Modo leitura"><span class="side-toggle-txt">Modo leitura</span>${SIDE_SVG('<path d="M9 5l7 7-7 7"/>')}</button>`;
