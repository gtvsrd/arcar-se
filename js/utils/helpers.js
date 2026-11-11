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
  return `<div class="box box--avisos"><h3>${esc(n.title || NOTICE_DEFAULT.title)}</h3><div class="avisos-body">${md(n.body)}</div></div>`;
}
