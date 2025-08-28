"use client"

import type React from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Check, Copy, FileText, X, ChevronDown } from "lucide-react"
import { useState, useMemo, useEffect } from "react"
import type { CodeBlock, CodeStructBlock, TreeNode } from "@/lib/types"
import { transformCodeBlocks } from "@/lib/code-structure-block"
import { mergeCodeStructBlocks, getAllFilesFromBlocks } from "@/lib/code-structure-merge"
import { FileTreeNodeWithSelection } from "./gpt-version/FileTreeNodeWithSelection"
import type { Language } from "prism-react-renderer"
import { CodeViewer } from "./gpt-version/CodeViewer"
import { LivePreview } from "./gpt-version/LivePreview"
import { downloadCodeAsZip } from "@/lib/code-to-zip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

export function parseFileStructure(text: string): TreeNode[] {
  const filteredText = text.replace(/<(?:thinking|think)[\s\S]*?<\/(?:thinking|think)>/gi, "")

  const lines = filteredText.split(/\r?\n/)
  const root: TreeNode[] = []
  const stack: { node: TreeNode; level: number }[] = []

  for (const line of lines) {
    if (!line.trim()) continue

    // Match tree-like (├──, └──, │) or indented dot notation
    const treeMatch = line.match(/^([│├└\s]*)(├──|└──)\s*(.*?)(\s*#.*)?$/)
    const dotMatch = line.match(/^(\s*)([^/\s][^#]*?)(\/?)(\s*#.*)?$/)

    let level = 0
    let name = ""
    let isFolder = false
    let comment: string | undefined

    if (treeMatch) {
      const [, prefix, , rawName, rawComment] = treeMatch
      name = rawName.trim()
      comment = rawComment?.trim()
      level = prefix.replace(/[^│]/g, "").length
      isFolder = name.endsWith("/")
    } else if (dotMatch) {
      const [, indent, rawName, slash, rawComment] = dotMatch
      name = rawName.trim()
      comment = rawComment?.trim()
      level = Math.floor(indent.length / 2) // configurable: treat 2 spaces as one level
      isFolder = slash === "/"
    } else {
      continue
    }

    if (!name) continue

    const node: TreeNode = {
      name,
      type: isFolder ? "folder" : "file",
      expanded: level < 2,
      children: isFolder ? [] : undefined,
      comment,
    }

    if (level === 0) {
      root.push(node)
    } else {
      // Find closest parent
      let parent: TreeNode | null = null
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]?.level === level - 1 && stack[i]?.node.children) {
          parent = stack[i].node
          break
        }
      }
      if (parent?.children) {
        parent.children.push(node)
      }
    }

    // Update stack only for folders
    if (isFolder) {
      stack.splice(level)
      stack[level] = { node, level }
    }
  }

  return root
}

// Parse code blocks from markdown-style text
export function parseCodeBlocks(text: string): CodeBlock[] {
  const codeBlocks: CodeBlock[] = []
  const codeBlockRegex = /```(\w+)?(?:\s+([^\n]+))?\n([\s\S]*?)```/g

  let match
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const [, language = "text", filename, content] = match
    codeBlocks.push({
      language,
      filename: filename?.trim(),
      content: content.trim(),
    })
  }

  return codeBlocks
}

interface CodeVersion {
  id: string
  name: string
  codeBlocks: CodeStructBlock[]
  timestamp: Date
}

interface PreviewPaneProps {
  messages: Message[]
  activeView: "preview" | "code"
  provider: string
  onFilesSelected?: (selectedFiles: CodeStructBlock[]) => void
}

export function PreviewPane({ messages, activeView, provider, onFilesSelected }: PreviewPaneProps) {
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant")
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const [openTabs, setOpenTabs] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [codeBlocks, setCodeBlocks] = useState<CodeStructBlock[]>([])
  const [versions, setVersions] = useState<CodeVersion[]>([])
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null)

  const handleCopy = () => {
    if (!activeTabContent) return
    navigator.clipboard.writeText(activeTabContent.content || "")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000) // Reset after 2 seconds
  }

  // Parse file structure from all assistant messages and create versions
  const fileStructure = useMemo(() => {
    const assistantMessages = messages.filter((m) => m.role === "assistant")
    let parsedStructure: TreeNode[] = []
    const newVersions: CodeVersion[] = []
    let accumulatedCodeBlocks: CodeStructBlock[] = []

    // Create versions for each assistant message that contains code
    for (let i = 0; i < assistantMessages.length; i++) {
      const message = assistantMessages[i]
      const structure = parseFileStructure(message.content)
      const blocks = parseCodeBlocks(message.content)
      const transformedBlocks = transformCodeBlocks(blocks)

      if (structure.length > 0) {
        parsedStructure = structure // Use the latest structure found
      }

      // Only create a version if there are code blocks
      if (transformedBlocks.length > 0) {
        // Merge new blocks with accumulated blocks (preserving existing files, updating changed ones)
        accumulatedCodeBlocks = mergeCodeStructBlocks(accumulatedCodeBlocks, transformedBlocks)

        const versionId = `v${i + 1}-${message.timestamp.getTime()}`
        newVersions.push({
          id: versionId,
          name: `Version ${i + 1}`,
          codeBlocks: [...accumulatedCodeBlocks], // Create a copy to avoid reference issues
          timestamp: message.timestamp,
        })
      }
    }

    // Update versions state
    setVersions(newVersions)

    // Set active version to the latest one if not already set
    if (newVersions.length > 0 && (!activeVersionId || !newVersions.find((v) => v.id === activeVersionId))) {
      const latestVersion = newVersions[newVersions.length - 1]
      setActiveVersionId(latestVersion.id)
      setCodeBlocks(latestVersion.codeBlocks)
    }

    // Only use fallback if no structure was parsed at all
    if (parsedStructure.length === 0 && newVersions.length === 0) {
      parsedStructure = [
        {
          name: "src",
          type: "folder",
          expanded: true,
          children: [
            {
              name: "components",
              type: "folder",
              expanded: true,
              children: [
                {
                  name: "ChatInterface.tsx",
                  type: "file",
                  comment: `import { useEffect, useState } from 'react';\nimport TodoList from '../components/TodoList';\nimport { fetchTodos, createTodo } from '../utils/api';\nimport styles from '../styles/Home.module.css';\n\nexport default function Home() {\n  const [todos, setTodos] = useState([]);\n  const [title, setTitle] = useState('');\n\n  useEffect(() => {\n    loadTodos();\n  }, []);\n\n  const loadTodos = async () => {\n    const data = await fetchTodos();\n    setTodos(data);\n  };\n\n  const handleAdd = async (e: React.FormEvent) => {\n    e.preventDefault();\n    if (!title.trim()) return;\n    await createTodo({ title });\n    setTitle('');\n    loadTodos();\n  };\n\n  return (\n    <div className={styles.container}>\n      <h1>Todo List</h1>\n      <form onSubmit={handleAdd}>\n        <input\n          type=\"text\"\n          value={title}\n          onChange={(e) => setTitle(e.target.value)}\n          placeholder=\"New todo\"\n          className={styles.input}\n        />\n        <button type=\"submit\" className={styles.button}>Add</button>\n      </form>\n      <TODOList todos={todos} onDelete={loadTodos} />\n    </div>\n  );\n}`,
                },
                { name: "ChatMessage.tsx", type: "file" },
                { name: "PreviewPane.tsx", type: "file" },
              ],
            },
            {
              name: "hooks",
              type: "folder",
              expanded: false,
              children: [{ name: "useOllama.ts", type: "file" }],
            },
            { name: "App.tsx", type: "file" },
            { name: "index.css", type: "file" },
          ],
        },
      ]
    }

    return parsedStructure
  }, [messages, activeVersionId])

  // Effect to update code blocks when active version changes
  useEffect(() => {
    if (activeVersionId) {
      const activeVersion = versions.find((v) => v.id === activeVersionId)
      if (activeVersion) {
        setCodeBlocks(activeVersion.codeBlocks)
        // Close tabs that don't exist in the new version
        const allFileNames = getAllFilesFromBlocks(activeVersion.codeBlocks).map((f) => f.filename || "")
        setOpenTabs((prev) => prev.filter((tab) => allFileNames.includes(tab)))
        if (activeTab && !allFileNames.includes(activeTab)) {
          setActiveTab(null)
        }
      }
    }
  }, [activeVersionId, versions, activeTab])

  const handleVersionChange = (versionId: string) => {
    setActiveVersionId(versionId)
  }

  // Recursive search to find file by filename
  function findFileByName(nodes: CodeStructBlock[], filename: string): CodeStructBlock | null {
    for (const node of nodes) {
      if (node.type === "file" && node.filename === filename) {
        return node
      }
      if (node.type === "folder" && node.children) {
        const found = findFileByName(node.children, filename)
        if (found) return found
      }
    }
    return null
  }

  // Get active tab content
  const activeTabContent = useMemo(() => {
    if (!activeTab) return null
    return findFileByName(codeBlocks, activeTab)
  }, [activeTab, codeBlocks])

  const allFiles = useMemo(() => getAllFilesFromBlocks(codeBlocks), [codeBlocks])

  // Function to recursively update code blocks
  const updateCodeBlock = (filename: string, newContent: string) => {
    const updateCodeBlocks = (blocks: CodeStructBlock[]): CodeStructBlock[] => {
      return blocks.map((block) => {
        if (block.type === "file" && block.filename === filename) {
          return { ...block, content: newContent }
        } else if (block.type === "folder" && block.children) {
          return { ...block, children: updateCodeBlocks(block.children) }
        }
        return block
      })
    }

    // Update the current codeBlocks
    const updatedBlocks = updateCodeBlocks(codeBlocks)
    setCodeBlocks(updatedBlocks)

    // Also update the version's codeBlocks to persist changes
    if (activeVersionId) {
      setVersions((prevVersions) =>
        prevVersions.map((version) =>
          version.id === activeVersionId ? { ...version, codeBlocks: updatedBlocks } : version,
        ),
      )
    }
  }

  const handleFileSelection = (filename: string, selected: boolean) => {
    const newSelection = new Set(selectedFiles)
    if (selected) {
      newSelection.add(filename)
    } else {
      newSelection.delete(filename)
    }
    setSelectedFiles(newSelection)

    // Get selected file objects and call callback
    const selectedFileObjects = allFiles.filter((file) => newSelection.has(file.filename || ""))
    onFilesSelected?.(selectedFileObjects)
  }

  const selectAllFiles = () => {
    const allFilenames = new Set(allFiles.map((f) => f.filename || ""))
    setSelectedFiles(allFilenames)
    onFilesSelected?.(allFiles)
  }

  const clearSelection = () => {
    setSelectedFiles(new Set())
    onFilesSelected?.([])
  }

  const handleFileClick = (filename: string) => {
    // Add to tabs if not already open
    if (!openTabs.includes(filename)) {
      setOpenTabs((prev) => [...prev, filename])
    }
    // Set as active tab
    setActiveTab(filename)
    setSelectedFile(filename)
  }

  const closeTab = (filename: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setOpenTabs((prev) => prev.filter((tab) => tab !== filename))

    // If closing active tab, switch to another tab or set to null
    if (activeTab === filename) {
      const remainingTabs = openTabs.filter((tab) => tab !== filename)
      const newActiveTab = remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1] : null
      setActiveTab(newActiveTab)
      setSelectedFile(newActiveTab)
    }
  }

  if (activeView === "code") {
    return (
      <div className="flex h-full bg-background">
        {/* File Tree */}
        <div className="w-80 border-r border-border flex flex-col h-full">
          <div className="p-4 border-b border-border flex-shrink-0">
            <h3 className="text-sm font-semibold text-foreground/90 mb-2">Project Structure</h3>
            {codeBlocks.length > 0 && (
              <>
                <p className="text-[10px] text-muted-foreground mb-2">
                  {codeBlocks.length} code block{codeBlocks.length !== 1 ? "s" : ""} detected
                </p>
                <div className="flex flex-col space-y-1">
                  <div className="text-[10px] text-muted-foreground">Context Selection:</div>
                  <div className="flex space-x-1">
                    <button
                      onClick={selectAllFiles}
                      className="px-1.5 py-0.5 text-[10px] bg-primary/20 text-white/80 rounded hover:bg-primary/30 transition-colors"
                    >
                      Select All ({allFiles.length})
                    </button>
                    <button
                      onClick={clearSelection}
                      className="px-1.5 py-0.5 text-[10px] bg-destructive/20 text-destructive rounded hover:bg-destructive/30 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  {selectedFiles.size > 0 && (
                    <div className="text-[10px] text-ai-glow">
                      {selectedFiles.size} file{selectedFiles.size !== 1 ? "s" : ""} selected
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col space-y-1 p-2 flex-shrink-0">
            <button
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={() => downloadCodeAsZip(allFiles)}
            >
              Download All Code
            </button>

            {versions.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 flex items-center justify-between">
                    <span className="text-[10px]">
                      {versions.find((v) => v.id === activeVersionId)?.name || "Select Version"}
                    </span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40 bg-background border border-border">
                  {versions.map((version) => (
                    <DropdownMenuItem
                      key={version.id}
                      onClick={() => handleVersionChange(version.id)}
                      className={`cursor-pointer hover:bg-secondary/80 ${
                        activeVersionId === version.id ? "bg-secondary text-secondary-foreground" : ""
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{version.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {version.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <ScrollArea className="flex-1 min-h-0 p-2">
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

          <div className="p-2 border-t border-border flex-shrink-0 mt-auto">
            <Card className="p-2 bg-message-bg border-border">
              <div className="flex items-center space-x-1 mb-1">
                <div className="h-1.5 w-1.5 bg-green-500 rounded-full" />
                <span className="text-[10px] text-muted-foreground">
                  Connected to {provider === "ollama" ? "Ollama" : "Gemini"}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground">Ready to generate and preview code</div>
            </Card>
          </div>
        </div>

        {/* File Content Viewer with Tabs */}
        <div className="flex-1 flex flex-col">
          {openTabs.length > 0 ? (
            <>
              {/* Tab Bar */}
              <div className="border-b border-border bg-background">
                <div className="flex items-center overflow-x-auto scrollbar-hide">
                  {openTabs.map((tabFile) => (
                    <div
                      key={tabFile}
                      className={`flex items-center px-3 py-2 border-r border-border cursor-pointer min-w-0 flex-shrink-0 ${
                        activeTab === tabFile
                          ? "bg-message-bg text-foreground"
                          : "bg-background hover:bg-message-bg/50 text-muted-foreground"
                      }`}
                      onClick={() => setActiveTab(tabFile)}
                    >
                      <FileText className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="text-[10px] truncate max-w-[100px]" title={tabFile}>
                        {tabFile}
                      </span>
                      <button
                        onClick={(e) => closeTab(tabFile, e)}
                        className="ml-1 p-0.5 rounded hover:bg-background/50 flex-shrink-0"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Tab Content */}
              {activeTab && (
                <div className="flex-1 relative">
                  <div className="p-4">
                    {activeTabContent ? (
                      <Card className="p-4 bg-message-bg border-border relative">
                        {/* Copy button */}
                        <button
                          onClick={handleCopy}
                          className="absolute top-2 left-2 p-1 rounded hover:bg-gray-200 flex items-center justify-center z-10"
                          title={copied ? "Copied!" : "Copy to clipboard"}
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4 text-gray-500" />
                          )}
                        </button>

                        {/* File info */}
                        <div className="mb-4 pt-8">
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4 text-ai-glow" />
                            <span className="text-sm font-semibold text-foreground/90">{activeTab}</span>
                            <span className="text-xs text-muted-foreground">({activeTabContent.language})</span>
                          </div>
                        </div>

                        {/* Code viewer with edit capability */}
                        <div style={{ overflow: "hidden" }}>
                          <CodeViewer
                            key={activeTab}
                            code={activeTabContent.content || ""}
                            language={(activeTabContent.language as Language) || "text"}
                            filename={activeTab}
                            onSave={(newCode) => {
                              if (activeTab) {
                                updateCodeBlock(activeTab, newCode)
                              }
                            }}
                          />
                        </div>
                      </Card>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No content found for {activeTab}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Select a file to open it in a tab</p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  } else {
    return (
      <div className="p-4 h-full">
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Live Preview</h3>
          <p className="text-sm text-muted-foreground mb-4">Preview of React/JSX components from your generated code</p>
        </div>

        {codeBlocks.length > 0 ? (
          <div className="h-[calc(100%-120px)] border rounded-lg overflow-hidden">
            <LivePreview
              entry={
                activeTabContent?.filename ||
                codeBlocks.find((b) => b.language === "jsx" || b.language === "tsx")?.filename ||
                ""
              }
              modules={codeBlocks
                .filter((block) => block.language === "jsx" || block.language === "tsx")
                .map((block) => ({
                  filename: block.filename || `component-${Date.now()}.tsx`,
                  content: block.content || "",
                }))}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 border rounded-lg bg-muted/20">
            <div className="text-center text-muted-foreground">
              <div className="text-4xl mb-2">📝</div>
              <p>No React components found</p>
              <p className="text-xs mt-1">Generate some JSX/TSX code to see a live preview</p>
            </div>
          </div>
        )}
      </div>
    )
  }
}
