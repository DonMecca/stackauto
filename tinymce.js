// TinyMCE integration for review editor
// This file initializes TinyMCE on the #review-html-editor div and provides methods to get/set content.

window.initTinyMCE = function(initialHtml = '') {
  if (window.tinymce) {
    window.tinymce.remove('#review-html-editor');
  }
  window.tinymce.init({
    selector: '#review-html-editor',
    menubar: false,
    plugins: 'link image lists code',
    toolbar: 'undo redo | bold italic underline | alignleft aligncenter alignright | bullist numlist | link image | code',
    height: 350,
    setup: function(editor) {
      editor.on('init', function() {
        editor.setContent(initialHtml);
      });
    }
  });
};

window.getTinyMCEContent = function() {
  if (window.tinymce && window.tinymce.get('review-html-editor')) {
    return window.tinymce.get('review-html-editor').getContent();
  }
  return '';
};

window.setTinyMCEContent = function(html) {
  if (window.tinymce && window.tinymce.get('review-html-editor')) {
    window.tinymce.get('review-html-editor').setContent(html);
  }
};
