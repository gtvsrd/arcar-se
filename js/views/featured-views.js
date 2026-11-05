/**
 * Destaques da página inicial: carrossel de até 5 artigos, acima da grade de cards
 */

const HERO_MAX = 5; // máximo de artigos em destaque
const HERO_INTERVAL = 10000; // troca automática a cada 10 segundos
let heroTimer = null;

const CHEVRON = (d) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

/** HTML da seção de destaques. Devolve texto vazio se não houver nenhum (a seção some da tela). */
function featuredHTML(list) {
  if (!list.length) return '';
  const nav = list.length > 1;
  return `<section class="hero" aria-roledescription="carousel" aria-label="Artigos em destaque">
    <div class="hero-stage">
      <div class="hero-viewport"><div class="hero-track">${list
        .map(
          (p, i) =>
            `<div class="hero-slide" role="group" aria-roledescription="slide" aria-label="${i + 1} de ${list.length}">${cardHTML(p, true)}</div>`,
        )
        .join('')}</div></div>
      ${
        nav
          ? `<button type="button" class="hero-nav prev" aria-label="Destaque anterior">${CHEVRON('M15 5l-7 7 7 7')}</button>
             <button type="button" class="hero-nav next" aria-label="Próximo destaque">${CHEVRON('M9 5l7 7-7 7')}</button>`
          : ''
      }
    </div>
    ${
      nav
        ? `<div class="hero-dots">${list
            .map((p, i) =>
                `<button type="button" class="hero-dot${i ? '' : ' on'}" aria-label="Ir para o destaque ${i + 1}" aria-current="${i === 0}"></button>`,
            )
            .join('')}</div>`
        : ''
    }
  </section>`;
}

/** Para a troca automática (chamado ao sair da página inicial). */
function stopCarousel() {
  clearInterval(heroTimer);
  heroTimer = null;
}

/** Liga o carrossel: setas, bolinhas, deslize no celular e troca automática. */
function initCarousel() {
  stopCarousel();
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const track = hero.querySelector('.hero-track');
  const slides = [...hero.querySelectorAll('.hero-slide')];
  const dots = [...hero.querySelectorAll('.hero-dot')];
  const n = slides.length;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cur = 0;
  let paused = false;

  /** Vai para o destaque i. Passou do fim volta ao início, e antes do início vai ao último. */
  const go = (i) => {
    cur = (i + n) % n;
    track.style.transform = `translateX(-${cur * 100}%)`;
    slides.forEach((s, k) => {
      s.inert = k !== cur; // links do card escondido não recebem foco
      s.setAttribute('aria-hidden', String(k !== cur));
    });
    dots.forEach((d, k) => {
      d.classList.toggle('on', k === cur);
      d.setAttribute('aria-current', String(k === cur));
    });
  };

  /** Reinicia a contagem dos 10 segundos (usado após cada troca manual). */
  const restart = () => {
    clearInterval(heroTimer);
    if (n > 1 && !reduceMotion) {
      heroTimer = setInterval(() => {
        if (!paused && !document.hidden) go(cur + 1);
      }, HERO_INTERVAL);
    }
  };

  const manual = (i) => {
    go(i);
    restart();
  };
  hero.querySelector('.prev')?.addEventListener('click', () => manual(cur - 1));
  hero.querySelector('.next')?.addEventListener('click', () => manual(cur + 1));
  dots.forEach((d, k) => d.addEventListener('click', () => manual(k)));

  // pausa enquanto o mouse ou o foco do teclado estão sobre os destaques
  hero.addEventListener('mouseenter', () => (paused = true));
  hero.addEventListener('mouseleave', () => (paused = false));
  hero.addEventListener('focusin', () => (paused = true));
  hero.addEventListener('focusout', () => (paused = false));

  // deslizar o dedo no celular
  let x0 = 0;
  hero.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
  hero.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) manual(cur + (dx < 0 ? 1 : -1));
  });

  go(0);
  restart();
}
