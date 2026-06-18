export interface ImportedStagePlanStage {
  stageNumber: number;
  title: string;
  heading: string;
  description: string;
}

export interface ImportedStagePlan {
  workstreamTitle: string;
  markdown: string;
  stages: ImportedStagePlanStage[];
}
