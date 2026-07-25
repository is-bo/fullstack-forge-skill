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
 * application is installed, running, or able to render the skill. The installer therefore keeps
 * `all` as its compatibility default and presents these results as recommendations.
 */
export declare function detectAgentRecommendations(projectRootInput: string, userRootInput?: string, pathInput?: string): Promise<AgentRecommendation[]>;
