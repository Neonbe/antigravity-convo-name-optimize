/**
 * ag-renamer.js — Antigravity 会话自定义命名
 * VERSION: 1.0.0
 * REPO: https://github.com/Neonbe/ag-renamer
 *
 * 功能：
 * 1. 新会话首次出现时，自动截取前 20 个字符作为稳定名称（冻结，防止 AI 反复修改）
 * 2. 右键点击会话行 → 小弹框输入自定义名称（优先级高于自动名称）
 * 3. 数据持久化到 localStorage，重启保留
 *
 * SELECTOR: span[data-testid^="convo-pill-"]
 */

const AUTO_KEY    = 'ag-auto-names';    // 自动捕获的首见名称
const CUSTOM_KEY  = 'ag-custom-names';  // 用户手动右键设置的名称
const AUTO_MAX    = 20;                 // 自动截取字符数
const PILL_SEL    = 'span[data-testid^="convo-pill-"]';

// ── 存储 ──────────────────────────────────────────────────────────────────────

const store = {
  get: (key)         => { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } },
  set: (key, id, v)  => { const m = store.get(key); if (v) m[id] = v; else delete m[id]; localStorage.setItem(key, JSON.stringify(m)); },
  read: (key, id)    => store.get(key)[id] || null,
};

// ── DOM 工具 ──────────────────────────────────────────────────────────────────

const extractId = el => {
  const t = el?.dataset?.testid || '';
  return t.startsWith('convo-pill-') ? t.slice(11) : null;
};

// 优先级：custom > auto > null（不干预，React 原样显示）
const getDisplayName = id => store.read(CUSTOM_KEY, id) || store.read(AUTO_KEY, id) || null;

function applyRename(spanEl) {
  const id = extractId(spanEl);
  if (!id) return;

  // 自动命名：首次见到这个 ID，截取当前文字存起来
  if (!store.read(AUTO_KEY, id) && !store.read(CUSTOM_KEY, id)) {
    const text = spanEl.textContent.trim().slice(0, AUTO_MAX);
    if (text) store.set(AUTO_KEY, id, text);
  }

  const name = getDisplayName(id);
  if (!name) return;

  if (spanEl.textContent !== name) spanEl.textContent = name;

  // Hover tooltip 加在外层 button（整行都触发）
  const btn = spanEl.closest('button');
  if (btn && btn.title !== name) {
    btn.title = name;
    btn.dataset.agTooltip = '1';
  }
}

// ── 弹框（锚定在行下方，不遮挡其他区域）────────────────────────────────────

function showRenameDialog(anchorEl, defaultVal, onConfirm) {
  document.getElementById('ag-dialog')?.remove();

  const anchorRect = anchorEl.getBoundingClientRect();
  const DIALOG_W   = Math.max(anchorRect.width, 200);

  // 计算定位：默认贴在行的下方，若超出视口底部则贴在行上方
  const spaceBelow  = window.innerHeight - anchorRect.bottom - 8;
  const DIALOG_H_EST = 120;
  const posTop  = spaceBelow > DIALOG_H_EST
    ? anchorRect.bottom + 4
    : anchorRect.top - DIALOG_H_EST - 4;
  const posLeft = Math.min(anchorRect.left, window.innerWidth - DIALOG_W - 8);

  const box = document.createElement('div');
  box.id = 'ag-dialog';
  Object.assign(box.style, {
    position: 'fixed',
    top:      `${posTop}px`,
    left:     `${posLeft}px`,
    width:    `${DIALOG_W}px`,
    zIndex:   '99999',
    background: '#1e1e2e',
    border:   '1px solid #3a3a5c',
    borderRadius: '8px',
    padding:  '12px',
    boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
    display:  'flex',
    flexDirection: 'column',
    gap:      '8px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  });

  const label = Object.assign(document.createElement('div'), { textContent: '重命名' });
  Object.assign(label.style, { color: '#cdd6f4', fontSize: '12px', fontWeight: '600', opacity: '0.7' });

  const input = Object.assign(document.createElement('input'), { type: 'text', value: defaultVal });
  Object.assign(input.style, {
    background: '#313244', border: '1px solid #585b70', borderRadius: '5px',
    padding: '6px 8px', color: '#cdd6f4', fontSize: '13px', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  });

  const hint = Object.assign(document.createElement('div'), { textContent: '留空确认 → 恢复自动名称' });
  Object.assign(hint.style, { color: '#6c7086', fontSize: '10px' });

  const row = Object.assign(document.createElement('div'), {});
  Object.assign(row.style, { display: 'flex', gap: '6px', justifyContent: 'flex-end' });

  const btnCancel = Object.assign(document.createElement('button'), { textContent: '取消' });
  Object.assign(btnCancel.style, {
    background: 'transparent', border: '1px solid #585b70', borderRadius: '5px',
    padding: '4px 12px', color: '#cdd6f4', fontSize: '12px', cursor: 'pointer',
  });

  const btnOk = Object.assign(document.createElement('button'), { textContent: '确认' });
  Object.assign(btnOk.style, {
    background: '#89b4fa', border: 'none', borderRadius: '5px',
    padding: '4px 12px', color: '#1e1e2e', fontSize: '12px',
    fontWeight: '600', cursor: 'pointer',
  });

  const close = () => box.remove();

  btnCancel.onclick = close;
  btnOk.onclick     = () => { close(); onConfirm(input.value); };

  input.onkeydown = e => {
    if (e.key === 'Enter')  { close(); onConfirm(input.value); }
    if (e.key === 'Escape') close();
    e.stopPropagation();
  };

  // 点弹框外面关闭
  const outsideClick = e => { if (!box.contains(e.target)) { close(); document.removeEventListener('mousedown', outsideClick, true); } };
  setTimeout(() => document.addEventListener('mousedown', outsideClick, true), 0);

  row.append(btnCancel, btnOk);
  box.append(label, input, hint, row);
  document.body.appendChild(box);
  setTimeout(() => { input.focus(); input.select(); }, 20);
}

// ── 右键菜单 ──────────────────────────────────────────────────────────────────

function setupContextMenu() {
  document.addEventListener('contextmenu', e => {
    const btn = e.target.closest?.('button');
    if (!btn) return;
    const pillSpan = btn.querySelector(PILL_SEL);
    if (!pillSpan) return;
    const id = extractId(pillSpan);
    if (!id) return;

    e.preventDefault();
    e.stopPropagation();

    const current = store.read(CUSTOM_KEY, id) || store.read(AUTO_KEY, id) || '';
    showRenameDialog(btn, current, newName => {
      store.set(CUSTOM_KEY, id, newName.trim());
      applyRename(pillSpan);
    });
  }, true);
}

// ── MutationObserver ──────────────────────────────────────────────────────────

function startObserver() {
  new MutationObserver(mutations => {
    const toProcess = new Set();
    for (const m of mutations) {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.(PILL_SEL)) toProcess.add(node);
        node.querySelectorAll?.(PILL_SEL).forEach(el => toProcess.add(el));
      });
      if (m.type === 'characterData') {
        const p = m.target.parentElement;
        if (p?.matches?.(PILL_SEL)) toProcess.add(p);
      }
    }
    toProcess.forEach(applyRename);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

// ── 初始化 ────────────────────────────────────────────────────────────────────

function init() {
  document.querySelectorAll(PILL_SEL).forEach(applyRename);
  startObserver();
  setupContextMenu();
  console.log('[ag-renamer] ✅ v1.0.0 运行中');
}

setTimeout(init, 800);
