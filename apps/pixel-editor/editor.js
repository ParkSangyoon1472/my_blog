(function () {
  'use strict';

  var SIZE = 16;
  var CELL_COUNT = SIZE * SIZE;

  /** @type {(string|null)[]} 256 cells, hex color string or null (transparent). */
  var pixels = new Array(CELL_COUNT).fill(null);

  var currentColor = '#ff2bd6';
  var currentTool = 'draw'; // 'draw' | 'erase'
  var isPointerDown = false;

  var canvas = document.getElementById('pixel-canvas');
  var ctx = canvas.getContext('2d');
  var grid = document.getElementById('pixel-grid');
  var currentColorSwatch = document.getElementById('current-color-swatch');
  var palette = document.getElementById('palette');
  var customColorInput = document.getElementById('custom-color');
  var drawToolBtn = document.getElementById('draw-tool-btn');
  var eraseToolBtn = document.getElementById('erase-tool-btn');
  var clearBtn = document.getElementById('clear-btn');
  var saveOriginalBtn = document.getElementById('save-original-btn');
  var saveLargeBtn = document.getElementById('save-large-btn');

  var colorNames = {
    '': '비어 있음',
    '#000000': '검정',
    '#ffffff': '흰색',
    '#8d8db0': '회색',
    '#ff2bd6': '네온 핑크',
    '#00fff2': '네온 시안',
    '#b026ff': '네온 퍼플',
    '#39ff88': '네온 그린',
    '#ff4d4d': '빨강',
    '#ff9d2b': '주황',
    '#ffe94d': '노랑',
    '#4d7dff': '파랑',
    '#6b4423': '갈색',
    '#1a1a2e': '남색',
    '#5c5c7a': '연회색',
    '#d6009c': '진분홍'
  };

  function colorName(hex) {
    if (!hex) return '비어 있음';
    return colorNames[hex.toLowerCase()] || hex;
  }

  /* ---------- Canvas rendering (pure function of `pixels`) ---------- */

  function drawCell(index) {
    var row = Math.floor(index / SIZE);
    var col = index % SIZE;
    ctx.clearRect(col, row, 1, 1);
    var color = pixels[index];
    if (color) {
      ctx.fillStyle = color;
      ctx.fillRect(col, row, 1, 1);
    }
  }

  function drawAll() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    for (var i = 0; i < CELL_COUNT; i++) {
      var color = pixels[i];
      if (color) {
        var row = Math.floor(i / SIZE);
        var col = i % SIZE;
        ctx.fillStyle = color;
        ctx.fillRect(col, row, 1, 1);
      }
    }
  }

  /* ---------- Grid overlay buttons (input + accessibility layer) ---------- */

  var cellButtons = [];

  function buildGrid() {
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < CELL_COUNT; i++) {
      var row = Math.floor(i / SIZE);
      var col = i % SIZE;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cell-btn';
      btn.setAttribute('role', 'gridcell');
      btn.setAttribute('data-index', String(i));
      btn.setAttribute('tabindex', i === 0 ? '0' : '-1');
      btn.setAttribute('aria-label', (row + 1) + '행 ' + (col + 1) + '열, 색상: ' + colorName(pixels[i]));
      fragment.appendChild(btn);
      cellButtons.push(btn);
    }
    grid.appendChild(fragment);
  }

  function updateCellLabel(index) {
    var row = Math.floor(index / SIZE);
    var col = index % SIZE;
    cellButtons[index].setAttribute('aria-label', (row + 1) + '행 ' + (col + 1) + '열, 색상: ' + colorName(pixels[index]));
  }

  /* ---------- Painting ---------- */

  function paintCell(index) {
    if (index < 0 || index >= CELL_COUNT) return;
    var newColor = currentTool === 'erase' ? null : currentColor;
    if (pixels[index] === newColor) return;
    pixels[index] = newColor;
    drawCell(index);
    updateCellLabel(index);
  }

  /* ---------- Pointer events (mouse + touch unified) ---------- */

  grid.addEventListener('pointerdown', function (event) {
    var target = event.target;
    if (!target || !target.classList.contains('cell-btn')) return;
    isPointerDown = true;
    var index = parseInt(target.getAttribute('data-index'), 10);
    paintCell(index);
  });

  grid.addEventListener('pointermove', function (event) {
    if (!isPointerDown) return;
    var el = document.elementFromPoint(event.clientX, event.clientY);
    if (!el || !el.classList.contains('cell-btn')) return;
    var index = parseInt(el.getAttribute('data-index'), 10);
    paintCell(index);
  });

  window.addEventListener('pointerup', function () {
    isPointerDown = false;
  });
  window.addEventListener('pointercancel', function () {
    isPointerDown = false;
  });
  grid.addEventListener('pointerleave', function () {
    isPointerDown = false;
  });

  /* ---------- Roving tabindex keyboard navigation ---------- */

  function focusCell(index) {
    if (index < 0 || index >= CELL_COUNT) return;
    var currentFocused = grid.querySelector('.cell-btn[tabindex="0"]');
    if (currentFocused) currentFocused.setAttribute('tabindex', '-1');
    var next = cellButtons[index];
    next.setAttribute('tabindex', '0');
    next.focus();
  }

  grid.addEventListener('keydown', function (event) {
    var target = event.target;
    if (!target || !target.classList.contains('cell-btn')) return;
    var index = parseInt(target.getAttribute('data-index'), 10);
    var row = Math.floor(index / SIZE);
    var col = index % SIZE;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        if (row > 0) focusCell(index - SIZE);
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (row < SIZE - 1) focusCell(index + SIZE);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (col > 0) focusCell(index - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (col < SIZE - 1) focusCell(index + 1);
        break;
      case 'Enter':
      case ' ':
      case 'Spacebar':
        event.preventDefault();
        paintCell(index);
        break;
      default:
        break;
    }
  });

  /* ---------- Palette ---------- */

  function setCurrentColor(hex) {
    currentColor = hex;
    currentColorSwatch.style.backgroundColor = hex;
    setTool('draw');
  }

  function updatePaletteSelection(selectedHex) {
    var swatches = palette.querySelectorAll('.swatch');
    swatches.forEach(function (swatch) {
      var swatchColor = swatch.getAttribute('data-color');
      swatch.setAttribute('aria-pressed', swatchColor === selectedHex ? 'true' : 'false');
    });
  }

  palette.addEventListener('click', function (event) {
    var swatch = event.target.closest('.swatch');
    if (!swatch) return;
    var color = swatch.getAttribute('data-color');
    setCurrentColor(color);
    updatePaletteSelection(color);
  });

  customColorInput.addEventListener('input', function (event) {
    var hex = event.target.value;
    setCurrentColor(hex);
    updatePaletteSelection(null); // custom color: no preset swatch highlighted
  });

  /* ---------- Tools ---------- */

  function setTool(tool) {
    currentTool = tool;
    drawToolBtn.setAttribute('aria-pressed', tool === 'draw' ? 'true' : 'false');
    eraseToolBtn.setAttribute('aria-pressed', tool === 'erase' ? 'true' : 'false');
  }

  drawToolBtn.addEventListener('click', function () {
    setTool('draw');
  });

  eraseToolBtn.addEventListener('click', function () {
    setTool('erase');
  });

  clearBtn.addEventListener('click', function () {
    pixels.fill(null);
    drawAll();
    for (var i = 0; i < CELL_COUNT; i++) {
      updateCellLabel(i);
    }
  });

  /* ---------- PNG export ---------- */

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function saveOriginal() {
    canvas.toBlob(function (blob) {
      if (!blob) return;
      downloadBlob(blob, 'pixel-art-16x16.png');
    }, 'image/png');
  }

  function saveLarge() {
    var scale = 32; // 16 * 32 = 512
    var largeCanvas = document.createElement('canvas');
    largeCanvas.width = SIZE * scale;
    largeCanvas.height = SIZE * scale;
    var largeCtx = largeCanvas.getContext('2d');
    largeCtx.imageSmoothingEnabled = false;
    largeCtx.drawImage(canvas, 0, 0, SIZE, SIZE, 0, 0, largeCanvas.width, largeCanvas.height);
    largeCanvas.toBlob(function (blob) {
      if (!blob) return;
      downloadBlob(blob, 'pixel-art-512x512.png');
    }, 'image/png');
  }

  saveOriginalBtn.addEventListener('click', saveOriginal);
  saveLargeBtn.addEventListener('click', saveLarge);

  /* ---------- Init ---------- */

  buildGrid();
  drawAll();
  currentColorSwatch.style.backgroundColor = currentColor;
})();
