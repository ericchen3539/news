declare module "sql.js" {
  export interface Database {
    run(sql: string, params?: unknown[]): void;
    exec(sql: string): unknown;
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }
  export interface Statement {
    bind(params: unknown[]): void;
    step(): boolean;
    get(): unknown;
    free(): void;
  }
  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<{ Database: new (data?: Uint8Array) => Database }>;
}
