import type { DashboardMetrics } from "./types";
import { DashboardRepository } from "../db/repositories";

export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  getMetrics(): DashboardMetrics {
    return this.dashboardRepository.getMetrics();
  }
}
