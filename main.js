"use strict";

const {
	AbstractInputSuggest,
	FuzzySuggestModal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFolder,
	setIcon,
} = require("obsidian");

const STYLE_ELEMENT_ID = "folder-hider-style";

const DEFAULT_SETTINGS = {
	folders: [],
	hidden: true,
};

/* ---------- CSS 生成与注入 ---------- */

function escapeAttrValue(path) {
	return path.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildCss(folders) {
	return folders
		.map((path) => {
			const attr = escapeAttrValue(path);
			/* Obsidian 1.x 文件树结构：data-path 在内层 .nav-folder-title 行上，
			   外层 .nav-folder 容器才是包含子项的整体，需用 :has() 反选才能整棵折叠 */
			return [
				`.nav-folder:has(> .nav-folder-title[data-path="${attr}"])`,
				`.nav-folder[data-path="${attr}"]`,
			]
				.map((selector) => `${selector} { display: none !important; }`)
				.join("\n");
		})
		.join("\n");
}

/* ---------- 主插件 ---------- */

class FolderHiderPlugin extends Plugin {
	async onload() {
		await this.loadSettings();

		this.settingTab = new FolderHiderSettingTab(this.app, this);
		this.addSettingTab(this.settingTab);

		this.ribbonIconEl = this.addRibbonIcon(
			this.settings.hidden ? "eye-off" : "eye",
			this.settings.hidden
				? "Folder Hider：显示隐藏的文件夹"
				: "Folder Hider：隐藏列表中的文件夹",
			() => this.toggleHidden()
		);

		this.addCommand({
			id: "toggle-hidden",
			name: "切换 隐藏/显示",
			callback: () => this.toggleHidden(),
		});
		this.addCommand({
			id: "hide-all",
			name: "全部隐藏",
			callback: () => this.setHidden(true),
		});
		this.addCommand({
			id: "show-all",
			name: "全部显示",
			callback: () => this.setHidden(false),
		});
		this.addCommand({
			id: "remove-hidden-folder",
			name: "从隐藏列表移除文件夹",
			callback: () => {
				if (this.settings.folders.length === 0) {
					new Notice("Folder Hider：隐藏列表为空");
					return;
				}
				new RemoveFolderModal(this.app, this).open();
			},
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!(file instanceof TFolder) || file.isRoot()) return;
				const inList = this.settings.folders.includes(file.path);
				menu.addItem((item) => {
					item
						.setTitle(
							inList
								? "Folder Hider：从隐藏列表移除"
								: "Folder Hider：隐藏此文件夹"
						)
						.setIcon(inList ? "eye" : "eye-off")
						.onClick(() =>
							inList
								? this.removeFolder(file.path)
								: this.addFolder(file.path)
						);
				});
			})
		);

		this.applyStyles();
	}

	onunload() {
		this.removeStyles();
	}

	/* ----- 设置与持久化 ----- */

	async loadSettings() {
		const data = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		data.folders = [
			...new Set(data.folders.map((f) => String(f).trim()).filter(Boolean)),
		];
		this.settings = data;
	}

	async apply() {
		await this.saveData(this.settings);
		this.applyStyles();
		this.updateRibbon();
	}

	refreshSettingsUI() {
		if (this.settingTab) this.settingTab.display();
	}

	/* ----- 状态切换 ----- */

	toggleHidden() {
		return this.setHidden(!this.settings.hidden);
	}

	async setHidden(hidden) {
		this.settings.hidden = hidden;
		await this.apply();
		if (hidden && this.settings.folders.length === 0) {
			new Notice(
				"Folder Hider：隐藏列表为空，右键文件夹或到设置中添加"
			);
		} else {
			new Notice(
				hidden
					? "Folder Hider：已隐藏列表中的文件夹"
					: "Folder Hider：已显示全部文件夹"
			);
		}
		this.refreshSettingsUI();
	}

	async addFolder(rawPath) {
		const input = String(rawPath).trim();
		if (!input) return;
		const canonical = this.resolveFolderPath(input);
		const path = canonical || input;
		if (this.settings.folders.includes(path)) {
			new Notice(`Folder Hider：已在隐藏列表中 → ${path}`);
			return;
		}
		this.settings.folders.push(path);
		this.settings.hidden = true; // “隐藏”语义：加入列表即进入隐藏状态
		await this.apply();
		new Notice(
			canonical
				? `Folder Hider：已隐藏 → ${path}`
				: `Folder Hider：路径未找到，仍已加入列表 → ${path}`
		);
		this.refreshSettingsUI();
	}

	async removeFolder(path) {
		const before = this.settings.folders.length;
		this.settings.folders = this.settings.folders.filter((f) => f !== path);
		if (this.settings.folders.length === before) return;
		await this.apply();
		new Notice(`Folder Hider：已从隐藏列表移除 → ${path}`);
		this.refreshSettingsUI();
	}

	/* ----- 样式 ----- */

	applyStyles() {
		this.removeStyles();
		if (!this.settings.hidden || this.settings.folders.length === 0) return;
		const styleEl = document.createElement("style");
		styleEl.id = STYLE_ELEMENT_ID;
		styleEl.textContent = buildCss(this.settings.folders);
		document.head.appendChild(styleEl);
	}

	removeStyles() {
		const existing = document.getElementById(STYLE_ELEMENT_ID);
		if (existing) existing.remove();
	}

	updateRibbon() {
		if (!this.ribbonIconEl) return;
		setIcon(this.ribbonIconEl, this.settings.hidden ? "eye-off" : "eye");
		this.ribbonIconEl.setAttribute(
			"aria-label",
			this.settings.hidden
				? "Folder Hider：显示隐藏的文件夹"
				: "Folder Hider：隐藏列表中的文件夹"
		);
	}

	/* ----- 工具 ----- */

	resolveFolderPath(input) {
		const target = input.toLowerCase();
		const stack = [this.app.vault.getRoot()];
		while (stack.length > 0) {
			const folder = stack.pop();
			for (const child of folder.children) {
				if (child instanceof TFolder) {
					if (child.path.toLowerCase() === target) return child.path;
					stack.push(child);
				}
			}
		}
		return null;
	}
}

/* ---------- 移除文件夹：模糊搜索弹窗 ---------- */

class RemoveFolderModal extends FuzzySuggestModal {
	constructor(app, plugin) {
		super(app);
		this.plugin = plugin;
		this.setPlaceholder("选择要从隐藏列表移除的文件夹");
	}

	getItems() {
		return this.plugin.settings.folders.slice();
	}

	getItemText(item) {
		return item;
	}

	onChooseItem(item) {
		this.plugin.removeFolder(item);
	}
}

/* ---------- 设置页：文件夹路径自动补全 ---------- */

class FolderSuggest extends AbstractInputSuggest {
	constructor(app, inputEl, onPick) {
		super(app, inputEl);
		this.onPick = onPick;
	}

	getSuggestions(query) {
		const q = query.trim().toLowerCase();
		const results = [];
		const stack = [this.app.vault.getRoot()];
		while (stack.length > 0) {
			const folder = stack.pop();
			for (const child of folder.children) {
				if (child instanceof TFolder) {
					if (!q || child.path.toLowerCase().includes(q)) {
						results.push(child);
					}
					stack.push(child);
				}
			}
		}
		return results.slice(0, 60);
	}

	renderSuggestion(folder, el) {
		el.setText(folder.path);
	}

	selectSuggestion(folder) {
		this.close();
		this.onPick(folder.path);
	}
}

/* ---------- 设置页 ---------- */

class FolderHiderSettingTab extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const containerEl = this.containerEl;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Folder Hider" });
		containerEl.createEl("p", {
			text: "把不需要日常看到的文件夹从左侧文件浏览器中隐藏。纯显示层操作，不影响文件本身、搜索与索引。",
			cls: "setting-item-description",
		});

		const hidden = this.plugin.settings.hidden;

		new Setting(containerEl)
			.setName("当前状态：" + (hidden ? "已隐藏" : "全部显示"))
			.setDesc(
				hidden
					? `列表中的 ${this.plugin.settings.folders.length} 个文件夹当前不可见`
					: "所有文件夹当前可见，点击下方按钮或 ribbon 图标可切回隐藏"
			)
			.addButton((btn) =>
				btn
					.setButtonText(hidden ? "全部显示" : "全部隐藏")
					.setCta()
					.onClick(() => this.plugin.toggleHidden())
			);

		new Setting(containerEl)
			.setName("添加要隐藏的文件夹")
			.setDesc(
				"输入路径后回车，或从下拉提示中直接选择。也可以在文件浏览器中右键任意文件夹 →「隐藏此文件夹」。"
			)
			.addText((text) => {
				text.setPlaceholder("例如：Weave EPUB Reader/Book data templates");
				text.inputEl.style.width = "100%";
				text.inputEl.addEventListener("keydown", (evt) => {
					if (evt.key === "Enter") {
						evt.preventDefault();
						const value = text.inputEl.value.trim();
						if (value) this.plugin.addFolder(value);
					}
				});
				new FolderSuggest(this.app, text.inputEl, (path) =>
					this.plugin.addFolder(path)
				);
			});

		containerEl.createEl("h3", { text: "隐藏列表" });

		const folders = this.plugin.settings.folders;
		if (folders.length === 0) {
			containerEl.createEl("p", {
				text: "（空）在文件浏览器里右键文件夹即可加入隐藏列表。",
				cls: "setting-item-description",
			});
		} else {
			for (const path of folders) {
				const setting = new Setting(containerEl).setName(path);
				setting.nameEl.style.wordBreak = "break-all";
				setting.addButton((btn) =>
					btn
						.setIcon("x")
						.setTooltip("从隐藏列表移除")
						.onClick(() => this.plugin.removeFolder(path))
				);
			}
		}
	}
}

module.exports = FolderHiderPlugin;
