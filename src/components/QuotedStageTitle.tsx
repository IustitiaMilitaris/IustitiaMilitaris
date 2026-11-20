import React from 'react';
export function QuotedStageTitle({text}:{text:string}) {
 const quotes=/«[^»]+»|“[^”]+”|"[^"]+"|(?<!\w)'[^'\n]+'(?!\w)/gu;
 const parts:React.ReactNode[]=[];let end=0;
 for(const match of text.matchAll(quotes)){
  const start=match.index!;parts.push(text.slice(end,start));
  parts.push(<span key={start} className="quoted-stage-fragment inline-block max-w-full" style={{width:'max-content',whiteSpace:'normal',overflowWrap:'break-word'}}>{match[0]}</span>);end=start+match[0].length;
 }
 parts.push(text.slice(end));return <>{parts}</>;
}
