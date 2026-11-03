/**
 * Acesso aos dados (Supabase): artigos, páginas, imagens de capa e login do administrador.
 * As telas leem o cache em memória `db`; toda alteração passa por aqui e recarrega o cache.
 */

/** Verdadeiro se js/config.js já foi preenchido. */
const isConfigured = () => !SUPABASE_URL.includes('SEU-PROJETO') && !SUPABASE_ANON_KEY.includes('SUA-CHAVE');

const sb = isConfigured() ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
let db = { posts: [], pages: {} }; // cache usado pelas telas
let admin = false; // true se o administrador está logado
let builtSlugs = new Set(); // artigos que já têm página própria gerada (post/<slug>/), lida de post/manifest.json

/** Artigos que o usuário atual pode ver (admin vê rascunhos), do mais novo ao mais antigo. */
const visible = () => db.posts.filter((p) => admin || p.pub).sort((a, b) => b.date.localeCompare(a.date));

/** Carrega artigos e páginas do banco para o cache. */
async function loadAll() {
  const [p, g] = await Promise.all([
    sb.from('posts').select('*').order('date', { ascending: false }),
    sb.from('pages').select('*'),
  ]);
  if (p.error || g.error) throw p.error || g.error;
  db.posts = p.data;
  db.pages = {};
  g.data.forEach((x) => (db.pages[x.slug] = { title: x.title, body: x.body }));
}

/** Endereço de leitura de um artigo: a página própria (visitantes, se já gerada) ou a rota do app. */
const postUrl = (p) => (!admin && builtSlugs.has(p.slug) ? `post/${p.slug}/` : `#/post/${p.slug || p.id}`);

/** Acha um artigo pelo slug ou, nos links antigos, pelo id. */
const findPost = (key) => db.posts.find((p) => p.slug === key || p.id === key);

/** Devolve um slug livre: `base`, ou `base-2`, `base-3`… se já existir em outro artigo. */
function uniqueSlug(base, ownId) {
  const taken = new Set(db.posts.filter((p) => p.id !== ownId).map((p) => p.slug));
  let s = base || 'artigo',
    n = 1;
  while (taken.has(s)) s = `${base || 'artigo'}-${++n}`;
  return s;
}

/** Lê a lista de páginas geradas pelo build. Se não existir (ex.: teste local), tudo continua pelo app. */
async function loadManifest() {
  try {
    const r = await fetch('post/manifest.json', { cache: 'no-cache' });
    const m = r.ok ? await r.json() : null;
    builtSlugs = new Set(Array.isArray(m && m.slugs) ? m.slugs : []);
  } catch (e) {
    builtSlugs = new Set();
  }
}

/** Confere se há sessão ativa e se o usuário é administrador. */
async function checkAdmin() {
  admin = false;
  const { data } = await sb.auth.getSession();
  if (data.session) admin = (await sb.rpc('is_admin')).data === true;
}

/** Entra com e-mail e senha. Retorna true só se for um administrador. */
async function login(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return false;
  await checkAdmin();
  if (!admin) {
    await sb.auth.signOut();
    return false;
  }
  await loadAll();
  return true;
}

/** Sai da conta e recarrega os dados públicos. */
async function logout() {
  await sb.auth.signOut();
  admin = false;
  await loadAll();
}

/** Cria (sem id) ou atualiza (com id) um artigo. */
async function savePost({ id, ...fields }) {
  const { error } = id ? await sb.from('posts').update(fields).eq('id', id) : await sb.from('posts').insert(fields);
  if (error) throw error;
  await loadAll();
}

/** Exclui um artigo. */
async function deletePost(id) {
  const { error } = await sb.from('posts').delete().eq('id', id);
  if (error) throw error;
  await loadAll();
}

/** Atualiza uma página fixa (Sobre, Contato). */
async function savePage(slug, title, body) {
  const { error } = await sb.from('pages').update({ title, body }).eq('slug', slug);
  if (error) throw error;
  await loadAll();
}

/** Troca a senha do administrador logado. */
async function changePassword(password) {
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw error;
}

/** Envia uma imagem (Blob) de capa ou do texto para o Storage e devolve o endereço público. */
async function uploadCover(blob) {
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await sb.storage
    .from('covers')
    .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error;
  return sb.storage.from('covers').getPublicUrl(path).data.publicUrl;
}

/** Apaga uma imagem do Storage (ignora endereços de outros sites). */
async function deleteCover(url) {
  const m = (url || '').match(/\/covers\/([^?]+)$/);
  if (m)
    await sb.storage
      .from('covers')
      .remove([m[1]])
      .catch(() => {});
}

/** Apaga do Storage as imagens da lista que nenhum artigo ou página usa mais. */
async function deleteUnusedImages(urls) {
  const inUse = new Set([
    ...db.posts.flatMap((p) => [p.img, ...mdImages(p.body)]),
    ...Object.values(db.pages).flatMap((g) => mdImages(g.body)),
  ]);
  await Promise.all(urls.filter((u) => u && !inUse.has(u)).map(deleteCover));
}
