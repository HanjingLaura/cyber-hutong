export function explicitMentions<T extends string>(text:string,roles:readonly T[],sender?:string|null):T[];
