"use client"

import type React from "react"
import { ContentViewer } from "./gpt-version/ContentViewer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { FileText, X, ChevronDown, Menu, FileStack, ArrowLeft } from "lucide-react"
import { useState, useMemo, useEffect } from "react"
import type { CodeBlock, CodeStructBlock, TreeNode } from "@/lib/types"
import { transformCodeBlocks } from "@/lib/code-structure-block"
import { mergeCodeStructBlocks, getAllFilesFromBlocks } from "@/lib/code-structure-merge"
import { FileTreeNodeWithSelection } from "./gpt-version/FileTreeNodeWithSelection"
import { downloadCodeAsZip } from "@/lib/code-to-zip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

export function parseFileStructure(text: string): TreeNode[] {
  const lines = text.split(/\r?\n/)
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
export function parseContentBlocks(text: string): CodeBlock[] {
  const contentBlocks: CodeBlock[] = []

  // Look for platform-specific content sections
  const platformPatterns = [
    { platform: "medium", regex: /\*\*Platform:\*\*\s*Medium([\s\S]*?)(?=\*\*Platform:\*\*|$)/gi },
    { platform: "twitter", regex: /\*\*Platform:\*\*\s*X\s*$$Twitter$$([\s\S]*?)(?=\*\*Platform:\*\*|$)/gi },
    { platform: "threads", regex: /\*\*Platform:\*\*\s*Threads([\s\S]*?)(?=\*\*Platform:\*\*|$)/gi },
    { platform: "linkedin", regex: /\*\*Platform:\*\*\s*LinkedIn([\s\S]*?)(?=\*\*Platform:\*\*|$)/gi },
  ]

  // Also check for traditional code blocks for backward compatibility
  const codeBlockRegex = /```(\w+)?(?:\s+([^\n]+))?\n([\s\S]*?)```/g
  let match
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const [, language = "text", filename, content] = match
    contentBlocks.push({
      language,
      filename: filename?.trim(),
      content: content.trim(),
    })
  }

  // Parse platform-specific content
  for (const { platform, regex } of platformPatterns) {
    let platformMatch
    while ((platformMatch = regex.exec(text)) !== null) {
      const [, content] = platformMatch
      const cleanContent = content.trim()

      if (cleanContent) {
        contentBlocks.push({
          language: platform,
          filename: `${platform}-content.md`,
          content: `**Platform:** ${platform === "twitter" ? "X (Twitter)" : platform.charAt(0).toUpperCase() + platform.slice(1)}\n\n${cleanContent}`,
        })
      }
    }
  }

  return contentBlocks
}

export function parseCodeBlocks(text: string): CodeBlock[] {
  return parseContentBlocks(text)
}

interface CodeVersion {
  id: string
  name: string
  codeBlocks: CodeStructBlock[]
  timestamp: Date
}

interface ContentVersion {
  id: string
  name: string
  contentBlocks: CodeStructBlock[]
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
  const [contentBlocks, setContentBlocks] = useState<CodeStructBlock[]>([])
  const [versions, setVersions] = useState<ContentVersion[]>([])
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  const handleCopy = () => {
    if (!activeTabContent) return
    navigator.clipboard.writeText(activeTabContent.content || "")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000) // Reset after 2 seconds
  }

  const fileStructure = useMemo(() => {
    const assistantMessages = messages.filter((m) => m.role === "assistant")
    let parsedStructure: TreeNode[] = []
    const newVersions: ContentVersion[] = []
    let accumulatedContentBlocks: CodeStructBlock[] = []

    // Create versions for each assistant message that contains content
    for (let i = 0; i < assistantMessages.length; i++) {
      const message = assistantMessages[i]
      const structure = parseFileStructure(message.content)
      const blocks = parseContentBlocks(message.content)
      const transformedBlocks = transformCodeBlocks(blocks)

      if (structure.length > 0) {
        parsedStructure = structure // Use the latest structure found
      }

      // Only create a version if there are content blocks
      if (transformedBlocks.length > 0) {
        // Merge new blocks with accumulated blocks (preserving existing files, updating changed ones)
        accumulatedContentBlocks = mergeCodeStructBlocks(accumulatedContentBlocks, transformedBlocks)

        const versionId = `v${i + 1}-${message.timestamp.getTime()}`
        newVersions.push({
          id: versionId,
          name: `Version ${i + 1}`,
          contentBlocks: [...accumulatedContentBlocks], // Create a copy to avoid reference issues
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
      setContentBlocks(latestVersion.contentBlocks)
    }

    if (parsedStructure.length === 0 && newVersions.length === 0) {
      parsedStructure = [
        {
          name: "content",
          type: "folder",
          expanded: true,
          children: [
            {
              name: "social-media",
              type: "folder",
              expanded: true,
              children: [
                { name: "medium-content.md", type: "file" },
                { name: "twitter-content.md", type: "file" },
                { name: "threads-content.md", type: "file" },
                { name: "linkedin-content.md", type: "file" },
              ],
            },
          ],
        },
      ]
    }

    return parsedStructure
  }, [messages, activeVersionId])

  // Effect to update content blocks when active version changes
  useEffect(() => {
    if (activeVersionId) {
      const activeVersion = versions.find((v) => v.id === activeVersionId)
      if (activeVersion) {
        setContentBlocks(activeVersion.contentBlocks)
        // Close tabs that don't exist in the new version
        const allFileNames = getAllFilesFromBlocks(activeVersion.contentBlocks).map((f) => f.filename || "")
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
    return findFileByName(contentBlocks, activeTab)
  }, [activeTab, contentBlocks])

  const allFiles = useMemo(() => getAllFilesFromBlocks(contentBlocks), [contentBlocks])

  // Function to recursively update content blocks
  const updateContentBlock = (filename: string, newContent: string) => {
    const updateContentBlocks = (blocks: CodeStructBlock[]): CodeStructBlock[] => {
      return blocks.map((block) => {
        if (block.type === "file" && block.filename === filename) {
          return { ...block, content: newContent }
        } else if (block.type === "folder" && block.children) {
          return { ...block, children: updateContentBlocks(block.children) }
        }
        return block
      })
    }

    // Update the current contentBlocks
    const updatedBlocks = updateContentBlocks(contentBlocks)
    setContentBlocks(updatedBlocks)

    // Also update the version's contentBlocks to persist changes
    if (activeVersionId) {
      setVersions((prevVersions) =>
        prevVersions.map((version) =>
          version.id === activeVersionId ? { ...version, contentBlocks: updatedBlocks } : version,
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
    setIsMobileSidebarOpen(false)
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
      <div className="flex h-full bg-background relative">
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
        )}

        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="lg:hidden top-12 left-4 z-50 p-2 bg-background border border-border  shadow-lg"
        >
          <FileStack className="h-4 w-4" />
        </button>

        <div
          key="content_block_files_view"
          className={`
          ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          fixed lg:relative top-0 left-0 h-full w-80 max-w-[85vw] lg:max-w-none
          border-r border-border flex flex-col bg-background z-50 lg:z-auto
          transition-transform duration-300 ease-in-out
        `}
        >
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden absolute top-2 right-2 p-1 hover:bg-muted rounded"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="p-4 border-b border-border flex-shrink-0">
            <h3 className="text-sm font-semibold text-foreground/90 mb-2">Content Structure</h3>
            {contentBlocks.length > 0 && (
              <>
                <p className="text-[10px] text-muted-foreground mb-2">
                  {contentBlocks.length} content block{contentBlocks.length !== 1 ? "s" : ""} detected
                </p>
                <div className="flex flex-col space-y-1">
                  <div className="text-[10px] text-muted-foreground">Content Selection:</div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={selectAllFiles}
                      className="px-1.5 py-0.5 text-[10px] bg-primary/20 text-white/80 rounded hover:bg-primary/30 transition-colors"
                    >
                      <span className="hidden sm:inline">Select All ({allFiles.length})</span>
                      <span className="sm:hidden">All ({allFiles.length})</span>
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

          {contentBlocks.length > 0 && (
          <div className="flex flex-col space-y-1 p-2 flex-shrink-0">
            <button
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={() => downloadCodeAsZip(allFiles)}
            >
              <span className="hidden sm:inline">Download All Content</span>
              <span className="sm:hidden">Download</span>
            </button>

            {versions.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 flex items-center justify-between">
                    <span className="text-[10px] truncate">
                      {versions.find((v) => v.id === activeVersionId)?.name || "Select Version"}
                    </span>
                    <ChevronDown className="h-3 w-3 ml-1 flex-shrink-0" />
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
          )}


          <ScrollArea className="flex-1 min-h-0 p-2">
            <div className="space-y-1">
              {contentBlocks.length > 0 ?
               (
                contentBlocks.map((node, index) => (
                <FileTreeNodeWithSelection
                  key={node.filename + index}
                  node={node}
                  onFileClick={handleFileClick}
                  selectedFiles={selectedFiles}
                  onFileSelection={handleFileSelection}
                />
                )
               )
            ) :(
                <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
                  <div className="text-center">
                    <FileStack className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <ArrowLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm"> Generate content files</p>
                  </div>
                </div>
              )}
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
              <div className="text-[10px] text-muted-foreground">Ready to generate and preview content</div>
            </Card>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:ml-0 min-w-0">
          {openTabs.length > 0 ? (
            <>
              <div className="border-b border-border bg-background">
                <div className="flex items-center overflow-x-auto scrollbar-hide">
                  {openTabs.map((tabFile) => (
                    <div
                      key={tabFile}
                      className={`flex items-center px-2 sm:px-3 py-2 border-r border-border cursor-pointer min-w-0 flex-shrink-0 ${
                        activeTab === tabFile
                          ? "bg-message-bg text-foreground"
                          : "bg-background hover:bg-message-bg/50 text-muted-foreground"
                      }`}
                      onClick={() => setActiveTab(tabFile)}
                    >
                      <FileText className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="text-[10px] truncate max-w-[60px] sm:max-w-[100px]" title={tabFile}>
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

              {activeTab && (
                <div className="flex-1 relative min-h-0">
                  <div className="p-2 sm:p-4 h-full overflow-auto">
                    {activeTabContent ? (
                      <Card className="p-2 sm:p-4 bg-message-bg border-border relative">
                        <div className="mb-4">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <FileText className="h-4 w-4 text-ai-glow flex-shrink-0" />
                            <span className="text-sm font-semibold text-foreground/90 truncate">{activeTab}</span>
                            <span className="text-xs text-muted-foreground">({activeTabContent.language})</span>
                          </div>
                        </div>

                        <div className="overflow-hidden">
                          <ContentViewer
                            key={activeTab}
                            content={activeTabContent.content || ""}
                            platform={
                              activeTabContent.language === "twitter"
                                ? "X (Twitter)"
                                : activeTabContent.language === "threads"
                                  ? "Threads"
                                  : activeTabContent.language === "linkedin"
                                    ? "LinkedIn"
                                    : undefined
                            }
                            contentType={activeTabContent.language}
                            filename={activeTab}
                            onSave={(newContent) => {
                              if (activeTab) {
                                updateContentBlock(activeTab, newContent)
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
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <ArrowLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm"> Select a content file to view it</p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  } else {
    return (
      <div className="p-2 sm:p-4 h-full">
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Live Preview</h3>
          <p className="text-sm text-muted-foreground mb-4">Preview of your generated social media content</p>
        </div>


        {contentBlocks.length > 0 ? (
          <div className="h-[calc(100%-120px)] border rounded-lg overflow-hidden">
            <ScrollArea className="h-full p-2 sm:p-4">
              {contentBlocks.map((block, index) => (
                <Card key={index} className="mb-4 p-2 sm:p-4 bg-message-bg border-border">
                  <div className="flex items-center space-x-2 mb-2 flex-wrap">
                    <FileText className="h-4 w-4 text-ai-glow flex-shrink-0" />
                    <span className="text-sm font-semibold truncate">{block.filename}</span>
                    <span className="text-xs text-muted-foreground">({block.language})</span>
                  </div>
                  <ContentViewer
                    content={block.content || ""}
                    platform={
                      block.language === "twitter"
                        ? "X (Twitter)"
                        : block.language === "medium"
                          ? "Medium"
                          : block.language === "threads"
                            ? "Threads"
                            : block.language === "linkedin"
                              ? "LinkedIn"
                              : undefined
                    }
                    contentType={block.language}
                    filename={block.filename}
                  />
                </Card>
              ))}
            </ScrollArea>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 border rounded-lg bg-muted/20">
            <div className="text-center text-muted-foreground p-4">
              <div className="text-4xl mb-2">📝</div>
              <p>No content found</p>
              <p className="text-xs mt-1">Generate some social media content to see a preview</p>
            </div>
          </div>
        )}
      </div>

      
    )
  }
}
