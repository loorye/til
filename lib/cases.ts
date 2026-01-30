export type CaseId = "trolley" | "trolley2" | "theseus" | "dilemma";

export type WorkGoalType =
  | 'increase_confidence'
  | 'flip_decision'
  | 'minimize_confidence';

export type Workshop = {
  workId: 1 | 2 | 3 | null;
  goalType: WorkGoalType | 'free';
  targetValue?: number;
  hints: Array<{
    level: 'basic' | 'intermediate' | 'advanced';
    text: string;
  }>;
  description: string;
};

export type ThoughtCase = {
  id: CaseId;
  title: string;
  scenarioText: string;
  optionA: string;
  optionB: string;
  workshop?: Workshop;
};

export const CASES: ThoughtCase[] = [
  {
    id: "trolley",
    title: "トロッコ問題",
    scenarioText:
      "あなたはトロッコの線路の分岐点に立ち、レバーを手にしています。向こうから制御不能の暴走するトロッコが迫ってきました。このまままっすぐ進むと線路上の5人がはねられてしまいます。一方、レバーを引くと別の路線にトロッコが流れ、その先にいる1人がはねられます。さあ、あなたはどうしますか？",
    optionA: "レバーを引く（5人救う/1人犠牲）",
    optionB: "何もしない（5人犠牲）",
    workshop: {
      workId: 1,
      goalType: 'increase_confidence',
      targetValue: 20,
      description: 'IF条件を追加して、AIの確信度を20%以上向上させよう',
      hints: [
        {
          level: 'basic',
          text: '人数以外の要素に注目してみましょう。例えば、年齢や職業などの属性を考慮してみてください。'
        },
        {
          level: 'intermediate',
          text: '状況の緊急性や確実性を変える条件を追加してみましょう。例: 「レバーを引かなければ確実に5人が死ぬ」'
        },
        {
          level: 'advanced',
          text: '具体例: 「5人は子供で、1人は高齢者である」または「1人は違法に線路に侵入した」'
        }
      ]
    }
  },
  {
    id: "trolley2",
    title: "歩道橋問題",
    scenarioText:
      "Xは線路上の橋に立っており、Xの横にYがいる。Yは太っており、もし彼を線路上につき落として障害物にすれば、トロッコは確実に止まり5人は助かる。だがそうするとCがトロッコに轢かれて死ぬのも確実である。Yは状況に気づいておらず、自らは何も行動しないが、Xに対し警戒もしていないので突き落とすのに失敗するおそれは無い。Yを突き落とすべきか？",
    optionA: "Cを突き落とす",
    optionB: "何もしない",
    workshop: {
      workId: 2,
      goalType: 'flip_decision',
      description: 'IF条件を使って、AIの判断を反対の選択肢に変えよう',
      hints: [
        {
          level: 'basic',
          text: '直接的な行為と間接的な行為の違いに注目してみましょう。行為の責任の所在を変える条件を考えてみてください。'
        },
        {
          level: 'intermediate',
          text: '太った男性の属性を変えてみましょう。例: 犯罪者、自殺志願者、救助のプロなど'
        },
        {
          level: 'advanced',
          text: '具体例: 「太った男性は事故の原因を作った人物である」または「太った男性は自ら犠牲になることを望んでいる」'
        }
      ]
    }
  },
  {
    id: "theseus",
    title: "テセウスの船",
    scenarioText:
      "ギリシャの英雄テセウスという人が船を所有していました。テセウスの船は経年劣化で部品が傷んできたため、壊れた部品は徐々に新しいものと交換されていきました。そして、最終的には船の全ての部品が交換され、もとの部品はひとつも残っていない状態になりました。さて、ここで問題です。全ての部品が交換された後の船は、最初のテセウスの船と同じ船と言えるのでしょうか？",
    optionA: "同じ船である",
    optionB: "別の船である",
    workshop: {
      workId: null,
      goalType: 'free',
      description: '自由に練習してみましょう',
      hints: [
        {
          level: 'basic',
          text: 'アイデンティティの連続性に注目してみましょう。物理的な部品と機能的な同一性のどちらを重視するか。'
        },
        {
          level: 'intermediate',
          text: '交換の頻度や割合を変える条件を追加してみましょう。例: 「一度に全て交換」vs「100年かけて少しずつ交換」'
        },
        {
          level: 'advanced',
          text: '具体例: 「元の部品で新しい船を再構築した場合、どちらが本物か」'
        }
      ]
    }
  },
  {
    id: "dilemma",
    title: "囚人のジレンマ",
    scenarioText:
      "あなたともう1人は別々に事情聴取を受けています。互いに相談はできません。あなたは次のどちらかを選べます。•	もしあなたが黙秘し、相手が自白した場合：あなたは10年、相手は0年 •	もしあなたが自白し、相手が黙秘した場合：あなたは0年、相手は10年 •	もし両方が黙秘した場合：両方とも1年 •	もし両方が自白した場合：両方とも5年 あなたはどちらを選びますか？",
    optionA: "黙秘する",
    optionB: "自白する",
    workshop: {
      workId: 3,
      goalType: 'minimize_confidence',
      targetValue: 51,
      description: 'IF条件を使って、AIを最も悩ませよう（確信度51%を目指す）',
      hints: [
        {
          level: 'basic',
          text: '相反する要素を同時に追加して、判断を難しくしましょう。例えば、協力と裏切りの両方にメリット・デメリットを追加。'
        },
        {
          level: 'intermediate',
          text: '不確実性を増す条件を追加してみましょう。例: 「相手の選択が50%の確率で変わる」「情報が不完全」'
        },
        {
          level: 'advanced',
          text: '具体例: 「相手は過去に裏切ったことがあるが、今回は協力を示唆している」「裏切りの利益と協力の利益がほぼ同等」'
        }
      ]
    }
  },
];

export const CASE_MAP = new Map(CASES.map((item) => [item.id, item]));
