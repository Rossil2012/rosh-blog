'use client'
import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";
import { newKernel } from "@/rosh";

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
        const [kernel, connection] = await newKernel();

        connection.onData((data: string) => {
          xtermInstance.write(data);
        });

        xtermInstance.onData((data: string) => {
          connection.write(data.replace(/\r\n|\r|\n/g, "\n"));
        });
      } catch (err) {
        console.error(`Failed to connect Xterm with Rosh: ${err}`);
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
