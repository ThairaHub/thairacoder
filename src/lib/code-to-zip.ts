import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { CodeStructBlock } from './types';

function normalizeFilename(filename?: string) {
  if (!filename || typeof filename !== 'string') return 'file';
  return filename.replace(/^[#\/\s]+/, '');
}

export async function downloadCodeAsZip(blocks: CodeStructBlock[]) {
  const zip = new JSZip();

  function addBlockToZip(block: CodeStructBlock, parentFolder: JSZip) {
    if (block.type === 'file' && block.filename) {
      const fileName = normalizeFilename(block.filename);
      parentFolder.file(fileName, block.content || '');
    } else if (block.type === 'folder' && block.children) {
      const folderName = normalizeFilename(block.filename || 'folder');
      const folder = parentFolder.folder(folderName)!;
      
      // Process each child block directly (they should already be CodeStructBlock objects)
      block.children.forEach((child) => {
        if (typeof child === 'object' && child.filename) {
          addBlockToZip(child, folder);
        } else if (typeof child === 'string') {
          // Fallback for string references - create empty file
          folder.file(normalizeFilename(child), '');
        }
      });
    }
  }

  // Add all top-level blocks
  blocks.forEach(block => addBlockToZip(block, zip));

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, 'code-structure.zip');
}
