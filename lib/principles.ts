export type PrincipleId =
  | "utilitarian"
  | "deontology"
  | "care"
  | "risk"
  | "fairness"
  | "self_determination";

export type Principle = {
  id: PrincipleId;
  label: string;
  description: string;
};

export const PRINCIPLES: Principle[] = [
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
  },
  {
    id: "care",
    label: "ケア倫理（関係性・弱者重視）",
    description: "ケア責任、弱者保護、関係性の維持を優先"
  },
  {
    id: "risk",
    label: "リスク回避（最悪ケース最小化）",
    description: "最悪の結果が最も小さい選択を優先"
  },
  {
    id: "fairness",
    label: "公平・正義（えこひいき禁止）",
    description: "属性で重みを変えず、説明可能で一貫した判断を優先"
  },
  {
    id: "self_determination",
    label: "自己決定（当事者の意思優先）",
    description: "当事者の同意・意思・選好を最優先"
  }
];

export const PRINCIPLE_MAP = new Map(PRINCIPLES.map((item) => [item.id, item]));
