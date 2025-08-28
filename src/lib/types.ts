export type TreeNode = {
  name: string;
  type: "file" | "folder";
  expanded?: boolean;
  children?: TreeNode[];
  comment?: string;
};

export interface CodeBlock {
  language: string;
  filename?: string;
  content: string;
}

export interface CodeStructBlock {
  type: 'file' | 'folder';
  language: string;
  filename?: string;
  content?: string;
  children?: CodeStructBlock[];
}

export type Model = 'gpt-oss:20b' | 'deepseek-r1:8b' | 'gemma3:12b'

export const aiResponse = `
\`\`\`txt
root/
├─ backend/
│  ├─ main.py
│  └─ requirements.txt
├─ frontend/
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ next.config.js
│  ├─ pages/
│  │  └─ index.tsx
│  ├─ components/
│  │  └─ TodoList.tsx
│  ├─ styles/
│  │  └─ Home.module.css
│  └─ utils/
│     └─ api.ts
└─ .env
\`\`\`

\`\`\`python
# backend/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from uuid import uuid4

app = FastAPI()

class Todo(BaseModel):
    id: str
    title: str
    completed: bool = False

class TodoCreate(BaseModel):
    title: str

todos: List[Todo] = []

@app.get("/todos", response_model=List[Todo])
async def read_todos():
    return todos

@app.post("/todos", response_model=Todo, status_code=201)
async def create_todo(todo: TodoCreate):
    new_todo = Todo(id=str(uuid4()), title=todo.title)
    todos.append(new_todo)
    return new_todo

@app.delete("/todos/{todo_id}", status_code=204)
async def delete_todo(todo_id: str):
    global todos
    todos = [t for t in todos if t.id != todo_id]
    return
\`\`\`

\`\`\`txt
# backend/requirements.txt
fastapi
uvicorn
\`\`\`

\`\`\`json
// frontend/package.json
{
  "name": "todo-next",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "latest",
    "react": "latest",
    "react-dom": "latest",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0"
  }
}
\`\`\`

\`\`\`json
// frontend/tsconfig.json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": false,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve"
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
\`\`\`

\`\`\`js
// frontend/next.config.js
module.exports = {
  reactStrictMode: true,
}
\`\`\`

\`\`\`tsx
// frontend/pages/index.tsx
import { useEffect, useState } from 'react';
import TodoList from '../components/TodoList';
import { fetchTodos, createTodo } from '../utils/api';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState('');

  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    const data = await fetchTodos();
    setTodos(data);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await createTodo({ title });
    setTitle('');
    loadTodos();
  };

  return (
    <div className={styles.container}>
      <h1>Todo List</h1>
      <form onSubmit={handleAdd}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New todo"
          className={styles.input}
        />
        <button type="submit" className={styles.button}>Add</button>
      </form>
      <TodoList todos={todos} onDelete={loadTodos} />
    </div>
  );
}
\`\`\`

\`\`\`tsx
// frontend/components/TodoList.tsx
import { FC } from 'react';
import { deleteTodo } from '../utils/api';
import styles from '../styles/Home.module.css';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

interface Props {
  todos: Todo[];
  onDelete: () => void;
}

const TodoList: FC<Props> = ({ todos, onDelete }) => {
  const handleDelete = async (id: string) => {
    await deleteTodo(id);
    onDelete();
  };

  return (
    <ul className={styles.list}>
      {todos.map((todo) => (
        <li key={todo.id} className={styles.listItem}>
          {todo.title}
          <button onClick={() => handleDelete(todo.id)} className={styles.deleteButton}>Delete</button>
        </li>
      ))}
    </ul>
  );
};

export default TodoList;
\`\`\`

\`\`\`css
/* frontend/styles/Home.module.css */
.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
  font-family: Arial, sans-serif;
}
.input {
  padding: 0.5rem;
  margin-right: 0.5rem;
  width: 70%;
}
.button {
  padding: 0.5rem 1rem;
}
.list {
  list-style: none;
  padding: 0;
  margin-top: 1rem;
}
.listItem {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #ccc;
}
.deleteButton {
  background: transparent;
  border: none;
  color: red;
  cursor: pointer;
}
\`\`\`

\`\`\`ts
// frontend/utils/api.ts
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export const fetchTodos = async () => {
  const res = await axios.get(\`\${API_BASE}/todos\`);
  return res.data;
};

export const createTodo = async (payload: { title: string }) => {
  const res = await axios.post(\`\${API_BASE}/todos\`, payload);
  return res.data;
};

export const deleteTodo = async (id: string) => {
  await axios.delete(\`\${API_BASE}/todos/\${id}\`);
};
\`\`\`

\`\`\`dotenv
# .env
BACKEND_PORT=8000
\`\`\`
`;
