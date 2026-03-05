export interface SpotlightQuote {
  text: string;
  source: string;
}

// 首页好词佳句池：可自由增删
export const SPOTLIGHT_QUOTES: SpotlightQuote[] = [
  { text: "今宵之月，绝不西沉。", source: "《银魂》" },
  { text: "且视他人之疑目如盏盏鬼火，大胆去走你的夜路。", source: "史铁生《病隙碎笔》" },
  { text: "资产是能把钱放进你口袋里的东西，负债是把钱从你口袋里取走的东西。", source: "《富爸爸穷爸爸》"},
  { text: "有老投资者，有大胆的投资者，但没有大胆的老投资者。", source: "《投资最重要的事》" },
];
