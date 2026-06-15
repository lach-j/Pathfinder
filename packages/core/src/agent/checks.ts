import { AgentCheckGuidance, AgentRepositoryCheckSignals } from "../domain.js";

export function getAgentCheckGuidance(signals: AgentRepositoryCheckSignals): AgentCheckGuidance {
  if (signals.hasPackageJson) {
    return {
      commands: ["npm run typecheck", "npm test", "npm run lint --if-present"],
      instruction: "Run the repository's npm checks before handing work back."
    };
  }

  if (signals.hasPythonProjectMarker) {
    const commands = [
      ...(signals.hasRuffConfig ? ["python -m ruff check ."] : []),
      ...(signals.hasPythonTests || signals.hasPytestConfig ? ["python -m pytest"] : [])
    ];

    if (commands.length > 0) {
      return {
        commands,
        instruction: "Run the detected Python checks before handing work back."
      };
    }
  }

  return {
    commands: [],
    instruction: "Inspect the repository and run the applicable checks before handing work back."
  };
}
