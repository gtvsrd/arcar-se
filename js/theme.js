/**
 * Tema claro/escuro: aplica a preferência salva (ou a do sistema) e liga o botão do header.
 * Carregado no <head> (sem defer) para evitar o "flash" do tema errado ao abrir a página.
 */

const THEME_KEY = 'blog_theme';
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

/** Lê o tema salvo ('light' | 'dark'), ou null se o usuário nunca escolheu. */
function getSavedTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch (e) {
    return null;
  }
}

/** Tema em uso agora: o escolhido pelo usuário ou, se não houver, o do sistema. */
function currentTheme() {
  return getSavedTheme() || (darkQuery.matches ? 'dark' : 'light');
}

/** Aplica o tema na página (atributo data-theme no <html>) e atualiza o botão. */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeButton(theme);
}

/** Atualiza o ícone (lua = ir para o escuro, sol = ir para o claro) e o rótulo de acessibilidade do botão. */
function updateThemeButton(theme) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const toDark = theme === 'light';
  const sun =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const moon =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  btn.innerHTML = toDark ? moon : sun;
  btn.setAttribute('aria-label', toDark ? 'Mudar para o tema escuro' : 'Mudar para o tema claro');
  btn.title = btn.getAttribute('aria-label');
}

/** Alterna entre claro e escuro e salva a escolha. */
function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (e) {}
  applyTheme(next);
}

/** Liga o botão do header. Chamado pelo main.js depois que a página carregou. */
function initThemeToggle() {
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  // Se o usuário nunca escolheu, acompanha mudanças do tema do sistema
  darkQuery.addEventListener('change', () => {
    if (!getSavedTheme()) applyTheme(currentTheme());
  });
  updateThemeButton(currentTheme());
}

// Aplica já na leitura do <head>, antes de a página aparecer
document.documentElement.setAttribute('data-theme', currentTheme());
