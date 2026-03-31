import path from "node:path";

export type AppConfig = {
  dbPath: string;
  quarantineDir: string;
  logLevel: "debug" | "info" | "warn" | "error";
};

export function createConfig(userDataPath: string): AppConfig {
  return {
    dbPath: path.join(userDataPath, "data", "library.db"),
    quarantineDir: path.join(userDataPath, "quarantine"),
    logLevel: (process.env.LOG_LEVEL as AppConfig["logLevel"]) ?? "info"
  };
}
