"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode6 = __toESM(require("vscode"));

// src/services/OllamaService.ts
var vscode = __toESM(require("vscode"));
var OllamaService = class {
  baseUrl;
  constructor() {
    const config = vscode.workspace.getConfiguration("ollamaAssistant");
    this.baseUrl = config.get("baseUrl", "http://localhost:11434");
  }
  /**
   * Check if Ollama is running
   */
  async checkConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET"
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
  /**
   * Get available models
   */
  async getAvailableModels() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error("Failed to fetch models");
      }
      const data = await response.json();
      return data.models.map((m) => m.name);
    } catch (error) {
      console.error("Error fetching models:", error);
      return [];
    }
  }
  /**
   * Stream completion for single prompt
   */
  async *streamGenerate(model, prompt) {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: true
      })
    });
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) {
      throw new Error("No response body");
    }
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((line) => line.trim());
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.response) {
            yield json.response;
          }
        } catch {
        }
      }
    }
  }
  /**
   * Stream chat completion with conversation history
   */
  async *streamChat(model, messages) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true
      })
    });
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) {
      throw new Error("No response body");
    }
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((line) => line.trim());
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            yield json.message.content;
          }
        } catch {
        }
      }
    }
  }
  /**
   * Non-streaming generate (for simple use cases)
   */
  async generate(model, prompt) {
    let fullResponse = "";
    for await (const chunk of this.streamGenerate(model, prompt)) {
      fullResponse += chunk;
    }
    return fullResponse;
  }
};

// src/providers/OutputPanelProvider.ts
var vscode2 = __toESM(require("vscode"));
var OutputPanelProvider = class _OutputPanelProvider {
  constructor(extensionUri) {
    this.extensionUri = extensionUri;
  }
  static viewType = "ollama-assistant.outputPanel";
  panels = /* @__PURE__ */ new Map();
  /**
   * Create or reveal output panel
   */
  createPanel(title) {
    const existingPanel = this.panels.get(title);
    if (existingPanel) {
      existingPanel.reveal(vscode2.ViewColumn.Beside);
      return existingPanel;
    }
    const panel = vscode2.window.createWebviewPanel(
      _OutputPanelProvider.viewType,
      title,
      vscode2.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri]
      }
    );
    this.panels.set(title, panel);
    panel.onDidDispose(() => {
      this.panels.delete(title);
    });
    return panel;
  }
  /**
   * Get HTML for loading state
   */
  getLoadingHtml() {
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
  getContentHtml(title, content, isComplete) {
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
        <div class="status ${isComplete ? "complete" : ""}">
          ${isComplete ? "\u2705 Complete" : "\u23F3 Generating..."}
        </div>
        <div id="content">${formattedContent}</div>
      </body>
      </html>
    `;
  }
  /**
   * Get HTML for error display
   */
  getErrorHtml(error) {
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
          <div class="error-title">\u274C Error</div>
          <div>${this.escapeHtml(error)}</div>
        </div>
      </body>
      </html>
    `;
  }
  /**
   * Basic markdown formatting  
   */
  formatMarkdown(text) {
    let formatted = this.escapeHtml(text);
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code>${code}</code></pre>`;
    });
    formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");
    formatted = formatted.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    formatted = formatted.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    formatted = formatted.replace(/^# (.+)$/gm, "<h1>$1</h1>");
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    formatted = formatted.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");
    formatted = formatted.replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>");
    formatted = formatted.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");
    formatted = formatted.replace(/\n/g, "<br>");
    return formatted;
  }
  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
};

// src/providers/ChatViewProvider.ts
var vscode4 = __toESM(require("vscode"));

// src/services/FileService.ts
var vscode3 = __toESM(require("vscode"));
var FileService = class {
  // Get workspace files
  static async getWorkspaceFiles() {
    try {
      const files = [];
      const uris = await vscode3.workspace.findFiles(
        "**/*.{js,ts,jsx,tsx,py,html,css}",
        "**/node_modules/**,**/dist/**,.git/**"
      );
      for (const uri of uris.slice(0, 10)) {
        try {
          const content = await vscode3.workspace.fs.readFile(uri);
          const text = new TextDecoder().decode(content);
          const fileName = uri.path.split("/").pop() || "unknown";
          files.push(`--- File: ${fileName} ---
${text.slice(0, 2e3)}`);
        } catch (e) {
        }
      }
      return files;
    } catch (error) {
      return [];
    }
  }
  // Get current file content
  static async getCurrentFile() {
    const editor = vscode3.window.activeTextEditor;
    return editor?.document.getText() || null;
  }
  // Replace file content
  static async replaceFileContent(content) {
    const editor = vscode3.window.activeTextEditor;
    if (!editor)
      return;
    const fullRange = new vscode3.Range(
      0,
      0,
      editor.document.lineCount,
      editor.document.lineAt(editor.document.lineCount - 1).text.length
    );
    await editor.edit((edit) => {
      edit.replace(fullRange, content);
    });
    await editor.document.save();
    vscode3.window.showInformationMessage("\u2705 File saved by Ollama!");
  }
};

// src/providers/ChatViewProvider.ts
var ChatViewProvider = class {
  constructor(extensionUri, ollamaService) {
    this.extensionUri = extensionUri;
    this.ollamaService = ollamaService;
  }
  static viewType = "ollama-assistant.chatView";
  _view;
  chatHistory = [];
  resolveWebviewView(webviewView, context, _token) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "sendMessage":
          await this.handleUserMessage(data.message);
          break;
        case "clearChat":
          this.chatHistory = [];
          this.sendMessage({ type: "clearChat" });
          break;
      }
    });
  }
  async handleUserMessage(userMessage) {
    const currentFile = await FileService.getCurrentFile();
    let fullPrompt = userMessage;
    if (currentFile) {
      fullPrompt = `Current file content:
\`\`\`
${currentFile}
\`\`\`

User: ${userMessage}`;
    }
    if (!userMessage.trim()) {
      return;
    }
    this.chatHistory.push({ role: "user", content: userMessage });
    this.sendMessage({
      type: "userMessage",
      message: userMessage
    });
    const config = vscode4.workspace.getConfiguration("ollamaAssistant");
    const model = config.get("model", "llama3");
    try {
      const messages = [
        {
          role: "system",
          content: "You are a helpful coding assistant. Provide clear, concise answers."
        },
        ...this.chatHistory.map((msg) => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content
        }))
      ];
      let assistantMessage = "";
      for await (const chunk of this.ollamaService.streamChat(
        model,
        messages
      )) {
        assistantMessage += chunk;
        this.sendMessage({
          type: "assistantChunk",
          message: assistantMessage
        });
      }
      this.chatHistory.push({ role: "assistant", content: assistantMessage });
      this.sendMessage({
        type: "assistantComplete",
        message: assistantMessage
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      this.sendMessage({
        type: "error",
        message: `Error: ${errorMsg}`
      });
    }
  }
  sendMessage(message) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }
  getHtmlForWebview(webview) {
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
  getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
};

// src/utils/editor.ts
var vscode5 = __toESM(require("vscode"));
function getSelectedCode() {
  const editor = vscode5.window.activeTextEditor;
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
    language: editor.document.languageId
  };
}

// src/extension.ts
function activate(context) {
  console.log("Ollama Code Assistant activated!");
  const ollamaService = new OllamaService();
  const outputPanelProvider = new OutputPanelProvider(context.extensionUri);
  const chatViewProvider = new ChatViewProvider(context.extensionUri, ollamaService);
  context.subscriptions.push(
    vscode6.window.registerWebviewViewProvider(
      "ollama-assistant.chatView",
      chatViewProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );
  context.subscriptions.push(
    vscode6.commands.registerCommand("ollama-assistant.explainCode", async () => {
      const selection = getSelectedCode();
      if (!selection) {
        vscode6.window.showWarningMessage("Please select some code first!");
        return;
      }
      const { code, language } = selection;
      const config = vscode6.workspace.getConfiguration("ollamaAssistant");
      const model = config.get("model", "llama3");
      const panel = outputPanelProvider.createPanel("Code Explanation");
      panel.webview.html = outputPanelProvider.getLoadingHtml();
      try {
        const prompt = `You are a code expert. Explain this ${language} code clearly and concisely:

\`\`\`${language}
${code}
\`\`\`

Provide:
1. What the code does
2. Key concepts used
3. Potential improvements`;
        let fullResponse = "";
        for await (const chunk of ollamaService.streamGenerate(model, prompt)) {
          fullResponse += chunk;
          panel.webview.html = outputPanelProvider.getContentHtml(
            "Code Explanation",
            fullResponse,
            false
          );
        }
        panel.webview.html = outputPanelProvider.getContentHtml(
          "Code Explanation",
          fullResponse,
          true
        );
        vscode6.window.showInformationMessage("\u2705 Explanation complete!");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        vscode6.window.showErrorMessage(`Ollama error: ${errorMsg}`);
        panel.webview.html = outputPanelProvider.getErrorHtml(errorMsg);
      }
    })
  );
  context.subscriptions.push(
    vscode6.commands.registerCommand("ollama-assistant.showOutput", () => {
      outputPanelProvider.createPanel("Ollama Output");
    })
  );
  context.subscriptions.push(
    vscode6.commands.registerCommand("ollama-assistant.openChat", () => {
      vscode6.commands.executeCommand("ollama-assistant.chatView.focus");
    })
  );
  context.subscriptions.push(
    vscode6.commands.registerCommand("ollama-assistant.editFile", async () => {
      const currentFile = await FileService.getCurrentFile();
      if (!currentFile) {
        vscode6.window.showWarningMessage("\u274C No active file open!");
        return;
      }
      const config = vscode6.workspace.getConfiguration("ollamaAssistant");
      const model = config.get("model", "llama3");
      const panel = outputPanelProvider.createPanel("AI File Edit");
      panel.webview.html = outputPanelProvider.getLoadingHtml();
      try {
        const language = vscode6.window.activeTextEditor?.document.languageId || "javascript";
        const prompt = `You are an expert ${language} developer. 
IMPROVE this entire file. Make it cleaner, more efficient, add comments, fix bugs.
ONLY return the COMPLETE improved code (NO explanations, NO markdown):

\`\`\`${language}
${currentFile}
\`\`\``;
        let improvedCode = "";
        for await (const chunk of ollamaService.streamGenerate(model, prompt)) {
          improvedCode += chunk;
          panel.webview.html = outputPanelProvider.getContentHtml(
            "AI File Edit",
            `Improved code:

\`\`\`${language}
${improvedCode}
\`\`\``,
            false
          );
        }
        vscode6.window.showInformationMessage(
          "\u2705 AI improved your file! Apply changes?",
          "Yes, Apply",
          "No"
        ).then(async (choice) => {
          if (choice === "Yes, Apply") {
            await FileService.replaceFileContent(improvedCode);
            panel.webview.html = outputPanelProvider.getContentHtml(
              "\u2705 File Updated!",
              "Your file has been improved and saved!",
              true
            );
          }
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        panel.webview.html = outputPanelProvider.getErrorHtml(errorMsg);
      }
    })
  );
  context.subscriptions.push(
    vscode6.commands.registerCommand("ollama-assistant.explainProject", async () => {
      const panel = outputPanelProvider.createPanel("Project Analysis");
      panel.webview.html = outputPanelProvider.getLoadingHtml();
      try {
        const workspaceFiles = await FileService.getWorkspaceFiles();
        const config = vscode6.workspace.getConfiguration("ollamaAssistant");
        const model = config.get("model", "llama3");
        const prompt = `Analyze this project structure and files. Provide:
1. Project purpose
2. Main technologies used
3. Architecture overview
4. Potential improvements

Project files:
${workspaceFiles.slice(0, 3).join("\n")}...`;
        let analysis = "";
        for await (const chunk of ollamaService.streamGenerate(model, prompt)) {
          analysis += chunk;
          panel.webview.html = outputPanelProvider.getContentHtml(
            "Project Analysis",
            analysis,
            false
          );
        }
        panel.webview.html = outputPanelProvider.getContentHtml(
          "Project Analysis Complete",
          analysis,
          true
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        panel.webview.html = outputPanelProvider.getErrorHtml(errorMsg);
      }
    })
  );
  context.subscriptions.push(
    vscode6.commands.registerCommand("ollama-assistant.testFiles", async () => {
      const files = await FileService.getWorkspaceFiles();
      const currentFile = await FileService.getCurrentFile();
      vscode6.window.showInformationMessage(
        `\u{1F4C1} Found ${files.length} workspace files! 
        \u{1F4C4} Current file: ${currentFile ? "\u2705 YES" : "\u274C NO"}`
      );
    })
  );
  ollamaService.checkConnection().then((isConnected) => {
    if (!isConnected) {
      vscode6.window.showWarningMessage(
        "\u26A0\uFE0F Ollama not running. Start with: ollama serve",
        "Open Ollama"
      ).then((selection) => {
        if (selection === "Open Ollama") {
          vscode6.env.openExternal(vscode6.Uri.parse("https://ollama.ai"));
        }
      });
    }
  });
}
function deactivate() {
  console.log("Ollama Code Assistant deactivated");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
