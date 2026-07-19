export declare function withTemporaryProject<T>(prefix: string, callback: (root: string) => Promise<T>): Promise<T>;
/**
 * Copies a scanner fixture into a disposable directory and materializes its non-installable
 * package.json.fixture only there. Repository fixtures never remain dependency roots.
 */
export declare function copyFixture(source: string, target: string): Promise<void>;
