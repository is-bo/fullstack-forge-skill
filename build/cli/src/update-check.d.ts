export declare const RELEASES_API_URL = "https://api.github.com/repos/is-bo/fullstack-forge-skill/releases/latest";
export type UpdateAvailability = {
    status: "PASS" | "WARNING";
    evidence: string;
    latestVersion?: string;
    unavailable?: boolean;
};
export type ReleaseChannelRequest = {
    url: string;
    root: string;
    timeoutMs: number;
    maxBytes: number;
};
export type ReleaseChannelResponse = {
    statusCode: number;
    body: string;
};
export type ReleaseChannelReader = (request: ReleaseChannelRequest) => Promise<ReleaseChannelResponse>;
export type ReleaseChannel = {
    version: string;
    tag: string;
    assetNames: string[];
    packageArtifact?: string;
    sbomArtifact?: string;
};
/**
 * Parses the public GitHub Releases channel. The response is an untrusted network boundary: only
 * immutable, stable releases with the complete expected asset set can become update candidates.
 */
export declare function parseReleaseChannel(payload: string): ReleaseChannel;
/** Returns the credential-free installation artifact for one immutable published release. */
export declare function publicReleaseArchive(versionText: string): string;
export declare function checkUpdateAvailability(root: string, offline: boolean, currentVersion?: string, reader?: ReleaseChannelReader): Promise<UpdateAvailability>;
