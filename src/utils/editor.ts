import * as vscode from 'vscode';

export interface CodeSelection {
  code: string;
  language: string;
}

/**
 * Get selected code from active editor
 */
export function getSelectedCode(): CodeSelection | null {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    return null;
  }

  const selection = editor.selection;
  const code = editor.document.getText(selection);

  if (!code.trim()) {
    return null;
  }

  return {
    code,
    language: editor.document.languageId,
  };
}

/**
 * Get all code from active editor
 */
export function getAllCode(): CodeSelection | null {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    return null;
  }

  return {
    code: editor.document.getText(),
    language: editor.document.languageId,
  };
}
