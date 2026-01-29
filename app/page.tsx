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
import { Loader2, Sparkles, RotateCcw, Download, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
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
  gpt: "hsl(38 92% 50%)",
  gemini: "hsl(158 64% 40%)",
  claude: "hsl(262 72% 55%)"
};

const modelLabels = {
  gpt: "GPT",
  gemini: "Gemini",
  claude: "Claude"
};

function ModelIndicator({ modelId }: { modelId: "gpt" | "gemini" | "claude" }) {
  const initials = {
    gpt: "G",
    gemini: "Ge",
    claude: "Cl"
  };

  return (
    <div className={cn("model-indicator", `model-indicator--${modelId}`)}>
      {initials[modelId]}
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
    <div className="confidence-ring h-36 w-36">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={52}
            outerRadius={68}
            startAngle={90}
            endAngle={-270}
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill="hsl(35 20% 92%)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="confidence-ring__value">
        <span className="confidence-ring__number">{value}</span>
        <span className="confidence-ring__label">確信度</span>
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
  modelId,
  animationDelay
}: {
  title: string;
  color: string;
  result: ModelResult | null;
  error?: string;
  enabled: boolean;
  modelId: "gpt" | "gemini" | "claude";
  animationDelay?: string;
}) {
  return (
    <Card
      className={cn(
        "card-surface model-card h-full",
        `model-card--${modelId}`,
        !enabled && "card-disabled",
        "animate-slide-up opacity-0"
      )}
      style={{ animationDelay }}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ModelIndicator modelId={modelId} />
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight">
                {title}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {!enabled ? "無効" : error ? "エラー発生" : "判断結果"}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {result && enabled ? (
          <>
            <div className="flex flex-col items-center gap-4 py-2">
              <div
                className={cn(
                  "decision-badge",
                  result.decision === "A" ? "decision-badge--a" : "decision-badge--b"
                )}
              >
                {result.decision}
              </div>
              <ConfidenceChart value={result.confidence} color={color} />
            </div>

            <div className="space-y-4 pt-2 border-t border-border/50">
              <div>
                <p className="section-label">前提条件</p>
                <ul className="space-y-1.5">
                  {result.key_assumptions.length ? (
                    result.key_assumptions.map((item, index) => (
                      <li
                        key={index}
                        className="text-sm text-muted-foreground pl-3 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-border"
                      >
                        {item}
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-muted-foreground/60 italic">なし</li>
                  )}
                </ul>
              </div>

              <div>
                <p className="section-label">判断の要約</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {result.reasoning_summary}
                </p>
              </div>

              <div>
                <p className="section-label">if条件による変化</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {result.what_changed_by_if}
                </p>
              </div>
            </div>

            {error && (
              <div className="error-message text-sm">
                {error}
              </div>
            )}
          </>
        ) : !enabled ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <span className="text-muted-foreground/40 text-lg">—</span>
            </div>
            <p className="text-sm text-muted-foreground/60">
              モデルが無効です
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground/60">
              実行待ち
            </p>
          </div>
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
    <div className="page-container min-h-screen px-4 sm:px-6 lg:px-8 py-8">
      <div className="mx-auto max-w-7xl flex flex-col gap-8">
        {/* Header */}
        <header className="page-header card-surface rounded-xl p-6 sm:p-8 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
                思考実験 × 生成AI
              </h1>
              <p className="text-base text-muted-foreground mt-1 font-light">
                倫理的判断の比較ワークショップ
              </p>
              <div className="flex items-center gap-3 mt-3">
                <span
                  className={cn(
                    "mode-badge",
                    MOCK_MODE ? "mode-badge--mock" : "mode-badge--live"
                  )}
                >
                  <span className="mode-badge__dot" />
                  {MOCK_MODE ? "Mock Mode" : "Live Mode"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {selectedCase.title}
                </span>
              </div>
            </div>
            <Button
              onClick={runEvaluation}
              disabled={loading}
              className="btn-primary h-11 px-6 text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 spinner" />
                  評価中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  評価を実行
                </>
              )}
            </Button>
          </div>

          {errors?.global && (
            <div className="error-message mt-4">
              {errors.global}
            </div>
          )}
        </header>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Input Panel */}
          <Card className="card-surface animate-slide-up" style={{ animationDelay: "100ms" }}>
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">設定</CardTitle>
              <CardDescription>シナリオと判断原理を選択</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {/* Model Selection */}
              <div className="space-y-3">
                <Label className="section-label">有効なモデル</Label>
                <div className="grid gap-2">
                  {(Object.keys(modelLabels) as Array<keyof typeof modelLabels>).map(
                    (modelId) => (
                      <label
                        key={modelId}
                        className={cn(
                          "selection-card flex items-center justify-between",
                          enabledModels.includes(modelId) && "selection-card--active"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <ModelIndicator modelId={modelId} />
                          <span className="font-medium">{modelLabels[modelId]}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={enabledModels.includes(modelId)}
                          onChange={() => toggleModel(modelId)}
                        />
                      </label>
                    )
                  )}
                </div>
              </div>

              {/* Case Selection */}
              <div className="space-y-3">
                <Label className="section-label">ケース選択</Label>
                <div className="grid gap-2">
                  {CASES.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setCaseId(item.id)}
                      className={cn(
                        "selection-card text-left text-sm",
                        caseId === item.id && "selection-card--active"
                      )}
                      type="button"
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="btn-outline w-full mt-2"
                  type="button"
                  onClick={generateRandomScenario}
                  disabled={randomLoading}
                >
                  {randomLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 spinner" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      ランダム生成
                    </>
                  )}
                </Button>
              </div>

              {/* Scenario Text */}
              <div className="space-y-3">
                <Label className="section-label">シナリオ本文</Label>
                <Textarea
                  value={scenarioText}
                  onChange={(event) => setScenarioText(event.target.value)}
                  className="min-h-[120px] text-sm"
                />
              </div>

              {/* Options */}
              <div className="space-y-3">
                <Label className="section-label">選択肢</Label>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">
                      選択肢 A
                    </Label>
                    <Textarea
                      value={optionA}
                      onChange={(event) => setOptionA(event.target.value)}
                      className="min-h-[80px] text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">
                      選択肢 B
                    </Label>
                    <Textarea
                      value={optionB}
                      onChange={(event) => setOptionB(event.target.value)}
                      className="min-h-[80px] text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Judgment Principle */}
              <div className="space-y-3">
                <Label className="section-label">判断原理</Label>
                <RadioGroup
                  value={principleId}
                  onValueChange={(value) => setPrincipleId(value as PrincipleId)}
                  className="space-y-2"
                >
                  {PRINCIPLES.map((principle) => (
                    <div
                      key={principle.id}
                      className={cn(
                        "selection-card flex items-start gap-3 py-3",
                        principleId === principle.id && "selection-card--active"
                      )}
                    >
                      <RadioGroupItem
                        value={principle.id}
                        id={principle.id}
                        className="mt-0.5"
                      />
                      <Label htmlFor={principle.id} className="cursor-pointer flex-1">
                        <span className="font-medium text-sm block">
                          {principle.label}
                        </span>
                        <span className="text-xs text-muted-foreground mt-0.5 block leading-relaxed">
                          {principle.description}
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* If Conditions */}
              <div className="space-y-3">
                <Label className="section-label">if条件</Label>
                <Textarea
                  value={ifPrimary}
                  onChange={(event) => setIfPrimary(event.target.value)}
                  placeholder="例: 被害者は医療従事者である"
                  className="min-h-[80px] text-sm"
                />
                <Accordion type="single" collapsible>
                  <AccordionItem value="if2" className="border-none">
                    <AccordionTrigger className="text-xs text-muted-foreground hover:no-underline py-2">
                      2つ目のif条件を追加
                    </AccordionTrigger>
                    <AccordionContent>
                      <Textarea
                        value={ifSecondary}
                        onChange={(event) => setIfSecondary(event.target.value)}
                        placeholder="追加のif条件"
                        className="min-h-[80px] text-sm"
                      />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight">判断結果</h2>
              <Button
                variant="outline"
                className="btn-outline"
                onClick={runEvaluation}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 spinner" />
                    実行中
                  </>
                ) : (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    再実行
                  </>
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
                animationDelay="150ms"
              />
              <ResultCard
                title={modelLabels.gemini}
                color={chartColors.gemini}
                result={results?.gemini ?? null}
                error={errors?.gemini}
                enabled={enabledModels.includes("gemini")}
                modelId="gemini"
                animationDelay="200ms"
              />
              <ResultCard
                title={modelLabels.claude}
                color={chartColors.claude}
                result={results?.claude ?? null}
                error={errors?.claude}
                enabled={enabledModels.includes("claude")}
                modelId="claude"
                animationDelay="250ms"
              />
            </div>
          </div>
        </div>

        {/* History Section */}
        <Card className="card-surface animate-slide-up" style={{ animationDelay: "300ms" }}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">実行履歴</CardTitle>
                <CardDescription className="mt-1">
                  クリックで過去の結果を復元
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="btn-outline"
                  onClick={exportHistory}
                  disabled={history.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  エクスポート
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="btn-outline"
                  onClick={() => setHistory([])}
                  disabled={history.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  クリア
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>実行時刻</th>
                    <th>ケース</th>
                    <th>判断原理</th>
                    <th>if条件</th>
                    <th>結果</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">
                        履歴がありません
                      </td>
                    </tr>
                  ) : (
                    history.map((entry) => (
                      <tr
                        key={entry.id}
                        onClick={() => restoreFromHistory(entry)}
                      >
                        <td className="whitespace-nowrap text-sm">
                          {entry.timestamp}
                        </td>
                        <td className="text-sm">
                          {CASE_MAP.get(entry.input.caseId)?.title}
                        </td>
                        <td className="text-sm">
                          {PRINCIPLES.find((item) => item.id === entry.input.principleId)?.label}
                        </td>
                        <td className="text-sm text-muted-foreground">
                          {entry.input.ifConditions.join(" / ") || "—"}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="result-mini result-mini--gpt">
                              G: {entry.results.gpt.decision}({entry.results.gpt.confidence})
                            </span>
                            <span className="result-mini result-mini--gemini">
                              Ge: {entry.results.gemini.decision}({entry.results.gemini.confidence})
                            </span>
                            <span className="result-mini result-mini--claude">
                              Cl: {entry.results.claude.decision}({entry.results.claude.confidence})
                            </span>
                          </div>
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
