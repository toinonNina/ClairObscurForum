// =====================================================================
//  Paris après la Fracture — forum RPG inspiré de Clair Obscur (sans build)
//  Site statique (GitHub Pages) + Supabase (PostgreSQL, comptes, sécurité)
// =====================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, FORUM_NAME, FORUM_TAGLINE } from './config.js';

const PAGE_SIZE_TOPICS = 25;
const PAGE_SIZE_POSTS = 20;

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const configured = !SUPABASE_URL.includes('VOTRE-PROJET') && !SUPABASE_ANON_KEY.includes('VOTRE-CLE');
const initialHash = location.hash;
const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const state = { session: null, profile: null };
const ROLE_LABEL = { admin: 'Administrateur', moderator: 'Gardien', member: 'Membre' };
// Factions de Paris après la Fracture (valeur enregistrée, groupe, icône, classe de couleur)
const FACTION_LIST = [
  { value: 'Peintres', group: 'Peintres — Les Architectes Visuels', icon: '🎨', key: 'peintres' },
  { value: 'Écrivains', group: 'Écrivains — Les Tisseurs du Réel', icon: '✒️', key: 'ecrivains' },
  { value: 'Musiciens — Healers', group: 'Musiciens — Les Neutres Fragmentés', icon: '✨', key: 'healers' },
  { value: 'Musiciens — Dreamers', group: 'Musiciens — Les Neutres Fragmentés', icon: '🌙', key: 'dreamers' },
  { value: 'Musiciens — Discordants', group: 'Musiciens — Les Neutres Fragmentés', icon: '🔥', key: 'discordants' },
  { value: 'Musiciens (sans culte)', group: 'Musiciens — Les Neutres Fragmentés', icon: '🎻', key: 'musiciens' },
  { value: 'Sans allégeance', group: 'Autres', icon: '◌', key: 'neutre' },
];
const FACTIONS = FACTION_LIST.map((f) => f.value);
const factionInfo = (v) => FACTION_LIST.find((f) => f.value === v) || { value: v, icon: '◌', key: 'neutre' };
const facClass = (v) => `fac fac-${factionInfo(v).key}`;
const factionBadge = (v) => `<span class="badge badge-faction ${facClass(v)}">${factionInfo(v).icon} ${esc(v)}</span>`;
// Couleur des territoires (zones RP) selon la faction qui les tient
const TERRITORY_FAC = { montmartre: 'peintres', 'quartier-latin': 'ecrivains', catacombes: 'musiciens', seine: 'ecrivains', fractures: 'discordants', reves: 'dreamers', evenements: 'healers' };
const STATUS_LABEL = { draft: 'Brouillon', pending: 'En attente de validation', approved: 'Validée', rejected: 'À retravailler', archived: 'Archivée' };
const CHAR_COLS = 'id,name,age,faction,occupation,avatar_url,quote,status,owner_id';

// Pétales rouges qui tombent en arrière-plan (animation légère, désactivée si l'appareil demande moins d'animations)
(function petals() {
  const box = document.querySelector('.petals');
  if (!box || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const count = innerWidth < 700 ? 18 : 40;   // nombre de pétales (moins sur mobile)
  const r = (a, b) => a + Math.random() * (b - a);
  let html = '';
  for (let i = 0; i < count; i++) {
    const d = r(11, 24);
    html += `<span class="petal" style="--x:${r(0, 100).toFixed(1)}vw;--s:${r(12, 24).toFixed(0)}px;--o:${r(.65, .95).toFixed(2)};--d:${d.toFixed(1)}s;--delay:${(-r(0, d)).toFixed(1)}s;--sway:${r(-12, 12).toFixed(1)}vw"></span>`;
  }
  box.innerHTML = html;
})();

document.getElementById('brand-name').textContent = FORUM_NAME;
document.getElementById('brand-tag').textContent = FORUM_TAGLINE;

// ---------------------------------------------------------------------
//  Outils
// ---------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (s) => DOMPurify.sanitize(marked.parse(String(s ?? ''), { breaks: true, gfm: true }));
const fmtDate = (d) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
const fmtDay = (d) => new Date(d).toLocaleDateString('fr-FR', { dateStyle: 'long' });
const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
function ago(d) {
  if (!d) return '—';
  const s = (new Date(d) - Date.now()) / 1000;
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [u, n] of units) if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), u);
  return 'à l’instant';
}
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const isStaff = () => !!state.profile && !state.profile.banned && ['moderator', 'admin'].includes(state.profile.role);
const isAdmin = () => !!state.profile && !state.profile.banned && state.profile.role === 'admin';
const canWrite = () => !!state.profile && !state.profile.banned;
const userLink = (p) => (p ? `<a class="user-link role-${esc(p.role || 'member')}" href="#/u/${encodeURIComponent(p.username)}">${esc(p.username)}</a>` : '<span class="muted">Membre supprimé</span>');

function initialAvatar(name, size = '') {
  const letter = (name || '?').charAt(0).toUpperCase();
  const hue = [...(name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return `<span class="avatar avatar-initial ${size}" style="--h:${hue}">${esc(letter)}</span>`;
}
// Cadrage d’une image : enregistré à la fin du lien, ex. « …/image.png#cadre=50,30,1.6 »
// (x % , y % = point à privilégier ; z = zoom). Aucun changement de base de données nécessaire.
function parseFrame(url) {
  const m = /#cadre=([\d.]+),([\d.]+),([\d.]+)$/.exec(url || '');
  return m ? { x: +m[1], y: +m[2], z: +m[3] } : { x: 50, y: 50, z: 1 };
}
const stripFrame = (url) => (url || '').replace(/#cadre=.*$/, '');
const frameStyle = (f) => `object-position:${f.x}% ${f.y}%;transform:scale(${f.z});transform-origin:${f.x}% ${f.y}%`;
const withFrame = (url, f) => (!url ? '' : (f.x === 50 && f.y === 50 && f.z === 1) ? url : `${url}#cadre=${Math.round(f.x)},${Math.round(f.y)},${f.z.toFixed(2)}`);

function avatar(p, size = '') {
  if (!p?.avatar_url) return initialAvatar(p?.username, size);
  const f = parseFrame(p.avatar_url);
  return `<span class="avatar avatar-frame ${size}"><img src="${esc(stripFrame(p.avatar_url))}" style="${frameStyle(f)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-name="${esc(p.username || '?')}"></span>`;
}
// Image cassée (lien mort, page web au lieu d’une image…) : on affiche l’initiale à la place
document.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement)) return;
  const frame = img.closest('.avatar-frame');
  if (!frame || frame.closest('.cropper')) return;
  const size = [...frame.classList].find((c) => ['xs', 'sm', 'lg', 'xl'].includes(c)) || '';
  frame.outerHTML = initialAvatar(img.dataset.name, size);
}, true);

// ---- Images : envoi depuis l’ordinateur (Supabase Storage) ou lien direct ----
const AVATAR_BUCKET = 'avatars';
const MAX_IMAGE_MB = 10;      // taille du fichier choisi ; il est réduit avant l’envoi
const MAX_IMAGE_SIDE = 1000;  // côté maximal après réduction (pixels)
function normalizeImageUrl(url) {
  let u = (url || '').trim();
  if (!u) return '';
  if (u.startsWith('http://')) u = 'https://' + u.slice(7);
  // Lien vers la page Imgur d’une image -> lien direct vers l’image
  const m = u.match(/^https:\/\/(?:www\.)?imgur\.com\/([A-Za-z0-9]{5,10})$/);
  if (m) u = `https://i.imgur.com/${m[1]}.png`;
  return u;
}
function checkImage(url, timeout = 10000) {
  return new Promise((resolve) => {
    const img = new Image();
    const t = setTimeout(() => resolve(false), timeout);
    img.referrerPolicy = 'no-referrer';
    img.onload = () => { clearTimeout(t); resolve(img.naturalWidth > 0); };
    img.onerror = () => { clearTimeout(t); resolve(false); };
    img.src = url;
  });
}
// Réduit une photo avant l’envoi (plus léger, plus rapide). Les GIF animés sont envoyés tels quels.
async function shrinkImage(file) {
  if (file.type === 'image/gif') return { blob: file, ext: 'gif', type: file.type };
  const bmp = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_IMAGE_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * ratio); c.height = Math.round(bmp.height * ratio);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((res) => c.toBlob(res, 'image/webp', 0.86));
  if (blob && blob.type === 'image/webp') return { blob, ext: 'webp', type: 'image/webp' };
  const jpg = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.86));
  return { blob: jpg, ext: 'jpg', type: 'image/jpeg' };
}
const BAD_IMAGE = 'Ce lien ne mène pas directement à une image. Sur l’image, faites clic droit › « Copier l’adresse de l’image », ou utilisez le bouton « Envoyer une image ».';
function imagePicker(current, name) {
  const base = stripFrame(current);
  const f = parseFrame(current);
  return `<div class="image-picker">
      <div class="cropper-wrap">
        <div class="cropper avatar-frame" data-cropper ${base ? '' : 'hidden'} title="Glissez pour choisir la zone à afficher">
          <img src="${esc(base)}" style="${frameStyle(f)}" alt="" referrerpolicy="no-referrer" draggable="false">
        </div>
        <span class="avatar xl avatar-initial" data-preview-empty style="--h:30" ${base ? 'hidden' : ''}>${esc((name || '?').charAt(0).toUpperCase())}</span>
        <div class="crop-controls" data-crop-controls ${base ? '' : 'hidden'}>
          <label class="zoom-label">🔍<input type="range" min="1" max="4" step="0.05" value="${f.z}" data-zoom aria-label="Zoom"></label>
          <button type="button" class="link small" data-recenter>Recentrer</button>
          <span class="small muted">Glissez l’image pour choisir la zone.</span>
        </div>
      </div>
      <input type="hidden" name="frame" value="${f.x},${f.y},${f.z}">
      <div class="image-picker-fields">
        <label class="btn btn-small btn-ghost file-btn">📁 Envoyer une image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-upload hidden></label>
        <span class="small muted">PNG, JPG, WEBP ou GIF. Les photos sont réduites automatiquement.</span>
        <label>… ou lien direct vers une image<input name="avatar_url" type="text" inputmode="url" value="${esc(base)}" placeholder="https://…/image.png"></label>
        <button type="button" class="link small" data-clear-image>Retirer l’image</button>
        <span class="small" data-image-status></span>
      </div>
    </div>`;
}
function wireImagePicker(root, kind) {
  const box = root.querySelector('.image-picker');
  if (!box) return;
  const input = box.querySelector('input[name=avatar_url]');
  const frameInput = box.querySelector('input[name=frame]');
  const crop = box.querySelector('[data-cropper]');
  const img = crop.querySelector('img');
  const controls = box.querySelector('[data-crop-controls]');
  const zoom = box.querySelector('[data-zoom]');
  const empty = box.querySelector('[data-preview-empty]');
  const status = box.querySelector('[data-image-status]');
  let f = (() => { const [x, y, z] = frameInput.value.split(',').map(Number); return { x, y, z }; })();
  const apply = () => { img.style.cssText = frameStyle(f); frameInput.value = `${f.x},${f.y},${f.z}`; zoom.value = f.z; };
  const setVisible = (on) => { crop.hidden = !on; controls.hidden = !on; empty.hidden = on; };

  // Glisser (souris ou doigt) pour déplacer le point à privilégier
  let drag = null;
  crop.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, f: { ...f } }; crop.setPointerCapture(e.pointerId); crop.classList.add('dragging'); });
  crop.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const size = crop.clientWidth || 1;
    const k = 100 / size / Math.max(1, f.z - 0.4); // sensibilité
    f.x = Math.min(100, Math.max(0, drag.f.x - (e.clientX - drag.x) * k));
    f.y = Math.min(100, Math.max(0, drag.f.y - (e.clientY - drag.y) * k));
    apply();
  });
  const end = () => { drag = null; crop.classList.remove('dragging'); };
  crop.addEventListener('pointerup', end); crop.addEventListener('pointercancel', end);
  crop.addEventListener('wheel', (e) => { e.preventDefault(); f.z = Math.min(4, Math.max(1, f.z - Math.sign(e.deltaY) * 0.1)); apply(); }, { passive: false });
  zoom.addEventListener('input', () => { f.z = Number(zoom.value); apply(); });
  box.querySelector('[data-recenter]').addEventListener('click', () => { f = { x: 50, y: 50, z: 1 }; apply(); });

  const show = async (url, reset = true) => {
    status.textContent = '';
    if (!url) { setVisible(false); return; }
    status.textContent = 'Vérification de l’image…'; status.className = 'small';
    const ok = await checkImage(url);
    status.textContent = ok ? '✓ Image trouvée. Glissez-la et zoomez pour la cadrer.' : BAD_IMAGE;
    status.className = 'small ' + (ok ? 'ok-text' : 'danger');
    if (ok) { img.src = url; if (reset) f = { x: 50, y: 50, z: 1 }; apply(); setVisible(true); }
  };
  input.addEventListener('change', () => { input.value = normalizeImageUrl(input.value); show(input.value); });
  box.querySelector('[data-clear-image]').addEventListener('click', () => { input.value = ''; show(''); });
  box.querySelector('[data-upload]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return toast(`Image trop lourde (${MAX_IMAGE_MB} Mo maximum).`, 'error');
    status.textContent = 'Préparation et envoi…'; status.className = 'small';
    try {
      const { blob, ext, type } = await shrinkImage(file);
      if (blob.size > 2 * 1024 * 1024) throw new Error('Image trop lourde après réduction (2 Mo maximum). Essayez une autre image.');
      const path = `${state.profile.id}/${kind}-${Date.now()}.${ext}`;
      const { error } = await sb.storage.from(AVATAR_BUCKET).upload(path, blob, { contentType: type, cacheControl: '31536000', upsert: false });
      if (error) throw error;
      input.value = sb.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
      await show(input.value);
      status.textContent = '✓ Image envoyée. Cadrez-la puis enregistrez.';
    } catch (err) {
      status.textContent = '';
      toast(/bucket not found/i.test(err.message || '') ? 'Le stockage d’images n’est pas encore activé : lancez le script supabase/avatars.sql dans Supabase.' : errMsg(err), 'error');
    }
    e.target.value = '';
  });
}
async function validImageOrNull(f) {
  const url = normalizeImageUrl(f.avatar_url.value);
  f.avatar_url.value = url;
  if (!url) return null;
  if (!url.startsWith('https://')) throw new Error('Le lien de l’image doit commencer par https://');
  if (!(await checkImage(url))) throw new Error(BAD_IMAGE);
  const [x, y, z] = (f.frame?.value || '50,50,1').split(',').map(Number);
  return withFrame(url, { x, y, z });
}
function roleBadge(p) {
  if (!p) return '';
  if (p.banned) return '<span class="badge badge-banned">Banni</span>';
  return `<span class="badge badge-${esc(p.role)}">${ROLE_LABEL[p.role] || ''}</span>`;
}

function charAvatar(c, size = '') {
  return avatar(c ? { username: c.name, avatar_url: c.avatar_url } : null, size);
}
const charLink = (c) => (c ? `<a class="char-link" href="#/perso/${c.id}">${esc(c.name)}</a>` : '<span class="muted">Personnage disparu</span>');
const statusBadge = (st) => `<span class="badge badge-st-${esc(st)}">${STATUS_LABEL[st] || esc(st)}</span>`;
async function myApprovedCharacters() {
  if (!state.profile) return [];
  return q(sb.from('characters').select(CHAR_COLS).eq('owner_id', state.profile.id).eq('status', 'approved').order('name'));
}
function identitySelect(chars) {
  const opts = chars.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`);
  if (isStaff()) opts.push('<option value="">🎭 Narrateur (équipe)</option>');
  return `<label>Vous écrivez en tant que<select name="character" required>${opts.join('')}</select></label>`;
}
const needCharacter = `<div class="card empty small">Pour écrire dans les zones RP, il vous faut un <b>personnage validé</b>.
  <a href="#/fiche/nouvelle">Créer ma fiche</a> · <a href="#/univers/creer-un-personnage">Comment faire ?</a></div>`;

const ERRORS = [
  [/Invalid login credentials/i, 'Adresse e-mail ou mot de passe incorrect.'],
  [/Email not confirmed/i, 'Votre adresse e-mail n’est pas encore confirmée. Vérifiez votre boîte de réception.'],
  [/User already registered/i, 'Un compte existe déjà avec cette adresse e-mail.'],
  [/Password should be at least/i, 'Le mot de passe doit contenir au moins 6 caractères.'],
  [/row-level security/i, 'Action non autorisée (sujet verrouillé, compte banni ou droits insuffisants).'],
  [/duplicate key.*username/i, 'Ce pseudo est déjà pris.'],
  [/duplicate key/i, 'Cet élément existe déjà.'],
  [/violates check constraint/i, 'Une des valeurs saisies n’est pas valide (longueur ou format).'],
  [/rate limit/i, 'Trop de tentatives. Patientez quelques minutes.'],
  [/Failed to fetch|NetworkError/i, 'Impossible de joindre le serveur. Vérifiez votre connexion.'],
];
function errMsg(e) {
  const m = e?.message || String(e);
  for (const [re, fr] of ERRORS) if (re.test(m)) return fr;
  return m;
}
function toast(msg, kind = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = msg;
  document.getElementById('toasts').append(el);
  setTimeout(() => el.classList.add('out'), 4200);
  setTimeout(() => el.remove(), 4800);
}
const fail = (e) => toast(errMsg(e), 'error');
async function q(promise) {
  const { data, error, count } = await promise;
  if (error) throw error;
  return count !== undefined && count !== null ? { data, count } : data;
}
const go = (hash) => { location.hash = hash; };
const setTitle = (t) => { document.title = (state.unread ? `(${state.unread}) ` : '') + (t ? `${t} — ${FORUM_NAME}` : `${FORUM_NAME} — Forum RPG`); };

function pager(base, page, total, size) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return '';
  const items = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 2) items.push(i === page ? `<span class="current">${i}</span>` : `<a href="${base}/${i}">${i}</a>`);
    else if (items[items.length - 1] !== '…') items.push('…');
  }
  return `<nav class="pager" aria-label="Pages">${items.join('')}</nav>`;
}

function modal(title, bodyHtml) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal card" role="dialog" aria-modal="true"><h3>${esc(title)}</h3>${bodyHtml}</div>`;
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) wrap.remove(); });
  document.body.append(wrap);
  wrap.querySelector('input,textarea,select,button')?.focus();
  return wrap;
}

const editorToolbar = `
  <div class="toolbar" role="toolbar" aria-label="Mise en forme">
    <button type="button" data-md="**¦**" title="Gras"><b>G</b></button>
    <button type="button" data-md="_¦_" title="Italique"><i>I</i></button>
    <button type="button" data-md="> ¦" title="Citation">❝</button>
    <button type="button" data-md="[¦](https://)" title="Lien">🔗</button>
    <button type="button" data-md="![image](¦)" title="Image (URL)">🖼</button>
    <button type="button" data-md="||¦||" title="Spoiler">Spoiler</button>
    <button type="button" data-preview title="Aperçu">Aperçu</button>
  </div>`;
function wireEditor(root) {
  root.querySelectorAll('.editor').forEach((ed) => {
    const ta = ed.querySelector('textarea');
    const prev = ed.querySelector('.preview');
    ed.querySelectorAll('[data-md]').forEach((b) => b.addEventListener('click', () => {
      const [before, after] = b.dataset.md.split('¦');
      const { selectionStart: s, selectionEnd: e, value } = ta;
      ta.value = value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e);
      ta.focus();
      ta.selectionStart = s + before.length;
      ta.selectionEnd = e + before.length;
    }));
    ed.querySelector('[data-preview]')?.addEventListener('click', () => {
      prev.hidden = !prev.hidden;
      if (!prev.hidden) prev.innerHTML = renderContent(ta.value) || '<p class="muted">Rien à afficher.</p>';
    });
  });
}
const editor = (name, value = '', placeholder = 'Votre message… (Markdown accepté, ||texte|| pour un spoiler)') => `
  <div class="editor">${editorToolbar}
    <textarea name="${name}" rows="8" required maxlength="20000" placeholder="${esc(placeholder)}">${esc(value)}</textarea>
    <div class="preview post-body" hidden></div>
  </div>`;

// Contenu des messages : Markdown nettoyé + balises spoiler ||…||
function renderContent(text) {
  const html = md(text);
  return html.replace(/\|\|([\s\S]+?)\|\|/g, '<span class="spoiler" tabindex="0" title="Cliquer pour révéler">$1</span>');
}
document.addEventListener('click', (e) => {
  const sp = e.target.closest('.spoiler');
  if (sp) sp.classList.add('revealed');
});

// ---------------------------------------------------------------------
//  Session & navigation
// ---------------------------------------------------------------------
async function loadProfile() {
  state.profile = null;
  if (!state.session) return;
  const { data } = await sb.from('profiles').select('*').eq('id', state.session.user.id).maybeSingle();
  state.profile = data;
}

function renderNav() {
  const p = state.profile;
  let html = configured ? `<a href="#/">Accueil</a><a href="#/univers">Univers</a><a href="#/personnages">Personnages</a><a href="#/membres">Membres</a>` : '';
  if (p) {
    html += `<a href="#/messages" class="nav-mail" title="Messagerie privée">✉ Messages<span id="unread-count"></span></a>`;
    if (isStaff()) html += `<a href="#/moderation" class="nav-mod">Modération<span id="report-count"></span></a>`;
    html += `<a href="#/u/${encodeURIComponent(p.username)}" class="nav-user">${avatar(p, 'xs')}<span>${esc(p.username)}</span></a>
             <a href="#/parametres" title="Paramètres">⚙</a>
             <button class="link" id="logout">Déconnexion</button>`;
  } else if (state.session) {
    html += `<button class="link" id="logout">Déconnexion</button>`;
  } else {
    html += `<a href="#/connexion">Connexion</a><a href="#/inscription" class="btn btn-small">Rejoindre</a>`;
  }
  const light = document.documentElement.dataset.theme === 'light';
  html += `<button class="theme-toggle" id="theme-toggle" title="${light ? 'Passer au thème sombre' : 'Passer au thème clair'}" aria-label="${light ? 'Passer au thème sombre' : 'Passer au thème clair'}">${light ? '☾' : '☀'}</button>`;
  nav.innerHTML = html;
  nav.querySelector('#theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.classList.add('theme-anim');
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) { /* navigation privée */ }
    setTimeout(() => document.documentElement.classList.remove('theme-anim'), 400);
    renderNav();
  });
  nav.querySelector('#logout')?.addEventListener('click', async () => { await sb.auth.signOut(); toast('À bientôt, expéditionnaire.'); go('#/'); });
  if (p) refreshUnread();
  if (isStaff()) {
    sb.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open').then(({ count }) => {
      const el = document.getElementById('report-count');
      if (el && count) el.innerHTML = ` <span class="pill">${count}</span>`;
    });
    sb.from('characters').select('id', { count: 'exact', head: true }).eq('status', 'pending').then(({ count }) => {
      const el = document.getElementById('report-count');
      if (el && count) el.insertAdjacentHTML('beforeend', ` <span class="pill pill-gold" title="Fiches à valider">${count}</span>`);
    });
  }
}

document.getElementById('header-search').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = e.target.q.value.trim();
  if (v) go(`#/recherche?q=${encodeURIComponent(v)}`);
});

const routes = [
  [/^\/$/, viewHome],
  [/^\/c\/([^/]+)(?:\/(\d+))?$/, viewCategory],
  [/^\/t\/(\d+)(?:\/(\d+|fin))?$/, viewTopic],
  [/^\/nouveau\/([^/]+)$/, viewNewTopic],
  [/^\/connexion$/, viewLogin],
  [/^\/inscription$/, viewSignup],
  [/^\/oubli$/, viewForgot],
  [/^\/reinitialiser$/, viewReset],
  [/^\/u\/([^/]+)$/, viewProfile],
  [/^\/parametres$/, viewSettings],
  [/^\/membres(?:\/(\d+))?$/, viewMembers],
  [/^\/recherche$/, viewSearch],
  [/^\/moderation(?:\/(\w+))?$/, viewModeration],
  [/^\/regles$/, viewRules],
  [/^\/messages$/, viewInbox],
  [/^\/messages\/nouveau$/, viewCompose],
  [/^\/messages\/(\d+)$/, viewConversation],
  [/^\/univers$/, viewWikiIndex],
  [/^\/univers\/([a-z0-9-]+)$/, viewWikiPage],
  [/^\/univers\/([a-z0-9-]+)\/modifier$/, viewWikiEdit],
  [/^\/nouvelle-page$/, viewWikiEdit],
  [/^\/personnages(?:\/([^/]+))?$/, viewCharacters],
  [/^\/perso\/(\d+)$/, viewCharacter],
  [/^\/fiche\/nouvelle$/, viewCharacterForm],
  [/^\/fiche\/(\d+)\/modifier$/, viewCharacterForm],
];

let navToken = 0;
async function router() {
  if (!configured) return viewSetup();
  const raw = location.hash.replace(/^#/, '') || '/';
  if (raw.startsWith('access_token') || raw.startsWith('error')) return; // retour d'e-mail géré par Supabase
  const [path, qs] = raw.split('?');
  const params = new URLSearchParams(qs || '');
  const token = ++navToken;
  renderNav();
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (!m) continue;
    app.innerHTML = '<p class="loading">Chargement…</p>';
    try {
      const html = await fn(m.slice(1).map((x) => (x === undefined ? undefined : decodeURIComponent(x))), params);
      if (token !== navToken) return;
      if (typeof html === 'string') app.innerHTML = html;
      fn.after?.(app, m.slice(1), params);
    } catch (e) {
      console.error(e);
      if (token === navToken) app.innerHTML = `<div class="card empty"><h2>Un voile d’obscurité…</h2><p>${esc(errMsg(e))}</p><p><a href="#/">Retour à l’accueil</a></p></div>`;
    }
    window.scrollTo(0, 0);
    return;
  }
  setTitle('Introuvable');
  app.innerHTML = `<div class="card empty"><h2>Cette page a été gommée</h2><p>Elle n’existe pas ou plus.</p><p><a href="#/" class="btn">Retour à l’accueil</a></p></div>`;
}

function requireLogin() {
  if (!state.session) {
    return `<div class="card empty"><h2>Réservé aux membres</h2><p>Connectez-vous pour accéder à cette page.</p>
      <p><a class="btn" href="#/connexion">Connexion</a> <a class="btn btn-ghost" href="#/inscription">Créer un compte</a></p></div>`;
  }
  return null;
}

// ---------------------------------------------------------------------
//  Pages
// ---------------------------------------------------------------------
function viewSetup() {
  setTitle('Configuration');
  app.innerHTML = `<div class="card prose">
    <h2>Presque prêt !</h2>
    <p>Le site est en ligne mais n’est pas encore relié à sa base de données.</p>
    <ol>
      <li>Créez un projet gratuit sur <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a>.</li>
      <li>Dans <b>SQL Editor</b>, collez et exécutez le fichier <code>supabase/schema.sql</code>.</li>
      <li>Copiez l’<b>URL du projet</b> et la <b>clé anon / publishable</b> dans <code>js/config.js</code>.</li>
    </ol>
    <p>Le guide complet est dans le fichier <code>README.md</code> du dépôt.</p></div>`;
}

async function viewHome() {
  setTitle('');
  const since24 = new Date(Date.now() - 864e5).toISOString();
  const [cats, recentTopics, members, topics, posts, chars, newChars, news, newest, online, facRes] = await Promise.all([
    q(sb.from('category_stats').select('*').order('position')),
    q(sb.from('topics').select('id,title,category_id,post_count,last_post_at,last:profiles!topics_last_post_author_fkey(username,role,avatar_url)').order('last_post_at', { ascending: false }).limit(300)),
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('topics').select('id', { count: 'exact', head: true }),
    sb.from('posts').select('id', { count: 'exact', head: true }),
    sb.from('characters').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    q(sb.from('characters').select(CHAR_COLS).eq('status', 'approved').order('validated_at', { ascending: false }).limit(5)),
    q(sb.from('topics').select('id,title,created_at,category:categories!inner(slug)').eq('category.slug', 'annonces').order('created_at', { ascending: false }).limit(3)),
    q(sb.from('profiles').select('username,role').order('created_at', { ascending: false }).limit(1)),
    sb.from('profiles').select('username,role,last_seen').gte('last_seen', since24).order('last_seen', { ascending: false }).limit(200),
    sb.from('characters').select('faction').eq('status', 'approved').limit(5000),
  ]);
  const { data: staffList } = await sb.from('profiles').select('username,role,title,avatar_url').in('role', ['admin', 'moderator']).eq('banned', false).order('created_at');
  const admins = (staffList || []).filter((m) => m.role === 'admin');
  const mods = (staffList || []).filter((m) => m.role === 'moderator');
  const staffCol = `
        <div class="welcome-col staff-col">
          <h3>L’administration</h3>
          ${admins.map((a) => `
            <div class="admin-card">
              <a href="#/u/${encodeURIComponent(a.username)}">${avatar(a, 'xl')}</a>
              ${userLink(a)}
              ${a.title ? `<span class="author-title">${esc(a.title)}</span>` : ''}
              ${roleBadge(a)}
              ${state.profile && state.profile.username !== a.username ? `<a class="btn btn-small btn-ghost" href="#/messages/nouveau?a=${encodeURIComponent(a.username)}">✉ Écrire</a>` : ''}
            </div>`).join('') || '<p class="muted small">Aucun administrateur.</p>'}
          ${mods.length ? `<h3>Les Gardiens</h3><div class="mod-list">${mods.map((m) => `<a href="#/u/${encodeURIComponent(m.username)}" title="${esc(m.username)}">${avatar(m, 'sm')}<span>${esc(m.username)}</span></a>`).join('')}</div>` : ''}
        </div>`;
  const onlineList = online.error ? null : online.data; // null si la colonne last_seen n’existe pas encore
  const facCount = {};
  (facRes.data || []).forEach((r) => { facCount[r.faction] = (facCount[r.faction] || 0) + 1; });

  // Dernier sujet actif de chaque catégorie
  const lastByCat = {};
  recentTopics.forEach((t) => { if (!lastByCat[t.category_id]) lastByCat[t.category_id] = t; });
  const lastPostPage = (t) => `#/t/${t.id}/fin`;

  const forumRow = (c) => {
    const last = lastByCat[c.id];
    const fk = TERRITORY_FAC[c.slug];
    return `
    <div class="forum-row ${fk ? 'fac fac-' + fk : ''}">
      <a class="forum-icon" href="#/c/${esc(c.slug)}" aria-hidden="true" tabindex="-1">${esc(c.icon || '✦')}</a>
      <div class="forum-main">
        <a class="forum-title" href="#/c/${esc(c.slug)}">${esc(c.name)}</a>
        <p class="forum-desc">${esc(c.description || '')}</p>
        <span class="forum-counts">${plural(c.topic_count, 'sujet', 'sujets')} · ${plural(c.message_count, 'message', 'messages')}</span>
      </div>
      <div class="forum-last">${last ? `
        ${avatar(last.last, 'sm')}
        <div><a href="${lastPostPage(last)}" class="forum-last-title">${esc(last.title)}</a>
        <span class="small muted">par ${userLink(last.last)} · ${ago(last.last_post_at)}</span></div>` : '<span class="muted small">Aucun message pour l’instant</span>'}
      </div>
    </div>`;
  };
  const wikiRow = (href, icon, title, desc) => `
    <div class="forum-row"><a class="forum-icon" href="${href}" aria-hidden="true" tabindex="-1">${icon}</a>
      <div class="forum-main"><a class="forum-title" href="${href}">${title}</a><p class="forum-desc">${desc}</p></div>
      <div class="forum-last"><a class="btn btn-small btn-ghost" href="${href}">Lire</a></div></div>`;
  const group = (title, kicker, rows) => rows ? `
    <section class="forum-group">
      <div class="group-head"><span class="group-kicker">${kicker}</span><h2>${title}</h2></div>
      <div class="card forum-list">${rows}</div>
    </section>` : '';

  const rp = cats.filter((c) => c.kind === 'rp');
  const hrpStart = cats.filter((c) => c.kind !== 'rp' && c.position < 5);
  const hrpEnd = cats.filter((c) => c.kind !== 'rp' && c.position >= 5);

  const factionLegend = FACTION_LIST.filter((f) => f.key !== 'neutre').map((f) =>
    `<a class="legend-item ${facClass(f.value)}" href="#/personnages/${encodeURIComponent(f.value)}"><span class="legend-dot"></span>${f.icon} ${esc(f.value.replace('Musiciens — ', ''))} <b>${facCount[f.value] || 0}</b></a>`).join('');

  const intro = `
    <section class="welcome card">
      <div class="welcome-head">
        <span class="group-kicker">Après la Fracture</span>
        <h1>Bienvenue à Paris</h1>
        <p class="welcome-lead">La Fracture a fini par venir dans le monde réel, et <b>seule la ville de Paris a survécu</b>. Peintres et Écrivains s’y disputent le monopole de la création du nouveau monde ; les Musiciens, neutres et divisés, font pencher la balance.</p>
        ${state.session ? '' : '<p><a class="btn" href="#/inscription">Rejoindre le forum</a> <a class="btn btn-ghost" href="#/connexion">Connexion</a></p>'}
      </div>
      <div class="welcome-cols">
        <div class="welcome-col">
          <h3>Les factions</h3>
          <div class="faction-cards">
            <a class="faction-card fac fac-peintres" href="#/univers/factions"><span>🎨</span><b>Les Peintres</b><em>« L’image précède le mot. »</em></a>
            <a class="faction-card fac fac-ecrivains" href="#/univers/factions"><span>✒️</span><b>Les Écrivains</b><em>« Ce qui est nommé existe. »</em></a>
            <a class="faction-card fac fac-musiciens" href="#/univers/factions"><span>🎻</span><b>Les Musiciens</b><em>Neutres… et fragmentés.</em></a>
          </div>
        </div>
        <div class="welcome-col">
          <h3>Nouvelles du forum</h3>
          <ul class="latest">${news.map((t) => `<li><a href="#/t/${t.id}">${esc(t.title)}</a><span class="small muted">${fmtDay(t.created_at)}</span></li>`).join('') || '<li class="muted small">Aucune annonce pour l’instant.</li>'}</ul>
          <h3>Derniers arrivés à Paris</h3>
          <div class="mini-chars">${newChars.map((c) => `<a class="mini-char" href="#/perso/${c.id}" title="${esc(c.name)}">${charAvatar(c, 'sm')}<span>${esc(c.name)}</span></a>`).join('') || '<p class="muted small">Aucun personnage validé.</p>'}</div>
        </div>
        <div class="welcome-col">
          <h3>Liens utiles</h3>
          <ul class="quick-links">
            <li><a href="#/univers/bienvenue">❦ Comment jouer</a></li>
            <li><a href="#/univers/contexte">❦ La Fracture</a></li>
            <li><a href="#/univers/lieux">❦ Paris aujourd’hui</a></li>
            <li><a href="#/univers/reglement-rp">❦ Règlement RP</a></li>
            <li><a href="#/fiche/nouvelle">❦ Créer mon personnage</a></li>
            <li><a href="#/personnages">❦ Galerie des personnages</a></li>
          </ul>
        </div>
        ${staffCol}
      </div>
    </section>`;

  const onlineHtml = onlineList === null ? '' : `
      <div class="stat-block">
        <h4>Présents ces dernières 24 heures (${onlineList.length})</h4>
        <p class="small">${onlineList.map((m) => userLink(m)).join(', ') || '<span class="muted">Personne… pour l’instant.</span>'}</p>
      </div>`;

  return `${intro}
    ${group('Le Grimoire', 'Avant d’entrer', [
      wikiRow('#/univers/contexte', '📜', 'L’univers', 'La Fracture, les factions, les territoires de Paris : tout ce qu’il faut savoir avant de jouer.'),
      wikiRow('#/personnages', '🎭', 'Les personnages', 'Galerie des fiches validées, à filtrer par faction.'),
    ].join('') + hrpStart.map(forumRow).join(''))}
    ${group('Paris', 'En jeu', rp.map(forumRow).join(''))}
    ${group('Hors-jeu', 'Entre joueurs', hrpEnd.map(forumRow).join(''))}
    ${cats.length ? '' : '<div class="card empty">Aucune catégorie. Lancez le script SQL.</div>'}

    <section class="forum-group">
      <div class="group-head"><span class="group-kicker">Le forum</span><h2>Qui est à Paris ?</h2></div>
      <div class="card who">
        <div class="stat-block">
          <h4>Les factions</h4>
          <div class="legend">${factionLegend}</div>
        </div>
        ${onlineHtml}
        <div class="stat-block stats-line">
          <span><b>${members.count ?? 0}</b> membres</span>
          <span><b>${chars.count ?? 0}</b> personnages</span>
          <span><b>${topics.count ?? 0}</b> sujets</span>
          <span><b>${posts.count ?? 0}</b> messages</span>
          ${newest[0] ? `<span>Dernier inscrit : ${userLink(newest[0])}</span>` : ''}
        </div>
      </div>
    </section>`;
}

async function viewCategory([slug, pageStr]) {
  const page = Number(pageStr) || 1;
  const cat = await q(sb.from('categories').select('*').eq('slug', slug).maybeSingle());
  if (!cat) return `<div class="card empty"><h2>Catégorie introuvable</h2><p><a href="#/">Retour</a></p></div>`;
  setTitle(cat.name);
  const from = (page - 1) * PAGE_SIZE_TOPICS;
  const { data: topics, count } = await q(sb.from('topics')
    .select('id,title,pinned,locked,post_count,view_count,created_at,last_post_at,author:profiles!topics_author_id_fkey(username,role,avatar_url),last:profiles!topics_last_post_author_fkey(username,role)', { count: 'exact' })
    .eq('category_id', cat.id)
    .order('pinned', { ascending: false }).order('last_post_at', { ascending: false })
    .range(from, from + PAGE_SIZE_TOPICS - 1));
  const canCreate = canWrite() && (!cat.staff_only || isStaff());
  const rpNote = cat.kind === 'rp' ? `<div class="rp-note small">🎭 <b>Zone en jeu</b> : vous écrivez en incarnant l’un de vos personnages validés. Les remarques de joueur vont dans la zone hors-jeu.</div>` : '';
  const rows = topics.map((t) => `
    <div class="topic-row ${t.pinned ? 'pinned' : ''}">
      ${avatar(t.author, 'sm')}
      <div class="topic-main">
        <a class="topic-title" href="#/t/${t.id}">${t.pinned ? '<span class="tag tag-pin">Épinglé</span>' : ''}${t.locked ? '<span class="tag tag-lock">🔒 Verrouillé</span>' : ''}${esc(t.title)}</a>
        <span class="small muted">par ${userLink(t.author)} · ${fmtDay(t.created_at)}</span>
      </div>
      <span class="cat-stat"><b>${Math.max(t.post_count - 1, 0)}</b> réponses</span>
      <span class="cat-stat"><b>${t.view_count}</b> vues</span>
      <a class="cat-last small" href="#/t/${t.id}/fin">${ago(t.last_post_at)}<br>${t.last ? esc(t.last.username) : ''}</a>
    </div>`).join('');
  return `
    <nav class="crumbs"><a href="#/">Accueil</a> › <span>${esc(cat.name)}</span></nav>
    <div class="page-head">
      <div><h1>${esc(cat.icon || '')} ${esc(cat.name)} ${cat.kind === 'rp' ? '<span class="tag tag-rp">RP</span>' : '<span class="tag">HRP</span>'}</h1><p class="muted">${esc(cat.description || '')}</p></div>
      ${canCreate ? `<a class="btn" href="#/nouveau/${esc(cat.slug)}">✒ Nouveau sujet</a>` : !state.session ? `<a class="btn btn-ghost" href="#/connexion">Connectez-vous pour participer</a>` : ''}
    </div>
    ${rpNote}
    <div class="card topic-list">${rows || '<p class="empty">Aucun sujet ici. Soyez le premier à prendre la plume !</p>'}</div>
    ${pager(`#/c/${esc(cat.slug)}`, page, count, PAGE_SIZE_TOPICS)}`;
}

async function viewTopic([idStr, pageStr]) {
  const id = Number(idStr);
  const topic = await q(sb.from('topics').select('*,category:categories(id,name,slug,icon,kind),author:profiles!topics_author_id_fkey(username)').eq('id', id).maybeSingle());
  if (!topic) return `<div class="card empty"><h2>Sujet introuvable</h2><p>Il a peut-être été supprimé.</p><p><a href="#/">Retour</a></p></div>`;
  const lastPage = Math.max(1, Math.ceil(topic.post_count / PAGE_SIZE_POSTS));
  const page = pageStr === 'fin' ? lastPage : Number(pageStr) || 1;
  setTitle(topic.title);
  if (page === 1) sb.rpc('increment_views', { p_topic: id }).then(() => {});
  const from = (page - 1) * PAGE_SIZE_POSTS;
  const { data: posts, count } = await q(sb.from('posts')
    .select('id,content,created_at,edited_at,author_id,character_id,character:characters(id,name,avatar_url,faction,occupation,quote),author:profiles!posts_author_id_fkey(id,username,role,title,avatar_url,banned,created_at),likes:post_likes(user_id)', { count: 'exact' })
    .eq('topic_id', id).order('created_at').order('id').range(from, from + PAGE_SIZE_POSTS - 1));

  // nombre de messages par auteur (affiché dans la carte de l’auteur)
  const authorIds = [...new Set(posts.map((p) => p.author_id).filter(Boolean))];
  const counts = {};
  await Promise.all(authorIds.map(async (a) => {
    const { count: c } = await sb.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', a);
    counts[a] = c ?? 0;
  }));

  const isRp = topic.category.kind === 'rp';
  const myChars = isRp && canWrite() ? await myApprovedCharacters() : [];
  const me = state.profile?.id;
  const firstPostId = page === 1 && posts[0] ? posts[0].id : null;
  const postHtml = posts.map((p, i) => {
    const liked = p.likes.some((l) => l.user_id === me);
    const mine = me && p.author_id === me;
    const isFirst = p.id === firstPostId;
    const actions = [
      canWrite() && !topic.locked ? `<button class="link" data-act="quote" data-id="${p.id}">Citer</button>` : '',
      (mine && canWrite()) || isStaff() ? `<button class="link" data-act="edit" data-id="${p.id}">Modifier</button>` : '',
      (mine && !isFirst) || (isStaff() && !isFirst) ? `<button class="link danger" data-act="delete" data-id="${p.id}">Supprimer</button>` : '',
      canWrite() && !mine ? `<button class="link" data-act="report" data-id="${p.id}">Signaler</button>` : '',
    ].filter(Boolean).join('');
    return `
    <article class="post card ${isRp ? 'post-rp' : ''} ${isRp && p.character ? facClass(p.character.faction) : ''}" id="p${p.id}" data-who="${esc(isRp ? (p.character?.name || 'Le Narrateur') : (p.author?.username || 'Quelqu’un'))}">
      ${isRp ? (p.character ? `
      <aside class="post-author">
        ${charAvatar(p.character, 'lg')}
        ${charLink(p.character)}
        ${p.character.occupation ? `<span class="author-title">${esc(p.character.occupation)}</span>` : ''}
        ${factionBadge(p.character.faction)}
        <span class="small muted">joué par ${userLink(p.author)}</span>
      </aside>` : `
      <aside class="post-author narrator">
        <span class="avatar lg avatar-initial" style="--h:40">🎭</span>
        <b class="char-link">Le Narrateur</b>
        <span class="small muted">par ${userLink(p.author)}</span>
      </aside>`) : `
      <aside class="post-author">
        ${avatar(p.author, 'lg')}
        ${userLink(p.author)}
        ${p.author?.title ? `<span class="author-title">${esc(p.author.title)}</span>` : ''}
        ${roleBadge(p.author)}
        ${p.author ? `<span class="small muted">${plural(counts[p.author_id] ?? 0, 'message', 'messages')}</span>` : ''}
      </aside>`}
      <div class="post-content">
        <header class="post-meta small muted">
          <a href="#/t/${id}/${page}" data-anchor="p${p.id}">#${from + i + 1}</a> · ${fmtDate(p.created_at)}
          ${p.edited_at ? ` · <em>modifié ${ago(p.edited_at)}</em>` : ''}
        </header>
        <div class="post-body" data-raw="${esc(p.content)}">${renderContent(p.content)}</div>
        <footer class="post-actions">
          <button class="like ${liked ? 'on' : ''}" data-act="like" data-id="${p.id}" ${canWrite() ? '' : 'disabled'} title="Applaudir ce message">👏 <span>${p.likes.length || ''}</span></button>
          <span class="spacer"></span>${actions}
        </footer>
      </div>
    </article>`;
  }).join('');

  const modTools = isStaff() ? `
    <div class="mod-bar card">
      <span class="small"><b>Outils de modération :</b></span>
      <button class="btn btn-small btn-ghost" data-mod="pin">${topic.pinned ? 'Désépingler' : 'Épingler'}</button>
      <button class="btn btn-small btn-ghost" data-mod="lock">${topic.locked ? 'Déverrouiller' : 'Verrouiller'}</button>
      <button class="btn btn-small btn-ghost" data-mod="move">Déplacer</button>
      <button class="btn btn-small btn-ghost" data-mod="rename">Renommer</button>
      <button class="btn btn-small danger" data-mod="delete">Supprimer le sujet</button>
    </div>` : (me && topic.author_id === me && canWrite() ? `<div class="mod-bar"><button class="btn btn-small btn-ghost" data-mod="rename">Renommer mon sujet</button></div>` : '');

  let replyBox;
  if (!state.session) replyBox = `<div class="card empty small"><a href="#/connexion">Connectez-vous</a> ou <a href="#/inscription">inscrivez-vous</a> pour répondre.</div>`;
  else if (!canWrite()) replyBox = `<div class="card empty small">Votre compte est suspendu : vous ne pouvez plus publier.</div>`;
  else if (topic.locked && !isStaff()) replyBox = `<div class="card empty small">🔒 Ce sujet est verrouillé.</div>`;
  else if (isRp && !myChars.length && !isStaff()) replyBox = needCharacter;
  else replyBox = `<form class="card reply" id="reply-form"><h3>Répondre</h3>${isRp ? identitySelect(myChars) : ''}${editor('content')}<div class="form-actions"><button class="btn" type="submit">Publier la réponse</button></div></form>`;

  return `
    <nav class="crumbs"><a href="#/">Accueil</a> › <a href="#/c/${esc(topic.category.slug)}">${esc(topic.category.name)}</a></nav>
    <div class="page-head"><h1>${topic.pinned ? '<span class="tag tag-pin">Épinglé</span>' : ''}${topic.locked ? '<span class="tag tag-lock">🔒</span>' : ''}${esc(topic.title)}</h1>
      <p class="muted small">${plural(topic.post_count, 'message', 'messages')} · ${plural(topic.view_count, 'vue', 'vues')}</p></div>
    ${modTools}
    ${pager(`#/t/${id}`, page, count, PAGE_SIZE_POSTS)}
    <div class="posts">${postHtml}</div>
    ${pager(`#/t/${id}`, page, count, PAGE_SIZE_POSTS)}
    ${replyBox}`;
}
viewTopic.after = (root, [idStr, pageStr]) => {
  const id = Number(idStr);
  wireEditor(root);
  if (pageStr === 'fin') root.querySelector('.post:last-of-type')?.scrollIntoView({ block: 'start' });
  const form = root.querySelector('#reply-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = form.content.value.trim();
    if (!content) return;
    form.querySelector('button[type=submit]').disabled = true;
    try {
      const character_id = form.character ? Number(form.character.value) || null : null;
      await q(sb.from('posts').insert({ topic_id: id, author_id: state.profile.id, character_id, content }));
      toast('Réponse publiée.', 'ok');
      if (location.hash === `#/t/${id}/fin`) router(); else go(`#/t/${id}/fin`);
    } catch (err) { fail(err); form.querySelector('button[type=submit]').disabled = false; }
  });

  root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
    const pid = Number(b.dataset.id);
    const article = root.querySelector(`#p${pid}`);
    const body = article.querySelector('.post-body');
    try {
      switch (b.dataset.act) {
        case 'like': {
          const on = b.classList.toggle('on');
          const span = b.querySelector('span');
          const n = (Number(span.textContent) || 0) + (on ? 1 : -1);
          span.textContent = n || '';
          if (on) await q(sb.from('post_likes').insert({ post_id: pid, user_id: state.profile.id }));
          else await q(sb.from('post_likes').delete().eq('post_id', pid).eq('user_id', state.profile.id));
          break;
        }
        case 'quote': {
          const ta = root.querySelector('#reply-form textarea');
          if (!ta) return;
          const who = article.dataset.who;
          const quoted = body.dataset.raw.split('\n').map((l) => `> ${l}`).join('\n');
          ta.value += `${ta.value ? '\n\n' : ''}> **${who}** a écrit :\n${quoted}\n\n`;
          ta.focus();
          ta.scrollIntoView({ block: 'center' });
          break;
        }
        case 'edit': {
          if (article.querySelector('form')) return;
          const f = document.createElement('form');
          f.innerHTML = `${editor('content', body.dataset.raw)}<div class="form-actions"><button class="btn btn-ghost" type="button" data-cancel>Annuler</button><button class="btn" type="submit">Enregistrer</button></div>`;
          body.hidden = true;
          body.after(f);
          wireEditor(f);
          f.querySelector('[data-cancel]').onclick = () => { f.remove(); body.hidden = false; };
          f.onsubmit = async (ev) => {
            ev.preventDefault();
            try {
              const content = f.content.value.trim();
              await q(sb.from('posts').update({ content }).eq('id', pid));
              body.dataset.raw = content;
              body.innerHTML = renderContent(content);
              f.remove(); body.hidden = false;
              toast('Message modifié.', 'ok');
            } catch (err) { fail(err); }
          };
          break;
        }
        case 'delete':
          if (!confirm('Supprimer définitivement ce message ?')) return;
          await q(sb.from('posts').delete().eq('id', pid));
          article.remove();
          toast('Message supprimé.', 'ok');
          break;
        case 'report': {
          const m = modal('Signaler ce message', `<form><label>Motif du signalement<textarea name="reason" rows="3" required minlength="3" maxlength="500" placeholder="Spoiler non balisé, insulte, spam…"></textarea></label>
            <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Annuler</button><button class="btn" type="submit">Envoyer</button></div></form>`);
          m.querySelector('form').onsubmit = async (ev) => {
            ev.preventDefault();
            try {
              await q(sb.from('reports').insert({ post_id: pid, reporter_id: state.profile.id, reason: ev.target.reason.value.trim() }));
              m.remove();
              toast('Merci, l’équipe de modération a été prévenue.', 'ok');
            } catch (err) { fail(err); }
          };
          break;
        }
      }
    } catch (err) { fail(err); }
  }));

  root.querySelectorAll('[data-mod]').forEach((b) => b.addEventListener('click', async () => {
    try {
      const { data: t } = await sb.from('topics').select('pinned,locked,title,category_id').eq('id', id).single();
      switch (b.dataset.mod) {
        case 'pin': await q(sb.from('topics').update({ pinned: !t.pinned }).eq('id', id)); break;
        case 'lock': await q(sb.from('topics').update({ locked: !t.locked }).eq('id', id)); break;
        case 'delete':
          if (!confirm('Supprimer ce sujet et tous ses messages ? Cette action est définitive.')) return;
          await q(sb.from('topics').delete().eq('id', id));
          toast('Sujet supprimé.', 'ok');
          return go('#/');
        case 'rename': {
          const m = modal('Renommer le sujet', `<form><label>Titre<input name="title" required minlength="3" maxlength="120" value="${esc(t.title)}"></label>
            <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Annuler</button><button class="btn">Enregistrer</button></div></form>`);
          m.querySelector('form').onsubmit = async (ev) => {
            ev.preventDefault();
            try { await q(sb.from('topics').update({ title: ev.target.title.value.trim() }).eq('id', id)); m.remove(); router(); } catch (err) { fail(err); }
          };
          return;
        }
        case 'move': {
          const cats = await q(sb.from('categories').select('id,name').order('position'));
          const m = modal('Déplacer le sujet', `<form><label>Nouvelle catégorie<select name="cat">${cats.map((c) => `<option value="${c.id}" ${c.id === t.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
            <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Annuler</button><button class="btn">Déplacer</button></div></form>`);
          m.querySelector('form').onsubmit = async (ev) => {
            ev.preventDefault();
            try { await q(sb.from('topics').update({ category_id: Number(ev.target.cat.value) }).eq('id', id)); m.remove(); toast('Sujet déplacé.', 'ok'); router(); } catch (err) { fail(err); }
          };
          return;
        }
      }
      router();
    } catch (err) { fail(err); }
  }));
};

async function viewNewTopic([slug]) {
  const need = requireLogin(); if (need) return need;
  const cat = await q(sb.from('categories').select('*').eq('slug', slug).maybeSingle());
  if (!cat) return `<div class="card empty"><h2>Catégorie introuvable</h2></div>`;
  if (!canWrite() || (cat.staff_only && !isStaff())) return `<div class="card empty"><h2>Accès restreint</h2><p>Vous ne pouvez pas ouvrir de sujet dans cette catégorie.</p></div>`;
  setTitle('Nouveau sujet');
  const isRp = cat.kind === 'rp';
  const myChars = isRp ? await myApprovedCharacters() : [];
  if (isRp && !myChars.length && !isStaff()) return needCharacter;
  return `
    <nav class="crumbs"><a href="#/">Accueil</a> › <a href="#/c/${esc(cat.slug)}">${esc(cat.name)}</a> › <span>Nouveau sujet</span></nav>
    <form class="card form" id="new-topic">
      <h1>Nouveau sujet dans « ${esc(cat.name)} »</h1>
      ${isRp ? identitySelect(myChars) : ''}
      <label>Titre<input name="title" required minlength="3" maxlength="120" placeholder="${isRp ? 'Ex. : Un matin sur les quais [Libre]' : 'Un titre clair et évocateur'}"></label>
      <label>${isRp ? 'Premier message (en jeu)' : 'Message'}</label>${editor('content')}
      <p class="small muted">Astuce : entourez les révélations de <code>||</code> pour les masquer, par exemple <code>||la fin du chapitre||</code>.</p>
      <div class="form-actions"><a class="btn btn-ghost" href="#/c/${esc(cat.slug)}">Annuler</a><button class="btn" type="submit">Publier le sujet</button></div>
    </form>`;
}
viewNewTopic.after = (root, [slug]) => {
  wireEditor(root);
  const f = root.querySelector('#new-topic');
  f?.addEventListener('submit', async (e) => {
    e.preventDefault();
    f.querySelector('button[type=submit]').disabled = true;
    try {
      const cat = await q(sb.from('categories').select('id').eq('slug', slug).single());
      const p_character = f.character ? Number(f.character.value) || null : null;
      const tid = await q(sb.rpc('create_topic', { p_category: cat.id, p_title: f.title.value.trim(), p_content: f.content.value.trim(), p_character }));
      toast('Sujet publié !', 'ok');
      go(`#/t/${tid}`);
    } catch (err) { fail(err); f.querySelector('button[type=submit]').disabled = false; }
  });
};

function viewLogin() {
  setTitle('Connexion');
  if (state.session) { go('#/'); return ''; }
  return `<form class="card form narrow" id="login">
    <h1>Connexion</h1>
    <label>Adresse e-mail<input type="email" name="email" required autocomplete="email"></label>
    <label>Mot de passe<input type="password" name="password" required autocomplete="current-password"></label>
    <div class="form-actions"><a href="#/oubli" class="small">Mot de passe oublié ?</a><button class="btn" type="submit">Se connecter</button></div>
    <p class="small muted">Pas encore de compte ? <a href="#/inscription">Rejoindre Paris</a></p>
  </form>`;
}
viewLogin.after = (root) => {
  root.querySelector('#login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await q(sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value }));
      toast('Bon retour parmi nous !', 'ok');
      go('#/');
    } catch (err) { fail(err); }
  });
};

function viewSignup() {
  setTitle('Inscription');
  if (state.session) { go('#/'); return ''; }
  return `<form class="card form narrow" id="signup">
    <h1>Rejoindre Paris</h1>
    <label>Pseudo<input name="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_.\\-]+" title="3 à 24 caractères : lettres, chiffres, _ . -" autocomplete="username"></label>
    <label>Adresse e-mail<input type="email" name="email" required autocomplete="email"></label>
    <label>Mot de passe<input type="password" name="password" required minlength="8" autocomplete="new-password"></label>
    <label class="check"><input type="checkbox" name="rules" required> J’ai lu et j’accepte le <a href="#/regles" target="_blank">règlement</a>.</label>
    <div class="form-actions"><button class="btn" type="submit">Créer mon compte</button></div>
  </form>`;
}
viewSignup.after = (root) => {
  root.querySelector('#signup')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const username = f.username.value.trim();
    try {
      const taken = await q(sb.from('profiles').select('id').ilike('username', username.replace(/[_%\\]/g, '\\$&')).limit(1).maybeSingle());
      if (taken) return toast('Ce pseudo est déjà pris.', 'error');
      const res = await q(sb.auth.signUp({
        email: f.email.value.trim(), password: f.password.value,
        options: { data: { username }, emailRedirectTo: location.origin + location.pathname },
      }));
      if (res.session) { toast('Bienvenue sur le forum !', 'ok'); go('#/'); }
      else app.innerHTML = `<div class="card empty"><h2>Encore une étape</h2><p>Un e-mail de confirmation vient d’être envoyé à <b>${esc(f.email.value)}</b>. Cliquez sur le lien qu’il contient pour activer votre compte.</p></div>`;
    } catch (err) { fail(err); }
  });
};

function viewForgot() {
  setTitle('Mot de passe oublié');
  return `<form class="card form narrow" id="forgot"><h1>Mot de passe oublié</h1>
    <p class="muted">Indiquez votre adresse : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
    <label>Adresse e-mail<input type="email" name="email" required></label>
    <div class="form-actions"><button class="btn">Envoyer le lien</button></div></form>`;
}
viewForgot.after = (root) => {
  root.querySelector('#forgot')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await q(sb.auth.resetPasswordForEmail(e.target.email.value.trim(), { redirectTo: location.origin + location.pathname }));
      toast('Si un compte existe, un e-mail vient d’être envoyé.', 'ok');
    } catch (err) { fail(err); }
  });
};

function viewReset() {
  setTitle('Nouveau mot de passe');
  if (!state.session) return `<div class="card empty"><h2>Lien expiré</h2><p>Recommencez depuis <a href="#/oubli">Mot de passe oublié</a>.</p></div>`;
  return `<form class="card form narrow" id="reset"><h1>Nouveau mot de passe</h1>
    <label>Nouveau mot de passe<input type="password" name="password" required minlength="8" autocomplete="new-password"></label>
    <div class="form-actions"><button class="btn">Enregistrer</button></div></form>`;
}
viewReset.after = (root) => {
  root.querySelector('#reset')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await q(sb.auth.updateUser({ password: e.target.password.value })); toast('Mot de passe mis à jour.', 'ok'); go('#/'); } catch (err) { fail(err); }
  });
};

async function viewProfile([username]) {
  const p = await q(sb.from('profiles').select('*').eq('username', username).maybeSingle());
  if (!p) return `<div class="card empty"><h2>Membre introuvable</h2></div>`;
  setTitle(p.username);
  const [{ count: postCount }, { count: topicCount }, recent, { count: likesReceived }] = await Promise.all([
    sb.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', p.id),
    sb.from('topics').select('id', { count: 'exact', head: true }).eq('author_id', p.id),
    q(sb.from('posts').select('id,content,created_at,topic:topics(id,title)').eq('author_id', p.id).order('created_at', { ascending: false }).limit(10)),
    sb.from('post_likes').select('post_id, posts!inner(author_id)', { count: 'exact', head: true }).eq('posts.author_id', p.id),
  ]);
  const self = state.profile?.id === p.id;
  const chars = await q(sb.from('characters').select(CHAR_COLS).eq('owner_id', p.id).order('created_at'));
  const canSanction = isStaff() && !self && (isAdmin() || p.role === 'member');
  const recentHtml = recent.map((r) => `
    <li><a href="#/t/${r.topic?.id}">${esc(r.topic?.title || 'Sujet')}</a> <span class="small muted">· ${ago(r.created_at)}</span>
      <p class="small excerpt">${esc(r.content.slice(0, 180))}${r.content.length > 180 ? '…' : ''}</p></li>`).join('');
  return `
    <div class="profile card">
      <div class="profile-head">
        ${avatar(p, 'xl')}
        <div>
          <h1>${esc(p.username)}</h1>
          ${p.title ? `<p class="author-title">${esc(p.title)}</p>` : ''}
          <p>${roleBadge(p)} <span class="muted small">Membre depuis le ${fmtDay(p.created_at)}</span></p>
        </div>
        <div class="profile-actions">
          ${self ? `<a class="btn btn-ghost" href="#/parametres">Modifier mon profil</a>` : ''}
          ${!self && canWrite() ? `<a class="btn btn-small" href="#/messages/nouveau?a=${encodeURIComponent(p.username)}">✉ Envoyer un message</a>` : ''}
          ${canSanction ? `<button class="btn btn-small ${p.banned ? 'btn-ghost' : 'danger'}" id="ban">${p.banned ? 'Lever le bannissement' : 'Bannir'}</button>` : ''}
        </div>
      </div>
      <div class="profile-stats">
        <div><b>${postCount ?? 0}</b><span>messages</span></div>
        <div><b>${topicCount ?? 0}</b><span>sujets</span></div>
        <div><b>${likesReceived ?? 0}</b><span>applaudissements</span></div>
      </div>
      ${p.bio ? `<div class="post-body bio">${renderContent(p.bio)}</div>` : ''}
    </div>
    <section class="card"><h3>Personnages ${self ? '<a class="btn btn-small btn-ghost" href="#/fiche/nouvelle">+ Nouvelle fiche</a>' : ''}</h3>
      <div class="char-grid">${chars.map(charCard).join('') || '<p class="muted">Aucun personnage pour l’instant.</p>'}</div></section>
    <section class="card"><h3>Messages récents</h3><ul class="latest">${recentHtml || '<li class="muted">Aucun message pour l’instant.</li>'}</ul></section>`;
}
viewProfile.after = (root, [username]) => {
  root.querySelector('#ban')?.addEventListener('click', async () => {
    try {
      const p = await q(sb.from('profiles').select('id,banned').eq('username', username).single());
      if (!p.banned && !confirm(`Bannir ${username} ? Il ne pourra plus publier.`)) return;
      await q(sb.from('profiles').update({ banned: !p.banned }).eq('id', p.id));
      toast(p.banned ? 'Bannissement levé.' : 'Membre banni.', 'ok');
      router();
    } catch (err) { fail(err); }
  });
};

function viewSettings() {
  const need = requireLogin(); if (need) return need;
  setTitle('Paramètres');
  const p = state.profile;
  if (!p) return `<div class="card empty"><p>Profil introuvable.</p></div>`;
  return `
    <form class="card form" id="profile-form">
      <h1>Mon profil</h1>
      <label>Avatar</label>${imagePicker(p.avatar_url, p.username)}
      <label>Pseudo<input name="username" value="${esc(p.username)}" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_.\\-]+"></label>
      <label>Devise (affichée sous votre pseudo)<input name="title" value="${esc(p.title || '')}" maxlength="60" placeholder="Ex. : Parade parfaite ou rien"></label>
      <label>Présentation</label>${editor('bio', p.bio || '', 'Parlez de vous, de votre équipe préférée…').replace('required ', '').replace('maxlength="20000"', 'maxlength="2000"')}
      <div class="form-actions"><button class="btn">Enregistrer</button></div>
    </form>
    <form class="card form" id="password-form">
      <h2>Changer de mot de passe</h2>
      <label>Nouveau mot de passe<input type="password" name="password" required minlength="8" autocomplete="new-password"></label>
      <div class="form-actions"><button class="btn btn-ghost">Mettre à jour</button></div>
    </form>`;
}
viewSettings.after = (root) => {
  wireEditor(root);
  wireImagePicker(root, 'avatar');
  root.querySelector('#profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      const row = { username: f.username.value.trim(), title: f.title.value.trim() || null, avatar_url: await validImageOrNull(f), bio: f.bio.value.trim() || null };
      state.profile = await q(sb.from('profiles').update(row).eq('id', state.profile.id).select().single());
      toast('Profil enregistré.', 'ok');
      go(`#/u/${encodeURIComponent(state.profile.username)}`);
    } catch (err) { fail(err); }
  });
  root.querySelector('#password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await q(sb.auth.updateUser({ password: e.target.password.value })); e.target.reset(); toast('Mot de passe mis à jour.', 'ok'); } catch (err) { fail(err); }
  });
};

async function viewMembers([pageStr]) {
  setTitle('Membres');
  const page = Number(pageStr) || 1;
  const size = 40;
  const from = (page - 1) * size;
  const cols = 'username,role,title,avatar_url,banned,created_at';
  const [staff, { data: members, count }] = await Promise.all([
    page === 1 ? q(sb.from('profiles').select(cols).in('role', ['admin', 'moderator']).order('role').order('created_at')) : [],
    q(sb.from('profiles').select(cols, { count: 'exact' }).eq('role', 'member').order('created_at').range(from, from + size - 1)),
  ]);
  const card = (m) => `<a class="member card" href="#/u/${encodeURIComponent(m.username)}">${avatar(m, 'lg')}<b>${esc(m.username)}</b>${m.title ? `<span class="author-title small">${esc(m.title)}</span>` : ''}${roleBadge(m)}</a>`;
  return `<div class="page-head"><h1>Les expéditionnaires</h1><p class="muted">${plural((count ?? 0) + staff.length, 'membre', 'membres')}</p></div>
    ${staff.length ? `<h2 class="section-title">L’équipe</h2><div class="members">${staff.map(card).join('')}</div><h2 class="section-title">Membres</h2>` : ''}
    <div class="members">${members.map(card).join('') || '<p class="muted">Aucun membre pour l’instant.</p>'}</div>
    ${pager('#/membres', page, count, size)}`;
}

async function viewSearch(_, params) {
  const term = (params.get('q') || '').trim();
  setTitle('Recherche');
  document.querySelector('#header-search input').value = term;
  if (term.length < 2) return `<div class="card empty"><h2>Recherche</h2><p>Saisissez au moins deux caractères dans la barre de recherche.</p></div>`;
  const like = `%${term.replace(/[%_\\]/g, '\\$&')}%`;
  const [topics, posts] = await Promise.all([
    q(sb.from('topics').select('id,title,last_post_at,category:categories(name)').ilike('title', like).order('last_post_at', { ascending: false }).limit(25)),
    q(sb.from('posts').select('id,content,created_at,topic:topics(id,title),author:profiles!posts_author_id_fkey(username,role)').ilike('content', like).order('created_at', { ascending: false }).limit(25)),
  ]);
  const hl = (s) => esc(s).replace(new RegExp(esc(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`);
  const snippet = (c) => {
    const i = c.toLowerCase().indexOf(term.toLowerCase());
    const start = Math.max(0, i - 80);
    return (start ? '…' : '') + c.slice(start, start + 220) + (c.length > start + 220 ? '…' : '');
  };
  return `<div class="page-head"><h1>Résultats pour « ${esc(term)} »</h1></div>
    <section class="card"><h3>Sujets (${topics.length})</h3><ul class="latest">${topics.map((t) => `<li><a href="#/t/${t.id}">${hl(t.title)}</a> <span class="small muted">· ${esc(t.category?.name || '')} · ${ago(t.last_post_at)}</span></li>`).join('') || '<li class="muted">Aucun sujet.</li>'}</ul></section>
    <section class="card"><h3>Messages (${posts.length})</h3><ul class="latest">${posts.map((p) => `<li><a href="#/t/${p.topic?.id}">${esc(p.topic?.title || '')}</a> <span class="small muted">· ${p.author ? esc(p.author.username) : ''} · ${ago(p.created_at)}</span><p class="small excerpt">${hl(snippet(p.content))}</p></li>`).join('') || '<li class="muted">Aucun message.</li>'}</ul></section>`;
}

async function viewModeration([tab = 'fiches']) {
  const need = requireLogin(); if (need) return need;
  if (!isStaff()) return `<div class="card empty"><h2>Accès réservé</h2><p>Cette page est réservée à l’équipe de modération.</p></div>`;
  setTitle('Modération');
  const tabs = [['fiches', 'Fiches à valider'], ['signalements', 'Signalements'], ['membres', 'Membres'], ...(isAdmin() ? [['categories', 'Catégories']] : [])];
  const tabsHtml = `<nav class="tabs">${tabs.map(([k, l]) => `<a href="#/moderation/${k}" class="${k === tab ? 'active' : ''}">${l}</a>`).join('')}</nav>`;
  let body = '';

  if (tab === 'fiches') {
    const pending = await q(sb.from('characters').select(CHAR_COLS + ',updated_at,owner:profiles!characters_owner_id_fkey(username,role)').eq('status', 'pending').order('updated_at'));
    body = pending.map((c) => `
      <div class="card report">
        <div class="profile-head">${charAvatar(c, 'sm')}<div><b>${charLink(c)}</b> <span class="small muted">· ${esc(c.faction)} · joué par ${userLink(c.owner)} · envoyée ${ago(c.updated_at)}</span></div>
        <a class="btn btn-small" style="margin-left:auto" href="#/perso/${c.id}">Lire et valider</a></div>
      </div>`).join('') || '<div class="card empty">Aucune fiche en attente.</div>';
  }

  if (tab === 'signalements') {
    const reports = await q(sb.from('reports')
      .select('id,reason,status,created_at,post:posts(id,content,topic_id,author:profiles!posts_author_id_fkey(username,role)),reporter:profiles!reports_reporter_id_fkey(username,role)')
      .order('created_at', { ascending: false }).limit(100));
    reports.sort((x, y) => (x.status === 'open' ? 0 : 1) - (y.status === 'open' ? 0 : 1));
    body = reports.map((r) => `
      <div class="card report ${r.status}">
        <p class="small muted">${fmtDate(r.created_at)} · signalé par ${userLink(r.reporter)} · <b>${{ open: 'À traiter', resolved: 'Traité', dismissed: 'Rejeté' }[r.status]}</b></p>
        <p><b>Motif :</b> ${esc(r.reason)}</p>
        ${r.post ? `<blockquote class="small">${esc(r.post.content.slice(0, 400))}${r.post.content.length > 400 ? '…' : ''}<br>— ${userLink(r.post.author)}</blockquote>` : '<p class="muted small">Message déjà supprimé.</p>'}
        <div class="form-actions">
          ${r.post ? `<a class="btn btn-small btn-ghost" href="#/t/${r.post.topic_id}">Voir le sujet</a>
          <button class="btn btn-small danger" data-r="delete" data-post="${r.post.id}" data-id="${r.id}">Supprimer le message</button>` : ''}
          ${r.status === 'open' ? `<button class="btn btn-small" data-r="resolved" data-id="${r.id}">Marquer traité</button>
          <button class="btn btn-small btn-ghost" data-r="dismissed" data-id="${r.id}">Rejeter</button>` : ''}
        </div>
      </div>`).join('') || '<div class="card empty">Aucun signalement. Tout est paisible.</div>';
  }

  if (tab === 'membres') {
    const members = await q(sb.from('profiles').select('id,username,role,banned,created_at').order('created_at', { ascending: false }).limit(500));
    body = `<div class="card"><input type="search" id="member-filter" placeholder="Filtrer par pseudo…" class="full">
      <table class="table"><thead><tr><th>Membre</th><th>Inscrit</th><th>Rôle</th><th>Statut</th></tr></thead><tbody>
      ${members.map((m) => `<tr data-name="${esc(m.username.toLowerCase())}">
        <td>${userLink(m)}</td><td class="small">${fmtDay(m.created_at)}</td>
        <td>${isAdmin() && m.id !== state.profile.id ? `<select data-role="${m.id}">${Object.entries(ROLE_LABEL).map(([k, l]) => `<option value="${k}" ${k === m.role ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ROLE_LABEL[m.role]}</td>
        <td>${m.id !== state.profile.id && (isAdmin() || m.role === 'member') ? `<button class="btn btn-small ${m.banned ? 'btn-ghost' : 'danger'}" data-ban="${m.id}" data-banned="${m.banned}">${m.banned ? 'Débannir' : 'Bannir'}</button>` : (m.banned ? 'Banni' : 'Actif')}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  if (tab === 'categories' && isAdmin()) {
    const cats = await q(sb.from('categories').select('*').order('position'));
    const row = (c = {}) => `
      <form class="cat-edit card" data-id="${c.id ?? ''}">
        <input name="icon" value="${esc(c.icon ?? '✦')}" maxlength="4" class="icon-input" aria-label="Icône">
        <input name="name" value="${esc(c.name ?? '')}" placeholder="Nom" required minlength="2" maxlength="60">
        <input name="slug" value="${esc(c.slug ?? '')}" placeholder="adresse-url" required pattern="[a-z0-9\\-]+">
        <input name="description" value="${esc(c.description ?? '')}" placeholder="Description" maxlength="300" class="grow">
        <input name="position" type="number" value="${c.position ?? 99}" class="num" aria-label="Ordre">
        <select name="kind" class="num" aria-label="Type"><option value="hrp" ${c.kind !== 'rp' ? 'selected' : ''}>HRP</option><option value="rp" ${c.kind === 'rp' ? 'selected' : ''}>RP</option></select>
        <label class="check small"><input type="checkbox" name="staff_only" ${c.staff_only ? 'checked' : ''}> Équipe seulement</label>
        <button class="btn btn-small">${c.id ? 'Enregistrer' : 'Ajouter'}</button>
        ${c.id ? `<button type="button" class="btn btn-small danger" data-del="${c.id}">Supprimer</button>` : ''}
      </form>`;
    body = `<p class="muted small">L’ordre est trié par le nombre (position). <b>RP</b> = zone en jeu (on poste en personnage), <b>HRP</b> = hors-jeu. Supprimer une catégorie supprime aussi tous ses sujets.</p>
      ${cats.map(row).join('')}<h3>Nouvelle catégorie</h3>${row()}`;
  }

  return `<div class="page-head"><h1>Modération</h1></div>${tabsHtml}<div class="mod-body">${body}</div>`;
}
viewModeration.after = (root) => {
  root.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', async () => {
    try {
      if (b.dataset.r === 'delete') {
        if (!confirm('Supprimer ce message ?')) return;
        await q(sb.from('reports').update({ status: 'resolved', handled_by: state.profile.id }).eq('id', b.dataset.id));
        await q(sb.from('posts').delete().eq('id', b.dataset.post));
      } else {
        await q(sb.from('reports').update({ status: b.dataset.r, handled_by: state.profile.id }).eq('id', b.dataset.id));
      }
      toast('C’est noté.', 'ok');
      router();
    } catch (err) { fail(err); }
  }));
  root.querySelector('#member-filter')?.addEventListener('input', (e) => {
    const v = e.target.value.toLowerCase();
    root.querySelectorAll('tr[data-name]').forEach((tr) => { tr.hidden = !tr.dataset.name.includes(v); });
  });
  root.querySelectorAll('[data-role]').forEach((s) => s.addEventListener('change', async () => {
    try { await q(sb.from('profiles').update({ role: s.value }).eq('id', s.dataset.role)); toast('Rôle mis à jour.', 'ok'); } catch (err) { fail(err); router(); }
  }));
  root.querySelectorAll('[data-ban]').forEach((b) => b.addEventListener('click', async () => {
    try { await q(sb.from('profiles').update({ banned: b.dataset.banned !== 'true' }).eq('id', b.dataset.ban)); router(); } catch (err) { fail(err); }
  }));
  root.querySelectorAll('.cat-edit').forEach((f) => f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const row = { icon: f.icon.value.trim() || '✦', name: f.name.value.trim(), slug: f.slug.value.trim(), description: f.description.value.trim() || null, position: Number(f.position.value) || 0, staff_only: f.staff_only.checked, kind: f.kind.value };
    try {
      if (f.dataset.id) await q(sb.from('categories').update(row).eq('id', f.dataset.id));
      else await q(sb.from('categories').insert(row));
      toast('Catégorie enregistrée.', 'ok');
      router();
    } catch (err) { fail(err); }
  }));
  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Supprimer cette catégorie ET tous ses sujets ? Action définitive.')) return;
    try { await q(sb.from('categories').delete().eq('id', b.dataset.del)); router(); } catch (err) { fail(err); }
  }));
};

function viewRules() {
  setTitle('Règlement');
  return `<div class="card prose">
    <h1>Règlement du forum</h1>
    <ol>
      <li><b>Respect avant tout.</b> Pas d’insultes, de harcèlement ni de propos discriminatoires.</li>
      <li><b>Balisez vos spoilers.</b> Tout le monde n’avance pas au même rythme : utilisez <code>||texte caché||</code> pour les révélations d’intrigue.</li>
      <li><b>Jeu de rôle.</b> Les règles d’écriture sont détaillées dans le <a href="#/univers/reglement-rp">règlement RP</a>. Dans les zones RP, on écrit uniquement en personnage.</li>
      <li><b>Le bon salon.</b> Postez dans la catégorie adaptée et cherchez avant d’ouvrir un doublon.</li>
      <li><b>Créations des autres.</b> Citez toujours l’artiste quand vous partagez une œuvre qui n’est pas la vôtre.</li>
      <li><b>Pas de piratage</b> ni de liens illégaux.</li>
      <li><b>Pas de spam</b> ni de publicité non sollicitée.</li>
    </ol>
    <p>L’équipe de modération peut modifier, verrouiller ou supprimer un contenu et suspendre un compte en cas d’abus. Utilisez le bouton « Signaler » pour nous alerter.</p></div>`;
}

// ---------------------------------------------------------------------
//  Personnages (fiches)
// ---------------------------------------------------------------------
const charCard = (c) => `
  <a class="char-card card ${facClass(c.faction)}" href="#/perso/${c.id}">
    ${charAvatar(c, 'xl')}
    <b>${esc(c.name)}</b>
    <span class="small muted">${esc(c.occupation || '')}${c.age != null ? ` · ${c.age} ans` : ''}</span>
    ${factionBadge(c.faction)}
    ${c.status !== 'approved' ? statusBadge(c.status) : ''}
  </a>`;

async function viewCharacters([faction]) {
  setTitle('Personnages');
  let query = sb.from('characters').select(CHAR_COLS).eq('status', 'approved').order('name');
  if (faction) query = query.eq('faction', faction);
  const [chars, mine] = await Promise.all([
    q(query),
    state.profile ? q(sb.from('characters').select(CHAR_COLS).eq('owner_id', state.profile.id).neq('status', 'approved').order('created_at')) : [],
  ]);
  const tabs = [['', 'Tous'], ...FACTION_LIST.map((f) => [f.value, `${f.icon} ${f.value.replace('Musiciens — ', '')}`])].map(([v, l]) =>
    `<a href="#/personnages${v ? '/' + encodeURIComponent(v) : ''}" class="${(faction || '') === v ? 'active' : ''}">${esc(l)}</a>`).join('');
  return `<div class="page-head"><div><h1>Les personnages</h1><p class="muted">Ceux qui arpentent les ruines de Paris après la Fracture.</p></div>
      ${canWrite() ? '<a class="btn" href="#/fiche/nouvelle">✒ Créer un personnage</a>' : ''}</div>
    ${mine.length ? `<h2 class="section-title">Mes fiches en cours</h2><div class="char-grid">${mine.map(charCard).join('')}</div>` : ''}
    <nav class="tabs">${tabs}</nav>
    <div class="char-grid">${chars.map(charCard).join('') || '<div class="card empty">Aucun personnage validé ici pour l’instant.</div>'}</div>`;
}

async function viewCharacter([idStr]) {
  const c = await q(sb.from('characters').select('*,owner:profiles!characters_owner_id_fkey(username,role,avatar_url)').eq('id', Number(idStr)).maybeSingle());
  if (!c) return `<div class="card empty"><h2>Personnage introuvable</h2><p>Il n’existe pas, ou sa fiche n’est pas encore publique.</p></div>`;
  setTitle(c.name);
  const [{ count: rpCount }, recent] = await Promise.all([
    sb.from('posts').select('id', { count: 'exact', head: true }).eq('character_id', c.id),
    q(sb.from('posts').select('id,created_at,topic:topics(id,title)').eq('character_id', c.id).order('created_at', { ascending: false }).limit(8)),
  ]);
  const mine = state.profile?.id === c.owner_id;
  const section = (title, text) => (text ? `<section class="fiche-section"><h3>${title}</h3><div class="post-body">${renderContent(text)}</div></section>` : '');
  const ownerActions = mine && canWrite() ? `
    <a class="btn btn-small btn-ghost" href="#/fiche/${c.id}/modifier">Modifier</a>
    ${['draft', 'rejected'].includes(c.status) ? '<button class="btn btn-small" data-st="pending">Envoyer en validation</button>' : ''}
    ${c.status === 'pending' ? '<button class="btn btn-small btn-ghost" data-st="draft">Retirer de la validation</button>' : ''}
    ${c.status !== 'approved' ? '<button class="btn btn-small danger" data-del-char>Supprimer</button>' : ''}` : '';
  const staffActions = isStaff() ? `
    <form class="card staff-box" id="validate">
      <h3>Validation (équipe)</h3>
      <label>Note pour le joueur (visible par lui)<textarea name="note" rows="3" maxlength="2000" placeholder="Ce qu’il faut corriger, ou un mot de bienvenue">${esc(c.mod_note || '')}</textarea></label>
      <div class="form-actions">
        <button class="btn btn-small" type="button" data-st="approved">Valider la fiche</button>
        <button class="btn btn-small btn-ghost" type="button" data-st="rejected">À retravailler</button>
        <button class="btn btn-small btn-ghost" type="button" data-st="archived">Archiver (personnage retiré / mort)</button>
        ${!mine ? '<a class="btn btn-small btn-ghost" href="#/fiche/' + c.id + '/modifier">Corriger la fiche</a>' : ''}
      </div>
    </form>` : '';
  return `
    <nav class="crumbs"><a href="#/personnages">Personnages</a> › <span>${esc(c.name)}</span></nav>
    <article class="card fiche ${facClass(c.faction)}">
      <div class="profile-head">
        ${charAvatar(c, 'xl')}
        <div>
          <h1>${esc(c.name)}</h1>
          ${c.quote ? `<p class="author-title">« ${esc(c.quote)} »</p>` : ''}
          <p>${factionBadge(c.faction)} ${statusBadge(c.status)}</p>
        </div>
        <div class="profile-actions">${ownerActions}</div>
      </div>
      ${(mine || isStaff()) && c.mod_note ? `<div class="rp-note small"><b>Note de l’équipe :</b> ${esc(c.mod_note)}</div>` : ''}
      <dl class="fiche-id">
        <div><dt>Âge</dt><dd>${c.age != null ? c.age + ' ans' : '—'}</dd></div>
        <div><dt>Occupation</dt><dd>${esc(c.occupation || '—')}</dd></div>
        <div><dt>Joué par</dt><dd>${userLink(c.owner)}</dd></div>
        <div><dt>Messages en jeu</dt><dd>${rpCount ?? 0}</dd></div>
      </dl>
      ${section('Apparence', c.appearance)}
      ${section('Caractère', c.personality)}
      ${section('Histoire', c.history)}
      ${section('Capacités', c.abilities)}
    </article>
    ${staffActions}
    <section class="card"><h3>Dernières apparitions</h3><ul class="latest">${recent.map((r) => `<li><a href="#/t/${r.topic?.id}">${esc(r.topic?.title || 'Sujet')}</a> <span class="small muted">· ${ago(r.created_at)}</span></li>`).join('') || '<li class="muted">Pas encore entré en scène.</li>'}</ul></section>`;
}
viewCharacter.after = (root, [idStr]) => {
  const id = Number(idStr);
  root.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', async () => {
    const row = { status: b.dataset.st };
    const note = root.querySelector('#validate textarea');
    if (note && isStaff()) row.mod_note = note.value.trim() || null;
    try {
      await q(sb.from('characters').update(row).eq('id', id));
      toast({ pending: 'Fiche envoyée à l’équipe.', approved: 'Fiche validée !', rejected: 'Fiche renvoyée au joueur.', archived: 'Fiche archivée.', draft: 'Fiche repassée en brouillon.' }[row.status], 'ok');
      router();
    } catch (err) { fail(err); }
  }));
  root.querySelector('[data-del-char]')?.addEventListener('click', async () => {
    if (!confirm('Supprimer définitivement cette fiche ?')) return;
    try { await q(sb.from('characters').delete().eq('id', id)); toast('Fiche supprimée.', 'ok'); go('#/personnages'); } catch (err) { fail(err); }
  });
};

async function viewCharacterForm([idStr]) {
  const need = requireLogin(); if (need) return need;
  if (!canWrite()) return `<div class="card empty"><p>Votre compte est suspendu.</p></div>`;
  let c = { faction: 'Sans allégeance' };
  if (idStr) {
    c = await q(sb.from('characters').select('*').eq('id', Number(idStr)).maybeSingle());
    if (!c || (c.owner_id !== state.profile.id && !isStaff())) return `<div class="card empty"><h2>Fiche introuvable</h2></div>`;
  }
  setTitle(idStr ? `Modifier ${c.name}` : 'Nouveau personnage');
  const groups = [...new Set(FACTION_LIST.map((f) => f.group))];
  let factionOpts = groups.map((g) => `<optgroup label="${esc(g)}">${FACTION_LIST.filter((f) => f.group === g).map((f) => `<option value="${esc(f.value)}" ${f.value === c.faction ? 'selected' : ''}>${f.icon} ${esc(f.value)}</option>`).join('')}</optgroup>`).join('');
  if (!FACTIONS.includes(c.faction)) factionOpts += `<option selected>${esc(c.faction)}</option>`;
  const area = (name, label, max, rows, ph) => `<label>${label}</label>
    <div class="editor">${editorToolbar}<textarea name="${name}" rows="${rows}" maxlength="${max}" placeholder="${esc(ph)}">${esc(c[name] || '')}</textarea><div class="preview post-body" hidden></div></div>`;
  return `
    <form class="card form" id="char-form">
      <h1>${idStr ? `Modifier la fiche de ${esc(c.name)}` : 'Nouveau personnage'}</h1>
      <p class="muted small">Besoin d’aide ? Lisez <a href="#/univers/creer-un-personnage" target="_blank">Créer son personnage</a>. Vous pouvez enregistrer un brouillon et revenir plus tard.</p>
      ${c.status === 'approved' && !isStaff() ? '<div class="rp-note small">Cette fiche est validée : vos modifications sont visibles tout de suite. Prévenez l’équipe en cas de gros changement.</div>' : ''}
      <div class="form-grid">
        <label>Nom<input name="name" required minlength="2" maxlength="60" value="${esc(c.name || '')}"></label>
        <label>Âge<input name="age" type="number" min="0" max="1000" value="${c.age ?? ''}"></label>
        <label>Faction <a href="#/univers/factions" target="_blank" class="small">(lire)</a><select name="faction">${factionOpts}</select></label>
        <label>Occupation<input name="occupation" maxlength="80" value="${esc(c.occupation || '')}" placeholder="Ex. : forgeronne, cartographe…"></label>
      </div>
      <label>Image du personnage <span class="muted">(une illustration dont vous avez les droits, ou une création à vous)</span></label>${imagePicker(c.avatar_url, c.name)}
      <label>Citation<input name="quote" maxlength="200" value="${esc(c.quote || '')}" placeholder="Une phrase qui le résume"></label>
      ${area('appearance', 'Apparence', 6000, 5, 'Taille, visage, tenue, signes distinctifs…')}
      ${area('personality', 'Caractère', 6000, 5, 'Qualités, défauts, peurs, ce qui le fait avancer…')}
      ${area('history', 'Histoire', 20000, 10, 'Qu’a-t-il vécu pendant la Fracture ? Pourquoi a-t-il rejoint (ou fui) sa faction ?')}
      ${area('abilities', 'Capacités', 6000, 4, 'Pouvoirs (voir les pouvoirs possibles de sa faction), leurs limites et leur coût…')}
      <div class="form-actions">
        <a class="btn btn-ghost" href="${idStr ? '#/perso/' + c.id : '#/personnages'}">Annuler</a>
        <button class="btn btn-ghost" type="submit" data-mode="save">Enregistrer</button>
        ${!idStr || ['draft', 'rejected'].includes(c.status) ? '<button class="btn" type="submit" data-mode="submit">Enregistrer et envoyer en validation</button>' : ''}
      </div>
    </form>`;
}
viewCharacterForm.after = (root, [idStr]) => {
  wireEditor(root);
  wireImagePicker(root, 'perso');
  const f = root.querySelector('#char-form');
  if (!f) return;
  let mode = 'save';
  f.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; }));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = (n) => f[n].value.trim() || null;
    const row = { name: f.name.value.trim(), age: f.age.value === '' ? null : Number(f.age.value), faction: f.faction.value, occupation: v('occupation'), avatar_url: null, quote: v('quote'), appearance: v('appearance'), personality: v('personality'), history: v('history'), abilities: v('abilities') };
    if (mode === 'submit') row.status = 'pending';
    try {
      row.avatar_url = await validImageOrNull(f);
      let saved;
      if (idStr) saved = await q(sb.from('characters').update(row).eq('id', Number(idStr)).select('id').single());
      else saved = await q(sb.from('characters').insert({ ...row, owner_id: state.profile.id, status: row.status || 'draft' }).select('id').single());
      toast(mode === 'submit' ? 'Fiche envoyée à l’équipe pour validation.' : 'Fiche enregistrée.', 'ok');
      go(`#/perso/${saved.id}`);
    } catch (err) { fail(err); }
  });
};

// ---------------------------------------------------------------------
//  Univers (pages de contexte modifiables par l’équipe)
// ---------------------------------------------------------------------
async function viewWikiIndex() {
  setTitle('Univers');
  const pages = await q(sb.from('wiki_pages').select('slug,title,section,position,updated_at').order('position'));
  const sections = [...new Set(pages.map((p) => p.section))];
  return `<div class="page-head"><div><h1>L’univers du forum</h1><p class="muted">Contexte, lieux, guides et règles du jeu de rôle.</p></div>
      ${isStaff() ? '<a class="btn" href="#/nouvelle-page">+ Nouvelle page</a>' : ''}</div>
    ${sections.map((sec) => `<h2 class="section-title">${esc(sec)}</h2>
      <div class="card cat-list">${pages.filter((p) => p.section === sec).map((p) => `
        <a class="cat-row wiki-row" href="#/univers/${esc(p.slug)}"><span class="cat-icon">❦</span>
          <span class="cat-main"><span class="cat-name">${esc(p.title)}</span></span>
          <span class="cat-last">mis à jour ${ago(p.updated_at)}</span></a>`).join('')}</div>`).join('') || '<div class="card empty">Aucune page pour l’instant.</div>'}`;
}

async function viewWikiPage([slug]) {
  const [page, all] = await Promise.all([
    q(sb.from('wiki_pages').select('*,editor:profiles!wiki_pages_updated_by_fkey(username,role)').eq('slug', slug).maybeSingle()),
    q(sb.from('wiki_pages').select('slug,title,section').order('position')),
  ]);
  if (!page) return `<div class="card empty"><h2>Page introuvable</h2><p><a href="#/univers">Retour à l’univers</a></p></div>`;
  setTitle(page.title);
  return `<nav class="crumbs"><a href="#/univers">Univers</a> › <span>${esc(page.section)}</span></nav>
    <div class="layout">
      <article class="card prose wiki">
        <div class="page-head"><h1>${esc(page.title)}</h1>${isStaff() ? `<a class="btn btn-small btn-ghost" href="#/univers/${esc(page.slug)}/modifier">Modifier</a>` : ''}</div>
        <div class="post-body">${renderContent(page.content)}</div>
        <p class="small muted">Mis à jour ${ago(page.updated_at)}${page.editor ? ' par ' + userLink(page.editor) : ''}</p>
      </article>
      <aside><div class="card side"><h3>Pages</h3><ul class="latest">${all.map((p) => `<li>${p.slug === slug ? `<b>${esc(p.title)}</b>` : `<a href="#/univers/${esc(p.slug)}">${esc(p.title)}</a>`}</li>`).join('')}</ul></div></aside>
    </div>`;
}

async function viewWikiEdit([slug]) {
  const need = requireLogin(); if (need) return need;
  if (!isStaff()) return `<div class="card empty"><h2>Réservé à l’équipe</h2></div>`;
  const page = slug ? await q(sb.from('wiki_pages').select('*').eq('slug', slug).maybeSingle()) : { section: 'Univers', position: 50, content: '' };
  if (!page) return `<div class="card empty"><h2>Page introuvable</h2></div>`;
  setTitle(slug ? `Modifier ${page.title}` : 'Nouvelle page');
  return `<form class="card form" id="wiki-form">
      <h1>${slug ? 'Modifier la page' : 'Nouvelle page d’univers'}</h1>
      <div class="form-grid">
        <label>Titre<input name="title" required minlength="2" maxlength="100" value="${esc(page.title || '')}"></label>
        <label>Adresse (lettres minuscules et tirets)<input name="slug" required pattern="[a-z0-9\\-]+" value="${esc(page.slug || '')}"></label>
        <label>Rubrique<input name="section" required maxlength="60" value="${esc(page.section)}" placeholder="Univers, Commencer, Lieux…"></label>
        <label>Ordre<input name="position" type="number" value="${page.position}"></label>
      </div>
      <label>Contenu (Markdown)</label>
      <div class="editor">${editorToolbar}<textarea name="content" rows="18" maxlength="60000">${esc(page.content)}</textarea><div class="preview post-body" hidden></div></div>
      <div class="form-actions">
        ${slug ? '<button type="button" class="btn btn-small danger" data-del-page>Supprimer la page</button><span class="spacer"></span>' : ''}
        <a class="btn btn-ghost" href="${slug ? '#/univers/' + esc(slug) : '#/univers'}">Annuler</a><button class="btn">Enregistrer</button>
      </div>
    </form>`;
}
viewWikiEdit.after = (root, [slug]) => {
  wireEditor(root);
  const f = root.querySelector('#wiki-form');
  if (!f) return;
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const row = { title: f.title.value.trim(), slug: f.slug.value.trim(), section: f.section.value.trim(), position: Number(f.position.value) || 0, content: f.content.value, updated_by: state.profile.id, updated_at: new Date().toISOString() };
    try {
      if (slug) await q(sb.from('wiki_pages').update(row).eq('slug', slug));
      else await q(sb.from('wiki_pages').insert(row));
      toast('Page enregistrée.', 'ok');
      go(`#/univers/${row.slug}`);
    } catch (err) { fail(err); }
  });
  root.querySelector('[data-del-page]')?.addEventListener('click', async () => {
    if (!confirm('Supprimer cette page ?')) return;
    try { await q(sb.from('wiki_pages').delete().eq('slug', slug)); go('#/univers'); } catch (err) { fail(err); }
  });
};

// ---------------------------------------------------------------------
//  Messagerie privée
// ---------------------------------------------------------------------
async function refreshUnread() {
  if (!state.profile) return;
  const { data } = await sb.rpc('unread_count');
  state.unread = data || 0;
  const el = document.getElementById('unread-count');
  if (el) el.innerHTML = data ? ` <span class="pill">${data}</span>` : '';
  const base = document.title.replace(/^\(\d+\) /, '');
  document.title = data ? `(${data}) ${base}` : base;
}

async function viewInbox() {
  const need = requireLogin(); if (need) return need;
  setTitle('Messagerie');
  const rows = await q(sb.from('conversation_members')
    .select('last_read_at,hidden,conversation:conversations(id,subject,is_broadcast,last_message_at,created_by)')
    .eq('user_id', state.profile.id).eq('hidden', false).limit(300));
  const convs = rows.filter((r) => r.conversation).sort((a, b) => new Date(b.conversation.last_message_at) - new Date(a.conversation.last_message_at));
  const ids = convs.filter((r) => !r.conversation.is_broadcast).map((r) => r.conversation.id);
  const parts = {};
  if (ids.length) {
    const mem = await q(sb.from('conversation_members').select('conversation_id,user:profiles(username,role,avatar_url)').in('conversation_id', ids));
    mem.forEach((m) => { if (m.user && m.user.username !== state.profile.username) (parts[m.conversation_id] ||= []).push(m.user); });
  }
  const list = convs.map((r) => {
    const c = r.conversation;
    const unread = !r.last_read_at || new Date(c.last_message_at) > new Date(r.last_read_at);
    const people = c.is_broadcast ? '<span class="badge badge-admin">📣 À tous les membres</span>' : (parts[c.id] || []).map((u) => esc(u.username)).join(', ') || '<span class="muted">Vous seul</span>';
    const face = c.is_broadcast ? '<span class="avatar sm avatar-initial" style="--h:40">📣</span>' : avatar((parts[c.id] || [])[0], 'sm');
    return `<a class="conv-row ${unread ? 'unread' : ''}" href="#/messages/${c.id}">
      ${face}
      <span class="conv-main"><span class="conv-subject">${unread ? '<span class="dot" title="Non lu"></span>' : ''}${esc(c.subject)}</span><span class="small muted">${people}</span></span>
      <span class="small muted">${ago(c.last_message_at)}</span></a>`;
  }).join('');
  return `<div class="page-head"><div><h1>Messagerie</h1><p class="muted">Vos conversations privées.</p></div>
      ${canWrite() ? '<a class="btn" href="#/messages/nouveau">✒ Nouveau message</a>' : ''}</div>
    <div class="card conv-list">${list || '<p class="empty">Aucune conversation pour l’instant.</p>'}</div>`;
}

function viewCompose(_, params) {
  const need = requireLogin(); if (need) return need;
  if (!canWrite()) return `<div class="card empty"><p>Votre compte est suspendu.</p></div>`;
  setTitle('Nouveau message');
  const to = params.get('a') || '';
  return `<nav class="crumbs"><a href="#/messages">Messagerie</a> › <span>Nouveau message</span></nav>
    <form class="card form" id="compose">
      <h1>Nouveau message</h1>
      ${isStaff() ? `<label class="check"><input type="checkbox" name="all"> 📣 Envoyer à <b>tous les membres</b> (annonce : les membres pourront le lire mais pas y répondre)</label>` : ''}
      <label data-to>Destinataire(s)<input name="to" value="${esc(to)}" placeholder="Pseudo, ou plusieurs pseudos séparés par des virgules" list="member-names" autocomplete="off"></label>
      <datalist id="member-names"></datalist>
      <label>Sujet<input name="subject" required maxlength="120"></label>
      <label>Message</label>${editor('content').replace('maxlength="20000"', 'maxlength="10000"')}
      <div class="form-actions"><a class="btn btn-ghost" href="#/messages">Annuler</a><button class="btn">Envoyer</button></div>
    </form>`;
}
viewCompose.after = (root) => {
  wireEditor(root);
  const f = root.querySelector('#compose');
  if (!f) return;
  const toBox = f.querySelector('[data-to]');
  f.all?.addEventListener('change', () => { toBox.hidden = f.all.checked; });
  // suggestions de pseudos
  let timer;
  f.to.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const last = f.to.value.split(',').pop().trim();
      if (last.length < 2) return;
      const { data } = await sb.from('profiles').select('username').ilike('username', `${last.replace(/[%_\\]/g, '\\$&')}%`).limit(8);
      const before = f.to.value.includes(',') ? f.to.value.slice(0, f.to.value.lastIndexOf(',') + 1) + ' ' : '';
      root.querySelector('#member-names').innerHTML = (data || []).map((m) => `<option value="${esc(before + m.username)}">`).join('');
    }, 250);
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button.btn:not(.btn-ghost)');
    btn.disabled = true;
    try {
      const subject = f.subject.value.trim();
      const content = f.content.value.trim();
      let id;
      if (f.all?.checked) {
        if (!confirm('Envoyer ce message à TOUS les membres ?')) { btn.disabled = false; return; }
        id = await q(sb.rpc('broadcast_message', { p_subject: subject, p_content: content }));
      } else {
        const names = f.to.value.split(',').map((x) => x.trim()).filter(Boolean);
        if (!names.length) throw new Error('Indiquez au moins un destinataire.');
        id = await q(sb.rpc('start_conversation', { p_usernames: names, p_subject: subject, p_content: content }));
      }
      toast('Message envoyé.', 'ok');
      go(`#/messages/${id}`);
    } catch (err) { fail(err); btn.disabled = false; }
  });
};

async function viewConversation([idStr]) {
  const need = requireLogin(); if (need) return need;
  const id = Number(idStr);
  const conv = await q(sb.from('conversations').select('*').eq('id', id).maybeSingle());
  if (!conv) return `<div class="card empty"><h2>Conversation introuvable</h2><p>Elle n’existe pas, ou vous n’y participez pas.</p><p><a href="#/messages">Retour à la messagerie</a></p></div>`;
  setTitle(conv.subject);
  const [msgs, mem] = await Promise.all([
    q(sb.from('private_messages').select('id,content,created_at,author_id,author:profiles(username,role,avatar_url,title)').eq('conversation_id', id).order('created_at').limit(500)),
    conv.is_broadcast ? [] : q(sb.from('conversation_members').select('user:profiles(username,role)').eq('conversation_id', id)),
  ]);
  // marquer comme lu
  sb.from('conversation_members').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', id).eq('user_id', state.profile.id).then(refreshUnread);
  const people = conv.is_broadcast ? '📣 Message envoyé à tous les membres' : 'Participants : ' + mem.map((m) => userLink(m.user)).join(', ');
  const canReply = canWrite() && (!conv.is_broadcast || isStaff());
  return `<nav class="crumbs"><a href="#/messages">Messagerie</a> › <span>${esc(conv.subject)}</span></nav>
    <div class="page-head"><div><h1>${esc(conv.subject)}</h1><p class="muted small">${people}</p></div>
      <button class="btn btn-small btn-ghost" id="hide-conv">Retirer de ma boîte</button></div>
    <div class="pm-thread">${msgs.map((m) => `
      <article class="pm ${m.author_id === state.profile.id ? 'mine' : ''}">
        ${avatar(m.author, 'sm')}
        <div class="pm-bubble card">
          <header class="small muted">${userLink(m.author)} · ${fmtDate(m.created_at)}</header>
          <div class="post-body">${renderContent(m.content)}</div>
        </div>
      </article>`).join('')}</div>
    ${canReply ? `<form class="card reply" id="pm-reply"><h3>Répondre</h3>${editor('content').replace('maxlength="20000"', 'maxlength="10000"')}<div class="form-actions"><button class="btn">Envoyer</button></div></form>`
      : `<div class="card empty small">${conv.is_broadcast ? 'Ce message a été envoyé à tous les membres : on ne peut pas y répondre ici. Pour répondre, écrivez directement à son auteur.' : 'Votre compte ne peut pas répondre.'}</div>`}`;
}
viewConversation.after = (root, [idStr]) => {
  const id = Number(idStr);
  wireEditor(root);
  root.querySelector('.pm:last-child')?.scrollIntoView({ block: 'center' });
  root.querySelector('#pm-reply')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = e.target.content.value.trim();
    if (!content) return;
    try {
      await q(sb.from('private_messages').insert({ conversation_id: id, author_id: state.profile.id, content }));
      router();
    } catch (err) { fail(err); }
  });
  root.querySelector('#hide-conv')?.addEventListener('click', async () => {
    try {
      await q(sb.from('conversation_members').update({ hidden: true }).eq('conversation_id', id).eq('user_id', state.profile.id));
      toast('Conversation retirée de votre boîte. Elle reviendra si quelqu’un y répond.', 'ok');
      go('#/messages');
    } catch (err) { fail(err); }
  });
};

// ---------------------------------------------------------------------
//  Démarrage
// ---------------------------------------------------------------------
// Signale sa présence (pour « Présents ces dernières 24 heures »), au plus toutes les 5 minutes
function touchLastSeen() {
  if (!state.session) return;
  try {
    const last = Number(localStorage.getItem('last_seen_ping') || 0);
    if (Date.now() - last < 5 * 60 * 1000) return;
    localStorage.setItem('last_seen_ping', String(Date.now()));
  } catch (e) { /* stockage indisponible */ }
  sb.rpc('touch_last_seen').then(() => {});
}

async function start() {
  if (!configured) { renderNav(); return viewSetup(); }
  const { data } = await sb.auth.getSession();
  state.session = data.session;
  await loadProfile();
  let recovering = false;
  sb.auth.onAuthStateChange(async (event, session) => {
    const changed = (session?.user?.id || null) !== (state.session?.user?.id || null);
    state.session = session;
    if (event === 'PASSWORD_RECOVERY') { recovering = true; await loadProfile(); return go('#/reinitialiser'); }
    if (changed || event === 'USER_UPDATED') { await loadProfile(); router(); }
  });
  if (/type=recovery/.test(initialHash) && state.session) recovering = true;
  if (/access_token|error_description/.test(location.hash)) history.replaceState(null, '', location.pathname + '#/');
  if (/error_description/.test(initialHash)) toast('Le lien utilisé est invalide ou a expiré.', 'error');
  if (recovering && location.hash !== '#/reinitialiser') history.replaceState(null, '', location.pathname + '#/reinitialiser');
  window.addEventListener('hashchange', router);
  router();
  touchLastSeen();
  setInterval(touchLastSeen, 5 * 60 * 1000);
  setInterval(refreshUnread, 60 * 1000);
}
start();
