import { randomUUID } from "node:crypto";

export type HistoryEvent = {
  id: string;
  eventType: string;
  message: string;
  createdAt: string;
};

export class HistoryService {
  private readonly events: HistoryEvent[] = [];

  record(eventType: string, message: string): void {
    this.events.unshift({
      id: randomUUID(),
      eventType,
      message,
      createdAt: new Date().toISOString()
    });
  }

  list(): HistoryEvent[] {
    return this.events;
  }
}
