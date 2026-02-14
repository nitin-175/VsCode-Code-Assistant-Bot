import * as vscode from 'vscode';
import { OllamaService } from '../services/OllamaService';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ollama-assistant.chatView';
  private _view?: vscode.WebviewView;
  private chatHistory: ChatMessage[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly ollamaService: OllamaService
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'sendMessage':
          await this.handleUserMessage(data.message);
          break;
        case 'clearChat':
          this.chatHistory = [];
          this.sendMessage({ type: 'clearChat' });
          break;
      }
    });
  }

  private async handleUserMessage(userMessage: string) {
    if (!userMessage.trim()) {
      return;
    }

    // Add user message to history
    this.chatHistory.push({ role: 'user', content: userMessage });

    // Send user message to webview
    this.sendMessage({
      type: 'userMessage',
      message: userMessage,
    });

    // Get model from config
    const config = vscode.workspace.getConfiguration('ollamaAssistant');
    const model = config.get<string>('model', 'llama3');

    try {
      // Prepare messages for API
      const messages = [
        {
          role: 'system' as const,
          content: 'You are a helpful coding assistant. Provide clear, concise answers.',
        },
        ...this.chatHistory.map((msg) => ({
          role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: msg.content,
        })),
      ];

      // Stream response
      let assistantMessage = '';

      for await (const chunk of this.ollamaService.streamChat(model, messages)) {
        assistantMessage += chunk;
        this.sendMessage({
          type: 'assistantChunk',
          message: assistantMessage,
        });
      }

      // Save complete response to history
      this.chatHistory.push({ role: 'assistant', content: assistantMessage });

      // Mark as complete
      this.sendMessage({
        type: 'assistantComplete',
        message: assistantMessage,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.sendMessage({
        type: 'error',
        message: `Error: ${errorMsg}`,
      });
    }
  }

  private sendMessage(message: any) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = this.getNonce();

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <title>Ollama Chat</title>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
          }
          #chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 15px;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .message {
            padding: 10px 12px;
            border-radius: 8px;
            max-width: 85%;
            word-wrap: break-word;
            animation: fadeIn 0.3s ease-in;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .user-message {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            align-self: flex-end;
          }
          .assistant-message {
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            align-self: flex-start;
          }
          .assistant-message.streaming {
            opacity: 0.8;
          }
          .assistant-message code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.9em;
          }
          #input-container {
            display: flex;
            gap: 8px;
            padding: 12px;
            border-top: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-sideBar-background);
          }
          #message-input {
            flex: 1;
            padding: 8px 12px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
          }
          #message-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
          }
          button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: 13px;
          }
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          #clear-btn {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
          }
          #clear-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
          }
          .error-message {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 10px;
            border-radius: 4px;
            margin: 10px;
          }
        </style>
      </head>
      <body>
        <div id="chat-container"></div>
        <div id="input-container">
          <input type="text" id="message-input" placeholder="Ask me anything..." />
          <button id="send-btn">Send</button>
          <button id="clear-btn">Clear</button>
        </div>

        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          const chatContainer = document.getElementById('chat-container');
          const messageInput = document.getElementById('message-input');
          const sendBtn = document.getElementById('send-btn');
          const clearBtn = document.getElementById('clear-btn');

          let isStreaming = false;
          let currentAssistantMessage = null;

          // Send message
          function sendMessage() {
            const message = messageInput.value.trim();
            if (!message || isStreaming) return;

            vscode.postMessage({
              type: 'sendMessage',
              message: message
            });

            messageInput.value = '';
            messageInput.focus();
          }

          // Add message to chat
          function addMessage(content, isUser, isStreaming = false) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + (isUser ? 'user-message' : 'assistant-message');
            if (isStreaming) {
              messageDiv.classList.add('streaming');
            }
            messageDiv.textContent = content;
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            return messageDiv;
          }

          // Event listeners
          sendBtn.addEventListener('click', sendMessage);
          clearBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'clearChat' });
          });

          messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          });

          // Handle messages from extension
          window.addEventListener('message', (event) => {
            const message = event.data;

            switch (message.type) {
              case 'userMessage':
                addMessage(message.message, true);
                isStreaming = true;
                sendBtn.disabled = true;
                break;

              case 'assistantChunk':
                if (!currentAssistantMessage) {
                  currentAssistantMessage = addMessage(message.message, false, true);
                } else {
                  currentAssistantMessage.textContent = message.message;
                  chatContainer.scrollTop = chatContainer.scrollHeight;
                }
                break;

              case 'assistantComplete':
                if (currentAssistantMessage) {
                  currentAssistantMessage.classList.remove('streaming');
                  currentAssistantMessage = null;
                }
                isStreaming = false;
                sendBtn.disabled = false;
                messageInput.focus();
                break;

              case 'error':
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.textContent = message.message;
                chatContainer.appendChild(errorDiv);
                isStreaming = false;
                sendBtn.disabled = false;
                currentAssistantMessage = null;
                break;

              case 'clearChat':
                chatContainer.innerHTML = '';
                currentAssistantMessage = null;
                isStreaming = false;
                sendBtn.disabled = false;
                break;
            }
          });

          // Focus input on load
          messageInput.focus();
        </script>
      </body>
      </html>
    `;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private async handleUserMessage(userMessage: string) {
  // Auto-include current file context
  const currentFile = await FileService.getCurrentFile();
  let fullPrompt = userMessage;
  
  if (currentFile) {
    fullPrompt = `Current file content:\n\`\`\`\n${currentFile}\n\`\`\`\n\nUser: ${userMessage}`;
  }

  // Send to Ollama...
}

}
