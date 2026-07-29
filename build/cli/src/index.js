#!/usr/bin/env node
import { runCli } from "./cli.js";
try {
    process.exitCode = await runCli(process.argv.slice(2));
}
catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Fullstack Forge: ${message}`);
    process.exitCode = 1;
}
