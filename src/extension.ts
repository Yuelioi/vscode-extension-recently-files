import path from "path";
import fs from "fs";
import * as vscode from "vscode";

let favorites: Map<string, string> = new Map();

const lightIcons: Map<string, string> = new Map();
const darkIcons: Map<string, string> = new Map();

const starIcon = path.join(__dirname, "..", "media", "star.svg");
const unStarIcon = path.join(__dirname, "..", "media", "unStar.svg");

const starButtons = [
  {
    iconPath: {
      light: vscode.Uri.file(starIcon),
      dark: vscode.Uri.file(starIcon),
    },
    tooltip: "取消收藏",
  },
];

const unStarButtons = [
  {
    // iconPath: vscode.Uri.file(starIcon).with({ scheme: "vscode-resource" }),
    iconPath: {
      light: vscode.Uri.file(unStarIcon),
      dark: vscode.Uri.file(unStarIcon),
    },
    tooltip: "添加收藏",
  },
];

// 初始化填充icon map
function populateIconMap(iconFolderPath: string, iconMap: Map<string, string>) {
  if (fs.existsSync(iconFolderPath)) {
    const files = fs.readdirSync(iconFolderPath); // 同步读取文件夹内容
    files.forEach((file) => {
      if (path.extname(file).toLowerCase() === ".svg") {
        // 确保只处理SVG文件
        const iconName = path.basename(file, path.extname(file)); // 获取文件名，不带扩展名
        const iconFullPath = path.join(iconFolderPath, file); // 构建文件的完整路径
        iconMap.set(iconName, iconFullPath); // 将图标名称和路径添加到Map中
      }
    });
  } else {
    console.error(`The specified folder does not exist: ${iconFolderPath}`);
  }
}

// 处理star事件
function handleFavorite(
  quickPick: vscode.QuickPick<vscode.QuickPickItem>,
  recentFiles: string[],
  e: vscode.QuickPickItemButtonEvent<vscode.QuickPickItem>,
  folderPathWithSep: string,
  showDetail: boolean
) {
  if (e.item) {
    const filepath = showDetail ? (e.item.detail as string).replace(">", path.sep) : (e.item.description as string).replace(">", path.sep);
    if (e.button.tooltip === "添加收藏") {
      favorites.set(path.join(folderPathWithSep, filepath), "1");
      vscode.window.showInformationMessage(`已添加 "${e.item.label}" 到收藏夹`);
      e.item.buttons = starButtons;
    } else if (e.button.tooltip === "取消收藏") {
      favorites.delete(path.join(folderPathWithSep, filepath));
      vscode.window.showInformationMessage(`已取消收藏"${e.item.label}"`);
      e.item.buttons = unStarButtons;
    }

    quickPick.items = createPicks(recentFiles, folderPathWithSep, showDetail);
  }
}

// 创建选择元素
function createElement(file: string, folderPathWithSep: string, showDetail: boolean, buttons: vscode.QuickInputButton[]) {
  const ext = path.extname(file).replace(".", "");
  const element: vscode.QuickPickItem = {
    label: path.basename(file),
    iconPath: {
      light: vscode.Uri.file(lightIcons.get(ext) || lightIcons.get("file") || ""),
      dark: vscode.Uri.file(darkIcons.get(ext) || darkIcons.get("file") || ""),
    },
    buttons: buttons,
  };

  if (showDetail) {
    element.detail = file.replace(folderPathWithSep, "").replace(path.sep, ">");
  } else {
    element.description = file.replace(folderPathWithSep, "").replace(path.sep, ">");
  }

  return element;
}

// 创建选择器
function createPicks(recentFiles: string[], folderPathWithSep: string, showDetail: boolean) {
  const favoritesList: string[] = [];
  const unFavoritesList: string[] = [];
  const recentPicks: vscode.QuickPickItem[] = [];

  recentFiles.forEach((file) => {
    if (favorites.get(file)) {
      favoritesList.push(file);
    } else {
      unFavoritesList.push(file);
    }
  });

  if (favoritesList.length > 0) {
    favoritesList.forEach((file) => {
      recentPicks.push(createElement(file, folderPathWithSep, showDetail, starButtons));
    });
  }

  if (favoritesList.length > 0 && unFavoritesList.length > 0) {
    recentPicks.push({
      label: "",
      kind: vscode.QuickPickItemKind.Separator,
    });
  }
  if (unFavoritesList.length > 0) {
    unFavoritesList.forEach((file) => {
      recentPicks.push(createElement(file, folderPathWithSep, showDetail, unStarButtons));
    });
  }

  return recentPicks;
}

// 创建 QuickPick 实例并显示最近文件
async function showRecentFiles(recentFiles: string[], folderPathWithSep: string, showDetail: boolean) {
  let recentPicks: vscode.QuickPickItem[] = createPicks(recentFiles, folderPathWithSep, showDetail);

  const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem>();
  quickPick.title = "Select File";
  quickPick.items = recentPicks;

  // 监听按钮点击事件
  quickPick.onDidTriggerItemButton(async (e) => {
    handleFavorite(quickPick, recentFiles, e, folderPathWithSep, showDetail);
  });

  quickPick.onDidChangeSelection(async (selectedItems) => {
    if (selectedItems.length > 0) {
      const selected = selectedItems[0];
      quickPick.dispose();

      const filepath = showDetail ? (selected.detail as string).replace(">", path.sep) : (selected.description as string).replace(">", path.sep);
      try {
        vscode.commands.executeCommand("vscode.open", vscode.Uri.file(path.join(folderPathWithSep, filepath)));
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open document: ${error}`);
      }
    }
  });

  quickPick.onDidHide(() => quickPick.dispose());

  await quickPick.show();
}

export function activate(context: vscode.ExtensionContext) {
  // 储存全局文件列表
  let openedFiles: string[] = context.globalState.get("openedFiles", []) as string[];

  // 定义图标文件夹路径
  const lightIconFolderPath = path.join(__dirname, "..", "media", "icons", "files", "light");
  const darkIconFolderPath = path.join(__dirname, "..", "media", "icons", "files", "dark");

  populateIconMap(lightIconFolderPath, lightIcons);
  populateIconMap(darkIconFolderPath, darkIcons);

  const config = vscode.workspace.getConfiguration("recently-files");

  let ignoreFolders: string[] = config.get("ignoreFolders", []);
  let ignoreExts: string[] = config.get("ignoreExts", [".git"]);
  if (!ignoreExts.includes(".git")) {
    ignoreExts = [...ignoreExts, ".git"];
  }

  let showDetail: boolean = config.get("showDetail", false);

  // 监听文件打开事件
  const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument((document) => {
    // 检查文件是否已经在列表中，避免重复添加
    if (!openedFiles.includes(document.uri.fsPath)) {
      openedFiles.push(document.uri.fsPath);

      // TODO 基于工作区储存
      if (openedFiles.length >= 500) {
        openedFiles.shift();
      }
      context.globalState.update("openedFiles", openedFiles);
    }
  });
  context.subscriptions.push(onDidOpenTextDocument);

  // 监听配置变动
  const configChange = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("recently-files.ignoreFolders")) {
      ignoreFolders = vscode.workspace.getConfiguration("recently-files").get<string[]>("ignoreFolders", []);
    }
    if (event.affectsConfiguration("recently-files.ignoreExts")) {
      ignoreExts = vscode.workspace.getConfiguration("recently-files").get<string[]>("ignoreExts", [".git"]);
      if (!ignoreExts.includes(".git")) {
        ignoreExts = [...ignoreExts, ".git"];
      }
    }
    if (event.affectsConfiguration("recently-files.showDetail")) {
      showDetail = vscode.workspace.getConfiguration("recently-files").get<boolean>("showDetail", false);
    }
  });
  context.subscriptions.push(configChange);

  // 注册命令
  const disposable = vscode.commands.registerCommand("recently-files.open", () => {
    const recentFilesRecord = context.globalState.get<string[]>("openedFiles");

    let recentFiles: string[] = JSON.parse(JSON.stringify(recentFilesRecord));
    let folderPathWithSep = "";

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      folderPathWithSep = workspaceFolders[0].uri.fsPath + path.sep;
    }

    // 去除非本工作区的内容
    recentFiles = recentFiles.filter((file) => {
      const filePath = path.normalize(file);
      const ext = path.extname(filePath);

      // 检查文件是否在指定的文件夹中
      if (!filePath.startsWith(folderPathWithSep)) {
        return false;
      }

      // 检查是否应该忽略该文件夹
      if (ignoreFolders.some((folder) => filePath.includes(folder))) {
        return false;
      }

      // 检查是否应该忽略该文件扩展名
      if (ignoreExts.includes(ext)) {
        return false;
      }
      return true;
    });

    if (!recentFiles || recentFiles.length <= 1) {
      vscode.window.showInformationMessage(`No recently files`);
      return;
    }

    // 只保留30个
    if (recentFiles.length > 30) {
      recentFiles.length = 30;
    }

    // 按文件名字母顺序 其次按照文件路径顺序
    recentFiles.sort((a, b) => {
      // 比较文件名
      let basenameComparison = path.basename(a).localeCompare(path.basename(b));

      // 如果文件名相同，则比较完整路径
      if (basenameComparison === 0) {
        return a.localeCompare(b);
      }

      return basenameComparison;
    });

    showRecentFiles(recentFiles, folderPathWithSep, showDetail);
  });
  context.subscriptions.push(disposable);
}

export function deactivate(context: vscode.ExtensionContext) {}
