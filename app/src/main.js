/* ===== 开心连连看 ===== */

/* ---------- 配置 ---------- */
const LEVELS = [
  { cols: 6, rows: 6,  kinds: 10, time: 85,  special: 0, target: null },
  { cols: 6, rows: 8,  kinds: 12, time: 115, special: 4, target: null },
  { cols: 7, rows: 8,  kinds: 13, time: 150, special: 5, target: "strawberry" },
  { cols: 8, rows: 9,  kinds: 14, time: 185, special: 8, target: null },
  { cols: 8, rows: 10, kinds: 15, time: 215, special: 10, target: "maxhint" },
  { cols: 8, rows: 11, kinds: 15, time: 250, special: 14, target: null },
];
const THEMES = {
  fruit:  { name: "水果", icons: ["🍎","🍋","🍇","🍓","🍉","🍊","🍑","🍍","🥝","🍒","🫐","🍌","🥕","🌽","🍄"] },
  desert: { name: "甜品", icons: ["🍩","🧁","🍰","🍦","🍪","🍭","🍮","🍬","🍨","🥧","🍡","🍢","🥞","🧇","🍯"] },
  animal: { name: "动物", icons: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐷","🐸","🐵","🐥"] },
};
const THEMES_ORDER = ["fruit", "desert", "animal"];
/* 无尽模式：每轮时限 = 缓冲 12 秒 + 每对 4 秒；清完一轮把"盘面应得时间"存进时间银行（可持续累积），
   棋盘逐轮变大、特殊块逐轮增多，撑到时间耗尽为止 */
const ENDLESS = { kinds: 15, special: 2, buffer: 12, pairTime: 4 };
function endlessBudget(cells){ return ENDLESS.buffer + cells * ENDLESS.pairTime / 2; }
function endlessEarn(cells){ return cells * ENDLESS.pairTime / 2; }
/* 克制消除（仅按克制吃子）7 关闯关：每关一组「闭环克制环」——环上每个元素克下一个、被上一个克 */
const PSR_LEVELS = [
  { name: "石头剪刀布", icons: ["🪨","✂️","🧻"], beats: [[0,1],[1,2],[2,0]],
    cols: 6, rows: 6, time: 40 },
  { name: "风林火山", icons: ["🌬️","🌲","🔥","⛰️"], beats: [[0,1],[1,2],[2,3],[3,0]],
    cols: 6, rows: 6, time: 45 },
  { name: "五行", icons: ["🪙","🌳","⛰️","💧","🔥"], beats: [[0,1],[1,2],[2,3],[3,4],[4,0]],
    cols: 7, rows: 5, time: 50 },   /* 金克木、木克土、土克水、水克火、火克金 */
  { name: "三国群英", icons: ["🤝","🪭","🔥","👑","🗡️","🔱"],
    names: ["刘备","诸葛亮","周瑜","曹操","吕布","纪灵"],
    beats: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]], cols: 6, rows: 6, time: 55 },
  { name: "西游取经", icons: ["🐂","🐷","🦊","🪭","🔥","🐵","⚡"],
    names: ["牛魔王","猪八戒","玉面狐狸","铁扇公主","红孩儿","孙悟空","哪吒"],
    beats: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0]], cols: 7, rows: 7, time: 60 },
  { name: "斗兽棋", icons: ["🐘","🦁","🐯","🐆","🐺","🐶","🐱","🐭"],
    beats: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0]], cols: 8, rows: 8, time: 70 },
  { name: "十二生肖", icons: ["🐭","🐮","🐯","🐰","🐲","🐍","🐴","🐐","🐵","🐔","🐶","🐷"],
    names: ["鼠","牛","虎","兔","龙","蛇","马","羊","猴","鸡","狗","猪"],
    beats: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,0]],
    cols: 6, rows: 8, time: 85 },
];
const STONE  = 90;   // 石板块：不可消除，挡连线
const FROZEN = 95;   // 冰冻块：先消一对邻块解冻
const RAINBOW = 100; // 彩虹块：可和任意图案配对
const CLOCK  = 105;  // 时钟块：消除后 +15 秒
const DIRS = [[-1,0],[0,1],[1,0],[0,-1]];
const COMBO_WINDOW = 10000;   // 连击窗口（毫秒）——生存模式找对大，给足容错
const HINT_COST = 20;        // 提示扣分
const SHUFFLE_TIMES = 3;     // 每关洗牌次数
const CLOCK_BONUS = 15;      // 时钟块加时（秒）

/* ---------- 运行日志（排查问题用：关键事件 + 计数快照，可开关可导出） ---------- */
const LOG_KEY = "llk_log_v1";
const LOG_MAX = 300;
const BUILD = "v24";   /* 每次发布递增：日志里带版本号，便于确认玩家跑的是不是最新代码 */
let gameLog = [];
let logSeq = 0;
try{
  const raw = localStorage.getItem(LOG_KEY);
  if(raw){
    const arr = JSON.parse(raw);
    if(Array.isArray(arr)){
      gameLog = arr.slice(-LOG_MAX);
      logSeq = gameLog.reduce((m, e) => Math.max(m, e.n || 0), 0);
    }
  }
}catch(e){ /* 日志损坏则丢弃 */ }
function fmtLogTime(ts){
  const d = new Date(ts);
  const p = n => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function exportLogText(n){
  const list = (n && n > 0 && n < gameLog.length) ? gameLog.slice(-n) : gameLog;
  return list.map(e =>
    `#${e.n} ${fmtLogTime(e.t)} [${e.tag}] ${e.ev}${e.d ? " | " + e.d : ""} · 计数=${e.pairs} · 分=${e.score}`
  ).join("\n");
}
/* 关键事件：排除高频低价值的暂停/提示/手动洗牌，保留完整消除流水便于核对计数 */
const LOG_SKIP = new Set(["暂停", "继续", "提示", "手动洗牌"]);
function exportKeyLogText(){
  return gameLog.filter(e => !LOG_SKIP.has(e.ev)).map(e =>
    `#${e.n} ${fmtLogTime(e.t)} [${e.tag}] ${e.ev}${e.d ? " | " + e.d : ""} · 计数=${e.pairs} · 分=${e.score}`
  ).join("\n");
}
function downloadLog(){
  const text = exportLogText();
  if(!text){ toast("暂无日志"); return; }
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const d = new Date();
  const p = (x) => String(x).padStart(2, "0");
  a.download = `连连看日志-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.txt`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("日志文件已下载");
}
async function copyText(text, okMsg){
  try{
    await navigator.clipboard.writeText(text);
    toast(okMsg);
  }catch(e){
    /* 剪贴板不可用时退化为选中文本 */
    const v = $("log-view");
    if(v) v.textContent = text;
    if(v && window.getSelection){
      const r = document.createRange();
      r.selectNodeContents(v);
      const s = window.getSelection();
      s.removeAllRanges(); s.addRange(r);
      toast("剪贴板不可用，已选中日志请手动复制");
    }
  }
}
function clearLog(){
  gameLog = []; logSeq = 0;
  try{ localStorage.removeItem(LOG_KEY); }catch(e){}
}

function ctxTag(){
  if(G.survival) return "无尽生存";
  if(G.psr) return `克制消除·第${G.rpsRound}关·${G.rpsKinds}元素`;
  if(G.endless) return `无尽·第${G.endlessRound}轮`;
  return `第${G.level || "?"}关`;
}
function boardUnits(){
  let u = 0;
  for(let r = 1; r <= G.rows; r++)
    for(let c = 1; c <= G.cols; c++){
      const v = G.board[r][c];
      if(!v || v === STONE) continue;
      u += v === FROZEN || v === RAINBOW || v === CLOCK ? 1 : 0.5;
    }
  return u;
}
function glog(event, detail){
  gameLog.push({ n: ++logSeq, t: Date.now(), tag: ctxTag(), ev: event, d: detail,
    pairs: G.psr ? G.remainTiles : G.remainPairs, score: G.score });
  if(gameLog.length > LOG_MAX) gameLog.splice(0, gameLog.length - LOG_MAX);
  try{ localStorage.setItem(LOG_KEY, JSON.stringify(gameLog)); }catch(e){}
}

/* ---------- 存档 ---------- */
const SAVE_KEY = "llk_save_v1";
function loadSave(){
  try{
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if(s && s.v === 1 && Number.isInteger(s.unlocked)){
      if(s.mode !== "casual") s.mode = "timed";
      if(!THEMES[s.theme]) s.theme = "fruit";
      if(!Number.isInteger(s.psrUnlocked) || s.psrUnlocked < 1) s.psrUnlocked = 1;
      if(!Number.isInteger(s.bestSurvival) || s.bestSurvival < 0) s.bestSurvival = 0;
      return s;
    }
  }catch(e){}
  return { v:1, unlocked:1, stars:{}, bestScore:{}, bestEndless:0, bestSurvival:0, muted:false, mode:"timed", theme:"fruit", psrUnlocked:1 };
}
function persist(){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){}
}
const save = loadSave();

/* ---------- 音效（Web Audio 合成） ---------- */
let actx = null;
function audio(){
  if(!actx){
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    actx = new AC();
  }
  if(actx.state === "suspended") actx.resume();
  return actx;
}
function tone(freq, dur, type = "sine", vol = 0.18, delay = 0){
  if(save.muted) return;
  const ctx = audio(); if(!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type; osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}
const sfx = {
  click:   () => tone(440, 0.06, "triangle", 0.12),
  select:  () => tone(660, 0.07, "sine", 0.16),
  match:   (combo) => { tone(520 + Math.min(combo,8) * 40, 0.09, "triangle", 0.2);
                        tone(780 + Math.min(combo,8) * 60, 0.12, "triangle", 0.18, 0.07); },
  bad:     () => tone(170, 0.16, "square", 0.10),
  shuffle: () => { tone(300, 0.1, "sawtooth", 0.08); tone(520, 0.1, "sawtooth", 0.08, 0.08);
                   tone(760, 0.12, "sawtooth", 0.08, 0.16); },
  win:     () => [523,659,784,1047].forEach((f,i) => tone(f, 0.16, "triangle", 0.2, i * 0.11)),
  lose:    () => [420,340,260,180].forEach((f,i) => tone(f, 0.18, "sine", 0.16, i * 0.13)),
};
document.addEventListener("pointerdown", () => audio(), { once:true });

/* ---------- 路径算法（转弯 ≤ 2） ---------- */
/* 路径可否穿过：空格可以；石头/冰冻不可穿过（必须从外围绕行） */
function passable(v){
  return v === 0;
}
function findPath(b, sr, sc, tr, tc){
  const R = b.length, C = b[0].length;
  const best = new Map(), prev = new Map(), q = [];
  for(let d = 0; d < 4; d++){
    const nr = sr + DIRS[d][0], nc = sc + DIRS[d][1];
    if(nr < 0 || nr >= R || nc < 0 || nc >= C) continue;
    if(!passable(b[nr][nc]) && !(nr === tr && nc === tc)) continue;
    const key = nr + "," + nc + "," + d;
    best.set(key, 0); prev.set(key, "S");
    q.push([nr, nc, d, 0]);
  }
  let head = 0;
  while(head < q.length){
    const [r, c, d, t] = q[head++];
    if(r === tr && c === tc){
      const chain = [[r, c]];
      let key = r + "," + c + "," + d;
      while(prev.get(key) !== "S"){
        key = prev.get(key);
        const p = key.split(",");
        chain.push([Number(p[0]), Number(p[1])]);
      }
      chain.push([sr, sc]);
      chain.reverse();
      const corners = [chain[0]];
      for(let i = 1; i < chain.length - 1; i++){
        const [pr, pc] = chain[i - 1], [cr, cc] = chain[i], [nr2, nc2] = chain[i + 1];
        if((cr - pr) !== (nr2 - cr) || (cc - pc) !== (nc2 - cc)) corners.push([cr, cc]);
      }
      corners.push(chain[chain.length - 1]);
      return corners;
    }
    for(let nd = 0; nd < 4; nd++){
      const nt = nd === d ? t : t + 1;
      if(nt > 2) continue;
      const nr = r + DIRS[nd][0], nc = c + DIRS[nd][1];
      if(nr < 0 || nr >= R || nc < 0 || nc >= C) continue;
      if(!passable(b[nr][nc]) && !(nr === tr && nc === tc)) continue;
      const key = nr + "," + nc + "," + nd;
      if(best.has(key) && best.get(key) <= nt) continue;
      best.set(key, nt); prev.set(key, r + "," + c + "," + d);
      q.push([nr, nc, nd, nt]);
    }
  }
  return null;
}

/* a 是否克制 b（a、b 为棋盘值 1..kinds；beats 表按图标下标 0..kinds-1 记录） */
function dominates(a, b){
  if(!G.psr) return false;
  return PSR_LEVELS[G.rpsRound - 1].beats.some(([x, y]) => x === a - 1 && y === b - 1);
}

/* psr：剩余元素种类数 + 一个可连通的克制对（找不到则返回 null） */
function psrState(){
  const kindsLeft = new Set(), cells = [];
  for(let r = 1; r <= G.rows; r++)
    for(let c = 1; c <= G.cols; c++){
      const v = G.board[r][c];
      if(v){ kindsLeft.add(v); cells.push([r, c, v]); }
    }
  let pair = null;
  outer:
  for(const [r1, c1, v1] of cells)
    for(const [r2, c2, v2] of cells){
      if(r1 === r2 && c1 === c2) continue;
      if(!dominates(v1, v2)) continue;
      if(findPath(G.board, r1, c1, r2, c2)){ pair = { a: [r1, c1], b: [r2, c2] }; break outer; }
    }
  return { kindsLeft: kindsLeft.size, pair };
}

function findMove(){
  const groups = new Map();
  for(let r = 1; r <= G.rows; r++)
    for(let c = 1; c <= G.cols; c++){
      const v = G.board[r][c];
      if(!v || v === STONE || v === FROZEN) continue;
      if(!groups.has(v)) groups.set(v, []);
      groups.get(v).push([r, c]);
    }
  const rainbows = groups.get(RAINBOW) || [];
  const tryPair = (a, b) => {
    const path = findPath(G.board, a[0], a[1], b[0], b[1]);
    return path ? { a, b, path } : null;
  };
  for(const [v, pos] of groups){
    if(!pos.length || v === RAINBOW) continue;
    // 克制成对：a 克 b
    for(const [w, other] of groups){
      if(!other.length || w === RAINBOW || !dominates(v, w)) continue;
      for(const p of pos)
        for(const q of other){
          const m = tryPair(p, q);
          if(m) return m;
        }
    }
    // 同图案配对
    for(let i = 0; i < pos.length; i++)
      for(let j = i + 1; j < pos.length; j++){
        const m = tryPair(pos[i], pos[j]);
        if(m) return m;
      }
  }
  // 彩虹块可与任意图案配对
  if(rainbows.length)
    for(const [v, pos] of groups){
      if(v === RAINBOW || !pos.length) continue;
      for(const rp of rainbows)
        for(const p of pos){
          const m = tryPair(rp, p);
          if(m) return m;
        }
    }
  return null;
}
/* 强制找解：棋盘可能因特殊块暂时无解，用清空法绕开 */
function findAnyPair(){
  const saved = G.board.map(row => row.slice());
  for(let r = 1; r <= G.rows; r++)
    for(let c = 1; c <= G.cols; c++)
      if(G.board[r][c] === STONE || G.board[r][c] === FROZEN) G.board[r][c] = 0;
  const m = findMove();
  for(let r = 0; r < G.board.length; r++)
    for(let c = 0; c < G.board[0].length; c++)
      G.board[r][c] = saved[r][c];
  return m;
}

/* ---------- 游戏状态 ---------- */
const G = {
  level: 1, cols: 0, rows: 0,
  board: [],            // (rows+2) x (cols+2)，0 = 空
  tileEls: [],          // 对应的 DOM 元素
  selected: null,       // [r, c]
  score: 0, combo: 0, lastMatchAt: 0,
  remainPairs: 0, remainKinds: 0,
  mode: "timed", hintsUsed: 0, elapsed: 0,
  timeTotal: 0, timeLeft: 0, timerId: null, deadline: 0, startAt: 0,
  endless: false, endlessScore: 0, endlessRound: 0, endlessEarn: 0, dead: false, targetKind: null,
  survival: false, survKinds: 6, survCleared: 0, survReward: 4,
  rpsRound: 1, rpsKinds: 3,
  psr: false, /* 仅克制成对：被克者消失，克制者留下 */
  shufflesLeft: SHUFFLE_TIMES,
  locked: false,        // 消除动画期间锁定输入
  noThaw: false,        // 本局出现过永远解不到的冰冻块：停止解冻，残局走强制清盘
  playing: false, paused: false,
};

const $ = (id) => document.getElementById(id);
const els = {
  title: $("screen-title"), game: $("screen-game"),
  levelSelect: $("level-select"), bestTotal: $("best-total"),
  hudLevel: $("hud-level"), hudScore: $("hud-score"), hudCombo: $("hud-combo"),
  hudLeft: $("hud-left"), timerFill: $("timer-fill"), timerText: $("timer-text"),
  boardWrap: $("board-wrap"), board: $("board"),
  link: $("link-layer"), fx: $("fx-layer"),
  overlay: $("overlay"), overlayCard: $("overlay-card"),
  toast: $("toast"),
  shuffleCount: $("shuffle-count"),
};

/* ---------- 棋盘生成 ---------- */
function buildBoard(levelIdx){
  const cfg = LEVELS[levelIdx - 1];
  setupBoard(cfg.cols, cfg.rows, cfg.kinds, cfg.special);
}

function setupBoard(cols, rows, kinds, specialCount, icons){
  G.cols = cols; G.rows = rows;
  G.board = Array.from({ length: rows + 2 }, () => Array(cols + 2).fill(0));
  const cells = cols * rows;
  const ids = [];
  for(let i = 0; i < cells / 2; i++){
    const id = (i % kinds) + 1;
    ids.push(id, id);
  }
  const specials = [];
  if(specialCount > 0){
    const pool = [STONE, STONE, FROZEN, FROZEN, RAINBOW, RAINBOW, CLOCK];
    for(let i = 0; i < specialCount; i++) specials.push(pool[i % pool.length]);
    if(specials.length % 2) specials.pop();
  }
  const pos = [];
  for(let r = 1; r <= rows; r++)
    for(let c = 1; c <= cols; c++) pos.push([r, c]);
  let tries = 0;
  let placed = 0;
  do{
    shuffleArray(ids);
    let k = 0;
    for(let r = 1; r <= rows; r++)
      for(let c = 1; c <= cols; c++)
        G.board[r][c] = ids[k++];
    shuffleArray(pos);
    /* 特殊块必须成对覆盖「同种图案的一对格子」。
       若随意覆盖，被盖住的两种图案各剩一张单张，永远无法配对，
       残局只能强制清盘（玩家看到"还剩两个不同图案就通关"） */
    const byVal = new Map();
    for(const [r, c] of pos){
      const v = G.board[r][c];
      if(!byVal.has(v)) byVal.set(v, []);
      byVal.get(v).push([r, c]);
    }
    const cands = [...byVal.values()].filter(a => a.length >= 2);
    shuffleArray(cands);
    placed = 0;
    for(const cellsOfKind of cands){
      if(placed + 2 > specials.length) break;
      const [r1, c1] = cellsOfKind[0], [r2, c2] = cellsOfKind[1];
      G.board[r1][c1] = specials[placed++];
      G.board[r2][c2] = specials[placed++];
    }
    tries++;
  }while((placed < specials.length || (!findMove() && !findAnyPair())) && tries < 200);
  // remainPairs = 剩余可消除单位数：图案按「对」计，冰冻/彩虹/时钟各算 1 个单位
  //（特殊块是覆盖到图案上的，按块数计只多不少；这样解冻/消特殊块时的扣减正好对上）
  let units = 0;
  for(let r = 1; r <= rows; r++)
    for(let c = 1; c <= cols; c++){
      const v = G.board[r][c];
      if(!v || v === STONE) continue;
      units += v === FROZEN || v === RAINBOW || v === CLOCK ? 1 : 0.5;
    }
  G.remainPairs = Math.max(units, (cells - specials.length) / 2);
  glog("棋盘生成", `${cols}x${rows} · ${kinds}图案 · 特殊x${specials.length} · ${specials.join("/")} · 剩余单位=${G.remainPairs}${tries > 1 ? ` · 重洗${tries}次` : ""} · ${BUILD}`);
}

/* 剩余棋子重新排列（石头/冰冻块位置固定不动） */
function reshuffleRemaining(){
  if(G.psr){
    const pos = [], ids = [];
    for(let r = 1; r <= G.rows; r++)
      for(let c = 1; c <= G.cols; c++){
        const v = G.board[r][c];
        if(v){ pos.push([r, c]); ids.push(v); }
      }
    let tries = 0;
    do{
      shuffleArray(ids);
      pos.forEach(([r, c], i) => G.board[r][c] = ids[i]);
      tries++;
    }while(tries < 100 && !psrState().pair);
    return;
  }
  const pos = [], ids = [];
  for(let r = 1; r <= G.rows; r++)
    for(let c = 1; c <= G.cols; c++){
      const v = G.board[r][c];
      if(v && v !== STONE && v !== FROZEN){ pos.push([r, c]); ids.push(v); }
    }
  let tries = 0;
  do{
    shuffleArray(ids);
    pos.forEach(([r, c], i) => G.board[r][c] = ids[i]);
    tries++;
  }while(tries < 200 && !findMove() && !findAnyPair());
}

function shuffleArray(a){
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- 渲染 ---------- */
function layoutBoard(){
  if(!G.cols) return;
  const outer = document.querySelector(".board-outer");
  /* 用内容盒尺寸再留 2px 余量，消除亚像素累积造成的 1-2px 假溢出 */
  const W = outer.clientWidth - parseFloat(getComputedStyle(outer).paddingLeft) - parseFloat(getComputedStyle(outer).paddingRight) - 2;
  const H = outer.clientHeight - parseFloat(getComputedStyle(outer).paddingTop) - parseFloat(getComputedStyle(outer).paddingBottom);
  const gap = W >= 480 ? 5 : 4;
  const cellMax = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--cell-max")) || 68;
  const cell = Math.floor(Math.min(
    (W - 8 - (G.cols - 1) * gap) / (G.cols + 1.1),
    (H - (G.rows - 1) * gap) / (G.rows + 1.6),
    cellMax
  ));
  const pad = Math.ceil(cell * 0.55 + gap);
  const wrap = els.boardWrap;
  wrap.style.setProperty("--cell", cell + "px");
  wrap.style.setProperty("--gap", gap + "px");
  wrap.style.padding = pad + "px";
  els.board.style.gridTemplateColumns = `repeat(${G.cols}, var(--cell))`;
  const bw = G.cols * cell + (G.cols - 1) * gap + pad * 2;
  const bh = G.rows * cell + (G.rows - 1) * gap + pad * 2;
  els.link.setAttribute("viewBox", `0 0 ${bw} ${bh}`);
  /* 宽屏（分栏布局）：让棋盘相对面板垂直居中，避免顶到侧栏顶部 */
  outer.style.alignItems = W >= 700 ? "center" : "stretch";
  G._metrics = { cell, gap, pad };
}

/* 逻辑坐标(含边框) -> 像素中心 */
function cellCenter(r, c){
  const { cell, gap, pad } = G._metrics;
  return [pad + (c - 1) * (cell + gap) + cell / 2,
          pad + (r - 1) * (cell + gap) + cell / 2];
}

function renderBoard(){
  els.board.innerHTML = "";
  G.tileEls = Array.from({ length: G.rows + 2 }, () => Array(G.cols + 2).fill(null));
  const cfg = G.psr ? { kinds: PSR_LEVELS[G.rpsRound - 1].icons.length } : (G.endless || G.survival) ? ENDLESS : LEVELS[G.level - 1];
  const kinds = cfg.kinds;
  const icons = G.psr ? PSR_LEVELS[G.rpsRound - 1].icons : null;
  for(let r = 1; r <= G.rows; r++)
    for(let c = 1; c <= G.cols; c++){
      const v = G.board[r][c];
      const b = document.createElement("button");
      b.className = "tile";
      b.dataset.r = r; b.dataset.c = c;
      b.setAttribute("role", "gridcell");
      paintTile(b, v, kinds, icons);
      if(!v){ b.classList.add("empty"); b.tabIndex = -1; }
      els.board.appendChild(b);
      G.tileEls[r][c] = b;
    }
}

function paintTile(el, v, kinds, icons){
  el.className = "tile";
  el.textContent = "";
  if(v === STONE){
    el.classList.add("special", "stone");
    el.textContent = "🪨";
    el.setAttribute("aria-label", "石板块，不可消除");
  }else if(v === FROZEN){
    el.classList.add("special", "frozen");
    el.textContent = "🧊";
    el.setAttribute("aria-label", "冰冻块，消除相邻一对后解冻");
  }else if(v === RAINBOW){
    el.classList.add("special", "rainbow");
    el.textContent = "🌈";
    el.setAttribute("aria-label", "彩虹块，可和任意图案配对");
  }else if(v === CLOCK){
    el.classList.add("special", "clock");
    el.textContent = "⏰";
    el.setAttribute("aria-label", "时钟块，消除后加十五秒");
  }else if(v){
    const hue = Math.round(((v - 1) / kinds) * 320 + 10);
    el.style.setProperty("--h", hue);
    el.textContent = icons ? icons[v - 1] : THEMES[save.theme].icons[v - 1];
    el.setAttribute("aria-label", "图案 " + el.textContent);
  }
}

function syncTile(r, c){
  const el = G.tileEls[r][c], v = G.board[r][c];
  if(!el) return;
  const cfg = G.psr ? { kinds: PSR_LEVELS[G.rpsRound - 1].icons.length } : (G.endless || G.survival) ? ENDLESS : LEVELS[G.level - 1];
  const icons = G.psr ? PSR_LEVELS[G.rpsRound - 1].icons : null;
  paintTile(el, v, cfg.kinds, icons);
  if(v){ el.tabIndex = 0; }
  else{ el.classList.add("empty"); el.tabIndex = -1; }
}

function renderAllTiles(){
  for(let r = 1; r <= G.rows; r++)
    for(let c = 1; c <= G.cols; c++) syncTile(r, c);
}

function updateHud(){
  els.hudLevel.textContent = G.survival ? "无尽 · 生存"
    : G.psr ? `克制消除 · 第 ${G.rpsRound} 关 ${PSR_LEVELS[G.rpsRound - 1].name}`
    : G.endless ? `无尽 · 第 ${G.endlessRound} 轮` : `第 ${G.level} 关`;
  els.hudScore.textContent = G.endless ? G.endlessScore : G.score;
  els.hudLeft.textContent = G.psr ? `剩 ${G.remainTiles} 个`
    : G.survival ? `已消 ${G.survCleared} 对` : `剩 ${G.remainPairs} 对`;
  els.shuffleCount.textContent = G.shufflesLeft;
  /* 克制链常驻条：克制消除对局内一直显示，暂停遮罩(z-index 20)也盖不住它 */
  const cb = $("chain-bar");
  if(G.psr){
    const ic = PSR_LEVELS[G.rpsRound - 1].icons;
    cb.hidden = false;
    cb.innerHTML = `<span class="chain-cap">克制链（左克右）</span>${ic.join("→")}→${ic[0]}`;
  }else{
    cb.hidden = true;
  }
  const tgt = $("hud-target");
  if(G.survival){
    tgt.hidden = false;
    tgt.textContent = `图案 ${G.survKinds} 种 · 每对 +${G.survReward} 秒`;
  }else if(G.targetKind){
    tgt.hidden = false;
    tgt.textContent = `目标：消完所有 ${THEMES[save.theme].icons[G.targetKind - 1]}`;
  }else{
    tgt.hidden = true;
  }
  if(G.combo >= 2){
    els.hudCombo.hidden = false;
    els.hudCombo.textContent = `连击 x${G.combo}`;
    els.hudCombo.style.animation = "none";
    void els.hudCombo.offsetWidth;
    els.hudCombo.style.animation = "";
  }else{
    els.hudCombo.hidden = true;
  }
}

/* ---------- 特效 ---------- */
function drawLink(corners){
  const { cell } = G._metrics;
  const pts = corners.map(([r, c]) => cellCenter(r, c));
  const W = parseFloat(els.link.getAttribute("viewBox").split(" ")[2]);
  const H = parseFloat(els.link.getAttribute("viewBox").split(" ")[3]);
  const clamp = (v, max) => Math.max(3, Math.min(max - 3, v));
  const attr = pts.map(([x, y]) => `${clamp(x, W)},${clamp(y, H)}`).join(" ");
  const pl = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  pl.setAttribute("points", attr);
  pl.setAttribute("fill", "none");
  pl.setAttribute("stroke", "oklch(0.68 0.18 42)");
  pl.setAttribute("stroke-width", Math.max(3, cell * 0.12));
  pl.setAttribute("stroke-linecap", "round");
  pl.setAttribute("stroke-linejoin", "round");
  els.link.appendChild(pl);
  const len = pl.getTotalLength();
  pl.style.strokeDasharray = len;
  pl.style.strokeDashoffset = len;
  pl.animate(
    [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
    { duration: 180, easing: "ease-out", fill: "forwards" }
  );
  setTimeout(() => {
    pl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" })
      .onfinish = () => pl.remove();
  }, 200);
}

function sparks(r1, c1, r2, c2, hue){
  const [x1, y1] = cellCenter(r1, c1), [x2, y2] = cellCenter(r2, c2);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  for(let i = 0; i < 7; i++){
    const s = document.createElement("span");
    s.className = "spark";
    const ang = Math.random() * Math.PI * 2, dist = 22 + Math.random() * 30;
    s.style.cssText = `left:${mx - 8}px;top:${my - 8}px;width:9px;height:9px;border-radius:50%;
      background:oklch(0.78 0.16 ${hue});--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist - 18}px`;
    els.fx.appendChild(s);
    setTimeout(() => s.remove(), 750);
  }
}

function floatScore(r1, c1, r2, c2, text){
  const [x1, y1] = cellCenter(r1, c1), [x2, y2] = cellCenter(r2, c2);
  const s = document.createElement("span");
  s.className = "float-score";
  s.textContent = text;
  s.style.left = ((x1 + x2) / 2 - 20) + "px";
  s.style.top = ((y1 + y2) / 2 - 10) + "px";
  els.fx.appendChild(s);
  setTimeout(() => s.remove(), 850);
}

let toastTimer = null;
function toast(msg){
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.hidden = true, 1800);
}

/* ---------- 计时 ---------- */
function startTimer(){
  stopTimer();
  if(G.mode === "casual"){
    G.startAt = Date.now() - G.elapsed * 1000;
  }else{
    G.deadline = Date.now() + G.timeLeft * 1000;
  }
  G.timerId = setInterval(tick, 200);
  tick();
}
function stopTimer(){
  if(G.timerId){ clearInterval(G.timerId); G.timerId = null; }
}
function fmt(sec){
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
function tick(){
  if(G.mode === "casual"){
    G.elapsed = Math.round((Date.now() - G.startAt) / 1000);
    els.timerFill.style.width = "100%";
    els.timerFill.classList.remove("low");
    els.timerText.textContent = "已用时 " + fmt(G.elapsed);
    return;
  }
  G.timeLeft = Math.max(0, Math.ceil((G.deadline - Date.now()) / 1000));
  const ratio = G.timeLeft / G.timeTotal;
  els.timerFill.style.width = (Math.min(1, ratio) * 100) + "%";   // 时间银行累积时超出部分不溢出
  els.timerFill.classList.toggle("low", ratio < 0.25);
  els.timerText.textContent = fmt(G.timeLeft);
  if(G.timeLeft <= 0){
    stopTimer();
    gameOver();
  }
}

/* ---------- 交互 ---------- */
function targetReached(){
  if(!G.targetKind) return true;
  for(let r = 1; r <= G.rows; r++)
    for(let c = 1; c <= G.cols; c++)
      if(G.board[r][c] === G.targetKind) return false;
  return true;
}

function onTileTap(r, c){
  if(!G.playing || G.paused || G.locked) return;
  if(!G.board[r][c]) return;
  const el = G.tileEls[r][c];
  if(G.psr){
    // ===== 仅克制成对：被克者消失，克制者留下继续 =====
    if(!G.selected){
      G.selected = [r, c];
      el.classList.add("selected");
      sfx.select();
      return;
    }
    const [sr, sc] = G.selected;
    if(sr === r && sc === c){
      el.classList.remove("selected");
      G.selected = null;
      sfx.click();
      return;
    }
    const selEl = G.tileEls[sr][sc];
    const va = G.board[sr][sc], vb = G.board[r][c];
    if(!dominates(va, vb)){
      selEl.classList.remove("selected");
      selEl.classList.add("bad");
      setTimeout(() => selEl.classList.remove("bad"), 320);
      G.selected = [r, c];
      el.classList.add("selected");
      sfx.bad();
      return;
    }
    const path = findPath(G.board, sr, sc, r, c);
    if(!path){
      selEl.classList.remove("selected");
      selEl.classList.add("bad");
      el.classList.add("bad");
      setTimeout(() => { selEl.classList.remove("bad"); el.classList.remove("bad"); }, 320);
      G.selected = [r, c];
      el.classList.add("selected");
      sfx.bad();
      return;
    }
    // 消除被克者 vb，留下克制者 va（位置不动、保持选中）
    G.locked = true;
    const now = Date.now();
    G.combo = (now - G.lastMatchAt < COMBO_WINDOW) ? G.combo + 1 : 1;
    G.lastMatchAt = now;
    const gain = 10 + (G.combo - 1) * 5;
    G.score += gain;
    G.remainTiles--;
    G.board[r][c] = 0;
    drawLink(path);
    const hue = getComputedStyle(el).getPropertyValue("--h").trim() || 40;
    sparks(sr, sc, r, c, hue);
    floatScore(sr, sc, r, c, "+" + gain + (G.combo >= 2 ? ` x${G.combo}` : ""));
    sfx.match(G.combo);
    el.classList.add("matched");
    updateHud();
    setTimeout(() => {
      syncTile(r, c);
      G.locked = false;
      // 收官条件：剩 1 子（最后一子无法被吃）；只剩一种元素；
      // 或剩余元素互不相克（如五行中的金与水，环状克制链相隔两个位）
      const st = psrState();
      if(G.remainTiles <= 1 || st.kindsLeft < 2 || !st.pair){
        G.selected = null;
        selEl.classList.remove("selected");
        psrRoundComplete();
        return;
      }
      if(!st.pair){
        reshuffleRemaining();
        renderAllTiles();
      }
      updateHud();
    }, 300);
    return;
  }
  if(!G.selected){
    G.selected = [r, c];
    el.classList.add("selected");
    sfx.select();
    return;
  }
  const [sr, sc] = G.selected;
  if(sr === r && sc === c){          // 再点一次取消
    el.classList.remove("selected");
    G.selected = null;
    sfx.click();
    return;
  }
  const selEl = G.tileEls[sr][sc];
  const va = G.board[sr][sc], vb = G.board[r][c];
  const blocked = va === STONE || vb === STONE || va === FROZEN || vb === FROZEN;
  const matchable = !blocked && (va === vb ||
    va === RAINBOW && vb && vb !== STONE && vb !== FROZEN ||
    vb === RAINBOW && va && va !== STONE && va !== FROZEN);
  if(!matchable){                      // 图案不同：改选
    selEl.classList.remove("selected");
    selEl.classList.add("bad");
    setTimeout(() => selEl.classList.remove("bad"), 320);
    G.selected = [r, c];
    el.classList.add("selected");
    sfx.bad();
    return;
  }
  const path = findPath(G.board, sr, sc, r, c);
  if(!path){                            // 连不通：改选
    selEl.classList.remove("selected");
    selEl.classList.add("bad");
    el.classList.add("bad");
    setTimeout(() => { selEl.classList.remove("bad"); el.classList.remove("bad"); }, 320);
    G.selected = [r, c];
    el.classList.add("selected");
    sfx.bad();
    return;
  }
  // ===== 成功消除 =====
  G.locked = true;
  selEl.classList.remove("selected");
  G.selected = null;
  const now = Date.now();
  G.combo = (now - G.lastMatchAt < COMBO_WINDOW) ? G.combo + 1 : 1;
  G.lastMatchAt = now;
  let gain = 10 + (G.combo - 1) * 5;
  // 时钟块加时
  if(G.mode === "timed" && !G.endless && (va === CLOCK || vb === CLOCK)){
    G.deadline = Math.min(G.deadline + CLOCK_BONUS * 1000, Date.now() + G.timeTotal * 1000);
    glog("时钟加时", `+${CLOCK_BONUS}秒`);
    floatScore(r, c, r, c, `+${CLOCK_BONUS}秒`);
    toast(`时钟块：时间 +${CLOCK_BONUS} 秒`);
  }
  // 冰冻块：消除相邻一对解冻（去重；本局一旦判定过"完全困死"就不再解冻）
  const adjFrozen = [];
  if(!G.noThaw){
    const frozenSeen = new Set();
    [[sr, sc], [r, c]].forEach(([br, bc]) => {
      for(const [dr, dc] of DIRS){
        const nr = br + dr, nc = bc + dc;
        const key = nr + "," + nc;
        if(nr >= 1 && nr <= G.rows && nc >= 1 && nc <= G.cols && G.board[nr][nc] === FROZEN && !frozenSeen.has(key)){
          frozenSeen.add(key);
          adjFrozen.push([nr, nc]);
        }
      }
    });
    /* 若某个冰冻块的四个正邻全是不可通行格（石头/其他冰冻），它永远等不到相邻的一对，
       本局标记 noThaw：不再为它解冻，残局按不可消除残留强制清盘（免去漫长无解重试） */
    if(adjFrozen.some(([fr, fc]) =>
      DIRS.every(([dr, dc]) => {
        const nr = fr + dr, nc = fc + dc;
        if(nr < 1 || nr > G.rows || nc < 1 || nc > G.cols) return true;   // 边缘也算堵死
        const v = G.board[nr][nc];
        return v === STONE || v === FROZEN;
      })
    )) G.noThaw = true;
  }
  const type = va === vb ? "同图案" : ((va === RAINBOW || vb === RAINBOW) ? "彩虹配对" : "克制配对");
  /* 日志显示本次消除后的剩余计数；有解冻时标注，格式统一为"剩=X · 解冻xN · 剩=Y" */
  const after = G.survival ? G.remainPairs : G.remainPairs - 1 - adjFrozen.length;
  glog("消除", `${type} ${va}+${vb} · 连击x${G.combo} +${gain}分 · 剩=${after}${adjFrozen.length ? ` · 解冻x${adjFrozen.length}` : ""}${G.survival ? ` · 已消${G.survCleared + 1}对 · +${G.survReward}秒` : ""}`);
  G.score += gain;
  G.remainPairs = after;
  G.board[sr][sc] = 0; G.board[r][c] = 0;
  drawLink(path);
  const hue = getComputedStyle(el).getPropertyValue("--h").trim() || 40;
  sparks(sr, sc, r, c, hue);
  floatScore(sr, sc, r, c, "+" + gain + (G.combo >= 2 ? ` x${G.combo}` : ""));
  sfx.match(G.combo);
  el.classList.add("matched");
  selEl.classList.add("matched");
  adjFrozen.forEach(([fr, fc]) => { G.board[fr][fc] = 0; });
  updateHud();
  setTimeout(() => {
    syncTile(sr, sc); syncTile(r, c);
    adjFrozen.forEach(([fr, fc]) => {
      syncTile(fr, fc);
      const fel = G.tileEls[fr][fc];
      fel.classList.add("thaw");
      setTimeout(() => fel.classList.remove("thaw"), 450);
    });
    G.locked = false;
    /* ===== 无尽·生存：原地补充新元素，保持总数不变；每对奖励时间；难度递增 ===== */
    if(G.survival){
      G.survCleared++;
      G.board[sr][sc] = 1 + Math.floor(Math.random() * G.survKinds);
      G.board[r][c] = 1 + Math.floor(Math.random() * G.survKinds);
      syncTile(sr, sc); syncTile(r, c);
      for(const [rr, cc] of [[sr, sc], [r, c]]){
        const el2 = G.tileEls[rr][cc];
        el2.classList.add("spawn");
        setTimeout(() => el2.classList.remove("spawn"), 340);
      }
      /* 奖励时间（时间银行可持续累积，不封顶） */
      G.deadline += G.survReward * 1000;
      floatScore(sr, sc, r, c, `+${G.survReward}秒`);
      /* 难度递增：每 15 对 +1 图案（上限 12 种，找对难度封顶）；
         每 15 对奖励 -0.2 秒（下限 2.0 秒，后期平衡速度约 1.0~1.2 秒/对） */
      const nk = Math.min(12, 6 + Math.floor(G.survCleared / 15));
      if(nk > G.survKinds){
        G.survKinds = nk;
        toast(`图案增至 ${nk} 种，难度升级！`);
        glog("难度提升", `${nk} 种图案`);
        renderAllTiles();
      }
      G.survReward = Math.max(2.0, Math.round((4 - 0.2 * Math.floor(G.survCleared / 15)) * 10) / 10);
      /* 保持计数恒定（原地补充，总数不变） */
      G.remainPairs = boardUnits();
      updateHud();
      /* 盘面全满时可能暂时无连通对：重排找解（生存模式永不强制清盘） */
      if(!findMove()){
        let t = 0;
        do{ reshuffleRemaining(); t++; }while(!findMove() && t < 100);
        renderAllTiles();
        glog("自动洗牌", `生存重排x${t}`);
      }
      return;
    }
    if(G.remainPairs <= 0){
      glog("终局判定", `计数清零 · 盘面=${boardUnits()}`);
      levelComplete();
      return;
    }
    if(!findAnyPair()){
      // 无合法对：反复重排直到有解；实在凑不出对才清残留收官
      let tries = 0;
      do{
        reshuffleRemaining();
        tries++;
      }while(!findMove() && !findAnyPair() && tries < 50);
      if(!findMove() && !findAnyPair()){
        glog("强制清盘", `死局触发 · 计数=${G.remainPairs} · 盘面单位=${boardUnits()}`);
        for(let r = 1; r <= G.rows; r++)
          for(let c = 1; c <= G.cols; c++){
            const v = G.board[r][c];
            if(!v || v === STONE) continue;
            G.board[r][c] = 0;
            syncTile(r, c);
            if(G.remainPairs > 0)
              G.remainPairs -= v === RAINBOW || v === CLOCK || v === FROZEN ? 1 : 0.5;
          }
        G.remainPairs = 0;
        updateHud();
        if(G.remainPairs <= 0){ levelComplete(); return; }
      }else{
        renderAllTiles();
        glog("自动洗牌", "无解→重排");
        toast("没有可消除的组合，已自动洗牌");
        sfx.shuffle();
      }
      return;
    }
    if(G.targetKind && targetReached()){
      G.score += 150;
      glog("目标完成", "+150分");
      toast("目标完成！奖励 +150 分");
      G.targetKind = null;
      updateHud();
    }
    if(!findMove() && !findAnyPair()){
      // 残局只是被石头挡住或位置不巧：反复重排直到有解，避免误清可消的对
      let tries = 0;
      do{
        reshuffleRemaining();
        tries++;
      }while(!findMove() && !findAnyPair() && tries < 50);
      if(!findMove() && !findAnyPair()){
        // 盘上凑不出任何对（如彩虹+石头）：清掉残留收官
        glog("强制清盘", `死局触发 · 计数=${G.remainPairs} · 盘面单位=${boardUnits()}`);
        for(let r = 1; r <= G.rows; r++)
          for(let c = 1; c <= G.cols; c++){
            const v = G.board[r][c];
            if(!v || v === STONE) continue;
            G.board[r][c] = 0;
            syncTile(r, c);
            if(G.remainPairs > 0)
              G.remainPairs -= v === RAINBOW || v === CLOCK || v === FROZEN ? 1 : 0.5;
          }
        G.remainPairs = 0;
        updateHud();
        if(G.remainPairs <= 0){ levelComplete(); return; }
      }else{
        renderAllTiles();
        glog("自动洗牌", `无解→重排${tries > 1 ? `x${tries}` : ""}`);
        toast("没有可消除的组合，已自动洗牌");
        sfx.shuffle();
      }
    }
  }, 300);
}

/* ---------- 提示 / 洗牌 ---------- */
function useHint(){
  if(!G.playing || G.paused || G.locked) return;
  let move;
  if(G.psr){
    move = psrState().pair;
  }else{
    move = findMove();
  }
  if(!move){
    if(G.psr){ psrRoundComplete(); return; }   // psr 无对即终局（洗牌无法改变克制关系）
    let tries = 0;
    do{
      reshuffleRemaining();
      tries++;
    }while(!findMove() && !findAnyPair() && tries < 50);
    if(!findMove() && !findAnyPair()){
      // 重排后仍无解：清除无法凑对的残留（单块/落单彩虹时钟），避免死局
      glog("强制清盘", `提示触发 · 计数=${G.remainPairs} · 盘面单位=${boardUnits()}`);
      for(let r = 1; r <= G.rows; r++)
        for(let c = 1; c <= G.cols; c++){
          const v = G.board[r][c];
          if(!v || v === STONE) continue;
          G.board[r][c] = 0;
          syncTile(r, c);
          if(G.remainPairs > 0)
            G.remainPairs -= v === RAINBOW || v === CLOCK || v === FROZEN ? 1 : 0.5;
        }
      G.remainPairs = 0;
      updateHud();
      if(G.remainPairs <= 0){ levelComplete(); return; }
    }else{
      renderAllTiles();
      glog("自动洗牌", `提示触发 · 重排${tries > 1 ? `x${tries}` : ""}`);
      sfx.shuffle();
      toast("没有可消除的组合，已自动洗牌");
    }
    return;
  }
  G.hintsUsed++;
  const cost = G.survival ? 10 : HINT_COST;   // 生存模式：提示是"花钱买时间"的策略，半价
  glog("提示", `-${cost}分 · 剩=${G.psr ? G.remainTiles : G.remainPairs}`);
  if(G.selected){
    G.tileEls[G.selected[0]][G.selected[1]].classList.remove("selected");
    G.selected = null;
  }
  G.score = Math.max(0, G.score - cost);
  const [a, b] = [move.a, move.b];
  [a, b].forEach(([r, c]) => {
    const el = G.tileEls[r][c];
    el.classList.add("hint");
    setTimeout(() => el.classList.remove("hint"), 1700);
  });
  sfx.click();
  updateHud();
  toast(`提示 -${cost} 分`);
}

function useShuffle(){
  if(!G.playing || G.paused || G.locked) return;
  if(G.shufflesLeft <= 0){ toast("洗牌次数用完了"); sfx.bad(); return; }
  if(G.selected){
    G.tileEls[G.selected[0]][G.selected[1]].classList.remove("selected");
    G.selected = null;
  }
  G.shufflesLeft--;
  glog("手动洗牌", `剩${G.shufflesLeft}次`);
  reshuffleRemaining();
  renderAllTiles();
  sfx.shuffle();
  updateHud();
  toast("已重新洗牌");
}

/* ---------- 关卡流程 ---------- */
function startLevel(n){
  if(n === "endless"){ startEndless(); return; }
  const cfg = LEVELS[n - 1];
  G.level = n;
  G.endless = false; G.psr = false; G.survival = false; G.targetKind = null;
  G.mode = save.mode;
  G.score = 0; G.combo = 0; G.lastMatchAt = 0;
  G.selected = null; G.locked = false; G.noThaw = false;
  G.shufflesLeft = SHUFFLE_TIMES;
  G.hintsUsed = 0; G.elapsed = 0;
  G.timeTotal = cfg.time; G.timeLeft = cfg.time;
  if(cfg.target === "strawberry") G.targetKind = 4;
  buildBoard(n);
  els.title.hidden = true;
  els.game.hidden = false;
  hideOverlay();
  renderBoard();
  requestAnimationFrame(() => {
    layoutBoard();
    G.playing = true; G.paused = false;
    updateHud();
    startTimer();
    glog("开始", `${G.mode === "casual" ? "休闲" : "限时"} · ${cfg.cols}x${cfg.rows} · ${cfg.time}秒${G.targetKind ? " · 有目标" : ""}`);
    if(cfg.target === "strawberry") toast("目标：限时内消完所有 🍓！");
    if(cfg.target === "maxhint") toast("目标：最多使用 2 次提示通关！");
  });
}

function startEndless(){
  G.endless = true; G.level = 0; G.psr = false; G.survival = false;
  G.endlessScore = 0; G.endlessRound = 1;
  G.mode = "timed";   // 无尽是计时生存玩法，强制限时
  G.combo = 0; G.lastMatchAt = 0;
  G.selected = null; G.locked = false; G.noThaw = false;
  G.hintsUsed = 0; G.elapsed = 0;
  G.targetKind = null;
  const cells = 6 * 8;
  G.timeTotal = G.timeLeft = endlessBudget(cells);
  G.endlessEarn = endlessEarn(cells);
  setupBoard(6, 8, ENDLESS.kinds, ENDLESS.special);
  els.title.hidden = true;
  els.game.hidden = false;
  hideOverlay();
  renderBoard();
  requestAnimationFrame(() => {
    layoutBoard();
    G.playing = true; G.paused = false;
    updateHud();
    startTimer();
    glog("开始", `无尽模式 · 首轮 ${G.timeTotal}秒`);
    toast(`每轮时限 = 12秒 + 每对4秒；清完一轮，应得时间存入时间银行！`);
  });
}

/* 无尽·生存：盘面 8×8 恒定，消除一对原地补充一对，每对奖时；图案渐多、奖时渐少，撑到时间耗尽 */
function startSurvival(){
  G.survival = true; G.endless = false; G.psr = false; G.level = 0;
  G.mode = "timed";
  G.score = 0; G.combo = 0; G.lastMatchAt = 0;
  G.selected = null; G.locked = false; G.noThaw = false;
  G.shufflesLeft = 3;
  G.hintsUsed = 0; G.elapsed = 0;
  G.targetKind = null;
  G.survKinds = 6; G.survCleared = 0; G.survReward = 4;
  G.timeTotal = G.timeLeft = 42;
  setupBoard(7, 7, 6, 0);
  els.title.hidden = true;
  els.game.hidden = false;
  hideOverlay();
  renderBoard();
  requestAnimationFrame(() => {
    layoutBoard();
    G.playing = true; G.paused = false;
    updateHud();
    startTimer();
    glog("开始", "无尽生存 · 7x7 · 6图案 · 42秒");
    toast("消除一对原地补充一对，+4 秒；盘面 7×7，图案越打越多！");
  });
}

function survivalGameOver(){
  stopTimer();
  G.playing = false;
  glog("失败", `时间到 · 消除${G.survCleared}对 · ${G.survKinds}图案 · 得分${G.score}`);
  const best = Math.max(save.bestSurvival || 0, G.score);
  const isNew = G.score > 0 && G.score >= best;
  save.bestSurvival = best;
  persist();
  sfx.lose();
  showOverlay(`
    <div class="ov-emoji">⏰</div>
    <h2 class="ov-title">时间到！</h2>
    <p class="ov-detail">消除 <b>${G.survCleared}</b> 对 · 图案增至 <b>${G.survKinds}</b> 种<br>得分 <b>${G.score}</b>${isNew ? " · 新纪录！" : ""} · 历史最佳 ${best}</p>
    <div class="ov-btns">
      <button class="btn btn-primary" data-act="survival">再来一局</button>
      <button class="btn btn-secondary" data-act="home">返回主页</button>
    </div>
  `);
}

function startPsrRound(n){
  n = Math.max(1, Math.min(PSR_LEVELS.length, n));
  const lv = PSR_LEVELS[n - 1];
  G.psr = true; G.endless = false; G.survival = false; G.level = 0;
  G.rpsRound = n;
  G.rpsKinds = lv.icons.length;
  G.mode = "timed";
  G.score = 0; G.combo = 0; G.lastMatchAt = 0;
  G.selected = null; G.locked = false; G.noThaw = false;
  G.shufflesLeft = 2;
  G.hintsUsed = 0; G.elapsed = 0;
  G.targetKind = null;
  G.timeTotal = lv.time; G.timeLeft = lv.time;
  // 每元素数量相等（数量相等才能保证不留死局），棋盘格数已按元素数取整
  const [cols, rows] = [lv.cols, lv.rows];
  const per = cols * rows / G.rpsKinds;
  const ids = [];
  for(let v = 1; v <= G.rpsKinds; v++)
    for(let i = 0; i < per; i++) ids.push(v);
  shuffleArray(ids);
  G.cols = cols; G.rows = rows;
  G.board = Array.from({ length: rows + 2 }, () => Array(cols + 2).fill(0));
  let k = 0;
  for(let r = 1; r <= rows; r++)
    for(let c = 1; c <= cols; c++)
      G.board[r][c] = ids[k++];
  G.remainTiles = cols * rows;
  els.title.hidden = true;
  els.game.hidden = false;
  hideOverlay();
  renderBoard();
  requestAnimationFrame(() => {
    layoutBoard();
    G.playing = true; G.paused = false;
    updateHud();
    startTimer();
    glog("开始", `克制消除·第${n}关「${lv.name}」 · ${cols}x${rows} · ${G.timeTotal}秒`);
    toast(`第 ${n} 关「${lv.name}」：${lv.icons.join("→")}→${lv.icons[0]}，点克制者吃掉被克者！`);
  });
}

/* 克制关系文案：有 names 的关卡用名字（如 刘备克诸葛亮），否则用图标 */
function psrBeatsText(){
  const lv = PSR_LEVELS[G.rpsRound - 1];
  const names = lv.names || lv.icons;
  return lv.beats.map(([a, b]) => `${names[a]}克${names[b]}`).join("，");
}

function psrRoundComplete(){
  stopTimer();
  G.playing = false;
  glog("通关", `第${G.rpsRound}关完成 · 幸存${G.remainTiles}个 · 盘面=${boardUnits()}`);
  G.score += Math.round(G.timeLeft) * 2;
  const lv = PSR_LEVELS[G.rpsRound - 1];
  const bestKey = "psr" + G.rpsRound;
  save.bestScore[bestKey] = Math.max(save.bestScore[bestKey] || 0, G.score);
  save.psrUnlocked = Math.max(save.psrUnlocked || 1, Math.min(PSR_LEVELS.length, G.rpsRound + 1));
  persist();
  sfx.win();
  updateHud();
  renderPsrLevelSelect();
  const isMax = G.rpsRound >= PSR_LEVELS.length;
  const survivorLine = G.remainTiles > 1
    ? `<br>🏅 幸存 ${G.remainTiles} 个，剩下的互不相克，和平收场`
    : `<br>🏅 只剩最后 1 个幸存者——食物链顶端！`;
  showOverlay(`
    <div class="ov-emoji">${isMax ? "🏆" : "🎉"}</div>
    <h2 class="ov-title">${isMax ? "克制消除 · 全部通关！" : `第 ${G.rpsRound} 关「${lv.name}」完成！`}</h2>
    <p class="ov-detail">${G.rpsKinds} 个元素 · 克制关系：${psrBeatsText()}<br>本关得分 <b>${G.score}</b>（本关最佳 ${save.bestScore[bestKey]}）${survivorLine}</p>
    <div class="ov-btns">
      ${isMax
        ? `<button class="btn btn-primary" data-act="home">返回主页</button>
           <button class="btn btn-secondary" data-act="psr-retry">重玩本关</button>`
        : `<button class="btn btn-primary" data-act="psr-next">下一关：${PSR_LEVELS[G.rpsRound].name}</button>
           <button class="btn btn-secondary" data-act="psr-retry">重玩本关</button>
           <button class="btn btn-secondary" data-act="home">返回主页</button>`}
    </div>
  `);
}

function psrGameOver(){
  stopTimer();
  G.playing = false;
  glog("失败", `时间到 · 剩${G.remainTiles}个 · 盘面=${boardUnits()}`);
  const bestKey = "psr" + G.rpsRound;
  save.bestScore[bestKey] = Math.max(save.bestScore[bestKey] || 0, G.score);
  persist();
  sfx.lose();
  const lv = PSR_LEVELS[G.rpsRound - 1];
  showOverlay(`
    <div class="ov-emoji">⏰</div>
    <h2 class="ov-title">时间到！</h2>
    <p class="ov-detail">第 ${G.rpsRound} 关「${lv.name}」（${G.rpsKinds} 个元素）得分 <b>${G.score}</b>，还剩 ${G.remainTiles} 个<br>本关最佳 ${save.bestScore[bestKey]}</p>
    <div class="ov-btns">
      <button class="btn btn-primary" data-act="psr-retry">再试一次</button>
      <button class="btn btn-secondary" data-act="home">返回主页</button>
    </div>
  `);
}

function endlessNextRound(){
  /* 先结算上一轮的"应得时间"存入银行（时间银行可持续累积，玩得快就攒得多） */
  G.deadline += G.endlessEarn * 1000;
  const banked = G.endlessEarn;
  G.endlessRound++;
  const order = [[6,8],[7,8],[8,9],[8,10],[8,8],[6,6],[5,6]];
  const [cols, rows] = order[(G.endlessRound - 1) % order.length];
  const special = Math.min(2 + G.endlessRound, 14);
  G.combo = 0; G.lastMatchAt = 0;
  G.selected = null; G.locked = false; G.noThaw = false;
  G.timeLeft = Math.ceil((G.deadline - Date.now()) / 1000);
  G.timeTotal = Math.max(G.timeTotal, G.timeLeft);
  glog("无尽下一轮", `第${G.endlessRound}轮 · 银行+${banked}秒`);
  const cells = cols * rows;
  G.endlessEarn = endlessEarn(cells);
  setupBoard(cols, rows, ENDLESS.kinds, special);
  renderBoard();
  requestAnimationFrame(() => {
    layoutBoard();
    G.locked = false;
    updateHud();
    toast(`第 ${G.endlessRound} 轮 · 银行 +${banked} 秒，当前剩 ${G.timeLeft} 秒`);
  });
}

function levelComplete(){
  stopTimer();
  G.playing = false;
  glog("通关", `计数=${G.remainPairs} · 盘面=${boardUnits()} · 可消=${!!findAnyPair()} · 剩余${Math.max(0, Math.round(G.timeLeft))}秒`);
  if(G.endless){
    G.endlessScore += G.score;
    const cont = G.mode !== "timed" || G.timeLeft > 0;
    if(cont){
      sfx.win();
      showOverlay(`
        <div class="ov-emoji">✨</div>
        <h2 class="ov-title">第 ${G.endlessRound} 轮完成！</h2>
        <p class="ov-detail">本轮得分 <b>${G.score}</b> · 总分 <b>${G.endlessScore}</b><br>时间银行 +${G.endlessEarn} 秒 · 当前剩 ${Math.max(0, Math.round(G.timeLeft))} 秒</p>
        <div class="ov-btns">
          <button class="btn btn-primary" data-act="endless-next">继续挑战</button>
          <button class="btn btn-secondary" data-act="endless-quit">结束并结算</button>
        </div>
      `);
    }else{
      endlessGameOver();
    }
    return;
  }
  const casual = G.mode === "casual";
  const bonus = casual ? 0 : G.timeLeft * 2;
  G.score += bonus;
  // 限时模式按剩余时间评星；休闲模式按提示使用次数评星
  const ratio = G.timeLeft / G.timeTotal;
  let stars = casual
    ? (G.hintsUsed === 0 ? 3 : G.hintsUsed <= 2 ? 2 : 1)
    : (ratio >= 0.4 ? 3 : ratio >= 0.15 ? 2 : 1);
  const maxhint = LEVELS[G.level - 1].target === "maxhint";
  if(maxhint && G.hintsUsed > 2) stars = 1;
  save.stars[G.level] = Math.max(save.stars[G.level] || 0, stars);
  save.bestScore[G.level] = Math.max(save.bestScore[G.level] || 0, G.score);
  const isLast = G.level >= LEVELS.length;
  if(!isLast) save.unlocked = Math.max(save.unlocked, G.level + 1);
  persist();
  sfx.win();
  updateHud();
  const starStr = [1,2,3].map(i =>
    `<span class="${i <= stars ? "" : "dim"}">★</span>`).join("");
  const targetLine = maxhint ? ` · 提示 <b>${G.hintsUsed}</b>/2 次` : "";
  const detail = casual
    ? `用时 <b>${fmt(G.elapsed)}</b> · 提示 <b>${G.hintsUsed}</b> 次<br>本关得分 <b>${G.score}</b>（历史最佳 ${save.bestScore[G.level]}）`
    : `消除得分 <b>${G.score - bonus}</b> + 时间加成 <b>${bonus}</b>${targetLine}<br>本关总分 <b>${G.score}</b>（历史最佳 ${save.bestScore[G.level]}）`;
  showOverlay(`
    <div class="ov-emoji">${isLast ? "🏆" : "🎉"}</div>
    <h2 class="ov-title">${isLast ? "全部通关！" : "过关！"}</h2>
    <div class="ov-stars">${starStr}</div>
    <p class="ov-detail">${detail}</p>
    <div class="ov-btns">
      ${isLast
        ? `<button class="btn btn-primary" data-act="endless">挑战无尽模式</button>
           <button class="btn btn-secondary" data-act="home">返回主页</button>`
        : `<button class="btn btn-primary" data-act="next">下一关</button>
           <button class="btn btn-secondary" data-act="replay">重玩本关</button>
           <button class="btn btn-secondary" data-act="home">返回主页</button>`}
    </div>
  `);
}

function endlessGameOver(){
  stopTimer();
  G.playing = false;
  const best = Math.max(save.bestEndless || 0, G.endlessScore);
  const isNew = G.endlessScore > 0 && G.endlessScore >= best;
  save.bestEndless = best;
  persist();
  sfx.lose();
  showOverlay(`
    <div class="ov-emoji">⏰</div>
    <h2 class="ov-title">时间到！</h2>
    <p class="ov-detail">无尽模式得分 <b>${G.endlessScore}</b>，完成 <b>${G.endlessRound - 1}</b> 轮${isNew ? " · 新纪录！" : ""}<br>历史最佳 ${best}</p>
    <div class="ov-btns">
      <button class="btn btn-primary" data-act="endless">再来一局</button>
      <button class="btn btn-secondary" data-act="home">返回主页</button>
    </div>
  `);
}

function gameOver(){
  if(G.survival){ survivalGameOver(); return; }
  if(G.psr){ psrGameOver(); return; }
  if(G.endless){ endlessGameOver(); return; }
  G.playing = false;
  glog("失败", `时间到 · 计数=${G.remainPairs} · 盘面=${boardUnits()}`);
  sfx.lose();
  const targetLine = G.targetKind
    ? `<br>目标图案还剩 <b>${(()=>{let n=0;for(let r=1;r<=G.rows;r++)for(let c=1;c<=G.cols;c++)if(G.board[r][c]===G.targetKind)n++;return n;})()}</b> 个未消除`
    : "";
  showOverlay(`
    <div class="ov-emoji">⏰</div>
    <h2 class="ov-title">时间到！</h2>
    <p class="ov-detail">本关得分 <b>${G.score}</b>，还剩 <b>${G.remainPairs}</b> 对未消除${targetLine}</p>
    <div class="ov-btns">
      <button class="btn btn-primary" data-act="replay">再试一次</button>
      <button class="btn btn-secondary" data-act="home">返回主页</button>
    </div>
  `);
}

function pauseGame(){
  if(!G.playing || G.paused) return;
  G.paused = true;
  stopTimer();
  glog("暂停", "");
  const where = G.psr ? `克制消除 · 第 ${G.rpsRound} 关 ${PSR_LEVELS[G.rpsRound - 1].name}`
    : G.survival ? "无尽 · 生存"
    : G.endless ? `无尽 · 第 ${G.endlessRound} 轮` : `第 ${G.level} 关`;
  showOverlay(`
    <div class="ov-emoji">⏸️</div>
    <h2 class="ov-title">暂停</h2>
    <p class="ov-detail">${where} · 当前得分 <b>${G.score}</b></p>
    <div class="ov-btns">
      <button class="btn btn-primary" data-act="resume">继续游戏</button>
      <button class="btn btn-secondary" data-act="replay">重新开始</button>
      <button class="btn btn-secondary" data-act="home">返回主页</button>
    </div>
  `);
}

function resumeGame(){
  G.paused = false;
  hideOverlay();
  startTimer();
  glog("继续", "");
}

/* ---------- 遮罩 ---------- */
function showOverlay(html){
  els.overlayCard.innerHTML = html;
  els.overlay.hidden = false;
  const btn = els.overlayCard.querySelector(".btn");
  if(btn) btn.focus();
}
function hideOverlay(){ els.overlay.hidden = true; }

els.overlayCard.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if(!btn) return;
  sfx.click();
  const act = btn.dataset.act;
  if(act === "resume") resumeGame();
  else if(act === "next") startLevel(G.level + 1);
  else if(act === "replay") startLevel(G.level);
  else if(act === "home") goHome();
  else if(act === "endless") startEndless();
  else if(act === "survival") startSurvival();
  else if(act === "endless-next") endlessNextRound();
  else if(act === "endless-quit") endlessGameOver();
  else if(act === "psr-next") startPsrRound(G.rpsRound + 1);
  else if(act === "psr-retry") startPsrRound(G.rpsRound);
});
document.addEventListener("keydown", (e) => {
  if(e.key === "Escape" && !els.overlay.hidden){
    if(G.paused) resumeGame();
  }else if(e.key === "Escape" && G.playing){
    pauseGame();
  }
});

/* ---------- 主页 ---------- */
function goHome(){
  stopTimer();
  G.playing = false; G.paused = false; G.psr = false; G.endless = false; G.survival = false;
  hideOverlay();
  els.game.hidden = true;
  els.title.hidden = false;
  renderLevelSelect();
  renderPsrLevelSelect();
}

/* 克制消除关卡选择（7 关，逐关解锁） */
function renderPsrLevelSelect(){
  const box = $("psr-select");
  if(!box) return;
  box.innerHTML = "";
  const unlocked = save.psrUnlocked || 1;
  PSR_LEVELS.forEach((lv, i) => {
    const n = i + 1;
    const open = n <= unlocked;
    const b = document.createElement("button");
    b.className = "psr-lv" + (open ? "" : " locked");
    b.disabled = !open;
    b.setAttribute("aria-label", open ? `第 ${n} 关 ${lv.name}` : `第 ${n} 关，未解锁`);
    const best = save.bestScore["psr" + n];
    b.innerHTML = open
      ? `<span class="psr-lv-icons">${lv.icons.join("")}</span>
         <span class="psr-lv-name">${n}. ${lv.name}</span>
         ${best ? `<span class="psr-lv-best">最佳 ${best}</span>` : ""}`
      : `<span class="psr-lv-name">${n}. 🔒</span>`;
    if(open) b.addEventListener("click", () => { sfx.click(); startPsrRound(n); });
    box.appendChild(b);
  });
  const btn = $("btn-psr");
  if(btn) btn.textContent = unlocked > 1
    ? `🐯 克制消除 · 继续第 ${Math.min(unlocked, PSR_LEVELS.length)} 关`
    : "🐯 克制消除 · 开始闯关";
}

function renderLevelSelect(){
  els.levelSelect.innerHTML = "";
  let total = 0, totalStars = 0;
  LEVELS.forEach((_, i) => {
    const n = i + 1;
    const unlocked = n <= save.unlocked;
    const stars = save.stars[n] || 0;
    totalStars += stars;
    total += save.bestScore[n] || 0;
    const b = document.createElement("button");
    b.className = "level-btn" + (unlocked ? "" : " locked") + (n === save.unlocked ? " current" : "");
    b.disabled = !unlocked;
    b.setAttribute("aria-label", unlocked ? `第 ${n} 关，${stars} 星` : `第 ${n} 关，未解锁`);
    b.innerHTML = unlocked
      ? `<span>${n}</span><span class="lv-stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</span>`
      : `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z" fill="currentColor"/></svg><span class="lv-stars"></span>`;
    if(unlocked) b.addEventListener("click", () => { sfx.click(); startLevel(n); });
    els.levelSelect.appendChild(b);
  });
  els.bestTotal.textContent = total > 0 ? `总分 ${total} · 星星 ${totalStars}/${LEVELS.length * 3}` : "";
  const bestLine = [];
  if(save.bestEndless > 0) bestLine.push(`闯关最佳 ${save.bestEndless}`);
  if(save.bestSurvival > 0) bestLine.push(`生存最佳 ${save.bestSurvival}`);
  $("endless-best").textContent = bestLine.join(" · ");
  $("btn-start").textContent =
    save.unlocked > 1 || save.stars[1] ? `继续 · 第 ${save.unlocked} 关` : "开始游戏";
}

/* ---------- 音效开关 ---------- */
function syncMute(){
  document.body.classList.toggle("muted", save.muted);
  document.querySelector(".mute-label").textContent = save.muted ? "音效：关" : "音效：开";
  $("btn-mute-game").classList.toggle("muted", save.muted);
}
function toggleMute(){
  save.muted = !save.muted;
  persist();
  syncMute();
  if(!save.muted) sfx.click();
}

/* ---------- 模式切换 ---------- */
const MODE_DESC = {
  timed: "限时内消除全部图案；限时挑战下时钟块可加时",
  casual: "不限时，慢慢消；星星按提示使用次数评定",
};
function syncMode(){
  const casual = save.mode === "casual";
  $("mode-timed").classList.toggle("active", !casual);
  $("mode-timed").setAttribute("aria-checked", String(!casual));
  $("mode-casual").classList.toggle("active", casual);
  $("mode-casual").setAttribute("aria-checked", String(casual));
  $("mode-desc").textContent = MODE_DESC[save.mode];
}
function setMode(mode){
  if(save.mode === mode) return;
  save.mode = mode;
  persist();
  syncMode();
  sfx.click();
}
$("mode-timed").addEventListener("click", () => setMode("timed"));
$("mode-casual").addEventListener("click", () => setMode("casual"));

/* ---------- 主题切换 ---------- */
function syncTheme(){
  document.querySelectorAll(".theme-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.theme === save.theme));
}
function setTheme(t){
  if(!THEMES[t] || save.theme === t) return;
  save.theme = t;
  persist();
  syncTheme();
  if(G.playing) renderAllTiles();
  sfx.click();
}

/* ---------- 事件绑定 ---------- */
$("btn-start").addEventListener("click", () => { sfx.click(); startLevel(save.unlocked); });
$("btn-endless").addEventListener("click", () => { sfx.click(); startEndless(); });
$("btn-survival").addEventListener("click", () => { sfx.click(); startSurvival(); });
$("btn-psr").addEventListener("click", () => { sfx.click(); startPsrRound(save.psrUnlocked || 1); });
document.querySelectorAll(".theme-btn").forEach(b =>
  b.addEventListener("click", () => setTheme(b.dataset.theme)));
$("btn-hint").addEventListener("click", useHint);
$("btn-shuffle").addEventListener("click", useShuffle);
$("btn-pause").addEventListener("click", () => { sfx.click(); pauseGame(); });
$("btn-mute-title").addEventListener("click", toggleMute);
$("btn-mute-game").addEventListener("click", toggleMute);
/* 运行日志面板 */
function refreshLogView(){
  const v = $("log-view");
  if(v) v.textContent = gameLog.length ? exportLogText() : "（暂无日志）";
}
$("btn-log-refresh")?.addEventListener("click", refreshLogView);
$("btn-log-clear")?.addEventListener("click", () => { clearLog(); refreshLogView(); toast("日志已清空"); });
$("btn-log-copy")?.addEventListener("click", () => copyText(exportLogText(30), "已复制最近30条日志"));
$("btn-log-copy50")?.addEventListener("click", () => copyText(exportLogText(50), "已复制最近50条日志"));
$("btn-log-copy-all")?.addEventListener("click", () => copyText(exportLogText(), "已复制全部日志"));
$("btn-log-key")?.addEventListener("click", () => copyText(exportKeyLogText(), "已复制关键事件日志"));
$("btn-log-export")?.addEventListener("click", downloadLog);
$("log-panel")?.addEventListener("toggle", refreshLogView);
els.board.addEventListener("click", (e) => {
  const t = e.target.closest(".tile");
  if(!t || t.classList.contains("empty")) return;
  onTileTap(Number(t.dataset.r), Number(t.dataset.c));
});
window.addEventListener("resize", () => { if(G.playing) layoutBoard(); });
document.addEventListener("visibilitychange", () => {
  if(document.hidden && G.playing && !G.paused) pauseGame();
});

/* ---------- PWA ---------- */
if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

/* ---------- 启动 ---------- */
syncMute();
syncMode();
syncTheme();
renderLevelSelect();
renderPsrLevelSelect();

/* 调试/自检探针 */
window.__llk = { G, findMove, findAnyPair, onTileTap, startLevel, startEndless, startSurvival, endlessNextRound,
  startPsrRound, psrBeatsText, useHint, useShuffle, pauseGame, psrState, LEVELS, STONE, FROZEN, RAINBOW, CLOCK,
  getLog: () => gameLog.slice(), exportLog: exportLogText, clearLog, boardUnits,
  renderBoard, renderAllTiles, updateHud,
  PSR_LEVELS, dominates };
