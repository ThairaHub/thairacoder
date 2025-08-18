import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { FileText, Folder, FolderOpen } from 'lucide-react';
import { useState } from 'react';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface PreviewPaneProps {
  messages: Message[];
  activeView: 'preview' | 'code';
}

const mockFileStructure = [
  {
    name: 'src',
    type: 'folder',
    expanded: true,
    children: [
      {
        name: 'components',
        type: 'folder',
        expanded: true,
        children: [
          { name: 'ChatInterface.tsx', type: 'file' },
          { name: 'ChatMessage.tsx', type: 'file' },
          { name: 'PreviewPane.tsx', type: 'file' },
        ]
      },
      {
        name: 'hooks',
        type: 'folder',
        expanded: false,
        children: [
          { name: 'useOllama.ts', type: 'file' },
        ]
      },
      { name: 'App.tsx', type: 'file' },
      { name: 'index.css', type: 'file' },
    ]
  }
];

function FileTreeNode({ node, level = 0 }: { node: any; level?: number }) {
  const [isExpanded, setIsExpanded] = useState(node.expanded || false);
  
  return (
    <div>
      <div 
        className="flex items-center space-x-2 py-1 px-2 hover:bg-message-bg/50 rounded cursor-pointer group"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => node.type === 'folder' && setIsExpanded(!isExpanded)}
      >
        {node.type === 'folder' ? (
          isExpanded ? <FolderOpen className="h-4 w-4 text-ai-glow" /> : <Folder className="h-4 w-4 text-muted-foreground" />
        ) : (
          <FileText className="h-4 w-4 text-blue-400" />
        )}
        <span className="text-sm text-foreground/90 group-hover:text-foreground transition-colors">
          {node.name}
        </span>
      </div>
      
      {node.type === 'folder' && isExpanded && node.children && (
        <div>
          {node.children.map((child: any, index: number) => (
            <FileTreeNode key={index} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PreviewPane({ messages, activeView }: PreviewPaneProps) {
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
  
  if (activeView === 'code') {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground/90 mb-2">Project Structure</h3>
        </div>
        
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {mockFileStructure.map((node, index) => (
              <FileTreeNode key={index} node={node} />
            ))}
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t border-border">
          <Card className="p-3 bg-message-bg border-border">
            <div className="flex items-center space-x-2 mb-2">
              <div className="h-2 w-2 bg-green-500 rounded-full" />
              <span className="text-xs text-muted-foreground">Connected to Ollama</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Ready to generate and preview code
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-8">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-ai-glow to-ai-glow-soft rounded-2xl flex items-center justify-center shadow-glow">
              <FileText className="h-10 w-10 text-background" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-ai-glow to-ai-glow-soft bg-clip-text text-transparent">
              AI Code Assistant
            </h1>
            <p className="text-muted-foreground text-lg">
              Your local development companion powered by Ollama
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-6 bg-message-bg border-border hover:border-ai-glow/30 transition-colors">
              <div className="text-ai-glow mb-2">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="font-semibold mb-2">Code Generation</h3>
              <p className="text-sm text-muted-foreground">
                Generate React components, hooks, and utilities with AI assistance
              </p>
            </Card>
            
            <Card className="p-6 bg-message-bg border-border hover:border-ai-glow/30 transition-colors">
              <div className="text-ai-glow mb-2">
                <Folder className="h-6 w-6" />
              </div>
              <h3 className="font-semibold mb-2">Project Structure</h3>
              <p className="text-sm text-muted-foreground">
                Visualize and navigate your project structure in real-time
              </p>
            </Card>
          </div>

          {/* Latest Output */}
          {lastAssistantMessage && (
            <Card className="p-6 bg-message-bg border-border">
              <h3 className="font-semibold mb-4 flex items-center">
                <div className="h-2 w-2 bg-ai-glow rounded-full mr-2 animate-pulse" />
                Latest AI Response
              </h3>
              <div className="bg-background/30 rounded-lg p-4 border border-border/50">
                <pre className="whitespace-pre-wrap text-sm text-foreground/80 font-mono">
                  {lastAssistantMessage.content}
                </pre>
              </div>
            </Card>
          )}

          {/* Getting Started */}
          <Card className="p-6 bg-gradient-to-br from-message-bg to-message-bg/50 border-ai-glow/20">
            <h3 className="font-semibold mb-3 text-ai-glow">Getting Started</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Ask me to create React components or utilities</p>
              <p>• Request code explanations and improvements</p>
              <p>• Generate project documentation</p>
              <p>• Build full-stack applications</p>
            </div>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}