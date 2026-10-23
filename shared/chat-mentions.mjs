// Only explicit @role names trigger an agent; ordinary names and emails do not.
export function explicitMentions(text,roles,sender){
 const found=new Set();
 for(const match of text.matchAll(/(^|[^A-Za-z0-9_@/])[@＠]([A-Za-z]+)(?![A-Za-z0-9_])/g))found.add(match[2].toLowerCase());
 return roles.filter(role=>role!==sender&&found.has(role.toLowerCase()));
}
