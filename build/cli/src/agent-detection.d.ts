import { type Platform } from "./constants.js";
export type AgentRecommendation = {
    selector: string;
    platform: Platform;
    label: string;
    evidence: string[];
};
/**
 * Recommends selectors from finite, read-only configuration markers.
 *
 * A marker proves only that compatible configuration exists; it does not prove that an agent
 * application is installed, running, or able to render the skill. The installer uses the detected
 * finite host set and falls back to generic Agent Skills when no marker is available.
 */
export declare function detectAgentRecommendations(projectRootInput: string, userRootInput?: string, pathInput?: string): Promise<AgentRecommendation[]>;
