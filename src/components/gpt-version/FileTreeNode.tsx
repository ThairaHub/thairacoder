import React, { useState } from 'react';
import { Folder, FolderOpen, FileText } from 'lucide-react';
import { CodeStructBlock } from '@/lib/types';


interface FileTreeNodeProps {
  node: CodeStructBlock;
  level?: number;
  onFileClick?: (filename: string) => void;
}

export function FileTreeNode({ node, level = 0, onFileClick }: FileTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = () => {
    if (node.type === 'folder') {
      setIsExpanded(!isExpanded);
    } else {
      onFileClick?.(node.filename || '');
    }
  };

  return (
    <div>
      <div
        className="flex items-center space-x-2 py-1 px-2 hover:bg-gray-200 rounded cursor-pointer group"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === 'folder' ? (
          isExpanded ? (
            <FolderOpen className="h-4 w-4 text-yellow-400" />
          ) : (
            <Folder className="h-4 w-4 text-gray-500" />
          )
        ) : (
          <FileText className="h-4 w-4 text-blue-400" />
        )}
        <span className="text-sm text-white-800 group-hover:text-gray-900 transition-colors">
          {node.filename}
        </span>
      </div>

      {node.type === 'folder' && isExpanded && node.children && (
        <div>
          {node.children.map((child, index) => (
            <FileTreeNode
              key={child.filename + index}
              node={child}
              level={level + 1}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
