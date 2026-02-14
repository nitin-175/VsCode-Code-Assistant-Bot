import * as vscode from 'vscode';

export class FileService {
  // Read entire workspace files
  static async getWorkspaceFiles(): Promise<string[]> {
    const files: string[] = [];
    const uris = await vscode.workspace.findFiles('**/*.{js,ts,py,jsx,tsx}', '**/node_modules/**');
    
    for (const uri of uris) {
      const content = await vscode.workspace.fs.readFile(uri);
      const text = new TextDecoder().decode(content);
      files.push(`File: ${uri.fsPath}\n${text}\n\n---`);
    }
    return files;
  }

  // Read current file
  static async getCurrentFile(): Promise<string | null> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return null;
    return editor.document.getText();
  }

  // Replace file content
  static async replaceFileContent(content: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const fullRange = new vscode.Range(
      editor.document.positionAt(0),
      editor.document.lineAt(editor.document.lineCount - 1).range.end
    );
    
    await editor.edit(editBuilder => {
      editBuilder.replace(fullRange, content);
    });

    vscode.window.showInformationMessage('✅ File updated by Ollama!');
  }
}
  