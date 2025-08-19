import { CodeBlock, CodeStructBlock } from "./types";


/**
 * Transform a list of CodeBlock into a nested folder/file structure
 */
export function transformCodeBlocks(codeBlocks: CodeBlock[]): CodeStructBlock[] {
  const root: Record<string, CodeStructBlock> = {};

  for (const block of codeBlocks) {
    if (!block.filename) continue;

    // Remove leading markers like '# ' or '// '
    const cleanedPath = block.filename.replace(/^(#|\/\/)\s*/, '').trim();
    const parts = cleanedPath.split('/').filter(Boolean);
    if (parts.length === 0) continue;

    insertPath(root, parts, block);
  }

  return Object.values(root);
}

/**
 * Recursively insert file into folder structure
 */
function insertPath(
  current: Record<string, CodeStructBlock>,
  parts: string[],
  block: CodeBlock
) {
  const [first, ...rest] = parts;

  if (rest.length === 0) {
    // It's a file
    current[first] = {
      type: 'file',
      language: block.language,
      filename: first,
      content: block.content,
    };
  } else {
    // It's a folder
    if (!current[first]) {
      current[first] = {
        type: 'folder',
        language: 'txt',
        filename: first,
        children: [],
      };
    }

    // Ensure children array exists
    if (!current[first].children) current[first].children = [];

    // Convert children array to map for fast lookup
    const childMap: Record<string, CodeStructBlock> = {};
    for (const child of current[first].children) {
      if (child.filename) childMap[child.filename] = child;
    }

    // Recurse into next part
    insertPath(childMap, rest, block);

    // Update children array
    current[first].children = Object.values(childMap);
  }
}
