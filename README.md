# Folder Hider

> 一键隐藏 Obsidian 文件浏览器中不想日常看到的文件夹——临时目录、插件/AI 处理的中间产物文件夹等。纯显示层操作，不移动、不改动任何文件。

An Obsidian plugin to hide clutter folders (tmp / plugin-generated / intermediate folders) from the default file explorer with one click.

## 功能特性

- **右键即用**：在文件浏览器中右键任意文件夹 → 「Folder Hider：隐藏此文件夹」，立即从视图消失并进入隐藏列表；右键列表中的文件夹可「从隐藏列表移除」（显示状态下）
- **一键切换**：左侧 ribbon 的眼睛图标在 隐藏 ⇄ 全部显示 之间整体切换，图标随状态变化
- **命令面板**：`切换 隐藏/显示`、`全部隐藏`、`全部显示`、`从隐藏列表移除文件夹`（模糊搜索选择），均可绑定快捷键
- **设置页管理**：带路径自动补全的添加输入框 + 隐藏列表逐行 ✕ 移除
- **纯 UI 层实现**：通过 CSS 注入生效，无后台监听、零运行时开销；文件树无论如何重渲染规则持续有效
- **安全可逆**：搜索、链接、反链、其他插件对这些文件夹的访问完全不受影响；禁用/卸载插件瞬间全部还原

## 安装

### 方式一：BRAT（推荐，可持续接收更新）

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件
2. BRAT 设置 → **Add Beta plugin** → 填入本仓库地址（按你的实际仓库调整）：
   ```
   SteIasK/folder-hider
   ```
3. 启用 "Folder Hider"

今后更新：BRAT 会在启动时周期性检查，也可随时运行命令 `BRAT: Update all plugins` 手动拉取。

### 方式二：手动安装

1. 下载 [manifest.json](manifest.json) 与 [main.js](main.js)（如使用 Release 则下载其附件）
2. 放入 vault 的 `.obsidian/plugins/folder-hider/` 目录
3. 设置 → 第三方插件 → 启用 "Folder Hider"

## 使用

| 操作 | 入口 |
|---|---|
| 隐藏某个文件夹 | 文件浏览器右键 → 隐藏此文件夹 |
| 全局 隐藏/显示 切换 | ribbon 眼睛图标 / 命令面板 |
| 移除单个文件夹 | 显示状态下右键；或设置页列表 ✕；或命令面板「从隐藏列表移除文件夹」 |
| 批量管理 | 设置 → Folder Hider |

语义说明：将文件夹加入列表时会自动进入「隐藏」状态（加文件夹的目的就是让它消失，避免加完却看不见效果的困惑）。

## 工作原理

插件向 `document.head` 注入一条 `<style>`，把隐藏列表中每个文件夹对应一条规则：

```css
.nav-folder:has(> .nav-folder-title[data-path="weave"]) { display: none !important; }
```

Obsidian 1.x 中 `data-path` 属性位于内层标题行 `.nav-folder-title` 上，通过 `:has()` 反选外层 `.nav-folder` 容器，文件夹连同全部子项整体隐藏。切换「显示」即移除该 `<style>`。由于规则是声明式的，文件树重渲染后依然生效，无需监听 DOM。

- 隐藏列表与当前状态持久化在插件目录 `data.json`，重启 Obsidian 后保持
- 属性值经过转义，路径含引号 / 反斜杠亦安全
- 卸载（`onunload`）自动清理注入样式，立即全部还原

## 已知限制

- 仅作用于**核心文件浏览器**（官方 Files 视图）。若使用 Notebook Navigator 等第三方文件面板，请使用其自带的隐藏设置，两者互不干扰
- 隐藏仅是显示层效果：Quick Switcher、搜索、链接跳转仍可访问这些路径（这是刻意设计，保证插件"零侵入"）

## 开发维护

无构建步骤：`main.js` 为纯 JavaScript（CommonJS，`require("obsidian")`），修改后：

1. 在 Obsidian 中 Ctrl+P 运行 `重新加载应用（不保存）`（Reload app without saving），或关闭再打开插件开关
2. 版本号变更需同步修改 `manifest.json` 与 `versions.json`

发布新版本流程（BRAT 用户自动/手动拉取即可收到）：

```bash
# 仓库根 = 本目录（manifest.json、main.js 必须在根目录，BRAT 才能识别）
git add . && git commit -m "release: x.y.z"
git push
# 可选：打 tag 并附 manifest.json / main.js / styles.css(如有) 为 Release 附件
```

## 许可证

[MIT](LICENSE)
