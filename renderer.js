// renderer.js
let promptMDE, imageMDE, reviewMDE;

async function initApp() {
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

  // Wire image strategy events
  document.getElementById('image-strategy-select').addEventListener('change', updateImageStrategyFieldsFromDropdown);
  document.getElementById('load-image-strategy-btn').addEventListener('click', loadImageStrategyToTextarea);
  document.getElementById('delete-image-strategy-btn').addEventListener('click', deleteSelectedImageStrategy);
  document.getElementById('save-image-strategy-btn').addEventListener('click', saveCurrentImageStrategy);

  // Wire logo events
  document.getElementById('logo-select').addEventListener('change', updateLogoFieldsFromDropdown);
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
    console.log('[renderer] showStep', step);
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
  prevBtn.addEventListener('click', () => {
    console.log('Prev clicked, currentStep:', currentStep);
    if (currentStep > 0) showStep(currentStep - 1);
  });
  nextBtn.addEventListener('click', () => {
    console.log('Next clicked, currentStep:', currentStep);
    if (currentStep < steps.length - 1) showStep(currentStep + 1);
  });
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
