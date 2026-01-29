export type PrincipleId =
  | "none"
  | "utilitarian"
  | "deontology";

export type Principle = {
  id: PrincipleId;
  label: string;
  description: string;
};

export const PRINCIPLES: Principle[] = [
  {
    id: "none",
    label: "なし（AIデフォルト）",
    description: "モデルの標準的な判断に任せる"
  },
  {
    id: "utilitarian",
    label: "功利主義（期待値最大化）",
    description:
      "救える利益（人数×確率など）が最大の選択を優先"
  },
  {
    id: "deontology",
    label: "義務論（ルール・権利優先）",
    description:
      "禁止事項や権利侵害を避け、手段の正しさを優先"
  }
];

export const PRINCIPLE_MAP = new Map(PRINCIPLES.map((item) => [item.id, item]));
