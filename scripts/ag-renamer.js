/**
 * ag-renamer.js — Antigravity 会话自定义命名 v2.0.1
 * VERSION: 2.0.1
 * REPO: https://github.com/Neonbe/ag-renamer
 *
 * 功能：
 * 1. 新会话首次出现时，自动截取前 20 个字符作为稳定名称（冻结）
 * 2. 双击会话行 → 弹出改名小框
 * 3. more_vert 下拉菜单注入「隐藏」选项
 * 4. 底部悬浮「已隐藏 (N)」角标，点击可展开/折叠
 *
 * ⚠️ v2.0.0 崩溃修复：
 *    所有注入节点挂到 document.body (fixed 定位)，
 *    绝不 appendChild 进 React 管理的容器，避免 reconciliation crash。
 *
 * SELECTOR: span[data-testid^="convo-pill-"]
 */

// ── 常量 ──────────────────────────────────────────────────────────────────────

const AUTO_KEY   = 'ag-auto-names';
const CUSTOM_KEY = 'ag-custom-names';
const HIDDEN_KEY = 'ag-hidden-ids';
const AUTO_MAX   = 20;
const PILL_SEL   = 'span[data-testid^="convo-pill-"]';
const MOREV_SEL  = 'button[aria-haspopup="listbox"]';

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

function mk(tag, props = {}, styles = {}) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  Object.assign(el.style, styles);
  return el;
}

// ── 改名 + 隐藏 + 标记（合并为一个函数，防递归）──────────────────────────────

const HIDE_EMOJI = '🙈 ';
let _processing = false;

function applyAll(span) {
  if (_processing) return;
  _processing = true;

  const id = extractId(span);
  if (!id) { _processing = false; return; }

  // 自动命名：首次截取（去掉可能残留的 emoji 前缀再存）
  if (!store.read(AUTO_KEY, id) && !store.read(CUSTOM_KEY, id)) {
    const raw = span.textContent.replace(/^🙈\s*/, '').trim().slice(0, AUTO_MAX);
    if (raw) store.set(AUTO_KEY, id, raw);
  }

  const name = getDisplayName(id);
  const btn  = findRowBtn(span);
  const hidden = isHidden(id);

  // 可见性
  if (btn) {
    btn.style.display = (hidden && !showingHidden) ? 'none' : '';
    btn.style.opacity = (hidden && showingHidden) ? '0.4' : '';
  }

  // 文字
  if (name) {
    const display = (hidden && showingHidden) ? HIDE_EMOJI + name : name;
    if (span.textContent !== display) span.textContent = display;
    if (btn && btn.title !== name) btn.title = name; // tooltip 始终干净名称
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

// ── 下拉菜单注入「隐藏」── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// React 的 portal listbox 是临时 DOM，React 销毁后重建，
// 我们每次展开都重新注入，不留持久化节点，安全。

function injectHideOption(moreBtn) {
  // 往上走找到同一行的 convo-pill
  const span = findPillViaAncestry(moreBtn);
  if (!span) return;
  const id = extractId(span);
  if (!id) return;

  requestAnimationFrame(() => {
    setTimeout(() => {
      const listbox = findLatestListbox();
      if (!listbox || listbox.dataset.agDone) return;
      listbox.dataset.agDone = '1';

      const hidden = isHidden(id);

      // 分隔线
      const sep = mk('div', {}, {
        height: '1px', background: C.border, margin: '4px 0',
      });

      // 隐藏/取消隐藏 选项
      const opt = mk('div', {
        textContent: hidden ? '取消隐藏' : '隐藏会话',
        role: 'option',
      }, {
        padding: '6px 16px', fontSize: '13px', color: C.textMuted,
        cursor: 'pointer', userSelect: 'none',
      });
      opt.addEventListener('mouseover', () => { opt.style.background = C.bgHover; opt.style.color = C.text; });
      opt.addEventListener('mouseout',  () => { opt.style.background = ''; opt.style.color = C.textMuted; });
      opt.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
        if (hidden) { setHidden(id, null); }
        else        { setHidden(id, true); }
        // 关闭下拉
        moreBtn.click();
        // 刷新可见性
        setTimeout(() => {
          document.querySelectorAll(PILL_SEL).forEach(applyAll);
          refreshBadge();
        }, 50);
      });

      listbox.appendChild(sep);
      listbox.appendChild(opt);
    }, 30);
  });
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
        injectHideOption(m.target);
      }
    }
    pills.forEach(applyAll);
    if (pills.size) refreshBadge();
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
  console.log('[ag-renamer] ✅ v2.0.1 运行中 — 双击改名 | ⋮ 可隐藏');
}

setTimeout(init, 800);
