import * as vscode from 'vscode';

export class FileService {
  // Get workspace files
  static async getWorkspaceFiles(): Promise<string[]> {
    try {
      const files: string[] = [];
      const uris = await vscode.workspace.findFiles(
        '**/*.{js,ts,jsx,tsx,py,html,css}', 
        '**/node_modules/**,**/dist/**,.git/**'
      );
      
      for (const uri of uris.slice(0, 10)) {
        try {
          const content = await vscode.workspace.fs.readFile(uri);
          const text = new TextDecoder().decode(content);
          // Use uri.path instead of path.basename
          const fileName = uri.path.split('/').pop() || 'unknown';
          files.push(`--- File: ${fileName} ---\n${text.slice(0, 2000)}`);
        } catch (e) {
          // Skip unreadable files
        }
      }
      return files;
    } catch (error) {
      return [];
    }
  }

  // Get current file content
  static async getCurrentFile(): Promise<string | null> {
    const editor = vscode.window.activeTextEditor;
    return editor?.document.getText() || null;
  }

  // Replace file content
  static async replaceFileContent(content: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const fullRange = new vscode.Range(
      0, 0,
      editor.document.lineCount,
      editor.document.lineAt(editor.document.lineCount - 1).text.length
    );
    
    await editor.edit(edit => {
      edit.replace(fullRange, content);
    });

    await editor.document.save();
    vscode.window.showInformationMessage('✅ File saved by Ollama!');
  }
}
