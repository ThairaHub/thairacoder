"use client"
import { useState } from "react"

interface OllamaResponse {
  model: string
  created_at: string
  response: string
  done: boolean
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string
      }>
    }
  }>
}

type Provider = "ollama" | "gemini"

export function useContentGeneration() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [provider, setProvider] = useState<Provider>("ollama")
  const [model, setModel] = useState<string>("gemma3:4b")

  /**
   * Analyzes the request to determine content type and platform
   */
  const analyzeRequest = (request: string, context?: string) => {
    const lowerRequest = request.toLowerCase()

    // Determine platform
    const isTwitter = /twitter|x\.com|tweet|thread/i.test(request)
    const isThreads = /threads|meta threads/i.test(request)
    const isLinkedIn = /linkedin|professional/i.test(request)

    // Determine content type
    const isStory = /story|storytelling|narrative/i.test(request)
    const isPost = /post|content|share/i.test(request)
    const isThread = /thread|series|multi-part/i.test(request)
    const isArticle = /article|long form|essay/i.test(request)

    // Determine tone
    const isProfessional = /professional|business|corporate/i.test(request)
    const isCasual = /casual|friendly|informal/i.test(request)
    const isEngaging = /engaging|viral|catchy/i.test(request)

    return {
      platform: isTwitter ? "twitter" : isThreads ? "threads" : isLinkedIn ? "linkedin" : "general",
      contentType: isStory ? "story" : isThread ? "thread" : isArticle ? "article" : "post",
      tone: isProfessional ? "professional" : isCasual ? "casual" : isEngaging ? "engaging" : "balanced",
      hasContext: !!context && context.length > 0,
    }
  }

  /**
   * Generates a context-aware prompt for content creation
   */
  const getPrompt = (request: string, context?: string): string => {
    const analysis = analyzeRequest(request, context)

    let basePrompt = `You are an expert social media content creator specializing in X (Twitter), Threads, and LinkedIn. Create engaging, high-quality content that follows platform best practices and drives engagement.

### Content Creation Framework:

Create a storytelling about the requested topic following these rules:

**Generic Essay Structure (applicable to any topic)**

| Section | Purpose | Key Elements to Include |
| --- | --- | --- |
| **1. Introduction** | Hook the reader and set the stage. | • A brief, engaging opening (fact, question, anecdote). • Contextual background that frames the topic. • Clear thesis statement or central claim. |
| **2. Current State / Problem Statement** | Show what is happening now or why the issue matters. | • Description of the present situation or trend. • Evidence (data, examples, expert opinions). • Why this matters to the audience. |
| **3. Forces of Change / Drivers** | Explain the key forces reshaping the field. | • Identify 2‑3 major drivers (technological, social, economic, regulatory, etc.). • Illustrate each driver with a concrete example or statistic. |
| **4. Implications for Practice** | Translate forces into real‑world effects. | • How the changes affect daily work, strategy, or decision‑making. • Potential benefits and challenges. |
| **5. Solutions / Strategies** | Offer actionable guidance. | • 2‑3 recommended actions, tools, or approaches. • Rationale for why each is effective. • Brief implementation hints (timeline, resources). |
| **6. Case Study / Illustration** *(optional but highly useful)* | Ground theory in a tangible example. | • A real or hypothetical example that embodies the thesis. • Highlight key decisions and outcomes. |
| **7. Future Outlook / Vision** | End with a forward‑looking perspective. | • Predict upcoming milestones or breakthroughs. • Discuss how early adopters can gain advantage. |
| **8. Conclusion** | Summarize and reinforce the thesis. | • Restate the main claim succinctly. • Final thought, call‑to‑action, or provocative question. |

**Tips for All Sections**
- Keep sentences concise (≤25 words) and avoid filler words.
- Use active voice and concrete verbs, avoid weak words such as *maybe, sometimes, I think, usually*..
- Maintain a logical flow: each section should naturally lead to the next.
- Adapt the depth of each part to the content length (e.g., shorter posts can combine sections 3 and 4).
- Use Real Life/People examples, don't create fictional characters.

### Platform-Specific Guidelines:`

    // Add platform-specific instructions
    if (analysis.platform === "twitter") {
      basePrompt += `\n\n**Twitter/X Optimization:**
- Character limits: 280 characters per tweet
- Use engaging hooks in the first tweet
- Break long content into threads (number each tweet)
- Include relevant hashtags (2-3 maximum)
- Use line breaks for readability
- End with a call-to-action or question`
    } else if (analysis.platform === "threads") {
      basePrompt += `\n\n**Threads Optimization:**
- 500 character limit per post
- Use visual storytelling techniques
- Create engaging carousel-style content
- Include relevant hashtags
- Encourage community interaction`
    } else if (analysis.platform === "linkedin") {
      basePrompt += `\n\n**LinkedIn Optimization:**
- Professional tone and language
- Include industry insights and data
- Use professional hashtags
- Structure for business audience
- Include actionable takeaways
- Encourage professional discussion`
    }

    // Add content type specific instructions
    if (analysis.contentType === "story") {
      basePrompt += `\n\n**Storytelling Focus:**
- Follow the 8-section essay structure above
- Use narrative techniques to engage readers
- Include personal anecdotes or case studies
- Build emotional connection with audience`
    } else if (analysis.contentType === "thread") {
      basePrompt += `\n\n**Thread Creation:**
- Break content into digestible parts
- Number each part (1/n, 2/n, etc.)
- Maintain narrative flow between parts
- End with summary or call-to-action`
    }

    // Add tone instructions
    if (analysis.tone === "professional") {
      basePrompt += `\n\n**Professional Tone:**
- Use industry-appropriate language
- Include data and statistics
- Maintain authoritative voice
- Focus on business value`
    } else if (analysis.tone === "engaging") {
      basePrompt += `\n\n**Engaging Tone:**
- Use conversational language
- Include questions and hooks
- Create shareable moments
- Encourage interaction`
    }

    basePrompt += `\n\n### CRITICAL OUTPUT FORMAT REQUIREMENTS:

You MUST format your response using markdown code blocks for each platform. This is essential for the system to create separate content files.

**Required Format:**
\`\`\`twitter twitter-content.md
[Your Twitter/X content here - formatted as thread if needed]
\`\`\`

\`\`\`linkedin linkedin-content.md
[Your LinkedIn content here - professional format]
\`\`\`

\`\`\`threads threads-content.md
[Your Threads content here - visual storytelling format]
\`\`\`

**Important Rules:**
- Each platform must be in its own code block
- Use the exact platform names: "twitter", "linkedin", "threads"
- Include the .md filename as shown above
- Put the complete, ready-to-post content inside each block
- Create content for multiple platforms when appropriate
- Follow the 8-section essay structure within each platform's constraints

### Request: ${request}`

    if (context) {
      basePrompt += `\n\n### Additional Context:\n${context}`
    }

    return basePrompt
  }

  const sendMessage = async (
    message: string,
    context?: string,
    onStreamUpdate?: (chunk: string) => void,
    apiKey?: string,
  ): Promise<string> => {
    setIsLoading(true)
    setError(null)

    try {
      if (provider === "gemini") {
        return await sendGeminiMessage(message, context, onStreamUpdate, apiKey)
      } else {
        return await sendOllamaMessage(message, context, onStreamUpdate)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const sendOllamaMessage = async (
    message: string,
    context?: string,
    onStreamUpdate?: (chunk: string) => void,
  ): Promise<string> => {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        prompt: getPrompt(message, context),
        stream: !!onStreamUpdate,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    if (onStreamUpdate && response.body) {
      let fullResponse = ""
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n").filter((line) => line.trim())

          for (const line of lines) {
            try {
              const data: OllamaResponse = JSON.parse(line)
              if (data.response) {
                fullResponse += data.response
                onStreamUpdate(data.response)
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      return fullResponse
    } else {
      const data: OllamaResponse = await response.json()
      return data.response
    }
  }

  const sendGeminiMessage = async (
    message: string,
    context?: string,
    onStreamUpdate?: (chunk: string) => void,
    apiKey?: string,
  ): Promise<string> => {
    const url = onStreamUpdate ? "http://localhost:8000/gemini/stream" : "http://localhost:8000/gemini/generate"

    const prompt = getPrompt(message, context)

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, apiKey }),
    })

    if (!response.ok) throw new Error(`HTTP error! ${response.status}`)

    if (onStreamUpdate && response.body) {
      console.log("entrei stream")
      let full = ""
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n").filter((l) => l.trim())

        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            if (data.response) {
              full += data.response
              onStreamUpdate(data.response)
              console.log(data.response)
            }
          } catch {
            // skip invalid JSON
          }
        }
      }
      return full
    }

    const data = await response.json()
    return data.response
  }

  const checkOllamaStatus = async (): Promise<{ models: any[] } | false> => {
    try {
      const response = await fetch("http://localhost:11434/api/tags")
      if (response.ok) {
        const data = await response.json()
        // Ensure models property exists and is an array
        return {
          models: Array.isArray(data.models) ? data.models : [],
        }
      }
      return { models: [] }
    } catch {
      return { models: [] }
    }
  }

  return {
    sendMessage,
    checkOllamaStatus,
    isLoading,
    error,
    provider,
    setProvider,
    model,
    setModel,
  }
}
