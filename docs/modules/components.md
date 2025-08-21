# React Components Module (`components/`)

The React components module provides the frontend interface for the Rosh Blog application, integrating the virtual shell system with modern React components to create an interactive blog experience.

## Module Overview

The components module consists of:

- **Terminal Component** (`Terminal.tsx`) - Interactive terminal interface using XTerm.js
- **MDX Component** (`MDX.tsx`) - Markdown content rendering with custom components
- **App Components** (`app/`) - Next.js app router components for layout and pages

## Architecture

### Component Hierarchy

```
App Layout (app/layout.tsx)
├── Home Page (app/page.tsx)
└── Terminal Component (Terminal.tsx)
    ├── XTerm.js Terminal
    ├── Rosh Kernel Integration
    └── Blog Content Mounting
```

### Integration Flow

```
Blog Content → Virtual Filesystem → Rosh Kernel → Terminal Interface → User
     ↑              ↑                    ↑            ↑
Contentlayer    BlogDir/BlogFile    System Calls   XTerm.js
```

## Core Components

### 1. Terminal Component (`Terminal.tsx`)

The main interactive component that bridges React and the virtual shell system:

#### Component Structure

```typescript
'use client'
import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { KernelBuilder, CoreDir, CoreFile } from "@/rosh";
import { allArticles, Article } from "contentlayer/generated";

const Rosh = () => {
  const refXTerm = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Terminal setup and kernel integration
  }, []);

  return <div ref={refXTerm} />;
};

export default React.memo(Rosh);
```

#### Key Features

**XTerm.js Integration:**
```typescript
const xtermInstance = new Terminal({
  cursorBlink: true,
  cursorStyle: "bar",
  disableStdin: false,
});
xtermInstance.open(refXTerm.current!);
```

**Kernel Connection:**
```typescript
const setupConnection = async () => {
  const builder = KernelBuilder.default();
  
  // Mount blog content
  let blogDir = new BlogDir();
  blogDir.mountArticles(allArticles);
  builder.withMount("/blog", blogDir);

  // Create kernel with connection
  const [kernel, connection] = await builder.buildWithConnection();

  // Bidirectional data flow
  connection.onData((data: string) => {
    xtermInstance.write(data);
  });

  xtermInstance.onData((data: string) => {
    connection.write(data.replace(/\r\n|\r|\n/g, "\n"));
  });
};
```

#### Blog Content Integration

**BlogFile Class:**
```typescript
class BlogFile extends CoreFile {
  constructor(content: string) {
    super({ mode: 0o644 }, Buffer.from(content));
  }
}
```

**BlogDir Class:**
```typescript
class BlogDir extends CoreDir {
  constructor() {
    super({ mode: 0o644 });
  }

  public mountArticles(allArticles: Article[]) {
    for (const article of allArticles) {
      const path = article._raw.flattenedPath;
      const pathParts = resolvePath(path);
      const content = article.rawContent;
      this.mountInner(pathParts, content);
    }
  }

  private mountInner(pathParts: string[], content: string) {
    if (pathParts.length === 1) {
      this.children_.set(pathParts[0], new BlogFile(content));
    } else {
      let subDir = this.children_.get(pathParts[0]);
      if (!subDir) {
        subDir = new BlogDir();
        this.children_.set(pathParts[0], subDir);
      }
      (subDir as BlogDir).mountInner(pathParts.slice(1), content);
    }
  }
}
```

#### Path Resolution

```typescript
const resolvePath = (path: string): string[] => {
  let resolved: string[] = [];
  const parts = path.split('/').filter(part => part !== '');
  for (const part of parts) {
    if (part === ".") {
      continue;
    } else if (part === "..") {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return resolved;
}
```

### 2. MDX Component (`MDX.tsx`)

Handles rendering of Markdown content with custom React components:

#### Component Implementation

```typescript
import { FC } from 'react';
import Image from 'next/image';
import { useMDXComponent } from 'next-contentlayer2/hooks';

export interface MDXProps {
  code: string;
}

const MDX: FC<MDXProps> = ({ code }) => {
  const Component = useMDXComponent(code);

  return (
    <Component 
      components={{ 
        // Override HTML elements with custom components
        img: (props: any) => <Image alt={props.alt || 'Default description'} {...props} /> 
      }} 
    />
  );
};

export default MDX;
```

#### Features

**Custom Component Mapping:**
- Maps HTML elements to custom React components
- Optimizes images using Next.js Image component
- Provides consistent styling and behavior
- Enables rich interactive content

**Content Layer Integration:**
- Works with Contentlayer for content processing
- Supports MDX with React components embedded
- Handles code compilation and rendering

### 3. App Components (`app/`)

Next.js 13+ App Router components for application structure:

#### Root Layout (`app/layout.tsx`)

```typescript
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Create Next App',
  description: 'Generated by create next app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

#### Home Page (`app/page.tsx`)

```typescript
import Rosh from '@/components/Terminal';

export default function Home() {
  return (
    <Rosh />
  );
}
```

## Component Integration Patterns

### 1. Virtual Filesystem Mounting

```typescript
// Mount blog articles as virtual files
class BlogContentMounter {
  static mountArticles(builder: KernelBuilder, articles: Article[]) {
    const blogDir = new BlogDir();
    
    // Group articles by category
    const categories = new Map<string, Article[]>();
    for (const article of articles) {
      const category = article.category || 'general';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(article);
    }

    // Mount each category as a subdirectory
    for (const [category, categoryArticles] of categories) {
      const categoryDir = new BlogDir();
      for (const article of categoryArticles) {
        const filename = `${article.slug}.md`;
        categoryDir.children_.set(filename, new BlogFile(article.rawContent));
      }
      blogDir.children_.set(category, categoryDir);
    }

    builder.withMount("/blog", blogDir);
  }
}
```

### 2. Real-time Terminal Communication

```typescript
class TerminalBridge {
  private xterm: Terminal;
  private connection: RoshConnection;

  constructor(xterm: Terminal, connection: RoshConnection) {
    this.xterm = xterm;
    this.connection = connection;
    this.setupBidirectionalComm();
  }

  private setupBidirectionalComm() {
    // Terminal → Kernel
    this.xterm.onData((data: string) => {
      // Normalize line endings
      const normalizedData = data.replace(/\r\n|\r|\n/g, "\n");
      this.connection.write(normalizedData);
    });

    // Kernel → Terminal
    this.connection.onData((data: string) => {
      this.xterm.write(data);
    });

    // Handle terminal resize
    this.xterm.onResize(({ cols, rows }) => {
      this.connection.resize(cols, rows);
    });
  }

  dispose() {
    this.connection.close();
  }
}
```

### 3. Content Processing Pipeline

```typescript
interface ContentProcessor {
  processMarkdown(content: string): string;
  extractMetadata(content: string): Record<string, any>;
  generatePreview(content: string): string;
}

class BlogContentProcessor implements ContentProcessor {
  processMarkdown(content: string): string {
    // Add syntax highlighting for code blocks
    // Process internal links
    // Add custom directives
    return content;
  }

  extractMetadata(content: string): Record<string, any> {
    // Extract frontmatter
    // Parse title, date, tags
    // Generate slug
    return {};
  }

  generatePreview(content: string): string {
    // Generate article preview
    // Truncate content
    // Remove markdown formatting
    return content.slice(0, 200) + '...';
  }
}
```

## Usage Examples

### Custom Terminal Commands

```typescript
// Register custom commands that interact with blog content
class BlogCommands {
  static registerCommands(builder: KernelBuilder) {
    // Command to list blog articles
    builder.withCommand('blog-list', class extends Process {
      async *run(): AsyncGenerator<Syscall, number, unknown> {
        const fd = yield SysOpen('/blog', OpenFlags.DIR | OpenFlags.READ);
        const entries = yield SysGetdents(fd);
        
        for (const entry of entries) {
          yield SysWrite(stdout, Buffer.from(`${entry}\n`));
        }
        
        yield SysClose(fd);
        return 0;
      }
    });

    // Command to search blog content
    builder.withCommand('blog-search', class extends Process {
      async *run(query: string): AsyncGenerator<Syscall, number, unknown> {
        if (!query) {
          yield SysWrite(stderr, Buffer.from('Usage: blog-search <query>\n'));
          return 1;
        }

        // Search through blog files
        // Implementation details...
        return 0;
      }
    });
  }
}
```

### Advanced Terminal Configuration

```typescript
const createAdvancedTerminal = (container: HTMLElement) => {
  const terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: 'bar',
    disableStdin: false,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      selection: '#3a3d41',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
    },
    allowTransparency: true,
    bellStyle: 'sound',
    convertEol: true,
    scrollback: 1000,
  });

  terminal.open(container);
  return terminal;
};
```

### Component State Management

```typescript
const useTerminalState = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  
  const connectToKernel = useCallback(async () => {
    try {
      setConnectionError(null);
      
      const builder = KernelBuilder.default();
      // ... setup code
      
      setIsConnected(true);
    } catch (error) {
      setConnectionError(error.message);
      setIsConnected(false);
    }
  }, []);

  return {
    isConnected,
    connectionError,
    terminalReady,
    connectToKernel,
  };
};
```

## Performance Optimization

### Component Memoization

```typescript
const Terminal = React.memo(() => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison logic
  return true; // No props to compare
});

const MDXComponent = React.memo<MDXProps>(({ code }) => {
  // Component implementation
}, (prevProps, nextProps) => {
  return prevProps.code === nextProps.code;
});
```

### Lazy Loading

```typescript
const LazyTerminal = React.lazy(() => import('@/components/Terminal'));

const HomePage = () => {
  return (
    <Suspense fallback={<div>Loading terminal...</div>}>
      <LazyTerminal />
    </Suspense>
  );
};
```

### Resource Cleanup

```typescript
useEffect(() => {
  const terminal = new Terminal();
  let connection: RoshConnection;
  
  const setup = async () => {
    connection = await setupKernelConnection();
    // ... setup code
  };
  
  setup();

  return () => {
    // Cleanup resources
    terminal.dispose();
    connection?.close();
  };
}, []);
```

## Styling and Theming

### CSS Integration

```css
/* globals.css */
.xterm {
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #333;
}

.xterm .xterm-viewport {
  background-color: transparent;
}

.xterm .xterm-screen {
  background-color: transparent;
}
```

### Responsive Design

```typescript
const useResponsiveTerminal = () => {
  const [dimensions, setDimensions] = useState({ cols: 80, rows: 24 });
  
  useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      const cols = Math.floor(width / 9); // Approximate character width
      const rows = Math.floor(height / 17); // Approximate line height
      
      setDimensions({ cols, rows });
    };
    
    window.addEventListener('resize', updateDimensions);
    updateDimensions();
    
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);
  
  return dimensions;
};
```

## File References

- [`Terminal.tsx`](../files/components/Terminal.md) - Interactive terminal component with XTerm.js
- [`MDX.tsx`](../files/components/MDX.md) - Markdown content rendering component
- [`app/layout.tsx`](../files/components/layout.md) - Next.js root layout component
- [`app/page.tsx`](../files/components/page.md) - Home page component

The React components module provides a seamless integration between modern React development patterns and the virtual shell system, creating an innovative blog interface that combines traditional web UI with interactive command-line functionality.