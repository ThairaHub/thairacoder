"use client"
import { ContentViewer } from "./gpt-version/ContentViewer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { FileText } from "lucide-react"
import { useState, useMemo, useEffect } from "react"
import type { CodeBlock, CodeStructBlock, TreeNode } from "@/lib/types"
import { transformCodeBlocks } from "@/lib/code-structure-block"
import { mergeCodeStructBlocks } from "@/lib/code-structure-merge"
import { ContentBlocksView } from "./ContentBlocksView"

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
  isMobileSidebarOpen: boolean
  onMobileSidebarClose: () => void
}

export function PreviewPane({
  messages,
  activeView,
  provider,
  onFilesSelected,
  isMobileSidebarOpen,
  onMobileSidebarClose,
}: PreviewPaneProps) {
  const [contentBlocks, setContentBlocks] = useState<CodeStructBlock[]>([])
  const [versions, setVersions] = useState<ContentVersion[]>([])
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null)

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
      }
    }
  }, [activeVersionId, versions])

  const handleVersionChange = (versionId: string) => {
    setActiveVersionId(versionId)
  }

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

  if (activeView === "code") {
    return (
      <ContentBlocksView
        contentBlocks={contentBlocks}
        versions={versions}
        activeVersionId={activeVersionId}
        provider={provider}
        onVersionChange={handleVersionChange}
        onFilesSelected={onFilesSelected}
        onContentUpdate={updateContentBlock}
        isMobileSidebarOpen={isMobileSidebarOpen}
        onMobileSidebarClose={onMobileSidebarClose}
      />
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
