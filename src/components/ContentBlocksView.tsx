"use client"

import type React from "react"
import { ContentViewer } from "./gpt-version/ContentViewer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { FileText, X, ChevronDown } from "lucide-react"
import { useState, useMemo, useEffect } from "react"
import type { CodeStructBlock } from "@/lib/types"
import { getAllFilesFromBlocks } from "@/lib/code-structure-merge"
import { FileTreeNodeWithSelection } from "./gpt-version/FileTreeNodeWithSelection"
import { downloadCodeAsZip } from "@/lib/code-to-zip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface ContentVersion {
  id: string
  name: string
  contentBlocks: CodeStructBlock[]
  timestamp: Date
}

interface ContentBlocksViewProps {
  contentBlocks: CodeStructBlock[]
  versions: ContentVersion[]
  activeVersionId: string | null
  provider: string
  onVersionChange: (versionId: string) => void
  onFilesSelected?: (selectedFiles: CodeStructBlock[]) => void
  onContentUpdate: (filename: string, newContent: string) => void
  isMobileSidebarOpen: boolean
  onMobileSidebarClose: () => void
}

export function ContentBlocksView({
  contentBlocks,
  versions,
  activeVersionId,
  provider,
  onVersionChange,
  onFilesSelected,
  onContentUpdate,
  isMobileSidebarOpen,
  onMobileSidebarClose,
}: ContentBlocksViewProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [openTabs, setOpenTabs] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)

  // Effect to update tabs when content blocks change
  useEffect(() => {
    const allFileNames = getAllFilesFromBlocks(contentBlocks).map((f) => f.filename || "")
    setOpenTabs((prev) => prev.filter((tab) => allFileNames.includes(tab)))
    if (activeTab && !allFileNames.includes(activeTab)) {
      setActiveTab(null)
    }
  }, [contentBlocks, activeTab])

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
    onMobileSidebarClose()
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

  return (
    <div className="flex h-full bg-background relative">
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onMobileSidebarClose} />
      )}

      <div
        className={`
          ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          fixed lg:relative top-0 left-0 h-full w-80 max-w-[85vw] lg:max-w-none
          border-r border-border flex flex-col bg-background z-50 lg:z-auto
          transition-transform duration-300 ease-in-out
        `}
      >
        <button onClick={onMobileSidebarClose} className="lg:hidden absolute top-2 right-2 p-1 hover:bg-muted rounded">
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
                    onClick={() => onVersionChange(version.id)}
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
            {contentBlocks.map((node, index) => (
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
                              onContentUpdate(activeTab, newContent)
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
              <p className="text-sm">Select a content file to view it</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
