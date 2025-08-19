import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Check, Copy, FileText, Folder, FolderOpen } from 'lucide-react';
import { useState, useMemo } from 'react';
import { CodeBlock, CodeStructBlock, TreeNode } from '@/lib/types';
import { transformCodeBlocks } from '@/lib/code-structure-block';
import { FileTreeNodeWithSelection } from './gpt-version/FileTreeNodeWithSelection';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { LivePreview } from './gpt-version/LivePreview';
import { downloadCodeAsZip } from '@/lib/code-to-zip';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}


export function parseFileStructure(text: string): TreeNode[] {
  const lines = text.split(/\r?\n/);
  const root: TreeNode[] = [];
  const stack: { node: TreeNode; level: number }[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    // Match tree-like (├──, └──, │) or indented dot notation
    const treeMatch = line.match(/^([│├└\s]*)(├──|└──)\s*(.*?)(\s*#.*)?$/);
    const dotMatch = line.match(/^(\s*)([^\/\s][^#]*?)(\/?)(\s*#.*)?$/);

    let level = 0;
    let name = "";
    let isFolder = false;
    let comment: string | undefined;

    if (treeMatch) {
      const [, prefix, , rawName, rawComment] = treeMatch;
      name = rawName.trim();
      comment = rawComment?.trim();
      level = prefix.replace(/[^│]/g, "").length;
      isFolder = name.endsWith("/");
    } else if (dotMatch) {
      const [, indent, rawName, slash, rawComment] = dotMatch;
      name = rawName.trim();
      comment = rawComment?.trim();
      level = Math.floor(indent.length / 2); // configurable: treat 2 spaces as one level
      isFolder = slash === "/";
    } else {
      continue;
    }

    if (!name) continue;

    const node: TreeNode = {
      name,
      type: isFolder ? "folder" : "file",
      expanded: level < 2,
      children: isFolder ? [] : undefined,
      comment,
    };

    if (level === 0) {
      root.push(node);
    } else {
      // Find closest parent
      let parent: TreeNode | null = null;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].level === level - 1 && stack[i].node.children) {
          parent = stack[i].node;
          break;
        }
      }
      if (parent?.children) {
        parent.children.push(node);
      }
    }

    // Update stack only for folders
    if (isFolder) {
      stack.splice(level);
      stack[level] = { node, level };
    }
  }

  return root;
}


// Parse code blocks from markdown-style text
export function parseCodeBlocks(text: string): CodeBlock[] {
  const codeBlocks: CodeBlock[] = [];
  const codeBlockRegex = /```(\w+)?(?:\s+([^\n]+))?\n([\s\S]*?)```/g;

  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {

    const [, language = "text", filename, content] = match;
    codeBlocks.push({
      language,
      filename: filename?.trim(),
      content: content.trim(),
    });
  }

  console.log('codeBlocks', codeBlocks)

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

interface PreviewPaneProps {
  messages: Message[];
  activeView: 'preview' | 'code';
  onFilesSelected?: (selectedFiles: CodeStructBlock[]) => void;
}

export function PreviewPane({ messages, activeView, onFilesSelected }: PreviewPaneProps) {
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!selectedFileContent) return;
    navigator.clipboard.writeText(selectedFileContent.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
  };

  // Parse file structure and code blocks from all assistant messages
  const { fileStructure, codeBlocks } = useMemo(() => {
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    let parsedStructure: TreeNode[] = [];
    let parsedCodeBlocks: CodeStructBlock[] = [];

    for (const message of assistantMessages) {
      const structure = parseFileStructure(message.content);
      const blocks = parseCodeBlocks(message.content);

      if (structure.length > 0) {
        parsedStructure = structure; // Use the latest structure found
      }

      parsedCodeBlocks = transformCodeBlocks(blocks)
      //parsedCodeBlocks.push(...blocks);
      console.log('NewParsedCodeBlocks', parsedCodeBlocks)
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
                { name: 'ChatInterface.tsx', type: 'file', comment: `import { useEffect, useState } from 'react';\nimport TodoList from '../components/TodoList';\nimport { fetchTodos, createTodo } from '../utils/api';\nimport styles from '../styles/Home.module.css';\n\nexport default function Home() {\n  const [todos, setTodos] = useState([]);\n  const [title, setTitle] = useState('');\n\n  useEffect(() => {\n    loadTodos();\n  }, []);\n\n  const loadTodos = async () => {\n    const data = await fetchTodos();\n    setTodos(data);\n  };\n\n  const handleAdd = async (e: React.FormEvent) => {\n    e.preventDefault();\n    if (!title.trim()) return;\n    await createTodo({ title });\n    setTitle('');\n    loadTodos();\n  };\n\n  return (\n    <div className={styles.container}>\n      <h1>Todo List</h1>\n      <form onSubmit={handleAdd}>\n        <input\n          type=\"text\"\n          value={title}\n          onChange={(e) => setTitle(e.target.value)}\n          placeholder=\"New todo\"\n          className={styles.input}\n        />\n        <button type=\"submit\" className={styles.button}>Add</button>\n      </form>\n      <TodoList todos={todos} onDelete={loadTodos} />\n    </div>\n  );\n}` },
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

  // Recursive search to find file by filename
  function findFileByName(nodes: CodeStructBlock[], filename: string): CodeStructBlock | null {
    for (const node of nodes) {
      if (node.type === 'file' && node.filename === filename) {
        return node;
      }
      if (node.type === 'folder' && node.children) {
        const found = findFileByName(node.children, filename);
        if (found) return found;
      }
    }
    return null;
  }

  // In your component
  const selectedFileContent = useMemo(() => {
    if (!selectedFile) return null;
    return findFileByName(codeBlocks, selectedFile);
  }, [selectedFile, codeBlocks]);

  // Get all files recursively for selection
  const getAllFiles = (blocks: CodeStructBlock[]): CodeStructBlock[] => {
    const files: CodeStructBlock[] = [];
    const traverse = (nodes: CodeStructBlock[]) => {
      for (const node of nodes) {
        if (node.type === 'file' && node.filename) {
          files.push(node);
        } else if (node.type === 'folder' && node.children) {
          traverse(node.children);
        }
      }
    };
    traverse(blocks);
    return files;
  };

  const allFiles = useMemo(() => getAllFiles(codeBlocks), [codeBlocks]);

  const handleFileSelection = (filename: string, selected: boolean) => {
    const newSelection = new Set(selectedFiles);
    if (selected) {
      newSelection.add(filename);
    } else {
      newSelection.delete(filename);
    }
    setSelectedFiles(newSelection);
    
    // Get selected file objects and call callback
    const selectedFileObjects = allFiles.filter(file => newSelection.has(file.filename || ''));
    onFilesSelected?.(selectedFileObjects);
  };

  const selectAllFiles = () => {
    const allFilenames = new Set(allFiles.map(f => f.filename || ''));
    setSelectedFiles(allFilenames);
    onFilesSelected?.(allFiles);
  };

  const clearSelection = () => {
    setSelectedFiles(new Set());
    onFilesSelected?.([]);
  };

  const handleFileClick = (filename: string) => {
    console.log('selectedFileContent', selectedFileContent)
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
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  {codeBlocks.length} code block{codeBlocks.length !== 1 ? 's' : ''} detected
                </p>
                <div className="flex flex-col space-y-2">
                  <div className="text-xs text-muted-foreground">Context Selection:</div>
                  <div className="flex space-x-2">
                    <button
                      onClick={selectAllFiles}
                      className="px-2 py-1 text-xs bg-primary/20 text-primary rounded hover:bg-primary/30 transition-colors"
                    >
                      Select All ({allFiles.length})
                    </button>
                    <button
                      onClick={clearSelection}
                      className="px-2 py-1 text-xs bg-destructive/20 text-destructive rounded hover:bg-destructive/30 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  {selectedFiles.size > 0 && (
                    <div className="text-xs text-ai-glow">
                      {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected for context
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
                <div className="flex justify-end p-2">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => downloadCodeAsZip(codeBlocks)}
        >
          Download All Code
        </button>
      </div>

          <ScrollArea className="flex-1 p-2">
            <div className="space-y-1">
              {codeBlocks.map((node, index) => (
                <FileTreeNodeWithSelection
                  key={node.filename + index}
                  node={node}
                  onFileClick={handleFileClick}
                  selectedFiles={selectedFiles}
                  onFileSelection={handleFileSelection}
                />
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
              <ScrollArea className="flex-1 relative">
                <div className="p-4">
                  {selectedFileContent ? (
                    <Card className="p-4 bg-message-bg border-border relative">
                      {/* Copy button */}
                      <button
                        onClick={handleCopy}
                        className="absolute top-2 left-2 p-1 rounded hover:bg-gray-200 flex items-center justify-center"
                        title={copied ? 'Copied!' : 'Copy to clipboard'}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-gray-500" />
                        )}
                      </button>

                      {/* Syntax highlighted code FULL LINE*/}
                      <SyntaxHighlighter
                        language={selectedFileContent.language || 'text'}
                        style={oneDark}
                        showLineNumbers
                        wrapLines
                        customStyle={{ margin: 0, background: 'transparent' }}
                      >
                        {selectedFileContent.content || ''}
                      </SyntaxHighlighter>


                      {/* Syntax highlighted code BREAKING LINE*/}
                      {/* <SyntaxHighlighter
  language={selectedFileContent.language || 'text'}
  style={oneDark}
  showLineNumbers
  wrapLines
  lineProps={{ style: { wordBreak: 'break-word', whiteSpace: 'pre-wrap' } }}
  customStyle={{
    margin: 0,
    background: 'transparent',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-wrap', // ensures long lines wrap
  }}
>
  {selectedFileContent.content || ''}
</SyntaxHighlighter> */}
                    </Card>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No content found for {selectedFileContent?.filename || 'file'}
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
  } else {
    return (
     
        <div className="p-8">
                <LivePreview
            entry={selectedFileContent?.filename || ''}
            modules={codeBlocks
              .filter(block => block.language === 'jsx' || block.language === 'tsx')
              .map(block => ({ filename: block.filename || '', content: block.content }))}
          />
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