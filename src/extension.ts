import * as vscode from 'vscode';
import { OllamaService } from './services/OllamaService';
import { OutputPanelProvider } from './providers/OutputPanelProvider';
import { ChatViewProvider } from './providers/ChatViewProvider';
import { getSelectedCode } from './utils/editor';

export function activate(context: vscode.ExtensionContext) {
  console.log('Ollama Code Assistant activated!');

  const ollamaService = new OllamaService();
  const outputPanelProvider = new OutputPanelProvider(context.extensionUri);
  const chatViewProvider = new ChatViewProvider(context.extensionUri, ollamaService);

  // Register Chat Sidebar
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'ollama-assistant.chatView',
      chatViewProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    )
  );

  // Command: Explain Selected Code
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-assistant.explainCode', async () => {
      const selection = getSelectedCode();
      
      if (!selection) {
        vscode.window.showWarningMessage('Please select some code first!');
        return;
      }

      const { code, language } = selection;
      const config = vscode.workspace.getConfiguration('ollamaAssistant');
      const model = config.get<string>('model', 'llama3');

      // Show output panel
      const panel = outputPanelProvider.createPanel('Code Explanation');
      
      // Show loading state
      panel.webview.html = outputPanelProvider.getLoadingHtml();

      try {
        const prompt = `You are a code expert. Explain this ${language} code clearly and concisely:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nProvide:\n1. What the code does\n2. Key concepts used\n3. Potential improvements`;

        let fullResponse = '';

        // Stream response
        for await (const chunk of ollamaService.streamGenerate(model, prompt)) {
          fullResponse += chunk;
          panel.webview.html = outputPanelProvider.getContentHtml(
            'Code Explanation',
            fullResponse,
            false
          );
        }

        // Mark as complete
        panel.webview.html = outputPanelProvider.getContentHtml(
          'Code Explanation',
          fullResponse,
          true
        );

        vscode.window.showInformationMessage('Explanation complete!');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Ollama error: ${errorMsg}`);
        panel.webview.html = outputPanelProvider.getErrorHtml(errorMsg);
      }
    })
  );

  // Command: Show Output Panel
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-assistant.showOutput', () => {
      outputPanelProvider.createPanel('Ollama Output');
    })
  );

  // Command: Open Chat
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-assistant.openChat', () => {
      vscode.commands.executeCommand('ollama-assistant.chatView.focus');
    })
  );

  // Check Ollama connection on startup
  ollamaService.checkConnection().then((isConnected) => {
    if (!isConnected) {
      vscode.window.showWarningMessage(
        'Ollama is not running. Please start Ollama to use this extension.',
        'Open Ollama Site'
      ).then((selection) => {
        if (selection === 'Open Ollama Site') {
          vscode.env.openExternal(vscode.Uri.parse('https://ollama.ai'));
        }
      });
    }
  });
}

export function deactivate() {
  console.log('Ollama Code Assistant deactivated');
}


