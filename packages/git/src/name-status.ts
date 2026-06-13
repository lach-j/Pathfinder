import {
  RepositoryChangeStatus,
  RepositorySummaryFile,
  categorizeRepositoryPath
} from "@pathfinder/core";

export function parseNameStatus(output: string): RepositorySummaryFile[] {
  return output
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [statusCode, firstPath, secondPath] = line.split("\t");
      const status = parseChangeStatus(statusCode);

      if ((status === "renamed" || status === "copied") && secondPath) {
        return {
          path: secondPath,
          previousPath: firstPath,
          status,
          category: categorizeRepositoryPath(secondPath)
        };
      }

      return {
        path: firstPath,
        status,
        category: categorizeRepositoryPath(firstPath)
      };
    });
}

function parseChangeStatus(statusCode: string): RepositoryChangeStatus {
  const status = statusCode.charAt(0);

  if (status === "A") {
    return "added";
  }

  if (status === "M") {
    return "modified";
  }

  if (status === "D") {
    return "deleted";
  }

  if (status === "R") {
    return "renamed";
  }

  if (status === "C") {
    return "copied";
  }

  return "other";
}
