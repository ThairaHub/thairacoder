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

  /**
   * Analyzes the request to determine its type and scope
   */
  const analyzeRequest = (request: string, context?: string) => {
    const lowerRequest = request.toLowerCase();
    
    // Determine request type
    const isBugFix = /fix|bug|error|issue|problem|broken|not working/i.test(request);
    const isRefactor = /refactor|improve|optimize|clean|reorganize/i.test(request);
    const isFeature = /add|create|implement|new feature|build/i.test(request);
    const isModification = /change|update|modify|edit|adjust/i.test(request);
    
    // Determine scope
    const isSingleFile = /this file|current file|single file/i.test(request) || 
                        (context && context.split('File:').length === 2);
    const hasExistingStructure = !!context && context.length > 0;
    
    return {
      type: isBugFix ? 'bugfix' : 
            isRefactor ? 'refactor' : 
            isFeature ? 'feature' : 
            isModification ? 'modification' : 
            'general',
      isSingleFile,
      hasExistingStructure
    };
  };

  /**
   * Generates a context-aware prompt based on the request type and existing code
   */
  const getPrompt = (request: string, context?: string): string => {
    const analysis = analyzeRequest(request, context);
    
    let basePrompt = `You are an expert developer. You will receive requests to generate, modify, or fix code. Always respond with **only code and file structures**—no explanations unless fixing bugs (then add brief inline comments for fixes).

### Core Rules:
1. Every code block must be enclosed in triple backticks and the **file name and extension** must be the first line inside triple backticks.
2. Directory structures must be shown inside a \`txt\` block with tree formatting.
3. Keep responses focused and minimal—only include what's necessary for the request.
4. For multi-file projects, show directory structure first, then each file.
5. Never generate one line result with only a file name, examples:
Wrong way:(
\`\`\`python
main.py
\`\`\`

\`\`\`javascript
frontend/pages/index.js
\`\`\`
  )

Right way: (
\`\`\`javascript
// frontend/pages/index.js
import TodoList from '../components/TodoList';

export default function Home() {
  return (
    <div>
      <h1>Todo List</h1>
      <TodoList />
    </div>
  );
}
\`\`\`
  )
`;


    // Add context-specific instructions
    if (analysis.hasExistingStructure) {
      basePrompt += `\n\n### Existing Code Context:
- You have access to existing code structure. Maintain consistency with current patterns.
- Preserve file organization and naming conventions from the existing codebase.
- When modifying files, show only the complete updated file content.`;
    }

    if (analysis.type === 'bugfix') {
      basePrompt += `\n\n### Bug Fix Instructions:
- Identify and fix the issue in the code.
- Add brief inline comments (// FIX: ...) to explain what was fixed.
- Ensure the fix doesn't break existing functionality.
- If multiple files are affected, show all necessary changes.`;
    } else if (analysis.type === 'refactor') {
      basePrompt += `\n\n### Refactoring Instructions:
- Improve code structure while maintaining functionality.
- Follow best practices and design patterns.
- Consider performance, readability, and maintainability.
- Break down large files into smaller, focused components when appropriate.`;
    } else if (analysis.type === 'feature') {
      basePrompt += `\n\n### Feature Implementation:
- Implement the requested feature completely.
- Follow existing code patterns and conventions.
- Include all necessary files (components, hooks, utilities, etc.).
- Ensure proper integration with existing code.`;
    } else if (analysis.type === 'modification') {
      basePrompt += `\n\n### Modification Instructions:
- Make the requested changes precisely.
- Maintain backward compatibility when possible.
- Show the complete updated file(s) with changes applied.`;
    }

    if (analysis.isSingleFile) {
      basePrompt += `\n\n### Single File Focus:
- This request is for a single file modification.
- Provide the complete updated file content.
- Maintain imports and exports properly.`;
    } else {
      basePrompt += `\n\n### Multi-File Project:
- Show directory structure first if creating new files.
- Organize files logically by feature/component.
- Ensure proper imports between files.`;
    }

    // Add request and context
    basePrompt += `\n\n### Request: ${request}`;
    
    if (context) {
      basePrompt += `\n\n### Existing Code Context:\n${context}`;
    }

    return basePrompt;
  }

  const sendMessage = async (
    message: string,
    context?: string,
    onStreamUpdate?: (chunk: string) => void,
    apiKey?: string
  ): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      if (provider === 'gemini') {
        return await sendGeminiMessage(message, context, onStreamUpdate, apiKey);
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
        prompt: getPrompt(message, context),
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
  onStreamUpdate?: (chunk: string) => void,
  apiKey?: string
): Promise<string> => {
  const url = onStreamUpdate
    ? "http://localhost:8000/gemini/stream"
    : "http://localhost:8000/gemini/generate";

  
  const prompt = getPrompt(message, context) 

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, apiKey }),
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




  const checkOllamaStatus = async (): Promise<{ models: any[] } | false> => {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        const data = await response.json();
        // Ensure models property exists and is an array
        return {
          models: Array.isArray(data.models) ? data.models : []
        };
      }
      return { models: [] };
    } catch {
      return { models: [] };
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
