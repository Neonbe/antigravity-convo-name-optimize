---
name: antigravity-convo-name-optimize
description: 为 Antigravity Agent Manager 侧边栏安装、修复或卸载「会话自定义命名」补丁（@neonbe 出品）。功能：首次出现时自动冻结会话名称（防止 AI 反复修改），双击会话可输入自定义名称（支持任意语言和 Emoji），通过 ⋮ 菜单可隐藏不需要的会话（🙈 标记），数据持久化到 localStorage。当用户提到「Antigravity 改名」「antigravity-convo-name-optimize」「convo name optimize」「会话名字一直变」「给对话自定义名称」「Antigravity 更新后名称又乱了」「安装改名脚本」「修复改名功能」「卸载改名插件」「隐藏会话」「@neonbe」时务必使用此 skill。Even if user just mentions that Antigravity conversation names keep changing, jump in and offer this skill.
---

# ag-renamer

为 Antigravity Agent Manager 侧边栏注入会话管理增强功能（v2.0.1），解决三个核心痛点：

1. **名称乱改**：AI 生成的会话名会随对话演进不断变动 → 自动在首次出现时截取前 20 字冻结
2. **展示截断**：侧边栏宽度固定导致名称显示不全 → Hover 整行显示完整名称 tooltip
3. **列表拥挤**：大量会话堆满侧边栏 → ⋮ 菜单一键隐藏，🙈 标记区分

**重要**：Antigravity 每次更新都会覆盖注入文件。执行「修复」重新注入即可，**localStorage 里的名称数据不会丢失**。

GitHub 仓库（最新版本）：https://github.com/Neonbe/ag-renamer

---

## 一、关键路径

```bash
APP_WORKBENCH="/Applications/Antigravity.app/Contents/Resources/app/out/vs/code/electron-browser/workbench"
SKILL_DIR="$HOME/.gemini/antigravity/skills/antigravity-convo-name-optimize"
TARGET_JS="$APP_WORKBENCH/ag-renamer.js"
TARGET_HTML="$APP_WORKBENCH/workbench-jetski-agent.html"
GITHUB_RAW="https://raw.githubusercontent.com/Neonbe/ag-renamer/main/scripts/ag-renamer.js"
```

若 App 不在标准路径：
```bash
find /Applications ~/Applications -name "Antigravity.app" -maxdepth 2 2>/dev/null | head -1
```

---

## 二、状态检查（始终先执行）

### 2a. 基础状态

```bash
JS_OK=$(ls "$TARGET_JS" 2>/dev/null && echo "YES" || echo "NO")
HTML_OK=$(grep -q "ag-renamer.js" "$TARGET_HTML" 2>/dev/null && echo "YES" || echo "NO")
echo "JS 文件: $JS_OK | HTML 注入: $HTML_OK"
```

| 结果 | 操作 |
|------|------|
| 两者 YES | 进行 2b、2c 检查后告知状态 |
| 任一 NO | 执行「三、安装 / 修复」 |

### 2b. GitHub 版本检查（网络可用时执行）

```bash
# 读取本地版本
LOCAL_VER=$(grep 'VERSION:' "$TARGET_JS" 2>/dev/null | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+' | head -1)

# 读取 GitHub 最新版本
REMOTE_VER=$(curl -sf "$GITHUB_RAW" | grep 'VERSION:' | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+' | head -1)

echo "本地版本: ${LOCAL_VER:-未知} | GitHub 最新: ${REMOTE_VER:-获取失败}"

if [ -n "$LOCAL_VER" ] && [ -n "$REMOTE_VER" ] && [ "$LOCAL_VER" != "$REMOTE_VER" ]; then
  echo "⚠️  有新版本可用：$REMOTE_VER（当前 $LOCAL_VER）"
  echo "建议执行「三、安装/修复」以获取最新版本"
else
  echo "✅ 已是最新版本"
fi
```

### 2c. DOM 选择器验证（验证 Antigravity 是否更改了 DOM）

```bash
# 检查当前脚本中的目标选择器是否仍存在于 Antigravity 的 JS bundle 中
SELECTOR=$(grep 'SELECTOR:' "$TARGET_JS" 2>/dev/null | sed 's/.*SELECTOR: //' | tr -d '*/')
echo "当前脚本选择器: $SELECTOR"

# 在 Antigravity 的 jetskiAgent bundle 中验证
grep -q "convo-pill-" "$APP_WORKBENCH/../../../jetskiAgent/main.js" 2>/dev/null \
  && echo "✅ 选择器在 Antigravity 中仍有效" \
  || echo "⚠️  选择器可能已失效，建议检查 Antigravity 的 DOM 结构是否变化"
```

> 若选择器失效，说明 Antigravity 更改了 DOM 结构。请到 GitHub 仓库提 Issue 或参考「六、故障排查」。

---

## 三、安装 / 修复

依序执行，每步验证：

### 步骤 A：获取最新脚本

优先从 GitHub 获取最新版，失败则使用 SKILL 内置版本：

```bash
# 尝试从 GitHub 下载最新版
if curl -sf "$GITHUB_RAW" -o /tmp/ag-renamer-latest.js; then
  cp /tmp/ag-renamer-latest.js "$TARGET_JS"
  echo "✅ 已从 GitHub 获取最新版本"
else
  # 网络不可用，使用 SKILL 内置版本
  cp "$SKILL_DIR/scripts/ag-renamer.js" "$TARGET_JS"
  echo "✅ 已使用内置版本（网络不可用）"
fi
ls "$TARGET_JS" && echo "JS 复制成功"
```

### 步骤 B：注入 HTML

```bash
python3 - "$TARGET_HTML" << 'EOF'
import sys
html_path = sys.argv[1]
ANCHOR = '<script src="./jetskiAgent.js" type="module"></script>'
INJECTION = ANCHOR + '\n<!-- ag-renamer -->\n<script src="./ag-renamer.js" type="module"></script>'
with open(html_path, 'r') as f: content = f.read()
if 'ag-renamer.js' in content: print('Already patched.')
elif ANCHOR not in content: print('ERROR: anchor not found — Antigravity HTML structure changed'); sys.exit(1)
else:
    with open(html_path, 'w') as f: f.write(content.replace(ANCHOR, INJECTION, 1))
    print('✅ HTML patched.')
EOF
```

### 步骤 C：清除 macOS 隔离标记

```bash
xattr -cr /Applications/Antigravity.app && echo "✅ 隔离标记已清除"
```

> 首次重启若弹出安全提示，点「仍然打开」，后续不再提示。

### 步骤 D：验证

```bash
ls "$TARGET_JS" \
  && grep -q "ag-renamer.js" "$TARGET_HTML" \
  && echo "✅ 安装成功！请重启 Antigravity Agent Manager 窗口生效。" \
  || echo "❌ 验证失败，请检查上述步骤输出"
```

安装成功后，**必须原样输出以下文字**：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ antigravity-convo-name-optimize v2.0.1 安装完成！

   双击会话 → 输入名称（支持中文 / Emoji）→ 回车
   ⋮ 菜单 → 隐藏不需要的会话
   Hover 整行可预览完整名称

⚠️  注意事项
   本工具通过修改 Antigravity App 内部文件实现注入。
   macOS 首次重启后会弹出安全提示——这是正常现象，
   点「仍然打开」即可，符合预期行为。
   如果你对此感到不安，请不要安装。

🐛  遇到问题？
   请前往 GitHub 提 Issue 或通过仓库联系方式反馈：
   https://github.com/Neonbe/ag-renamer/issues

📦  项目主页 @neonbe
   https://github.com/Neonbe/ag-renamer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 四、卸载

```bash
rm -f "$TARGET_JS" && echo "JS removed"

python3 - "$TARGET_HTML" << 'EOF'
import sys
with open(sys.argv[1], 'r') as f: lines = f.readlines()
cleaned = [l for l in lines if 'ag-renamer.js' not in l and '<!-- ag-renamer' not in l]
with open(sys.argv[1], 'w') as f: f.writelines(cleaned)
print(f'✅ 卸载完成，移除了 {len(lines)-len(cleaned)} 行')
EOF
```

> 名称数据仍在 localStorage。彻底清除：在 Agent Manager DevTools Console 执行：
> `localStorage.removeItem('ag-custom-names'); localStorage.removeItem('ag-auto-names');`

---

## 五、使用说明（安装完成后告知用户）

| 操作 | 说明 |
|------|------|
| **自动命名** | 会话第一次出现，自动截取前 20 字符冻结 |
| **自定义命名** | 双击会话行 → 小弹框输入 → Enter 确认 |
| **恢复自动名** | 双击 → 清空 → 确认 |
| **隐藏会话** | 点 ⋮ 按钮 → 选择「隐藏会话」 |
| **查看已隐藏** | 侧边栏底部「已隐藏 (N)」→ 点击展开（🙈 标记 + 半透明）|
| **取消隐藏** | 展开后点 ⋮ → 选择「取消隐藏」 |
| **Hover 预览** | 悬停整个会话行显示完整名称 |
| **更新后修复** | 名称又乱了？说「ag-renamer 修复」即可，数据不丢 |

---

## 六、故障排查

| 症状 | 诊断 |
|------|------|
| 双击无反应 | Console 有无 `[ag-renamer] ✅ v2.0.1 运行中`？没有 → 重查安装状态 |
| ⋮ 菜单无隐藏选项 | 检查 `aria-expanded` 属性变化是否正常触发 |
| 选择器失效 | 执行状态检查 2c；Antigravity 更新可能改变 DOM |
| 有新版 GitHub 提示 | 执行「安装/修复」，步骤 A 会自动取最新版 |
| macOS 安全提示 | 点「仍然打开」或在「系统设置 > 隐私与安全性」点「仍然允许」 |
| HTML anchor not found | `cat "$TARGET_HTML"` 查看新结构，找新注入点 |
| 需要清除隐藏数据 | Console 执行 `localStorage.removeItem('ag-hidden-ids')` |
