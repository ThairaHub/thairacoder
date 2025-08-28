# AI Code Assistant Project

An advanced AI-powered code generation and preview interface that integrates with Ollama and Gemini APIs to provide real-time code generation, file structure management, and live component preview.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Code Structure Block System](#code-structure-block-system)
3. [Architecture](#architecture)
4. [Key Components](#key-components)
5. [Features](#features)
6. [Setup and Installation](#setup-and-installation)
7. [Usage Guide](#usage-guide)

## Project Overview

This project is a React-based application that provides an interactive interface for AI-powered code generation. It features a sophisticated file structure management system, real-time streaming responses, and live preview capabilities for React components.

### Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **UI Components**: Radix UI, Shadcn/ui
- **AI Integration**: Ollama (local), Gemini API (cloud)
- **Code Highlighting**: Prism React Renderer
- **File Management**: JSZip, File-saver
- **Build Tool**: Vite

## Code Structure Block System

The **Code Structure Block System** is the core architecture that manages file structures and code content throughout the application. This system transforms AI-generated code responses into a hierarchical, manageable structure.

### Core Types

#### CodeBlock
\`\`\`typescript
export interface CodeBlock {
  language: string;      // Programming language (e.g., 'tsx', 'css', 'js')
  filename?: string;     // Optional filename with path
  content: string;       // Actual code content
}
\`\`\`

#### CodeStructBlock
\`\`\`typescript
export interface CodeStructBlock {
  type: 'file' | 'folder';    // Block type
  language: string;           // Language for syntax highlighting
  filename?: string;          // Name/path of the file or folder
  content?: string;           // Code content (for files only)
  children?: CodeStructBlock[]; // Child blocks (for folders only)
}
\`\`\`

### Key Modules

#### 1. Code Structure Transformation (`src/lib/code-structure-block.ts`)

**Purpose**: Converts flat CodeBlock arrays into hierarchical CodeStructBlock trees.

**Main Functions**:
- `transformCodeBlocks(codeBlocks: CodeBlock[]): CodeStructBlock[]`
  - Transforms flat code blocks into nested folder/file structure
  - Handles path parsing and hierarchy creation
  - Cleans filename markers (removes `#` or `//` prefixes)

**Algorithm**:
1. Parse each CodeBlock filename into path components
2. Create nested folder structure based on path hierarchy
3. Insert files at their appropriate locations
4. Return top-level structure

**Example**:
\`\`\`typescript
// Input CodeBlocks
[
  { language: 'tsx', filename: 'src/components/App.tsx', content: '...' },
  { language: 'css', filename: 'src/styles/main.css', content: '...' }
]

// Output CodeStructBlocks
[
  {
    type: 'folder',
    filename: 'src',
    children: [
      {
        type: 'folder', 
        filename: 'components',
        children: [
          { type: 'file', filename: 'App.tsx', language: 'tsx', content: '...' }
        ]
      },
      {
        type: 'folder',
        filename: 'styles', 
        children: [
          { type: 'file', filename: 'main.css', language: 'css', content: '...' }
        ]
      }
    ]
  }
]
\`\`\`

#### 2. Code Structure Merging (`src/lib/code-structure-merge.ts`)

**Purpose**: Intelligently merges new CodeStructBlocks with existing ones, enabling incremental updates.

**Main Functions**:

- `mergeCodeStructBlocks(existing: CodeStructBlock[], newBlocks: CodeStructBlock[]): CodeStructBlock[]`
  - **Folder Merging**: Folders with same name merge their children
  - **File Replacement**: Files with same name get replaced with new content
  - **Addition**: New items are added to structure

- `getAllFilesFromBlocks(blocks: CodeStructBlock[]): CodeStructBlock[]`
  - Recursively extracts all files from the hierarchical structure
  - Used for operations like file selection and ZIP downloads

**Merging Strategy**:
\`\`\`typescript
// Existing structure:
[{ type: 'folder', filename: 'src', children: [existing files] }]

// New structure: 
[{ type: 'folder', filename: 'src', children: [new files] }]

// Result: Merged children in 'src' folder
[{ type: 'folder', filename: 'src', children: [existing + new files] }]
\`\`\`

#### 3. Code-to-ZIP Export (`src/lib/code-to-zip.ts`)

**Purpose**: Converts CodeStructBlocks into downloadable ZIP archives.

**Features**:
- Preserves folder hierarchy
- Handles filename normalization
- Creates proper file structure in ZIP
- Exports via browser download

### File Tree Components

#### FileTreeNode (`src/components/gpt-version/FileTreeNode.tsx`)
- Basic file tree display
- Folder expansion/collapse
- File click handling
- Visual icons for files/folders

#### FileTreeNodeWithSelection (`src/components/gpt-version/FileTreeNodeWithSelection.tsx`)
- Enhanced version with checkbox selection
- Multi-file selection for context
- Used in context selection for AI prompts

### Integration Points

#### PreviewPane Integration
The PreviewPane component (`src/components/PreviewPane.tsx`) serves as the main consumer of the Code Structure Block system:

1. **Parsing**: Extracts CodeBlocks from AI responses
2. **Transformation**: Converts to CodeStructBlocks
3. **Merging**: Accumulates blocks from multiple AI responses
4. **Display**: Renders file tree and content viewer
5. **Selection**: Manages file selection for AI context

#### Chat Integration
The ChatInterface (`src/components/ChatInterface.tsx`) uses selected files as context:

\`\`\`typescript
// Selected files are passed as context to AI
const context = selectedFiles.map(file => 
  `// File: ${file.filename}\n${file.content}`
).join('\n\n');
\`\`\`

## Architecture

### Component Hierarchy
\`\`\`
App
├── Index (main page)
├── ChatInterface
│   ├── ChatMessage components
│   └── OllamaModelSelector
└── PreviewPane
    ├── FileTreeNodeWithSelection
    ├── CodeViewer (syntax highlighting)
    └── LivePreview (React component rendering)
\`\`\`

### Data Flow
1. **User Input** → ChatInterface
2. **AI Request** → useOllama hook → Ollama/Gemini API
3. **AI Response** → Parse CodeBlocks → Transform to CodeStructBlocks
4. **Merge** → Update application state
5. **Display** → File tree + Content viewer
6. **Selection** → Context for next AI request

## Key Components

### useOllama Hook (`src/hooks/useOllama.ts`)
- **Streaming Support**: Real-time token streaming
- **Multi-Provider**: Ollama (local) and Gemini (cloud)
- **Context Handling**: Accepts selected files as context
- **Error Management**: Comprehensive error handling

### LivePreview (`src/components/gpt-version/LivePreview.tsx`)
- **Dynamic Rendering**: Renders React components from code strings
- **Hot Module Replacement**: Updates components in real-time
- **Babel Transformation**: Converts JSX/TSX to executable code
- **Virtual Module System**: Manages component dependencies

### Virtual View System (`src/lib/virtual-view.ts`)
- **Module Resolution**: Handles imports and dependencies
- **Code Compilation**: Babel-based JSX/TSX transformation
- **Error Handling**: Compilation and runtime error management

## Features

### 1. AI Code Generation
- **Streaming Responses**: Real-time token streaming from AI
- **Context Awareness**: Uses selected files as context
- **Multi-Provider Support**: Ollama (local) and Gemini (cloud)

### 2. File Structure Management
- **Hierarchical Display**: Nested folder/file structure
- **File Selection**: Multi-select for AI context
- **Content Viewing**: Syntax-highlighted code display
- **ZIP Export**: Download complete project structures

### 3. Live Preview
- **React Component Rendering**: Real-time component preview
- **Hot Updates**: Instant updates on code changes
- **Error Handling**: Visual error display and debugging

### 4. Code Structure Persistence
- **Incremental Updates**: Merge new code with existing
- **Structure Preservation**: Maintain folder hierarchy
- **Content Management**: Handle file updates and additions

## Setup and Installation

1. **Clone the repository**
\`\`\`bash
git clone <repository-url>
cd ai-code-assistant
\`\`\`

2. **Install dependencies**
\`\`\`bash
npm install
\`\`\`

3. **Setup Ollama (optional, for local AI)**
\`\`\`bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull required models
ollama pull deepseek-r1:8b
ollama pull gemma2:2b
\`\`\`

4. **Configure API Keys (optional, for Gemini)**
- Add Gemini API key when prompted in the application

5. **Start development server**
\`\`\`bash
npm run dev
\`\`\`

## Usage Guide

### Basic Workflow

1. **Start a Conversation**
   - Open the chat interface
   - Select AI provider (Ollama/Gemini)
   - Ask for code generation

2. **Review Generated Code**
   - Switch to "Code" view
   - Browse the file structure
   - Select files to view content

3. **Use Context Selection**
   - Select relevant files for context
   - Files appear in subsequent AI requests
   - Use "Select All" or individual selection

4. **Preview Components**
   - Switch to "Preview" mode
   - View live React component rendering
   - See real-time updates

5. **Export Code**
   - Use "Download All Code" button
   - Get complete project as ZIP file

### Advanced Features

#### Custom Context Prompts
\`\`\`typescript
// Example: Using file context in prompts
const prompt = `
Based on the existing ${selectedFiles.length} files, 
please add a new authentication component that integrates 
with our current structure.
`;
\`\`\`

#### Component Live Editing
- Generated React components render immediately
- Edit code and see instant updates
- Debugging support with error display

## Code Structure Block System - Advanced Usage

### Custom Transformations
\`\`\`typescript
// Custom block transformation
const customBlocks = transformCodeBlocks(codeBlocks);
const mergedBlocks = mergeCodeStructBlocks(existingBlocks, customBlocks);
\`\`\`

### File Operations
\`\`\`typescript
// Get all files recursively
const allFiles = getAllFilesFromBlocks(codeStructBlocks);

// Find specific file
const targetFile = findFileByName(codeStructBlocks, 'App.tsx');

// Export to ZIP
downloadCodeAsZip(codeStructBlocks);
\`\`\`

This system provides a robust foundation for managing AI-generated code structures, enabling complex file hierarchies, incremental updates, and seamless integration with modern React development workflows.

---

## Original Lovable Project Information

**URL**: https://lovable.dev/projects/f2541fac-1827-4e17-ba6b-99b290fd0192

This project was built with Lovable and can be edited directly at the project URL or locally using your preferred IDE.
