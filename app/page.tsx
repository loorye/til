"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer
} from "recharts";

import { CASES, CASE_MAP, CaseId } from "@/lib/cases";
import { PRINCIPLES, PrincipleId } from "@/lib/principles";
import { ApiResponse, ModelResult, ScenarioPayload } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";

const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

type HistoryEntry = {
  id: string;
  timestamp: string;
  input: {
    caseId: CaseId;
    principleId: PrincipleId;
    ifConditions: string[];
    enabledModels: Array<"gpt" | "gemini" | "claude">;
    targetConfidence: number;
    scenarioText: string;
    optionA: string;
    optionB: string;
  };
  results: {
    gpt: ModelResult;
    gemini: ModelResult;
    claude: ModelResult;
  };
};

const HISTORY_STORAGE_KEY = "thought-experiment-history";

const chartColors = {
  gpt: "hsl(59, 100%, 70%)",
  gemini: "hsl(142, 71%, 45%)",
  claude: "hsl(262, 83%, 58%)"
};

const modelLabels = {
  gpt: "GPT",
  gemini: "Gemini",
  claude: "Claude"
};

function ModelIcon({ modelId }: { modelId: "gpt" | "gemini" | "claude" }) {
  const iconStyles = {
    gpt: "bg-[hsl(59,100%,70%)]/20 text-[hsl(59,100%,70%)] border-[hsl(59,100%,70%)]/40",
    gemini: "bg-[hsl(142,71%,45%)]/20 text-[hsl(142,71%,45%)] border-[hsl(142,71%,45%)]/40",
    claude: "bg-[hsl(262,83%,58%)]/20 text-[hsl(262,83%,58%)] border-[hsl(262,83%,58%)]/40"
  };

  const labels = {
    gpt: "G",
    gemini: "G",
    claude: "C"
  };

  return (
    <div
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-lg border-2 font-bold text-lg",
        iconStyles[modelId]
      )}
    >
      {labels[modelId]}
    </div>
  );
}

function ConfidenceChart({
  value,
  color
}: {
  value: number;
  color: string;
}) {
  const data = useMemo(
    () => [
      { name: "confidence", value },
      { name: "rest", value: 100 - value }
    ],
    [value]
  );

  return (
    <div className="relative h-44 w-44">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={60}
            outerRadius={78}
            startAngle={90}
            endAngle={-270}
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill="hsl(222, 15%, 22%)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-foreground">
        {value}%
      </div>
    </div>
  );
}

function ResultCard({
  title,
  color,
  result,
  error,
  enabled,
  modelId
}: {
  title: string;
  color: string;
  result: ModelResult | null;
  error?: string;
  enabled: boolean;
  modelId: "gpt" | "gemini" | "claude";
}) {
  const decisionColor =
    result?.decision === "A"
      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
      : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40";

  return (
    <Card
      className={cn(
        "h-full card-enhanced result-card-enter transition-opacity",
        !enabled && "opacity-40"
      )}
    >
      <div className="geometric-pattern"></div>
      <CardHeader className="border-b border-border/50 relative z-10">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ModelIcon modelId={modelId} />
            <span className="text-xl font-semibold">{title}</span>
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            判断
          </span>
        </CardTitle>
        <CardDescription>
          {!enabled ? "無効" : error ? "エラー発生" : "結果の要約"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 relative z-10">
        {result && enabled ? (
          <>
            <div className="flex flex-col items-center gap-3 py-2">
              <div
                className={cn(
                  "rounded-full px-6 py-2 text-3xl font-bold backdrop-blur-sm",
                  decisionColor
                )}
              >
                {result.decision}
              </div>
              <ConfidenceChart value={result.confidence} color={color} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">前提条件（最大3つ）</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                {result.key_assumptions.length ? (
                  result.key_assumptions.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))
                ) : (
                  <li>なし</li>
                )}
              </ul>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">判断の要約</p>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {result.reasoning_summary}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">if条件による変化</p>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {result.what_changed_by_if}
              </p>
            </div>
            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </>
        ) : !enabled ? (
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            チェックが外れているため無効です
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">未実行</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const [caseId, setCaseId] = useState<CaseId>("trolley");
  const [principleId, setPrincipleId] = useState<PrincipleId>("none");
  const [ifPrimary, setIfPrimary] = useState("");
  const [ifSecondary, setIfSecondary] = useState("");
  const targetConfidence = 80;
  const [scenarioText, setScenarioText] = useState(CASES[0].scenarioText);
  const [optionA, setOptionA] = useState(CASES[0].optionA);
  const [optionB, setOptionB] = useState(CASES[0].optionB);
  const [enabledModels, setEnabledModels] = useState<
    Array<"gpt" | "gemini" | "claude">
  >(["gpt", "gemini", "claude"]);
  const [results, setResults] = useState<ApiResponse["results"] | null>(null);
  const [errors, setErrors] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [randomLoading, setRandomLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const selectedCase = CASE_MAP.get(caseId) ?? CASES[0];

  useEffect(() => {
    setScenarioText(selectedCase.scenarioText);
    setOptionA(selectedCase.optionA);
    setOptionB(selectedCase.optionB);
  }, [selectedCase]);

  useEffect(() => {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as HistoryEntry[];
        setHistory(parsed);
      } catch {
        setHistory([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const buildPayload = useCallback(() => {
    const ifConditions = [ifPrimary, ifSecondary]
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 2);

    return {
      caseId,
      principleId,
      ifConditions,
      enabledModels,
      targetConfidence,
      scenarioText,
      optionA: optionA.trim(),
      optionB: optionB.trim()
    };
  }, [
    caseId,
    principleId,
    ifPrimary,
    ifSecondary,
    enabledModels,
    targetConfidence,
    scenarioText,
    optionA,
    optionB
  ]);

  const runEvaluation = useCallback(async () => {
    setLoading(true);
    setErrors(null);

    try {
      const payload = buildPayload();
      if (!payload.optionA || !payload.optionB) {
        setErrors({ global: "選択肢AとBは必須です。" });
        return;
      }
      const response = await fetch("/api/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = (await response.json()) as ApiResponse;
      setResults(data.results);
      setErrors((data as { errors?: Record<string, string> }).errors ?? null);

      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleString("ja-JP"),
        input: payload,
        results: data.results
      };
      setHistory((prev) => [entry, ...prev]);
    } catch (error) {
      setErrors({ global: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }, [buildPayload]);

  const restoreFromHistory = (entry: HistoryEntry) => {
    setCaseId(entry.input.caseId);
    setPrincipleId(entry.input.principleId);
    setIfPrimary(entry.input.ifConditions[0] ?? "");
    setIfSecondary(entry.input.ifConditions[1] ?? "");
    setScenarioText(entry.input.scenarioText);
    setOptionA(entry.input.optionA);
    setOptionB(entry.input.optionB);
    setEnabledModels(entry.input.enabledModels);
    setResults(entry.results);
  };

  const toggleModel = (modelId: "gpt" | "gemini" | "claude") => {
    setEnabledModels((prev) => {
      if (prev.includes(modelId)) {
        const next = prev.filter((item) => item !== modelId);
        return next.length ? next : prev;
      }
      return [...prev, modelId];
    });
  };

  const generateRandomScenario = async () => {
    setRandomLoading(true);
    try {
      const response = await fetch("/api/generate", { method: "POST" });
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const data = (await response.json()) as ScenarioPayload;
      setScenarioText(data.scenarioText);
      setOptionA(data.optionA);
      setOptionB(data.optionB);
    } catch (error) {
      setErrors({ global: (error as Error).message });
    } finally {
      setRandomLoading(false);
    }
  };

  const exportHistory = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "history.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen px-6 py-10 scroll-fade-in">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="page-header flex flex-col gap-4 card-enhanced p-8">
          <div className="geometric-pattern"></div>
          <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
            <div>
              <h1 className="text-4xl font-semibold mb-2 bg-gradient-to-r from-foreground via-primary to-secondary bg-clip-text text-transparent">
                思考実験 × 生成AI ワーク
              </h1>
              <p className="text-base text-muted-foreground font-light">
                GPT / Gemini / Claude
              </p>
              <p className="text-sm text-secondary mt-1">
                現在のケース: <span className="font-medium">{selectedCase.title}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider badge-glow",
                  MOCK_MODE
                    ? "border-amber-500/60 bg-amber-500/20 text-amber-300"
                    : "border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
                )}
              >
                {MOCK_MODE ? "MOCK_MODE" : "LIVE_MODE"}
              </span>
              <Button onClick={runEvaluation} disabled={loading} className="bg-primary hover:bg-primary/80 text-primary-foreground font-medium">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    実行中...
                  </>
                ) : (
                  "実行"
                )}
              </Button>
            </div>
          </div>
          {errors?.global ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive relative z-10">
              {errors.global}
            </div>
          ) : null}
        </header>

        <div className="grid gap-6 lg:grid-cols-[0.8fr_2.2fr]">
          <Card className="card-enhanced">
            <div className="geometric-pattern"></div>
            <CardHeader className="border-b border-border/50 relative z-10">
              <CardTitle>入力フォーム</CardTitle>
              <CardDescription>判断原理とif条件を設定</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[70vh] space-y-6 overflow-y-auto pr-2 relative z-10">
              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 backdrop-blur-sm">
                <Label className="text-xs uppercase tracking-wide font-semibold text-secondary">有効にするモデル</Label>
                <div className="grid gap-2 text-sm">
                  {(Object.keys(modelLabels) as Array<keyof typeof modelLabels>).map(
                    (modelId) => (
                      <label
                        key={modelId}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-card/50 px-3 py-2 transition-all hover:border-primary/40 hover:bg-card/70"
                      >
                        <span className="text-base font-semibold">
                          {modelLabels[modelId]}
                        </span>
                        <input
                          type="checkbox"
                          checked={enabledModels.includes(modelId)}
                          onChange={() => toggleModel(modelId)}
                          className="w-4 h-4 accent-primary"
                        />
                      </label>
                    )
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  少なくとも1つ選択してください。
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide font-semibold text-secondary">ケース選択</Label>
                <div className="grid gap-2">
                  {CASES.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setCaseId(item.id)}
                      className={cn(
                        "rounded-lg border px-4 py-2 text-left text-sm transition-all",
                        caseId === item.id
                          ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "border-border bg-card/50 hover:border-primary/40 hover:bg-card/70"
                      )}
                      type="button"
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="mt-2 w-full border-border hover:bg-muted/50"
                  type="button"
                  onClick={generateRandomScenario}
                  disabled={randomLoading}
                >
                  {randomLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    "ランダム生成（思考実験）"
                  )}
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>シナリオ本文（編集可）</Label>
                  <Textarea
                    value={scenarioText}
                    onChange={(event) => setScenarioText(event.target.value)}
                    className="min-h-[140px]"
                  />
                </div>
                <div className="grid gap-3 text-sm text-muted-foreground">
                  <div className="space-y-1">
                    <Label className="text-xs">選択肢A</Label>
                    <Textarea
                      value={optionA}
                      onChange={(event) => setOptionA(event.target.value)}
                      className="min-h-[90px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">選択肢B</Label>
                    <Textarea
                      value={optionB}
                      onChange={(event) => setOptionB(event.target.value)}
                      className="min-h-[90px]"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    選択肢A/Bは必須です。
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Label>判断原理</Label>
                <RadioGroup
                  value={principleId}
                  onValueChange={(value) => setPrincipleId(value as PrincipleId)}
                >
                  {PRINCIPLES.map((principle) => (
                    <div key={principle.id} className="flex items-start gap-3">
                      <RadioGroupItem value={principle.id} id={principle.id} />
                      <Label htmlFor={principle.id} className="text-sm">
                        <span className="font-semibold">{principle.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {principle.description}
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>if条件（基本）</Label>
                <Textarea
                  value={ifPrimary}
                  onChange={(event) => setIfPrimary(event.target.value)}
                  placeholder="例: 被害者は医療従事者である"
                  className="min-h-[90px]"
                />
                <Accordion type="single" collapsible>
                  <AccordionItem value="if2">
                    <AccordionTrigger>2つ目のif条件（任意）</AccordionTrigger>
                    <AccordionContent>
                      <Textarea
                        value={ifSecondary}
                        onChange={(event) => setIfSecondary(event.target.value)}
                        placeholder="追加のif条件を入力"
                        className="min-h-[90px]"
                      />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-semibold">結果比較</h2>
              <Button
                variant="outline"
                className="border-border hover:bg-muted/50"
                onClick={runEvaluation}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    実行中...
                  </>
                ) : (
                  "再実行（同一入力）"
                )}
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <ResultCard
                title={modelLabels.gpt}
                color={chartColors.gpt}
                result={results?.gpt ?? null}
                error={errors?.gpt}
                enabled={enabledModels.includes("gpt")}
                modelId="gpt"
              />
              <ResultCard
                title={modelLabels.gemini}
                color={chartColors.gemini}
                result={results?.gemini ?? null}
                error={errors?.gemini}
                enabled={enabledModels.includes("gemini")}
                modelId="gemini"
              />
              <ResultCard
                title={modelLabels.claude}
                color={chartColors.claude}
                result={results?.claude ?? null}
                error={errors?.claude}
                enabled={enabledModels.includes("claude")}
                modelId="claude"
              />
            </div>
          </div>
        </div>

        <Card className="card-enhanced">
          <div className="geometric-pattern"></div>
          <CardHeader className="border-b border-border/50 relative z-10">
            <CardTitle>履歴</CardTitle>
            <CardDescription>最新の実行結果が上に表示されます</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 relative z-10">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-border hover:bg-muted/50"
                onClick={() => setHistory([])}
                disabled={history.length === 0}
              >
                履歴をクリア
              </Button>
              <Button
                variant="outline"
                className="border-border hover:bg-muted/50"
                onClick={exportHistory}
                disabled={history.length === 0}
              >
                JSONエクスポート
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-3 text-xs uppercase tracking-wide font-semibold text-secondary">実行時刻</th>
                    <th className="px-3 py-3 text-xs uppercase tracking-wide font-semibold text-secondary">ケース</th>
                    <th className="px-3 py-3 text-xs uppercase tracking-wide font-semibold text-secondary">判断原理</th>
                    <th className="px-3 py-3 text-xs uppercase tracking-wide font-semibold text-secondary">if条件</th>
                    <th className="px-3 py-3 text-xs uppercase tracking-wide font-semibold text-secondary">結果</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-muted-foreground" colSpan={5}>
                        履歴はまだありません
                      </td>
                    </tr>
                  ) : (
                    history.map((entry) => (
                      <tr
                        key={entry.id}
                        className="cursor-pointer border-t border-border hover:bg-muted/30 transition-colors"
                        onClick={() => restoreFromHistory(entry)}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          {entry.timestamp}
                        </td>
                        <td className="px-3 py-2">
                          {CASE_MAP.get(entry.input.caseId)?.title}
                        </td>
                        <td className="px-3 py-2">
                          {
                            PRINCIPLES.find(
                              (item) => item.id === entry.input.principleId
                            )?.label
                          }
                        </td>
                        <td className="px-3 py-2">
                          {entry.input.ifConditions.join(" / ") || "なし"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          GPT:{entry.results.gpt.decision}({
                            entry.results.gpt.confidence
                          }) / Gemini:{entry.results.gemini.decision}({
                            entry.results.gemini.confidence
                          }) / Claude:{entry.results.claude.decision}({
                            entry.results.claude.confidence
                          })
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
