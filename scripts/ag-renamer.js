/**
 * ag-renamer.js — Antigravity 会话管理增强 v2.1.1
 * VERSION: 2.1.1
 * REPO: https://github.com/Neonbe/antigravity-convo-name-optimize
 *
 * 功能：
 * 1. 新会话首次出现时，自动截取前 20 个字符作为稳定名称（冻结）
 * 2. 双击会话行 → 弹出改名小框
 * 3. ⋮ 菜单注入「隐藏会话」「标记为待阅读」
 * 4. 🔖 待阅读标记，时间戳变化后自动清除
 * 5. 🙈 隐藏标记 + 底部角标
 *
 * SELECTOR: span[data-testid^="convo-pill-"]
 */

// ── 常量 ──────────────────────────────────────────────────────────────────────

const AUTO_KEY    = 'ag-auto-names';
const CUSTOM_KEY  = 'ag-custom-names';
const HIDDEN_KEY  = 'ag-hidden-ids';
const PENDING_KEY = 'ag-pending-ids';   // { convId: "3h" } 标记时的时间戳文字
const AUTO_MAX    = 20;
const PILL_SEL    = 'span[data-testid^="convo-pill-"]';
const MOREV_SEL   = 'button[aria-haspopup="listbox"]';

// 颜色
const C = {
  text:       '#cccccc',
  textMuted:  '#9d9d9d',
  textDimmed: '#6b6b6b',
  bg:         '#1e1e1e',
  bgHover:    '#2a2a2a',
  border:     '#333333',
  accent:     '#0078d4',
  accentText: '#ffffff',
};

// ── 存储 ──────────────────────────────────────────────────────────────────────

const store = {
  get:  k     => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } },
  set:  (k,id,v) => { const m = store.get(k); if (v) m[id] = v; else delete m[id]; localStorage.setItem(k, JSON.stringify(m)); },
  read: (k,id) => store.get(k)[id] || null,
};

const hiddenIds  = ()  => store.get(HIDDEN_KEY);
const isHidden   = id  => !!store.read(HIDDEN_KEY, id);
const setHidden  = (id, v) => store.set(HIDDEN_KEY, id, v || null);

const isPending  = id  => !!store.read(PENDING_KEY, id);
const setPending = (id, ts) => store.set(PENDING_KEY, id, ts || null);
const getPendingTs = id => store.read(PENDING_KEY, id);
const allPending = () => store.get(PENDING_KEY);

// ── DOM 工具 ──────────────────────────────────────────────────────────────────

const extractId = el => {
  const t = el?.dataset?.testid || '';
  return t.startsWith('convo-pill-') ? t.slice(11) : null;
};
const getDisplayName = id => store.read(CUSTOM_KEY, id) || store.read(AUTO_KEY, id) || null;
const findRowBtn  = el => el?.closest?.('button');
const findPillIn  = el => {
  if (!el) return null;
  if (el.matches?.(PILL_SEL)) return el;
  return el.querySelector?.(PILL_SEL) || el.closest?.('button')?.querySelector?.(PILL_SEL) || null;
};

/** 找到会话行的时间戳文字（如 "3h", "14h", "1d", "now"） */
function findTimestampText(btn) {
  if (!btn) return null;
  const allText = btn.querySelectorAll('span, div');
  for (const el of allText) {
    const t = el.textContent.trim();
    if (/^(now|\d+\s*(s|sec|secs|m|min|mins|h|d|w|mo|y)\s*(ago)?)$/i.test(t)) return t;
  }
  return null;
}

/** 把相对时间戳文字解析为秒数（越小 = 越新） */
function parseTimestamp(text) {
  if (!text) return -1;
  const t = text.trim().toLowerCase();
  if (t === 'now') return 0;
  const m = t.match(/^(\d+)\s*(s|sec|secs|m|min|mins|h|d|w|mo|y)/);
  if (!m) return -1;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  if (unit === 's' || unit === 'sec' || unit === 'secs') return n;
  if (unit === 'm' || unit === 'min' || unit === 'mins') return n * 60;
  if (unit === 'h') return n * 3600;
  if (unit === 'd') return n * 86400;
  if (unit === 'w') return n * 604800;
  if (unit === 'mo') return n * 2592000;
  if (unit === 'y') return n * 31536000;
  return -1;
}

function mk(tag, props = {}, styles = {}) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  Object.assign(el.style, styles);
  return el;
}

// ── 改名 + 隐藏 + 待阅读（合并为一个函数，防递归）─────────────────────────────

const HIDE_EMOJI = '🙈 ';
const PEND_EMOJI = '🔖 ';
let _processing = false;

function applyAll(span) {
  if (_processing) return;
  _processing = true;

  const id = extractId(span);
  if (!id) { _processing = false; return; }

  // 自动命名：首次截取（去掉可能残留的 emoji 前缀再存）
  if (!store.read(AUTO_KEY, id) && !store.read(CUSTOM_KEY, id)) {
    const raw = span.textContent.replace(/^[🙈🔖]\s*/, '').trim().slice(0, AUTO_MAX);
    if (raw) store.set(AUTO_KEY, id, raw);
  }

  const name    = getDisplayName(id);
  const btn     = findRowBtn(span);
  const hidden  = isHidden(id);
  const pending = isPending(id);

  // 可见性
  if (btn) {
    btn.style.display = (hidden && !showingHidden) ? 'none' : '';
    btn.style.opacity = (hidden && showingHidden) ? '0.4' : '';
  }

  // 文字：优先级 隐藏 > 待阅读 > 正常
  if (name) {
    let display = name;
    if (hidden && showingHidden) display = HIDE_EMOJI + name;
    else if (pending)            display = PEND_EMOJI + name;
    if (span.textContent !== display) span.textContent = display;
    if (btn && btn.title !== name) btn.title = name;
  }

  _processing = false;
}

// ── 改名弹框 ─────────────────────────────────────────────────────────────────
// 挂到 document.body，fixed 定位，不碰 React 容器

function showRenameDialog(anchor, defaultVal, onConfirm) {
  document.getElementById('ag-dialog')?.remove();

  const r = anchor.getBoundingClientRect();
  const W = Math.max(r.width, 200);
  const topSpace = r.top;
  const botSpace = window.innerHeight - r.bottom;
  const top  = botSpace > 130 ? r.bottom + 4 : r.top - 130;
  const left = Math.min(r.left, window.innerWidth - W - 8);

  const box = mk('div', { id: 'ag-dialog' }, {
    position: 'fixed', top: `${top}px`, left: `${left}px`, width: `${W}px`,
    zIndex: '99999', background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: '8px', padding: '12px', boxShadow: '0 6px 24px rgba(0,0,0,.6)',
    display: 'flex', flexDirection: 'column', gap: '8px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  });

  const label = mk('div', { textContent: '重命名' }, { color: C.textMuted, fontSize: '12px', fontWeight: '600' });
  const input = mk('input', { type: 'text', value: defaultVal }, {
    background: C.bgHover, border: `1px solid ${C.border}`, borderRadius: '5px',
    padding: '6px 8px', color: C.text, fontSize: '13px', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  });
  const hint = mk('div', { textContent: '留空确认 → 恢复自动名称' }, { color: C.textDimmed, fontSize: '10px' });
  const row  = mk('div', {}, { display: 'flex', gap: '6px', justifyContent: 'flex-end' });
  const btnC = mk('button', { textContent: '取消' }, {
    background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '5px',
    padding: '4px 12px', color: C.text, fontSize: '12px', cursor: 'pointer',
  });
  const btnO = mk('button', { textContent: '确认' }, {
    background: C.accent, border: 'none', borderRadius: '5px',
    padding: '4px 12px', color: C.accentText, fontSize: '12px', fontWeight: '600', cursor: 'pointer',
  });

  const close = () => box.remove();
  btnC.onclick = close;
  btnO.onclick = () => { close(); onConfirm(input.value); };
  input.onkeydown = e => {
    if (e.key === 'Enter')  { close(); onConfirm(input.value); }
    if (e.key === 'Escape') close();
    e.stopPropagation();
  };
  const outsideClick = e => {
    if (!box.contains(e.target)) { close(); document.removeEventListener('mousedown', outsideClick, true); }
  };
  setTimeout(() => document.addEventListener('mousedown', outsideClick, true), 0);

  row.append(btnC, btnO);
  box.append(label, input, hint, row);
  document.body.appendChild(box);   // ← body，不碰 React
  setTimeout(() => { input.focus(); input.select(); }, 20);
}

// ── 双击改名 ─────────────────────────────────────────────────────────────────

function setupDoubleClick() {
  document.addEventListener('dblclick', e => {
    const span = findPillIn(e.target);
    if (!span) return;
    const id = extractId(span);
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    const current = getDisplayName(id) || '';
    showRenameDialog(findRowBtn(span) || span, current, v => {
      store.set(CUSTOM_KEY, id, v.trim());
      applyAll(span);
    });
  }, true);
}

// ── 下拉菜单注入「隐藏」+「待阅读」── ── ── ── ── ── ── ── ── ── ── ── ── ──
// React 的 portal listbox 是临时 DOM，React 销毁后重建，
// 我们每次展开都重新注入，不留持久化节点，安全。

function injectMenuOptions(moreBtn) {
  const span = findPillViaAncestry(moreBtn);
  if (!span) return;
  const id = extractId(span);
  if (!id) return;

  requestAnimationFrame(() => {
    setTimeout(() => {
      const listbox = findLatestListbox();
      if (!listbox || listbox.dataset.agDone) return;
      listbox.dataset.agDone = '1';

      const hidden  = isHidden(id);
      const pending = isPending(id);
      const btn     = findRowBtn(span);

      // 分隔线
      listbox.appendChild(mk('div', {}, {
        height: '1px', background: C.border, margin: '4px 0',
      }));

      // ── 待阅读选项 ──
      const pendOpt = mkMenuOption(
        pending ? '取消待阅读' : '🔖 标记为待阅读',
        () => {
          if (pending) {
            setPending(id, null);
          } else {
            const ts = findTimestampText(btn) || 'now';
            setPending(id, parseTimestamp(ts));  // 存秒数，不存文字
          }
          moreBtn.click();
          setTimeout(() => document.querySelectorAll(PILL_SEL).forEach(applyAll), 50);
        }
      );
      listbox.appendChild(pendOpt);

      // ── 隐藏选项 ──
      const hideOpt = mkMenuOption(
        hidden ? '取消隐藏' : '🙈 隐藏会话',
        () => {
          if (hidden) setHidden(id, null);
          else        setHidden(id, true);
          moreBtn.click();
          setTimeout(() => {
            document.querySelectorAll(PILL_SEL).forEach(applyAll);
            refreshBadge();
          }, 50);
        }
      );
      listbox.appendChild(hideOpt);
    }, 30);
  });
}

/** 创建一个菜单选项 DOM */
function mkMenuOption(text, onClick) {
  const opt = mk('div', { textContent: text, role: 'option' }, {
    padding: '6px 16px', fontSize: '13px', color: C.textMuted,
    cursor: 'pointer', userSelect: 'none',
  });
  opt.addEventListener('mouseover', () => { opt.style.background = C.bgHover; opt.style.color = C.text; });
  opt.addEventListener('mouseout',  () => { opt.style.background = ''; opt.style.color = C.textMuted; });
  opt.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return opt;
}

function findPillViaAncestry(el) {
  let cur = el;
  for (let i = 0; i < 8 && cur; i++) {
    cur = cur.parentElement;
    const pill = cur?.querySelector?.(PILL_SEL);
    if (pill) return pill;
  }
  return null;
}

function findLatestListbox() {
  const all = [
    ...document.querySelectorAll('[role="listbox"]'),
    ...document.querySelectorAll('[role="menu"]'),
  ];
  return all.length ? all[all.length - 1] : null;
}

// ── 「已隐藏 (N)」悬浮角标 ────────────────────────────────────────────────────
// 挂到 document.body，fixed 定位在侧边栏底部，绝不进入 React 容器。

let showingHidden = false;

/** 找到侧边栏底栏最后一项的位置 */
function findBottomBarRect() {
  const allSpans = document.querySelectorAll('span');
  // 优先找最后一项 Provide Feedback，备选 Settings
  for (const label of ['Provide Feedback', 'Settings']) {
    for (const s of allSpans) {
      if (s.textContent.trim() === label) {
        const row = s.closest('a, button, div[class]');
        if (row) return row.getBoundingClientRect();
      }
    }
  }
  // 备选：找侧边栏最后一个 pill 的容器来推算底部
  const firstPill = document.querySelector(PILL_SEL);
  if (firstPill) {
    const container = firstPill.closest('button')?.parentElement;
    if (container) {
      const r = container.getBoundingClientRect();
      return { top: r.bottom - 32, right: r.right, left: r.left, bottom: r.bottom, width: r.width };
    }
  }
  return null;
}

function refreshBadge() {
  const count = Object.keys(hiddenIds()).length;
  let badge = document.getElementById('ag-hidden-badge');

  if (count === 0) { badge?.remove(); showingHidden = false; return; }

  if (!badge) {
    badge = mk('div', { id: 'ag-hidden-badge' }, {
      position: 'fixed',
      zIndex: '99998',
      padding: '4px 10px',
      background: 'transparent',
      border: 'none',
      borderRadius: '4px',
      color: C.textDimmed,
      fontSize: '11px',
      cursor: 'pointer',
      userSelect: 'none',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textAlign: 'right',
      whiteSpace: 'nowrap',
    });

    badge.addEventListener('mouseover', () => { badge.style.color = C.textMuted; badge.style.background = C.bgHover; });
    badge.addEventListener('mouseout',  () => { badge.style.color = C.textDimmed; badge.style.background = 'transparent'; });

    badge.addEventListener('click', () => {
      showingHidden = !showingHidden;
      document.querySelectorAll(PILL_SEL).forEach(applyAll);
      refreshBadge();
    });

    document.body.appendChild(badge);
  }

  // 动态吸附：底栏右侧
  const barRect = findBottomBarRect();
  if (barRect) {
    badge.style.top  = `${barRect.top + 2}px`;
    badge.style.left = 'auto';
    badge.style.right = `${window.innerWidth - barRect.right + 8}px`;
    badge.style.bottom = 'auto';
  } else {
    // 兜底：右下角
    badge.style.bottom = '8px';
    badge.style.right  = '8px';
    badge.style.top    = 'auto';
    badge.style.left   = 'auto';
  }
  badge.style.width = 'auto';

  badge.textContent = showingHidden
    ? `▲ 收起隐藏 (${count})`
    : `已隐藏 (${count})`;
}

// ── 待阅读：时间戳变化检测 ────────────────────────────────────────────────────

/** 扫描所有待阅读会话，如果时间戳变小了（有新活动），自动清除 */
function checkPendingTimestamps() {
  const pending = allPending();
  const ids = Object.keys(pending);
  if (!ids.length) return;

  document.querySelectorAll(PILL_SEL).forEach(span => {
    const id = extractId(span);
    if (!id || !pending[id]) return;
    const btn = findRowBtn(span);
    const currentText = findTimestampText(btn);
    const currentSec  = parseTimestamp(currentText);
    const storedSec   = pending[id];  // 已是秒数

    if (currentSec < 0 || storedSec < 0) return; // 解析失败，跳过

    // 只有时间戳变小了（新活动把时间重置了）才清除
    // 用 0.5 倍阈值避免边界抖动（如 "3h" → "2h59m" 的精度差异）
    if (currentSec < storedSec * 0.5) {
      setPending(id, null);
      applyAll(span);
      console.log(`[ag-renamer] 🔖 自动清除待阅读: ${id} (存储${storedSec}s → 当前${currentSec}s “${currentText}”)`);
    }
  });
}

// ── MutationObserver ──────────────────────────────────────────────────────────

function startObserver() {
  new MutationObserver(mutations => {
    const pills = new Set();
    for (const m of mutations) {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.(PILL_SEL)) pills.add(node);
        node.querySelectorAll?.(PILL_SEL).forEach(el => pills.add(el));
      });
      if (m.type === 'characterData') {
        const p = m.target.parentElement;
        if (p?.matches?.(PILL_SEL)) pills.add(p);
      }
      // more_vert 展开
      if (m.type === 'attributes'
          && m.attributeName === 'aria-expanded'
          && m.target.getAttribute('aria-expanded') === 'true'
          && m.target.matches?.(MOREV_SEL)) {
        injectMenuOptions(m.target);
      }
    }
    pills.forEach(applyAll);
    if (pills.size) {
      refreshBadge();
      checkPendingTimestamps();
    }
  }).observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['aria-expanded'],
  });
}

// ── 初始化 ────────────────────────────────────────────────────────────────────

function init() {
  document.querySelectorAll(PILL_SEL).forEach(applyAll);
  startObserver();
  setupDoubleClick();
  refreshBadge();
  checkPendingTimestamps();
  // 定时检查待阅读（时间戳可能被 React 定时刷新覆盖）
  setInterval(checkPendingTimestamps, 5000);
  console.log('[ag-renamer] ✅ v2.1.1 运行中 — 双击改名 | ⋮ 隐藏/待阅读');
}

setTimeout(init, 800);
