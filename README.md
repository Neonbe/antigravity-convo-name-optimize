# ag-renamer

> Stop Antigravity from renaming your conversations. Right-click any conversation to set a permanent custom name.

A patch for [Antigravity](https://antigravity.ai) Agent Manager that fixes two pain points:

1. **Names keep changing** — AI renames your conversations as they evolve. This patch freezes the name the moment a conversation first appears (first 20 characters), so it never changes again.
2. **Names get cut off** — Hover over any conversation row to see the full name in a tooltip.

---

## Features

- 🔒 **Auto-freeze** — First time a conversation appears, its name is captured and locked
- ✏️ **Right-click to rename** — Click any conversation row → type a custom name → Enter
- 💾 **Persistent** — Names survive Antigravity restarts (stored in `localStorage`)
- 🔄 **Update-safe** — Antigravity updates overwrite the patch, but your names are safe. Re-run the install to restore.

## Install

### Option A — Via Antigravity SKILL (recommended)

Copy the `ag-renamer/` folder to your skills directory:

```bash
cp -r ag-renamer/ ~/.gemini/antigravity/skills/
```

Then in Antigravity, say: **"帮我安装 ag-renamer"** or **"install ag-renamer"**

The AI will handle everything automatically.

### Option B — Manual

```bash
# 1. Copy the script
cp scripts/ag-renamer.js \
  "/Applications/Antigravity.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/"

# 2. Inject into HTML
python3 - << 'EOF'
import sys
html = "/Applications/Antigravity.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench-jetski-agent.html"
ANCHOR = '<script src="./jetskiAgent.js" type="module"></script>'
INJECT = ANCHOR + '\n<!-- ag-renamer -->\n<script src="./ag-renamer.js" type="module"></script>'
with open(html) as f: c = f.read()
if 'ag-renamer' not in c:
    with open(html, 'w') as f: f.write(c.replace(ANCHOR, INJECT, 1))
    print('✅ Done')
else:
    print('Already installed')
EOF

# 3. Clear macOS signature check
xattr -cr /Applications/Antigravity.app

# 4. Restart Antigravity Agent Manager
```

## Uninstall

In Antigravity, say: **"卸载 ag-renamer"**

Or manually: delete `ag-renamer.js` from the workbench folder and remove its `<script>` tag from `workbench-jetski-agent.html`.

## After Antigravity Updates

Antigravity updates will overwrite the patch files. Your custom names are **not lost** (they live in `localStorage`). Just re-run the install and everything comes back.

## How it works

The patch injects a small JavaScript file that:
1. Uses a `MutationObserver` to watch for conversation items appearing in the sidebar
2. On first sight, captures the current name (max 20 chars) into `localStorage`
3. On every render, replaces the displayed text with the stored name
4. Listens for `contextmenu` events on conversation rows to show the rename dialog

Data is split into two `localStorage` keys:
- `ag-auto-names` — auto-captured first-seen names
- `ag-custom-names` — user-defined names (higher priority)

## DOM Compatibility

Current DOM selector: `span[data-testid^="convo-pill-"]`

If Antigravity updates break this, check the new selector and open an issue.

---

Made for people who like to know what a conversation is about at a glance.
