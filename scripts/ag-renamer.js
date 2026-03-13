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
  text:       '#cdd6f4',
  textMuted:  '#a6adc8',
  textDimmed: '#6c7086',
  bg:         '#1e1e2e',
  bgHover:    '#313244',
  border:     '#3a3a5c',
  accent:     '#89b4fa',
  accentText: '#1e1e2e',
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

// ── 改名 & 隐藏应用 ──────────────────────────────────────────────────────────

function applyRename(span) {
  const id = extractId(span);
  if (!id) return;

  // 自动命名
  if (!store.read(AUTO_KEY, id) && !store.read(CUSTOM_KEY, id)) {
    const text = span.textContent.trim().slice(0, AUTO_MAX);
    if (text) store.set(AUTO_KEY, id, text);
  }

  const name = getDisplayName(id);
  if (name && span.textContent !== name) span.textContent = name;

  const btn = findRowBtn(span);
  if (btn && name && btn.title !== name) { btn.title = name; }
}

/**
 * 安全隐藏：只修改 style.display，不动 DOM 结构
 * React 不在乎 inline style 变更，只在乎 DOM 子节点增删。
 */
function applyVisibility(span) {
  const id = extractId(span);
  if (!id) return;
  const btn = findRowBtn(span);
  if (!btn) return;
  const shouldHide = isHidden(id) && !showingHidden;
  btn.style.display = shouldHide ? 'none' : '';
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
      applyRename(span);
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
          document.querySelectorAll(PILL_SEL).forEach(applyVisibility);
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

function refreshBadge() {
  const count = Object.keys(hiddenIds()).length;
  let badge = document.getElementById('ag-hidden-badge');

  if (count === 0) { badge?.remove(); showingHidden = false; return; }

  if (!badge) {
    badge = mk('div', { id: 'ag-hidden-badge' }, {
      position: 'fixed',
      bottom: '8px',
      left: '8px',
      zIndex: '99998',
      padding: '5px 12px',
      background: C.bg,
      border: `1px solid ${C.border}`,
      borderRadius: '6px',
      color: C.textDimmed,
      fontSize: '11px',
      cursor: 'pointer',
      userSelect: 'none',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      boxShadow: '0 2px 8px rgba(0,0,0,.4)',
    });

    badge.addEventListener('mouseover', () => { badge.style.color = C.textMuted; });
    badge.addEventListener('mouseout',  () => { badge.style.color = C.textDimmed; });

    badge.addEventListener('click', () => {
      showingHidden = !showingHidden;
      document.querySelectorAll(PILL_SEL).forEach(applyVisibility);
      refreshBadge();
    });

    document.body.appendChild(badge);   // ← body，安全
  }

  // 动态计算左边位置：跟侧边栏对齐
  const firstPill = document.querySelector(PILL_SEL);
  if (firstPill) {
    const pillRect = firstPill.getBoundingClientRect();
    badge.style.left = `${Math.max(8, pillRect.left)}px`;
    badge.style.width = `${Math.max(pillRect.width, 100)}px`;
  }

  badge.textContent = showingHidden
    ? `▲ 收起隐藏 (${count})`
    : `▼ 已隐藏 (${count})`;
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
    pills.forEach(s => { applyRename(s); applyVisibility(s); });
    if (pills.size) refreshBadge();
  }).observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['aria-expanded'],
  });
}

// ── 初始化 ────────────────────────────────────────────────────────────────────

function init() {
  document.querySelectorAll(PILL_SEL).forEach(s => { applyRename(s); applyVisibility(s); });
  startObserver();
  setupDoubleClick();
  refreshBadge();
  console.log('[ag-renamer] ✅ v2.0.1 运行中 — 双击改名 | ⋮ 可隐藏');
}

setTimeout(init, 800);
