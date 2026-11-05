/**
 * Conversor de Markdown simplificado para HTML seguro
 *
 * Além do básico (##, ###, listas, **negrito**, *itálico*, links), entende:
 * ++sublinhado++, ~~tachado~~, "1. " (lista numerada), "> " (citação), ![descrição](endereço) (imagem),
 * e "{centro} ", "{direita} " ou "{justificado} " no começo do bloco (alinhamento). A barra invertida mantém um símbolo literal: \*
 */

const MD_MARKS = { '**': 'b', '*': 'i', '++': 'u', '~~': 's' };

/** Converte o conteúdo de um bloco (já escapado) em HTML: imagens, links e marcas de formatação. */
function mdInline(s) {
  // o que não pode ser lido como formatação (símbolos literais, endereços) fica guardado até o final
  const kept = [];
  const keep = (h) => `${kept.push(h) - 1}`;
  const restore = (h) => h.replace(/(\d+)/g, (_, i) => restore(kept[i]));
  s = s
    .replace(/[]/g, '')
    .replace(/\\(&gt;|[\\*\[\]~+#\-.{])/g, (_, c) => keep(c))
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, (_, alt, url) =>
      keep(`<img src="${url}" alt="${alt}" loading="lazy">`),
    )
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      (_, txt, url) => keep(`<a href="${url}" target="_blank" rel="noopener">`) + txt + keep('</a>'),
    );

  // cada marca aberta fica na pilha; a que nunca fecha continua aparecendo como texto comum
  const out = [],
    open = [];
  const find = (d) => open.map((o) => o.d).lastIndexOf(d);
  let last = 0;
  for (const m of s.matchAll(/\*+|\+\+|~~/g)) {
    out.push(s.slice(last, m.index));
    last = m.index + m[0].length;
    const before = s[m.index - 1],
      after = s[last];
    const canClose = before && !/\s/.test(before),
      canOpen = after && !/\s/.test(after);
    let run = m[0];
    while (run) {
      const j = run.length > 2 ? Math.max(find('*'), find('**')) : find(run);
      if (canClose && j >= 0) {
        const { d, at } = open[j];
        open.length = j;
        out[at] = `<${MD_MARKS[d]}>`;
        out.push(`</${MD_MARKS[d]}>`);
        run = run.slice(d.length);
      } else if (canOpen) {
        const d = run.slice(0, 2);
        open.push({ d, at: out.length });
        out.push(d);
        run = run.slice(d.length);
      } else {
        out.push(run);
        run = '';
      }
    }
  }
  out.push(s.slice(last));
  return restore(out.join(''));
}

/** Converte o Markdown do artigo em HTML escapado. */
function md(t) {
  return esc(t)
    .split(/\n{2,}/)
    .map((b) => {
      b = b.trim();
      if (!b) return '';
      const al = b.match(/^\{(centro|direita|justificado)\} */);
      const st = al ? ` style="text-align:${{ centro: 'center', direita: 'right', justificado: 'justify' }[al[1]]}"` : '';
      if (al) b = b.slice(al[0].length);
      if (b.startsWith('## ')) return `<h2${st}>` + mdInline(b.slice(3)) + '</h2>';
      if (b.startsWith('### ')) return `<h3${st}>` + mdInline(b.slice(4)) + '</h3>';
      const ls = b.split('\n');
      if (ls.every((l) => l.startsWith('- ')))
        return `<ul${st}>` + ls.map((l) => '<li>' + mdInline(l.slice(2)) + '</li>').join('') + '</ul>';
      if (ls.every((l) => /^\d+\. /.test(l)))
        return `<ol${st}>` + ls.map((l) => '<li>' + mdInline(l.replace(/^\d+\. /, '')) + '</li>').join('') + '</ol>';
      if (ls.every((l) => l.startsWith('&gt; ')))
        return `<blockquote${st}>` + ls.map((l) => mdInline(l.slice(5))).join('<br>') + '</blockquote>';
      return `<p${st}>` + mdInline(b).replace(/\n/g, '<br>') + '</p>';
    })
    .join('');
}

/** Tira a formatação do Markdown e devolve só o texto (usado em resumos e descrições). */
function plainText(t) {
  return String(t)
    .replace(/!\[[^\]]*\]\([^)\s]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)\s]*\)/g, '$1')
    .replace(/^\{(centro|direita|justificado)\} */gm, '')
    .replace(/^(#{2,3} |- |> |\d+\. )/gm, '')
    .replace(/\\([\\*\[\]~+#\-.{>])|\*+|\+\+|~~/g, (_, c) => c || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lista os endereços das imagens inseridas no meio do texto. */
const mdImages = (t) => [...String(t).matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]);

/* ---------- Hifenização em português (texto justificado) ----------
 * Insere hifens "invisíveis" (&shy;) nos pontos onde a palavra pode ser partida; o navegador só mostra o hífen
 * quando a palavra é de fato quebrada no fim da linha. Regras da divisão silábica do português:
 * - uma consoante entre vogais vai para a sílaba seguinte (ca-sa);
 * - não se separam ch, lh, nh, qu, gu e os encontros consonantais com l ou r (bl, br, cl, cr, dr, fl, fr, gl, gr, pl, pr, tr, vr):
 *   pa-lha, li-vro, a-que-le;
 * - separam-se rr, ss, sc, sç, xc e as demais consoantes seguidas (car-ro, nas-cer, ex-ce-ção, rit-mo, ad-vo-ga-do);
 * - com três ou mais consoantes, a última (ou o encontro com l/r) vai para a sílaba seguinte (obs-tá-cu-lo, ins-tru-ção);
 * - por segurança, nunca parte entre duas vogais (ditongos e hiatos), e só quebra palavras de 6+ letras,
 *   deixando ao menos 2 letras antes e 3 depois do hífen. */
const PT_VOWELS = 'aeiouyáàâãéêíóôõúü';
const PT_KEEP = /^(?:[bcdfgkpv][lr]|tr|ch|lh|nh|qu|gu)$/;

/** Devolve a palavra com &shy; (U+00AD) nos pontos de quebra permitidos. */
function hyphenatePt(w) {
  if (w.length < 6 || w === w.toUpperCase()) return w; // curtas e siglas ficam inteiras
  const low = w.toLowerCase(),
    n = low.length;
  const isV = (i) =>
    PT_VOWELS.includes(low[i]) &&
    // o "u" de qu/gu antes de vogal faz parte da consoante (que, aquele, água, pinguim)
    !((low[i] === 'u' || low[i] === 'ü') && i > 0 && (low[i - 1] === 'q' || low[i - 1] === 'g') && i + 1 < n && PT_VOWELS.includes(low[i + 1]));
  const cuts = [];
  let k = 0;
  while (k < n && !isV(k)) k++; // consoantes do começo
  while (k < n) {
    while (k < n && isV(k)) k++; // grupo de vogais (nunca é partido)
    const cs = k;
    while (k < n && !isV(k)) k++; // consoantes até a próxima vogal
    if (k >= n) break; // consoantes do fim
    const run = low.slice(cs, k);
    const keepLast2 = run.length >= 2 && PT_KEEP.test(run.slice(-2));
    // prefixo "sub" antes de l/r: sub-li-nhar, sub-ro-gar (e não su-bli-nhar)
    if (cs === 2 && /^sub[lr]/.test(low)) cuts.push(3);
    else cuts.push(run.length === 1 ? cs : keepLast2 ? k - 2 : k - 1);
  }
  let out = '',
    last = 0;
  for (const c of cuts)
    if (c >= 2 && n - c >= 3) {
      out += w.slice(last, c) + '\u00AD';
      last = c;
    }
  return out + w.slice(last);
}

/** Hifeniza o texto (fora das tags) dos blocos justificados de um HTML gerado por md(). */
function hyphenateJustified(html) {
  return html.replace(
    /(<(p|h2|h3|ul|ol|blockquote)\b[^>]*text-align:justify[^>]*>)([\s\S]*?)(<\/\2>)/g,
    (m, open, tag, inner, close) =>
      open +
      inner.replace(/(^|>)([^<]+)/g, (x, gt, text) =>
        gt + text.replace(/(&[a-z]+;)|([a-záàâãäçéèêëíìîïóòôõöúùûüýÿ]{6,})/gi, (y, ent, word) => ent || hyphenatePt(word)),
      ) +
      close,
  );
}
