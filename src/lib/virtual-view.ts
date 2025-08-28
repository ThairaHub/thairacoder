import * as Babel from "@babel/standalone"
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"

export interface VirtualModule {
  filename: string
  content: string
}

let moduleRegistry: Record<string, any> = {}

// Built-in modules that can be imported
const builtinModules: Record<string, any> = {
  react: {
    default: React,
    useState,
    useEffect,
    useRef,
    useCallback,
    useMemo,
    createElement: React.createElement,
    Fragment: React.Fragment,
  },
}

export function registerModules(modules: VirtualModule[]) {
  moduleRegistry = { ...builtinModules } // reset with builtins

  modules.forEach((mod) => {
    try {
      let rewritten = mod.content

      // Handle named imports: import { a, b } from 'module'
      rewritten = rewritten.replace(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g, (_, imports, path) => {
        const resolvedPath = path.startsWith(".") ? resolvePath(mod.filename, path) : path
        const importNames = imports.split(",").map((imp: string) => imp.trim())
        return importNames.map((name: string) => `const ${name} = requireModule('${resolvedPath}').${name};`).join("\n")
      })

      // Handle default imports: import X from 'module'
      rewritten = rewritten.replace(/import\s+(\w+)\s+from\s*['"]([^'"]+)['"];?/g, (_, importName, path) => {
        const resolvedPath = path.startsWith(".") ? resolvePath(mod.filename, path) : path
        return `const ${importName} = requireModule('${resolvedPath}').default || requireModule('${resolvedPath}');`
      })

      // Handle mixed imports: import X, { a, b } from 'module'
      rewritten = rewritten.replace(
        /import\s+(\w+)\s*,\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g,
        (_, defaultImport, namedImports, path) => {
          const resolvedPath = path.startsWith(".") ? resolvePath(mod.filename, path) : path
          const importNames = namedImports.split(",").map((imp: string) => imp.trim())
          const imports = [
            `const ${defaultImport} = requireModule('${resolvedPath}').default || requireModule('${resolvedPath}');`,
            ...importNames.map((name: string) => `const ${name} = requireModule('${resolvedPath}').${name};`),
          ]
          return imports.join("\n")
        },
      )

      const transformed = Babel.transform(rewritten, {
        presets: [
          ["react", { runtime: "classic" }],
          ["typescript", { allowNamespaces: true }],
        ],
        plugins: [["transform-react-jsx", { pragma: "React.createElement" }]],
      }).code

      if (!transformed) return

      moduleRegistry[mod.filename] = new Function(
        "React",
        "exports",
        "requireModule",
        transformed +
          `\nif (typeof exports.default === 'undefined' && Object.keys(exports).length === 0) {
          // If no exports, try to find a component
          const keys = Object.keys(this);
          const componentKey = keys.find(k => typeof this[k] === 'function' && k[0] === k[0].toUpperCase());
          if (componentKey) exports.default = this[componentKey];
        }`,
      )
    } catch (err) {
      console.error(`Error compiling ${mod.filename}:`, err)
      moduleRegistry[mod.filename] = () => {
        throw new Error(`Failed to compile ${mod.filename}: ${err}`)
      }
    }
  })
}

export function requireModule(filename: string) {
  const mod = moduleRegistry[filename]
  if (!mod) throw new Error(`Module ${filename} not found`)

  if (typeof mod !== "function") {
    return mod // Return builtin modules as-is
  }

  const exports: any = {}
  try {
    mod.call({}, React, exports, requireModule)
    return exports.default || exports
  } catch (err) {
    console.error(`Error executing module ${filename}:`, err)
    throw err
  }
}

// Resolve relative paths
function resolvePath(from: string, relative: string) {
  const parts = from.split("/").slice(0, -1) // remove current filename
  const relParts = relative.split("/")
  for (const part of relParts) {
    if (part === ".") continue
    else if (part === "..") parts.pop()
    else parts.push(part)
  }
  return parts.join("/")
}
