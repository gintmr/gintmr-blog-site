export interface SpotlightQuote {
  text: string;
  source: string;
}

// 首页好词佳句池：可自由增删
export const SPOTLIGHT_QUOTES: SpotlightQuote[] = [
  { text: "今宵之月，绝不西沉。", source: "《银魂》" },
  { text: "凡是过往，皆为序章。", source: "莎士比亚《暴风雨》" },
  { text: "世界以痛吻我，要我报之以歌。", source: "泰戈尔" },
];
