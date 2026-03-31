export type LogLevel = "debug" | "info" | "warn" | "error";

const rank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export class Logger {
  constructor(private readonly level: LogLevel) {}

  private emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
    if (rank[level] < rank[this.level]) return;
    const payload = {
      ts: new Date().toISOString(),
      level,
      message,
      context
    };
    // Structured logs keep CI and local debugging predictable.
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.emit("debug", message, context);
  }
  info(message: string, context?: Record<string, unknown>) {
    this.emit("info", message, context);
  }
  warn(message: string, context?: Record<string, unknown>) {
    this.emit("warn", message, context);
  }
  error(message: string, context?: Record<string, unknown>) {
    this.emit("error", message, context);
  }
}
