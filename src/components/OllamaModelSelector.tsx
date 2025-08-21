import { useEffect, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useOllama } from "@/hooks/useOllama"
import { Model } from "@/lib/types"

type ModelDetails = {
  name: string
  model: string
  modified_at: string
  size: number
  digest: string
  details: {
    parent_model: string
    format: string
    family: string
    families: string[]
    parameter_size: string
    quantization_level: string
  }
}

export default function ModelSelector({
  model,
  setModel,
}: {
  model: string
  setModel: (m: string) => void
}) {
  const [models, setModels] = useState<ModelDetails[]>([])

  const {checkOllamaStatus} = useOllama()


  useEffect(() => {
    const fetchModels = async () => {
      try {
        const data = await checkOllamaStatus()
        // Defensive programming: ensure data exists and has models array
        if (data && Array.isArray(data.models)) {
          setModels(data.models)
        } else {
          setModels([])
        }
      } catch (err) {
        console.error("Error fetching Ollama models", err)
        setModels([]) // Set empty array on error
      }
    }

    fetchModels()
  }, [])

  return (
    <div className="px-4 py-2 border-t border-border">
      <Select value={model} onValueChange={(val) => setModel(val)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m.name} value={m.name} className="flex flex-col items-start py-2">
              <span className="font-medium">{m.name} </span>
              <span className="text-xs text-muted-foreground">
                · {m.details.family} · {m.details.parameter_size} · {m.details.quantization_level}
              </span>
              <span className="text-xs text-muted-foreground">
                {(m.size / 1e9).toFixed(2)} GB
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
