import { Slider } from "@/components/ui/slider";

interface ConfigPanelProps {
  confidence: number;
  iou: number;
  maxDetections: number;
  onConfidenceChange: (v: number) => void;
  onIouChange: (v: number) => void;
  onMaxDetChange: (v: number) => void;
}

export function ConfigPanel({
  confidence, iou, maxDetections,
  onConfidenceChange, onIouChange, onMaxDetChange,
}: ConfigPanelProps) {
  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-4">
      <h3 className="font-mono text-xs uppercase tracking-widest text-primary">
        ⚙ Inference Config
      </h3>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-muted-foreground">Confidence Threshold</span>
            <span className="font-mono text-xs text-primary">{confidence.toFixed(2)}</span>
          </div>
          <Slider
            value={[confidence]}
            min={0.1}
            max={0.9}
            step={0.05}
            onValueChange={([v]) => onConfidenceChange(v)}
          />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-muted-foreground">IOU Threshold</span>
            <span className="font-mono text-xs text-primary">{iou.toFixed(2)}</span>
          </div>
          <Slider
            value={[iou]}
            min={0.1}
            max={0.9}
            step={0.05}
            onValueChange={([v]) => onIouChange(v)}
          />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-muted-foreground">Max Detections</span>
            <span className="font-mono text-xs text-primary">{maxDetections}</span>
          </div>
          <Slider
            value={[maxDetections]}
            min={1}
            max={100}
            step={1}
            onValueChange={([v]) => onMaxDetChange(v)}
          />
        </div>
      </div>
    </div>
  );
}
