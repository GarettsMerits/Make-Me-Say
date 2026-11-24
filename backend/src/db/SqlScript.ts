/**
 * Splits a SQL script into statements on semicolons that are not inside
 * quotes or comments. Procedure bodies are still out of scope: a semicolon
 * between BEGIN and END is a real statement separator to this splitter.
 */
export class SqlScript {
  constructor(private readonly source: string) {}

  statements(): string[] {
    const statements: string[] = [];
    let current = '';
    let quote: "'" | '"' | '`' | null = null;
    const source = this.source;

    for (let i = 0; i < source.length; i++) {
      const char = source[i]!;
      const next = source[i + 1];

      if (quote) {
        current += char;
        if (char === '\\' && quote !== '`' && next !== undefined) {
          current += next;
          i += 1;
          continue;
        }
        if (char === quote) {
          if (next === quote) {
            current += next;
            i += 1;
            continue;
          }
          quote = null;
        }
        continue;
      }

      if (char === '-' && next === '-') {
        const end = source.indexOf('\n', i);
        i = end === -1 ? source.length : end;
        continue;
      }
      if (char === '/' && next === '*') {
        const end = source.indexOf('*/', i + 2);
        i = end === -1 ? source.length : end + 1;
        continue;
      }
      if (char === "'" || char === '"' || char === '`') {
        quote = char;
        current += char;
        continue;
      }
      if (char === ';') {
        this.push(statements, current);
        current = '';
        continue;
      }
      current += char;
    }

    this.push(statements, current);
    return statements;
  }

  private push(statements: string[], raw: string): void {
    const statement = raw.trim();
    if (statement.length > 0) statements.push(statement);
  }
}
