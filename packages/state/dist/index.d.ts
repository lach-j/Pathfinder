import { Project, Slice, Workstream } from "@pathfinder/core";
export interface ActiveSlice {
    workstream: Workstream;
    slice: Slice;
}
export declare class PathfinderStore {
    private readonly cwd;
    constructor(cwd?: string);
    initProject(): Promise<Project>;
    getProject(): Promise<Project>;
    createWorkstream(title: string): Promise<Workstream>;
    listWorkstreams(): Promise<Workstream[]>;
    getWorkstream(id: string): Promise<Workstream>;
    setPlanFromFile(workstreamId: string, sourceFile: string): Promise<void>;
    getPlan(workstreamId: string): Promise<string>;
    addSlice(workstreamId: string, title: string, description: string): Promise<Slice>;
    listSlices(workstreamId: string): Promise<Slice[]>;
    setActiveSlice(workstreamId: string, sliceId: string): Promise<ActiveSlice>;
    getActiveSlice(): Promise<ActiveSlice | undefined>;
    private listWorkstreamIds;
    private requireStateRoot;
    private requireWorkstreamRoot;
    private readSlices;
}
export declare function findGitRoot(startDirectory: string): Promise<string | undefined>;
//# sourceMappingURL=index.d.ts.map