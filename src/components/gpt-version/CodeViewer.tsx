import React, { useEffect, useState } from "react";
import { Highlight, Language } from "prism-react-renderer";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Edit, Save, X } from "lucide-react";

type CodeViewerProps = {
  code: string;
  language: Language;
  onSave?: (newCode: string) => void;
  filename?: string;
};

export function CodeViewer({ code, language, onSave, filename }: CodeViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(code);

  // Sync internal state when external code prop changes (e.g., after save)
  useEffect(() => {
    setEditedCode(code);
  }, [code]);

  // Reset editor state when switching files/tabs
  useEffect(() => {
    setIsEditing(false);
    setEditedCode(code);
  }, [filename]);

  const handleSave = () => {
    onSave?.(editedCode);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedCode(code);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="rounded-lg border border-border bg-background">
        <div className="flex items-center justify-between p-1 border-b border-border">
          <span className="text-[10px] text-muted-foreground">Editing: {filename}</span>
          <div className="flex space-x-1">
            <Button size="sm" onClick={handleSave} className="h-6 px-2 text-[10px]">
              <Save className="h-2.5 w-2.5 mr-0.5" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel} className="h-6 px-2 text-[10px]">
              <X className="h-2.5 w-2.5 mr-0.5" />
              Cancel
            </Button>
          </div>
        </div>
        <div className="h-[calc(100vh-16rem)] min-h-[200px] max-h-[800px]">
          <Editor
            value={editedCode}
            onChange={(value) => setEditedCode(value || '')}
            language={language}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 11,
              lineNumbers: 'on',
              wordWrap: 'on',
              automaticLayout: true,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden">
      {onSave && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsEditing(true)}
          className="absolute top-1 right-1 z-10 h-6 px-2 text-[10px]"
        >
          <Edit className="h-2.5 w-2.5 mr-0.5" />
          Edit
        </Button>
      )}
<div className="h-[calc(100vh-16rem)] min-h-[200px] max-h-[800px] overflow-y-auto">
  <Highlight code={code} language={language}>
    {({ className, style, tokens, getLineProps, getTokenProps }) => (
      <pre
        className={
          className + " rounded-lg p-2 text-[10px]"
        }
        style={{
          ...style,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {tokens.map((line, i) => (
          <div
            key={i}
            {...getLineProps({ line, key: i })}
            style={{ display: "flex" }}
          >
            {/* Line number */}
            <span
              style={{
                display: "inline-block",
                width: "2em",
                userSelect: "none",
                opacity: 0.5,
                textAlign: "right",
                marginRight: "1em",
              }}
            >
              {i + 1}
            </span>

            {/* Line code */}
            <span>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token, key })} />
              ))}
            </span>
          </div>
        ))}
      </pre>
    )}
  </Highlight>
</div>



    </div>
  );
}
