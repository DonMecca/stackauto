// renderer.js
let promptMDE, imageMDE, reviewMDE;

function initApp() {
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

  // Workflow navigation
  document.getElementById('prev-btn').onclick = () => { if (currentStep > 0) showStep(--currentStep); };
  document.getElementById('next-btn').onclick = () => { if (currentStep < steps.length - 1) showStep(++currentStep); };
  document.getElementById('workflow-form').onsubmit = (e) => { e.preventDefault(); /* TODO: handle submit */ };

  showStep(0);
}

document.addEventListener('DOMContentLoaded', initApp);

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
