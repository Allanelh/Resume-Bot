const SINGLE_CHARACTER = /^[A-Za-z0-9@._#+()\-]$/;

function splitCaseBoundaries(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

export function normalizeResumeText(text: string): string {
  const normalized = text
    .normalize('NFKC')
    .replace(/[\s\p{Z}\p{Cf}]+/gu, ' ')
    .trim();

  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length === 0) return '';

  const output: string[] = [];
  let run: string[] = [];

  const flush = (): void => {
    if (run.length === 0) return;
    if (run.length >= 3) {
      output.push(splitCaseBoundaries(run.join('')));
    } else {
      output.push(...run);
    }
    run = [];
  };

  for (const token of tokens) {
    if (token.length === 1 && SINGLE_CHARACTER.test(token)) {
      run.push(token);
    } else {
      flush();
      output.push(token);
    }
  }
  flush();

  return output.join(' ').replace(/\s+([.,;:!?])/g, '$1').trim();
}
