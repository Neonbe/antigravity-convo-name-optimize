---
name: ag-renamer
description: 为 Antigravity Agent Manager 侧边栏安装、修复或卸载「会话自定义命名」补丁。功能：首次出现时自动冻结会话名称（防止 AI 反复修改），右键点击会话可输入自定义名称，数据持久化到 localStorage。当用户提到「Antigravity 改名」「ag-renamer」「会话名字一直变」「给对话自定义名称」「Antigravity 更新后名称又乱了」「安装改名脚本」「修复改名功能」「卸载 ag-renamer」时务必使用此 skill。Even if user just mentions that Antigravity conversation names keep changing, jump in and offer this skill.
---

# ag-renamer

为 Antigravity Agent Manager 侧边栏注入会话自定义命名功能，解决两个核心痛点：

1. **名称乱改**：AI 生成的会话名会随对话演进不断变动 → 自动在首次出现时截取前 20 字冻结
2. **展示截断**：侧边栏宽度固定导致名称显示不全 → Hover 整行显示完整名称 tooltip

**重要**：Antigravity 每次更新都会覆盖注入文件。执行「修复」重新注入即可，**localStorage 里的名称数据不会丢失**。

---

## 一、路径定义

每次执行前先确认路径，不要硬编码假设：

```bash
APP_WORKBENCH="/Applications/Antigravity.app/Contents/Resources/app/out/vs/code/electron-browser/workbench"
SKILL_DIR="$HOME/.gemini/antigravity/skills/ag-renamer"

TARGET_JS="$APP_WORKBENCH/ag-renamer.js"
TARGET_HTML="$APP_WORKBENCH/workbench-jetski-agent.html"

# 验证 App 存在
ls /Applications/Antigravity.app/Contents/MacOS/Electron 2>/dev/null || echo "❌ Antigravity 未安装"
```

若 App 不在 `/Applications/`，改为搜索：
```bash
find /Applications ~/Applications -name "Antigravity.app" -maxdepth 2 2>/dev/null | head -1
```

---

## 二、状态检查（始终先执行）

```bash
JS_OK=$(ls "$TARGET_JS" 2>/dev/null && echo "YES" || echo "NO")
HTML_OK=$(grep -q "ag-renamer.js" "$TARGET_HTML" 2>/dev/null && echo "YES" || echo "NO")
echo "JS 文件: $JS_OK | HTML 注入: $HTML_OK"
```

| 结果 | 操作 |
|------|------|
| 两者 YES | 已安装，直接告知用户重启 Agent Manager 即可 |
| 任一 NO | 执行「三、安装 / 修复」 |

---

## 三、安装 / 修复

依序执行以下步骤，**每步执行后验证**：

### 步骤 A：复制脚本

```bash
cp "$SKILL_DIR/scripts/ag-renamer.js" "$TARGET_JS"
ls "$TARGET_JS" && echo "✅ JS 复制成功"
```

### 步骤 B：注入 HTML

用 Python3（macOS 自带）做精确字符串替换，比 sed 更可靠：

```python3
#!/usr/bin/env python3
import sys

html_path = sys.argv[1]
ANCHOR = '<script src="./jetskiAgent.js" type="module"></script>'
INJECTION = '''<script src="./jetskiAgent.js" type="module"></script>
<!-- Custom conversation renamer (injected) -->
<script src="./ag-renamer.js" type="module"></script>'''

with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

if 'ag-renamer.js' in content:
    print('Already patched, skip.')
elif ANCHOR not in content:
    print('ERROR: anchor not found. HTML structure may have changed.')
    sys.exit(1)
else:
    content = content.replace(ANCHOR, INJECTION, 1)
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('✅ HTML patched.')
```

将上面代码保存到临时文件再执行：
```bash
python3 /tmp/ag_patch.py "$TARGET_HTML"
```

或直接内联运行：
```bash
python3 - "$TARGET_HTML" << 'EOF'
import sys
html_path = sys.argv[1]
ANCHOR = '<script src="./jetskiAgent.js" type="module"></script>'
INJECTION = ANCHOR + '\n<!-- Custom conversation renamer (injected) -->\n<script src="./ag-renamer.js" type="module"></script>'
with open(html_path, 'r') as f: content = f.read()
if 'ag-renamer.js' in content: print('Already patched.')
elif ANCHOR not in content: print('ERROR: anchor not found'); sys.exit(1)
else:
    with open(html_path, 'w') as f: f.write(content.replace(ANCHOR, INJECTION, 1))
    print('✅ HTML patched.')
EOF
```

### 步骤 C：清除 macOS 隔离标记

修改 App 内部文件会使代码签名失效，需要清除隔离属性，否则 Gatekeeper 可能拦截：

```bash
xattr -cr /Applications/Antigravity.app
echo "✅ 隔离标记已清除"
```

> 首次重启 Antigravity 时若弹出安全提示「无法验证开发者」，点「仍然打开」即可，后续不再提示。

### 步骤 D：最终验证

```bash
ls "$TARGET_JS" \
  && grep -q "ag-renamer.js" "$TARGET_HTML" \
  && echo "✅ 安装成功！请重启 Antigravity Agent Manager 窗口生效。" \
  || echo "❌ 验证失败，请检查上述步骤输出"
```

---

## 四、卸载

```bash
# 删除脚本
rm -f "$TARGET_JS" && echo "JS removed"

# 从 HTML 移除注入（用 Python 做精确删除）
python3 - "$TARGET_HTML" << 'EOF'
import sys
with open(sys.argv[1], 'r') as f: lines = f.readlines()
cleaned = [l for l in lines if 'ag-renamer.js' not in l and '<!-- Custom conversation renamer' not in l]
with open(sys.argv[1], 'w') as f: f.writelines(cleaned)
print(f'✅ 卸载完成，从 HTML 移除了 {len(lines)-len(cleaned)} 行')
EOF
```

> 卸载后，localStorage 里的名称数据仍然保留。如需彻底清除，告知用户在 Agent Manager DevTools Console 执行：
> ```javascript
> localStorage.removeItem('ag-custom-names');
> localStorage.removeItem('ag-auto-names');
> ```

---

## 五、使用说明（安装成功后告知用户）

| 操作 | 说明 |
|------|------|
| **自动命名** | 会话第一次出现时，自动截取前 20 字符冻结为稳定名称 |
| **自定义命名** | 右键点击侧边栏任意会话行 → 弹出小输入框 → 输入名称 → 回车或点确认 |
| **恢复自动名** | 右键 → 清空输入框 → 确认 |
| **Hover 预览** | 鼠标悬停整个会话行，显示完整名称 tooltip |
| **更新后修复** | Antigravity 更新后名称又变乱，重新触发此 skill 执行修复，名称数据不丢失 |

---

## 六、故障排查

| 症状 | 诊断思路 |
|------|---------|
| 右键无任何反应 | 在 Agent Manager 按 `Cmd+Shift+I` 打开 DevTools，Console 有无 `[ag-renamer] ✅ v3 运行中`？没有 → 脚本未加载，重查安装状态 |
| 弹框不出现但有日志 | 检查是否点击在会话 button 以外区域；右键必须在侧边栏会话行上 |
| Antigravity 更新后功能失效 | 正常现象，重新执行本 skill「安装/修复」流程即可 |
| macOS 安全提示 | 点「仍然打开」或在「系统设置 > 隐私与安全性」点「仍然允许」 |
| HTML anchor not found 错误 | Antigravity 更新改变了 HTML 结构，需重新检查 HTML 内容，找到新的注入点 |

若 HTML 结构变化，先执行：
```bash
cat "$TARGET_HTML"
```
查看新的 script 标签格式，更新上面的 `ANCHOR` 变量，再重新注入。
