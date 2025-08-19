import React from "react";
import { Highlight, Language } from "prism-react-renderer";

type CodeViewerProps = {
  code: string;
  language: Language; // use Language type from prism-react-renderer
};

export function CodeViewer({ code, language }: CodeViewerProps) {
  return (
    <Highlight code={code} language={language} >
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre className={className + " rounded-lg p-4 text-sm overflow-x-auto"} style={style}>
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line, key: i })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token, key })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}
