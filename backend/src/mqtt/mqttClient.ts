// ─────────────────────────────────────────────────────────────────────────────
// src/mqtt/mqttClient.ts — STUB for Week 1
//
// Real implementation comes in Week 2.
// This stub lets sessions.ts and sessionTimeout.ts compile without errors.
// All MQTT calls just log to console during Week 1 testing.
// ─────────────────────────────────────────────────────────────────────────────

export function mqttPublish(topic: string, message: string): void {
  console.log(`[MQTT STUB] ${topic} → ${message}`);
}

export function connectMqtt(): void {
  console.log("[MQTT STUB] Week 2 will connect to HiveMQ");
}

export function getMqttClient(): null {
  return null;
}

export async function subscribeAllChargers(): Promise<void> {
  console.log("[MQTT STUB] subscribeAllChargers — noop in Week 1");
}