'use strict';

/* ─── DOM Refs ──────────────────────────────────── */
const form = document.getElementById('resumeForm');
const completionBar = document.getElementById('completionBar');
const completionPct = document.getElementById('completionPct');
const autosaveStatus = document.getElementById('autosaveStatus');
const saveIndicator = document.getElementById('saveIndicator');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.querySelector('.builder-sidebar');

/* ─── Sidebar Toggle ────────────────────────────── */
if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

/* ─── Sidebar Navigation ────────────────────────── */
document.querySelectorAll('.sidebar-link[data-section]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const section = document.getElementById('section-' + link.dataset.section);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      if (window.innerWidth <= 768) sidebar.classList.remove('open');
    }
  });
});

/* ─── Collapsible Items ─────────────────────────── */
document.addEventListener('click', (e) => {
  const toggle = e.target.closest('.btn-item-toggle');
  if (toggle) {
    const item = toggle.closest('.repeatable-item');
    const body = item.querySelector('.item-body');
    const icon = toggle.querySelector('i');
    const collapsed = body.classList.toggle('collapsed');
    icon.style.transform = collapsed ? 'rotate(-90deg)' : '';
  }
});

/* ─── Remove Item ───────────────────────────────── */
document.addEventListener('click', (e) => {
  const removeBtn = e.target.closest('.btn-item-remove');
  if (removeBtn) {
    const item = removeBtn.closest('.repeatable-item');
    if (confirm('Remove this item?')) {
      item.style.animation = 'fadeOut 0.2s ease forwards';
      setTimeout(() => { item.remove(); updateCounts(); updateCompletion(); }, 200);
    }
  }
});

/* ─── Current Job Checkbox ──────────────────────── */
document.addEventListener('change', (e) => {
  if (e.target.classList.contains('current-job-check')) {
    const item = e.target.closest('.repeatable-item');
    const endDate = item.querySelector('.end-date-field');
    if (endDate) {
      endDate.disabled = e.target.checked;
      if (e.target.checked) endDate.value = '';
    }
  }
});

/* ─── Dynamic Item Titles ───────────────────────── */
document.addEventListener('input', (e) => {
  const input = e.target;
  const item = input.closest('.repeatable-item');
  if (!item) return;

  // Update item header title dynamically
  const titleEl = item.querySelector('.item-title');
  if (!titleEl) return;

  if (input.name === 'exp_position[]' || input.name === 'exp_company[]') {
    const pos = item.querySelector('[name="exp_position[]"]')?.value || 'New Position';
    const co = item.querySelector('[name="exp_company[]"]')?.value || '';
    titleEl.innerHTML = `<strong>${pos}</strong>${co ? ` <span class="text-muted">@ ${co}</span>` : ''}`;
  } else if (input.name === 'edu_school[]') {
    titleEl.innerHTML = `<strong>${input.value || 'New Education'}</strong>`;
  } else if (input.name === 'skill_category[]') {
    titleEl.innerHTML = `<strong>${input.value || 'New Skill Category'}</strong>`;
  } else if (input.name === 'proj_name[]') {
    titleEl.innerHTML = `<strong>${input.value || 'New Project'}</strong>`;
  } else if (input.name === 'cert_name[]') {
    titleEl.innerHTML = `<strong>${input.value || 'New Certification'}</strong>`;
  } else if (input.name === 'lang_name[]') {
    titleEl.innerHTML = `<strong>${input.value || 'New Language'}</strong>`;
  }

  updateCompletion();
  scheduleAutoSave();
});

/* ─── Add Buttons ───────────────────────────────── */
function createItem(html, listId, emptyId) {
  const list = document.getElementById(listId);
  const empty = document.getElementById(emptyId);
  if (empty) empty.remove();

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const el = wrapper.firstChild;
  el.style.animation = 'sectionSlide 0.3s ease';
  list.appendChild(el);

  // Auto-scroll to new item
  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  updateCounts();
  updateCompletion();
}

function getItemIndex(listId) {
  return document.getElementById(listId).querySelectorAll('.repeatable-item').length;
}

document.getElementById('addExperience')?.addEventListener('click', () => {
  const i = getItemIndex('experienceList');
  createItem(`
  <div class="repeatable-item" data-index="${i}">
    <div class="item-header">
      <div class="item-drag"><i class="fas fa-grip-vertical"></i></div>
      <div class="item-title"><strong>New Position</strong></div>
      <div class="item-actions">
        <button type="button" class="btn-item-toggle"><i class="fas fa-chevron-down"></i></button>
        <button type="button" class="btn-item-remove"><i class="fas fa-times"></i></button>
      </div>
    </div>
    <div class="item-body">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label required">Company / Organization</label>
          <input type="text" name="exp_company[]" class="form-control rf-input" required placeholder="Acme Corp">
        </div>
        <div class="col-md-6">
          <label class="form-label required">Job Title</label>
          <input type="text" name="exp_position[]" class="form-control rf-input" required placeholder="Senior Developer">
        </div>
        <div class="col-md-5">
          <label class="form-label">Start Date</label>
          <input type="month" name="exp_start[]" class="form-control rf-input">
        </div>
        <div class="col-md-5">
          <label class="form-label">End Date</label>
          <input type="month" name="exp_end[]" class="form-control rf-input end-date-field">
        </div>
        <div class="col-md-2 d-flex align-items-end">
          <div class="form-check mb-2">
            <input class="form-check-input current-job-check" type="checkbox" name="exp_current[]" id="expCurrent${i}">
            <label class="form-check-label" for="expCurrent${i}">Current</label>
          </div>
        </div>
        <div class="col-12">
          <label class="form-label">Description / Achievements</label>
          <textarea name="exp_desc[]" class="form-control rf-textarea" rows="4" maxlength="1000"
            placeholder="• Led development of microservices...&#10;• Reduced API response time by 40%"></textarea>
          <div class="form-hint">Use bullet points (•) for achievements. Focus on impact and metrics.</div>
        </div>
      </div>
    </div>
  </div>`, 'experienceList', 'expEmptyState');
});

document.getElementById('addEducation')?.addEventListener('click', () => {
  const i = getItemIndex('educationList');
  createItem(`
  <div class="repeatable-item" data-index="${i}">
    <div class="item-header">
      <div class="item-drag"><i class="fas fa-grip-vertical"></i></div>
      <div class="item-title"><strong>New Education</strong></div>
      <div class="item-actions">
        <button type="button" class="btn-item-toggle"><i class="fas fa-chevron-down"></i></button>
        <button type="button" class="btn-item-remove"><i class="fas fa-times"></i></button>
      </div>
    </div>
    <div class="item-body">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label required">School / University</label>
          <input type="text" name="edu_school[]" class="form-control rf-input" required placeholder="MIT">
        </div>
        <div class="col-md-6">
          <label class="form-label">Degree</label>
          <input type="text" name="edu_degree[]" class="form-control rf-input" placeholder="Bachelor of Science">
        </div>
        <div class="col-md-6">
          <label class="form-label">Field of Study</label>
          <input type="text" name="edu_field[]" class="form-control rf-input" placeholder="Computer Science">
        </div>
        <div class="col-md-2">
          <label class="form-label">GPA</label>
          <input type="text" name="edu_gpa[]" class="form-control rf-input" placeholder="3.8">
        </div>
        <div class="col-md-2">
          <label class="form-label">Start</label>
          <input type="month" name="edu_start[]" class="form-control rf-input">
        </div>
        <div class="col-md-2">
          <label class="form-label">End</label>
          <input type="month" name="edu_end[]" class="form-control rf-input">
        </div>
      </div>
    </div>
  </div>`, 'educationList', 'eduEmptyState');
});

document.getElementById('addSkill')?.addEventListener('click', () => {
  const i = getItemIndex('skillsList');
  createItem(`
  <div class="repeatable-item" data-index="${i}">
    <div class="item-header">
      <div class="item-drag"><i class="fas fa-grip-vertical"></i></div>
      <div class="item-title"><strong>New Skill Category</strong></div>
      <div class="item-actions">
        <button type="button" class="btn-item-toggle"><i class="fas fa-chevron-down"></i></button>
        <button type="button" class="btn-item-remove"><i class="fas fa-times"></i></button>
      </div>
    </div>
    <div class="item-body">
      <div class="row g-3">
        <div class="col-md-4">
          <label class="form-label required">Category</label>
          <input type="text" name="skill_category[]" class="form-control rf-input" required placeholder="Frontend">
        </div>
        <div class="col-md-8">
          <label class="form-label">Skills <span class="text-muted">(comma separated)</span></label>
          <input type="text" name="skill_items[]" class="form-control rf-input" placeholder="React, TypeScript, CSS, Webpack">
        </div>
      </div>
    </div>
  </div>`, 'skillsList', 'skillsEmptyState');
});

document.getElementById('addProject')?.addEventListener('click', () => {
  const i = getItemIndex('projectsList');
  createItem(`
  <div class="repeatable-item" data-index="${i}">
    <div class="item-header">
      <div class="item-drag"><i class="fas fa-grip-vertical"></i></div>
      <div class="item-title"><strong>New Project</strong></div>
      <div class="item-actions">
        <button type="button" class="btn-item-toggle"><i class="fas fa-chevron-down"></i></button>
        <button type="button" class="btn-item-remove"><i class="fas fa-times"></i></button>
      </div>
    </div>
    <div class="item-body">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label required">Project Name</label>
          <input type="text" name="proj_name[]" class="form-control rf-input" required placeholder="My Awesome App">
        </div>
        <div class="col-md-6">
          <label class="form-label">Technologies Used</label>
          <input type="text" name="proj_tech[]" class="form-control rf-input" placeholder="Node.js, React, PostgreSQL">
        </div>
        <div class="col-12">
          <label class="form-label">Project URL</label>
          <input type="url" name="proj_url[]" class="form-control rf-input" placeholder="https://github.com/you/project">
        </div>
        <div class="col-12">
          <label class="form-label">Description</label>
          <textarea name="proj_desc[]" class="form-control rf-textarea" rows="3" maxlength="600" placeholder="A full-stack platform..."></textarea>
        </div>
      </div>
    </div>
  </div>`, 'projectsList', 'projEmptyState');
});

document.getElementById('addCertification')?.addEventListener('click', () => {
  const i = getItemIndex('certificationsList');
  createItem(`
  <div class="repeatable-item" data-index="${i}">
    <div class="item-header">
      <div class="item-drag"><i class="fas fa-grip-vertical"></i></div>
      <div class="item-title"><strong>New Certification</strong></div>
      <div class="item-actions">
        <button type="button" class="btn-item-toggle"><i class="fas fa-chevron-down"></i></button>
        <button type="button" class="btn-item-remove"><i class="fas fa-times"></i></button>
      </div>
    </div>
    <div class="item-body">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label required">Certification Name</label>
          <input type="text" name="cert_name[]" class="form-control rf-input" required placeholder="AWS Solutions Architect">
        </div>
        <div class="col-md-6">
          <label class="form-label">Issuing Organization</label>
          <input type="text" name="cert_issuer[]" class="form-control rf-input" placeholder="Amazon Web Services">
        </div>
        <div class="col-md-4">
          <label class="form-label">Date Earned</label>
          <input type="month" name="cert_date[]" class="form-control rf-input">
        </div>
        <div class="col-md-8">
          <label class="form-label">Credential URL</label>
          <input type="url" name="cert_url[]" class="form-control rf-input" placeholder="https://www.credly.com/badges/...">
        </div>
      </div>
    </div>
  </div>`, 'certificationsList', 'certEmptyState');
});

document.getElementById('addLanguage')?.addEventListener('click', () => {
  const i = getItemIndex('languagesList');
  createItem(`
  <div class="repeatable-item" data-index="${i}">
    <div class="item-header">
      <div class="item-drag"><i class="fas fa-grip-vertical"></i></div>
      <div class="item-title"><strong>New Language</strong></div>
      <div class="item-actions">
        <button type="button" class="btn-item-toggle"><i class="fas fa-chevron-down"></i></button>
        <button type="button" class="btn-item-remove"><i class="fas fa-times"></i></button>
      </div>
    </div>
    <div class="item-body">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label required">Language</label>
          <input type="text" name="lang_name[]" class="form-control rf-input" required placeholder="English">
        </div>
        <div class="col-md-6">
          <label class="form-label">Proficiency Level</label>
          <select name="lang_level[]" class="form-select rf-input">
            <option value="">Select level...</option>
            <option>Native</option>
            <option>Fluent</option>
            <option>Advanced</option>
            <option>Intermediate</option>
            <option>Basic</option>
          </select>
        </div>
      </div>
    </div>
  </div>`, 'languagesList', 'langEmptyState');
});

/* ─── Drag & Drop Sorting ───────────────────────── */
['experienceList','educationList','skillsList','projectsList','certificationsList','languagesList'].forEach(id => {
  const el = document.getElementById(id);
  if (el && window.Sortable) {
    Sortable.create(el, {
      handle: '.item-drag',
      animation: 200,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
    });
  }
});

/* ─── Character Counter ─────────────────────────── */
const summaryField = document.querySelector('[name="summary"]');
const summaryCount = document.getElementById('summaryCount');
if (summaryField && summaryCount) {
  summaryCount.textContent = summaryField.value.length;
  summaryField.addEventListener('input', () => {
    summaryCount.textContent = summaryField.value.length;
  });
}

/* ─── Completion Progress ───────────────────────── */
function updateCompletion() {
  const checks = [
    () => !!document.querySelector('[name="name"]')?.value,
    () => !!document.querySelector('[name="title"]')?.value,
    () => !!document.querySelector('[name="email"]')?.value,
    () => !!document.querySelector('[name="phone"]')?.value,
    () => !!document.querySelector('[name="location"]')?.value,
    () => !!document.querySelector('[name="summary"]')?.value,
    () => document.querySelectorAll('#experienceList .repeatable-item').length > 0,
    () => document.querySelectorAll('#educationList .repeatable-item').length > 0,
    () => document.querySelectorAll('#skillsList .repeatable-item').length > 0,
    () => document.querySelectorAll('#projectsList .repeatable-item').length > 0,
  ];
  const done = checks.filter(c => c()).length;
  const pct = Math.round((done / checks.length) * 100);
  if (completionBar) completionBar.style.width = pct + '%';
  if (completionPct) completionPct.textContent = pct + '%';
}

function updateCounts() {
  const sections = {
    experience: 'experienceList',
    education: 'educationList',
    skills: 'skillsList',
    projects: 'projectsList',
    certifications: 'certificationsList',
    languages: 'languagesList',
  };
  Object.entries(sections).forEach(([key, listId]) => {
    const count = document.querySelectorAll(`#${listId} .repeatable-item`).length;
    const badge = document.getElementById('count-' + key);
    if (badge) {
      badge.textContent = count || '';
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  });
}

/* ─── Color Picker ──────────────────────────────── */
const accentInput = document.getElementById('accentColorInput');
const customColor = document.getElementById('customColor');

document.querySelectorAll('.color-swatch:not(.color-custom-btn)').forEach(swatch => {
  const c = swatch.style.background;
  if (accentInput && accentInput.value && c.replace(/\s/g,'').toLowerCase() === hexToRgbString(accentInput.value)) {
    swatch.classList.add('active');
  }
  swatch.addEventListener('click', () => {
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    if (accentInput) accentInput.value = swatch.dataset.color;
    scheduleAutoSave();
  });
});

if (customColor && accentInput) {
  customColor.addEventListener('input', () => {
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    accentInput.value = customColor.value;
    scheduleAutoSave();
  });
}

function hexToRgbString(hex) {
  if (!hex) return '';
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${r},${g},${b})`;
}

// Set initial active swatch
if (accentInput) {
  document.querySelectorAll('.color-swatch[data-color]').forEach(s => {
    if (s.dataset.color === accentInput.value) s.classList.add('active');
  });
}

/* ─── Auto-Save ─────────────────────────────────── */
let autoSaveTimer = null;
function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  if (autosaveStatus) { autosaveStatus.innerHTML = '<i class="fas fa-circle-notch fa-spin me-1"></i>Saving...'; }
  if (saveIndicator) { saveIndicator.innerHTML = '<i class="fas fa-circle-notch fa-spin text-warning me-1"></i>Saving...'; }
  autoSaveTimer = setTimeout(doAutoSave, 1500);
}

async function doAutoSave() {
  const data = collectFormData();
  try {
    const res = await fetch('/resume/save-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.success) {
      if (autosaveStatus) autosaveStatus.innerHTML = '<i class="fas fa-check-circle text-success me-1"></i>Saved';
      if (saveIndicator) saveIndicator.innerHTML = '<i class="fas fa-check-circle text-success me-1"></i>All changes saved';
    }
  } catch(e) {
    if (autosaveStatus) autosaveStatus.innerHTML = '<i class="fas fa-exclamation-circle text-warning me-1"></i>Save failed';
  }
}

function collectFormData() {
  const fd = new FormData(form);
  const data = {};
  for (const [k, v] of fd.entries()) {
    if (k.endsWith('[]')) {
      const key = k.slice(0,-2);
      if (!data[key]) data[key] = [];
      data[key].push(v);
    } else {
      data[k] = v;
    }
  }
  return data;
}

/* ─── Form input auto-save trigger ─────────────── */
form?.addEventListener('input', () => {
  updateCompletion();
  scheduleAutoSave();
});

/* ─── Form submit validation ────────────────────── */
form?.addEventListener('submit', (e) => {
  const nameField = document.querySelector('[name="name"]');
  if (!nameField?.value?.trim()) {
    e.preventDefault();
    nameField?.focus();
    nameField?.closest('.input-group-rf')?.classList.add('shake');
    setTimeout(() => nameField?.closest('.input-group-rf')?.classList.remove('shake'), 500);
    showToast('Please enter your full name to continue.', 'error');
    return;
  }
});

/* ─── Toast Notification ────────────────────────── */
function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `rf-toast rf-toast-${type}`;
  toast.innerHTML = `<i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'} me-2"></i>${msg}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

/* ─── Toast styles (injected) ───────────────────── */
const toastStyle = document.createElement('style');
toastStyle.textContent = `
  .rf-toast {
    position: fixed; bottom: 90px; right: 24px; z-index: 9999;
    background: #1e1e32; border: 1px solid rgba(255,255,255,0.1);
    color: #fff; padding: 12px 20px; border-radius: 10px;
    font-size: 0.85rem; font-weight: 500;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    transform: translateX(120%); transition: transform 0.3s ease;
    display: flex; align-items: center;
  }
  .rf-toast.show { transform: translateX(0); }
  .rf-toast-error { border-color: rgba(239,68,68,0.3); }
  .rf-toast-error i { color: #ef4444; }
  .rf-toast-success i { color: #4ade80; }
  @keyframes shake {
    0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)}
    60%{transform:translateX(-4px)} 80%{transform:translateX(4px)}
  }
  .shake { animation: shake 0.4s ease; }
  @keyframes fadeOut { to { opacity:0; transform:scale(0.95); } }
`;
document.head.appendChild(toastStyle);

/* ─── Init ──────────────────────────────────────── */
updateCounts();
updateCompletion();
setTimeout(() => {
  if (autosaveStatus) autosaveStatus.innerHTML = '<i class="fas fa-check-circle text-success me-1"></i>Ready';
}, 800);
