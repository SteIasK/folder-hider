#!/usr/bin/env bash
# 将仓库中的插件文件同步到本地 vault 的运行目录（Obsidian 只从 .obsidian/plugins/ 加载）。
# 用法：在 folder-hider 仓库根目录执行  bash scripts/sync-to-vault.sh
# 可用环境变量覆盖默认 vault 路径：
#   VAULT_PLUGIN_DIR="/path/to/vault/.obsidian/plugins/folder-hider" bash scripts/sync-to-vault.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

DEFAULT_VAULT_DIR="/e/文档/Obsidian Vault/Obsidian-all/.obsidian/plugins/folder-hider"
TARGET_DIR="${VAULT_PLUGIN_DIR:-$DEFAULT_VAULT_DIR}"

if [ ! -d "$TARGET_DIR" ]; then
	echo "目标目录不存在：$TARGET_DIR" >&2
	echo "请确认 vault 路径，或通过 VAULT_PLUGIN_DIR 环境变量指定。" >&2
	exit 1
fi

# data.json（隐藏列表运行数据）只存在于 vault 侧，永不覆盖。
FILES=(manifest.json main.js README.md LICENSE versions.json)

for f in "${FILES[@]}"; do
	if [ -f "$REPO_DIR/$f" ]; then
		cp "$REPO_DIR/$f" "$TARGET_DIR/$f"
		echo "已同步 $f"
	fi
done

# styles.css 目前不存在；将来如添加则一并同步
if [ -f "$REPO_DIR/styles.css" ]; then
	cp "$REPO_DIR/styles.css" "$TARGET_DIR/styles.css"
	echo "已同步 styles.css"
fi

echo ""
echo "同步完成 → $TARGET_DIR"
echo "在 Obsidian 中 Ctrl+P 运行「重新加载应用（不保存）」或重开插件开关即可生效。"
