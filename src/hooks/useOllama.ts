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
        return await sendGeminiMessage(message, context);
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
        model: 'gpt-oss:20b',
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

  const sendGeminiMessage = async (message: string, context?: string): Promise<string> => {
    const API_KEY = process.env.GEMINI_API_KEY || localStorage.getItem('gemini_api_key');
    if (!API_KEY) {
      throw new Error('Gemini API key not found. Please set GEMINI_API_KEY or add it to localStorage.');
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: getPrompt(message) + (context ? `\n\nContext (selected files):\n${context}` : '')
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error! status: ${response.status}`);
    }

    const data: GeminiResponse = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || 'No response generated';
  };

  const checkOllamaStatus = async (): Promise<boolean> => {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      return response.ok;
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
  };
}