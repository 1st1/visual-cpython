// A bounded view of an observed operand stack; never reconstruct missing samples.
export function stackView(event, limit = 8) {
  if (!Array.isArray(event?.stack)) return { sampled: false, frame: event?.frame ?? null, total: null, hidden: 0, slots: [] };
  const hidden = Math.max(0, event.stack.length - limit);
  const slots = event.stack.slice(hidden).map((entry, i) => {
    let text, identity = null;
    if (entry.kind === 'null') text = 'NULL · call sentinel';
    else if (entry.kind === 'tagged-int') text = `tagged int ${entry.value}`;
    else {
      const value = entry.value; identity = value.id;
      const preview = value.type === 'NoneType' ? 'None' : 'value' in value ? (value.type === 'str' ? JSON.stringify(value.value) : String(value.value)) : value.name ?? (value.length === undefined ? '' : `${value.length} items`);
      text = `${value.type} ${preview} · ${value.id}`;
    }
    return { index: hidden + i, kind: entry.kind, identity, text: text.length > 70 ? text.slice(0,67) + '…' : text };
  });
  return { sampled: true, frame: event.frame, total: event.stack.length, hidden, slots };
}
