import { Injectable } from '@nestjs/common';

@Injectable()
export class TelemetryService {
  private latencies: number[] = [];
  private readonly maxSamples = 200;

  recordLatency(ms: number) {
    if (typeof ms !== 'number' || isNaN(ms) || ms < 0) return;
    if (this.latencies.length >= this.maxSamples) {
      this.latencies.shift();
    }
    this.latencies.push(ms);
  }

  getP95Latency(): number | null {
    if (this.latencies.length === 0) return null;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.ceil(0.95 * sorted.length) - 1;
    return Math.round(sorted[Math.max(0, index)]);
  }
}
