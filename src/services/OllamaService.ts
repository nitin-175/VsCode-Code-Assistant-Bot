import * as vscode from 'vscode';

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

interface StreamChunk {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatStreamChunk {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export class OllamaService {
  private baseUrl: string;

  constructor() {
    const config = vscode.workspace.getConfiguration('ollamaAssistant');
    this.baseUrl = config.get<string>('baseUrl', 'http://localhost:11434');
  }

  /**
   * Check if Ollama is running
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const data = (await response.json()) as { models: OllamaModel[] };
      return data.models.map((m) => m.name);
    } catch (error) {
      console.error('Error fetching models:', error);
      return [];
    }
  }

  /**
   * Stream completion for single prompt
   */
  async *streamGenerate(model: string, prompt: string): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter((line: string) => line.trim());

      for (const line of lines) {
        try {
          const json = JSON.parse(line) as StreamChunk;
          if (json.response) {
            yield json.response;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  /**
   * Stream chat completion with conversation history
   */
  async *streamChat(
    model: string,
    messages: ChatMessage[]
  ): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter((line: string) => line.trim());

      for (const line of lines) {
        try {
          const json = JSON.parse(line) as ChatStreamChunk;
          if (json.message?.content) {
            yield json.message.content;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  /**
   * Non-streaming generate (for simple use cases)
   */
  async generate(model: string, prompt: string): Promise<string> {
    let fullResponse = '';
    for await (const chunk of this.streamGenerate(model, prompt)) {
      fullResponse += chunk;
    }
    return fullResponse;
  }
}
