"use client"
import { PreviewPane } from "./PreviewPane"
import type { CodeStructBlock } from "@/lib/types"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

interface ContentBlocksViewProps {
  messages: Message[]
  activeView: "preview" | "code"
  provider: string
  onFilesSelected: (files: CodeStructBlock[]) => void
}

export function ContentBlocksView({ messages, activeView, provider, onFilesSelected }: ContentBlocksViewProps) {
  return (
    <div className="flex-1">
      <PreviewPane messages={messages} activeView={activeView} provider={provider} onFilesSelected={onFilesSelected} />
    </div>
    
  )
}
