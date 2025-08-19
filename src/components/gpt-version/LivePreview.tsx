import { registerModules, requireModule, VirtualModule } from '@/lib/virtual-view';
import { useEffect, useRef, useState } from 'react';


interface LivePreviewProps {
  modules: VirtualModule[];
  entry: string; // filename of entry module
}

export function LivePreview({ modules, entry }: LivePreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('entry', entry)
    console.log('modules', modules)
    if (!mountRef.current) return;

    setError(null);
    mountRef.current.innerHTML = '';

    try {
      registerModules(modules);

      const App = requireModule(entry);

      const root = require('react-dom/client').createRoot(mountRef.current);
      root.render(<App />);
    } catch (err: any) {
      setError(err.message);
    }
  }, [modules, entry]);

  return (
    <div className="h-full w-full border rounded p-2 overflow-auto bg-gray-50">
      {error ? <pre className="text-red-500">{error}</pre> : <div ref={mountRef} />}
    </div>
  );
}
