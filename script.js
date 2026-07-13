// 2048 슬라이드 퍼즐
const SIZE = 4;
const $tiles = document.getElementById('tiles');
const $score = document.getElementById('score');
const $best = document.getElementById('best');
const $overlay = document.getElementById('overlay');
const $overlayTitle = document.getElementById('overlayTitle');
const $overlayMsg = document.getElementById('overlayMsg');

let grid; // 2D [row][col] = value (0 = empty)
let score = 0;
let best = Number(localStorage.getItem('g2048-best') || 0);
let tileId = 0;
let tiles = {}; // id → { val, r, c }
let history = [];
let reached2048 = false;

$best.textContent = best;

function reset() {
  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  tiles = {}; tileId = 0; score = 0; history = []; reached2048 = false;
  $score.textContent = '0';
  $overlay.hidden = true;
  $tiles.innerHTML = '';
  addRandom(); addRandom();
  render();
}

function addRandom() {
  const empty = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (grid[r][c] === 0) empty.push([r, c]);
  if (!empty.length) return null;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const val = Math.random() < 0.9 ? 2 : 4;
  grid[r][c] = val;
  const id = ++tileId;
  tiles[id] = { val, r, c, isNew: true };
  // 그리드와 매핑하기 위해 위치에 id 저장
  grid[r][c] = id;
  return id;
}

function getValAt(r, c) {
  const id = grid[r][c];
  return id === 0 ? 0 : tiles[id].val;
}

function render() {
  $tiles.innerHTML = '';
  for (const id in tiles) {
    const t = tiles[id];
    const el = document.createElement('div');
    el.className = 'tile' + (t.isNew ? ' is-new' : '') + (t.isMerge ? ' is-merge' : '');
    el.dataset.val = t.val;
    el.style.top = `calc(${t.r} * (100% - 30px) / 4 + ${t.r * 10}px)`;
    el.style.left = `calc(${t.c} * (100% - 30px) / 4 + ${t.c * 10}px)`;
    el.textContent = t.val;
    $tiles.appendChild(el);
    delete t.isNew; delete t.isMerge;
  }
}

function snapshot() {
  const snap = JSON.stringify({
    grid: grid.map((row) => row.slice()),
    tiles: JSON.parse(JSON.stringify(tiles)),
    score, tileId,
  });
  history.push(snap);
  if (history.length > 8) history.shift();
}

function undo() {
  if (!history.length) return;
  const s = JSON.parse(history.pop());
  grid = s.grid; tiles = s.tiles; score = s.score; tileId = s.tileId;
  $score.textContent = score;
  render();
  $overlay.hidden = true;
}

function move(dir) {
  // dir: 'L', 'R', 'U', 'D'
  snapshot();
  let moved = false;
  const rotate = (g) => g[0].map((_, i) => g.map((row) => row[i]));
  // 모든 방향을 'left'로 정규화
  const rotateCW = (g) => g[0].map((_, i) => g.map((row) => row[row.length - 1 - i]));
  const rotateCCW = (g) => g[0].map((_, i) => g.map((row) => row[i])).reverse();
  // (3D arr 처리 복잡하니, 각 방향마다 라인 추출)
  const lines = [];
  if (dir === 'L') for (let r = 0; r < SIZE; r++) lines.push({ get: (i) => [r, i], cells: [...grid[r]] });
  if (dir === 'R') for (let r = 0; r < SIZE; r++) lines.push({ get: (i) => [r, SIZE - 1 - i], cells: [...grid[r]].reverse() });
  if (dir === 'U') for (let c = 0; c < SIZE; c++) lines.push({ get: (i) => [i, c], cells: Array.from({ length: SIZE }, (_, i) => grid[i][c]) });
  if (dir === 'D') for (let c = 0; c < SIZE; c++) lines.push({ get: (i) => [SIZE - 1 - i, c], cells: Array.from({ length: SIZE }, (_, i) => grid[SIZE - 1 - i][c]) });

  const newGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  for (const line of lines) {
    const cells = line.cells.filter((id) => id !== 0); // 빈 칸 제거
    const merged = [];
    let i = 0;
    while (i < cells.length) {
      const a = cells[i];
      const b = cells[i + 1];
      if (b && tiles[a].val === tiles[b].val) {
        // 병합
        const newVal = tiles[a].val * 2;
        tiles[b].val = newVal;
        tiles[b].isMerge = true;
        score += newVal;
        delete tiles[a];
        merged.push(b);
        if (newVal === 2048 && !reached2048) reached2048 = true;
        i += 2;
      } else {
        merged.push(a);
        i++;
      }
    }
    // 위치 재배치
    for (let j = 0; j < merged.length; j++) {
      const id = merged[j];
      const [r, c] = line.get(j);
      newGrid[r][c] = id;
      if (tiles[id].r !== r || tiles[id].c !== c) moved = true;
      tiles[id].r = r;
      tiles[id].c = c;
    }
  }
  grid = newGrid;

  if (!moved) {
    history.pop(); // rollback snapshot
    return false;
  }
  $score.textContent = score;
  if (score > best) {
    best = score;
    localStorage.setItem('g2048-best', String(best));
    $best.textContent = best;
  }
  addRandom();
  render();
  checkEnd();
  return true;
}

function checkEnd() {
  // 빈 칸 있으면 계속
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (grid[r][c] === 0) {
    if (reached2048) {
      $overlayTitle.textContent = '🎉 2048 달성!';
      $overlayMsg.textContent = `점수 ${score}. 계속 진행할 수 있어요.`;
      $overlay.hidden = false;
      reached2048 = false; // 한 번만 표시
    }
    return;
  }
  // 인접 같은 값?
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const v = getValAt(r, c);
    if (c < SIZE - 1 && getValAt(r, c + 1) === v) return;
    if (r < SIZE - 1 && getValAt(r + 1, c) === v) return;
  }
  $overlayTitle.textContent = '게임 종료';
  $overlayMsg.textContent = `최종 점수 ${score}`;
  $overlay.hidden = false;
}

// 키 입력
document.addEventListener('keydown', (e) => {
  const map = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D' };
  if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
});

// 스와이프
const $board = document.getElementById('board');
let sx, sy;
$board.addEventListener('touchstart', (e) => {
  sx = e.touches[0].clientX; sy = e.touches[0].clientY;
}, { passive: true });
$board.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - sx;
  const dy = e.changedTouches[0].clientY - sy;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'R' : 'L');
  else move(dy > 0 ? 'D' : 'U');
});

document.getElementById('restart').addEventListener('click', reset);
document.getElementById('overlayBtn').addEventListener('click', reset);
document.getElementById('undo').addEventListener('click', undo);

reset();
