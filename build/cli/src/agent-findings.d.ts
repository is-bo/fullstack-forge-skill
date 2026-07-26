import type { Finding } from "./types.js";
export declare function bindAgentFindings(root: string, findings: Finding[]): Promise<Finding[]>;
export declare function reconcileFindings(previous: Finding[], incoming: Finding[]): Finding[];
