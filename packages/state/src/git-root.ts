import { stat } from "node:fs/promises";
import path from "node:path";

export async function findGitRoot(startDirectory: string): Promise<string | undefined> {
  let current = path.resolve(startDirectory);

  while (true) {
    if (await isDirectory(path.join(current, ".git"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

async function isDirectory(filePath: string): Promise<boolean> {
  try {
    const result = await stat(filePath);
    return result.isDirectory();
  } catch {
    return false;
  }
}
