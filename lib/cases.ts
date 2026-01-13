export type CaseId = "trolley" | "theseus";

export type ThoughtCase = {
  id: CaseId;
  title: string;
  scenarioText: string;
  optionA: string;
  optionB: string;
};

export const CASES: ThoughtCase[] = [
  {
    id: "trolley",
    title: "トロッコ問題（標準）",
    scenarioText:
      "暴走するトロッコが5人に向かっている。あなたはレバーで進路を切り替えられる。",
    optionA: "レバーを引く（5人救う/1人犠牲）",
    optionB: "何もしない（5人犠牲）"
  },
  {
    id: "theseus",
    title: "テセウスの船（短文）",
    scenarioText:
      "部品をすべて交換した船と、元の部品で組み直した船がある。どちらが本物か？",
    optionA: "同じ船",
    optionB: "別の船"
  }
];

export const CASE_MAP = new Map(CASES.map((item) => [item.id, item]));
