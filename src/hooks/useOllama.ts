import { Model } from '@/lib/types';
import { useState } from 'react';

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

type Provider = 'ollama' | 'gemini';

export function useOllama() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider>('ollama');
  const [model, setModel] = useState<string>('gemma3:4b')

  const codeGenPrompt = `
    You are a developer. You will only receive requests to generate pieces of code or project scaffolding. Always respond with **only code and file structures**—no explanations, no extra text.  

    ### Formatting Rules:
    1. Every code block must be enclosed in triple backticks followed by the correct **file name and extension**.  
      - Example:  
        \`\`\`tsx
        // frontend/pages/index.tsx
        export default function Home() { return <h1>Hello</h1> }
        \`\`\`  
    2. Directory structures must be shown inside a \`txt\` block with tree formatting.  
      - Example:  
        \`\`\`txt
        app/
        ├─ backend/
        │  └─ main.py
        └─ frontend/
            └─ index.tsx
        \`\`\`  
    3. Do not include any prose, explanations, or instructions in the output—only the structured code and files.  
    4. If multiple files are required, list the **directory structure first**, then provide each file in its own properly labeled code block.  
    5. If the request implies configuration or environment files (\`.env\`, \`package.json\`, etc.), include them following the same rules.  
    ` as const;

  /**
   * Helper function to build the full AI prompt with the user’s request.
   */
  const getPrompt = (request: string): string => {
    return `${codeGenPrompt}\n\nHere is the request: ${request}`;
  }

  const sendMessage = async (
    message: string,
    context?: string,
    onStreamUpdate?: (chunk: string) => void
  ): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      if (provider === 'gemini') {
        return await sendGeminiMessage(message, context, onStreamUpdate);
      } else {
        return await sendOllamaMessage(message, context, onStreamUpdate);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const sendOllamaMessage = async (
    message: string,
    context?: string,
    onStreamUpdate?: (chunk: string) => void
  ): Promise<string> => {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: getPrompt(message) + (context ? `\n\nContext (selected files):\n${context}` : ''),
        stream: !!onStreamUpdate,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (onStreamUpdate && response.body) {
      let fullResponse = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const data: OllamaResponse = JSON.parse(line);
              if (data.response) {
                fullResponse += data.response;
                onStreamUpdate(data.response);
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return fullResponse;
    } else {
      const data: OllamaResponse = await response.json();
      return data.response;
    }
  };

const sendGeminiMessage = async (
  message: string,
  context?: string,
  onStreamUpdate?: (chunk: string) => void
): Promise<string> => {
  const url = onStreamUpdate
    ? "http://localhost:8000/gemini/stream"
    : "http://localhost:8000/gemini/generate";

  
  const prompt = getPrompt(message) + (context ? `\n\nContext (selected files):\n${context}` : '') 

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) throw new Error(`HTTP error! ${response.status}`);

  if (onStreamUpdate && response.body) {
    console.log('entrei stream')
    let full = "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((l) => l.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.response) {
            full += data.response;
            onStreamUpdate(data.response);
            console.log(data.response)
          }
        } catch {
          // skip invalid JSON
        }
      }
    }
    return full;
  }

  const data = await response.json();
  return data.response;
};




  const checkOllamaStatus = async (): Promise<any> => {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        return response.json();
      }
    } catch {
      return false;
    }
  };

  return {
    sendMessage,
    checkOllamaStatus,
    isLoading,
    error,
    provider,
    setProvider,
    model,
    setModel
  };
}