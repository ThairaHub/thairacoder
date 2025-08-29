"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check, Edit, Save, X, Share } from "lucide-react"

type ContentViewerProps = {
  content: string
  platform?: string
  contentType?: string
  onSave?: (newContent: string) => void
  filename?: string
}

export function ContentViewer({ content, platform, contentType, onSave, filename }: ContentViewerProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(content)
  const [copied, setCopied] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [postStatus, setPostStatus] = useState<{ success?: boolean; message?: string } | null>(null)

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = () => {
    onSave?.(editedContent)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedContent(content)
    setIsEditing(false)
  }

  const handlePost = async () => {
    if (!platform) {
      setPostStatus({ success: false, message: "No platform specified" })
      return
    }

    setIsPosting(true)
    setPostStatus(null)

    try {
      const response = await fetch("http://localhost:8000/post-content/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: content,
          platform: platform,
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setPostStatus({ success: true, message: result.message })
      } else {
        setPostStatus({ success: false, message: result.detail || "Failed to post content" })
      }
    } catch (error) {
      setPostStatus({ success: false, message: "Network error. Please try again." })
    } finally {
      setIsPosting(false)
      // Clear status after 3 seconds
      setTimeout(() => setPostStatus(null), 3000)
    }
  }

  // Parse content sections for better display
  const parseContentSections = (text: string) => {
    const sections = []
    const lines = text.split("\n")
    let currentSection = { title: "", content: "" }

    for (const line of lines) {
      if (line.startsWith("**") && line.includes(":**")) {
        // Save previous section if it has content
        if (currentSection.title || currentSection.content) {
          sections.push(currentSection)
        }
        // Start new section
        currentSection = {
          title: line.replace(/\*\*/g, "").replace(":", ""),
          content: "",
        }
      } else if (line.trim()) {
        currentSection.content += (currentSection.content ? "\n" : "") + line
      }
    }

    // Add the last section
    if (currentSection.title || currentSection.content) {
      sections.push(currentSection)
    }

    return sections.length > 0 ? sections : [{ title: "Content", content: text }]
  }

  const sections = parseContentSections(content)

  if (isEditing) {
    return (
      <div className="rounded-lg border border-border bg-background">
        <div className="flex items-center justify-between p-2 sm:p-3 border-b border-border">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <span className="text-xs sm:text-sm text-muted-foreground truncate">Editing: {filename}</span>
            {platform && (
              <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hidden sm:inline">
                {platform}
              </span>
            )}
            {contentType && (
              <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded hidden sm:inline">
                {contentType}
              </span>
            )}
          </div>
          <div className="flex space-x-1 sm:space-x-2 flex-shrink-0">
            <Button size="sm" onClick={handleSave} className="h-8 px-2 sm:px-3 text-xs">
              <Save className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Save</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              className="h-8 px-2 sm:px-3 text-xs bg-transparent"
            >
              <X className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
          </div>
        </div>
        <div className="p-2 sm:p-4">
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full h-64 sm:h-96 p-2 sm:p-3 text-sm bg-background border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your content here..."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="relative rounded-lg border border-border bg-background overflow-hidden">
      {/* Header with actions - Made responsive */}
      <div className="flex items-center justify-between p-2 sm:p-3 border-b border-border bg-muted/30">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          {platform && (
            <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded font-medium">{platform}</span>
          )}
          {contentType && (
            <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded font-medium hidden sm:inline">
              {contentType}
            </span>
          )}
        </div>
        <div className="flex space-x-1 sm:space-x-2 flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePost}
            disabled={isPosting || !platform}
            className="h-8 px-2 sm:px-3 text-xs bg-transparent"
          >
            <Share className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">{isPosting ? "Posting..." : "Post"}</span>
          </Button>
          <Button size="sm" variant="outline" onClick={handleCopy} className="h-8 px-2 sm:px-3 text-xs bg-transparent">
            {copied ? <Check className="h-3 w-3 sm:mr-1 text-green-500" /> : <Copy className="h-3 w-3 sm:mr-1" />}
            <span className="hidden sm:inline">{copied ? "Copied!" : "Copy"}</span>
          </Button>
          {onSave && (
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="h-8 px-2 sm:px-3 text-xs">
              <Edit className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          )}
        </div>
      </div>

      {postStatus && (
        <div
          className={`mx-2 sm:mx-3 mt-2 p-2 rounded text-xs ${
            postStatus.success
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-red-500/20 text-red-400 border border-red-500/30"
          }`}
        >
          {postStatus.message}
        </div>
      )}

      {/* Content display - Added responsive height and better mobile scrolling */}
      <div className="max-h-64 sm:max-h-96 overflow-y-auto">
        <div className="p-2 sm:p-4 space-y-4">
          {sections.map((section, index) => (
            <div key={index} className="space-y-2">
              {section.title && (
                <h4 className="text-sm font-semibold text-foreground/90 border-b border-border/50 pb-1 break-words">
                  {section.title}
                </h4>
              )}
              <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed break-words">
                {section.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
