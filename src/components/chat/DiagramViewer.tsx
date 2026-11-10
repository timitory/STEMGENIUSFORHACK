import React, { useState } from "react";
import { GitFork, Eye, Code, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DiagramViewerProps {
  code: string;
}

interface ParsedNode {
  id: string;
  label: string;
  children?: string[];
}

export const DiagramViewer: React.FC<DiagramViewerProps> = ({ code }) => {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Diagram code copied");
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract simple nodes and connections from mermaid syntax
  const parseMermaidNodes = (rawCode: string) => {
    const lines = rawCode.split("\n");
    const nodes: { from: string; to: string; label?: string }[] = [];
    const nodeLabels: Record<string, string> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("graph") || trimmed.startsWith("flowchart") || trimmed.startsWith("mindmap")) {
        continue;
      }

      // Match A[Label A] --> B[Label B]
      const arrowMatch = trimmed.match(/([a-zA-Z0-9_-]+)(?:\[([^\]]+)\])?\s*(?:-->|---|==>)\s*(?:\|([^|]+)\|)?\s*([a-zA-Z0-9_-]+)(?:\[([^\]]+)\])?/);
      if (arrowMatch) {
        const fromId = arrowMatch[1];
        const fromLabel = arrowMatch[2] || fromId;
        const linkText = arrowMatch[3];
        const toId = arrowMatch[4];
        const toLabel = arrowMatch[5] || toId;

        nodeLabels[fromId] = fromLabel;
        nodeLabels[toId] = toLabel;
        nodes.push({ from: fromId, to: toId, label: linkText });
      } else {
        // Standalone node with label: A[Label]
        const singleMatch = trimmed.match(/([a-zA-Z0-9_-]+)\[([^\]]+)\]/);
        if (singleMatch) {
          nodeLabels[singleMatch[1]] = singleMatch[2];
        }
      }
    }

    return { nodes, nodeLabels };
  };

  const { nodes, nodeLabels } = parseMermaidNodes(code);

  return (
    <div className="my-3 rounded-2xl border border-primary/30 bg-card/90 shadow-md overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/50 border-b border-border/40 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-primary">
          <GitFork className="w-3.5 h-3.5" />
          <span>STEM Mind Map & Concept Flow</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowCode(!showCode)}
            className="h-6 text-[10px] gap-1 px-2 text-muted-foreground hover:text-foreground"
          >
            {showCode ? <Eye className="w-3 h-3" /> : <Code className="w-3 h-3" />}
            <span>{showCode ? "Visual Diagram" : "View Code"}</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            title="Copy Diagram"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Visual Content */}
      <div className="p-4 overflow-x-auto">
        {showCode ? (
          <pre className="font-mono text-xs text-foreground/90 whitespace-pre overflow-x-auto p-2 bg-secondary/30 rounded-xl">
            {code}
          </pre>
        ) : nodes.length > 0 ? (
          <div className="flex flex-col gap-3 min-w-[300px]">
            {nodes.map((node, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/30 text-primary font-bold text-xs shadow-sm max-w-[200px] truncate">
                  {nodeLabels[node.from] || node.from}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 font-mono">
                  <span>→</span>
                  {node.label && (
                    <span className="px-1.5 py-0.5 rounded bg-secondary text-[9px] text-foreground/80">
                      {node.label}
                    </span>
                  )}
                  <span>→</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-secondary border border-border/70 text-foreground font-semibold text-xs shadow-sm max-w-[200px] truncate">
                  {nodeLabels[node.to] || node.to}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-foreground/90 leading-relaxed font-mono whitespace-pre-wrap">
              {code}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

