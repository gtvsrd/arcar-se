/**
 * Título flutuante (só no celular, só nas páginas dos artigos): quando o título do artigo sai da tela ao rolar,
 * uma faixa fina fica fixa no topo com o título (numa linha só) e um filete que mostra quanto do texto já foi lido.
 * Tocar na faixa volta ao começo do artigo. Visual em css/layout.css (procure por "Título flutuante").
 * Funciona no app e nas páginas geradas: ouve a rolagem no documento e procura o título a cada vez.
 */
(function () {
  const celular = window.matchMedia('(max-width: 820px)');
  let faixa = null;

  function criar() {
    faixa = document.createElement('button');
    faixa.type = 'button';
    faixa.className = 'titulo-flut';
    faixa.setAttribute('aria-hidden', 'true');
    faixa.tabIndex = -1;
    faixa.innerHTML = '<span class="tf-txt"></span><span class="tf-prog"></span>';
    faixa.addEventListener('click', () => {
      const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduz ? 'auto' : 'smooth' });
    });
    document.body.appendChild(faixa);
  }

  let agendado = false;
  function atualizar() {
    agendado = false;
    const h1 = document.body.classList.contains('pagina-artigo') && celular.matches ? document.querySelector('#main .art > h1') : null;
    const art = h1 && h1.parentElement;
    const mostrar = !!h1 && h1.getBoundingClientRect().bottom < 0;
    if (!mostrar) return faixa?.classList.remove('visivel');
    if (!faixa) criar();
    const txt = faixa.firstChild;
    if (txt.textContent !== h1.textContent) txt.textContent = h1.textContent;
    const r = art.getBoundingClientRect();
    const lido = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
    faixa.style.setProperty('--lido', lido.toFixed(4));
    faixa.classList.add('visivel');
  }
  const pedir = () => {
    if (!agendado) {
      agendado = true;
      requestAnimationFrame(atualizar);
    }
  };
  addEventListener('scroll', pedir, { passive: true });
  addEventListener('resize', pedir);
  addEventListener('hashchange', () => setTimeout(pedir, 0));
  celular.addEventListener('change', pedir);
})();
