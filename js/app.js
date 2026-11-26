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
const editor = (name, value = '', placeholder = 'Votre message… (Markdown accepté, ||texte|| pour un spoiler, @pseudo pour prévenir un membre)') => `
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
  let html = configured ? `<a href="#/">Accueil</a><a href="#/univers">Univers</a><a href="#/carte">Carte</a><a href="#/personnages">Personnages</a><a href="#/membres">Membres</a>` : '';
  if (p) {
    html += `<a href="#/notifications" class="nav-bell" title="Notifications" aria-label="Notifications">🔔<span id="notif-count"></span></a>`;
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
  [/^\/notifications$/, viewNotifications],
  [/^\/m\/(\d+)$/, viewPostJump],
  [/^\/carte$/, viewMap],
  [/^\/chronologie$/, viewTimeline],
  [/^\/bottin$/, viewFaceclaims],
  [/^\/classement$/, viewHonor],
  [/^\/fractures$/, viewFractures],
  [/^\/predefinis$/, viewPredefList],
  [/^\/predefini\/nouveau$/, viewPredefForm],
  [/^\/predefini\/demande$/, viewPredefForm],
  [/^\/predefini\/(\d+)$/, viewPredef],
  [/^\/predefini\/(\d+)\/modifier$/, viewPredefForm],
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
    if (state.anchor) {
      const el = document.getElementById(state.anchor);
      state.anchor = null;
      if (el) { el.scrollIntoView({ block: 'start' }); el.classList.add('post-target'); }
    }
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
  const { count: predefOpen } = await sb.from('predefined_characters').select('id', { count: 'exact', head: true }).eq('status', 'open');
  const fractures = await activeFractures();
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
            <li><a href="#/predefinis">❦ Personnages prédéfinis</a></li>
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

  return `${fractures.map(fractureBanner).join('')}${intro}
    ${group('Le Grimoire', 'Avant d’entrer', [
      wikiRow('#/univers/contexte', '📜', 'L’univers', 'La Fracture, les factions, les territoires de Paris : tout ce qu’il faut savoir avant de jouer.'),
      wikiRow('#/carte', '🗺️', 'La carte de Paris', 'Les territoires des factions : cliquez sur un quartier pour y entrer.'),
      wikiRow('#/chronologie', '⏳', 'La chronologie', 'De la Fracture à aujourd’hui : les grands événements de Paris.'),
      wikiRow('#/personnages', '🎭', 'Les personnages', 'Galerie des fiches validées, à filtrer par faction.'),
      wikiRow('#/predefinis', '🗝️', `Les prédéfinis${predefOpen ? ` <span class="pill pill-gold">${predefOpen} disponible${predefOpen > 1 ? 's' : ''}</span>` : ''}`, 'Des personnages imaginés par l’équipe, liés à l’intrigue, qui attendent leur joueur.'),
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
  const [rewards, fractureRes] = await Promise.all([
    authorRewards(authorIds),
    sb.from('fracture_events').select('id,effect,status,ends_at').eq('topic_id', id).maybeSingle(),
    ...authorIds.map(async (a) => {
      const { count: c } = await sb.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', a);
      counts[a] = c ?? 0;
    }),
  ]);
  const fracture = fractureRes.error ? null : fractureRes.data;

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
        ${p.author ? rewardLine(rewards[p.author_id]) : ''}
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
    ${fracture ? fractureNotice(fracture) : ''}
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
          ta.value += `${ta.value ? '\n\n' : ''}> **${who}** [a écrit](#/m/${pid}) :\n${quoted}\n\n`;
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
      <p class="small muted">Astuce : entourez les révélations de <code>||</code> pour les masquer, par exemple <code>||la fin du chapitre||</code>. Écrivez <code>@pseudo</code> pour prévenir un joueur.</p>
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
  const [chars, mp, myBadges] = await Promise.all([
    q(sb.from('characters').select(CHAR_COLS).eq('owner_id', p.id).order('created_at')),
    sb.from('member_points').select('*').eq('user_id', p.id).maybeSingle(),
    sb.from('member_badges').select('badge_id,note,awarded_at,badge:badges(id,name,icon,description,position)').eq('user_id', p.id),
  ]);
  const rewardsOn = !mp.error;   // false si la migration « nouveautés » n’est pas encore lancée
  const badgeList = (myBadges.data || []).filter((b) => b.badge).sort((a, b) => a.badge.position - b.badge.position);
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
          ${isStaff() && rewardsOn ? `<button class="btn btn-small btn-ghost" id="give-points">✦ Donner des points</button><button class="btn btn-small btn-ghost" id="give-badge">🏅 Décerner un badge</button>` : ''}
        </div>
      </div>
      <div class="profile-stats">
        <div><b>${postCount ?? 0}</b><span>messages</span></div>
        <div><b>${topicCount ?? 0}</b><span>sujets</span></div>
        <div><b>${likesReceived ?? 0}</b><span>applaudissements</span></div>
        ${rewardsOn ? `<div><b>${mp.data?.points ?? 0}</b><span><a href="#/classement">points RP</a></span></div>` : ''}
      </div>
      ${badgeList.length ? `<div class="badge-shelf">${badgeList.map((b) => `<span class="medal" title="${esc(b.badge.description || '')}${b.note ? ' — ' + esc(b.note) : ''}">${esc(b.badge.icon)} ${esc(b.badge.name)}${isStaff() ? `<button class="link medal-x" data-unbadge="${b.badge_id}" title="Retirer ce badge">×</button>` : ''}</span>`).join('')}</div>` : ''}
      ${p.bio ? `<div class="post-body bio">${renderContent(p.bio)}</div>` : ''}
    </div>
    <section class="card"><h3>Personnages ${self ? '<a class="btn btn-small btn-ghost" href="#/fiche/nouvelle">+ Nouvelle fiche</a>' : ''}</h3>
      <div class="char-grid">${chars.map(charCard).join('') || '<p class="muted">Aucun personnage pour l’instant.</p>'}</div></section>
    <section class="card"><h3>Messages récents</h3><ul class="latest">${recentHtml || '<li class="muted">Aucun message pour l’instant.</li>'}</ul></section>`;
}
viewProfile.after = (root, [username]) => {
  wireRewardActions(root, username);
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
  return `<div class="page-head"><div><h1>Les expéditionnaires</h1><p class="muted">${plural((count ?? 0) + staff.length, 'membre', 'membres')}</p></div><a class="btn btn-ghost" href="#/classement">🏅 Tableau d’honneur</a></div>
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
  const tabsHtml = `<nav class="tabs">${tabs.map(([k, l]) => `<a href="#/moderation/${k}" class="${k === tab ? 'active' : ''}">${l}</a>`).join('')}
    <a href="#/fractures">⚡ Fractures</a><a href="#/classement">🏅 Points & badges</a><a href="#/chronologie">⏳ Chronologie</a></nav>`;
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
      <span><a class="btn btn-ghost" href="#/bottin">📇 Bottin des avatars</a> <a class="btn btn-ghost" href="#/predefinis">🗝️ Prédéfinis</a> ${canWrite() ? '<a class="btn" href="#/fiche/nouvelle">✒ Créer un personnage</a>' : ''}</span></div>
    ${mine.length ? `<h2 class="section-title">Mes fiches en cours</h2><div class="char-grid">${mine.map(charCard).join('')}</div>` : ''}
    <nav class="tabs">${tabs}</nav>
    <div class="char-grid">${chars.map(charCard).join('') || '<div class="card empty">Aucun personnage validé ici pour l’instant.</div>'}</div>`;
}

async function viewCharacter([idStr]) {
  const c = await q(sb.from('characters').select('*,owner:profiles!characters_owner_id_fkey(username,role,avatar_url)').eq('id', Number(idStr)).maybeSingle());
  if (!c) return `<div class="card empty"><h2>Personnage introuvable</h2><p>Il n’existe pas, ou sa fiche n’est pas encore publique.</p></div>`;
  setTitle(c.name);
  const [{ count: rpCount }, recent, linksRes] = await Promise.all([
    sb.from('posts').select('id', { count: 'exact', head: true }).eq('character_id', c.id),
    q(sb.from('posts').select('id,created_at,topic:topics(id,title)').eq('character_id', c.id).order('created_at', { ascending: false }).limit(8)),
    sb.from('character_links').select(LINK_COLS).or(`character_id.eq.${c.id},target_id.eq.${c.id}`),
  ]);
  const mine = state.profile?.id === c.owner_id;
  const linksHtml = linksRes.error ? '' : await renderCharacterLinks(c, linksRes.data || [], mine);
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
        ${c.faceclaim ? `<div><dt>Visage</dt><dd><a href="#/bottin?q=${encodeURIComponent(c.faceclaim)}">${esc(c.faceclaim)}</a></dd></div>` : ''}
      </dl>
      ${section('Apparence', c.appearance)}
      ${section('Caractère', c.personality)}
      ${section('Histoire', c.history)}
      ${section('Capacités', c.abilities)}
    </article>
    ${linksHtml}
    ${staffActions}
    <section class="card"><h3>Dernières apparitions</h3><ul class="latest">${recent.map((r) => `<li><a href="#/t/${r.topic?.id}">${esc(r.topic?.title || 'Sujet')}</a> <span class="small muted">· ${ago(r.created_at)}</span></li>`).join('') || '<li class="muted">Pas encore entré en scène.</li>'}</ul></section>`;
}
viewCharacter.after = (root, [idStr]) => {
  const id = Number(idStr);
  wireCharacterLinks(root, id);
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
      <label>Visage <span class="muted">(pour le <a href="#/bottin" target="_blank">bottin des avatars</a> : la personne, l’œuvre ou l’artiste dont l’image est tirée, ou « Création originale »)</span><input name="faceclaim" maxlength="80" value="${esc(c.faceclaim || '')}" placeholder="Ex. : Création originale" list="faceclaim-list" autocomplete="off"><datalist id="faceclaim-list"></datalist><span class="small" data-faceclaim-status></span></label>
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
  wireFaceclaimCheck(f, idStr ? Number(idStr) : null);
  let mode = 'save';
  f.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; }));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = (n) => f[n].value.trim() || null;
    const row = { name: f.name.value.trim(), age: f.age.value === '' ? null : Number(f.age.value), faction: f.faction.value, occupation: v('occupation'), avatar_url: null, quote: v('quote'), appearance: v('appearance'), personality: v('personality'), history: v('history'), abilities: v('abilities') };
    // « Visage » : envoyé seulement s’il est rempli ou s’il existait déjà (le forum marche aussi sans la migration)
    if (v('faceclaim') || f.faceclaim.defaultValue) row.faceclaim = v('faceclaim');
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
    <div class="universe-tiles">
      <a class="card universe-tile" href="#/carte"><span>🗺️</span><b>Carte de Paris</b><em>Les territoires des factions</em></a>
      <a class="card universe-tile" href="#/chronologie"><span>⏳</span><b>Chronologie</b><em>Les grands événements depuis la Fracture</em></a>
      <a class="card universe-tile" href="#/fractures"><span>⚡</span><b>Zones de fracture</b><em>Les événements surprises du Narrateur</em></a>
      <a class="card universe-tile" href="#/bottin"><span>📇</span><b>Bottin des avatars</b><em>Quel visage est déjà pris ?</em></a>
    </div>
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
  const [{ data }, notif] = await Promise.all([sb.rpc('unread_count'), sb.rpc('notif_count')]);
  const n = notif.error ? 0 : notif.data || 0;   // 0 si la migration « nouveautés » n’est pas encore lancée
  state.unread = (data || 0) + n;
  const el = document.getElementById('unread-count');
  if (el) el.innerHTML = data ? ` <span class="pill">${data}</span>` : '';
  const bell = document.getElementById('notif-count');
  if (bell) bell.innerHTML = n ? ` <span class="pill">${n}</span>` : '';
  const base = document.title.replace(/^\(\d+\) /, '');
  document.title = state.unread ? `(${state.unread}) ${base}` : base;
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
//  Personnages prédéfinis (proposés par l’équipe ou demandés par un membre)
// ---------------------------------------------------------------------
const PREDEF_STATUS = {
  open: ['Disponible', 'st-approved'], reserved: ['Réservé', 'st-pending'], taken: ['Pris', 'st-archived'],
  pending: ['Demande en attente', 'st-pending'], refused: ['Demande refusée', 'st-rejected'],
};
const PUBLISHED = ['open', 'reserved', 'taken'];
const predefBadge = (st) => `<span class="badge badge-${PREDEF_STATUS[st][1]}">${PREDEF_STATUS[st][0]}</span>`;
const PREDEF_EMBEDS = 'reserved:profiles!predefined_characters_reserved_by_fkey(username,role),requester:profiles!predefined_characters_requested_by_fkey(username,role),character:characters!predefined_characters_character_id_fkey(id,name,status,owner_id),linked:characters!predefined_characters_linked_character_id_fkey(id,name)';
const PREDEF_COLS = `id,name,faction,age,occupation,avatar_url,quote,summary,status,position,requested_by,created_at,${PREDEF_EMBEDS}`;

async function viewPredefList(_, params) {
  setTitle('Personnages prédéfinis');
  const tab = params.get('voir') || 'tous';
  let query = sb.from('predefined_characters').select(PREDEF_COLS);
  if (tab === 'disponibles') query = query.eq('status', 'open');
  else if (tab === 'demandes' && isStaff()) query = query.in('status', ['pending', 'refused']);
  else if (tab === 'mes-demandes' && state.profile) query = query.eq('requested_by', state.profile.id);
  else query = query.in('status', PUBLISHED);
  const list = await q(query.order('position').order('created_at'));
  let pendingCount = 0;
  if (isStaff()) ({ count: pendingCount } = await sb.from('predefined_characters').select('id', { count: 'exact', head: true }).eq('status', 'pending'));
  const card = (p) => `
    <a class="char-card card predef-card ${facClass(p.faction)} predef-${p.status}" href="#/predefini/${p.id}">
      ${charAvatar(p, 'xl')}
      <b>${esc(p.name)}</b>
      <span class="small muted">${esc(p.occupation || '')}${p.age != null ? ` · ${p.age} ans` : ''}</span>
      ${factionBadge(p.faction)}
      ${p.summary ? `<span class="small predef-summary">${esc(p.summary)}</span>` : ''}
      ${predefBadge(p.status)}
      ${p.status === 'reserved' && p.reserved ? `<span class="small muted">par ${esc(p.reserved.username)}</span>` : ''}
      ${p.requester ? `<span class="small muted">Proposé par ${esc(p.requester.username)}${p.linked ? ` · lié à ${esc(p.linked.name)}` : ''}</span>` : ''}
    </a>`;
  const t = (key, label) => `<a href="#/predefinis${key === 'tous' ? '' : '?voir=' + key}" class="${tab === key ? 'active' : ''}">${label}</a>`;
  return `<div class="page-head"><div><h1>Personnages prédéfinis</h1>
      <p class="muted">Des rôles liés à l’intrigue ou aux personnages déjà présents. Choisissez-en un : sa fiche sera pré-remplie pour vous.</p></div>
      <span>${canWrite() ? '<a class="btn btn-ghost" href="#/predefini/demande">✒ Demander un prédéfini</a>' : ''}
      ${isStaff() ? ' <a class="btn" href="#/predefini/nouveau">+ Nouveau prédéfini</a>' : ''}</span></div>
    <nav class="tabs">${t('tous', 'Tous')}${t('disponibles', 'Disponibles')}${state.profile ? t('mes-demandes', 'Mes demandes') : ''}${isStaff() ? t('demandes', `Demandes à valider${pendingCount ? ` <span class="pill">${pendingCount}</span>` : ''}`) : ''}</nav>
    ${tab === 'mes-demandes' ? '<p class="small muted">Vous voulez qu’un frère, une rivale ou un ancien maître de votre personnage soit joué par quelqu’un d’autre ? Remplissez une demande : l’équipe la relit, puis la publie dans les prédéfinis à votre nom.</p>' : ''}
    <div class="char-grid">${list.map(card).join('') || '<div class="card empty">Rien ici pour l’instant.</div>'}</div>`;
}

async function viewPredef([idStr]) {
  const p = await q(sb.from('predefined_characters').select(`*,${PREDEF_EMBEDS}`).eq('id', Number(idStr)).maybeSingle());
  if (!p) return `<div class="card empty"><h2>Prédéfini introuvable</h2><p><a href="#/predefinis">Retour</a></p></div>`;
  setTitle(p.name);
  const section = (title, text) => (text ? `<section class="fiche-section"><h3>${title}</h3><div class="post-body">${renderContent(text)}</div></section>` : '');
  const me = state.profile;
  const isRequester = me && p.requested_by === me.id;
  const reservedMine = me && p.reserved_by === me.id;
  let action = '';
  if (p.status === 'open') {
    action = !state.session ? '<a class="btn" href="#/connexion">Connectez-vous pour le jouer</a>'
      : canWrite() ? '<button class="btn" id="claim">🗝️ Je veux le jouer</button>' : '';
  } else if (p.status === 'reserved') {
    action = reservedMine && p.character ? `<a class="btn" href="#/fiche/${p.character.id}/modifier">Compléter ma fiche</a>` : `<span class="muted">Réservé par ${userLink(p.reserved)}</span>`;
  } else if (p.status === 'taken') {
    action = p.character ? `<span class="muted">Joué par ${userLink(p.reserved)} · <a href="#/perso/${p.character.id}">voir la fiche</a></span>` : '';
  } else if (isRequester) {
    action = `<a class="btn btn-ghost" href="#/predefini/${p.id}/modifier">${p.status === 'refused' ? 'Corriger et renvoyer' : 'Modifier ma demande'}</a>
      <button class="btn btn-ghost danger" id="withdraw">Retirer</button>`;
  }
  const isRequest = !PUBLISHED.includes(p.status);
  const requestBox = isRequest ? `
    <div class="card notice ${p.status === 'refused' ? 'notice-bad' : ''}">
      <b>${p.status === 'pending' ? '⏳ Demande en attente de validation par l’équipe.' : '✗ Demande refusée.'}</b>
      ${p.staff_note ? `<div class="post-body"><b>Note de l’équipe :</b> ${renderContent(p.staff_note)}</div>` : ''}
      ${p.status === 'refused' && isRequester ? '<p class="small">Vous pouvez la corriger puis la renvoyer.</p>' : ''}
    </div>` : '';
  const staff = isStaff() ? `
    <div class="mod-bar card">
      <span class="small"><b>Équipe :</b></span>
      ${isRequest ? `<button class="btn btn-small" id="publish">✓ Valider et publier</button>
        ${p.status === 'pending' ? '<button class="btn btn-small btn-ghost" id="refuse">✗ Refuser</button>' : ''}` : ''}
      <a class="btn btn-small btn-ghost" href="#/predefini/${p.id}/modifier">Modifier</a>
      ${['reserved', 'taken'].includes(p.status) ? '<button class="btn btn-small btn-ghost" id="release">Libérer (de nouveau disponible)</button>' : ''}
      <button class="btn btn-small danger" id="del-predef">Supprimer</button>
    </div>` : '';
  return `<nav class="crumbs"><a href="#/predefinis">Prédéfinis</a> › <span>${esc(p.name)}</span></nav>
    ${staff}${requestBox}
    <article class="card fiche ${facClass(p.faction)}">
      <div class="profile-head">
        ${charAvatar(p, 'xl')}
        <div>
          <h1>${esc(p.name)}</h1>
          ${p.quote ? `<p class="author-title">« ${esc(p.quote)} »</p>` : ''}
          <p>${factionBadge(p.faction)} ${predefBadge(p.status)}</p>
          ${p.requester ? `<p class="small muted">Proposé par ${userLink(p.requester)}${p.linked ? `, lié à <a href="#/perso/${p.linked.id}">${esc(p.linked.name)}</a>` : ''}</p>` : ''}
        </div>
        <div class="profile-actions">${action}</div>
      </div>
      <dl class="fiche-id">
        <div><dt>Âge</dt><dd>${p.age != null ? p.age + ' ans' : 'Au choix'}</dd></div>
        <div><dt>Occupation</dt><dd>${esc(p.occupation || 'Au choix')}</dd></div>
        <div><dt>Faction</dt><dd>${esc(p.faction)}</dd></div>
      </dl>
      ${p.summary ? `<p class="welcome-lead">${esc(p.summary)}</p>` : ''}
      ${section('Le personnage', p.description)}
      ${section(p.requester ? 'Ce que le demandeur attend du joueur' : 'Ce que l’équipe attend du joueur', p.expectations)}
      ${PUBLISHED.includes(p.status) ? '<p class="small muted">En le choisissant, une fiche pré-remplie est créée à votre nom. Vous la complétez à votre façon, puis l’envoyez en validation comme une fiche normale.</p>' : ''}
    </article>`;
}
viewPredef.after = (root, [idStr]) => {
  const id = Number(idStr);
  const upd = async (row, msg) => {
    try { await q(sb.from('predefined_characters').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id)); if (msg) toast(msg, 'ok'); router(); } catch (err) { fail(err); }
  };
  root.querySelector('#claim')?.addEventListener('click', async () => {
    if (!confirm('Réserver ce personnage ? Une fiche pré-remplie sera créée à votre nom.')) return;
    try {
      const cid = await q(sb.rpc('claim_predefined', { p_id: id }));
      toast('Personnage réservé ! Complétez sa fiche puis envoyez-la en validation.', 'ok');
      go(`#/fiche/${cid}/modifier`);
    } catch (err) { fail(err); }
  });
  root.querySelector('#publish')?.addEventListener('click', () => {
    if (confirm('Publier ce prédéfini ? Il deviendra disponible pour tous les membres.')) upd({ status: 'open' }, 'Prédéfini publié.');
  });
  root.querySelector('#refuse')?.addEventListener('click', () => {
    const m = modal('Refuser la demande', `<form><label>Note pour le membre (ce qu’il faut changer)<textarea name="note" rows="4" required minlength="3" maxlength="2000"></textarea></label>
      <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Annuler</button><button class="btn" type="submit">Refuser</button></div></form>`);
    m.querySelector('form').onsubmit = (ev) => { ev.preventDefault(); m.remove(); upd({ status: 'refused', staff_note: ev.target.note.value.trim() }, 'Demande refusée, le membre verra votre note.'); };
  });
  root.querySelector('#release')?.addEventListener('click', () => {
    if (confirm('Rendre ce prédéfini de nouveau disponible ? La fiche du joueur, si elle existe, n’est pas supprimée.')) upd({ status: 'open', reserved_by: null, character_id: null });
  });
  const del = async (question, msg) => {
    if (!confirm(question)) return;
    try { await q(sb.from('predefined_characters').delete().eq('id', id)); toast(msg, 'ok'); go('#/predefinis'); } catch (err) { fail(err); }
  };
  root.querySelector('#del-predef')?.addEventListener('click', () => del('Supprimer ce prédéfini ? (Une fiche de joueur déjà créée n’est pas supprimée.)', 'Prédéfini supprimé.'));
  root.querySelector('#withdraw')?.addEventListener('click', () => del('Retirer votre demande ?', 'Demande retirée.'));
};

async function viewPredefForm([idStr]) {
  const need = requireLogin(); if (need) return need;
  const isRequest = location.hash.startsWith('#/predefini/demande');
  let p = { faction: 'Sans allégeance', position: 0 };
  if (idStr) {
    p = await q(sb.from('predefined_characters').select('*').eq('id', Number(idStr)).maybeSingle());
    if (!p) return `<div class="card empty"><h2>Prédéfini introuvable</h2></div>`;
  }
  const asMember = !isStaff();
  if (asMember && !isRequest && !(idStr && p.requested_by === state.profile.id && ['pending', 'refused'].includes(p.status))) {
    return `<div class="card empty"><h2>Réservé à l’équipe</h2><p><a href="#/predefini/demande">Faire une demande de prédéfini</a></p></div>`;
  }
  if (asMember && !canWrite()) return `<div class="card empty"><h2>Votre compte ne peut pas faire de demande.</h2></div>`;
  const requestMode = asMember || isRequest || (idStr && p.requested_by);
  const mine = requestMode ? (await q(sb.from('characters').select('id,name').eq('owner_id', p.requested_by || state.profile.id).neq('status', 'archived').order('name'))) : [];
  setTitle(idStr ? `Modifier ${p.name}` : requestMode ? 'Demande de prédéfini' : 'Nouveau prédéfini');
  const groups = [...new Set(FACTION_LIST.map((f) => f.group))];
  const factionOpts = groups.map((g) => `<optgroup label="${esc(g)}">${FACTION_LIST.filter((f) => f.group === g).map((f) => `<option value="${esc(f.value)}" ${f.value === p.faction ? 'selected' : ''}>${f.icon} ${esc(f.value)}</option>`).join('')}</optgroup>`).join('');
  const area = (name, label, max, rows, ph) => `<label>${label}</label>
    <div class="editor">${editorToolbar}<textarea name="${name}" rows="${rows}" maxlength="${max}" placeholder="${esc(ph)}">${esc(p[name] || '')}</textarea><div class="preview post-body" hidden></div></div>`;
  const title = idStr ? `Modifier « ${esc(p.name)} »` : requestMode ? 'Demande de personnage prédéfini' : 'Nouveau personnage prédéfini';
  return `<nav class="crumbs"><a href="#/predefinis">Prédéfinis</a> › <span>${idStr ? 'Modifier' : requestMode ? 'Demande' : 'Nouveau'}</span></nav>
    <form class="card form" id="predef-form">
      <h1>${title}</h1>
      ${requestMode && asMember ? `<p class="muted">Décrivez le personnage que vous aimeriez voir joué par un autre membre (un proche, un rival, un mentor de votre personnage…). L’équipe relit la demande, puis la publie dans les prédéfinis avec votre nom.${p.status === 'refused' ? ' <b>En l’enregistrant, elle repart en validation.</b>' : ''}</p>` : ''}
      ${p.staff_note && asMember ? `<div class="notice notice-bad"><b>Note de l’équipe :</b> ${renderContent(p.staff_note)}</div>` : ''}
      <div class="form-grid">
        <label>Nom<input name="name" required minlength="2" maxlength="60" value="${esc(p.name || '')}"></label>
        <label>Âge <span class="muted">(vide = au choix)</span><input name="age" type="number" min="0" max="1000" value="${p.age ?? ''}"></label>
        <label>Faction<select name="faction">${factionOpts}</select></label>
        <label>Occupation<input name="occupation" maxlength="80" value="${esc(p.occupation || '')}"></label>
      </div>
      ${requestMode ? `<label>Lié à mon personnage <span class="muted">(facultatif)</span><select name="linked"><option value="">— Aucun —</option>${mine.map((c) => `<option value="${c.id}" ${c.id === p.linked_character_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` : ''}
      <label>Image <span class="muted">(facultatif, le joueur pourra la changer)</span></label>${imagePicker(p.avatar_url, p.name)}
      <label>Citation<input name="quote" maxlength="200" value="${esc(p.quote || '')}"></label>
      <label>Accroche (affichée dans la liste)<input name="summary" maxlength="400" value="${esc(p.summary || '')}" placeholder="Une ou deux phrases pour donner envie"></label>
      ${area('description', 'Le personnage (histoire, caractère, liens avec les autres…)', 20000, 10, 'Ce texte sera copié dans la fiche du joueur, qui pourra le compléter.')}
      ${area('expectations', requestMode ? 'Ce que vous attendez du joueur' : 'Ce que l’équipe attend du joueur', 6000, 4, 'Ex. : présence régulière, garder tel secret, lien obligatoire avec…')}
      ${asMember ? '' : `<label>Ordre d’affichage<input name="position" type="number" value="${p.position ?? 0}" class="num"></label>`}
      <div class="form-actions"><a class="btn btn-ghost" href="${idStr ? '#/predefini/' + p.id : '#/predefinis'}">Annuler</a><button class="btn">${asMember ? 'Envoyer à l’équipe' : 'Enregistrer'}</button></div>
    </form>`;
}
viewPredefForm.after = (root, [idStr]) => {
  wireEditor(root);
  wireImagePicker(root, 'predefini');
  const f = root.querySelector('#predef-form');
  f?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = (n) => f[n].value.trim() || null;
    const asMember = !isStaff();
    try {
      const row = { name: f.name.value.trim(), age: f.age.value === '' ? null : Number(f.age.value), faction: f.faction.value, occupation: v('occupation'), quote: v('quote'), summary: v('summary'), description: v('description'), expectations: v('expectations'), avatar_url: await validImageOrNull(f), updated_at: new Date().toISOString() };
      if (f.position) row.position = Number(f.position.value) || 0;
      if (f.linked) row.linked_character_id = f.linked.value ? Number(f.linked.value) : null;
      if (asMember) row.status = 'pending';
      let saved;
      if (idStr) saved = await q(sb.from('predefined_characters').update(row).eq('id', Number(idStr)).select('id').single());
      else {
        const extra = asMember || location.hash.startsWith('#/predefini/demande') ? { requested_by: state.profile.id, status: asMember ? 'pending' : 'open' } : {};
        saved = await q(sb.from('predefined_characters').insert({ ...row, created_by: state.profile.id, ...extra }).select('id').single());
      }
      toast(asMember ? 'Demande envoyée ! L’équipe va la relire.' : 'Prédéfini enregistré.', 'ok');
      go(`#/predefini/${saved.id}`);
    } catch (err) { fail(err); }
  });
};

// ---------------------------------------------------------------------
//  Nouveautés : points & badges, fractures, liens, notifications, carte, chronologie, bottin
//  (nécessite supabase/migration-nouveautes.sql ; sans elle, ces pages l’indiquent poliment)
// ---------------------------------------------------------------------
const likeEsc = (s) => s.replace(/[%_\\]/g, '\\$&');
const safeHash = (u) => (typeof u === 'string' && u.startsWith('#/') ? u : '#/');
const migrationMissing = (what) => `<div class="card empty"><h2>${what} arrive bientôt</h2>
  <p>L’équipe doit d’abord lancer une fois le script <code>supabase/migration-nouveautes.sql</code> dans Supabase (SQL Editor).</p><p><a href="#/">Retour à l’accueil</a></p></div>`;
const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `badge-${Date.now()}`;

// ---- Points & badges -------------------------------------------------
const POINT_RULES = [
  ['Message en jeu (zone RP)', 10], ['Message hors-jeu', 2], ['Applaudissement reçu', 1],
  ['Fiche de personnage validée', 25], ['Participation à une zone de fracture', 15], ['Récompense de l’équipe', 'variable'],
];
const BADGE_RULES = { rp_posts: 'messages en jeu', posts: 'messages (RP + HRP)', likes: 'applaudissements reçus', points: 'points', characters: 'personnages validés', fractures: 'zones de fracture traversées' };

async function authorRewards(ids) {
  const out = {};
  if (!ids.length) return out;
  const [pts, bdg] = await Promise.all([
    sb.from('member_points').select('user_id,points').in('user_id', ids),
    sb.from('member_badges').select('user_id,badge:badges(icon,name,position)').in('user_id', ids),
  ]);
  if (pts.error) return out;
  ids.forEach((id) => { out[id] = { points: 0, badges: [] }; });
  pts.data.forEach((r) => { out[r.user_id].points = r.points; });
  (bdg.data || []).forEach((r) => { if (r.badge && out[r.user_id]) out[r.user_id].badges.push(r.badge); });
  Object.values(out).forEach((r) => r.badges.sort((a, b) => a.position - b.position));
  return out;
}
const rewardLine = (r) => (r ? `<span class="reward-line small"><span title="Points RP">✦ ${r.points} pts</span>${r.badges.slice(-4).map((b) => `<span title="${esc(b.name)}">${esc(b.icon)}</span>`).join('')}</span>` : '');

function wireRewardActions(root, username) {
  root.querySelector('#give-points')?.addEventListener('click', () => {
    const m = modal(`Donner des points à ${username}`, `<form>
      <label>Nombre de points <span class="muted">(négatif pour en retirer)</span><input name="amount" type="number" min="-1000" max="1000" value="20" required></label>
      <label>Raison <span class="muted">(le membre la verra)</span><input name="reason" maxlength="150" placeholder="Ex. : Superbe RP pendant l’événement"></label>
      <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Annuler</button><button class="btn">Donner</button></div></form>`);
    m.querySelector('form').onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        await q(sb.rpc('award_points', { p_username: username, p_amount: Number(ev.target.amount.value), p_reason: ev.target.reason.value.trim() }));
        m.remove(); toast('Points attribués.', 'ok'); router();
      } catch (err) { fail(err); }
    };
  });
  root.querySelector('#give-badge')?.addEventListener('click', async () => {
    try {
      const badges = await q(sb.from('badges').select('id,name,icon,rule').order('position'));
      const opts = (manual) => badges.filter((b) => !b.rule === manual).map((b) => `<option value="${b.id}">${esc(b.icon)} ${esc(b.name)}</option>`).join('');
      const m = modal(`Décerner un badge à ${username}`, `<form>
        <label>Badge<select name="badge" required><optgroup label="Badges de l’équipe">${opts(true)}</optgroup><optgroup label="Badges automatiques">${opts(false)}</optgroup></select></label>
        <label>Mot pour le membre <span class="muted">(facultatif)</span><input name="note" maxlength="200" placeholder="Ex. : Pour ton RP du bal masqué"></label>
        <p class="small muted">Créez d’autres badges depuis le <a href="#/classement">tableau d’honneur</a>.</p>
        <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Annuler</button><button class="btn">Décerner</button></div></form>`);
      m.querySelector('form').onsubmit = async (ev) => {
        ev.preventDefault();
        try {
          await q(sb.rpc('award_badge', { p_username: username, p_badge: Number(ev.target.badge.value), p_note: ev.target.note.value.trim() || null }));
          m.remove(); toast('Badge décerné !', 'ok'); router();
        } catch (err) { fail(err); }
      };
    } catch (err) { fail(err); }
  });
  root.querySelectorAll('[data-unbadge]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Retirer ce badge ? (Un badge automatique reviendra à la prochaine activité du membre s’il le mérite toujours.)')) return;
    try {
      const p = await q(sb.from('profiles').select('id').eq('username', username).single());
      await q(sb.from('member_badges').delete().eq('user_id', p.id).eq('badge_id', Number(b.dataset.unbadge)));
      toast('Badge retiré.', 'ok'); router();
    } catch (err) { fail(err); }
  }));
}

async function viewHonor() {
  setTitle('Tableau d’honneur');
  const [top, badges, owned] = await Promise.all([
    sb.from('member_points').select('points,rp_posts,user_id,profile:profiles(username,role,avatar_url,banned)').gt('points', 0).order('points', { ascending: false }).limit(25),
    sb.from('badges').select('*').order('position'),
    sb.from('member_badges').select('badge_id').limit(5000),
  ]);
  if (top.error || badges.error) return migrationMissing('Le tableau d’honneur');
  const holders = {};
  (owned.data || []).forEach((r) => { holders[r.badge_id] = (holders[r.badge_id] || 0) + 1; });
  state.badges = badges.data;
  const rows = top.data.filter((r) => r.profile && !r.profile.banned).map((r, i) => `
    <tr><td class="rank rank-${i + 1}">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td>
      <td><span class="honor-user">${avatar(r.profile, 'xs')}${userLink(r.profile)}</span></td>
      <td class="small muted">${plural(r.rp_posts, 'message RP', 'messages RP')}</td><td><b>${r.points}</b> pts</td></tr>`).join('');
  const medal = (b) => `
    <div class="card medal-card">
      <span class="medal-icon">${esc(b.icon)}</span>
      <b>${esc(b.name)}</b>
      <span class="small muted">${esc(b.description || '')}</span>
      <span class="small">${b.rule ? `Automatique : ${b.threshold} ${BADGE_RULES[b.rule]}` : 'Décerné par l’équipe'} · ${plural(holders[b.id] || 0, 'membre', 'membres')}</span>
      ${isStaff() ? `<span class="medal-tools"><button class="link small" data-edit-badge="${b.id}">Modifier</button><button class="link small danger" data-del-badge="${b.id}">Supprimer</button></span>` : ''}
    </div>`;
  return `<div class="page-head"><div><h1>Tableau d’honneur</h1><p class="muted">Chaque message fait vivre Paris. Les points récompensent l’activité RP, les badges les grands moments.</p></div>
      ${isStaff() ? '<span><button class="btn btn-ghost" id="recompute">↻ Recalculer les points</button> <button class="btn" id="new-badge">+ Nouveau badge</button></span>' : ''}</div>
    <div class="layout">
      <section class="card"><h3>Les plus actifs</h3>
        ${rows ? `<table class="table honor-table"><tbody>${rows}</tbody></table>` : '<p class="muted">Personne n’a encore de points. À vos plumes !</p>'}</section>
      <aside><div class="card side"><h3>Le barème</h3><ul class="latest">${POINT_RULES.map(([l, n]) => `<li><span>${l} <b class="gold">${typeof n === 'number' ? '+' + n : n}</b></span></li>`).join('')}</ul>
        <p class="small muted">L’équipe peut aussi donner des points ou un badge depuis le profil d’un membre.</p></div></aside>
    </div>
    <h2 class="section-title">Les badges</h2>
    <div class="medal-grid">${badges.data.map(medal).join('') || '<p class="muted">Aucun badge.</p>'}</div>`;
}
viewHonor.after = (root) => {
  const badgeModal = (b = {}) => {
    const m = modal(b.id ? 'Modifier le badge' : 'Nouveau badge', `<form>
      <div class="form-grid">
        <label>Nom<input name="name" required minlength="2" maxlength="60" value="${esc(b.name || '')}"></label>
        <label>Icône <span class="muted">(un émoji)</span><input name="icon" required maxlength="8" value="${esc(b.icon || '🏅')}"></label>
      </div>
      <label>Description<input name="description" maxlength="300" value="${esc(b.description || '')}"></label>
      <div class="form-grid">
        <label>Attribution<select name="rule"><option value="">Décerné à la main par l’équipe</option>${Object.entries(BADGE_RULES).map(([k, l]) => `<option value="${k}" ${b.rule === k ? 'selected' : ''}>Automatique : nombre de ${l}</option>`).join('')}</select></label>
        <label>Seuil <span class="muted">(badge automatique)</span><input name="threshold" type="number" min="0" value="${b.threshold ?? ''}"></label>
        <label>Ordre d’affichage<input name="position" type="number" value="${b.position ?? 50}"></label>
      </div>
      <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Annuler</button><button class="btn">Enregistrer</button></div></form>`);
    m.querySelector('form').onsubmit = async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const row = { name: f.name.value.trim(), icon: f.icon.value.trim(), description: f.description.value.trim() || null, rule: f.rule.value || null, threshold: f.rule.value && f.threshold.value !== '' ? Number(f.threshold.value) : null, position: Number(f.position.value) || 0 };
      if (row.rule && row.threshold == null) return toast('Indiquez un seuil pour un badge automatique.', 'error');
      try {
        if (b.id) await q(sb.from('badges').update(row).eq('id', b.id));
        else await q(sb.from('badges').insert({ ...row, slug: `${slugify(row.name)}-${Date.now().toString(36)}` }));
        m.remove(); toast('Badge enregistré.' + (row.rule ? ' Les membres le recevront à leur prochaine activité (ou cliquez « Recalculer »).' : ''), 'ok'); router();
      } catch (err) { fail(err); }
    };
  };
  root.querySelector('#new-badge')?.addEventListener('click', () => badgeModal());
  root.querySelectorAll('[data-edit-badge]').forEach((b) => b.addEventListener('click', () => badgeModal(state.badges.find((x) => x.id === Number(b.dataset.editBadge)))));
  root.querySelectorAll('[data-del-badge]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Supprimer ce badge ? Il sera retiré à tous les membres qui l’ont.')) return;
    try { await q(sb.from('badges').delete().eq('id', Number(b.dataset.delBadge))); router(); } catch (err) { fail(err); }
  }));
  root.querySelector('#recompute')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { await q(sb.rpc('recompute_points')); toast('Points recalculés à partir de tous les messages.', 'ok'); router(); } catch (err) { fail(err); e.target.disabled = false; }
  });
};

// ---- Zones de fracture ----------------------------------------------
async function activeFractures() {
  await sb.rpc('close_expired_fractures');
  const { data, error } = await sb.from('fracture_events').select('id,title,effect,ends_at,topic_id,category:categories(name,slug,icon)')
    .eq('status', 'active').gt('ends_at', new Date().toISOString()).order('starts_at', { ascending: false });
  return error ? [] : data;
}
const fractureBanner = (f) => `
  <a class="fracture-banner" href="${f.topic_id ? `#/t/${f.topic_id}` : '#/fractures'}">
    <span class="fracture-bolt" aria-hidden="true">⚡</span>
    <span class="fracture-text"><b>Zone de fracture ouverte : ${esc(f.effect)}</b>
      <span class="small">${esc(f.category?.name || 'Quelque part dans Paris')} · se referme ${ago(f.ends_at)} · +15 points et le badge ⚡ Témoin de la Fracture pour chaque participant</span></span>
    <span class="btn btn-small">Entrer</span>
  </a>`;
function fractureNotice(f) {
  const open = f.status === 'active' && new Date(f.ends_at) > Date.now();
  return `<div class="card notice fracture-notice">⚡ <b>Zone de fracture ${open ? 'ouverte' : 'refermée'} : ${esc(f.effect)}</b>
    · ${open ? `se referme ${ago(f.ends_at)}. Chaque personnage qui y entre rapporte 15 points et le badge ⚡ Témoin de la Fracture à son joueur.` : 'cet événement est terminé.'}
    <a href="#/fractures">Toutes les fractures</a></div>`;
}

async function viewFractures() {
  setTitle('Zones de fracture');
  await sb.rpc('close_expired_fractures');
  const { data, error } = await sb.from('fracture_events').select('*,category:categories(name,slug,icon),topic:topics(id,title,post_count)').order('starts_at', { ascending: false }).limit(60);
  if (error) return migrationMissing('Les zones de fracture');
  const now = Date.now();
  const active = data.filter((f) => f.status === 'active' && new Date(f.ends_at) > now);
  const past = data.filter((f) => !active.includes(f));
  let staffForm = '';
  if (isStaff()) {
    const [cats, effects] = await Promise.all([q(sb.from('categories').select('id,name,icon').eq('kind', 'rp').order('position')), q(sb.rpc('fracture_effects'))]);
    staffForm = `
    <form class="card form staff-box" id="fracture-form">
      <h3>🎭 Le Narrateur ouvre une fracture</h3>
      <p class="small muted">Laissez « Au hasard » et le territoire comme l’effet seront tirés au sort. Un sujet épinglé est ouvert au nom du Narrateur, et tous les membres reçoivent une notification.</p>
      <div class="form-grid">
        <label>Territoire<select name="category"><option value="">🎲 Au hasard</option>${cats.map((c) => `<option value="${c.id}">${esc(c.icon || '')} ${esc(c.name)}</option>`).join('')}</select></label>
        <label>Effet<select name="effect"><option value="">🎲 Au hasard</option>${effects.map((e) => `<option value="${esc(e.name)}" title="${esc(e.description)}">${esc(e.name)}</option>`).join('')}<option value="__autre">✎ Autre (je l’écris)…</option></select></label>
        <label data-custom hidden>Effet personnalisé<input name="custom" maxlength="80" placeholder="Ex. : Les horloges fondent"></label>
        <label>Durée<select name="hours"><option value="24">24 heures</option><option value="48">2 jours</option><option value="72" selected>3 jours</option><option value="168">1 semaine</option><option value="336">2 semaines</option></select></label>
        <label>Titre du sujet <span class="muted">(facultatif)</span><input name="title" maxlength="120" placeholder="Généré automatiquement si vide"></label>
      </div>
      <label>Texte du Narrateur <span class="muted">(facultatif, ajouté au message d’ouverture)</span></label>
      ${editor('content', '', 'Décrivez ce qui arrive aux habitants du quartier…').replace('required ', '')}
      <div class="form-actions"><button type="button" class="btn btn-ghost" id="fracture-surprise">🎲 Fracture surprise (tout au hasard)</button><button class="btn" type="submit">⚡ Ouvrir la fracture</button></div>
    </form>`;
  }
  const card = (f, open) => `
    <div class="card fracture-card ${open ? 'open' : ''} fac fac-${TERRITORY_FAC[f.category?.slug] || 'neutre'}">
      <div class="fracture-head"><span class="fracture-bolt" aria-hidden="true">${open ? '⚡' : '·'}</span>
        <div><b>${esc(f.effect)}</b> <span class="small muted">· ${esc(f.category?.name || 'Territoire disparu')}</span>
          <p class="small muted">${open ? `Ouverte ${ago(f.starts_at)} · se referme ${ago(f.ends_at)}` : `Du ${fmtDay(f.starts_at)} au ${fmtDay(f.closed_at || f.ends_at)}`}${f.topic ? ` · ${plural(Math.max(f.topic.post_count - 1, 0), 'réponse', 'réponses')}` : ''}</p></div>
        <span class="fracture-actions">
          ${f.topic ? `<a class="btn btn-small ${open ? '' : 'btn-ghost'}" href="#/t/${f.topic.id}">${open ? 'Entrer dans la faille' : 'Relire'}</a>` : ''}
          ${isStaff() && open ? `<button class="btn btn-small btn-ghost" data-close-fracture="${f.id}">Refermer</button>` : ''}
          ${isStaff() && !open ? `<a class="btn btn-small btn-ghost" href="#/chronologie?ajouter=1&icone=${encodeURIComponent('⚡')}&titre=${encodeURIComponent(f.effect + ' — ' + (f.category?.name || '').split(' — ')[0])}&sujet=${f.topic_id || ''}">Inscrire dans la chronologie</a>` : ''}
        </span>
      </div>
      ${f.description ? `<div class="post-body small">${renderContent(f.description)}</div>` : ''}
    </div>`;
  return `<div class="page-head"><div><h1>Zones de fracture</h1><p class="muted">Gravité instable, pluie de lettres, créatures inachevées… La Fracture n’est pas finie : elle revient, par endroits, sans prévenir.</p></div><a class="btn btn-ghost" href="#/carte">🗺️ Voir sur la carte</a></div>
    ${staffForm}
    <h2 class="section-title">Ouvertes en ce moment</h2>
    ${active.map((f) => card(f, true)).join('') || '<div class="card empty small">Aucune fracture ouverte. Paris retient son souffle… pour l’instant.</div>'}
    <h2 class="section-title">Fractures refermées</h2>
    ${past.map((f) => card(f, false)).join('') || '<p class="muted small">Aucune pour l’instant.</p>'}`;
}
viewFractures.after = (root) => {
  wireEditor(root);
  const f = root.querySelector('#fracture-form');
  const launch = async (args, btn) => {
    if (!confirm('Ouvrir cette fracture ? Tous les membres vont recevoir une notification.')) return;
    btn.disabled = true;
    try {
      const eid = await q(sb.rpc('launch_fracture', args));
      toast('⚡ La fracture est ouverte !', 'ok');
      const { data } = await sb.from('fracture_events').select('topic_id').eq('id', eid).maybeSingle();
      go(data?.topic_id ? `#/t/${data.topic_id}` : '#/fractures');
    } catch (err) { fail(err); btn.disabled = false; }
  };
  if (f) {
    f.effect.addEventListener('change', () => { f.querySelector('[data-custom]').hidden = f.effect.value !== '__autre'; });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const effect = f.effect.value === '__autre' ? f.custom.value.trim() : f.effect.value;
      if (f.effect.value === '__autre' && !effect) return toast('Écrivez l’effet de la fracture.', 'error');
      launch({ p_category: f.category.value ? Number(f.category.value) : null, p_effect: effect || null, p_title: f.title.value.trim() || null, p_content: f.content.value.trim() || null, p_hours: Number(f.hours.value) }, f.querySelector('button[type=submit]'));
    });
    root.querySelector('#fracture-surprise').addEventListener('click', (e) => launch({ p_hours: Number(f.hours.value) }, e.target));
  }
  root.querySelectorAll('[data-close-fracture]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Refermer cette fracture maintenant ? Le sujet reste lisible.')) return;
    try { await q(sb.rpc('close_fracture', { p_id: Number(b.dataset.closeFracture) })); toast('La fracture se referme.', 'ok'); router(); } catch (err) { fail(err); }
  }));
};

// ---- Liens entre personnages ----------------------------------------
const LINK_KINDS = { famille: ['👪', 'Famille'], ami: ['🤝', 'Amitié'], amour: ['❤️', 'Amour'], allie: ['🛡️', 'Alliance'], rival: ['⚔️', 'Rivalité'], ennemi: ['💢', 'Inimitié'], mentor: ['🕯️', 'Mentor & élève'], autre: ['✦', 'Autres liens'] };
const LINK_COLS = 'id,kind,description,target_description,status,character_id,target_id,src:characters!character_links_character_id_fkey(id,name,avatar_url,faction),tgt:characters!character_links_target_id_fkey(id,name,avatar_url,faction)';

async function renderCharacterLinks(c, links, mine) {
  const me = state.profile;
  const view = links.map((l) => {
    const outgoing = l.character_id === c.id;
    return { ...l, outgoing, other: outgoing ? l.tgt : l.src, text: outgoing ? l.description : l.target_description };
  }).filter((l) => l.other);
  const accepted = view.filter((l) => l.status === 'accepted');
  const pending = mine ? view.filter((l) => l.status === 'pending') : [];
  let myChars = [];
  if (me && canWrite() && !mine && c.status === 'approved') {
    const linked = new Set(view.map((l) => l.other.id));
    myChars = (await q(sb.from('characters').select('id,name').eq('owner_id', me.id).neq('status', 'archived').order('name'))).filter((x) => !linked.has(x.id));
  }
  const canPropose = !!me && canWrite() && (mine ? c.status !== 'archived' : myChars.length > 0);
  state.linkCtx = { mine, myChars };
  if (!accepted.length && !pending.length && !canPropose) return '';
  const item = (l) => `<div class="link-item ${facClass(l.other.faction)}">${charAvatar(l.other, 'sm')}<div><a href="#/perso/${l.other.id}">${esc(l.other.name)}</a>${l.text ? `<span class="small muted">${esc(l.text)}</span>` : ''}</div>${mine ? `<button class="link small danger link-x" data-unlink="${l.id}" title="Retirer ce lien">×</button>` : ''}</div>`;
  const pend = pending.map((l) => (l.outgoing
    ? `<div class="link-pending small">⏳ Lien « ${LINK_KINDS[l.kind][1]} » proposé à <a href="#/perso/${l.other.id}">${esc(l.other.name)}</a> : en attente de son joueur. <button class="link small" data-unlink="${l.id}">Annuler</button></div>`
    : `<div class="link-pending small incoming">🔗 <a href="#/perso/${l.other.id}">${esc(l.other.name)}</a> propose un lien « ${LINK_KINDS[l.kind][1]} »${l.description ? ` : <em>${esc(l.description)}</em>` : ''}
        <span><button class="btn btn-small" data-accept-link="${l.id}" data-other="${esc(l.other.name)}">Accepter</button> <button class="btn btn-small btn-ghost" data-unlink="${l.id}" data-refuse>Refuser</button></span></div>`)).join('');
  const groups = Object.keys(LINK_KINDS).map((k) => [k, accepted.filter((l) => l.kind === k)]).filter(([, ls]) => ls.length);
  return `<section class="card char-links" id="liens">
      <h3>Liens ${canPropose ? '<button class="btn btn-small btn-ghost" id="propose-link">+ Proposer un lien</button>' : ''}</h3>
      ${pend}
      ${groups.map(([k, ls]) => `<div class="link-group"><h4>${LINK_KINDS[k][0]} ${LINK_KINDS[k][1]}</h4><div class="link-list">${ls.map(item).join('')}</div></div>`).join('') || '<p class="muted small">Aucun lien pour l’instant.</p>'}
    </section>`;
}
function wireCharacterLinks(root, id) {
  const ctx = state.linkCtx || {};
  root.querySelector('#propose-link')?.addEventListener('click', () => {
    const kinds = Object.entries(LINK_KINDS).map(([k, [i, l]]) => `<option value="${k}">${i} ${l}</option>`).join('');
    const m = modal('Proposer un lien', `<form>
      ${ctx.mine ? '<label>Avec quel personnage ?<input name="other" required list="link-chars" placeholder="Tapez le début de son nom…" autocomplete="off"></label><datalist id="link-chars"></datalist>'
        : `<label>Mon personnage<select name="mine">${ctx.myChars.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>`}
      <label>Type de lien<select name="kind">${kinds}</select></label>
      <label>En quelques mots <span class="muted">(du point de vue de votre personnage)</span><input name="description" maxlength="300" placeholder="Ex. : Son frère aîné, perdu de vue depuis la Fracture"></label>
      <p class="small muted">Le joueur de l’autre personnage reçoit une notification : le lien apparaît sur les deux fiches quand il l’accepte.</p>
      <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Annuler</button><button class="btn">Proposer</button></div></form>`);
    const form = m.querySelector('form');
    if (ctx.mine) {
      let timer;
      form.other.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const v = form.other.value.replace(/ · #\d+$/, '').trim();
          if (v.length < 2) return;
          const { data } = await sb.from('characters').select('id,name').eq('status', 'approved').neq('id', id).ilike('name', `${likeEsc(v)}%`).limit(10);
          m.querySelector('#link-chars').innerHTML = (data || []).map((c) => `<option value="${esc(c.name)} · #${c.id}">`).join('');
        }, 250);
      });
    }
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        let row;
        if (ctx.mine) {
          const mm = / · #(\d+)$/.exec(form.other.value);
          let target = mm ? Number(mm[1]) : null;
          if (!target) {
            const found = await q(sb.from('characters').select('id').eq('status', 'approved').neq('id', id).ilike('name', likeEsc(form.other.value.trim())).limit(2));
            if (found.length !== 1) return toast(found.length ? 'Plusieurs personnages portent ce nom : choisissez-le dans la liste.' : 'Personnage introuvable (sa fiche doit être validée).', 'error');
            target = found[0].id;
          }
          row = { character_id: id, target_id: target };
        } else row = { character_id: Number(form.mine.value), target_id: id };
        row.kind = form.kind.value;
        row.description = form.description.value.trim() || null;
        const saved = await q(sb.from('character_links').insert(row).select('status').single());
        m.remove();
        toast(saved.status === 'accepted' ? 'Lien ajouté.' : 'Lien proposé ! Il apparaîtra quand l’autre joueur l’aura accepté.', 'ok');
        router();
      } catch (err) { fail(err); }
    };
  });
  root.querySelectorAll('[data-accept-link]').forEach((b) => b.addEventListener('click', () => {
    const m = modal('Accepter le lien', `<form>
      <label>En quelques mots <span class="muted">(ce que ${esc(b.dataset.other)} représente pour votre personnage, facultatif)</span><input name="description" maxlength="300" placeholder="Ex. : Ce peintre arrogant qu’elle respecte en secret"></label>
      <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Annuler</button><button class="btn">Accepter le lien</button></div></form>`);
    m.querySelector('form').onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        await q(sb.from('character_links').update({ status: 'accepted', target_description: ev.target.description.value.trim() || null }).eq('id', Number(b.dataset.acceptLink)));
        m.remove(); toast('Lien accepté : il apparaît sur les deux fiches.', 'ok'); router();
      } catch (err) { fail(err); }
    };
  }));
  root.querySelectorAll('[data-unlink]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(b.hasAttribute('data-refuse') ? 'Refuser ce lien ?' : 'Retirer ce lien des deux fiches ?')) return;
    try { await q(sb.from('character_links').delete().eq('id', Number(b.dataset.unlink))); router(); } catch (err) { fail(err); }
  }));
}

// ---- Bottin des avatars ---------------------------------------------
function wireFaceclaimCheck(f, id) {
  const input = f.faceclaim;
  const status = f.querySelector('[data-faceclaim-status]');
  const list = f.querySelector('#faceclaim-list');
  if (!input) return;
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const v = input.value.trim();
      status.textContent = '';
      if (v.length < 2) return;
      const { data, error } = await sb.from('characters').select('id,name,faceclaim').eq('status', 'approved').ilike('faceclaim', `%${likeEsc(v)}%`).limit(20);
      if (error) return;
      list.innerHTML = [...new Set(data.map((d) => d.faceclaim))].map((x) => `<option value="${esc(x)}">`).join('');
      const same = data.filter((d) => d.faceclaim.toLowerCase() === v.toLowerCase() && d.id !== id);
      if (/^cr[ée]ation originale$/i.test(v)) return;
      if (same.length) { status.className = 'small danger'; status.textContent = `⚠ Ce visage est déjà utilisé par ${same.map((d) => d.name).join(', ')}.`; }
      else { status.className = 'small ok-text'; status.textContent = '✓ Aucun personnage validé n’utilise ce visage.'; }
    }, 300);
  });
}

async function viewFaceclaims(_, params) {
  setTitle('Bottin des avatars');
  const { data, error } = await sb.from('characters').select('id,name,faction,avatar_url,faceclaim,owner:profiles!characters_owner_id_fkey(username,role)')
    .eq('status', 'approved').not('faceclaim', 'is', null).order('faceclaim').order('name');
  if (error) return migrationMissing('Le bottin des avatars');
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const uses = {};
  data.forEach((c) => { const k = norm(c.faceclaim); uses[k] = (uses[k] || 0) + 1; });
  const groups = {};
  data.forEach((c) => { const l = norm(c.faceclaim).charAt(0).toUpperCase(); (groups[/[A-Z]/.test(l) ? l : '#'] ||= []).push(c); });
  const row = (c) => {
    const k = norm(c.faceclaim);
    const dup = uses[k] > 1 && !/^creation originale$/.test(k);
    return `<div class="fc-row ${facClass(c.faction)}" data-fc="${esc(k)} ${esc(norm(c.name))}">
      ${charAvatar(c, 'sm')}
      <b class="fc-face">${esc(c.faceclaim)}</b>
      <span class="fc-char">→ ${charLink(c)} ${factionBadge(c.faction)}</span>
      <span class="small muted">joué par ${userLink(c.owner)}${dup ? ' · <span class="danger">utilisé plusieurs fois</span>' : ''}</span>
    </div>`;
  };
  const term = params.get('q') || '';
  return `<div class="page-head"><div><h1>Bottin des avatars</h1><p class="muted">Quel visage est déjà pris ? Vérifiez avant de choisir l’image de votre personnage.</p></div>
      ${canWrite() ? '<a class="btn btn-ghost" href="#/fiche/nouvelle">✒ Créer un personnage</a>' : ''}</div>
    <div class="card fc-search"><input type="search" id="fc-filter" class="full" placeholder="Rechercher un visage ou un personnage…" value="${esc(term)}">
      <p class="small" id="fc-result"></p>
      <p class="small muted">Le visage se renseigne dans la fiche du personnage (champ « Visage »). ${plural(data.length, 'personnage référencé', 'personnages référencés')}.</p></div>
    ${Object.keys(groups).sort().map((l) => `<section class="fc-group" data-letter><h2 class="section-title">${l}</h2><div class="card fc-list">${groups[l].map(row).join('')}</div></section>`).join('') || '<div class="card empty">Aucun visage renseigné pour l’instant.</div>'}`;
}
viewFaceclaims.after = (root) => {
  const input = root.querySelector('#fc-filter');
  if (!input) return;
  const out = root.querySelector('#fc-result');
  const apply = () => {
    const v = input.value.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    let shown = 0;
    root.querySelectorAll('.fc-row').forEach((r) => { r.hidden = !!v && !r.dataset.fc.includes(v); if (!r.hidden) shown++; });
    root.querySelectorAll('[data-letter]').forEach((g) => { g.hidden = ![...g.querySelectorAll('.fc-row')].some((r) => !r.hidden); });
    out.className = 'small ' + (v.length >= 2 ? (shown ? 'danger' : 'ok-text') : '');
    out.textContent = v.length < 2 ? '' : shown ? `${plural(shown, 'résultat', 'résultats')} : ce visage est peut-être déjà pris.` : '✓ Aucun personnage n’utilise ce visage : il est libre !';
  };
  input.addEventListener('input', apply);
  apply();
};

// ---- Notifications ---------------------------------------------------
const NOTIF = {
  reply: (n) => ['💬', `<b>${esc(n.who)}</b> a répondu dans « ${esc(n.title)} »`],
  mention: (n) => ['📣', `<b>${esc(n.who)}</b> vous a mentionné dans « ${esc(n.title)} »`],
  quote: (n) => ['❝', `<b>${esc(n.who)}</b> vous a cité dans « ${esc(n.title)} »`],
  link: (n) => ['🔗', `<b>${esc(n.who)}</b> propose un lien avec votre personnage <b>${esc(n.title)}</b>`],
  link_ok: (n) => ['🤝', `<b>${esc(n.who)}</b> a accepté le lien avec <b>${esc(n.title)}</b>`],
  badge: (n) => ['🏅', `Nouveau badge : <b>${esc(n.who)}</b>${n.title ? ` <span class="muted">· ${esc(n.title)}</span>` : ''}`],
  points: (n) => ['✦', `<b>${esc(n.who)}</b> de l’équipe : ${esc(n.title)}`],
  fracture: (n) => ['⚡', `Une fracture s’ouvre : <b>${esc(n.who)}</b> · ${esc(n.title)}`],
  fiche: (n) => (n.title === 'approved' ? ['✅', `La fiche de <b>${esc(n.who)}</b> a été validée. Bienvenue à Paris !`] : ['✎', `La fiche de <b>${esc(n.who)}</b> est à retravailler : lisez la note de l’équipe.`]),
};
async function viewNotifications() {
  const need = requireLogin(); if (need) return need;
  setTitle('Notifications');
  const { data, error } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return migrationMissing('Les notifications');
  const rows = data.map((n) => {
    const [icon, text] = (NOTIF[n.kind] || (() => ['✦', esc(n.title || '')]))(n);
    return `<a class="notif-row ${n.read_at ? '' : 'unread'}" href="${esc(safeHash(n.url))}"><span class="notif-icon">${icon}</span><span class="notif-text">${text}</span><span class="small muted">${ago(n.created_at)}</span></a>`;
  }).join('');
  return `<div class="page-head"><div><h1>Notifications</h1><p class="muted">Réponses à vos sujets RP, mentions <code>@${esc(state.profile?.username || 'pseudo')}</code>, citations, liens, badges et fractures.</p></div>
      ${data.length ? '<button class="btn btn-ghost btn-small" id="clear-notifs">Tout effacer</button>' : ''}</div>
    <div class="card notif-list">${rows || '<p class="empty">Rien de neuf. Paris est calme… pour l’instant.</p>'}</div>`;
}
viewNotifications.after = (root) => {
  if (!state.profile) return;
  sb.rpc('mark_notifications_read').then(refreshUnread);
  root.querySelector('#clear-notifs')?.addEventListener('click', async () => {
    if (!confirm('Effacer toutes vos notifications ?')) return;
    try { await q(sb.from('notifications').delete().eq('user_id', state.profile.id)); router(); } catch (err) { fail(err); }
  });
};

// Lien vers un message précis (#/m/123) : on ouvre la bonne page du sujet
async function viewPostJump([idStr]) {
  const pid = Number(idStr);
  const post = await q(sb.from('posts').select('id,topic_id').eq('id', pid).maybeSingle());
  if (!post) return `<div class="card empty"><h2>Message introuvable</h2><p>Il a peut-être été supprimé.</p><p><a href="#/">Retour à l’accueil</a></p></div>`;
  const { count } = await sb.from('posts').select('id', { count: 'exact', head: true }).eq('topic_id', post.topic_id).lt('id', pid);
  state.anchor = `p${pid}`;
  location.replace(`#/t/${post.topic_id}/${Math.floor((count || 0) / PAGE_SIZE_POSTS) + 1}`);
  return '<p class="loading">Chargement…</p>';
}

// ---- Carte interactive de Paris -------------------------------------
// Chaque zone correspond à l’adresse (slug) d’une catégorie RP. Une catégorie renommée garde sa zone tant que son adresse ne change pas.
const MAP_ZONES = [
  { slug: 'paris', label: 'Rues neutres', lx: 255, ly: 470,
    shape: '<path class="map-shape" d="M150 300 C 150 175 300 92 470 84 C 650 76 820 125 880 240 C 935 345 900 470 785 532 C 650 600 390 602 255 535 C 165 488 148 395 150 300 Z"/>' },
  { slug: 'catacombes', label: 'Catacombes', lx: 525, ly: 548,
    shape: '<path class="map-shape map-under" d="M372 505 C 430 488 615 488 675 508 C 700 532 662 566 602 574 C 520 584 425 580 378 562 C 345 546 348 517 372 505 Z"/>' },
  { slug: 'quartier-latin', label: 'Quartier Latin', lx: 515, ly: 446,
    shape: '<path class="map-shape" d="M418 396 C 470 378 562 384 612 400 C 642 428 625 470 572 481 C 512 494 452 487 426 462 C 404 442 403 410 418 396 Z"/>' },
  { slug: 'seine', label: 'La Seine', lx: 250, ly: 288, river: true,
    shape: '<path class="map-shape map-river-hit" d="M118 362 C 220 300 300 292 382 322 S 540 382 622 342 S 760 270 902 302"/><path class="map-river" d="M118 362 C 220 300 300 292 382 322 S 540 382 622 342 S 760 270 902 302"/>' },
  { slug: 'montmartre', label: 'Montmartre', lx: 505, ly: 178,
    shape: '<path class="map-shape" d="M400 112 C 452 80 580 80 622 120 C 652 160 622 222 562 236 C 492 252 410 232 390 192 C 380 162 382 132 400 112 Z"/><ellipse class="map-contour" cx="506" cy="160" rx="78" ry="42"/><ellipse class="map-contour" cx="506" cy="154" rx="40" ry="20"/>' },
  { slug: 'fractures', label: 'Fracture ouverte', lx: 752, ly: 446,
    shape: '<path class="map-shape map-crack" d="M694 370 L737 350 L762 386 L808 376 L792 422 L828 450 L782 466 L772 512 L737 482 L698 502 L708 456 L672 432 Z"/>' },
  { slug: 'reves', label: 'Failles oniriques', lx: 120, ly: 196,
    shape: '<path class="map-shape map-moon" d="M150 58 A 60 60 0 1 0 150 172 A 46 46 0 1 1 150 58 Z"/>' },
  { slug: 'evenements', label: 'Chroniques', lx: 905, ly: 606,
    shape: '<path class="map-shape map-compass" d="M905 498 L917 538 L957 550 L917 562 L905 602 L893 562 L853 550 L893 538 Z"/><circle class="map-contour" cx="905" cy="550" r="22"/>' },
];
const MAP_STARS = [[40, 40], [90, 260], [60, 520], [210, 40], [330, 30], [610, 22], [760, 50], [960, 90], [940, 210], [975, 420], [40, 380], [130, 600], [700, 610], [980, 300], [20, 150], [870, 20]];

async function viewMap() {
  setTitle('Carte de Paris');
  const [cats, fractures] = await Promise.all([q(sb.from('category_stats').select('*').eq('kind', 'rp').order('position')), activeFractures()]);
  const bySlug = Object.fromEntries(cats.map((c) => [c.slug, c]));
  const fractureBySlug = {};
  fractures.forEach((f) => { if (f.category) (fractureBySlug[f.category.slug] ||= []).push(f); });
  state.mapInfo = { bySlug, fractureBySlug };
  const zones = MAP_ZONES.filter((z) => bySlug[z.slug]).map((z) => {
    const c = bySlug[z.slug];
    return `<a href="#/c/${esc(c.slug)}" class="map-zone fac fac-${TERRITORY_FAC[z.slug] || 'neutre'} ${fractureBySlug[z.slug] ? 'has-fracture' : ''}" data-slug="${esc(c.slug)}" aria-label="${esc(c.name)}">
      <title>${esc(c.name)}</title>${z.shape}
      <text class="map-label" x="${z.lx}" y="${z.ly}" text-anchor="middle">${esc(c.icon || '')} ${esc(z.label)}</text></a>`;
  }).join('');
  const markers = fractures.map((f, i) => {
    const z = MAP_ZONES.find((x) => x.slug === f.category?.slug);
    if (!z) return '';
    const x = z.lx + 60 + i * 8;
    const y = z.ly - 34;
    return `<a href="${f.topic_id ? `#/t/${f.topic_id}` : '#/fractures'}" class="map-fracture" aria-label="Fracture : ${esc(f.effect)}"><title>⚡ ${esc(f.effect)} : cliquez pour entrer</title>
      <circle class="map-pulse" cx="${x}" cy="${y}" r="22"/><circle class="map-pulse-core" cx="${x}" cy="${y}" r="15"/><text x="${x}" y="${y + 6}" text-anchor="middle">⚡</text></a>`;
  }).join('');
  const others = cats.filter((c) => !MAP_ZONES.some((z) => z.slug === c.slug));
  return `<div class="page-head"><div><h1>Carte de Paris</h1><p class="muted">Ce qu’il reste du monde. Survolez un territoire pour le découvrir, cliquez pour y entrer.</p></div>
      <a class="btn btn-ghost" href="#/univers/lieux">📜 Paris aujourd’hui</a></div>
    ${fractures.map(fractureBanner).join('')}
    <div class="map-layout">
      <div class="card map-card">
        <svg class="paris-map" viewBox="0 0 1000 640" aria-label="Carte des territoires de Paris">
          <defs><radialGradient id="map-void" cx="50%" cy="50%" r="70%"><stop offset="55%" style="stop-color:var(--map-void-1)"/><stop offset="100%" style="stop-color:var(--map-void-2)"/></radialGradient></defs>
          <rect width="1000" height="640" fill="url(#map-void)"/>
          <g class="map-stars">${MAP_STARS.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${1 + (i % 3) * 0.6}"/>`).join('')}</g>
          <text class="map-void-label" x="70" y="600">Le Néant</text>
          ${zones}
          <g class="map-deco" aria-hidden="true">
            <ellipse class="map-island" cx="502" cy="352" rx="26" ry="9"/>
            <text x="502" y="378" text-anchor="middle" class="map-tiny">Île de la Cité</text>
          </g>
          ${markers}
          <text class="map-compass-n" x="905" y="490" text-anchor="middle">N</text>
        </svg>
      </div>
      <aside class="card map-info" id="map-info" aria-live="polite">
        <p class="muted">Survolez ou touchez un territoire de la carte pour voir ce qui s’y passe.</p>
      </aside>
    </div>
    <h2 class="section-title">Tous les territoires</h2>
    <div class="map-legend">${cats.map((c) => `<a class="legend-item fac fac-${TERRITORY_FAC[c.slug] || 'neutre'}" href="#/c/${esc(c.slug)}" data-slug="${esc(c.slug)}"><span class="legend-dot"></span>${esc(c.icon || '')} ${esc(c.name)} <b>${c.topic_count}</b>${fractureBySlug[c.slug] ? ' ⚡' : ''}</a>`).join('')}</div>
    ${others.length ? `<p class="small muted">Les territoires ajoutés par l’équipe (${others.map((c) => esc(c.name)).join(', ')}) n’ont pas encore de place sur la carte : ils sont listés ci-dessus.</p>` : ''}`;
}
viewMap.after = (root) => {
  const info = root.querySelector('#map-info');
  if (!info) return;
  const { bySlug, fractureBySlug } = state.mapInfo;
  const FAC_NAME = { peintres: 'Bastion des Peintres', ecrivains: 'Territoire des Écrivains', musiciens: 'Sanctuaire des Musiciens', discordants: 'Zone instable', dreamers: 'Royaume des rêves', healers: 'Intrigues du Narrateur', neutre: 'Territoire neutre' };
  const show = (slug) => {
    const c = bySlug[slug];
    if (!c) return;
    const fk = TERRITORY_FAC[slug] || 'neutre';
    const fr = fractureBySlug[slug] || [];
    info.className = `card map-info fac fac-${fk}`;
    info.innerHTML = `<span class="map-info-icon">${esc(c.icon || '✦')}</span>
      <h3>${esc(c.name)}</h3>
      <p class="small map-info-fac">${FAC_NAME[fk]}</p>
      <p>${esc(c.description || '')}</p>
      <p class="small muted">${plural(c.topic_count, 'sujet', 'sujets')} · ${plural(c.message_count, 'message', 'messages')}${c.last_activity ? ` · dernière activité ${ago(c.last_activity)}` : ''}</p>
      ${fr.map((f) => `<p class="small fracture-inline">⚡ Fracture ouverte : <b>${esc(f.effect)}</b> (se referme ${ago(f.ends_at)})</p>`).join('')}
      <a class="btn btn-small" href="#/c/${esc(c.slug)}">Entrer →</a>`;
  };
  root.querySelectorAll('.map-zone, .map-legend [data-slug]').forEach((z) => {
    z.addEventListener('mouseenter', () => show(z.dataset.slug));
    z.addEventListener('focus', () => show(z.dataset.slug));
  });
};

// ---- Chronologie de Paris -------------------------------------------
async function viewTimeline() {
  setTitle('Chronologie');
  const { data, error } = await sb.from('timeline_events').select('*,topic:topics(id,title)').order('position').order('created_at');
  if (error) return migrationMissing('La chronologie');
  state.timeline = data;
  const item = (e) => `
    <li class="tl-item ${e.highlight ? 'major' : ''}">
      <span class="tl-dot" aria-hidden="true">${esc(e.icon || '✦')}</span>
      <div class="card tl-card">
        <span class="tl-era">${esc(e.era)}</span>
        <h3>${esc(e.title)}</h3>
        ${e.content ? `<div class="post-body">${renderContent(e.content)}</div>` : ''}
        ${e.topic ? `<p class="small"><a href="#/t/${e.topic.id}">📜 Relire le RP : ${esc(e.topic.title)}</a></p>` : ''}
        ${isStaff() ? `<p class="tl-tools small"><button class="link" data-edit-tl="${e.id}">Modifier</button> <button class="link danger" data-del-tl="${e.id}">Supprimer</button></p>` : ''}
      </div>
    </li>`;
  return `<div class="page-head"><div><h1>Chronologie de Paris</h1><p class="muted">De la Fracture à aujourd’hui. Les événements sont écrits par l’équipe, au fil des intrigues.</p></div>
      ${isStaff() ? '<button class="btn" id="new-tl">+ Ajouter un événement</button>' : ''}</div>
    ${data.length ? `<ol class="timeline">${data.map(item).join('')}</ol>` : '<div class="card empty">La chronologie est encore vierge.</div>'}`;
}
viewTimeline.after = (root, _, params) => {
  const list = state.timeline || [];
  const open = (e = {}) => {
    const next = list.length ? Math.max(...list.map((x) => x.position)) + 10 : 10;
    const m = modal(e.id ? 'Modifier l’événement' : 'Nouvel événement', `<form>
      <div class="form-grid">
        <label>Date dans l’univers<input name="era" required maxlength="60" value="${esc(e.era || '')}" placeholder="Ex. : An 3, Hiver de l’An 4"></label>
        <label>Icône<input name="icon" maxlength="8" value="${esc(e.icon || '✦')}"></label>
        <label>Ordre <span class="muted">(plus petit = plus ancien)</span><input name="position" type="number" value="${e.position ?? next}"></label>
        <label>Sujet RP lié <span class="muted">(son adresse ou son numéro, facultatif)</span><input name="topic" value="${e.topic_id ? `#/t/${e.topic_id}` : ''}" placeholder="#/t/123"></label>
      </div>
      <label>Titre<input name="title" required minlength="2" maxlength="120" value="${esc(e.title || '')}"></label>
      <label>Récit <span class="muted">(Markdown)</span><textarea name="content" rows="6" maxlength="8000">${esc(e.content || '')}</textarea></label>
      <label class="check"><input type="checkbox" name="highlight" ${e.highlight ? 'checked' : ''}> Événement majeur (mis en valeur)</label>
      <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Annuler</button><button class="btn">Enregistrer</button></div></form>`);
    m.querySelector('form').onsubmit = async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const tm = /(\d+)\D*$/.exec(f.topic.value.trim());
      const row = { era: f.era.value.trim(), icon: f.icon.value.trim() || '✦', position: Number(f.position.value) || 0, title: f.title.value.trim(), content: f.content.value.trim() || null, highlight: f.highlight.checked, topic_id: tm ? Number(tm[1]) : null, updated_at: new Date().toISOString() };
      try {
        if (e.id) await q(sb.from('timeline_events').update(row).eq('id', e.id));
        else await q(sb.from('timeline_events').insert({ ...row, created_by: state.profile.id }));
        m.remove(); toast('Chronologie mise à jour.', 'ok');
        if (location.hash.includes('?')) go('#/chronologie'); else router();
      } catch (err) { fail(/foreign key/i.test(err.message || '') ? new Error('Ce sujet n’existe pas : vérifiez son numéro.') : err); }
    };
  };
  root.querySelector('#new-tl')?.addEventListener('click', () => open());
  root.querySelectorAll('[data-edit-tl]').forEach((b) => b.addEventListener('click', () => open(list.find((x) => x.id === Number(b.dataset.editTl)))));
  root.querySelectorAll('[data-del-tl]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Supprimer cet événement de la chronologie ?')) return;
    try { await q(sb.from('timeline_events').delete().eq('id', Number(b.dataset.delTl))); router(); } catch (err) { fail(err); }
  }));
  if (isStaff() && params?.get('ajouter')) open({ title: params.get('titre') || '', icon: params.get('icone') || '✦', topic_id: Number(params.get('sujet')) || null });
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
