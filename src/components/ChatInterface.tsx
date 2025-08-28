"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Code, Eye, Database } from "lucide-react"
import { ChatMessage } from "./ChatMessage"
import { PreviewPane } from "./PreviewPane"
import { useContentGeneration } from "@/hooks/useContentGeneration"
import type { CodeStructBlock } from "@/lib/types"
import ModelSelector from "./OllamaModelSelector"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

interface DatabaseContent {
  id: number
  title: string
  platform: string
  content_type: string
  content_text: string
  version: number
  is_latest: boolean
  created_at: string
  updated_at: string
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "Hello! I'm your Social Media Content Assistant. I specialize in creating engaging content for X (Twitter), Threads, and LinkedIn. I can help you craft compelling posts, stories, and professional content. What type of content would you like to create today?",
      role: "assistant",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [activeView, setActiveView] = useState<"preview" | "code">("code")
  const [selectedFilesForContext, setSelectedFilesForContext] = useState<CodeStructBlock[]>([])
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem("geminiApiKey") || "")
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [databaseContent, setDatabaseContent] = useState<DatabaseContent[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { sendMessage, isLoading, provider, setProvider, model, setModel } = useContentGeneration()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadContentFromDatabase = async () => {
    setIsLoadingContent(true)
    try {
      const response = await fetch("http://localhost:8001/content/", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch content")
      }

      const content: DatabaseContent[] = await response.json()
      setDatabaseContent(content)

      // Create a message with loaded content formatted for file creation
      if (content.length > 0) {
        const formattedContent = content
          .map((item) => {
            const platformExtension = item.platform.toLowerCase().replace(/[^a-z0-9]/g, "-")
            const dateStr = new Date(item.created_at).toLocaleDateString()
            return `\`\`\`${item.platform.toLowerCase()} ${item.title.replace(/[^a-zA-Z0-9]/g, "-")}-${platformExtension}.md\n${item.content_text}\n\`\`\``
          })
          .join("\n\n")

        const loadedMessage: Message = {
          id: Date.now().toString(),
          content: `Loaded ${content.length} content items from database:\n\n${formattedContent}`,
          role: "assistant",
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, loadedMessage])
      } else {
        const emptyMessage: Message = {
          id: Date.now().toString(),
          content: "No content found in database.",
          role: "assistant",
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, emptyMessage])
      }
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `Error loading content: ${error instanceof Error ? error.message : "Unknown error"}`,
        role: "assistant",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoadingContent(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")

    // Create initial assistant message for streaming
    const assistantMessageId = (Date.now() + 1).toString()
    const initialAssistantMessage: Message = {
      id: assistantMessageId,
      content: "",
      role: "assistant",
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, initialAssistantMessage])

    try {
      // Build context from selected files
      const context =
        selectedFilesForContext.length > 0
          ? selectedFilesForContext
              .map(
                (file) =>
                  `File: ${file.filename}\nLanguage: ${file.language}\nContent:\n${file.content || "No content"}`,
              )
              .join("\n\n---\n\n")
          : undefined

      // Stream response and update message in real-time
      const apiKey = provider === "gemini" ? geminiApiKey : undefined
      const response = await sendMessage(
        input,
        context,
        (chunk: string) => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, content: msg.content + chunk } : msg)),
          )
        },
        apiKey,
      )

      // Final update to ensure complete response
      setMessages((prev) => prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, content: response } : msg)))
    } catch (error) {
      // Replace the empty assistant message with error message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. ${provider === "ollama" ? "Please make sure Ollama is running and try again." : "Please check your API key and try again."}`,
              }
            : msg,
        ),
      )
    }
  }

  return (
    <div className="flex h-full bg-background">
      {/* Chat Panel */}
      <div className="flex flex-col w-1/3 bg-chat-bg border-r border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-2 border-b border-border bg-gradient-to-r from-primary/10 to-ai-glow-soft/10">
          <div className="flex items-center space-x-2">
            <div className="relative w-8 h-8">
              <img src="logo_TH.png" className="w-8 h-8 object-contain rounded-md" />
              <div className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-ai-glow rounded-full animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-semibold bg-gradient-to-r from-ai-glow to-ai-glow-soft bg-clip-text text-transparent">
                ThairaContent
              </h1>
              <p className="text-xs text-muted-foreground">Powered by {provider === "ollama" ? "Ollama" : "Gemini"}</p>
            </div>
          </div>
          <Button
            onClick={loadContentFromDatabase}
            disabled={isLoadingContent}
            variant="outline"
            size="sm"
            className="text-xs h-7 px-2 bg-transparent"
          >
            <Database className="h-3 w-3 mr-1" />
            {isLoadingContent ? "Loading..." : "Load Content"}
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-2">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex items-center space-x-1 text-muted-foreground">
                <div className="flex space-x-0.5">
                  <div className="h-1.5 w-1.5 bg-ai-glow rounded-full animate-pulse" />
                  <div className="h-1.5 w-1.5 bg-ai-glow rounded-full animate-pulse delay-100" />
                  <div className="h-1.5 w-1.5 bg-ai-glow rounded-full animate-pulse delay-200" />
                </div>
                <span className="text-xs">AI is thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Provider Selection */}
        <div className="px-2 py-1 border-t border-border">
          <div className="flex space-x-1 bg-message-bg rounded-lg p-0.5">
            <Button
              variant={provider === "ollama" ? "default" : "ghost"}
              size="sm"
              onClick={() => setProvider("ollama")}
              className="flex-1 text-xs"
            >
              Ollama
            </Button>
            <Button
              variant={provider === "gemini" ? "default" : "ghost"}
              size="sm"
              onClick={() => setProvider("gemini")}
              className="flex-1 text-xs"
            >
              Gemini
            </Button>
          </div>
        </div>
        {provider === "ollama" && <ModelSelector model={model} setModel={setModel} />}

        {provider === "gemini" && (
          <div className="px-2 py-1">
            <Input
              type="password"
              value={geminiApiKey}
              onChange={(e) => {
                setGeminiApiKey(e.target.value)
                localStorage.setItem("geminiApiKey", e.target.value)
              }}
              placeholder="Enter Gemini API Key..."
              className="w-full bg-background/50 border-border focus:border-ai-glow transition-colors text-xs h-8"
            />
          </div>
        )}

        {/* Input */}
        <div className="p-2 border-t border-border bg-message-bg/50">
          <form onSubmit={handleSubmit} className="flex space-x-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me to create content for social media..."
              className="flex-1 bg-background/50 border-border focus:border-ai-glow transition-colors text-xs h-8"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-gradient-to-r from-primary to-ai-glow hover:from-primary/80 hover:to-ai-glow/80 transition-all shadow-glow h-8 px-2"
            >
              <Send className="h-3 w-3" />
            </Button>
          </form>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="flex flex-col w-full bg-preview-bg">
        {/* Header */}
        <div className="flex items-center justify-between p-2 border-b border-border">
          <h2 className="text-sm font-semibold">Content</h2>
          <div className="flex bg-message-bg rounded-lg p-0.5">
            <Button
              variant={activeView === "preview" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveView("preview")}
              className={cn("text-xs h-7 px-2", activeView === "preview" ? "bg-primary text-primary-foreground" : "")}
            >
              <Eye className="h-3 w-3 mr-1" />
              Preview
            </Button>
            <Button
              variant={activeView === "code" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveView("code")}
              className={cn("text-xs h-7 px-2", activeView === "code" ? "bg-primary text-primary-foreground" : "")}
            >
              <Code className="h-3 w-3 mr-1" />
              Raw
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <PreviewPane
            messages={messages}
            activeView={activeView}
            provider={provider}
            onFilesSelected={setSelectedFilesForContext}
          />
        </div>
      </div>
    </div>
  )
}
