import { type Finding } from "./types.js";
export declare function validateFinding(value: unknown): string[];
export declare function assertFindings(values: unknown[]): asserts values is Finding[];
export declare function assertAgentFindings(values: unknown[]): asserts values is Finding[];
