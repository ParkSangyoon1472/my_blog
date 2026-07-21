(function () {
  'use strict';

  var SIZE = 4;
  var BEST_KEY = '2048-best-score';
  var SWIPE_THRESHOLD = 24;

  var KEY_DIRECTION_MAP = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right'
  };

  // ---- DOM refs ----
  var boardEl = document.getElementById('board');
  var scoreValueEl = document.getElementById('score-value');
  var bestValueEl = document.getElementById('best-value');
  var overlayEl = document.getElementById('overlay');
  var overlayMessageEl = document.getElementById('overlay-message');
  var overlayContinueBtn = document.getElementById('overlay-continue-btn');
  var overlayRestartBtn = document.getElementById('overlay-restart-btn');
  var newGameBtn = document.getElementById('new-game-btn');
  var liveRegionEl = document.getElementById('live-region');

  // ---- State ----
  var state = {
    board: createEmptyBoard(),
    score: 0,
    best: loadBest(),
    hasWon: false,
    continuePlaying: false,
    isGameOver: false,
    overlayVisible: false
  };

  var announceTimer = null;

  // ---- Board helpers ----

  function createEmptyBoard() {
    var board = [];
    for (var r = 0; r < SIZE; r++) {
      board.push([0, 0, 0, 0]);
    }
    return board;
  }

  function cloneBoard(board) {
    return board.map(function (row) { return row.slice(); });
  }

  function transpose(board) {
    var t = createEmptyBoard();
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        t[c][r] = board[r][c];
      }
    }
    return t;
  }

  function reverseRows(board) {
    return board.map(function (row) { return row.slice().reverse(); });
  }

  function getEmptyCells(board) {
    var cells = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) cells.push({ r: r, c: c });
      }
    }
    return cells;
  }

  function addRandomTile(board) {
    var empty = getEmptyCells(board);
    if (empty.length === 0) return null;
    var spot = empty[Math.floor(Math.random() * empty.length)];
    var value = Math.random() < 0.9 ? 2 : 4;
    board[spot.r][spot.c] = value;
    return { r: spot.r, c: spot.c, value: value };
  }

  // Compresses + merges a single row toward the left (index 0).
  // Every direction reuses this by rotating the board beforehand/after.
  function moveRowLeft(row) {
    var filtered = row.filter(function (v) { return v !== 0; });
    var resultRow = [];
    var mergedFlags = [false, false, false, false];
    var gained = 0;
    var i = 0;

    while (i < filtered.length) {
      if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
        var mergedValue = filtered[i] * 2;
        resultRow.push(mergedValue);
        mergedFlags[resultRow.length - 1] = true;
        gained += mergedValue;
        i += 2;
      } else {
        resultRow.push(filtered[i]);
        i += 1;
      }
    }

    while (resultRow.length < SIZE) resultRow.push(0);

    var changed = false;
    for (var k = 0; k < SIZE; k++) {
      if (row[k] !== resultRow[k]) { changed = true; break; }
    }

    return { row: resultRow, mergedFlags: mergedFlags, gained: gained, changed: changed };
  }

  function applyMove(board, direction) {
    var useTranspose = direction === 'up' || direction === 'down';
    var useReverse = direction === 'right' || direction === 'down';

    var working = cloneBoard(board);
    if (useTranspose) working = transpose(working);
    if (useReverse) working = reverseRows(working);

    var movedBoard = createEmptyBoard();
    var mergedGrid = createEmptyBoard().map(function (row) { return row.map(function () { return false; }); });
    var gained = 0;
    var changed = false;

    for (var r = 0; r < SIZE; r++) {
      var result = moveRowLeft(working[r]);
      movedBoard[r] = result.row;
      mergedGrid[r] = result.mergedFlags;
      gained += result.gained;
      changed = changed || result.changed;
    }

    var finalBoard = movedBoard;
    var finalMerged = mergedGrid;

    if (useReverse) {
      finalBoard = reverseRows(finalBoard);
      finalMerged = reverseRows(finalMerged);
    }
    if (useTranspose) {
      finalBoard = transpose(finalBoard);
      finalMerged = transpose(finalMerged);
    }

    return { board: finalBoard, merged: finalMerged, gained: gained, changed: changed };
  }

  function canMove(board) {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) return true;
        if (c < SIZE - 1 && board[r][c] === board[r][c + 1]) return true;
        if (r < SIZE - 1 && board[r][c] === board[r + 1][c]) return true;
      }
    }
    return false;
  }

  function checkWin(board) {
    return board.some(function (row) {
      return row.some(function (v) { return v === 2048; });
    });
  }

  // ---- Persistence ----

  function loadBest() {
    var stored = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }

  function saveBest(value) {
    try {
      localStorage.setItem(BEST_KEY, String(value));
    } catch (err) {
      /* localStorage unavailable (e.g. private mode) - ignore */
    }
  }

  // ---- Rendering ----

  function render(board, extra) {
    extra = extra || {};
    var merged = extra.merged;
    var newTiles = extra.newTiles || [];

    boardEl.innerHTML = '';

    for (var r = 0; r < SIZE; r++) {
      var rowEl = document.createElement('div');
      rowEl.className = 'board-row';
      rowEl.setAttribute('role', 'row');

      for (var c = 0; c < SIZE; c++) {
        var value = board[r][c];
        var cellEl = document.createElement('div');
        cellEl.className = 'cell';
        cellEl.setAttribute('role', 'gridcell');

        if (value !== 0) {
          cellEl.textContent = String(value);
          cellEl.setAttribute('aria-label', value + '번 타일');

          var exponent = Math.max(1, Math.round(Math.log2(value)));
          var colorIndex = (exponent - 1) % 4;
          cellEl.classList.add('tile-c' + colorIndex);
          cellEl.style.setProperty('--lv', String(exponent));

          if (merged && merged[r] && merged[r][c]) {
            cellEl.classList.add('tile-merged');
          }
          if (newTiles.some(function (t) { return t.r === r && t.c === c; })) {
            cellEl.classList.add('tile-new');
          }
        } else {
          cellEl.setAttribute('aria-label', '빈 칸');
        }

        rowEl.appendChild(cellEl);
      }

      boardEl.appendChild(rowEl);
    }
  }

  function updateScoreDisplay(pulse) {
    scoreValueEl.textContent = String(state.score);
    bestValueEl.textContent = String(state.best);

    if (pulse) {
      scoreValueEl.classList.remove('pulse');
      // Force reflow so the animation restarts even on consecutive merges.
      void scoreValueEl.offsetWidth;
      scoreValueEl.classList.add('pulse');
    }
  }

  function announce(text) {
    liveRegionEl.textContent = '';
    if (announceTimer) clearTimeout(announceTimer);
    announceTimer = setTimeout(function () {
      liveRegionEl.textContent = text;
    }, 50);
  }

  function showOverlay(message, options) {
    options = options || {};
    overlayMessageEl.textContent = message;
    overlayContinueBtn.hidden = !options.showContinue;
    overlayEl.hidden = false;
    state.overlayVisible = true;
  }

  function hideOverlay() {
    overlayEl.hidden = true;
    state.overlayVisible = false;
  }

  // ---- Game flow ----

  function startNewGame() {
    state.board = createEmptyBoard();
    state.score = 0;
    state.hasWon = false;
    state.continuePlaying = false;
    state.isGameOver = false;
    hideOverlay();

    var spawned = [];
    var first = addRandomTile(state.board);
    if (first) spawned.push(first);
    var second = addRandomTile(state.board);
    if (second) spawned.push(second);

    updateScoreDisplay(false);
    render(state.board, { newTiles: spawned });
    announce('새 게임을 시작합니다.');
  }

  function handleMove(direction) {
    if (state.isGameOver || state.overlayVisible) return;

    var result = applyMove(state.board, direction);
    if (!result.changed) return;

    state.board = result.board;

    if (result.gained > 0) {
      state.score += result.gained;
      if (state.score > state.best) {
        state.best = state.score;
        saveBest(state.best);
      }
    }

    var spawned = [];
    var newTile = addRandomTile(state.board);
    if (newTile) spawned.push(newTile);

    updateScoreDisplay(result.gained > 0);
    render(state.board, { merged: result.merged, newTiles: spawned });

    if (result.gained > 0) {
      announce(result.gained + '점 획득. 현재 점수 ' + state.score + '점.');
    }

    var won = checkWin(state.board);
    if (won && !state.hasWon) {
      state.hasWon = true;
    }

    if (won && !state.continuePlaying) {
      showOverlay('2048 달성! 계속하기를 누르면 이어서 플레이할 수 있습니다.', { showContinue: true });
      announce('축하합니다. 2048 타일을 만들었습니다!');
      return;
    }

    if (!canMove(state.board)) {
      state.isGameOver = true;
      var message = '게임 오버! 최종 점수 ' + state.score + '점.';
      showOverlay(message, { showContinue: false });
      announce(message);
    }
  }

  // ---- Input: keyboard ----

  window.addEventListener('keydown', function (e) {
    var direction = KEY_DIRECTION_MAP[e.key];
    if (!direction) return;
    e.preventDefault();
    handleMove(direction);
  });

  // ---- Input: touch swipe ----

  var touchStartX = 0;
  var touchStartY = 0;
  var touchActive = false;

  boardEl.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchActive = true;
  }, { passive: true });

  boardEl.addEventListener('touchmove', function (e) {
    if (touchActive) e.preventDefault();
  }, { passive: false });

  boardEl.addEventListener('touchend', function (e) {
    if (!touchActive) return;
    touchActive = false;

    var touch = e.changedTouches[0];
    if (!touch) return;

    var dx = touch.clientX - touchStartX;
    var dy = touch.clientY - touchStartY;
    var absDx = Math.abs(dx);
    var absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return;

    var direction;
    if (absDx > absDy) {
      direction = dx > 0 ? 'right' : 'left';
    } else {
      direction = dy > 0 ? 'down' : 'up';
    }

    handleMove(direction);
  }, { passive: true });

  // ---- Buttons ----

  newGameBtn.addEventListener('click', startNewGame);
  overlayRestartBtn.addEventListener('click', startNewGame);
  overlayContinueBtn.addEventListener('click', function () {
    state.continuePlaying = true;
    hideOverlay();
    announce('게임을 계속합니다.');
  });

  // ---- Init ----

  startNewGame();
})();
