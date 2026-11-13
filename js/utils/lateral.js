/**
 * Modo leitura (só em telas grandes): a coluna lateral recolhe e a coluna principal ocupa o lugar das duas.
 * As caixas da lateral viram botões com ícone, empilhados à direita; cada um abre a sua caixa ao lado.
 * O botão com a seta, acima das caixas, recolhe e mostra a coluna. Não fica guardado: toda página que abre
 * (ou recarrega) começa com as duas colunas; dentro do app, a escolha vale enquanto a pessoa navega por ele.
 *
 * Os cliques são ouvidos no documento: funciona mesmo quando o app redesenha a lateral.
 * O visual fica em css/layout.css (procure por "Modo leitura").
 */
(function () {
  const raiz = document.documentElement;
  const telaGrande = window.matchMedia('(min-width: 821px)');
  const reduz = window.matchMedia('(prefers-reduced-motion: reduce)');

  const recolhida = () => raiz.classList.contains('lado-recolhido') && telaGrande.matches;
  const fecharCaixas = () =>
    document.querySelectorAll('#side .box.aberta').forEach((b) => {
      b.classList.remove('aberta');
      b.querySelector('.side-btn')?.setAttribute('aria-expanded', 'false');
    });

  function alternar() {
    const trocar = () => {
      fecharCaixas();
      raiz.classList.toggle('lado-recolhido');
    };
    // a coluna principal estica (ou volta) deslizando, em vez de pular
    if (document.startViewTransition && !reduz.matches) document.startViewTransition(trocar);
    else trocar();
  }

  function abrir(box) {
    const jaAberta = box.classList.contains('aberta');
    fecharCaixas();
    if (jaAberta) return;
    box.classList.add('aberta');
    box.querySelector('.side-btn').setAttribute('aria-expanded', 'true');
    box.querySelector('.box-conteudo input')?.focus(); // Buscar: já pode digitar
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('.side-toggle')) return alternar();
    const btn = e.target.closest('#side .side-btn');
    if (btn && recolhida()) return abrir(btn.closest('.box'));
    if (!e.target.closest('#side .box.aberta')) fecharCaixas(); // clique fora fecha a caixa aberta
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const aberta = document.querySelector('#side .box.aberta');
    if (!aberta) return;
    fecharCaixas();
    aberta.querySelector('.side-btn').focus();
  });
  telaGrande.addEventListener('change', fecharCaixas); // ao estreitar a janela, tudo volta ao normal
  window.addEventListener('hashchange', fecharCaixas);
})();
