// Presentation lexer only; CPython remains the authority for parsing and execution.
const keywords=new Set('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case'.split(' '));
const builtins=new Set('print range len abs min max int float str bool list dict tuple set enumerate zip sum'.split(' '));
export const syntaxColors={plain:'#e2eaff',keyword:'#cfacff',string:'#f1ca9d',number:'#8bded2',comment:'#8394ae',builtin:'#8ecfff',operator:'#b4c2de'};
export function pythonTokens(source) {
  const pattern=/(#[^\n]*|(?:[rRuUbBfF]{0,2})(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*(?:"|$)|'(?:\\.|[^'\\\n])*(?:'|$))|\b(?:0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?[\d_]+)?j?)\b|\b[A-Za-z_]\w*\b|[^\w\s])/g;
  const result=[];let end=0;
  for(const match of source.matchAll(pattern)) {
    if(match.index>end)result.push({text:source.slice(end,match.index),kind:'plain'});
    const text=match[0];
    const kind=text.startsWith('#')?'comment':/^[rRuUbBfF]*['"]/.test(text)?'string':/^\d/.test(text)?'number':keywords.has(text)?'keyword':builtins.has(text)?'builtin':/^\W/.test(text)?'operator':'plain';
    result.push({text,kind});end=match.index+text.length;
  }
  if(end<source.length)result.push({text:source.slice(end),kind:'plain'});
  return result;
}
export function paintPython(element,source) {
  element.replaceChildren(...pythonTokens(source).map(token=>{const span=document.createElement('span');span.className=`syntax-${token.kind}`;span.textContent=token.text;return span;}));
}
export function syntaxLines(source) {
  const lines=[[]];
  for(const token of pythonTokens(source))token.text.split('\n').forEach((text,i)=>{if(i)lines.push([]);if(text)lines.at(-1).push({text,kind:token.kind});});
  return lines;
}
