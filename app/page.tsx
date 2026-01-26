"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Label as PieLabel
} from "recharts";

import { CASES, CASE_MAP, CaseId } from "@/lib/cases";
import { PRINCIPLES, PrincipleId } from "@/lib/principles";
import { ApiResponse, ModelResult, ScenarioPayload } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  gpt: "#2563eb",
  gemini: "#16a34a",
  claude: "#9333ea"
};

const modelLabels = {
  gpt: "GPT",
  gemini: "Gemini",
  claude: "Claude"
};

const modelIcons = {
  gpt: "🤖",
  gemini: "✨",
  claude: "🧠"
};


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
    <div className="h-40 w-40">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={55}
            outerRadius={70}
            startAngle={90}
            endAngle={-270}
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill="#e5e7eb" />
            <PieLabel
              value={`${value}%`}
              position="center"
              className="text-lg font-semibold"
            />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function ResultCard({
  title,
  color,
  result,
  error,
  enabled
}: {
  title: string;
  color: string;
  result: ModelResult | null;
  error?: string;
  enabled: boolean;
}) {
  const decisionColor =
    result?.decision === "A"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-indigo-100 text-indigo-700";

  return (
    <Card
      className={cn(
        "h-full border-slate-200 shadow-none transition-opacity",
        !enabled && "opacity-50"
      )}
    >
      <CardHeader className="border-b border-slate-200">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="text-lg">{modelIcons[title.toLowerCase() as keyof typeof modelIcons] ?? "🤖"}</span>
            {title}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            判断
          </span>
        </CardTitle>
        <CardDescription>
          {!enabled ? "無効" : error ? "エラー発生" : "結果の要約"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result && enabled ? (
          <>
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "rounded-full px-6 py-2 text-3xl font-bold",
                  decisionColor
                )}
              >
                {result.decision}
              </div>
              <ConfidenceChart value={result.confidence} color={color} />
            </div>
            <div>
              <p className="text-sm font-semibold">前提条件（最大3つ）</p>
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
            <div>
              <p className="text-sm font-semibold">判断の要約</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.reasoning_summary}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold">if条件による変化</p>
              <p className="mt-1 text-sm text-muted-foreground">
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
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
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
  const [principleId, setPrincipleId] = useState<PrincipleId>(
    "utilitarian"
  );
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
      optionA,
      optionB
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
      const response = await fetch("/api/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload())
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
        input: buildPayload(),
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
    <div className="min-h-screen bg-white px-6 py-10 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">
                思考実験 比較デモ（GPT / Gemini / Claude）
              </h1>
              <p className="text-sm text-muted-foreground">
                現在のケース: {selectedCase.title}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold",
                  MOCK_MODE
                    ? "border-amber-200 bg-amber-100/60 text-amber-700"
                    : "border-emerald-200 bg-emerald-100/60 text-emerald-700"
                )}
              >
                {MOCK_MODE ? "MOCK_MODE" : "LIVE_MODE"}
              </span>
              <Button onClick={runEvaluation} disabled={loading}>
                {loading ? "実行中..." : "実行"}
              </Button>
            </div>
          </div>
          {errors?.global ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {errors.global}
            </div>
          ) : null}
        </header>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_2.1fr]">
          <Card className="border-slate-200 shadow-none">
            <CardHeader className="border-b border-slate-200">
              <CardTitle>入力フォーム</CardTitle>
              <CardDescription>判断原理とif条件を設定</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Label>有効にするモデル</Label>
                <div className="grid gap-2 text-sm">
                  {(Object.keys(modelLabels) as Array<keyof typeof modelLabels>).map(
                    (modelId) => (
                      <label
                        key={modelId}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-lg">{modelIcons[modelId]}</span>
                          {modelLabels[modelId]}
                        </span>
                        <input
                          type="checkbox"
                          checked={enabledModels.includes(modelId)}
                          onChange={() => toggleModel(modelId)}
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
                <Label>ケース選択</Label>
                <div className="grid gap-2">
                  {CASES.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setCaseId(item.id)}
                      className={cn(
                        "rounded-lg border px-4 py-2 text-left text-sm transition-colors",
                        caseId === item.id
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      )}
                      type="button"
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="mt-2 w-full border-slate-200"
                  type="button"
                  onClick={generateRandomScenario}
                  disabled={randomLoading}
                >
                  {randomLoading ? "生成中..." : "ランダム生成（思考実験）"}
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
                <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">選択肢A</Label>
                    <Input
                      value={optionA}
                      onChange={(event) => setOptionA(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">選択肢B</Label>
                    <Input
                      value={optionB}
                      onChange={(event) => setOptionB(event.target.value)}
                    />
                  </div>
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
                <Input
                  value={ifPrimary}
                  onChange={(event) => setIfPrimary(event.target.value)}
                  placeholder="例: 被害者は医療従事者である"
                />
                <Accordion type="single" collapsible>
                  <AccordionItem value="if2">
                    <AccordionTrigger>2つ目のif条件（任意）</AccordionTrigger>
                    <AccordionContent>
                      <Input
                        value={ifSecondary}
                        onChange={(event) => setIfSecondary(event.target.value)}
                        placeholder="追加のif条件を入力"
                      />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">結果比較</h2>
              <Button
                variant="outline"
                className="border-slate-200"
                onClick={runEvaluation}
                disabled={loading}
              >
                再実行（同一入力）
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <ResultCard
                title={modelLabels.gpt}
                color={chartColors.gpt}
                result={results?.gpt ?? null}
                error={errors?.gpt}
                enabled={enabledModels.includes("gpt")}
              />
              <ResultCard
                title={modelLabels.gemini}
                color={chartColors.gemini}
                result={results?.gemini ?? null}
                error={errors?.gemini}
                enabled={enabledModels.includes("gemini")}
              />
              <ResultCard
                title={modelLabels.claude}
                color={chartColors.claude}
                result={results?.claude ?? null}
                error={errors?.claude}
                enabled={enabledModels.includes("claude")}
              />
            </div>
          </div>
        </div>

        <Card className="border-slate-200 shadow-none">
          <CardHeader className="border-b border-slate-200">
            <CardTitle>履歴</CardTitle>
            <CardDescription>最新の実行結果が上に表示されます</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-slate-200"
                onClick={() => setHistory([])}
                disabled={history.length === 0}
              >
                履歴をクリア
              </Button>
              <Button
                variant="outline"
                className="border-slate-200"
                onClick={exportHistory}
                disabled={history.length === 0}
              >
                JSONエクスポート
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-3 py-2">実行時刻</th>
                    <th className="px-3 py-2">ケース</th>
                    <th className="px-3 py-2">判断原理</th>
                    <th className="px-3 py-2">if条件</th>
                    <th className="px-3 py-2">結果</th>
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
                        className="cursor-pointer border-t hover:bg-slate-50"
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
                        <td className="px-3 py-2">
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
