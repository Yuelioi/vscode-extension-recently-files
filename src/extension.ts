import path from "path";
import * as vscode from "vscode";

import { ThemeIcon } from "vscode";

export function activate(context: vscode.ExtensionContext) {
  let openedFiles: string[] = context.globalState.get("openedFiles", []) as string[];

  const ignores: string[] = ["git"];

  // 监听文件打开事件
  const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument((document) => {
    for (let index = 0; index < ignores.length; index++) {
      const element = ignores[index];
      if (document.uri.fsPath.includes(element)) {
        return;
      }
    }

    // 检查文件是否已经在列表中，避免重复添加
    if (!openedFiles.includes(document.uri.fsPath)) {
      openedFiles.push(document.uri.fsPath);

      if (openedFiles.length >= 21) {
        openedFiles.shift();
      }
      context.globalState.update("openedFiles", openedFiles);
    }
  });

  context.subscriptions.push(onDidOpenTextDocument);

  let disposable = vscode.commands.registerCommand("recently-files.open", () => {
    const recentFiles = context.globalState.get<string[]>("openedFiles");

    if (!recentFiles || recentFiles.length <= 1) {
      vscode.window.showInformationMessage(`No recently files`);
      return;
    }

    recentFiles.pop();

    // 按路径顺序 而不是打开顺序排序
    recentFiles.sort((a, b) => a.localeCompare(b));

    // const maxLength = Math.max(...recentFiles.map((item) => path.basename(item).length));

    let folderPath = "";

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      folderPath = workspaceFolders[0].uri.fsPath + path.sep;
    }

    const recentPicks: vscode.QuickPickItem[] = [];

    recentFiles.forEach((file) => {
      recentPicks.push({
        label: path.basename(file),
        // description: file.replace(folderPath, ""),

        detail: file.replace(folderPath, "").replace(path.sep, ">"),
        iconPath: new ThemeIcon("file"),
      });
    });

    vscode.window.showQuickPick(recentPicks).then((selection) => {
      if (selection) {
        vscode.workspace.openTextDocument(path.join(folderPath, (selection.detail as string).replace(">", path.sep))).then(
          (doc) => {
            vscode.window.showTextDocument(doc);
          },
          (error) => {
            vscode.window.showErrorMessage(`Failed to open document: ${error}`);
          }
        );
      }
    });
  });

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate(context: vscode.ExtensionContext) {}
