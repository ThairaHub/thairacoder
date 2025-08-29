"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "./ui/button"
import { Card } from "./ui/card"
import { Input } from "./ui/input"
import { TrendingUp, MessageSquare, Users, BarChart3, ArrowRight, Sparkles, Search, Loader2 } from "lucide-react"
import { ChatInterface } from "./ChatInterface"

interface TrendingTopic {
  topic: string
  engagement: string
  platform: string
}

export function LandingHero() {
  const [showChat, setShowChat] = useState(false)
  const [input, setInput] = useState("")
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([])
  const [trendArea, setTrendArea] = useState("general")
  const [isLoadingTrends, setIsLoadingTrends] = useState(false)

  const fetchTrends = async (area = "general") => {
    setIsLoadingTrends(true)
    try {
      const response = await fetch(`http://localhost:8000/trends?area=${encodeURIComponent(area)}`)
      const data = await response.json()
      if (data.trends) {
        setTrendingTopics(data.trends)
      }
    } catch (error) {
      console.error("Failed to fetch trends:", error)
      // Fallback to default trends
      setTrendingTopics([
        { topic: "AI in Marketing", engagement: "+245%", platform: "LinkedIn" },
        { topic: "Sustainable Living", engagement: "+189%", platform: "Twitter/X" },
        { topic: "Remote Work Tips", engagement: "+156%", platform: "Threads" },
        { topic: "Tech Innovation", engagement: "+203%", platform: "LinkedIn" },
        { topic: "Health & Wellness", engagement: "+178%", platform: "Twitter/X" },
        { topic: "Digital Transformation", engagement: "+167%", platform: "Threads" },
      ])
    } finally {
      setIsLoadingTrends(false)
    }
  }

  useEffect(() => {
    fetchTrends(trendArea)
  }, [])

  const handleAreaSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchTrends(trendArea)
  }

  if (showChat) {
    return <ChatInterface input={input} setInput={setInput} />
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          {/* Main Headline */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-5xl md:text-6xl font-bold text-balance">
              Unleash Your Creativity with <span className="text-primary">Trend Insights</span>
            </h1>
          </div>

          {/* Subheadline */}
          <p className="text-xl text-muted-foreground mb-8 text-balance max-w-2xl mx-auto">
            Discover the latest trends and generate engaging content effortlessly for Twitter/X, LinkedIn, and Threads
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button size="lg" className="text-lg px-8 py-6" onClick={() => setShowChat(true)}>
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-lg px-8 py-6 bg-transparent"
              onClick={() => setShowChat(true)}
            >
              <MessageSquare className="mr-2 h-5 w-5" />
              Chat with AI
            </Button>
          </div>
        </div>

        {/* Trending Topics Section */}
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <TrendingUp className="h-8 w-8 text-primary" />
              Trending Now
            </h2>
            <p className="text-muted-foreground text-lg mb-6">Click on any trend to generate content instantly</p>

            <form onSubmit={handleAreaSearch} className="max-w-md mx-auto mb-8">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter area/topic (e.g., technology, health, business)"
                  value={trendArea}
                  onChange={(e) => setTrendArea(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={isLoadingTrends}>
                  {isLoadingTrends ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </form>
          </div>

          {/* Trending Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {isLoadingTrends
              ? Array.from({ length: 6 }).map((_, index) => (
                  <Card key={index} className="p-6 animate-pulse">
                    <div className="h-4 bg-muted rounded mb-4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </Card>
                ))
              : trendingTopics.map((trend, index) => (
                  <Card
                    key={index}
                    className="p-6 hover:shadow-lg transition-all duration-300 cursor-pointer hover:scale-105 border-2 hover:border-primary/20"
                    onClick={() => {
                      setInput(trend.topic)
                      setShowChat(true)
                    }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-semibold text-lg text-balance">{trend.topic}</h3>
                      <div className="text-primary font-bold text-sm bg-primary/10 px-2 py-1 rounded">
                        {trend.engagement}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{trend.platform}</span>
                      <ArrowRight className="h-4 w-4 text-primary" />
                    </div>
                  </Card>
                ))}
          </div>

          {/* Stats Section */}
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2">10K+</h3>
              <p className="text-muted-foreground">Content Creators</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <BarChart3 className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2">500K+</h3>
              <p className="text-muted-foreground">Posts Generated</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2">95%</h3>
              <p className="text-muted-foreground">Engagement Boost</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
