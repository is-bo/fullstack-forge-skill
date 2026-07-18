export declare function withTemporaryProject<T>(prefix: string, callback: (root: string) => Promise<T>): Promise<T>;
