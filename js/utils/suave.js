/**
 * Suavidade na tela: os elementos surgem com um esmaecer rápido (em sequência, não todos de uma vez),
 * as imagens aparecem aos poucos quando terminam de carregar e, quando algo muda de lugar porque
 * outra coisa carregou acima ou ao lado, o elemento desliza até a nova posição em vez de pular.
 *
 * Carregado no <head> (sem defer), antes das imagens: assim nenhuma "estoura" na tela.
 * O CSS das animações fica em css/base.css (procure por "Suavidade").
 */
(function () {
  const raiz = document.documentElement;
  const reduz = window.matchMedia('(prefers-reduced-motion: reduce)');
  const carregadas = new Set(); // imagens já carregadas: ao redesenhar a tela elas aparecem na hora
  const NOSSAS = ['img-ok', 'fixo']; // classes que este arquivo põe (ignoradas ao comparar elementos)
  const LISTAS = ['grid', 'writers']; // contêineres cujos itens entram e se movem um a um
  const PASSO_MAX = 10; // a fila de entrada para no 10º item (o resto entra junto com ele)

  raiz.classList.add('suave');

  /* ---------- imagens: esmaecem ao terminar de carregar ---------- */
  function marcar(img) {
    img.classList.add('img-ok');
    if (img.src) carregadas.add(img.src);
  }
  function aoCarregar(e) {
    if (e.target.tagName === 'IMG') marcar(e.target);
  }
  // na fase de captura: "load" e "error" de imagem não sobem pela página
  document.addEventListener('load', aoCarregar, true);
  document.addEventListener('error', aoCarregar, true); // imagem quebrada não fica invisível
  /** Mostra na hora as imagens que já estão prontas (do cache ou já vistas antes). */
  function imagensProntas(el) {
    el.querySelectorAll('img:not(.img-ok)').forEach((img) => {
      if (img.complete || carregadas.has(img.src)) marcar(img);
    });
  }
  window.addEventListener('load', () => imagensProntas(document)); // rede de segurança

  /* ---------- identidade dos elementos (para saber quem é quem ao redesenhar) ---------- */
  const slugDe = (href) => (href || '').replace(/^.*?#\/post\//, '').replace(/^(\.\.\/)*post\//, '').replace(/\/$/, '');
  const texto = (el, sel) => (el.querySelector(sel)?.textContent || '').trim();
  function chave(el) {
    if (el.nodeType !== 1) return null;
    if (el.dataset.k) return el.dataset.k;
    const c = el.classList;
    if (c.contains('card')) return 'card:' + slugDe(el.querySelector('h2 a')?.getAttribute('href'));
    if (c.contains('hero')) return 'hero';
    if (c.contains('writer')) return 'writer:' + texto(el, 'h2');
    if (c.contains('box')) return 'box:' + (texto(el, 'h3') || el.textContent.trim().slice(0, 60));
    if (c.contains('art')) return 'art:' + texto(el, 'h1');
    if (LISTAS.some((l) => c.contains(l))) return 'lista:' + el.className;
    if (/^H[1-3]$/.test(el.tagName)) return el.tagName + ':' + el.textContent.trim();
    return null;
  }
  const ehLista = (el) => LISTAS.some((l) => el.classList.contains(l));

  /** HTML do elemento sem as marcas desta suavidade (para comparar o antigo com o novo). */
  const inerte = document.createElement('template').content.ownerDocument; // aqui imagens não carregam
  function assinatura(el) {
    const c = inerte.importNode(el, true);
    [c, ...c.querySelectorAll('*')].forEach((x) => {
      if (x.classList.length) {
        x.classList.remove(...NOSSAS);
        if (!x.classList.length) x.removeAttribute('class');
      }
      if (x.style && x.style.getPropertyValue('--i')) {
        x.style.removeProperty('--i');
        if (!x.getAttribute('style')) x.removeAttribute('style');
      }
    });
    return c.outerHTML;
  }

  /** Elementos identificáveis de `alvo` (filhos diretos e itens das listas), pela chave. */
  function identificaveis(alvo, mapa = new Map()) {
    for (const el of alvo.children) {
      const k = chave(el);
      if (!k) continue;
      if (ehLista(el)) identificaveis(el, mapa);
      else if (!mapa.has(k)) mapa.set(k, el);
    }
    return mapa;
  }
  /** Posição na tela de cada um deles. */
  const posicoes = (alvo) => new Map([...identificaveis(alvo)].map(([k, el]) => [k, el.getBoundingClientRect()]));

  /**
   * Atualiza `v` para ficar igual a `n` mexendo só no que mudou: o elemento continua o mesmo
   * na tela (não pisca, não refaz a entrada, a imagem não recarrega).
   */
  function morfar(v, n) {
    if (v.nodeType !== n.nodeType || v.nodeName !== n.nodeName) return false;
    if (v.nodeType === 3 || v.nodeType === 8) {
      if (v.data !== n.data) v.data = n.data;
      return true;
    }
    if (v.nodeType !== 1) return false;
    const fila = v.style?.getPropertyValue('--i'); // lugar na fila de entrada (posto por aqui)
    const minhas = NOSSAS.filter((c) => v.classList.contains(c));
    for (const a of [...v.attributes]) if (!n.hasAttribute(a.name)) v.removeAttribute(a.name);
    for (const a of [...n.attributes]) if (v.getAttribute(a.name) !== a.value) v.setAttribute(a.name, a.value);
    if (minhas.length) v.classList.add(...minhas);
    if (fila) v.style.setProperty('--i', fila);
    const vs = [...v.childNodes],
      ns = [...n.childNodes];
    if (vs.length === ns.length && vs.every((c, i) => morfar(c, ns[i]))) return true;
    v.replaceChildren(...ns); // estrutura diferente aqui dentro: troca só este pedaço
    imagensProntas(v);
    return true;
  }
  const SUBSTITUI = ['hero']; // têm ouvintes ligados com addEventListener: trocados inteiros, não atualizados

  /**
   * Põe no `velho` os filhos de `novo`, aproveitando os elementos que não mudaram (não piscam
   * nem recarregam a imagem). Os que chegaram vão para `entram`; os que mudaram de conteúdo são
   * atualizados no lugar e os que precisam ser trocados inteiros herdam o ponto da animação do antigo (`herdam`), para não sair do compasso dos vizinhos.
   */
  function reconciliar(velho, novo, entram, herdam) {
    const antigos = new Map();
    for (const el of velho.children) {
      const k = chave(el);
      if (k && !antigos.has(k)) antigos.set(k, el);
    }
    const final = [];
    for (const n of [...novo.childNodes]) {
      const k = chave(n);
      const v = k && antigos.get(k);
      if (!v) {
        if (n.nodeType === 1) {
          if (ehLista(n)) entram.push(...n.children);
          else entram.push(n);
        }
        final.push(n);
        continue;
      }
      antigos.delete(k);
      if (ehLista(v) && ehLista(n)) {
        reconciliar(v, n, entram, herdam);
        final.push(v);
      } else if (assinatura(v) === assinatura(n)) {
        final.push(v); // igual: fica o mesmo elemento
      } else if (!SUBSTITUI.some((c) => v.classList.contains(c)) && morfar(v, n)) {
        final.push(v); // mudou um pouco: atualiza no lugar
      } else {
        const anim = v.getAnimations?.().find((a) => a.animationName === 'surgir');
        if (anim && anim.playState === 'running') herdam.push([n, anim.currentTime]);
        else n.classList.add('fixo'); // já tinha aparecido: só troca o conteúdo
        final.push(n);
      }
    }
    const ficam = new Set(final);
    for (const n of [...velho.childNodes]) if (!ficam.has(n)) n.remove();
    let ref = velho.firstChild;
    for (const n of final) {
      if (n === ref) {
        ref = ref.nextSibling;
        continue;
      }
      if (n.parentNode === velho) n.classList?.add('fixo'); // mudou de ordem: não refaz a entrada
      velho.insertBefore(n, ref);
    }
  }

  /** Quem continuou na tela mas mudou de lugar desliza da posição antiga para a nova. */
  function deslizar(alvo, antes, entram) {
    if (reduz.matches || !antes.size) return;
    identificaveis(alvo).forEach((el, k) => {
      const a = antes.get(k);
      if (!a || entram.has(el)) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !a.width) return;
      const dx = a.left - r.left,
        dy = a.top - r.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: 380,
        easing: 'cubic-bezier(.2, .7, .2, 1)',
      });
    });
  }

  /**
   * Troca o conteúdo de `alvo` (elemento ou seletor) pelo `html`, com suavidade.
   * Use no lugar de `alvo.innerHTML = html`.
   */
  window.trocar = function trocar(alvo, html) {
    if (typeof alvo === 'string') alvo = document.querySelector(alvo);
    if (!alvo) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const antes = posicoes(alvo);
    const entram = [],
      herdam = [];
    reconciliar(alvo, tpl.content, entram, herdam);
    // quem chega entra em fila, na ordem em que aparece
    entram.forEach((el, i) => el.style?.setProperty('--i', Math.min(i, PASSO_MAX)));
    herdam.forEach(([el, t]) =>
      el.getAnimations?.().forEach((a) => {
        if (a.animationName === 'surgir') a.currentTime = t;
      }),
    );
    imagensProntas(alvo);
    deslizar(alvo, antes, new Set(entram));
  };
})();
