import React, { Component, ErrorInfo, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface ErrorBoundaryProps {
  fallbackText: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class MathErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("MathRenderer fallback triggered:", error.message);
  }

  render() {
    if (this.state.hasError) {
      return <span>{this.props.fallbackText}</span>;
    }
    return this.props.children;
  }
}

interface MathRendererProps {
  content: string;
  className?: string;
}

export const MathRenderer: React.FC<MathRendererProps> = ({ content, className = "" }) => {
  if (!content) return null;

  return (
    <MathErrorBoundary fallbackText={content}>
      <div className={`prose prose-invert max-w-none text-foreground break-words ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false, output: "htmlAndMathml" }]]}
          components={{
            p: ({ children }) => <p className="mb-1 leading-relaxed last:mb-0 inline-block w-full">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
            code: ({ children }) => (
              <code className="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono text-primary">
                {children}
              </code>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </MathErrorBoundary>
  );
};


