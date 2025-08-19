import { useState } from 'react';

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export function useOllama() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const sendMessage = async (message: string): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-oss:20b', // Default model - can be configured
          prompt: getPrompt(message),
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: OllamaResponse = await response.json();
      return data.response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
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
  };
}