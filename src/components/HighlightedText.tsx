import React from 'react';
export function HighlightedText({ text }: { text: string }) {
  const expression = /(UAH\s*\d[\d ,]*|"[^"\n]+"|«[^»]+»|“[^”]+”|(?:ст\.|Art(?:icle)?\.)\s*\d+(?:-\d+)?(?:\s*(?:КК(?:У| України)?|КЗпП))?|(?:справ[аіу]\s*№|case\s*No\.)\s*[\d/]+|(?:одного робочого дня|one working day)|\d[\d\s,]*(?:[–-]\d+)?\s*(?:(?:тисяч|thousand)\s+)?(?:кг|kg|грн|гривень|літрів|годин(?:а|и)?|днів|доби|хвилин|UAH|hryvnias|liters|litres|hours?|days?|minutes?))/giu;
  const pieces: React.ReactNode[] = []; let start = 0;
  for (const match of text.matchAll(expression)) {
    pieces.push(text.slice(start,match.index));
    pieces.push(<strong key={match.index} className="fact-highlight font-semibold text-steel-100">{match[0]}</strong>);
    start = match.index! + match[0].length;
  }
  pieces.push(text.slice(start));
  return <>{pieces}</>;
}
