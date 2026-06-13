import { constants } from "node:fs";
import { access } from "node:fs/promises";

export async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
