import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  
  return (
    <div className={cn(
      "flex gap-2 p-2 rounded-lg transition-all duration-200",
      isUser 
        ? "bg-primary/70 ml-4 border border-primary/20" 
        : "bg-message-bg mr-4 border border-border/50 hover:border-ai-glow/30"
    )}>
      <div className={cn(
        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
        isUser 
          ? "bg-primary text-primary-foreground" 
          : "bg-gradient-to-br from-ai-glow to-ai-glow-soft text-background shadow-glow"
      )}>
        {isUser ? <User className="h-3 w-3" /> :             <div className="relative w-7 h-7">
            <img
              src='logo_TH.png'
              className="w-7 h-7 object-contain rounded-md"
              />
            </div>}
      </div>
      
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground/90">
            {isUser ? 'You' : 'ThairaCoder'}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>
        
        <div className="prose prose-sm prose-invert max-w-none">
          <pre className="whitespace-pre-wrap text-xs text-foreground/90 font-sans leading-relaxed">
            {message.content}
          </pre>
        </div>
      </div>
    </div>
  );
}
