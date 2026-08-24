const STORAGE_KEY = 'midtown-snag-list:v1';
const rooms = ['Bedroom 1', 'Bedroom 2', 'Bedroom 3', 'Bathroom 1', 'Bathroom 2', 'Bathroom 3', 'Living Room', 'Kitchen'];
const vendors = ['Carpenter', 'Plumber', 'Tiling', 'Electrical', 'Window', 'POP', 'Pappu Singh', 'Painter', 'Housekeeping'];
const statuses = ['Open', 'In Progress', 'Resolved', 'Verified'];
const flats = Array.from({ length: 15 }, (_, i) => i + 4).flatMap((floor) =>
  Array.from({ length: 10 }, (_, i) => `${floor}${String(i + 1).padStart(2, '0')}`),
);
const $ = (sel) => document.querySelector(sel);
const app = $('#app');
let snags = loadSnags();
let editingId = null;
let selectedId = null;
let filters = { flat: '', vendor: '', status: '', room: '', search: '' };
let view = 'all';
let draftPhotos = [];

function loadSnags() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(snags)); }
function today() { return new Date().toISOString().slice(0, 10); }
function esc(value = '') { return String(value).replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }
function options(items, current = '', blank = '') { return `${blank ? `<option value="">${blank}</option>` : ''}${items.map((x) => `<option ${x === current ? 'selected' : ''}>${x}</option>`).join('')}`; }
function badge(status) { return `<span class="badge ${status.toLowerCase().replaceAll(' ', '-')}">${status}</span>`; }
function currentForm() {
  return editingId ? snags.find((s) => s.id === editingId) : { flat: flats[0], room: rooms[0], vendor: vendors[0], description: '', photos: draftPhotos, date: today(), reportedBy: '', status: 'Open' };
}
function filteredSnags() {
  return snags.filter((s) => (!filters.flat || s.flat === filters.flat) && (!filters.vendor || s.vendor === filters.vendor) && (!filters.status || s.status === filters.status) && (!filters.room || s.room === filters.room) && (!filters.search || s.description.toLowerCase().includes(filters.search.toLowerCase()))).sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));
}
function render() {
  const form = currentForm();
  const counts = Object.fromEntries(['Total', ...statuses].map((s) => [s, s === 'Total' ? snags.length : snags.filter((x) => x.status === s).length]));
  const list = filteredSnags();
  app.innerHTML = `
    <header class="hero"><div><p class="eyebrow">Residential tower handover</p><h1>Midtown Snag List</h1><p>Log defects by flat, room and vendor while walking the site.</p></div><button id="exportCsv">⬇ Export CSV</button></header>
    <section class="stats">${Object.entries(counts).map(([label, count]) => `<article><strong>${count}</strong><span>${label}</span></article>`).join('')}</section>
    <section class="panel form-panel"><h2>＋ ${editingId ? 'Edit snag' : 'Log a snag'}</h2><form id="snagForm">
      <label>Flat Number<input name="flat" list="flatOptions" value="${esc(form.flat)}" required><datalist id="flatOptions">${flats.map((f) => `<option value="${f}">`).join('')}</datalist></label>
      <label>Room<select name="room">${options(rooms, form.room)}</select></label><label>Vendor<select name="vendor">${options(vendors, form.vendor)}</select></label><label>Status<select name="status">${options(statuses, form.status)}</select></label>
      <label class="wide">Description<textarea name="description" required placeholder="Describe the issue, location, and action needed">${esc(form.description)}</textarea></label>
      <label>Date noticed<input name="date" type="date" value="${esc(form.date)}"></label><label>Reported by<input name="reportedBy" value="${esc(form.reportedBy)}" placeholder="Inspector name"></label>
      <label class="upload">📷 Photo(s)<input id="photoInput" type="file" accept="image/*" capture="environment" multiple></label>
      <div class="previews wide">${(form.photos || []).map((p, i) => `<figure><img src="${p.data}" alt="${esc(p.name)}"><button type="button" data-remove-photo="${i}">Remove</button></figure>`).join('')}</div>
      <div class="actions wide"><button type="submit">${editingId ? 'Save changes' : 'Add snag'}</button>${editingId ? '<button type="button" class="secondary" id="cancelEdit">Cancel</button>' : ''}</div>
    </form></section>
    <section class="panel"><div class="tabs"><button class="${view === 'all' ? 'active' : ''}" data-view="all">🔎 All snags</button><button class="${view === 'flat' ? 'active' : ''}" data-view="flat">🏠 Per flat</button><button class="${view === 'vendor' ? 'active' : ''}" data-view="vendor">👷 Per vendor</button></div>
      <div class="filters"><input id="search" placeholder="Search descriptions" value="${esc(filters.search)}"><label>Flat<select data-filter="flat">${options(flats, filters.flat, 'All flats')}</select></label><label>Vendor<select data-filter="vendor">${options(vendors, filters.vendor, 'All vendors')}</select></label><label>Status<select data-filter="status">${options(statuses, filters.status, 'All statuses')}</select></label><label>Room<select data-filter="room">${options(rooms, filters.room, 'All rooms')}</select></label></div>
      <div id="snagList">${view === 'flat' ? groupedCards(list) : cards(list)}</div>
    </section>${selectedId ? detail(snags.find((s) => s.id === selectedId)) : ''}`;
  bindEvents();
}
function cards(items) { return `<div class="cards">${items.length ? items.map((s) => `<article class="card" data-open="${s.id}"><div><b>Flat ${s.flat}</b>${badge(s.status)}</div><p>${s.room} · ${s.vendor}</p><p>${esc(s.description)}</p><small>${s.date} · ${esc(s.reportedBy || 'Unassigned')}</small>${s.photos?.[0] ? `<img src="${s.photos[0].data}" alt="Snag thumbnail">` : ''}</article>`).join('') : '<p class="empty">No snags match the current filters.</p>'}</div>`; }
function groupedCards(items) { const groups = rooms.map((room) => ({ room, items: items.filter((s) => s.room === room) })).filter((g) => g.items.length); return groups.length ? `<div class="groups">${groups.map((g) => `<section><h3>${g.room}</h3>${cards(g.items)}</section>`).join('')}</div>` : '<p class="empty">Select a flat with snags to review by room.</p>'; }
function detail(s) { return `<div class="modal" id="modal"><article><button class="close" id="closeModal">×</button><h2>Flat ${s.flat}: ${s.room}</h2>${badge(s.status)}<p><b>Vendor:</b> ${s.vendor}</p><p><b>Date noticed:</b> ${s.date}</p><p><b>Reported by:</b> ${esc(s.reportedBy || 'Not entered')}</p><p>${esc(s.description)}</p><label>Update status<select id="detailStatus">${options(statuses, s.status)}</select></label><div class="photos">${(s.photos || []).map((p) => `<img src="${p.data}" alt="${esc(p.name)}">`).join('')}</div><button id="editSelected">Edit snag</button></article></div>`; }
async function resizePhoto(file) {
  const dataUrl = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
  const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = dataUrl; });
  const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return { name: file.name, data: canvas.toDataURL('image/jpeg', 0.78) };
}
function bindEvents() {
  $('#exportCsv').onclick = exportCsv;
  $('#snagForm').onsubmit = (e) => { e.preventDefault(); const fd = new FormData(e.target); if (!flats.includes(fd.get('flat'))) return alert('Choose a valid Midtown flat number.'); const payload = { flat: fd.get('flat'), room: fd.get('room'), vendor: fd.get('vendor'), status: fd.get('status'), description: fd.get('description').trim(), date: fd.get('date'), reportedBy: fd.get('reportedBy'), photos: currentForm().photos || [] }; if (editingId) snags = snags.map((s) => s.id === editingId ? { ...s, ...payload, updatedAt: new Date().toISOString() } : s); else snags.unshift({ ...payload, id: crypto.randomUUID(), createdAt: new Date().toISOString() }); draftPhotos = []; editingId = null; persist(); render(); };
  $('#photoInput').onchange = async (e) => { const photos = await Promise.all([...e.target.files].map(resizePhoto)); if (editingId) snags = snags.map((s) => s.id === editingId ? { ...s, photos: [...(s.photos || []), ...photos] } : s); else draftPhotos = [...draftPhotos, ...photos]; persist(); render(); };
  document.querySelectorAll('[data-remove-photo]').forEach((b) => b.onclick = () => { if (editingId) { const f = currentForm(); f.photos.splice(Number(b.dataset.removePhoto), 1); } else draftPhotos.splice(Number(b.dataset.removePhoto), 1); persist(); render(); });
  $('#cancelEdit')?.addEventListener('click', () => { draftPhotos = []; editingId = null; persist(); render(); });
  document.querySelectorAll('[data-filter]').forEach((el) => el.onchange = () => { filters[el.dataset.filter] = el.value; render(); });
  $('#search').oninput = (e) => { filters.search = e.target.value; render(); };
  document.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => { view = b.dataset.view; render(); });
  document.querySelectorAll('[data-open]').forEach((c) => c.onclick = () => { selectedId = c.dataset.open; render(); });
  $('#closeModal')?.addEventListener('click', () => { selectedId = null; render(); });
  $('#modal')?.addEventListener('click', (e) => { if (e.target.id === 'modal') { selectedId = null; render(); } });
  $('#detailStatus')?.addEventListener('change', (e) => { snags = snags.map((s) => s.id === selectedId ? { ...s, status: e.target.value } : s); persist(); render(); });
  $('#editSelected')?.addEventListener('click', () => { editingId = selectedId; selectedId = null; window.scrollTo({ top: 0, behavior: 'smooth' }); render(); });
}
function exportCsv() {
  const rows = [['Flat', 'Room', 'Vendor', 'Status', 'Date noticed', 'Reported by', 'Description'], ...filteredSnags().map((s) => [s.flat, s.room, s.vendor, s.status, s.date, s.reportedBy, s.description])];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell || '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = 'midtown-snag-list.csv'; a.click(); URL.revokeObjectURL(url);
}
render();
