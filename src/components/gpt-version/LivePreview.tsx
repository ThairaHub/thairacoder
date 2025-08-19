import { registerModules, requireModule, VirtualModule } from '@/lib/virtual-view';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

interface LivePreviewProps {
  modules: VirtualModule[];
  entry: string; // filename of entry module
}

export function LivePreview({ modules, entry }: LivePreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mountRef.current || !modules.length || !entry) return;

    setError(null);
    mountRef.current.innerHTML = '';

    try {
      registerModules(modules);
      const App = requireModule(entry);

      if (!App) {
        throw new Error(`No component exported from ${entry}`);
      }

      const root = createRoot(mountRef.current);
      root.render(<App />);
    } catch (err: any) {
      console.error('LivePreview error:', err);
      setError(err.message);
    }
  }, [modules, entry]);

  return (
    <div className="h-full w-full border rounded p-2 overflow-auto bg-background">
      {error ? (
        <div className="text-destructive font-mono text-sm whitespace-pre-wrap p-4">
          {error}
        </div>
      ) : (
        <div ref={mountRef} className="h-full w-full" />
      )}
    </div>
  );
}
