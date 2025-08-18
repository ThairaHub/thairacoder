import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { FileText, Folder, FolderOpen } from 'lucide-react';
import { useState, useMemo } from 'react';

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

interface TreeNode {
  name: string;
  type: 'file' | 'folder';
  expanded?: boolean;
  children?: TreeNode[];
}

interface CodeBlock {
  language: string;
  filename?: string;
  content: string;
}

// Parse file tree structure from text
function parseFileStructure(text: string): TreeNode[] {
  const lines = text.split('\n');
  const root: TreeNode[] = [];
  const stack: { node: TreeNode; level: number }[] = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Match various tree patterns: ├──, └──, │, or simple dot notation
    const treeMatch = line.match(/^([│├└\s]*)(├──|└──)\s*(.*?)(\s*#.*)?$/);
    const dotMatch = line.match(/^(\s*)(\.|\w+[\/]?)\s*(.*?)(\s*#.*)?$/);
    
    let level = 0;
    let name = '';
    let isFolder = false;
    
    if (treeMatch) {
      const prefix = treeMatch[1] + treeMatch[2];
      name = treeMatch[3].trim();
      level = Math.floor((prefix.match(/[│├└]/g) || []).length);
      isFolder = name.endsWith('/') || name.includes('/');
    } else if (dotMatch && dotMatch[2] !== '.') {
      // Skip lines that start with just a dot
      const indent = dotMatch[1];
      name = dotMatch[2] + (dotMatch[3] || '');
      level = Math.floor(indent.length / 4); // Assume 4-space indentation
      isFolder = name.endsWith('/');
    } else {
      continue;
    }
    
    if (!name) continue;
    
    // Clean up name
    const cleanName = name.replace(/\/$/, '').replace(/^\.\//, '');
    
    const node: TreeNode = {
      name: cleanName,
      type: isFolder ? 'folder' : 'file',
      expanded: level < 2,
      children: isFolder ? [] : undefined
    };
    
    // Add to appropriate parent
    if (level === 0) {
      root.push(node);
    } else {
      // Find the correct parent
      let parent = null;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].level === level - 1 && stack[i].node.children) {
          parent = stack[i].node;
          break;
        }
      }
      if (parent && parent.children) {
        parent.children.push(node);
      }
    }
    
    // Update stack
    if (isFolder) {
      // Trim stack to current level and add this folder
      stack.splice(level);
      stack[level] = { node, level };
    }
  }
  
  return root;
}

// Parse code blocks from markdown-style text
function parseCodeBlocks(text: string): CodeBlock[] {
  const codeBlocks: CodeBlock[] = [];
  const codeBlockRegex = /```(\w+)?\s*(?:\n# (.+?))?\n([\s\S]*?)```/g;
  
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      filename: match[2],
      content: match[3].trim()
    });
  }
  
  return codeBlocks;
}

function FileTreeNode({ node, level = 0, onFileClick }: { node: any; level?: number; onFileClick?: (filename: string) => void }) {
  const [isExpanded, setIsExpanded] = useState(node.expanded || false);
  
  const handleClick = () => {
    if (node.type === 'folder') {
      setIsExpanded(!isExpanded);
    } else {
      onFileClick?.(node.name);
    }
  };
  
  return (
    <div>
      <div 
        className="flex items-center space-x-2 py-1 px-2 hover:bg-message-bg/50 rounded cursor-pointer group"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
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
            <FileTreeNode key={index} node={child} level={level + 1} onFileClick={onFileClick} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PreviewPane({ messages, activeView }: PreviewPaneProps) {
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  
  // Parse file structure and code blocks from all assistant messages
  const { fileStructure, codeBlocks } = useMemo(() => {
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    let parsedStructure: TreeNode[] = [];
    let parsedCodeBlocks: CodeBlock[] = [];
    
    for (const message of assistantMessages) {
      const structure = parseFileStructure(message.content);
      const blocks = parseCodeBlocks(message.content);
      
      if (structure.length > 0) {
        parsedStructure = structure; // Use the latest structure found
      }
      parsedCodeBlocks.push(...blocks);
    }
    
    // Only use fallback if no structure was parsed at all
    if (parsedStructure.length === 0 && parsedCodeBlocks.length === 0) {
      parsedStructure = [
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
    }
    
    return { fileStructure: parsedStructure, codeBlocks: parsedCodeBlocks };
  }, [messages]);

  // Find content for selected file
  const selectedFileContent = useMemo(() => {
    if (!selectedFile) return null;
    return codeBlocks.find(block => 
      block.filename === selectedFile || 
      block.filename?.endsWith(selectedFile) ||
      selectedFile.endsWith(block.filename || '')
    );
  }, [selectedFile, codeBlocks]);

  const handleFileClick = (filename: string) => {
    setSelectedFile(filename);
  };
  
  if (activeView === 'code') {
    return (
      <div className="h-full flex">
        {/* File Tree */}
        <div className="w-80 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground/90 mb-2">Project Structure</h3>
            {codeBlocks.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {codeBlocks.length} code block{codeBlocks.length !== 1 ? 's' : ''} detected
              </p>
            )}
          </div>
          
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-1">
              {fileStructure.map((node, index) => (
                <FileTreeNode key={index} node={node} onFileClick={handleFileClick} />
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

        {/* File Content Viewer */}
        <div className="flex-1 flex flex-col">
          {selectedFile ? (
            <>
              <div className="p-4 border-b border-border">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-ai-glow" />
                  <span className="text-sm font-semibold text-foreground/90">{selectedFile}</span>
                  {selectedFileContent && (
                    <span className="text-xs text-muted-foreground">({selectedFileContent.language})</span>
                  )}
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4">
                  {selectedFileContent ? (
                    <Card className="p-4 bg-message-bg border-border">
                      <pre className="text-sm font-mono text-foreground/90 whitespace-pre-wrap">
                        {selectedFileContent.content}
                      </pre>
                    </Card>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No content found for {selectedFile}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Select a file to view its content</p>
              </div>
            </div>
          )}
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