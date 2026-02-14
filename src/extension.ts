import * as vscode from 'vscode';
import { OllamaService } from './services/OllamaService';
import { OutputPanelProvider } from './providers/OutputPanelProvider';
import { ChatViewProvider } from './providers/ChatViewProvider';
import { FileService } from './services/FileService';  // ← NEW!
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

  // 🎯 COMMAND 1: Explain Selected Code (Original)
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

      const panel = outputPanelProvider.createPanel('Code Explanation');
      panel.webview.html = outputPanelProvider.getLoadingHtml();

      try {
        const prompt = `You are a code expert. Explain this ${language} code clearly and concisely:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nProvide:\n1. What the code does\n2. Key concepts used\n3. Potential improvements`;

        let fullResponse = '';
        for await (const chunk of ollamaService.streamGenerate(model, prompt)) {
          fullResponse += chunk;
          panel.webview.html = outputPanelProvider.getContentHtml(
            'Code Explanation',
            fullResponse,
            false
          );
        }

        panel.webview.html = outputPanelProvider.getContentHtml(
          'Code Explanation',
          fullResponse,
          true
        );
        vscode.window.showInformationMessage('✅ Explanation complete!');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Ollama error: ${errorMsg}`);
        panel.webview.html = outputPanelProvider.getErrorHtml(errorMsg);
      }
    })
  );

  // 🎯 COMMAND 2: Show Output Panel
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-assistant.showOutput', () => {
      outputPanelProvider.createPanel('Ollama Output');
    })
  );

  // 🎯 COMMAND 3: Open Chat
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-assistant.openChat', () => {
      vscode.commands.executeCommand('ollama-assistant.chatView.focus');
    })
  );

  // 🔥 NEW COMMAND 4: Edit Current File
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-assistant.editFile', async () => {
      const currentFile = await FileService.getCurrentFile();
      if (!currentFile) {
        vscode.window.showWarningMessage('❌ No active file open!');
        return;
      }

      const config = vscode.workspace.getConfiguration('ollamaAssistant');
      const model = config.get<string>('model', 'llama3');
      const panel = outputPanelProvider.createPanel('AI File Edit');
      
      panel.webview.html = outputPanelProvider.getLoadingHtml();

      try {
        const language = vscode.window.activeTextEditor?.document.languageId || 'javascript';
        const prompt = `You are an expert ${language} developer. 
IMPROVE this entire file. Make it cleaner, more efficient, add comments, fix bugs.
ONLY return the COMPLETE improved code (NO explanations, NO markdown):

\`\`\`${language}
${currentFile}
\`\`\``;

        let improvedCode = '';
        for await (const chunk of ollamaService.streamGenerate(model, prompt)) {
          improvedCode += chunk;
          panel.webview.html = outputPanelProvider.getContentHtml(
            'AI File Edit',
            `Improved code:\n\n\`\`\`${language}\n${improvedCode}\n\`\`\``,
            false
          );
        }

        // Ask user to apply changes
        vscode.window.showInformationMessage(
          '✅ AI improved your file! Apply changes?',
          'Yes, Apply',
          'No'
        ).then(async (choice) => {
          if (choice === 'Yes, Apply') {
            await FileService.replaceFileContent(improvedCode);
            panel.webview.html = outputPanelProvider.getContentHtml(
              '✅ File Updated!',
              'Your file has been improved and saved!',
              true
            );
          }
        });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        panel.webview.html = outputPanelProvider.getErrorHtml(errorMsg);
      }
    })
  );

  // 🔥 NEW COMMAND 5: Explain Entire Project
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-assistant.explainProject', async () => {
      const panel = outputPanelProvider.createPanel('Project Analysis');
      panel.webview.html = outputPanelProvider.getLoadingHtml();

      try {
        const workspaceFiles = await FileService.getWorkspaceFiles();
        const config = vscode.workspace.getConfiguration('ollamaAssistant');
        const model = config.get<string>('model', 'llama3');

        const prompt = `Analyze this project structure and files. Provide:
1. Project purpose
2. Main technologies used
3. Architecture overview
4. Potential improvements

Project files:
${workspaceFiles.slice(0, 3).join('\n')}...`;

        let analysis = '';
        for await (const chunk of ollamaService.streamGenerate(model, prompt)) {
          analysis += chunk;
          panel.webview.html = outputPanelProvider.getContentHtml(
            'Project Analysis',
            analysis,
            false
          );
        }

        panel.webview.html = outputPanelProvider.getContentHtml(
          'Project Analysis Complete',
          analysis,
          true
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        panel.webview.html = outputPanelProvider.getErrorHtml(errorMsg);
      }
    })
  );

  // 🔥 NEW COMMAND 6: Test File Access (Debug)
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-assistant.testFiles', async () => {
      const files = await FileService.getWorkspaceFiles();
      const currentFile = await FileService.getCurrentFile();
      vscode.window.showInformationMessage(
        `📁 Found ${files.length} workspace files! 
        📄 Current file: ${currentFile ? '✅ YES' : '❌ NO'}`
      );
    })
  );

  // Check Ollama connection on startup
  ollamaService.checkConnection().then((isConnected) => {
    if (!isConnected) {
      vscode.window.showWarningMessage(
        '⚠️ Ollama not running. Start with: ollama serve',
        'Open Ollama'
      ).then((selection) => {
        if (selection === 'Open Ollama') {
          vscode.env.openExternal(vscode.Uri.parse('https://ollama.ai'));
        }
      });
    }
  });
}

export function deactivate() {
  console.log('Ollama Code Assistant deactivated');
}
