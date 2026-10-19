export function instructionText(instruction) {
  const argument = instruction.argrepr || (instruction.arg === null ? '' : String(instruction.arg));
  return `${instruction.offset}  ${instruction.opname}${argument ? '  ' + argument : ''}`;
}

export function instructionGrid(instructions, compact = true) {
  const tileWidth=compact?3.2:3.5, tileDepth=1.05, gap=.32, padding=.32, header=.5;
  const columns=Math.max(1,Math.ceil(Math.sqrt(instructions.length*tileDepth/tileWidth)));
  const rows=Math.ceil(instructions.length/columns);
  const width=columns*tileWidth+(columns-1)*gap+padding*2;
  const height=rows*tileDepth+(rows-1)*gap+padding*2+header;
  return {width,height,tiles:instructions.map((instruction,i)=>{
    const row=Math.floor(i/columns), column=row%2?columns-1-i%columns:i%columns;
    return {instruction,x:-width/2+padding+tileWidth/2+column*(tileWidth+gap),y:-height/2+padding+header+tileDepth/2+row*(tileDepth+gap),width:tileWidth,height:tileDepth};
  })};
}
