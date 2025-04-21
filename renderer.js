// renderer.js
let promptMDE, imageMDE, reviewMDE;

async function initApp() {
  console.log('[renderer] initApp() is running');
  migrateLegacyStorage();
  console.log('[renderer] initApp invoked');
  // Initialize editors
  try {
    promptMDE = new EasyMDE({
      element: document.getElementById('prompt-input'),
      spellChecker: false,
      toolbar: ["bold","italic","heading","|","quote","unordered-list","ordered-list","|","preview","guide"],
      status: false,
      minHeight: "180px"
    });
    styleToolbars();
  } catch (e) {
    displayError('EasyMDE failed to initialize prompt editor', e);
  }

  try {
    imageMDE = new EasyMDE({
      element: document.getElementById('image-prompt'),
      spellChecker: false,
      toolbar: ["bold","italic","heading","|","quote","unordered-list","ordered-list","|","preview","guide"],
      status: false,
      minHeight: "120px"
    });
    styleToolbars();
  } catch (e) {
    displayError('EasyMDE failed to initialize image editor', e);
  }

  try {
    reviewMDE = new EasyMDE({
      element: document.getElementById('review-editor'),
      spellChecker: false,
      toolbar: ["bold","italic","heading","|","quote","unordered-list","ordered-list","|","preview","guide"],
      status: false,
      minHeight: "220px"
    });
    styleToolbars();
    document.getElementById('toggle-preview-btn').onclick = () => reviewMDE.togglePreview();
  } catch (e) {
    displayError('EasyMDE failed to initialize review editor', e);
  }

  // Populate dropdowns and setup fields
  // Load persisted prompts and image strategies
  try {
    const persisted = await window.electronAPI.invoke('config-get', 'GenSparkPrompts');
    if (Array.isArray(persisted)) {
      localStorage.setItem('GenSparkPrompts', JSON.stringify(persisted));
    }
  } catch {}
  try {
    const persistedImg = await window.electronAPI.invoke('config-get', 'OpenAIImageStrategies');
    if (Array.isArray(persistedImg)) {
      localStorage.setItem('OpenAIImageStrategies', JSON.stringify(persistedImg));
    }
  } catch {}
  populatePromptDropdown();
  populateImageStrategyDropdown();
  populateLogoDropdown();

  // Wire prompt events
  document.getElementById('prompt-select').addEventListener('change', updatePromptFieldsFromDropdown);
  document.getElementById('load-prompt-btn').addEventListener('click', loadPromptToTextarea);
  document.getElementById('delete-prompt-btn').addEventListener('click', deleteSelectedPrompt);
  document.getElementById('save-prompt-btn').addEventListener('click', saveCurrentPrompt);

  // Wire up GenSpark automation test button
  document.getElementById('test-genspark-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const statusEl = document.getElementById('status');
    const errorLog = document.getElementById('error-log');
    const btn = document.getElementById('test-genspark-btn');
    errorLog.textContent = '';
    btn.disabled = true;
    statusEl.textContent = 'Running GenSpark automation...';
    try {
      const appsumoUrl = document.getElementById('appsumo-url').value.trim();
      const prompt = promptMDE.value().trim();
      if (!appsumoUrl || !/^https?:\/\//.test(appsumoUrl)) {
        errorLog.textContent = 'Please enter a valid AppSumo URL.';
        btn.disabled = false;
        statusEl.textContent = 'Idle';
        return;
      }
      if (!prompt) {
        errorLog.textContent = 'Please enter a prompt.';
        btn.disabled = false;
        statusEl.textContent = 'Idle';
        return;
      }
      // Use extraction method from toggle
      const extractionSelect = document.getElementById('extraction-method-select');
      const extractionMethod = extractionSelect ? extractionSelect.value : 'clipboard';
      statusEl.textContent = 'Submitting to GenSpark (' + extractionMethod + ')...';
      const result = await window.electronAPI.invoke('genspark-run', {
        appsumoUrl,
        promptTemplate: prompt,
        extractionMethod
      });
      let extracted = '';
      if (extractionMethod === 'clipboard') extracted = result.clipboard;
      else if (extractionMethod === 'dom') extracted = result.dom;
      if (extracted && extracted.length > 0) {
        showStep(2);
        const reviewEditor = document.getElementById('review-editor');
        if (reviewEditor) reviewEditor.value = extracted;
        if (window.reviewMDE) window.reviewMDE.value(extracted);
        statusEl.textContent = 'Article loaded via ' + extractionMethod + '!';
      } else {
        errorLog.textContent = 'GenSpark automation error: No article found (' + extractionMethod + ')';
        statusEl.textContent = 'Idle';
      }
    } catch (err) {
      errorLog.textContent = 'GenSpark automation error: ' + (err.message || err);
      statusEl.textContent = 'Idle';
    } finally {
      btn.disabled = false;
    }
  });

  // GenSpark Cookie Management UI logic (multi-slot)
  const cookieInput = document.getElementById('genspark-cookies-input');
  const cookieUpload = document.getElementById('genspark-cookies-upload');
  const cookieSaveBtn = document.getElementById('save-genspark-cookies-btn');
  const cookieStatus = document.getElementById('genspark-cookies-status');
  const cookieDropdown = document.createElement('select');
  cookieDropdown.id = 'genspark-cookies-dropdown';
  cookieDropdown.style.marginTop = '8px';
  cookieInput.parentNode.insertBefore(cookieDropdown, cookieInput.nextSibling);
  const cookieDeleteBtn = document.createElement('button');
  cookieDeleteBtn.textContent = 'Delete Selected';
  cookieDeleteBtn.type = 'button';
  cookieDeleteBtn.style.marginLeft = '8px';
  cookieDropdown.parentNode.insertBefore(cookieDeleteBtn, cookieDropdown.nextSibling);
  function refreshCookieDropdown(sets, activeId) {
    cookieDropdown.innerHTML = '';
    sets.forEach(set => {
      const opt = document.createElement('option');
      opt.value = set.id;
      opt.textContent = `${set.label} (${new Date(set.date).toLocaleString()})`;
      if (set.id === activeId) opt.selected = true;
      cookieDropdown.appendChild(opt);
    });
  }
  async function loadCookiesUI() {
    const store = await window.electronAPI.invoke('genspark-list-cookies');
    refreshCookieDropdown(store.sets, store.activeId);
    if (store.activeId) {
      const active = store.sets.find(s => s.id === store.activeId);
      if (active) cookieInput.value = JSON.stringify(active.cookies, null, 2);
    }
  }
  cookieDropdown.addEventListener('change', async () => {
    await window.electronAPI.invoke('genspark-set-active-cookies', cookieDropdown.value);
    await loadCookiesUI();
  });
  cookieDeleteBtn.addEventListener('click', async () => {
    if (!cookieDropdown.value) return;
    await window.electronAPI.invoke('genspark-delete-cookies', cookieDropdown.value);
    await loadCookiesUI();
  });
  if (cookieUpload) {
    cookieUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        cookieInput.value = evt.target.result;
      };
      reader.readAsText(file);
    });
  }
  // --- Modal for cookie label input ---
function showLabelModal(defaultLabel = '') {
  return new Promise((resolve) => {
    let modal = document.getElementById('cookie-label-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'cookie-label-modal';
      modal.style.position = 'fixed';
      modal.style.left = 0;
      modal.style.top = 0;
      modal.style.width = '100vw';
      modal.style.height = '100vh';
      modal.style.background = 'rgba(0,0,0,0.35)';
      modal.style.display = 'flex';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
      modal.style.zIndex = 9999;
      modal.innerHTML = `
        <div style="background:#fff;padding:24px 32px;border-radius:8px;box-shadow:0 2px 12px #0003;min-width:320px;">
          <label style="font-size:1rem;">Label for this cookie set:</label><br>
          <input id="cookie-label-input" style="width:100%;margin:12px 0;padding:8px 4px;font-size:1rem;" value="${defaultLabel.replace(/"/g, '&quot;')}">
          <div style="text-align:right;margin-top:8px;">
            <button id="cookie-label-cancel" style="margin-right:12px;">Cancel</button>
            <button id="cookie-label-ok" style="background:#1976d2;color:#fff;padding:6px 18px;border:none;border-radius:3px;">OK</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    const input = modal.querySelector('#cookie-label-input');
    input.value = defaultLabel;
    modal.style.display = 'flex';
    input.focus();
    function cleanup(val) {
      modal.style.display = 'none';
      resolve(val);
    }
    modal.querySelector('#cookie-label-ok').onclick = () => cleanup(input.value.trim() || 'Unnamed');
    modal.querySelector('#cookie-label-cancel').onclick = () => cleanup(null);
    input.onkeydown = (e) => {
      if (e.key === 'Enter') cleanup(input.value.trim() || 'Unnamed');
      if (e.key === 'Escape') cleanup(null);
    };
  });
}

// --- Save Cookies Button ---
if (cookieSaveBtn) {
  cookieSaveBtn.addEventListener('click', async () => {
    try {
      const val = cookieInput.value.trim();
      if (!val) throw new Error('No cookie data provided.');
      let parsed;
      try {
        parsed = JSON.parse(val);
      } catch(e) {
        cookieStatus.textContent = 'Invalid JSON: ' + e.message;
        cookieStatus.style.color = '#b00';
        return;
      }
      if (!Array.isArray(parsed)) throw new Error('Cookie data must be a JSON array.');
      const label = await showLabelModal('GenSpark Login');
      if (!label) {
        cookieStatus.textContent = 'Cookie save cancelled.';
        cookieStatus.style.color = '#b00';
        return;
      }
      await window.electronAPI.invoke('genspark-add-cookies', { label, cookies: parsed });
      cookieStatus.textContent = 'Cookies saved successfully!';
      cookieStatus.style.color = '#227';
      await loadCookiesUI();
    } catch(e) {
      cookieStatus.textContent = 'Error: ' + e.message;
      cookieStatus.style.color = '#b00';
    }
  });
}
  loadCookiesUI();

  // Add extraction method toggle to Step 1 (Options)
const step1 = document.getElementById('step-1');
const testBtn = document.getElementById('test-genspark-btn');
const extractionToggle = document.createElement('div');
extractionToggle.style.marginTop = '12px';
extractionToggle.innerHTML = `
  <label style="margin-right:8px;">Extraction Method:</label>
  <select id="extraction-method-select" style="font-size:1rem;">
    <option value="clipboard">Clipboard</option>
    <option value="dom">DOM Extraction</option>
  </select>
`;
if (testBtn && testBtn.parentNode) {
  testBtn.parentNode.insertBefore(extractionToggle, testBtn.nextSibling);
}
const extractionSelect = document.getElementById('extraction-method-select');

  document.getElementById('load-logo-btn').addEventListener('click', loadLogoToPreview);
  document.getElementById('delete-logo-btn').addEventListener('click', deleteSelectedLogo);
  document.getElementById('logo-upload').addEventListener('change', handleLogoUpload);
  document.getElementById('logo-url').addEventListener('change', handleLogoUrlInput);
  document.getElementById('logo-url').addEventListener('paste', handleLogoUrlPaste);

  // Wire featured image events
  const urlInput = document.getElementById('featured-image-url');
  urlInput.addEventListener('paste', handleFeaturedImagePaste);
  urlInput.addEventListener('change', handleFeaturedImageUrlChange);
  document.getElementById('featured-image-upload').addEventListener('change', handleFeaturedImageUpload);

  // Workflow navigation state
  const steps = [
    document.getElementById('step-0'),
    document.getElementById('step-1'),
    document.getElementById('step-2'),
    document.getElementById('step-3')
  ];
  const progress = document.getElementById('progress');
  const progressLabels = document.querySelectorAll('.progress-label');
  let currentStep = 0;

  // Update progress bar and labels
  function updateProgressBar() {
    const percent = (currentStep) / (steps.length - 1) * 100;
    progress.style.width = percent + '%';
    progressLabels.forEach((label, idx) => {
      label.classList.toggle('active', idx === currentStep);
      label.classList.toggle('done', idx < currentStep);
    });
  }

  // Show specified step and adjust nav visibility
  function showStep(step) {
    console.log('[renderer] showStep called. step:', step, 'steps.length:', steps.length);
    // Log visibility of each step
    steps.forEach((el, idx) => {
      console.log(`[renderer] Step ${idx} (id: ${el && el.id}): will be ${idx === step ? 'visible' : 'hidden'}`);
    });
    // Update status display for debugging
    document.getElementById('status').textContent = `Step ${step + 1} of ${steps.length}`;
    currentStep = step;
    steps.forEach((el, idx) => {
      el.style.display = idx === step ? '' : 'none';
    });
    document.getElementById('prev-btn').style.display = step > 0 ? '' : 'none';
    document.getElementById('next-btn').style.display = step < steps.length - 1 ? '' : 'none';
    document.getElementById('submit-btn').style.display = step === steps.length - 1 ? '' : 'none';
    updateProgressBar();
  }

  // Workflow navigation
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');

  if (!prevBtn) {
    console.warn('[renderer] Prev button not found in DOM!');
  } else {
    prevBtn.addEventListener('click', () => {
      console.log('Prev clicked, currentStep:', currentStep);
      if (currentStep > 0) showStep(currentStep - 1);
      // Visual feedback
      prevBtn.style.boxShadow = '0 0 0 3px #007bff55';
      setTimeout(() => prevBtn.style.boxShadow = '', 200);
    });
  }

  if (!nextBtn) {
    console.warn('[renderer] Next button not found in DOM!');
  } else {
    console.log('[renderer] Next button event listener attached');
    nextBtn.addEventListener('click', () => {
      const prevStep = currentStep;
      console.log('[renderer] Next clicked, currentStep:', currentStep);
      if (currentStep < steps.length - 1) {
        showStep(currentStep + 1);
      } else {
        // If click is received but navigation does not occur
        nextBtn.style.boxShadow = '0 0 0 3px #ff000055';
        setTimeout(() => nextBtn.style.boxShadow = '', 300);
        console.warn('[renderer] Next button clicked, but already at last step.');
      }
    });
  }
  document.getElementById('workflow-form').addEventListener('submit', (e) => {
    e.preventDefault();
  });

  showStep(0);
}

function migrateLegacyStorage() {
  const promptOldKey = 'StackBountyPrompts';
  const imageOldKey = 'StackBountyImageStrategies';
  const newPromptKey = 'GenSparkPrompts';
  const newImageKey = 'OpenAIImageStrategies';
  const rawPrompts = localStorage.getItem(promptOldKey);
  if (rawPrompts) {
    localStorage.setItem(newPromptKey, rawPrompts);
    console.log(`Migrated legacy prompts from ${promptOldKey}`);
  }
  const rawStrategies = localStorage.getItem(imageOldKey);
  if (rawStrategies) {
    localStorage.setItem(newImageKey, rawStrategies);
    console.log(`Migrated legacy image strategies from ${imageOldKey}`);
  }
}

if (document.readyState !== 'loading') {
  initApp();
} else {
  document.addEventListener('DOMContentLoaded', initApp);
}

function styleToolbars() {
  document.querySelectorAll('.editor-toolbar').forEach(tb => {
    tb.style.backgroundColor = '#e9ecef';
    tb.querySelectorAll('a').forEach(a => a.style.color = '#000');
  });
}

function displayError(msg, e) {
  document.getElementById('error-log').textContent = msg + ': ' + e.message;
}

// Featured Image Handlers
function handleFeaturedImagePaste(e) {
  const items = (e.clipboardData || window.clipboardData).items;
  for (let item of items) {
    if (item.type.indexOf('image') !== -1) {
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = document.getElementById('featured-image-preview');
        img.src = ev.target.result;
        img.style.display = '';
      };
      reader.readAsDataURL(file);
    }
  }
}
function handleFeaturedImageUrlChange(e) {
  const url = e.target.value.trim();
  if (url) {
    const img = document.getElementById('featured-image-preview');
    img.src = url;
    img.style.display = '';
  }
}
function handleFeaturedImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = document.getElementById('featured-image-preview');
    img.src = ev.target.result;
    img.style.display = '';
  };
  reader.readAsDataURL(file);
}

// Logo URL Paste Handler
function handleLogoUrlPaste(e) {
  const items = (e.clipboardData || window.clipboardData).items;
  for (let item of items) {
    if (item.type.indexOf('image') !== -1) {
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (ev) => {
        saveLogoToStorage(file.name, ev.target.result);
        populateLogoDropdown();
        document.getElementById('logo-select').value = getSavedLogos().slice(-1)[0].id;
        updateLogoFieldsFromDropdown();
      };
      reader.readAsDataURL(file);
    }
  }
}

// Logo file upload handler
function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    saveLogoToStorage(file.name, ev.target.result);
    populateLogoDropdown();
    const logos = getSavedLogos();
    document.getElementById('logo-select').value = logos[logos.length - 1].id;
    updateLogoFieldsFromDropdown();
  };
  reader.readAsDataURL(file);
}

// Logo URL input handler
function handleLogoUrlInput(e) {
  const url = e.target.value.trim();
  if (!url) return;
  const name = url.split('/').pop() || url;
  saveLogoToStorage(name, url);
  populateLogoDropdown();
  const logos = getSavedLogos();
  document.getElementById('logo-select').value = logos[logos.length - 1].id;
  updateLogoFieldsFromDropdown();
}

// Prompt Management
function getSavedPrompts() {
  const newKey = 'GenSparkPrompts';
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(newKey) || '[]') || []; } catch(e) { arr = []; }
  // Migrate from any existing storage key holding prompt arrays
  if (arr.length === 0) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === newKey) continue;
      try {
        const candidate = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(candidate) && candidate.length && candidate.every(x => x && (x.content || x.promptContent))) {
          console.log(`Migrating prompts from storage key '${key}' to '${newKey}'`);
          localStorage.setItem(newKey, JSON.stringify(candidate));
          arr = candidate;
          break;
        }
      } catch {}
    }
  }
  // Seed defaults if still empty
  if (arr.length === 0) {
    const defaultPrompts = [
      { name: 'Basic Review', content: 'Write a detailed review for {{product_name}} highlighting key benefits.' },
      { name: 'Short Summary', content: 'Provide a brief summary of {{product_name}}.' }
    ];
    console.log('Seeding default prompts');
    arr = defaultPrompts;
    localStorage.setItem(newKey, JSON.stringify(defaultPrompts));
  }
  return arr.map(p => {
    const id = p.id || (p.name || p.title || 'prompt').toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    const name = p.name || p.title || 'Untitled';
    const content = p.content || p.promptContent || '';
    return { id, name, content };
  });
}
function savePromptToStorage(name, content) {
  const prompts = getSavedPrompts();
  const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
  prompts.push({ id, name, content });
  localStorage.setItem('GenSparkPrompts', JSON.stringify(prompts));
  // Persist to electron-store
  window.electronAPI.invoke('config-set', { key: 'GenSparkPrompts', value: prompts });
}
function deletePromptFromStorage(id) {
  const prompts = getSavedPrompts().filter(p => p.id !== id);
  localStorage.setItem('GenSparkPrompts', JSON.stringify(prompts));
  // Persist deletion
  window.electronAPI.invoke('config-set', { key: 'GenSparkPrompts', value: prompts });
}
function populatePromptDropdown() {
  const select = document.getElementById('prompt-select');
  const prompts = getSavedPrompts();
  select.innerHTML = '<option value="">Select a prompt</option>';
  prompts.forEach(p => {
    const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name;
    select.appendChild(opt);
  });
  if (prompts.length > 0) {
    select.value = prompts[0].id;
    document.getElementById('error-log').textContent = `Loaded ${prompts.length} prompts.`;
    if (promptMDE) updatePromptFieldsFromDropdown();
  } else {
    document.getElementById('error-log').textContent = `No prompts found.`;
  }
}
function updatePromptFieldsFromDropdown() {
  const select = document.getElementById('prompt-select');
  const prompts = getSavedPrompts();
  const found = prompts.find(p => p.id === select.value);
  document.getElementById('prompt-title').value = found ? found.name : '';
  promptMDE.value(found ? found.content : '');
}
function loadPromptToTextarea() { updatePromptFieldsFromDropdown(); }
function deleteSelectedPrompt() {
  const sel = document.getElementById('prompt-select'); if (sel.value) {
    deletePromptFromStorage(sel.value);
    populatePromptDropdown(); updatePromptFieldsFromDropdown();
  }
}
function saveCurrentPrompt() {
  const name = document.getElementById('prompt-title').value.trim();
  const content = promptMDE.value().trim();
  if (!name) return alert('Please enter a prompt title.');
  if (!content) return alert('Please enter prompt content.');
  savePromptToStorage(name, content);
  populatePromptDropdown();
  const prompts = getSavedPrompts();
  document.getElementById('prompt-select').value = prompts[prompts.length-1].id;
}

// Image Strategy Management
function getSavedImageStrategies() {
  const newKey = 'OpenAIImageStrategies';
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(newKey) || '[]') || []; } catch(e) { arr = []; }
  // Migrate from any existing storage key holding strategy arrays
  if (arr.length === 0) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === newKey) continue;
      try {
        const candidate = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(candidate) && candidate.length && candidate.every(x => x && (x.promptContent || x.content))) {
          console.log(`Migrating image strategies from storage key '${key}' to '${newKey}'`);
          localStorage.setItem(newKey, JSON.stringify(candidate));
          arr = candidate;
          break;
        }
      } catch {}
    }
  }
  // Seed defaults if still empty
  if (arr.length === 0) {
    const defaultStrategies = [
      { name: 'Basic Generation', promptContent: 'Generate a professional image showcasing {{product_name}} with a clean background.' },
      { name: 'Logo Integration', promptContent: 'Overlay the logo at {{logo_url}} onto an image of {{product_name}}.' }
    ];
    console.log('Seeding default image strategies');
    arr = defaultStrategies;
    localStorage.setItem(newKey, JSON.stringify(defaultStrategies));
  }
  return arr.map(s => {
    const id = s.id || (s.name || s.title || 'strategy').toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    const name = s.name || s.title || 'Untitled';
    const promptContent = s.promptContent || s.content || '';
    return { id, name, promptContent };
  });
}
function saveImageStrategyToStorage(name, promptContent) {
  const strategies = getSavedImageStrategies();
  const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
  strategies.push({ id, name, promptContent, actionType: 'generate', isDefault: false });
  localStorage.setItem('OpenAIImageStrategies', JSON.stringify(strategies));
  // Persist to electron-store
  window.electronAPI.invoke('config-set', { key: 'OpenAIImageStrategies', value: strategies });
}
function deleteImageStrategyFromStorage(id) {
  const strategies = getSavedImageStrategies().filter(s => s.id !== id);
  localStorage.setItem('OpenAIImageStrategies', JSON.stringify(strategies));
  // Persist deletion
  window.electronAPI.invoke('config-set', { key: 'OpenAIImageStrategies', value: strategies });
}
function populateImageStrategyDropdown() {
  const select = document.getElementById('image-strategy-select');
  const strategies = getSavedImageStrategies();
  select.innerHTML = '<option value="">Select an image strategy</option>';
  strategies.forEach(s => { const opt = document.createElement('option'); opt.value = s.id; opt.textContent = s.name; select.appendChild(opt); });
  if (strategies.length > 0) {
    select.value = strategies[0].id;
    document.getElementById('error-log').textContent = `Loaded ${strategies.length} image strategies.`;
    if (imageMDE) updateImageStrategyFieldsFromDropdown();
  } else {
    document.getElementById('error-log').textContent = `No image strategies found.`;
  }
}
function updateImageStrategyFieldsFromDropdown() {
  const select = document.getElementById('image-strategy-select');
  const strategies = getSavedImageStrategies();
  const found = strategies.find(s => s.id === select.value);
  document.getElementById('image-strategy-title').value = found ? found.name : '';
  imageMDE.value(found ? found.promptContent : '');
}
function loadImageStrategyToTextarea() { updateImageStrategyFieldsFromDropdown(); }
function deleteSelectedImageStrategy() {
  const sel = document.getElementById('image-strategy-select'); if (sel.value) {
    deleteImageStrategyFromStorage(sel.value);
    populateImageStrategyDropdown(); updateImageStrategyFieldsFromDropdown();
  }
}
function saveCurrentImageStrategy() {
  const name = document.getElementById('image-strategy-title').value.trim();
  const content = imageMDE.value().trim();
  if (!name) return alert('Please enter a title for this image strategy.');
  if (!content) return alert('Please enter image prompt content.');
  saveImageStrategyToStorage(name, content);
  populateImageStrategyDropdown();
  const strategies = getSavedImageStrategies();
  document.getElementById('image-strategy-select').value = strategies[strategies.length-1].id;
}

// Logo Management
function getSavedLogos() {
  let raw = localStorage.getItem('StackBountyLogos');
  return JSON.parse(raw || '[]');
}
function saveLogoToStorage(name, dataURL) {
  const logos = getSavedLogos();
  const id = name.toLowerCase().replace(/\s+/g,'-') + '-' + Date.now();
  logos.push({ id, name, dataURL });
  localStorage.setItem('StackBountyLogos', JSON.stringify(logos));
}
function deleteLogoFromStorage(id) {
  const logos = getSavedLogos().filter(l => l.id !== id);
  localStorage.setItem('StackBountyLogos', JSON.stringify(logos));
}
function populateLogoDropdown() {
  const select = document.getElementById('logo-select');
  const logos = getSavedLogos();
  select.innerHTML = '<option value="">Select a logo</option>';
  logos.forEach(l => { const opt = document.createElement('option'); opt.value = l.id; opt.textContent = l.name; select.appendChild(opt); });
  if (logos.length > 0) {
    select.value = logos[0].id;
    updateLogoFieldsFromDropdown();
  }
}
function updateLogoFieldsFromDropdown() {
  const select = document.getElementById('logo-select');
  const logos = getSavedLogos();
  const found = logos.find(l => l.id === select.value);
  const img = document.getElementById('logo-preview');
  if (found) { img.src = found.dataURL; img.style.display = ''; } else { img.src = ''; img.style.display = 'none'; }
}
function loadLogoToPreview() { updateLogoFieldsFromDropdown(); }
function deleteSelectedLogo() {
  const sel = document.getElementById('logo-select'); if (!sel.value) return alert('No logo selected');
  deleteLogoFromStorage(sel.value);
  populateLogoDropdown();
}
