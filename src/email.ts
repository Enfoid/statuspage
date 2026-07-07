import { EmailMessage } from "cloudflare:email";
import type { CheckResult, Monitor } from "./db";

// Fixed on purpose - this is an internal alert channel, not a per-monitor/user setting.
// FROM must be an address on a domain that has Cloudflare Email Routing/Email Service enabled.
// TO must be a verified destination address on that same Cloudflare account.
const FROM_EMAIL = "noreply@bitco.one";
const TO_EMAIL = "nullx8@gmail.com";

function targetLabel(monitor: Monitor): string {
  return monitor.type === "tcp" ? `${monitor.target}:${monitor.port}` : monitor.target;
}

function buildRawEmail(subject: string, body: string): string {
  return [
    `From: ${FROM_EMAIL}`,
    `To: ${TO_EMAIL}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    body,
  ].join("\r\n");
}

export async function sendMonitorAlert(
  emailBinding: SendEmail,
  monitor: Monitor,
  status: "down" | "recovered",
  result: CheckResult
): Promise<void> {
  const subject =
    status === "down" ? `[statuspage] ${monitor.name} is DOWN` : `[statuspage] ${monitor.name} has recovered`;

  const lines = [
    `Monitor: ${monitor.name}`,
    `Type: ${monitor.type}`,
    `Target: ${targetLabel(monitor)}`,
    `Status: ${status === "down" ? "DOWN" : "UP (recovered)"}`,
  ];
  if (result.error) lines.push(`Error: ${result.error}`);
  if (result.response_time_ms != null) lines.push(`Response time: ${result.response_time_ms}ms`);
  lines.push(`Checked at: ${new Date().toISOString()}`);

  const message = new EmailMessage(FROM_EMAIL, TO_EMAIL, buildRawEmail(subject, lines.join("\n")));
  try {
    await emailBinding.send(message);
  } catch (err) {
    console.error(`Failed to send alert email for monitor ${monitor.id}:`, err);
  }
}
