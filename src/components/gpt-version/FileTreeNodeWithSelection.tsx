import React, { useState } from 'react';
import { Folder, FolderOpen, FileText } from 'lucide-react';
import { CodeStructBlock } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';

interface FileTreeNodeWithSelectionProps {
  node: CodeStructBlock;
  level?: number;
  onFileClick?: (filename: string) => void;
  selectedFiles: Set<string>;
  onFileSelection: (filename: string, selected: boolean) => void;
}

export function FileTreeNodeWithSelection({ 
  node, 
  level = 0, 
  onFileClick, 
  selectedFiles,
  onFileSelection 
}: FileTreeNodeWithSelectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = () => {
    if (node.type === 'folder') {
      setIsExpanded(!isExpanded);
    } else {
      onFileClick?.(node.filename || '');
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleCheckboxChange = (checked: boolean) => {
    if (node.filename) {
      onFileSelection(node.filename, checked);
    }
  };

  return (
    <div>
      <div
        className="flex items-center space-x-2 py-1 px-2 hover:bg-message-bg/50 rounded cursor-pointer group"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === 'file' && (
          <div onClick={handleCheckboxClick}>
            <Checkbox
              checked={selectedFiles.has(node.filename || '')}
              onCheckedChange={handleCheckboxChange}
              className="h-3 w-3"
            />
          </div>
        )}
        {node.type === 'folder' ? (
          isExpanded ? (
            <FolderOpen className="h-4 w-4 text-ai-glow" />
          ) : (
            <Folder className="h-4 w-4 text-muted-foreground" />
          )
        ) : (
          <FileText className="h-4 w-4 text-blue-400" />
        )}
        <span className="text-sm text-foreground/90 group-hover:text-foreground transition-colors">
          {node.filename}
        </span>
      </div>

      {node.type === 'folder' && isExpanded && node.children && (
        <div>
          {node.children.map((child, index) => (
            <FileTreeNodeWithSelection
              key={child.filename + index}
              node={child}
              level={level + 1}
              onFileClick={onFileClick}
              selectedFiles={selectedFiles}
              onFileSelection={onFileSelection}
            />
          ))}
        </div>
      )}
    </div>
  );
}
