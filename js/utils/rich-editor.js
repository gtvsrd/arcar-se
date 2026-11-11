/**
 * Editor visual de artigos (como o do Word ou do WordPress): barra de formatação, links e imagens.
 * O que se vê é HTML editável; ao salvar, htmlToMd converte tudo de volta para o Markdown guardado no banco.
 * Só passa o que o Markdown representa, então texto colado de outros sites não traz código nem estilos estranhos.
 */

const RTE_BLOCK_TAGS =
  'p,div,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,pre,hr,table,thead,tbody,tr,td,th,figure,figcaption,section,article,header,footer,main,aside,nav,address,dl,dt,dd';
const RTE_SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'TEMPLATE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED']);

/** Escapa os símbolos que o Markdown leria como formatação. */
const rteEscape = (t) =>
  t
    // espaços seguidos viram um só; o Tab (\t) é mantido como está
    .replace(/(?:[^\S\t]|\u200B)+/g, ' ')
    .replace(/[\\*\[\]]/g, '\\$&')
    .replace(/~~/g, '\\~\\~')
    .replace(/\+\+/g, '\\+\\+');

/** Escapa o começo das linhas que virariam título, lista, citação ou alinhamento sem ninguém pedir. */
const rteEscapeStarts = (t) =>
  t
    .replace(/^(#{2,3} |- |> |\{(?:centro|direita|justificado)\})/gm, '\\$1')
    .replace(/^(\d+)\. /gm, '$1\\. ');

/** Codifica o que encerraria o endereço antes da hora no Markdown: espaços e parênteses. */
const rteUrl = (u) => u.trim().replace(/[()\s]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));

/** Põe a marca em volta do texto, deixando de fora os espaços das pontas: **texto** e não **texto **. */
function rteWrap(t, d) {
  const m = t.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return m[2] ? m[1] + d + m[2] + d + m[3] : t;
}

/** Quais marcas de Markdown um elemento aplica, pela etiqueta ou pelo estilo (texto colado costuma usar estilo). */
function rteMarks(el) {
  const tag = el.tagName,
    st = el.style || {},
    deco = st.textDecorationLine || st.textDecoration || '',
    weight = st.fontWeight,
    slant = st.fontStyle,
    marks = [];
  if (weight ? weight === 'bold' || weight === 'bolder' || +weight >= 600 : tag === 'B' || tag === 'STRONG') marks.push('**');
  if (slant ? slant === 'italic' || slant === 'oblique' : tag === 'I' || tag === 'EM') marks.push('*');
  if (tag === 'U' || tag === 'INS' || deco.includes('underline')) marks.push('++');
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL' || deco.includes('line-through')) marks.push('~~');
  return marks;
}

/** Converte um pedaço de conteúdo em Markdown de linha. `active` evita repetir marcas já abertas. */
function rteInline(node, resolve, active = []) {
  if (node.nodeType === 3) return rteEscape(node.nodeValue);
  if (node.nodeType !== 1 || RTE_SKIP_TAGS.has(node.tagName)) return '';
  const tag = node.tagName;
  if (tag === 'BR') return '\n';
  if (tag === 'IMG') {
    const url = resolve(node.getAttribute('src') || '');
    if (!/^https?:\/\//i.test(url)) return '';
    const alt = (node.getAttribute('alt') || '').replace(/[\[\]\s]+/g, ' ').trim();
    return `![${alt}](${rteUrl(url)})`;
  }
  const inLink = tag === 'A' && /^https?:\/\//i.test(node.getAttribute('href') || '');
  const marks = rteMarks(node).filter((d) => !active.includes(d) && !(d === '++' && (inLink || active.includes('a'))));
  const next = [...active, ...marks, ...(inLink ? ['a'] : [])];
  let s = [...node.childNodes].map((c) => rteInline(c, resolve, next)).join('');
  [...marks].reverse().forEach((d) => (s = rteWrap(s, d)));
  if (inLink) {
    const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
    s = m[2] ? `${m[1]}[${m[2]}](${rteUrl(node.getAttribute('href'))})${m[3]}` : s;
  }
  return node.matches(RTE_BLOCK_TAGS) ? s + '\n' : s;
}

/** Markdown da imagem do artigo (figura): ![descrição](endereço){ajustes} e a legenda na linha de baixo. */
function rteFigMd(f, resolve) {
  const im = f.querySelector('img');
  const url = resolve(im.getAttribute('src') || '');
  if (!/^https?:\/\//i.test(url)) return '';
  const alt = (im.getAttribute('alt') || '').replace(/[\[\]\s]+/g, ' ').trim();
  const a = figAttrs(`w=${f.dataset.w || ''} c=${f.dataset.c || ''} r=${f.dataset.r || ''}`);
  const parts = [];
  if (a.w !== FIG_MAX) parts.push('w=' + a.w);
  if (a.c && a.r) parts.push('c=' + a.c.join(','), 'r=' + a.r);
  const capEl = f.querySelector('figcaption');
  const cap = (f.dataset.cap != null ? f.dataset.cap : capEl ? capEl.textContent : '').replace(/\s+/g, ' ').trim();
  return `![${alt}](${rteUrl(url)})` + (parts.length ? `{${parts.join(' ')}}` : '') + (cap ? '\n' + cap : '');
}

/** Arruma os espaços e quebras de linha de um bloco. */
const rteClean = (s) =>
  s
    .replace(/ *\n */g, '\n')
    .replace(/ {2,}/g, ' ')
    .replace(/^[ \n]+|[ \n]+$/g, ''); // não usa trim(): ele apagaria o Tab do começo do parágrafo

/** Prefixo de alinhamento de um elemento ("" se for o padrão, à esquerda). */
function rteAlign(el, inherited = '') {
  const a = (el.style && el.style.textAlign) || (el.getAttribute && el.getAttribute('align')) || '';
  if (a === 'center') return '{centro} ';
  if (a === 'right' || a === 'end') return '{direita} ';
  if (a === 'justify') return '{justificado} ';
  return a ? '' : inherited;
}

/** Itens de uma lista, um por linha. Sublistas viram itens da própria lista, que o Markdown daqui é de um nível só. */
function rteListItems(list, resolve) {
  const items = [];
  for (const li of list.children) {
    if (li.tagName === 'UL' || li.tagName === 'OL') {
      items.push(...rteListItems(li, resolve));
      continue;
    }
    const own = [...li.childNodes].filter((c) => !(c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')));
    const text = rteClean(own.map((c) => rteInline(c, resolve)).join('')).replace(/\n+/g, ' ');
    if (text) items.push(text);
    li.querySelectorAll(':scope > ul, :scope > ol').forEach((sub) => items.push(...rteListItems(sub, resolve)));
  }
  return items;
}

/**
 * Converte o HTML do editor em Markdown.
 * `resolve` troca o endereço de cada imagem na hora de salvar (as ainda não enviadas têm endereço temporário).
 */
function htmlToMd(root, resolve = (src) => src) {
  const out = [];
  let lastList = null;
  const add = (prefix, text) => text && out.push(prefix + text);
  const walk = (parent, inherited) => {
    let run = [];
    const flush = () => {
      add(inherited, rteEscapeStarts(rteClean(run.map((c) => rteInline(c, resolve)).join(''))));
      run = [];
    };
    for (const n of parent.childNodes) {
      if (n.nodeType === 3) {
        run.push(n);
        continue;
      }
      if (n.nodeType !== 1 || RTE_SKIP_TAGS.has(n.tagName)) continue;
      if (n.tagName === 'FIGURE' && n.querySelector('img')) {
        flush();
        add('', rteFigMd(n, resolve));
        continue;
      }
      if (!n.matches(RTE_BLOCK_TAGS) && !n.querySelector(RTE_BLOCK_TAGS)) {
        run.push(n);
        continue;
      }
      flush();
      const al = rteAlign(n, inherited);
      const line = () => rteClean(rteInline(n, resolve)).replace(/\n+/g, ' ');
      if (/^H[12]$/.test(n.tagName)) add(al + '## ', line());
      else if (/^H[3-6]$/.test(n.tagName)) add(al + '### ', line());
      else if (n.tagName === 'UL' || n.tagName === 'OL') {
        const firstAl = n.firstElementChild ? rteAlign(n.firstElementChild, al) : al;
        // listas vizinhas do mesmo tipo viram uma só (o Firefox cria uma para cada item formatado separadamente)
        const prev = lastList && lastList.tag === n.tagName && lastList.at === out.length - 1 ? lastList : null;
        const start = prev ? prev.count : 0;
        const items = rteListItems(n, resolve).map((t, i) => (n.tagName === 'OL' ? `${start + i + 1}. ` : '- ') + t);
        if (items.length) {
          if (prev) out[prev.at] += '\n' + items.join('\n');
          else add(firstAl, items.join('\n'));
          lastList = { tag: n.tagName, at: out.length - 1, count: start + items.length };
        }
      } else if (n.tagName === 'BLOCKQUOTE') {
        const firstAl = n.firstElementChild ? rteAlign(n.firstElementChild, al) : al;
        const lines = rteClean(rteInline(n, resolve)).split(/\n+/).filter(Boolean);
        add(firstAl, lines.map((l) => '> ' + l).join('\n'));
      } else if (n.querySelector(RTE_BLOCK_TAGS)) walk(n, al);
      else add(al, rteEscapeStarts(rteClean(rteInline(n, resolve))));
    }
    flush();
  };
  walk(root, '');
  return out.join('\n\n');
}

const rteIcon = (d) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

/** Botões da barra, em grupos: [ação, descrição, conteúdo do botão]. */
const RTE_TOOLS = [
  [
    ['undo', 'Desfazer (Ctrl+Z)', rteIcon('M9 5 4 10l5 5M4 10h10a5 5 0 0 1 0 10h-3')],
    ['redo', 'Refazer (Ctrl+Y)', rteIcon('M15 5l5 5-5 5M20 10H10a5 5 0 0 0 0 10h3')],
  ],
  [
    ['bold', 'Negrito (Ctrl+B)', '<b>N</b>'],
    ['italic', 'Itálico (Ctrl+I)', '<i>I</i>'],
    ['underline', 'Sublinhado (Ctrl+U)', '<u>S</u>'],
    ['strikeThrough', 'Tachado', '<s>T</s>'],
  ],
  [
    ['insertUnorderedList', 'Lista com marcadores', rteIcon('M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01')],
    ['insertOrderedList', 'Lista numerada', rteIcon('M10 6h10M10 12h10M10 18h10M4 4l1.5-1v6M3.5 15c.5-1.3 3-1.3 3 .4 0 1.3-3 2.2-3 3.6h3')],
  ],
  [
    ['justifyLeft', 'Alinhar à esquerda', rteIcon('M4 6h16M4 12h10M4 18h13')],
    ['justifyCenter', 'Centralizar', rteIcon('M4 6h16M7 12h10M6 18h12')],
    ['justifyRight', 'Alinhar à direita', rteIcon('M4 6h16M10 12h10M7 18h13')],
    ['justifyFull', 'Justificar', rteIcon('M4 6h16M4 12h16M4 18h16')],
  ],
  [
    ['link', 'Inserir link (Ctrl+K)', rteIcon('M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1')],
    ['image', 'Inserir imagem', rteIcon('M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01')],
  ],
  [['clear', 'Limpar formatação', rteIcon('M6 5h12M12 5v14M4 20 20 4')]],
];

/**
 * Monta o editor dentro de `mount`, com o Markdown inicial `body`.
 * Imagens novas só são enviadas ao salvar, para não deixar arquivos órfãos se o artigo for abandonado.
 */
function createRichEditor(mount, body, labelId) {
  mount.innerHTML = `<div class="rte-tools" role="toolbar" aria-label="Formatação do texto">
     <select id="rte-block" aria-label="Estilo do parágrafo" title="Estilo do parágrafo">
       <option value="p">Parágrafo</option><option value="h2">Título</option><option value="h3">Subtítulo</option><option value="blockquote">Citação</option>
     </select>
     ${RTE_TOOLS.map(
       (g) =>
         '<span class="rte-group">' +
         g.map(([a, t, h]) => `<button type="button" class="rte-btn" data-a="${a}" title="${t}" aria-label="${t}">${h}</button>`).join('') +
         '</span>',
     ).join('')}
   </div>
   <div class="rte body" id="b" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="${labelId}"></div>
   <div class="rte-imgbar" id="rte-imgbar" role="toolbar" aria-label="Imagem selecionada" hidden>
     <span class="rte-imgbar-main">
       <button type="button" class="btn sm alt" data-i="up" title="Mover para cima (Alt+↑)">↑ Subir</button>
       <button type="button" class="btn sm alt" data-i="down" title="Mover para baixo (Alt+↓)">↓ Descer</button>
       <button type="button" class="btn sm alt" data-i="crop" title="Cortar: arraste as bordas e os cantos">Cortar</button>
       <button type="button" class="btn sm alt" data-i="cap">Legenda</button>
       <button type="button" class="btn sm alt" data-i="edit">Editar</button>
       <button type="button" class="btn sm del" data-i="remove">Remover</button>
     </span>
     <span class="rte-imgbar-crop" hidden>
       <button type="button" class="btn sm" data-i="crop-ok" title="Aplicar o corte (Enter)">Concluir corte</button>
       <button type="button" class="btn sm alt" data-i="crop-reset">Sem corte</button>
       <button type="button" class="btn sm alt" data-i="crop-cancel" title="Esc">Cancelar</button>
     </span>
   </div>
   <div class="rte-handles" id="rte-handles" hidden>
     <div class="rte-cropbox" hidden></div>
     ${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => `<span class="rte-h rte-h-${h}" data-h="${h}"></span>`).join('')}
     <span class="rte-size" aria-live="polite"></span>
   </div>
   <div class="rte-drop" id="rte-drop" hidden></div>`;
  const root = mount.querySelector('#b');
  const blockSel = mount.querySelector('#rte-block');
  const imgBar = mount.querySelector('#rte-imgbar');
  const handles = mount.querySelector('#rte-handles');
  const cropBox = handles.querySelector('.rte-cropbox');
  const sizeTag = handles.querySelector('.rte-size');
  const dropLine = mount.querySelector('#rte-drop');
  const pending = new Map(); // endereço temporário (blob:) -> imagem ainda não enviada
  let lastRange = null; // última seleção dentro do editor (a lista de estilos tira o foco dele)
  let frozenRange = null; // seleção guardada enquanto um diálogo está aberto
  let selectedImg = null; // figura (imagem do artigo) selecionada
  let crop = null; // corte em andamento: { fig, d, full, box: [x, y, l, a] }

  root.innerHTML = md(body) || '<p><br></p>';
  document.execCommand('defaultParagraphSeparator', false, 'p');
  document.execCommand('styleWithCSS', false, false);

  const selectionInside = () => {
    const s = getSelection();
    return s.rangeCount && root.contains(s.getRangeAt(0).commonAncestorContainer) ? s : null;
  };
  /** A seleção atual, se ainda estiver no editor; senão, a última que esteve. */
  const currentRange = () => {
    const s = selectionInside();
    return s ? s.getRangeAt(0).cloneRange() : lastRange;
  };
  /** Devolve o foco ao editor, na mesma seleção de antes. */
  const restore = () => {
    const range = frozenRange || currentRange();
    frozenRange = null;
    root.focus();
    if (range) {
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(range);
    }
  };
  /** Abre um diálogo guardando a seleção: enquanto ele está aberto, o navegador pode movê-la (o Firefox a leva para o começo do texto). */
  const openDialog = (dlg) => {
    frozenRange = currentRange();
    dlg.showModal();
  };
  const exec = (cmd, val) => {
    restore();
    document.execCommand(cmd, false, val);
    syncState();
  };
  /** O bloco de primeiro nível do editor em que o cursor está. */
  const currentBlock = () => {
    const s = selectionInside();
    if (!s) return null;
    let n = s.anchorNode;
    if (n === root) return root.children[Math.min(s.anchorOffset, root.children.length - 1)] || null;
    while (n && n.parentNode !== root) n = n.parentNode;
    return n;
  };
  const selectNode = (node) => {
    const r = document.createRange();
    r.selectNode(node);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    lastRange = r;
  };
  const closestInEditor = (sel) => {
    const s = selectionInside();
    if (!s) return null;
    const n = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentNode;
    const hit = n.closest(sel);
    return hit && root.contains(hit) ? hit : null;
  };
  const hasContent = (el) => el.textContent.trim() || el.querySelector('img');
  const figs = () => [...root.querySelectorAll('figure.fig')];

  /** Dados de uma figura (endereço, descrição, largura, corte, proporção e legenda), sem escape. */
  const figData = (f) => {
    const im = f.querySelector('img');
    const a = figAttrs(`w=${f.dataset.w || ''} c=${f.dataset.c || ''} r=${f.dataset.r || ''}`);
    const capEl = f.querySelector('figcaption');
    return {
      src: im.getAttribute('src') || '',
      alt: im.getAttribute('alt') || '',
      ...a,
      cap: f.dataset.cap != null ? f.dataset.cap : capEl ? capEl.textContent.trim() : '',
    };
  };
  /** HTML da figura no editor: não se digita dentro dela; ela é selecionada, arrastada e ajustada pelas alças. */
  const figHtml = (d) =>
    figureHTML({ src: esc(d.src), alt: esc(d.alt), w: d.w, c: d.c, r: d.r, cap: esc(d.cap || '') }).replace(
      '<figure class="fig"',
      '<figure class="fig rte-fig" contenteditable="false" draggable="true"',
    );
  /** Prepara as figuras para o editor (e transforma imagem sozinha numa linha em figura). */
  function upgradeFigures(scope = root) {
    scope.querySelectorAll(':scope > p').forEach((p) => {
      const im = p.querySelector('img');
      if (im && p.children.length === 1 && !p.textContent.trim() && /^https?:|^blob:/i.test(im.getAttribute('src') || '')) {
        const t = document.createElement('div');
        t.innerHTML = figHtml({ src: im.getAttribute('src'), alt: im.getAttribute('alt') || '', w: FIG_MAX, c: null, r: null, cap: '' });
        p.replaceWith(t.firstElementChild);
      }
    });
    scope.querySelectorAll('figure.fig').forEach((f) => {
      f.classList.add('rte-fig');
      f.setAttribute('contenteditable', 'false');
      f.setAttribute('draggable', 'true');
      f.querySelectorAll('img').forEach((i) => i.setAttribute('draggable', 'false'));
    });
  }
  upgradeFigures();

  /** Avisa e devolve false quando o artigo já tem a sua imagem (o limite é uma por artigo). */
  const canAddImage = () => {
    if (!root.querySelector('img')) return true;
    toast('O artigo pode ter só uma imagem no texto. Para trocar, selecione a atual e use Editar.');
    return false;
  };

  /** Mostra a barra de botões embaixo da figura selecionada e as alças sobre ela (redimensionar ou cortar). */
  const placeImgBar = () => {
    imgBar.hidden = !selectedImg;
    handles.hidden = !selectedImg;
    if (!selectedImg || !selectedImg.isConnected) {
      imgBar.hidden = handles.hidden = true;
      return;
    }
    const box = mount.getBoundingClientRect(),
      fr = selectedImg.querySelector('.fig-frame').getBoundingClientRect();
    imgBar.querySelector('.rte-imgbar-main').hidden = !!crop;
    imgBar.querySelector('.rte-imgbar-crop').hidden = !crop;
    // alças: na moldura (redimensionar) ou na área escolhida dentro da imagem inteira (cortar)
    let r = fr;
    cropBox.hidden = !crop;
    if (crop) {
      const [x, y, cw, ch] = crop.box;
      r = { left: fr.left + (fr.width * x) / 100, top: fr.top + (fr.height * y) / 100, width: (fr.width * cw) / 100, height: (fr.height * ch) / 100 };
      Object.assign(cropBox.style, { left: '0', top: '0', width: '100%', height: '100%' });
    }
    Object.assign(handles.style, {
      left: r.left - box.left + 'px',
      top: r.top - box.top + 'px',
      width: r.width + 'px',
      height: r.height + 'px',
    });
    handles.classList.toggle('cropping', !!crop);
    // barra embaixo da imagem (e da legenda), centralizada; abre espaço abaixo da figura para não cobrir o texto.
    // Se a parte de baixo da imagem estiver fora da tela, a barra fica presa no rodapé da tela (sem subir acima da imagem
    // nem passar por baixo da barra de ferramentas do editor).
    mount.style.setProperty('--imgbar-h', imgBar.offsetHeight + 'px');
    const fig = selectedImg.getBoundingClientRect(),
      bh = imgBar.offsetHeight,
      toolsBottom = Math.max(0, mount.querySelector('.rte-tools')?.getBoundingClientRect().bottom || 0);
    let top = fig.bottom + 8; // posição na tela
    top = Math.min(top, innerHeight - bh - 8); // sempre visível no rodapé da tela
    top = Math.max(top, fr.top + 8, toolsBottom + 8); // nunca acima da imagem nem sob a barra de ferramentas
    top = Math.min(top, box.bottom - bh - 4); // dentro do editor
    imgBar.style.top = top - box.top + 'px';
    imgBar.style.left = Math.max(4, Math.min(fr.left - box.left + fr.width / 2 - imgBar.offsetWidth / 2, box.width - imgBar.offsetWidth - 4)) + 'px';
  };
  addEventListener('resize', () => root.isConnected && placeImgBar());
  // ao rolar a página, a barra acompanha (fica visível no rodapé da tela enquanto a imagem estiver à vista)
  addEventListener('scroll', () => root.isConnected && selectedImg && placeImgBar(), { passive: true, capture: true });
  // a imagem pode terminar de carregar (ou mudar de tamanho) depois de selecionada: reposiciona as alças
  root.addEventListener('load', () => selectedImg && placeImgBar(), true);
  const sizeWatch = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => selectedImg && !drag && placeImgBar()) : null;
  const selectImg = (f) => {
    if (crop && crop.fig !== f) cancelCrop();
    root.querySelectorAll('.rte-sel').forEach((x) => x.classList.remove('rte-sel')); // desfazer pode trazer de volta uma marca antiga
    selectedImg = f;
    if (f) f.classList.add('rte-sel');
    if (sizeWatch) {
      sizeWatch.disconnect();
      if (f) sizeWatch.observe(f);
    }
    sizeTag.textContent = '';
    placeImgBar();
  };

  /** Deixa um elemento num parágrafo só dele, separando o texto de antes e o de depois. Devolve esse parágrafo e o primeiro bloco da divisão. */
  function isolateImg(copy, im) {
    let block = im;
    while (block.parentNode !== copy) block = block.parentNode;
    if (block === im) {
      block = document.createElement('p');
      copy.replaceChild(block, im);
      block.appendChild(im);
    }
    const r = document.createRange();
    r.setStartBefore(block);
    r.setEndBefore(im);
    const left = r.extractContents();
    r.setStartAfter(im);
    r.setEndAfter(block);
    const right = r.extractContents();
    let own = block;
    if (block.tagName !== 'P') {
      own = document.createElement('p');
      own.style.textAlign = block.style.textAlign;
      block.replaceWith(own);
      own.appendChild(im);
    }
    const leftEl = left.firstElementChild,
      rightEl = right.firstElementChild;
    if (rightEl && hasContent(rightEl)) own.after(rightEl);
    if (leftEl && hasContent(leftEl)) {
      own.before(leftEl);
      return { own, first: leftEl };
    }
    return { own, first: own };
  }

  const asMd = (el) => htmlToMd(el, (src) => 'https://x/' + encodeURIComponent(src));
  /**
   * Troca todo o conteúdo por um único comando do navegador, para o Ctrl+Z desfazer a mudança inteira
   * (mover, inserir, redimensionar, cortar ou mudar a legenda da imagem).
   */
  function replaceAll(html) {
    const y = scrollY;
    root.focus();
    const r = document.createRange();
    r.selectNodeContents(root);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    // o Edge/Chrome jogaria o conteúdo para dentro da lista ou citação, se o texto começar com uma delas;
    // por isso, nesse caso, primeiro esvazia o editor e volta ao parágrafo comum, sempre por comandos que o Ctrl+Z desfaz
    if (root.firstElementChild && /^(UL|OL|BLOCKQUOTE)$/.test(root.firstElementChild.tagName)) {
      document.execCommand('delete');
      const list = closestInEditor('ul,ol');
      if (list) document.execCommand(list.tagName === 'UL' ? 'insertUnorderedList' : 'insertOrderedList');
      if (closestInEditor('blockquote')) document.execCommand('formatBlock', false, '<p>');
    }
    document.execCommand('insertHTML', false, html);
    const want = document.createElement('div');
    want.innerHTML = html;
    if (asMd(root) !== asMd(want)) root.innerHTML = html; // último recurso: o texto certo vale mais que o histórico
    upgradeFigures();
    scrollTo(0, y);
  }
  /** Cópia do conteúdo sem as marcas de seleção, com a figura `f` marcada para ser achada depois. */
  const copyWith = (f) => {
    const copy = root.cloneNode(true);
    copy.querySelectorAll('.rte-sel').forEach((x) => x.classList.remove('rte-sel'));
    const cf = f ? copy.querySelectorAll('figure.fig')[figs().indexOf(f)] : null;
    if (cf) cf.setAttribute('data-moving', '1');
    return { copy, cf };
  };
  /** Aplica a cópia, seleciona de novo a figura marcada e a mantém à vista. */
  function commit(copy) {
    [...copy.children].forEach((c, i, all) => i < all.length - 1 && !hasContent(c) && c.remove()); // linhas vazias que sobraram
    const last = copy.lastElementChild;
    if (!last || last.matches('figure')) copy.insertAdjacentHTML('beforeend', '<p><br></p>'); // para continuar escrevendo depois dela
    if (copy.innerHTML === root.innerHTML) return;
    replaceAll(copy.innerHTML);
    const f = root.querySelector('[data-moving]');
    if (f) {
      f.removeAttribute('data-moving');
      selectImg(f);
      f.scrollIntoView({ block: 'nearest' });
    } else selectImg(null);
    syncState();
  }

  /** Muda a figura de lugar: `where` é 'up', 'down' ou o índice do bloco antes do qual ela deve ficar. Só entre parágrafos. */
  function moveImage(f, where) {
    const { copy, cf } = copyWith(f);
    let ref = typeof where === 'number' ? copy.children[where] || null : null;
    while (ref && (ref === cf || !hasContent(ref))) ref = ref.nextElementSibling;
    let own = cf;
    while (own.parentNode !== copy) own = own.parentNode;
    if (own !== cf) own = isolateImg(copy, cf).own; // figura dentro de outro bloco: tira de lá
    const sib = (dir) => {
      let n = dir === 'up' ? own.previousElementSibling : own.nextElementSibling;
      while (n && !hasContent(n)) n = dir === 'up' ? n.previousElementSibling : n.nextElementSibling;
      return n;
    };
    if (where === 'up' && !sib('up')) return toast('A imagem já está no começo do texto');
    if (where === 'down' && !sib('down')) return toast('A imagem já está no fim do texto');
    if (where === 'up') sib('up').before(own);
    else if (where === 'down') sib('down').after(own);
    else if (ref !== own) copy.insertBefore(own, ref);
    commit(copy);
  }
  /** Troca os dados da figura (largura, corte, legenda, imagem) como um passo só do Ctrl+Z. */
  function setFig(f, d) {
    const { copy, cf } = copyWith(f);
    const t = document.createElement('div');
    t.innerHTML = figHtml(d);
    const nf = t.firstElementChild;
    nf.setAttribute('data-moving', '1');
    cf.replaceWith(nf);
    commit(copy);
  }
  /** Insere a figura onde está o cursor, numa linha só dela (o parágrafo é dividido se preciso). */
  function insertFigure(d) {
    if (!canAddImage()) return;
    restore();
    const s = getSelection();
    const mark = document.createElement('span');
    mark.setAttribute('data-mark', '1');
    if (s.rangeCount && root.contains(s.getRangeAt(0).commonAncestorContainer)) {
      const r = s.getRangeAt(0);
      r.deleteContents();
      r.insertNode(mark);
    } else root.appendChild(mark);
    const { copy } = copyWith(null);
    mark.remove();
    const m = copy.querySelector('[data-mark]');
    const { own } = isolateImg(copy, m);
    const t = document.createElement('div');
    t.innerHTML = figHtml(d);
    const nf = t.firstElementChild;
    nf.setAttribute('data-moving', '1');
    own.replaceWith(nf);
    commit(copy);
  }

  // ---------- redimensionar e cortar pelas alças ----------
  /** Entra no modo de corte: mostra a imagem inteira, na mesma escala, com a área escolhida destacada. */
  function startCrop(f) {
    const im = f.querySelector('img');
    if (!im.naturalWidth) return toast('Espere a imagem carregar para cortar');
    const d = figData(f);
    const box = d.c ? [...d.c] : [0, 0, 100, 100];
    const full = Math.min(FIG_MAX, (d.w * 100) / box[2]); // largura da imagem inteira, mantendo a escala atual
    crop = { fig: f, d, full, box, r: +((im.naturalHeight / im.naturalWidth) * 100).toFixed(2) };
    f.classList.add('rte-cropping');
    f.style.width = full + '%';
    const fr = f.querySelector('.fig-frame');
    fr.removeAttribute('style');
    im.removeAttribute('style');
    placeImgBar();
  }
  /** Sai do corte sem mudar nada. */
  function cancelCrop() {
    if (!crop) return;
    const { fig, d } = crop;
    crop = null;
    const t = document.createElement('div');
    t.innerHTML = figHtml(d);
    fig.classList.remove('rte-cropping');
    fig.style.width = d.w + '%';
    fig.querySelector('.fig-frame').replaceWith(t.firstElementChild.querySelector('.fig-frame'));
    upgradeFigures();
    placeImgBar();
  }
  /** Aplica o corte (ou tira, com `reset`), mantendo a escala da imagem. */
  function applyCrop(reset) {
    if (!crop) return;
    const { fig, d, full, r } = crop;
    const box = reset ? [0, 0, 100, 100] : crop.box.map((n) => +n.toFixed(2));
    const whole = box[0] <= 0.5 && box[1] <= 0.5 && box[2] >= 99.5 && box[3] >= 99.5;
    const w = Math.round(Math.min(FIG_MAX, Math.max(FIG_MIN, (full * box[2]) / 100)));
    cancelCrop();
    setFig(fig, { ...d, w, c: whole ? null : box, r: whole ? null : r });
  }

  let drag = null;
  handles.addEventListener('pointerdown', (e) => {
    const h = e.target.dataset && e.target.dataset.h;
    if (!h || !selectedImg) return;
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);
    const f = selectedImg,
      fr = f.querySelector('.fig-frame').getBoundingClientRect(),
      col = root.getBoundingClientRect(),
      cs = getComputedStyle(root),
      colW = col.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    drag = { h, f, fr, colW, d: figData(f), w: +f.dataset.w || FIG_MAX, box: crop ? [...crop.box] : null };
  });
  handles.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const { h, f, fr, colW } = drag;
    if (crop) {
      // corte: a borda puxada vai até onde está o ponteiro (mínimo de 10% da imagem em cada direção)
      let [x, y, cw, ch] = drag.box;
      const px = ((e.clientX - fr.left) / fr.width) * 100,
        py = ((e.clientY - fr.top) / fr.height) * 100;
      const cl = (v, a, b) => Math.min(b, Math.max(a, v));
      if (h.includes('w')) {
        const nx = cl(px, 0, x + cw - 10);
        cw += x - nx;
        x = nx;
      }
      if (h.includes('e')) cw = cl(px, x + 10, 100) - x;
      if (h.includes('n')) {
        const ny = cl(py, 0, y + ch - 10);
        ch += y - ny;
        y = ny;
      }
      if (h.includes('s')) ch = cl(py, y + 10, 100) - y;
      crop.box = [x, y, cw, ch];
      sizeTag.textContent = `${Math.round(cw)}% × ${Math.round(ch)}%`;
    } else {
      // redimensionar: a imagem continua centralizada e proporcional; vale tanto puxar as laterais quanto o topo/base
      const cx = fr.left + fr.width / 2;
      let wpx;
      if (h === 'n' || h === 's') {
        const hpx = h === 's' ? e.clientY - fr.top : fr.bottom - e.clientY;
        wpx = (hpx * fr.width) / fr.height;
      } else wpx = Math.abs(e.clientX - cx) * 2;
      const w = Math.round(Math.min(FIG_MAX, Math.max(FIG_MIN, (wpx / colW) * 100)));
      drag.w = w;
      f.style.width = w + '%';
      sizeTag.textContent = w + '%';
    }
    placeImgBar();
  });
  const endDrag = () => {
    if (!drag) return;
    const { f, d, w } = drag;
    drag = null;
    if (crop) return placeImgBar(); // o corte só vale ao clicar em Concluir
    f.style.width = d.w + '%'; // volta ao que era e aplica de novo como um passo do Ctrl+Z
    if (w !== d.w) setFig(f, { ...d, w });
    setTimeout(() => (sizeTag.textContent = ''), 900);
  };
  handles.addEventListener('pointerup', endDrag);
  handles.addEventListener('pointercancel', endDrag);

  /** Atualiza os botões para mostrar a formatação de onde o cursor está. */
  function syncState() {
    const s = selectionInside();
    if (!s || frozenRange) return;
    lastRange = s.getRangeAt(0).cloneRange();
    placeImgBar();
    mount.querySelectorAll('.rte-btn').forEach((b) => {
      const a = b.dataset.a;
      let on = false;
      if (a === 'link') on = !!closestInEditor('a');
      else if (a === 'image') on = !!selectedImg;
      else if (!['undo', 'redo', 'clear'].includes(a)) {
        try {
          on = document.queryCommandState(a);
        } catch (e) {}
      }
      if (['undo', 'redo', 'clear'].includes(a)) b.removeAttribute('aria-pressed');
      else b.setAttribute('aria-pressed', on);
    });
    const blockEl = closestInEditor('h1,h2,h3,h4,h5,h6,blockquote');
    const tag = blockEl ? blockEl.tagName.toLowerCase() : 'p';
    blockSel.value = tag === 'h1' ? 'h2' : /^h[4-6]$/.test(tag) ? 'h3' : tag;
  }
  const onSelection = () => {
    if (!root.isConnected) return document.removeEventListener('selectionchange', onSelection);
    syncState();
  };
  document.addEventListener('selectionchange', onSelection);

  // ---------- diálogos (ficam fora do formulário do artigo, para o Enter não salvar o artigo) ----------
  const dialogs = document.createElement('div');
  dialogs.innerHTML = `<dialog id="rte-link"><form method="dialog"><h2>Link</h2>
      <label for="rl-url">Endereço (URL)</label><input type="text" id="rl-url" placeholder="https://exemplo.com" autocomplete="off" spellcheck="false">
      <div id="rl-textrow"><label for="rl-text">Texto do link</label><input type="text" id="rl-text"></div>
      <div class="err" id="rl-err"></div>
      <div class="acts"><button class="btn" type="submit">Aplicar</button><button class="btn del" type="button" id="rl-rm">Remover link</button><button class="btn alt" type="button" id="rl-cancel">Cancelar</button></div>
    </form></dialog>
    <dialog id="rte-cap"><form method="dialog"><h2>Legenda da imagem</h2>
      <label for="rc-text">Texto que aparece embaixo da imagem</label><input type="text" id="rc-text" maxlength="200" placeholder="Ex.: Ilustração: Fulano de Tal" autocomplete="off">
      <div class="acts"><button class="btn" type="submit">Aplicar</button><button class="btn del" type="button" id="rc-rm">Tirar legenda</button><button class="btn alt" type="button" id="rc-cancel">Cancelar</button></div>
    </form></dialog>
    <dialog id="rte-img"><form method="dialog"><h2 id="ri-title">Inserir imagem</h2>
      <label for="ri-file">Arquivo do computador</label><input type="file" id="ri-file" accept="image/*">
      <label for="ri-url" class="sub">ou cole o endereço (URL) da imagem</label><input type="text" id="ri-url" placeholder="https://exemplo.com/foto.jpg" autocomplete="off" spellcheck="false">
      <label for="ri-alt">Descrição da imagem</label><input type="text" id="ri-alt" placeholder="Para quem não consegue ver a imagem">
      <img class="img-prev" id="ri-prev" alt="Prévia da imagem" hidden>
      <div class="err" id="ri-err"></div>
      <div class="acts"><button class="btn" type="submit" id="ri-ok">Inserir</button><button class="btn del" type="button" id="ri-rm">Remover</button><button class="btn alt" type="button" id="ri-cancel">Cancelar</button></div>
    </form></dialog>`;
  mount.closest('.art').appendChild(dialogs);
  const q = (s) => dialogs.querySelector(s);

  /** Link: aplica à seleção ou, sem seleção, insere um texto novo. */
  const linkDlg = q('#rte-link');
  let editingLink = null;
  function openLinkDialog() {
    editingLink = closestInEditor('a');
    const hasText = selectionInside() && !getSelection().isCollapsed;
    q('#rl-url').value = editingLink ? editingLink.getAttribute('href') : '';
    q('#rl-text').value = '';
    q('#rl-textrow').hidden = !!editingLink || !!hasText;
    q('#rl-rm').hidden = !editingLink;
    q('#rl-err').textContent = '';
    openDialog(linkDlg);
    q('#rl-url').focus();
  }
  // fechar com Esc não passa pelos botões do diálogo
  linkDlg.addEventListener('close', () => (frozenRange = null));
  linkDlg.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    let url = q('#rl-url').value.trim();
    if (url && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
    if (!/^https?:\/\/[^\s/]+/i.test(url)) {
      q('#rl-err').textContent = 'Informe um endereço que comece com http:// ou https://';
      return;
    }
    linkDlg.close();
    restore();
    if (editingLink) {
      selectNode(editingLink);
      exec('createLink', url);
    } else if (getSelection().isCollapsed) {
      const text = q('#rl-text').value.trim() || url;
      exec('insertHTML', `<a href="${esc(url)}">${esc(text)}</a>`);
    } else exec('createLink', url);
  };
  q('#rl-rm').onclick = () => {
    linkDlg.close();
    restore();
    selectNode(editingLink);
    exec('unlink');
  };
  q('#rl-cancel').onclick = () => {
    linkDlg.close();
    restore();
  };

  /** Legenda: escrever, trocar ou tirar. */
  const capDlg = q('#rte-cap');
  let capFig = null;
  function openCaptionDialog(f) {
    capFig = f;
    q('#rc-text').value = figData(f).cap;
    q('#rc-rm').hidden = !figData(f).cap;
    openDialog(capDlg);
    q('#rc-text').focus();
  }
  capDlg.addEventListener('close', () => (frozenRange = null));
  capDlg.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    capDlg.close();
    setFig(capFig, { ...figData(capFig), cap: q('#rc-text').value.replace(/\s+/g, ' ').trim() });
  };
  q('#rc-rm').onclick = () => {
    capDlg.close();
    setFig(capFig, { ...figData(capFig), cap: '' });
  };
  q('#rc-cancel').onclick = () => capDlg.close();

  /** Tira a figura do texto (um passo do Ctrl+Z). */
  function removeFigure(f) {
    const { copy, cf } = copyWith(f);
    cf.remove();
    commit(copy);
  }
  /** Reduz um arquivo de imagem e devolve o endereço temporário usado até o artigo ser salvo. */
  const prepareFile = async (file) => {
    const blob = await resizeImage(file);
    const url = URL.createObjectURL(blob);
    pending.set(url, blob);
    return url;
  };

  /** Imagem: insere uma nova ou edita a selecionada. */
  const imgDlg = q('#rte-img');
  let editingImg = null;
  const showImgPreview = (src) => {
    q('#ri-prev').hidden = !src;
    if (src) q('#ri-prev').src = src;
  };
  function openImageDialog() {
    if (!selectedImg && !canAddImage()) return;
    editingImg = selectedImg ? selectedImg.querySelector('img') : null;
    const src = editingImg ? editingImg.getAttribute('src') : '';
    q('#ri-title').textContent = editingImg ? 'Editar imagem' : 'Inserir imagem';
    q('#ri-ok').textContent = editingImg ? 'Aplicar' : 'Inserir';
    q('#ri-rm').hidden = !editingImg;
    q('#ri-file').value = '';
    q('#ri-url').value = /^https?:/i.test(src) ? src : '';
    q('#ri-alt').value = editingImg ? editingImg.getAttribute('alt') || '' : '';
    q('#ri-err').textContent = '';
    showImgPreview(src);
    openDialog(imgDlg);
  }
  imgDlg.addEventListener('close', () => (frozenRange = null));
  q('#ri-file').onchange = () => {
    const f = q('#ri-file').files[0];
    if (!f) return;
    q('#ri-url').value = '';
    q('#ri-err').textContent = f.type.startsWith('image/') ? '' : 'Escolha um arquivo de imagem';
    showImgPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : '');
  };
  q('#ri-url').oninput = () => {
    const v = q('#ri-url').value.trim();
    if (v) q('#ri-file').value = '';
    showImgPreview(/^https?:\/\//i.test(v) ? v : '');
  };
  q('#ri-prev').onerror = () => (q('#ri-err').textContent = 'Não foi possível carregar essa imagem');
  q('#ri-prev').onload = () => (q('#ri-err').textContent = '');
  imgDlg.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const file = q('#ri-file').files[0],
      url = q('#ri-url').value.trim(),
      alt = q('#ri-alt').value.trim(),
      keep = editingImg && !file && !url ? editingImg.getAttribute('src') : '';
    if (file && !file.type.startsWith('image/')) return;
    if (!file && !keep && !/^https?:\/\/\S+$/i.test(url)) {
      q('#ri-err').textContent = 'Escolha um arquivo ou informe um endereço que comece com http:// ou https://';
      return;
    }
    let src = keep || url;
    if (file) {
      q('#ri-ok').disabled = true;
      try {
        src = await prepareFile(file);
      } catch (err) {
        q('#ri-err').textContent = 'Não foi possível ler essa imagem';
        return;
      } finally {
        q('#ri-ok').disabled = false;
      }
    }
    imgDlg.close();
    if (editingImg) {
      const f = editingImg.closest('figure.fig'),
        d = figData(f),
        changed = src !== d.src;
      // outra imagem: o corte da anterior não serve mais
      setFig(f, { ...d, src, alt, c: changed ? null : d.c, r: changed ? null : d.r });
    } else insertFigure({ src, alt, w: FIG_MAX, c: null, r: null, cap: '' });
  };
  q('#ri-rm').onclick = () => {
    imgDlg.close();
    removeFigure(editingImg.closest('figure.fig'));
  };
  q('#ri-cancel').onclick = () => {
    imgDlg.close();
    restore();
  };

  /** Insere a imagem colada ou arrastada (só uma: o limite é de uma imagem por artigo). */
  async function insertFiles(files) {
    if (!canAddImage()) return;
    if (files.length > 1) toast('Só a primeira imagem entrou: o artigo pode ter uma imagem no texto.');
    try {
      insertFigure({ src: await prepareFile(files[0]), alt: '', w: FIG_MAX, c: null, r: null, cap: '' });
    } catch (e) {
      toast('Não foi possível ler essa imagem');
    }
  }

  // ---------- barra de ferramentas ----------
  mount.querySelectorAll('.rte-btn').forEach((b) => {
    b.onmousedown = (e) => e.preventDefault(); // não tira o foco nem a seleção do texto
    b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'link') {
        restore();
        openLinkDialog();
      } else if (a === 'image') {
        restore();
        openImageDialog();
      } else if (a === 'clear') {
        exec('removeFormat');
        exec('unlink');
        exec('formatBlock', '<p>');
        exec('justifyLeft');
      } else exec(a);
    };
  });
  blockSel.onchange = () => {
    exec('formatBlock', `<${blockSel.value}>`);
  };
  imgBar.querySelectorAll('button').forEach((b) => {
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = () => {
      const a = b.dataset.i,
        f = selectedImg;
      if (!f) return;
      if (a === 'up' || a === 'down') moveImage(f, a);
      else if (a === 'crop') startCrop(f);
      else if (a === 'crop-ok') applyCrop(false);
      else if (a === 'crop-reset') applyCrop(true);
      else if (a === 'crop-cancel') cancelCrop();
      else if (a === 'cap') openCaptionDialog(f);
      else if (a === 'edit') openImageDialog();
      else removeFigure(f);
    };
  });

  // ---------- teclado, cliques, colar e arrastar ----------
  const SHORTCUTS = { b: 'bold', i: 'italic', u: 'underline' };
  let tabExits = false; // depois de Esc, o Tab volta a sair do editor (para quem navega só pelo teclado)
  root.addEventListener('blur', () => (tabExits = false));
  /** Insere um Tab de verdade (um caractere, com largura de 5 espaços até a próxima parada de tabulação). */
  const insertTab = () => {
    const sel = getSelection();
    if (!sel.rangeCount || !root.contains(sel.anchorNode)) return;
    const r = sel.getRangeAt(0);
    r.deleteContents();
    const span = document.createElement('span');
    span.className = 'tab';
    span.textContent = '\t';
    r.insertNode(span);
    r.setStartAfter(span);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    root.dispatchEvent(new Event('input', { bubbles: true }));
  };
  /** Shift+Tab: apaga o Tab logo antes do cursor, se houver. */
  const removeTab = () => {
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return;
    const r = sel.getRangeAt(0).cloneRange();
    r.setStart(root, 0);
    if (r.toString().endsWith('\t')) document.execCommand('delete');
  };
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !crop) {
      tabExits = true;
      if (selectedImg) selectImg(null);
      return;
    }
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey && !tabExits) {
      e.preventDefault();
      if (e.shiftKey) removeTab();
      else insertTab();
      return;
    }
    if (e.key !== 'Shift') tabExits = false;
    if (selectedImg) {
      if (crop && (e.key === 'Enter' || e.key === 'Escape')) {
        e.preventDefault();
        return e.key === 'Enter' ? applyCrop(false) : cancelCrop();
      }
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        moveImage(selectedImg, e.key === 'ArrowUp' ? 'up' : 'down');
        return;
      }
      if (!crop && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        removeFigure(selectedImg);
        return;
      }
      if (!crop && !e.ctrlKey && !e.metaKey && !['Shift', 'Alt', 'Tab', 'Escape'].includes(e.key)) selectImg(null); // voltou a escrever
    }
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const key = e.key.toLowerCase();
    if (key === 'k') {
      e.preventDefault();
      openLinkDialog();
    } else if (SHORTCUTS[key]) {
      e.preventDefault(); // nem todo navegador trata esses atalhos sozinho (no Firefox, Ctrl+B pode abrir os favoritos)
      exec(SHORTCUTS[key]);
    }
  });
  root.addEventListener('click', (e) => {
    const f = e.target.closest && e.target.closest('figure.fig');
    if (f && root.contains(f)) {
      if (f !== selectedImg) selectImg(f);
      root.focus({ preventScroll: true });
      syncState();
    } else if (selectedImg && !crop) selectImg(null);
  });
  root.addEventListener('dblclick', (e) => {
    const f = e.target.closest && e.target.closest('figure.fig');
    if (f && root.contains(f) && !crop) {
      selectImg(f);
      openImageDialog();
    }
  });
  root.addEventListener('input', () => selectedImg && placeImgBar());
  root.addEventListener('paste', (e) => {
    const cd = e.clipboardData;
    if (!cd) return;
    e.preventDefault();
    const files = [...cd.files].filter((f) => f.type.startsWith('image/'));
    const html = cd.getData('text/html');
    const doc = html ? new DOMParser().parseFromString(html, 'text/html') : null;
    if (doc && doc.images.length) {
      // imagens que vêm junto com texto colado ficam de fora: a imagem do artigo entra pelo botão (uma por artigo)
      [...doc.images].forEach((im) => im.remove());
      toast('As imagens do texto colado ficaram de fora. Use o botão de imagem (uma por artigo).');
    }
    const text = doc ? htmlToMd(doc.body) : '';
    if (text) {
      const clean = md(text);
      const single = clean.match(/^<p>((?:(?!<\/p>)[\s\S])*)<\/p>$/);
      document.execCommand('insertHTML', false, single ? single[1] : clean);
    } else if (files.length) insertFiles(files);
    else document.execCommand('insertText', false, cd.getData('text/plain'));
  });
  // arrastar uma imagem do próprio texto a muda de linha; a linha colorida mostra onde ela vai ficar
  let draggedImg = null;
  let dropIndex = 0;
  const endImageDrag = () => {
    draggedImg = null;
    dropLine.hidden = true;
  };
  root.addEventListener('dragstart', (e) => {
    const f = e.target.closest && e.target.closest('figure.fig');
    if (!f || crop) {
      if (crop) e.preventDefault();
      return;
    }
    draggedImg = f;
    selectImg(f);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ''); // o Firefox só começa a arrastar se houver algum dado
  });
  root.addEventListener('dragend', endImageDrag);
  root.addEventListener('dragleave', (e) => {
    if (!root.contains(e.relatedTarget)) dropLine.hidden = true;
  });
  root.addEventListener('dragover', (e) => {
    if (draggedImg) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const kids = [...root.children];
      const hit = kids.findIndex((k) => {
        const b = k.getBoundingClientRect();
        return hasContent(k) && e.clientY < b.top + b.height / 2;
      });
      dropIndex = hit < 0 ? kids.length : hit;
      const filled = kids.filter(hasContent);
      const edge = hit >= 0 ? kids[hit].getBoundingClientRect().top - 4 : filled.length ? filled[filled.length - 1].getBoundingClientRect().bottom + 4 : root.getBoundingClientRect().top;
      dropLine.style.top = edge - mount.getBoundingClientRect().top + 'px';
      dropLine.hidden = false;
    } else if (e.dataTransfer.types.includes('Files')) e.preventDefault();
  });
  root.addEventListener('drop', (e) => {
    if (draggedImg) {
      e.preventDefault();
      const img = draggedImg;
      endImageDrag();
      moveImage(img, dropIndex);
      return;
    }
    const files =[...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    const r = document.caretRangeFromPoint
      ? document.caretRangeFromPoint(e.clientX, e.clientY)
      : (() => {
          const p = document.caretPositionFromPoint(e.clientX, e.clientY);
          if (!p) return null;
          const x = document.createRange();
          x.setStart(p.offsetNode, p.offset);
          return x;
        })();
    if (r) frozenRange = r; // a imagem entra onde foi solta, não onde o cursor estava
    insertFiles(files);
  });

  return {
    focus: () => root.focus(),
    isEmpty: () => !root.textContent.trim() && !root.querySelector('img'),
    /** Envia as imagens novas e devolve o Markdown final. Os endereços enviados entram em `uploaded`, para desfazer se o salvamento falhar. */
    async getBody(uploaded) {
      if (crop) applyCrop(false);
      if (root.querySelectorAll('img').length > 1)
        throw new Error('o artigo pode ter só uma imagem no texto. Remova as outras antes de salvar.');
      const sent = new Map();
      for (const im of root.querySelectorAll('img')) {
        const src = im.getAttribute('src');
        if (pending.has(src) && !sent.has(src)) {
          const url = await uploadCover(pending.get(src));
          uploaded.push(url);
          sent.set(src, url);
        }
      }
      return htmlToMd(root, (src) => sent.get(src) || src);
    },
  };
}
