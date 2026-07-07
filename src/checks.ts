import { connect } from "cloudflare:sockets";
import type { CheckResult, Monitor } from "./db";

export async function runHttpCheck(monitor: Monitor): Promise<CheckResult> {
  const start = Date.now();
  try {
    const response = await fetch(monitor.target, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(monitor.timeout_ms),
      headers: { "User-Agent": "statuspage-worker/1.0" },
    });
    const statusOk =
      response.status >= monitor.expected_status_min && response.status <= monitor.expected_status_max;

    let bodyOk = true;
    if (monitor.expected_body) {
      const text = await response.text();
      bodyOk = text.includes(monitor.expected_body);
    }

    const elapsed = Date.now() - start;
    const success = statusOk && bodyOk;
    let error: string | null = null;
    if (!statusOk) error = `Unexpected status code ${response.status}`;
    else if (!bodyOk) error = `Expected content not found in response`;

    return {
      success,
      response_time_ms: elapsed,
      status_code: response.status,
      error,
    };
  } catch (err) {
    return {
      success: false,
      response_time_ms: Date.now() - start,
      status_code: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runTcpCheck(monitor: Monitor): Promise<CheckResult> {
  if (!monitor.port) {
    return { success: false, response_time_ms: null, status_code: null, error: "No port configured" };
  }
  const start = Date.now();
  const socket = connect({ hostname: monitor.target, port: monitor.port });
  try {
    await withTimeout(socket.opened, monitor.timeout_ms, "Connection timed out");
    const elapsed = Date.now() - start;
    return { success: true, response_time_ms: elapsed, status_code: null, error: null };
  } catch (err) {
    return {
      success: false,
      response_time_ms: Date.now() - start,
      status_code: null,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    try {
      await socket.close();
    } catch {
      // socket may already be closed/errored; nothing more to do
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function runCheck(monitor: Monitor): Promise<CheckResult> {
  return monitor.type === "http" ? runHttpCheck(monitor) : runTcpCheck(monitor);
}
