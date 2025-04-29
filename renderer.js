// renderer.js
var promptMDE, imageMDE, reviewMDE;
// Global navigation state for showStep/updateProgressBar
var steps = [];
var progress, progressLabels;
var currentStep = 0;

async function initApp() {
  // (1) Do NOT initialize steps/currentStep here! Wait until all DOM is ready and dynamic elements are inserted.
  console.log('[renderer] initApp() is running');
  // migrateLegacyData already handled before initApp; removed erroneous call
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
    // Ensure prompt field is loaded after EasyMDE is ready
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
    // Ensure image strategy field is loaded after EasyMDE is ready
  } catch (e) {
    displayError('EasyMDE failed to initialize image editor', e);
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
  // Auto-load and refresh editors after dropdown population
  updatePromptFieldsFromDropdown();
  updateImageStrategyFieldsFromDropdown();
  if (promptMDE && promptMDE.codemirror) promptMDE.codemirror.refresh();
  if (imageMDE && imageMDE.codemirror) imageMDE.codemirror.refresh();

  // Wire prompt events
  document.getElementById('prompt-select').addEventListener('change', updatePromptFieldsFromDropdown);
  document.getElementById('load-prompt-btn').addEventListener('click', loadPromptToTextarea);
  document.getElementById('delete-prompt-btn').addEventListener('click', deleteSelectedPrompt);
  document.getElementById('save-prompt-btn').addEventListener('click', saveCurrentPrompt);

  // Auto-load and wire feature image strategy controls
  const imageStrategySelect = document.getElementById('image-strategy-select');
  if (imageStrategySelect) {
    imageStrategySelect.addEventListener('change', updateImageStrategyFieldsFromDropdown);
  }
  const loadImgBtn = document.getElementById('load-image-strategy-btn');
  if (loadImgBtn) loadImgBtn.addEventListener('click', loadImageStrategyToTextarea);
  const deleteImgBtn = document.getElementById('delete-image-strategy-btn');
  if (deleteImgBtn) deleteImgBtn.addEventListener('click', deleteSelectedImageStrategy);
  const saveImgBtn = document.getElementById('save-image-strategy-btn');
  if (saveImgBtn) saveImgBtn.addEventListener('click', saveCurrentImageStrategy);

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
      let extractedHtml = '', extractedMarkdown = '';
      if (extractionMethod === 'clipboard') {
        extractedMarkdown = result.clipboard;
      } else if (extractionMethod === 'dom') {
        extractedHtml = result.dom && result.dom.html ? result.dom.html : '';
        extractedMarkdown = result.dom && result.dom.text ? result.dom.text : '';
      }
      if ((extractedHtml && extractedHtml.length > 0) || (extractedMarkdown && extractedMarkdown.length > 0)) {
        showStep(2);
        // Save article to localStorage
        const appname = (appsumoUrl.match(/products\/([\w-]+)/) || [])[1] || 'article';
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const title = `${appname} - ${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} - ${pad(now.getHours())}${pad(now.getMinutes())}`;
        const articles = JSON.parse(localStorage.getItem('SavedArticles') || '[]');
        articles.push({ title, html: extractedHtml, markdown: extractedMarkdown, date: now.toISOString() });
        localStorage.setItem('SavedArticles', JSON.stringify(articles));
        // Debug logging for extraction
        console.log('[DEBUG] First 200 HTML:', extractedHtml ? extractedHtml.slice(0,200) : '[none]');
        console.log('[DEBUG] First 200 Markdown:', extractedMarkdown ? extractedMarkdown.slice(0,200) : '[none]');
        statusEl.textContent = 'Article loaded via ' + extractionMethod + '!\nFirst 200 HTML: ' + (extractedHtml ? extractedHtml.slice(0,200) : '[none]');
        // Load into editor
        if (extractionMethod === 'dom') {
          console.log('[DEBUG] About to init TinyMCE. window.tinymce defined:', typeof window.tinymce !== 'undefined');
          try {
            await window.initTinyMCE(extractedHtml);
            console.log('[DEBUG] TinyMCE initialized successfully.');
          } catch (e) {
            console.error('[DEBUG] TinyMCE init error:', e);
          }
          document.getElementById('review-html-editor').style.display = '';
          document.getElementById('review-editor').style.display = 'none';
          localStorage.setItem('lastReviewMode', 'html');
          document.getElementById('toggle-review-mode-btn').textContent = 'Switch to Markdown';
        } else {
          reviewMDE.value(extractedMarkdown);
          document.getElementById('review-html-editor').style.display = 'none';
          document.getElementById('review-editor').style.display = '';
          localStorage.setItem('lastReviewMode', 'markdown');
          document.getElementById('toggle-review-mode-btn').textContent = 'Switch to HTML';
        }
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
  const cookieDropdown = document.getElementById('genspark-cookies-dropdown');
  const cookieDeleteBtn = document.getElementById('delete-genspark-cookies-btn');
  // Load and display cookie sets, and populate input
  async function loadCookiesUI() {
    const store = await window.electronAPI.invoke('genspark-list-cookies');
    console.log('[CookieDebug] genspark-list-cookies returned:', store);
    refreshCookieDropdown(store.sets, store.activeId);
    if (store.activeId) {
      const active = store.sets.find(s => s.id === store.activeId);
      if (active) cookieInput.value = JSON.stringify(active.cookies, null, 2);
    }
  }
  function refreshCookieDropdown(sets, activeId) {
    console.log('[CookieDebug] refreshCookieDropdown sets:', sets, 'activeId:', activeId);
    cookieDropdown.innerHTML = '';
    sets.forEach(set => {
      const opt = document.createElement('option');
      opt.value = set.id;
      opt.textContent = `${set.label} (${new Date(set.date).toLocaleString()})`;
      if (set.id === activeId) opt.selected = true;
      cookieDropdown.appendChild(opt);
    });
    if (!sets.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(No cookies saved)';
      cookieDropdown.appendChild(opt);
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
      // Allow object wrapper with cookies array
      if (!Array.isArray(parsed)) {
        if (parsed && Array.isArray(parsed.cookies)) {
          parsed = parsed.cookies;
        } else {
          throw new Error('Cookie data must be an array or an object with a cookies array.');
        }
      }
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
  // (2) Now that the cookie dropdown is inserted, load cookies
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

// Enable direct navigation via progress bar labels
document.querySelectorAll('.progress-label').forEach(label => {
  label.style.cursor = 'pointer';
  label.addEventListener('click', () => {
    const step = parseInt(label.dataset.step, 10);
    showStep(step);
  });
});

// Workflow navigation state
steps = Array.from(document.querySelectorAll('.step'));
console.log('[DEBUG] initApp steps IDs:', steps.map(el => el.id));
progress = document.getElementById('progress');
progressLabels = document.querySelectorAll('.progress-label');
currentStep = 0;

// Workflow navigation
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
console.log('[DEBUG] initApp prevBtn, nextBtn:', prevBtn, nextBtn);

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

var migrationDone = false;
async function onAppReady() {
  if (!migrationDone) {
    try {
      const res = await window.electronAPI.invoke('migrate-legacy-cookies');
      console.info('[Migration] Legacy data migration result:', res);
      migrationDone = true;
    } catch (e) {
      console.warn('[Migration] Error migrating legacy data:', e);
    }
  }
  initApp();
}
if (document.readyState !== 'loading') {
  onAppReady();
} else {
  window.addEventListener('DOMContentLoaded', onAppReady);
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
      reader.onload = (evt) => {
        saveLogoToStorage(file.name, evt.target.result);
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
    localStorage.setItem('GenSparkPrompts', JSON.stringify(defaultPrompts));
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
  } else {
    document.getElementById('error-log').textContent = `No prompts found.`;
  }
}
function updatePromptFieldsFromDropdown() {
  const select = document.getElementById('prompt-select');
  const prompts = getSavedPrompts();
  const found = prompts.find(p => p.id === select.value) || {};
  document.getElementById('prompt-title').value = found.name || '';
  // Set content via EasyMDE API and refresh
  promptMDE.value(found.content || '');
  if (promptMDE.codemirror) promptMDE.codemirror.refresh();
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
    const initialized = defaultStrategies.map(s => ({
      id: s.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      name: s.name,
      promptContent: s.promptContent
    }));
    arr = initialized;
    localStorage.setItem(newKey, JSON.stringify(arr));
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
  console.log('[DEBUG] populateImageStrategyDropdown - strategies:', getSavedImageStrategies());
  const select = document.getElementById('image-strategy-select');
  const strategies = getSavedImageStrategies();
  select.innerHTML = '<option value="">Select an image strategy</option>';
  strategies.forEach(s => { const opt = document.createElement('option'); opt.value = s.id; opt.textContent = s.name; select.appendChild(opt); });
  if (strategies.length > 0) {
    select.value = strategies[0].id;
    document.getElementById('error-log').textContent = `Loaded ${strategies.length} image strategies.`;
    updateImageStrategyFieldsFromDropdown();
    if (imageMDE && imageMDE.codemirror) imageMDE.codemirror.refresh();
  } else {
    document.getElementById('error-log').textContent = `No image strategies found.`;
  }
}
function updateImageStrategyFieldsFromDropdown() {
  const select = document.getElementById('image-strategy-select');
  console.log('[DEBUG] updateImageStrategyFieldsFromDropdown - selected id:', select.value);
  const strategies = getSavedImageStrategies();
  const found = strategies.find(s => s.id === select.value) || {};
  console.log('[DEBUG] updateImageStrategyFieldsFromDropdown - found:', found);
  document.getElementById('image-strategy-title').value = found.name || '';
  imageMDE.value(found.promptContent || '');
  if (imageMDE.codemirror) imageMDE.codemirror.refresh();
}
function loadImageStrategyToTextarea() {
  console.log('[DEBUG] loadImageStrategyToTextarea clicked');
  updateImageStrategyFieldsFromDropdown();
}
function deleteSelectedImageStrategy() {
  const sel = document.getElementById('image-strategy-select'); if (sel.value) {
    deleteImageStrategyFromStorage(sel.value);
    populateImageStrategyDropdown(); updateImageStrategyFieldsFromDropdown();
  }
}
function saveCurrentImageStrategy() {
  const name = document.getElementById('image-strategy-title').value.trim();
  const content = imageMDE.value().trim();
  console.log('[DEBUG] saveCurrentImageStrategy - name:', name, 'content:', content);
  if (!name) return alert('Please enter a title for this image strategy.');
  if (!content) return alert('Please enter image prompt content.');
  saveImageStrategyToStorage(name, content);
  populateImageStrategyDropdown();
  const strategies = getSavedImageStrategies();
  document.getElementById('image-strategy-select').value = strategies[strategies.length-1].id;
  updateImageStrategyFieldsFromDropdown();
  if (imageMDE && imageMDE.codemirror) imageMDE.codemirror.refresh();
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

// Update progress bar and labels
function updateProgressBar() {
  // Ensure nav variables
  if (!progress) progress = document.getElementById('progress');
  if (!progressLabels) progressLabels = document.querySelectorAll('.progress-label');
  const percent = (currentStep) / (steps.length - 1) * 100;
  if (progress) progress.style.width = percent + '%';
  if (progressLabels) progressLabels.forEach((label, idx) => {
    label.classList.toggle('active', idx === currentStep);
    label.classList.toggle('done', idx < currentStep);
  });
}

// Show specified step and adjust nav visibility
function showStep(step) {
  // Ensure nav variables
  if (!steps || steps.length === 0) {
    steps = Array.from(document.querySelectorAll('.step'));
  }
  if (!progress) {
    progress = document.getElementById('progress');
  }
  if (!progressLabels || progressLabels.length === 0) {
    progressLabels = document.querySelectorAll('.progress-label');
  }

  // On entering publish step
  if (step === 3) onEnterPublishStep();
  console.log('[renderer] showStep called. step:', step, 'steps.length:', steps.length);
  // Handle required attribute for appsumo-url
  const appsumoInput = document.getElementById('appsumo-url');
  if (typeof currentStep !== 'undefined' && appsumoInput) {
    if (currentStep === 0 && step !== 0) {
      // Leaving step 0, remove required
      appsumoInput.removeAttribute('required');
    } else if (currentStep !== 0 && step === 0) {
      // Entering step 0, restore required
      appsumoInput.setAttribute('required', true);
    }
  }
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
  if (step === 1) {
    updatePromptFieldsFromDropdown();
    updateImageStrategyFieldsFromDropdown();
    if (promptMDE && promptMDE.codemirror) promptMDE.codemirror.refresh();
    if (imageMDE && imageMDE.codemirror) imageMDE.codemirror.refresh();
    // Auto-refresh featured image preview
    updateFeaturedImagePreview();
  }
  // Always initialize TinyMCE when entering review step
  if (step === 2 && window.initTinyMCE) {
    window.initTinyMCE();
  }
}

// Update featured image preview based on current URL or uploaded file
function updateFeaturedImagePreview() {
  const url = document.getElementById('featured-image-url').value.trim();
  const fileInput = document.getElementById('featured-image-upload');
  const img = document.getElementById('featured-image-preview');
  if (url) {
    img.src = url;
    img.style.display = '';
  } else if (fileInput && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = (ev) => { img.src = ev.target.result; img.style.display = ''; };
    reader.readAsDataURL(fileInput.files[0]);
  } else {
    img.src = '';
    img.style.display = 'none';
  }
}

  // --- WordPress Site Management ---
  // Secure async WordPress Site storage via wpSiteStore
// WordPress Site Management temporarily disabled in renderer (NodeIntegration off)
// const wpSiteStore = require('./src/services/wpSiteStore');
// async function getSavedWPSites() { return []; }
// async function saveWPSites(sites) {}
// async function getActiveWPSiteId() { return null; }
// async function setActiveWPSiteId(id) {}

  // On load, populate dropdown
// populateWPSiteDropdown();

  // --- WordPress Publish Step Logic ---
  const publishSummary = document.getElementById('publish-summary');
  const publishStep = document.getElementById('step-3');
  const submitBtn = document.getElementById('submit-btn');
  // Populate summary on entering publish step
  function populatePublishSummary() {
    // Example: summarize title, excerpt, image, etc.
    let title = '';
    let content = '';
    let excerpt = '';
    let featuredImageUrl = '';
    let featuredImageFile = null;
    try {
      title = document.getElementById('prompt-title').value.trim() || '[Untitled]';
    } catch {}
    try {
      // Try TinyMCE first, fallback to reviewMDE
      if (window.tinymce && tinymce.activeEditor) {
        content = tinymce.activeEditor.getContent();
      } else if (window.reviewMDE) {
        content = window.reviewMDE.value();
      }
    } catch {}
    try {
      excerpt = (content || '').replace(/<[^>]+>/g, '').slice(0, 180) + '...';
    } catch {}
    try {
      featuredImageUrl = document.getElementById('featured-image-url').value.trim();
    } catch {}
    publishSummary.innerHTML = `<b>Title:</b> ${title}<br><b>Excerpt:</b> ${excerpt}<br><b>Featured Image:</b> ${featuredImageUrl ? featuredImageUrl : '[none]'}<br>`;
  }
  // Or call on navigation
  function onEnterPublishStep() {
    populatePublishSummary();
  }

  // Submit handler for publishing
  if (submitBtn) {
    submitBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const statusEl = document.getElementById('status');
      statusEl.textContent = 'Publishing to WordPress...';
      let title = document.getElementById('prompt-title').value.trim() || '[Untitled]';
      let content = '';
      if (window.tinymce && tinymce.activeEditor) {
        content = tinymce.activeEditor.getContent();
      } else if (window.reviewMDE) {
        content = window.reviewMDE.value();
      }
      let excerpt = (content || '').replace(/<[^>]+>/g, '').slice(0, 180) + '...';
      let featuredImageUrl = document.getElementById('featured-image-url').value.trim();
      let featuredImageFile = document.getElementById('featured-image-upload').files[0] || null;
      let featuredMediaId = null;
      let featuredMediaSrc = '';
      // --- Get Active WordPress Site ---
      const activeSiteId = getActiveWPSiteId();
      const sites = getSavedWPSites();
      const wpSite = sites.find(s => s.id === activeSiteId);
      if (!wpSite) {
        statusEl.textContent = 'No active WordPress site selected.';
        return;
      }
      try {
        // 1. Upload featured image if file selected
        if (featuredImageFile) {
          // Save file to temp, get path
          const arrayBuffer = await featuredImageFile.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const tempPath = require('os').tmpdir() + '/' + featuredImageFile.name;
          await window.electronAPI.invoke('save-temp-file', { path: tempPath, buffer: buffer });
          const mediaRes = await window.electronAPI.invoke('wordpress-upload-media', tempPath);
          if (mediaRes.error) throw new Error(mediaRes.error);
          featuredMediaId = mediaRes.mediaId;
          featuredMediaSrc = mediaRes.url;
        }
        // 2. If only URL, skip upload
        // 3. Create post with selected site credentials
        const postData = {
          title,
          content,
          excerpt,
          status: 'publish',
          featured_media: featuredMediaId || undefined,
          wordpressSiteUrl: wpSite.url,
          wordpressAppPassword: wpSite.password,
          wordpressUsername: wpSite.username,
        };
        const postRes = await window.electronAPI.invoke('wordpress-create-post', postData);
        if (postRes.error) throw new Error(postRes.error);
        statusEl.textContent = `Published! View: ${postRes.url}`;
        publishSummary.innerHTML += `<br><b>Success!</b> <a href="${postRes.url}" target="_blank">View Post</a>`;
      } catch (err) {
        statusEl.textContent = 'Publish failed: ' + (err.message || err);
        publishSummary.innerHTML += `<br><span style="color:#b00">Error: ${err.message || err}</span>`;
      }
    });
  }

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

  // Persist Last-Used Prompts & Settings --------
function persistSelect(id, key) {
  const el = document.getElementById(id);
  el.addEventListener('change', () => localStorage.setItem(key, el.value));
  const last = localStorage.getItem(key);
  if (last) el.value = last;
}
persistSelect('prompt-select', 'lastPrompt');
persistSelect('image-strategy-select', 'lastImageStrategy');
persistSelect('extraction-method-select', 'lastExtractionMethod');
// Restore last-used values
if (localStorage.getItem('lastPrompt')) document.getElementById('prompt-select').value = localStorage.getItem('lastPrompt');
if (localStorage.getItem('lastImageStrategy')) document.getElementById('image-strategy-select').value = localStorage.getItem('lastImageStrategy');
if (localStorage.getItem('lastExtractionMethod')) extractionSelect.value = localStorage.getItem('lastExtractionMethod');
// Auto-load and refresh editors after restoring selections
updatePromptFieldsFromDropdown();
updateImageStrategyFieldsFromDropdown();
if (promptMDE && promptMDE.codemirror) promptMDE.codemirror.refresh();
if (imageMDE && imageMDE.codemirror) imageMDE.codemirror.refresh();

  // -------- Review Mode Toggle --------
const toggleReviewBtn = document.getElementById('toggle-review-mode-btn');
var reviewMode = localStorage.getItem('lastReviewMode') || 'html';
function updateReviewEditorMode(mode) {
  // HTML-only: always show TinyMCE editor
  document.getElementById('review-html-editor').style.display = '';
  localStorage.setItem('lastReviewMode', 'html');
}
// Set initial mode
updateReviewEditorMode('html');

// -------- Saved Articles UI --------
const savedArticlesBtn = document.createElement('button');
savedArticlesBtn.textContent = 'Show Saved Articles';
savedArticlesBtn.type = 'button';
savedArticlesBtn.style.marginLeft = '18px';
const reviewStep = document.getElementById('step-2');
reviewStep.insertBefore(savedArticlesBtn, reviewStep.firstChild);
const savedArticlesPanel = document.createElement('div');
savedArticlesPanel.style.display = 'none';
savedArticlesPanel.style.border = '1px solid #ccc';
savedArticlesPanel.style.background = '#f8f8f8';
savedArticlesPanel.style.padding = '12px';
savedArticlesPanel.style.marginBottom = '18px';
savedArticlesPanel.innerHTML = '<b>Saved Articles</b><br><div id="saved-articles-list"></div>';
reviewStep.insertBefore(savedArticlesPanel, savedArticlesBtn.nextSibling);
savedArticlesBtn.onclick = () => {
  savedArticlesPanel.style.display = savedArticlesPanel.style.display === 'none' ? '' : 'none';
  renderSavedArticlesList();
};
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;')
    .replace(/=/g, '&#61;')
    .replace(/\//g, '&#47;');
}

function renderSavedArticlesList() {
  const listDiv = savedArticlesPanel.querySelector('#saved-articles-list');
  const articles = JSON.parse(localStorage.getItem('SavedArticles') || '[]');
  if (articles.length === 0) {
    listDiv.innerHTML = '<i>No saved articles.</i>';
    return;
  }
  listDiv.innerHTML = articles.map((a, i) => {
    const snippet = a.html ? escapeHtml(a.html.slice(0, 200)) : '<i>[No HTML]</i>';
    return `
      <div class="saved-article-card">
        <div class="saved-article-header">
          <span class="saved-article-title">${escapeHtml(a.title)}</span>
          <span class="saved-article-date">${new Date(a.date).toLocaleString()}</span>
        </div>
        <div class="saved-article-actions">
          <button data-load="${i}" title="Load into Editor"><i class="fa fa-sign-in"></i></button>
          <button data-retest="${i}" title="Retest Display"><i class="fa fa-refresh"></i></button>
          <button data-delete="${i}" title="Delete Article"><i class="fa fa-trash"></i></button>
          <button data-toggle-full="${i}" title="Show Full Article">Show Full Article</button>
        </div>
        <div id="article-html-${i}" class="saved-article-snippet">${snippet}</div>
      </div>`;
  }).join('');
  listDiv.querySelectorAll('button[data-toggle-full]').forEach(btn => {
    btn.onclick = () => {
      const idx = +btn.getAttribute('data-toggle-full');
      const div = document.getElementById('article-html-' + idx);
      const art = articles[idx];
      if (btn.textContent === 'Show Full Article') {
        // Show raw HTML (not escaped)
        div.innerHTML = art.html || '<i>[No HTML]</i>';
        div.style.maxHeight = '300px';
        btn.textContent = 'Show Snippet';
      } else {
        // Show escaped snippet
        div.innerHTML = art.html ? escapeHtml(art.html.slice(0,200)) : '<i>[No HTML]</i>';
        div.style.maxHeight = '80px';
        btn.textContent = 'Show Full Article';
      }
    };
  });
  listDiv.querySelectorAll('button[data-load]').forEach(btn => {
    btn.onclick = () => {
      const idx = +btn.getAttribute('data-load');
      const art = articles[idx];
      window.initTinyMCE(art.html);
      savedArticlesPanel.style.display = 'none';
    };
  });
  // Retest Display: reload article into editor and update status, without API call
  listDiv.querySelectorAll('button[data-retest]').forEach(btn => {
    btn.onclick = () => {
      const idx = +btn.getAttribute('data-retest');
      const art = articles[idx];
      window.initTinyMCE(art.html);
      // Remove required from appsumo-url input to prevent focus error
      document.getElementById('appsumo-url').removeAttribute('required');
      showStep(2);
      document.getElementById('status').textContent = 'Retest: Displayed saved article in review editor.';
    };
  });
  listDiv.querySelectorAll('button[data-delete]').forEach(btn => {
    btn.onclick = () => {
      const idx = +btn.getAttribute('data-delete');
      articles.splice(idx, 1);
      localStorage.setItem('SavedArticles', JSON.stringify(articles));
      renderSavedArticlesList();
    };
  });
}
