import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Code, Eye } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { PreviewPane } from './PreviewPane';
import { useOllama } from '@/hooks/useOllama';
import { CodeStructBlock, aiResponse } from '@/lib/types';


interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm your local AI assistant powered by Ollama. I can help you write code, create components, and build applications. What would you like to create today?",
      role: 'assistant',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [activeView, setActiveView] = useState<'preview' | 'code'>('preview');
  const [selectedFilesForContext, setSelectedFilesForContext] = useState<CodeStructBlock[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { sendMessage, isLoading } = useOllama();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      // Build context from selected files
      const context = selectedFilesForContext.length > 0 
        ? selectedFilesForContext.map(file => 
            `File: ${file.filename}\nLanguage: ${file.language}\nContent:\n${file.content || 'No content'}`
          ).join('\n\n---\n\n')
        : undefined;

      //const response = await sendMessage(input, context);
      const response = aiResponse
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response,
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please make sure Ollama is running and try again.',
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  return (
    <div className="flex h-full bg-background">
      {/* Chat Panel */}
      <div className="flex flex-col w-1/3 bg-chat-bg border-r border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/10 to-ai-glow-soft/10">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Bot className="h-8 w-8 text-ai-glow" />
              <div className="absolute -top-1 -right-1 h-3 w-3 bg-ai-glow rounded-full animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-semibold bg-gradient-to-r from-ai-glow to-ai-glow-soft bg-clip-text text-transparent">
                Local AI Assistant
              </h1>
              <p className="text-sm text-muted-foreground">Powered by Ollama</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <div className="flex space-x-1">
                  <div className="h-2 w-2 bg-ai-glow rounded-full animate-pulse" />
                  <div className="h-2 w-2 bg-ai-glow rounded-full animate-pulse delay-100" />
                  <div className="h-2 w-2 bg-ai-glow rounded-full animate-pulse delay-200" />
                </div>
                <span className="text-sm">AI is thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-border bg-message-bg/50">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me to create something..."
              className="flex-1 bg-background/50 border-border focus:border-ai-glow transition-colors"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              className="bg-gradient-to-r from-primary to-ai-glow hover:from-primary/80 hover:to-ai-glow/80 transition-all shadow-glow"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="flex flex-col w-full bg-preview-bg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Output</h2>
          <div className="flex bg-message-bg rounded-lg p-1">
            <Button
              variant={activeView === 'preview' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('preview')}
              className={activeView === 'preview' ? 'bg-primary text-primary-foreground' : ''}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button
              variant={activeView === 'code' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('code')}
              className={activeView === 'code' ? 'bg-primary text-primary-foreground' : ''}
            >
              <Code className="h-4 w-4 mr-2" />
              Code
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <PreviewPane 
            messages={messages} 
            activeView={activeView} 
            onFilesSelected={setSelectedFilesForContext}
          />
        </div>
      </div>
    </div>
  );
}