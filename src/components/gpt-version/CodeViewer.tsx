import React, { useState } from "react";
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
        <div className="flex items-center justify-between p-2 border-b border-border">
          <span className="text-xs text-muted-foreground">Editing: {filename}</span>
          <div className="flex space-x-2">
            <Button size="sm" onClick={handleSave} className="h-7">
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel} className="h-7">
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
        <div className="h-[500px]">
          <Editor
            value={editedCode}
            onChange={(value) => setEditedCode(value || '')}
            language={language}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
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
          className="absolute top-2 right-2 z-10 h-7"
        >
          <Edit className="h-3 w-3 mr-1" />
          Edit
        </Button>
      )}
<div style={{ height: "500px", overflowY: "auto" }}>
  <Highlight code={code} language={language}>
    {({ className, style, tokens, getLineProps, getTokenProps }) => (
      <pre
        className={
          className + " rounded-lg p-4 text-sm"
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
