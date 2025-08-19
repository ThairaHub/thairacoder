import React from 'react';

import { FileTreeNode } from './FileTreeNode';
import { CodeStructBlock } from '@/lib/types';

interface FileTreeProps {
  nodes: CodeStructBlock[];
  onFileClick?: (filename: string) => void;
}

export function FileTree({ nodes, onFileClick }: FileTreeProps) {
  return (
    <div>
      {nodes.map((node, index) => (
        <FileTreeNode
          key={node.filename + index}
          node={node}
          level={0}
          onFileClick={onFileClick}
        />
      ))}
    </div>
  );
}
