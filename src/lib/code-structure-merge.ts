import { CodeStructBlock } from './types';

/**
 * Merge new CodeStructBlocks with existing ones
 * - Folders with same name: merge their children
 * - Files with same name: replace content
 * - New items: add to structure
 */
export function mergeCodeStructBlocks(
  existing: CodeStructBlock[],
  newBlocks: CodeStructBlock[]
): CodeStructBlock[] {
  if (existing.length === 0) return newBlocks;
  if (newBlocks.length === 0) return existing;

  const result = [...existing];
  const existingMap = new Map<string, number>();
  
  // Create index map for existing blocks
  existing.forEach((block, index) => {
    if (block.filename) {
      existingMap.set(block.filename, index);
    }
  });

  for (const newBlock of newBlocks) {
    if (!newBlock.filename) continue;

    const existingIndex = existingMap.get(newBlock.filename);
    
    if (existingIndex !== undefined) {
      const existingBlock = result[existingIndex];
      
      if (existingBlock.type === 'folder' && newBlock.type === 'folder') {
        // Merge folder children
        result[existingIndex] = {
          ...existingBlock,
          children: mergeCodeStructBlocks(
            existingBlock.children || [],
            newBlock.children || []
          )
        };
      } else {
        // Replace file or convert folder to file
        result[existingIndex] = newBlock;
      }
    } else {
      // Add new block
      result.push(newBlock);
      existingMap.set(newBlock.filename, result.length - 1);
    }
  }

  return result;
}

/**
 * Get all files recursively from CodeStructBlocks
 */
export function getAllFilesFromBlocks(blocks: CodeStructBlock[]): CodeStructBlock[] {
  const files: CodeStructBlock[] = [];
  
  const traverse = (nodes: CodeStructBlock[]) => {
    for (const node of nodes) {
      if (node.type === 'file' && node.filename) {
        files.push(node);
      } else if (node.type === 'folder' && node.children) {
        traverse(node.children);
      }
    }
  };
  
  traverse(blocks);
  return files;
}
