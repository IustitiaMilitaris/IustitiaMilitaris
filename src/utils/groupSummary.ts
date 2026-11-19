export function mostDividedStages<T extends {votes:Record<string,number>;discussionIndex:number}>(history:T[]):T[] {
 return history.filter(h=>Object.values(h.votes).filter(value=>value>0).length>1).sort((a,b)=>b.discussionIndex-a.discussionIndex).slice(0,2);
}
