import { useState, useCallback } from "react";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { uploadModel, type ModelInfo } from "@/lib/api";

interface SetupTabProps {
  modelInfo: ModelInfo | null;
  onModelLoaded: (info: ModelInfo) => void;
}

export function SetupTab({ modelInfo, onModelLoaded }: SetupTabProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".pt")) {
      setError("Only .pt model files are supported");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const info = await uploadModel(file);
      onModelLoaded(info);
    } catch (e: any) {
      setError(e.message || "Failed to upload model");
    } finally {
      setLoading(false);
    }
  }, [onModelLoaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-lg font-bold text-primary glow-yellow">
          🔧 Model Setup
        </h2>
        <StatusBadge ready={!!modelInfo} />
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative rounded-md border-2 border-dashed p-12 text-center transition-all ${
          dragging
            ? "border-primary bg-primary/5 glow-box"
            : "border-border hover:border-primary/50"
        }`}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <span className="font-mono text-sm text-muted-foreground">Loading model...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drag & drop your YOLOv8 <span className="text-primary font-mono">.pt</span> model file
            </p>
            <span className="text-xs text-muted-foreground">or</span>
            <Button
              variant="outline"
              className="border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".pt";
                input.onchange = (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) handleFile(f);
                };
                input.click();
              }}
            >
              Browse Files
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* Model Info */}
      {modelInfo && (
        <div className="rounded-md border border-primary/20 bg-card p-5 glow-box space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle className="h-5 w-5" />
            <span className="font-mono text-sm font-bold uppercase tracking-wider">Model Loaded</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              ["Model Name", modelInfo.name],
              ["Classes", modelInfo.num_classes.toString()],
              ["Input Size", `${modelInfo.input_size}px`],
            ].map(([label, value]) => (
              <div key={label} className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
                <p className="font-mono text-sm text-foreground">{value}</p>
              </div>
            ))}
          </div>
          {modelInfo.classes.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Classes</span>
              <div className="flex flex-wrap gap-1.5">
                {modelInfo.classes.map((c) => (
                  <span key={c} className="rounded-sm border border-border bg-secondary px-2 py-0.5 font-mono text-xs text-foreground">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
