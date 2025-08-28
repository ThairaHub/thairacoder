"use client"

import { registerModules, requireModule, type VirtualModule } from "@/lib/virtual-view"
import { useEffect, useRef, useState } from "react"
import { createRoot, type Root } from "react-dom/client"

interface LivePreviewProps {
  modules: VirtualModule[]
  entry: string // filename of entry module
}

export function LivePreview({ modules, entry }: LivePreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<Root | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mountRef.current || !modules.length || !entry) return

    setError(null)

    if (rootRef.current) {
      rootRef.current.unmount()
      rootRef.current = null
    }

    mountRef.current.innerHTML = ""

    try {
      console.log(
        "[v0] Registering modules:",
        modules.map((m) => m.filename),
      )
      registerModules(modules)

      console.log("[v0] Requiring entry module:", entry)
      const App = requireModule(entry)

      if (!App) {
        throw new Error(`No component exported from ${entry}`)
      }

      console.log("[v0] Creating React root and rendering component")
      rootRef.current = createRoot(mountRef.current)
      rootRef.current.render(<App />)
    } catch (err: any) {
      console.error("[v0] LivePreview error:", err)
      setError(err.message)
    }
  }, [modules, entry])

  useEffect(() => {
    return () => {
      if (rootRef.current) {
        rootRef.current.unmount()
        rootRef.current = null
      }
    }
  }, [])

  return (
    <div className="h-full w-full border rounded p-2 overflow-auto bg-background">
      {error ? (
        <div className="text-destructive font-mono text-sm whitespace-pre-wrap p-4">
          <div className="font-bold mb-2">Preview Error:</div>
          {error}
        </div>
      ) : (
        <div ref={mountRef} className="h-full w-full" />
      )}
    </div>
  )
}
