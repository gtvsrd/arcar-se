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
    .replace(/[\s ​]+/g, ' ')
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

/** Arruma os espaços e quebras de linha de um bloco. */
const rteClean = (s) => s.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/ {2,}/g, ' ').trim();

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
     <button type="button" class="btn sm alt" data-i="up" title="Mover para cima (Alt+↑)">↑ Subir</button>
     <button type="button" class="btn sm alt" data-i="down" title="Mover para baixo (Alt+↓)">↓ Descer</button>
     <button type="button" class="btn sm alt" data-i="edit">Editar</button>
     <button type="button" class="btn sm del" data-i="remove">Remover</button>
   </div>
   <div class="rte-drop" id="rte-drop" hidden></div>`;
  const root = mount.querySelector('#b');
  const blockSel = mount.querySelector('#rte-block');
  const imgBar = mount.querySelector('#rte-imgbar');
  const dropLine = mount.querySelector('#rte-drop');
  const pending = new Map(); // endereço temporário (blob:) -> imagem ainda não enviada
  let lastRange = null; // última seleção dentro do editor (a lista de estilos tira o foco dele)
  let frozenRange = null; // seleção guardada enquanto um diálogo está aberto
  let selectedImg = null;

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
  /** Mostra os botões da imagem selecionada no canto dela, sem sair da área do editor. */
  const placeImgBar = () => {
    imgBar.hidden = !selectedImg;
    if (!selectedImg) return;
    const box = mount.getBoundingClientRect(),
      im = selectedImg.getBoundingClientRect();
    imgBar.style.top = im.top - box.top + 8 + 'px';
    imgBar.style.left = Math.max(4, Math.min(im.right - box.left - imgBar.offsetWidth - 8, box.width - imgBar.offsetWidth - 4)) + 'px';
  };
  const selectImg = (img) => {
    root.querySelectorAll('.rte-sel').forEach((x) => x.classList.remove('rte-sel')); // desfazer pode trazer de volta uma marca antiga
    selectedImg = img;
    if (img) img.classList.add('rte-sel');
    placeImgBar();
  };
  const hasContent = (el) => el.textContent.trim() || el.querySelector('img');

  /** Deixa a imagem num parágrafo só dela, separando o texto de antes e o de depois. Devolve esse parágrafo e o primeiro bloco da divisão. */
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

  /**
   * Muda a imagem de linha: `where` é 'up', 'down' ou o índice do bloco antes do qual ela deve ficar.
   * A troca passa por um único comando do navegador, para o Ctrl+Z desfazer o movimento inteiro.
   */
  function moveImage(img, where) {
    const copy = root.cloneNode(true);
    const im = copy.querySelectorAll('img')[[...root.querySelectorAll('img')].indexOf(img)];
    im.classList.remove('rte-sel');
    if (!im.getAttribute('class')) im.removeAttribute('class');
    const before = copy.innerHTML;
    let ref = typeof where === 'number' ? copy.children[where] || null : null;
    while (ref && !hasContent(ref)) ref = ref.nextElementSibling;
    const refIsOwnBlock = ref && ref.contains(im);
    const { own, first } = isolateImg(copy, im);
    if (refIsOwnBlock) ref = first;
    [...copy.children].forEach((c) => c !== own && !hasContent(c) && c.remove());
    if (where === 'up' && !own.previousElementSibling) return toast('A imagem já está no começo do texto');
    if (where === 'down' && !own.nextElementSibling) return toast('A imagem já está no fim do texto');
    if (where === 'up') own.previousElementSibling.before(own);
    else if (where === 'down') own.nextElementSibling.after(own);
    else if (ref !== own) copy.insertBefore(own, ref);
    if (!own.nextElementSibling) copy.insertAdjacentHTML('beforeend', '<p><br></p>'); // para continuar escrevendo depois dela
    if (copy.innerHTML === before) return;
    const asMd = (el) => htmlToMd(el, (src) => 'https://x/' + encodeURIComponent(src));
    const index =[...copy.querySelectorAll('img')].indexOf(im);
    const y = scrollY;
    root.focus();
    const r = document.createRange();
    r.selectNodeContents(root);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    // o Edge/Chrome jogaria o conteúdo para dentro da lista ou citação, se o texto começar com uma delas;
    // por isso, nesse caso, primeiro esvazia o editor e volta ao parágrafo comum, sempre por comandos que o Ctrl+Z desfaz
    if (/^(UL|OL|BLOCKQUOTE)$/.test(root.firstElementChild.tagName)) {
      document.execCommand('delete');
      const list = closestInEditor('ul,ol');
      if (list) document.execCommand(list.tagName === 'UL' ? 'insertUnorderedList' : 'insertOrderedList');
      if (closestInEditor('blockquote')) document.execCommand('formatBlock', false, '<p>');
    }
    document.execCommand('insertHTML', false, copy.innerHTML);
    if (asMd(root) !== asMd(copy)) root.innerHTML = copy.innerHTML; // último recurso: o texto certo vale mais que o histórico
    scrollTo(0, y);
    const moved = root.querySelectorAll('img')[index];
    selectNode(moved);
    selectImg(moved);
    syncState();
    moved.scrollIntoView({ block: 'nearest' });
  }

  /** Atualiza os botões para mostrar a formatação de onde o cursor está. */
  function syncState() {
    const s = selectionInside();
    if (!s || frozenRange) return;
    lastRange = s.getRangeAt(0).cloneRange();
    if (selectedImg && !(lastRange.startContainer.childNodes[lastRange.startOffset] === selectedImg)) selectImg(null);
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

  /** Coloca a imagem numa linha só dela, separando o texto de antes e o de depois. */
  function insertImage(html) {
    restore();
    const s = getSelection();
    if (!s.isCollapsed) document.execCommand('delete');
    const block = currentBlock();
    if (block && block.nodeType === 1) {
      const before = document.createRange();
      before.selectNodeContents(block);
      before.setEnd(s.anchorNode, s.anchorOffset);
      if (before.toString().trim() || before.cloneContents().querySelector('img')) document.execCommand('insertParagraph');
    }
    document.execCommand('insertHTML', false, html);
    document.execCommand('insertParagraph');
    syncState();
  }
  const imgHtml = (src, alt) => `<img src="${esc(src)}" alt="${esc(alt)}">`;
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
    editingImg = selectedImg;
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
      restore();
      selectNode(editingImg);
      exec('insertHTML', imgHtml(src, alt));
    } else insertImage(imgHtml(src, alt));
  };
  q('#ri-rm').onclick = () => {
    imgDlg.close();
    restore();
    selectNode(editingImg);
    exec('delete');
  };
  q('#ri-cancel').onclick = () => {
    imgDlg.close();
    restore();
  };

  /** Insere arquivos colados ou arrastados, um depois do outro. */
  async function insertFiles(files) {
    for (const f of files) {
      try {
        insertImage(imgHtml(await prepareFile(f), ''));
      } catch (e) {
        toast('Não foi possível ler essa imagem');
      }
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
      const a = b.dataset.i;
      if (a === 'up' || a === 'down') moveImage(selectedImg, a);
      else if (a === 'edit') {
        restore();
        openImageDialog();
      } else {
        selectNode(selectedImg);
        exec('delete');
      }
    };
  });

  // ---------- teclado, cliques, colar e arrastar ----------
  const SHORTCUTS = { b: 'bold', i: 'italic', u: 'underline' };
  root.addEventListener('keydown', (e) => {
    if (selectedImg && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      moveImage(selectedImg, e.key === 'ArrowUp' ? 'up' : 'down');
      return;
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
    if (e.target.tagName === 'IMG') {
      selectNode(e.target);
      selectImg(e.target);
      syncState(); // o navegador pode já ter selecionado a imagem, e aí não avisa que a seleção mudou
    }
  });
  root.addEventListener('dblclick', (e) => {
    if (e.target.tagName === 'IMG') {
      selectNode(e.target);
      selectImg(e.target);
      openImageDialog();
    }
  });
  root.addEventListener('paste', (e) => {
    const cd = e.clipboardData;
    if (!cd) return;
    e.preventDefault();
    const files = [...cd.files].filter((f) => f.type.startsWith('image/'));
    const html = cd.getData('text/html');
    const doc = html ? new DOMParser().parseFromString(html, 'text/html') : null;
    const text = doc ? htmlToMd(doc.body) : '';
    if (text) {
      if ([...doc.images].some((im) => !/^https?:\/\//i.test(im.getAttribute('src') || '')))
        toast('Algumas imagens não puderam ser coladas. Insira-as pelo botão de imagem.');
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
    if (e.target.tagName !== 'IMG') return;
    draggedImg = e.target;
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
