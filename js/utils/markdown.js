/**
 * Conversor de Markdown simplificado para HTML seguro
 *
 * Além do básico (##, ###, listas, **negrito**, *itálico*, links), entende:
 * ++sublinhado++, ~~tachado~~, "1. " (lista numerada), "> " (citação), ![descrição](endereço) (imagem),
 * e "{centro} " ou "{direita} " no começo do bloco (alinhamento). A barra invertida mantém um símbolo literal: \*
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
      const al = b.match(/^\{(centro|direita)\} */);
      const st = al ? ` style="text-align:${al[1] === 'centro' ? 'center' : 'right'}"` : '';
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
    .replace(/^\{(centro|direita)\} */gm, '')
    .replace(/^(#{2,3} |- |> |\d+\. )/gm, '')
    .replace(/\\([\\*\[\]~+#\-.{>])|\*+|\+\+|~~/g, (_, c) => c || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lista os endereços das imagens inseridas no meio do texto. */
const mdImages = (t) => [...String(t).matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]);
