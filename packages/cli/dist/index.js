#!/usr/bin/env node
import { PathfinderError } from "@pathfinder/core";
import { PathfinderStore } from "@pathfinder/state";
const store = new PathfinderStore(process.cwd());
run(process.argv.slice(2)).catch((error) => {
    if (error instanceof PathfinderError) {
        console.error(`Error: ${error.message}`);
        process.exitCode = 1;
        return;
    }
    console.error(error);
    process.exitCode = 1;
});
async function run(args) {
    const [area, action, ...rest] = args;
    if (!area || area === "help" || area === "--help" || area === "-h") {
        printHelp();
        return;
    }
    if (area === "init") {
        expectNoExtraArgs(rest);
        const project = await store.initProject();
        console.log(`Initialised Pathfinder for ${project.name}.`);
        return;
    }
    if (area === "workstream") {
        await runWorkstream(action, rest);
        return;
    }
    if (area === "plan") {
        await runPlan(action, rest);
        return;
    }
    if (area === "slice") {
        await runSlice(action, rest);
        return;
    }
    throw new PathfinderError(`Unknown command '${area}'. Run 'pathfinder help' for usage.`);
}
async function runWorkstream(action, args) {
    if (action === "create") {
        const options = parseOptions(args);
        requireOption(options.title, "--title");
        const workstream = await store.createWorkstream(options.title);
        console.log(`${workstream.id}\t${workstream.title}`);
        return;
    }
    if (action === "list") {
        expectNoExtraArgs(args);
        const workstreams = await store.listWorkstreams();
        if (workstreams.length === 0) {
            console.log("No workstreams found.");
            return;
        }
        for (const workstream of workstreams) {
            console.log(`${workstream.id}\t${workstream.title}`);
        }
        return;
    }
    if (action === "show") {
        const [id, ...extra] = args;
        requireArgument(id, "workstream id");
        expectNoExtraArgs(extra);
        const workstream = await store.getWorkstream(id);
        console.log(JSON.stringify(workstream, null, 2));
        return;
    }
    throw new PathfinderError("Unknown workstream command. Expected create, list, or show.");
}
async function runPlan(action, args) {
    if (action === "set") {
        const [workstreamId, ...optionArgs] = args;
        requireArgument(workstreamId, "workstream id");
        const options = parseOptions(optionArgs);
        requireOption(options.file, "--file");
        await store.setPlanFromFile(workstreamId, options.file);
        console.log(`Updated plan for ${workstreamId}.`);
        return;
    }
    if (action === "show") {
        const [workstreamId, ...extra] = args;
        requireArgument(workstreamId, "workstream id");
        expectNoExtraArgs(extra);
        process.stdout.write(await store.getPlan(workstreamId));
        return;
    }
    throw new PathfinderError("Unknown plan command. Expected set or show.");
}
async function runSlice(action, args) {
    if (action === "add") {
        const [workstreamId, ...optionArgs] = args;
        requireArgument(workstreamId, "workstream id");
        const options = parseOptions(optionArgs);
        requireOption(options.title, "--title");
        requireOption(options.description, "--description");
        const slice = await store.addSlice(workstreamId, options.title, options.description);
        console.log(formatSlice(slice));
        return;
    }
    if (action === "list") {
        const [workstreamId, ...extra] = args;
        requireArgument(workstreamId, "workstream id");
        expectNoExtraArgs(extra);
        const slices = await store.listSlices(workstreamId);
        if (slices.length === 0) {
            console.log("No slices found.");
            return;
        }
        for (const slice of slices) {
            console.log(formatSlice(slice));
        }
        return;
    }
    if (action === "active") {
        const [workstreamId, sliceId, ...extra] = args;
        requireArgument(workstreamId, "workstream id");
        requireArgument(sliceId, "slice id");
        expectNoExtraArgs(extra);
        const active = await store.setActiveSlice(workstreamId, sliceId);
        console.log(`Active slice: ${active.workstream.id}/${active.slice.id}`);
        return;
    }
    if (action === "show-active") {
        expectNoExtraArgs(args);
        const active = await store.getActiveSlice();
        if (!active) {
            console.log("No active slice set.");
            return;
        }
        console.log(`Workstream: ${active.workstream.id}\t${active.workstream.title}`);
        console.log(formatSlice(active.slice));
        console.log(active.slice.description);
        return;
    }
    throw new PathfinderError("Unknown slice command. Expected add, list, active, or show-active.");
}
function parseOptions(args) {
    const options = {};
    for (let index = 0; index < args.length; index += 1) {
        const flag = args[index];
        const value = args[index + 1];
        if (!flag.startsWith("--")) {
            throw new PathfinderError(`Unexpected argument '${flag}'.`);
        }
        if (!value || value.startsWith("--")) {
            throw new PathfinderError(`Missing value for ${flag}.`);
        }
        if (flag === "--title") {
            options.title = value;
        }
        else if (flag === "--description") {
            options.description = value;
        }
        else if (flag === "--file") {
            options.file = value;
        }
        else {
            throw new PathfinderError(`Unknown option '${flag}'.`);
        }
        index += 1;
    }
    return options;
}
function formatSlice(slice) {
    return `${slice.id}\t${slice.status}\t${slice.title}`;
}
function requireArgument(value, label) {
    if (!value) {
        throw new PathfinderError(`Missing ${label}.`);
    }
}
function requireOption(value, flag) {
    if (!value) {
        throw new PathfinderError(`Missing required option ${flag}.`);
    }
}
function expectNoExtraArgs(args) {
    if (args.length > 0) {
        throw new PathfinderError(`Unexpected argument '${args[0]}'.`);
    }
}
function printHelp() {
    console.log(`Pathfinder Stage 1

Usage:
  pathfinder init
  pathfinder workstream create --title "..."
  pathfinder workstream list
  pathfinder workstream show <id>
  pathfinder plan set <workstream-id> --file ./plan.md
  pathfinder plan show <workstream-id>
  pathfinder slice add <workstream-id> --title "..." --description "..."
  pathfinder slice list <workstream-id>
  pathfinder slice active <workstream-id> <slice-id>
  pathfinder slice show-active`);
}
