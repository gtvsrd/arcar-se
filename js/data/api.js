/**
 * Acesso aos dados (Supabase): artigos, páginas, imagens de capa e login do administrador.
 * As telas leem o cache em memória `db`; toda alteração passa por aqui e recarrega o cache.
 */

/** Verdadeiro se js/config.js já foi preenchido. */
const isConfigured = () => !SUPABASE_URL.includes('SEU-PROJETO') && !SUPABASE_ANON_KEY.includes('SUA-CHAVE');

const sb = isConfigured() ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
let db = { posts: [], pages: {}, profiles: {}, views: {} }; // cache usado pelas telas
let admin = false; // true se o administrador está logado
let creator = false; // true se um criador (colaborador) está logado
let me = null; // { id, email } do usuário da equipe logado
let builtSlugs = new Set(); // artigos que já têm página própria gerada (post/<slug>/), lida de post/manifest.json

/** Admin ou criador logado. */
const staff = () => admin || creator;

/** O usuário atual pode editar/excluir este artigo? Admin em todos; criador só nos que ele mesmo criou. */
const canEdit = (p) => admin || (creator && !!me && p.author_id === me.id);

/** Artigos que o usuário atual pode ver (admin vê tudo; criador vê os publicados e os próprios), do mais novo ao mais antigo. */
const visible = () =>
  db.posts
    .filter((p) => p.pub || admin || (creator && !!me && p.author_id === me.id))
    .sort((a, b) => b.date.localeCompare(a.date));

/** Situação do artigo: 'published', 'review' (enviado ao admin), 'returned' (devolvido com observação) ou 'draft'. */
const postStatus = (p) => (p.pub ? 'published' : p.submitted ? 'review' : p.review_note ? 'returned' : 'draft');

/** Carrega artigos, páginas, perfis e visualizações do banco para o cache (perfis e visualizações são opcionais). */
async function loadAll() {
  const [p, g, pr, v] = await Promise.all([
    sb.from('posts').select('*').order('date', { ascending: false }),
    sb.from('pages').select('*'),
    sb.from('profiles').select('*'),
    sb.from('post_views').select('*'),
  ]);
  if (p.error || g.error) throw p.error || g.error;
  db.posts = p.data;
  db.pages = {};
  g.data.forEach((x) => (db.pages[x.slug] = { title: x.title, body: x.body }));
  db.profiles = {};
  (pr.data || []).forEach((x) => (db.profiles[x.user_id] = x));
  db.viewsOn = !v.error; // false se o SQL do contador ainda não foi aplicado
  db.views = {};
  (v.data || []).forEach((x) => (db.views[x.post_id] = Number(x.views)));
}

/** Perfil (nome e foto) do autor de um artigo, ou null. */
const authorOf = (p) => {
  const a = p.author_id && db.profiles[p.author_id];
  return a && a.display_name ? a : null;
};

/** Total de visualizações de um artigo. */
const viewsOf = (p) => db.views[p.id] || 0;

/** Soma uma visualização (no máximo 1 por visitante a cada 24h; equipe logada não conta). Devolve o novo total ou null. */
async function registerView(p) {
  if (!p.pub || staff()) return null;
  const key = 'arcar:view:' + p.slug;
  try {
    const t = Number(localStorage.getItem(key));
    if (t && Date.now() - t < 864e5) return null;
  } catch (e) {}
  const { data, error } = await sb.rpc('register_view', { p_slug: p.slug });
  if (error) return null;
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch (e) {}
  db.views[p.id] = Number(data);
  return Number(data);
}

/** Endereço de leitura de um artigo: a página própria (visitantes, se já gerada) ou a rota do app. */
const postUrl = (p) => (!staff() && builtSlugs.has(p.slug) ? `post/${p.slug}/` : `#/post/${p.slug || p.id}`);

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

/** Confere se há sessão ativa e qual o papel do usuário: 'admin', 'creator' ou nenhum. */
async function checkRole() {
  admin = creator = false;
  me = null;
  const { data } = await sb.auth.getSession();
  if (!data.session) return;
  const role = (await sb.rpc('my_role')).data;
  admin = role === 'admin';
  creator = role === 'creator';
  if (admin || creator) me = { id: data.session.user.id, email: data.session.user.email };
}

/** Entra com e-mail e senha. Retorna 'admin', 'creator', 'semacesso' (conta sem permissão) ou null (senha errada). */
async function login(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return null;
  await checkRole();
  if (!staff()) {
    await sb.auth.signOut();
    return 'semacesso';
  }
  await loadAll();
  return admin ? 'admin' : 'creator';
}

/** Primeiro acesso de um criador: cria a conta (o Supabase envia um e-mail de confirmação). Só vale para e-mails liberados pelo admin. */
async function firstAccess(email, password) {
  const { error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) throw error;
}

/** Sai da conta e recarrega os dados públicos. */
async function logout() {
  await sb.auth.signOut();
  admin = creator = false;
  me = null;
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

/** Salva nome de exibição e foto do usuário logado. */
async function saveProfile(display_name, avatar_url) {
  const { error } = await sb.from('profiles').upsert({ user_id: me.id, display_name, avatar_url });
  if (error) throw error;
  await loadAll();
}

/** Envia a foto de perfil (Blob quadrado) e devolve o endereço público. */
async function uploadAvatar(blob) {
  const path = `avatars/${me.id}-${Date.now()}.jpg`;
  const { error } = await sb.storage
    .from('covers')
    .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error;
  return sb.storage.from('covers').getPublicUrl(path).data.publicUrl;
}

/** Equipe (só admin): administradores, criadores e convites pendentes. */
async function loadTeam() {
  const { data, error } = await sb.rpc('team');
  if (error) throw error;
  return data;
}
/** Libera um e-mail como criador. Retorna 'ativo', 'convidado' ou 'admin'. */
async function inviteCreator(email) {
  const { data, error } = await sb.rpc('invite_creator', { p_email: email });
  if (error) throw error;
  return data;
}
/** Tira o acesso de um criador. */
async function removeCreator(userId) {
  const { error } = await sb.rpc('remove_creator', { p_user: userId });
  if (error) throw error;
}
/** Cancela um convite ainda não usado. */
async function cancelInvite(email) {
  const { error } = await sb.rpc('cancel_invite', { p_email: email });
  if (error) throw error;
}

/** Troca a senha do usuário logado. */
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
