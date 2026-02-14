import * as vscode from 'vscode';

export class OutputPanelProvider {
  private static readonly viewType = 'ollama-assistant.outputPanel';
  private panels: Map<string, vscode.WebviewPanel> = new Map();

  constructor(private readonly extensionUri: vscode.Uri) {}

  /**
   * Create or reveal output panel
   */
  public createPanel(title: string): vscode.WebviewPanel {
    // Check if panel already exists
    const existingPanel = this.panels.get(title);
    if (existingPanel) {
      existingPanel.reveal(vscode.ViewColumn.Beside);
      return existingPanel;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      OutputPanelProvider.viewType,
      title,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri],
      }
    );

    // Store panel
    this.panels.set(title, panel);

    // Clean up when panel is closed
    panel.onDidDispose(() => {
      this.panels.delete(title);
    });

    return panel;
  }

  /**
   * Get HTML for loading state
   */
  public getLoadingHtml(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Loading</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
          }
          .loading {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .spinner {
            border: 3px solid var(--vscode-input-background);
            border-top: 3px solid var(--vscode-button-background);
            border-radius: 50%;
            width: 20px;
            height: 20px;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="loading">
          <div class="spinner"></div>
          <span>Generating response...</span>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get HTML for content display
   */
  public getContentHtml(title: string, content: string, isComplete: boolean): string {
    // Simple markdown-like rendering
    const formattedContent = this.formatMarkdown(content);
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
          }
          h1, h2, h3 {
            color: var(--vscode-textLink-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 5px;
          }
          code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
          }
          pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
          }
          pre code {
            padding: 0;
            background: none;
          }
          .status {
            padding: 10px;
            margin-bottom: 20px;
            border-radius: 5px;
            background-color: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
          }
          .complete {
            background-color: var(--vscode-inputValidation-successBackground);
            border: 1px solid var(--vscode-terminal-ansiGreen);
          }
          ul, ol {
            padding-left: 25px;
          }
          li {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="status ${isComplete ? 'complete' : ''}">
          ${isComplete ? '✅ Complete' : '⏳ Generating...'}
        </div>
        <div id="content">${formattedContent}</div>
      </body>
      </html>
    `;
  }

  /**
   * Get HTML for error display
   */
  public getErrorHtml(error: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
          }
          .error {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 15px;
            border-radius: 5px;
          }
          .error-title {
            font-weight: bold;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="error">
          <div class="error-title">❌ Error</div>
          <div>${this.escapeHtml(error)}</div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Basic markdown formatting  
   */
  private formatMarkdown(text: string): string {
    // Escape HTML first
    let formatted = this.escapeHtml(text);

    // Code blocks
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code>${code}</code></pre>`;
    });

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers
    formatted = formatted.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    formatted = formatted.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    formatted = formatted.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Lists
    formatted = formatted.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
    
    // Wrap consecutive <li> in <ul>
    formatted = formatted.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
