(function () {
  var root = document.documentElement;
  var button = document.getElementById('theme-toggle');

  if (!button) return;

  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function updateButton(theme) {
    button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    button.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  updateButton(currentTheme());

  button.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateButton(next);
  });
})();
