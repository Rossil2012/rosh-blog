'use client'
import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { KernelBuilder, CoreDir, CoreFile } from "@/rosh";
import { allArticles, Article } from "contentlayer/generated";

/// Note: port from rosh/lib/helper.ts
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

class BlogFile extends CoreFile {
  constructor(content: string) {
    super({ mode: 0o644 }, Buffer.from(content));
  }
}

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
    if (pathParts.length === 0) {
      throw new Error('Invalid path');
    }

    if (pathParts.length === 1) {
      this.children_.set(pathParts[0], new BlogFile(content));
    } else {
      let subDir = this.children_.get(pathParts[0]);

      if (!subDir) {
        subDir = new BlogDir();
        this.children_.set(pathParts[0], subDir);
      }
      
      if (!(subDir instanceof BlogDir)) {
        throw new Error(`Invalid path: ${pathParts[0]} is not a directory`);
      }

      subDir.mountInner(pathParts.slice(1), content);
    }
  }
}

const Rosh = () => {
  const refXTerm = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const xtermInstance = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      disableStdin: false,
    });
    xtermInstance.open(refXTerm.current!);
    
    const setupConnection = async () => {
      try {
        const builder = KernelBuilder.default();

        let blogDir = new BlogDir();
        blogDir.mountArticles(allArticles);
        builder.withMount("/blog", blogDir);

        const [kernel, connection] = await builder.buildWithConnection();

        connection.onData((data: string) => {
          xtermInstance.write(data);
        });

        xtermInstance.onData((data: string) => {
          connection.write(data.replace(/\r\n|\r|\n/g, "\n"));
        });
      } catch (err) {
        console.error(`Failed to connect Xterm with Rosh:`, err);
      }
    };

    setupConnection();

    return () => {
      xtermInstance.dispose();
    }
  }, []);

  return <div ref={refXTerm} />;
};

export default React.memo(Rosh);
