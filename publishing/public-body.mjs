const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const unnumber = value => normalize(value).replace(/^\d{1,2}\.\s+/, '');

// The reading skin removes an H2's "1. " prefix. Only an isolated, uniquely
// identified heading line can ignore that decoration; body prose stays exact.
export function publicBodiesMatch(actual, expected) {
  if (normalize(actual?.text) === normalize(expected?.text)) return true;
  if (!Array.isArray(actual?.headings) || !Array.isArray(expected?.headings) ||
      !actual.headings.length || actual.headings.length !== expected.headings.length) return false;
  const a = actual.headings.map(normalize), e = expected.headings.map(normalize);
  const bases = e.map(unnumber);
  if (new Set(bases).size !== bases.length || a.some((h,i) => unnumber(h) !== bases[i])) return false;
  if (!a.some((h,i) => h !== e[i])) return false;
  function canonical(snapshot, headings) {
    const lines = String(snapshot.text ?? '').split(/\r?\n/);
    for (const heading of headings) {
      // Ambiguous body lines that repeat the heading cannot use this exception.
      if (lines.filter(line => normalize(line) === heading).length !== 1) return null;
    }
    const replacements = new Map(headings.map((h,i) => [h,bases[i]]));
    return normalize(lines.map(line => replacements.get(normalize(line)) ?? line).join('\n'));
  }
  const left = canonical(actual,a), right = canonical(expected,e);
  return left !== null && right !== null && left === right;
}
