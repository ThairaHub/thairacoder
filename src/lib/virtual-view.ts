// virtualModules.ts
import * as Babel from '@babel/standalone';
import React from 'react';

export interface VirtualModule {
  filename: string;
  content: string;
}

let moduleRegistry: Record<string, any> = {};

export function registerModules(modules: VirtualModule[]) {
  moduleRegistry = {}; // reset

  modules.forEach((mod) => {
    try {
      // Rewrite imports: "import X from './Y'" → "const X = requireModule('./Y').default;"
      const rewritten = mod.content.replace(
        /import\s+([\w{},\s]+)\s+from\s+['"](.+)['"];?/g,
        (_, imports, path) => {
          // Default import only
          const defaultImport = imports.split(',')[0].trim();
          return `const ${defaultImport} = requireModule('${resolvePath(mod.filename, path)}').default;`;
        }
      );

      const transformed = Babel.transform(rewritten, {
        presets: ['react', 'typescript'],
      }).code;

      if (!transformed) return;

      moduleRegistry[mod.filename] = new Function(
        'React',
        'exports',
        'requireModule',
        transformed + `\nreturn exports;`
      );
    } catch (err) {
      console.error(`Error compiling ${mod.filename}:`, err);
    }
  });
}

export function requireModule(filename: string) {
  const mod = moduleRegistry[filename];
  if (!mod) throw new Error(`Module ${filename} not found`);
  const exports: any = {};
  mod(React, exports, requireModule);
  return exports.default || exports;
}

// Resolve relative paths
function resolvePath(from: string, relative: string) {
  const parts = from.split('/').slice(0, -1); // remove current filename
  const relParts = relative.split('/');
  for (const part of relParts) {
    if (part === '.') continue;
    else if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}
