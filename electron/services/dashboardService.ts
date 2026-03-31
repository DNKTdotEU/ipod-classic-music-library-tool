import type { DashboardMetrics } from "./types.js";
import { DashboardRepository } from "../db/repositories.js";

export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  getMetrics(): DashboardMetrics {
    return this.dashboardRepository.getMetrics();
  }
}
