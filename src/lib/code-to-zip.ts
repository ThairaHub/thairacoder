import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { CodeStructBlock } from './types';

function normalizeFilename(filename?: string) {
  if (!filename || typeof filename !== 'string') return 'file';
  return filename.replace(/^[#\/\s]+/, '');
}

export async function downloadCodeAsZip(blocks: CodeStructBlock[]) {
  const zip = new JSZip();

  // Map normalized full filenames to blocks for quick lookup
  const blockMap = new Map(blocks.map(b => [normalizeFilename(b.filename), b]));

  function addBlockToZip(block: CodeStructBlock, parentFolder: JSZip) {
    if (block.type === 'file' && block.filename) {
      const pathParts = normalizeFilename(block.filename).split('/').filter(Boolean);
      let currentFolder = parentFolder;
      for (let i = 0; i < pathParts.length - 1; i++) {
        currentFolder = currentFolder.folder(pathParts[i])!;
      }
      const fileName = pathParts[pathParts.length - 1] || 'file';
      currentFolder.file(fileName, block.content || '');
    } else if (block.type === 'folder' && block.children) {
      const folder = parentFolder.folder(normalizeFilename(block.filename || 'folder'))!;
      block.children.forEach((child) => {
        // Determine the child filename safely
        const childFilename = typeof child === 'string' ? child : child.filename;
        if (!childFilename) return;

        const childBlock = blockMap.get(normalizeFilename(childFilename));
        if (childBlock) addBlockToZip(childBlock, folder);
        else folder.file(normalizeFilename(childFilename), '');
      });
    }
  }

  // Add all top-level blocks
  blocks.forEach(block => addBlockToZip(block, zip));

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, 'code-structure.zip');
}
