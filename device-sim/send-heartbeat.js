const fs = require('fs');
const path = require('path');

// Load heartbeat template
const heartbeatPath = path.join(__dirname, 'heartbeat.json');
const heartbeatTemplate = JSON.parse(fs.readFileSync(heartbeatPath, 'utf8'));

const intervalMs = Number(process.env.HEARTBEAT_INTERVAL_MS || process.argv[2] || 5000);
let uptimeSeconds = heartbeatTemplate.uptimeSeconds ?? 0;
let doorState = heartbeatTemplate.doorState ?? 'UNLOCKED';
let doorCounterMs = 0;
const logPath = path.join(__dirname, 'heartbeat.log');
const logHeaders = [
  'timestamp',
  'deviceId',
  'macAddress',
  'status',
  'fault',
  'doorState',
  'eStop',
  'voltage',
  'current',
  'power',
  'temperature',
  'signalStrength',
  'uptimeSeconds'
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomFloat = (min, max, precision = 1) => {
  const value = Math.random() * (max - min) + min;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};
const jitterPercent = (base, pct, precision = 1) => {
  const delta = base * pct;
  return randomFloat(base - delta, base + delta, precision);
};

function ensureLogFile() {
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, `${logHeaders.join('\t')}\n`);
  }
}

function logHeartbeat(heartbeat) {
  const row = [
    heartbeat.timestamp,
    heartbeat.deviceId,
    heartbeat.macAddress ?? '',
    heartbeat.status,
    heartbeat.fault,
    heartbeat.doorState,
    heartbeat.eStop,
    heartbeat.voltage,
    heartbeat.current,
    heartbeat.power,
    heartbeat.temperature,
    heartbeat.signalStrength,
    heartbeat.uptimeSeconds
  ].join('\t');

  fs.appendFileSync(logPath, `${row}\n`);
}

function generateHeartbeat() {
  uptimeSeconds += intervalMs / 1000;
  doorCounterMs += intervalMs;
  if (doorCounterMs > 30000) {
    doorState = doorState === 'LOCKED' ? 'UNLOCKED' : 'LOCKED';
    doorCounterMs = 0;
  }

  const voltage = jitterPercent(heartbeatTemplate.voltage ?? 230, 0.02, 1); // ±2%
  const current = jitterPercent(heartbeatTemplate.current ?? 2, 0.08, 1); // ±8%
  const efficiency = 0.95;
  const fault = Math.random() < 0.05;
  const heartbeat = {
    ...heartbeatTemplate,
    timestamp: new Date().toISOString(),
    doorState,
    eStop: Math.random() < 0.02,
    voltage,
    current,
    power: Math.round(voltage * current * efficiency),
    signalStrength: Math.round(randomFloat(-80, -55, 0)),
    uptimeSeconds: Math.floor(uptimeSeconds),
    fault,
    status: fault ? 'FAULT' : 'ONLINE',
    // Update existing temperature field instead of adding metrics.temperature
    temperature: jitterPercent(heartbeatTemplate.temperature ?? 42, 0.1, 1) // ±10%
  };

  return heartbeat;
}

function sendHeartbeat() {
  const heartbeat = generateHeartbeat();
  console.log('Sending heartbeat:', JSON.stringify(heartbeat, null, 2));
  logHeartbeat(heartbeat);

 
}

ensureLogFile();
console.log(`Device simulator started. Interval: ${intervalMs} ms`);
sendHeartbeat();
setInterval(sendHeartbeat, intervalMs);
