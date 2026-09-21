'use strict';
const app = document.querySelector('#app');
let token = sessionStorage.getItem('accessToken');
let csrf = '';
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
async function api(path, opts = {}) {
  const response = await fetch(path, { ...opts, headers: { 'content-type':'application/json', ...(token ? { authorization:`Bearer ${token}` } : {}), ...(opts.method && opts.method !== 'GET' ? { 'x-csrf-token': csrf } : {}), ...(opts.headers || {}) } });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `HTTP_${response.status}`);
  return response.status === 204 ? null : response.json();
}
async function loadCsrf() { csrf = (await api('/api/v1/csrf')).csrfToken; }
function notice(text, kind = 'green') { const node = document.querySelector('#notice'); if (node) { node.className = `notice ${kind}`; node.textContent = text; } }
async function renderDash() {
  app.innerHTML = `<div class="shell"><aside class="side"><div class="brand">Takamura <span>Bot Pro</span></div><nav><button class="active" data-view="overview">Vue d’ensemble</button><button data-view="sessions">Sessions WhatsApp</button><button data-view="commands">Commandes V1</button></nav></aside><main class="main"><header class="top"><div><div class="eyebrow">Control plane / WhatsApp runtime</div><h1 class="title">Takamura Bot Pro</h1><p class="muted">Les actions ci-dessous pilotent le moteur Baileys réel.</p></div><div class="status"><i class="dot"></i>Service disponible</div></header><div id="notice" class="notice" aria-live="polite"></div><section id="content"></section></main></div>`;
  document.querySelectorAll('nav button').forEach((button) => button.onclick = () => view(button.dataset.view));
  await view('overview');
}
async function view(name) {
  document.querySelectorAll('nav button').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
  const content = document.querySelector('#content');
  try {
    if (name === 'overview') {
      const data = (await api('/api/v1/stats')).data;
      content.innerHTML = `<div class="grid">${[['Bots actifs',data.bots],['Sessions connectées',data.connected],['Commandes V1',data.commands],['Utilisateurs',data.users]].map(([label,value]) => `<article class="card"><div class="label">${label}</div><div class="metric">${esc(value)}</div><div class="label">État réel du backend</div></article>`).join('')}</div><div class="section card"><h2>Parcours rapide</h2><p class="muted">Ouvrez « Sessions WhatsApp », saisissez le numéro au format international sans +, puis utilisez le code à 8 caractères affiché pour lier WhatsApp.</p><button class="btn" id="go-sessions">Ajouter une session</button></div>`;
      document.querySelector('#go-sessions').onclick = () => view('sessions');
    }
    if (name === 'sessions') {
      const data = (await api('/api/v1/sessions')).data;
      content.innerHTML = `<div class="card"><div class="section-head"><div><h2>Sessions WhatsApp</h2><p class="muted">Le pairing démarre un socket Baileys persistant et stocke les credentials dans le runtime.</p></div></div><form id="create-session" class="session-form"><label>Numéro WhatsApp<input id="phone" inputmode="numeric" placeholder="2376XXXXXXXX" minlength="8" required></label><button class="btn" type="submit">Générer le code</button></form><div id="pairing-result"></div><div class="table-wrap"><table class="table"><thead><tr><th>Identifiant</th><th>Numéro</th><th>État</th><th>Action</th></tr></thead><tbody>${data.length ? data.map((session) => `<tr><td>${esc(session.id.slice(0,8))}</td><td>${esc(session.phoneNumber)}</td><td><span class="pill">${esc(session.state)}</span></td><td><button class="btn small pair" data-id="${esc(session.id)}">Pairer</button> <button class="btn small danger disable" data-id="${esc(session.id)}">Désactiver</button></td></tr>`).join('') : '<tr><td colspan="4" class="empty">Aucune session. Ajoutez un numéro ci-dessus.</td></tr>'}</tbody></table></div></div>`;
      document.querySelector('#create-session').onsubmit = async (event) => { event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true; try { const result = await api('/api/v1/sessions', { method:'POST', body: JSON.stringify({ phoneNumber: document.querySelector('#phone').value }) }); const pairing = result.data.pairing; document.querySelector('#pairing-result').innerHTML = `<div class="pairing-card"><div class="label">Code de liaison WhatsApp</div><strong>${esc(pairing.code || 'En cours de connexion')}</strong><p class="muted">Sur le téléphone : WhatsApp → Appareils connectés → Connecter un appareil → Lier avec un numéro, puis saisissez ce code.</p></div>`; notice('Session créée. Le moteur Baileys attend la liaison WhatsApp.'); await view('sessions'); } catch (error) { notice(`Création impossible : ${error.message}`, 'red'); } finally { button.disabled = false; } };
      document.querySelectorAll('.pair').forEach((button) => button.onclick = async () => { try { const result = await api(`/api/v1/sessions/${button.dataset.id}/pair`, { method:'POST' }); notice(`Pairing : ${result.data.code || result.data.status}`); if (result.data.code) document.querySelector('#pairing-result').innerHTML = `<div class="pairing-card"><div class="label">Code de liaison WhatsApp</div><strong>${esc(result.data.code)}</strong></div>`; } catch (error) { notice(`Pairing impossible : ${error.message}`, 'red'); } });
      document.querySelectorAll('.disable').forEach((button) => button.onclick = async () => { try { await api(`/api/v1/sessions/${button.dataset.id}/disable`, { method:'POST' }); notice('Session désactivée.'); await view('sessions'); } catch (error) { notice(`Désactivation impossible : ${error.message}`, 'red'); } });
    }
    if (name === 'commands') {
      const data = (await api('/api/v1/commands')).data;
      content.innerHTML = `<div class="card"><h2>Registre des commandes V1 · ${data.length}</h2><p class="muted">Ces commandes sont chargées depuis le dossier V1 et exécutées sur les messages reçus par Baileys.</p><div class="table-wrap"><table class="table"><thead><tr><th>Commande</th><th>Catégorie</th><th>Risque</th><th>Statut</th></tr></thead><tbody>${data.map((command) => `<tr><td><b>.${esc(command.name)}</b><br><span class="muted">${esc(command.description)}</span></td><td>${esc(command.category)}</td><td class="${command.risk === 'critical' ? 'amber' : ''}">${esc(command.risk)}</td><td>${command.enabled ? 'Activée' : 'Protégée par défaut'}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
  } catch (error) { content.innerHTML = `<div class="card"><p class="empty">Données indisponibles : ${esc(error.message)}</p></div>`; }
}
async function bootstrap() {
  try { if (!token) { const demo = await fetch('/api/v1/auth/demo'); if (demo.ok) { const data = await demo.json(); token = data.accessToken; sessionStorage.setItem('accessToken', token); } } if (!token) throw new Error('PUBLIC_MODE_NOT_ACTIVE'); await loadCsrf(); await renderDash(); } catch (error) { app.innerHTML = `<main class="login card"><h1>Service indisponible</h1><p class="muted">${esc(error.message)}</p></main>`; }
}
bootstrap();
