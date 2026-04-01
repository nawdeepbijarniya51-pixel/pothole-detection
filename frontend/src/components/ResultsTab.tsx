import { useState, useEffect } from "react";
import { Download, RefreshCw, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getHistory, exportHistoryCSV, type HistoryEntry } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export function ResultsTab() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getHistory();
      setHistory(data);
    } catch {
      // Backend might not be running — use empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleExport = () => {
    if (history.length === 0) return;
    const csv = exportHistoryCSV(history);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pothole_detection_history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartData = history.map((h) => ({
    time: new Date(h.timestamp).toLocaleTimeString(),
    count: h.potholes_found,
    severity: h.severity,
  }));

  const severityColor = (sev: string) => {
    if (sev === "large" || sev === "high") return "hsl(0, 72%, 50%)";
    if (sev === "medium") return "hsl(30, 100%, 50%)";
    return "hsl(45, 100%, 50%)";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-lg font-bold text-primary glow-yellow">
          📊 Results & History
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHistory}
            className="border-border text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={history.length === 0}
            className="border-primary/30 text-primary hover:bg-primary/10"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-md border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary">
              Detection Counts
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis
                dataKey="time"
                tick={{ fill: "hsl(220, 10%, 50%)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                axisLine={{ stroke: "hsl(220, 10%, 18%)" }}
              />
              <YAxis
                tick={{ fill: "hsl(220, 10%, 50%)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                axisLine={{ stroke: "hsl(220, 10%, 18%)" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 12%, 11%)",
                  border: "1px solid hsl(220, 10%, 18%)",
                  borderRadius: 4,
                  fontFamily: "JetBrains Mono",
                  fontSize: 11,
                }}
              />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={severityColor(entry.severity)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Timestamp", "Mode", "Potholes", "Avg Conf", "Severity"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No detection history yet. Run some detections to see results here.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground">
                      {new Date(h.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-sm border border-border bg-secondary px-2 py-0.5 font-mono text-xs uppercase">
                        {h.mode}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-primary font-bold">
                      {h.potholes_found}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground">
                      {(h.avg_confidence * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`font-mono text-xs font-bold ${
                          h.severity === "large"
                            ? "text-severity-high"
                            : h.severity === "medium"
                            ? "text-severity-medium"
                            : "text-severity-low"
                        }`}
                      >
                        {h.severity.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
