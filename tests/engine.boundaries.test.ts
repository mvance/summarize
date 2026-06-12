import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const engineDir = join(process.cwd(), "src", "engine");

describe("engine import boundary", () => {
  it("does not depend on CLI or daemon modules", () => {
    const forbiddenImports: string[] = [];
    for (const name of readdirSync(engineDir).filter((entry) => entry.endsWith(".ts"))) {
      const source = readFileSync(join(engineDir, name), "utf8");
      for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
        const specifier = match[1] ?? "";
        if (
          specifier.startsWith("../run/") ||
          specifier.startsWith("../daemon/") ||
          specifier.startsWith("../tty/")
        ) {
          forbiddenImports.push(`${name}: ${specifier}`);
        }
      }
    }

    expect(forbiddenImports).toEqual([]);
  });
});
