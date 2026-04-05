import { logDebug, logError, logInfo } from "./logger";

export function traceMqtt(
  action: "connect" | "disconnect" | "subscribe" | "publish" | "message" | "error",
  meta: Record<string, any> = {}
) {
  if (action === "error") {
    logError(`mqtt_${action}`, { category: "mqtt", ...meta });
    return;
  }

  if (action === "message") {
    logInfo(`mqtt_${action}`, { category: "mqtt", ...meta });
    return;
  }

  logDebug(`mqtt_${action}`, { category: "mqtt", ...meta });
}