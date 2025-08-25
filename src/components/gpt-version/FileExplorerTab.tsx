"use client";

import { useState } from "react";

import { FileTreeNode } from "./FileTreeNode";
import { CodeViewer } from "./CodeViewer";
import { X } from "lucide-react";
import { parseCodeBlocks } from "../PreviewPane";
import { transformCodeBlocks } from "../../lib/code-structure-block";
import { CodeStructBlock } from "../../lib/types";

type FileExplorerProps = {
  aiResponse: string;
};

export default function FileExplorer({ aiResponse }: FileExplorerProps) {
  const codeBlocks = parseCodeBlocks(aiResponse);
  const codeStructBlocks = transformCodeBlocks(codeBlocks);

  const [openFiles, setOpenFiles] = useState<CodeStructBlock[]>([]);
  const [activeFile, setActiveFile] = useState<CodeStructBlock | null>(null);

  const handleFileClick = (filename: string) => {
    const block = codeStructBlocks.find((b) => b.filename === filename);
    if (!block) return;

    // Add file if not already open
    if (!openFiles.find((f) => f.filename === block.filename)) {
      setOpenFiles((prev) => [...prev, block]);
    }
    setActiveFile(block);
  };

  const closeFile = (filename?: string) => {
    if (!filename) return;
    setOpenFiles((prev) => prev.filter((f) => f.filename !== filename));

    // If closing active tab, switch to last open file
    if (activeFile?.filename === filename) {
      const remaining = openFiles.filter((f) => f.filename !== filename);
      setActiveFile(remaining.length > 0 ? remaining[remaining.length - 1] : null);
    }
  };

  return (
    <div className="grid grid-cols-12 h-screen border rounded-xl overflow-hidden shadow-lg">
      {/* File Tree */}
      <div className="col-span-3 bg-gray-50 border-r overflow-y-auto p-2">
        {codeStructBlocks.map((node, idx) => (
          <FileTreeNode
            key={idx}
            node={node}
            onFileClick={handleFileClick}
          />
        ))}
      </div>

      {/* Code Viewer with Tabs */}
      <div className="col-span-9 flex flex-col bg-white overflow-hidden">
        {/* Tabs Bar */}
        <div className="flex items-center border-b bg-gray-100">
          {openFiles.map((file) => (
            <div
              key={file.filename}
              className={`flex items-center px-3 py-2 cursor-pointer border-r text-sm ${
                activeFile?.filename === file.filename
                  ? "bg-white font-medium"
                  : "hover:bg-gray-200"
              }`}
              onClick={() => setActiveFile(file)}
            >
              <span>{file.filename}</span>
              <button
                className="ml-2 text-gray-400 hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(file.filename);
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeFile ? (
            <CodeViewer
              key={activeFile.filename}
              code={activeFile.content}
              language={activeFile.language}
              filename={activeFile.filename}
            />
          ) : (
            <div className="text-gray-400 flex items-center justify-center h-full">
              Select a file to view its contents
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
