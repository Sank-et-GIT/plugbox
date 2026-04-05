const mqtt = require('mqtt');

console.log('🔋 Charger Simulator');
console.log('====================');

const client = mqtt.connect('mqtt://localhost:1883');
const chargerId = 'charger001';
const macAddress = 'AA:BB:CC:DD:EE:FF';

let isCharging = false;
let energyCounter = 0;

client.on('connect', () => {
  console.log('✅ Charger simulator connected');
  
  // Start with status
  sendStatus('online');
  
  // Start periodic data simulation
  setInterval(() => {
    if (isCharging) {
      sendEnergyData();
    }
  }, 2000); // Every 2 seconds
  
  // Simulate charging session
  setTimeout(() => {
    console.log('🔌 Simulating charger plug-in...');
    sendIREvent(true);
  }, 5000);
});

function sendStatus(status) {
  const message = JSON.stringify({
    status,
    mac: macAddress
  });
  
  client.publish(`${chargerId}/status`, message);
  console.log(`📤 Status: ${status}`);
}

function sendEnergyData() {
  energyCounter += 1.5; // Increased from 0.1 to 1.5 for faster testing
  
  const message = JSON.stringify({
    voltage: 230 + Math.random() * 10,
    current: isCharging ? 15 + Math.random() * 5 : 0, // Increased from 10 to 15
    power: isCharging ? 3500 + Math.random() * 500 : 0, // Increased from 2300 to 3500
    energy: energyCounter,
    frequency: 50,
    pf: 0.95
  });
  
  client.publish(`${chargerId}/data`, message);
  console.log(`⚡ Energy: ${energyCounter.toFixed(2)} kWh, Power: ${isCharging ? Math.round(3500 + Math.random() * 500) : 0}W`);
}

function sendIREvent(buttonPressed = false) {
  const message = JSON.stringify({
    event: 'door_closed',
    button_pressed: buttonPressed
  });
  
  client.publish(`${chargerId}/ir`, message);
  console.log(`🚪 IR Event: door_closed, button: ${buttonPressed}`);
  
  if (buttonPressed) {
    isCharging = true;
    console.log('🔋 Charging started!');
  }
}

// Interactive controls
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', (key) => {
  switch (key) {
    case 's':
    case 'S':
      sendStatus('online');
      break;
    case 'o':
    case 'O':
      sendStatus('offline');
      break;
    case 'c':
    case 'C':
      isCharging = !isCharging;
      console.log(`🔋 Charging ${isCharging ? 'STARTED' : 'STOPPED'}`);
      break;
    case 'i':
    case 'I':
      sendIREvent(true);
      break;
    case 'q':
    case 'Q':
      console.log('👋 Shutting down simulator...');
      client.end();
      process.exit(0);
      default:
      console.log('\n🎮 Controls:');
      console.log('S - Send Online Status');
      console.log('O - Send Offline Status'); 
      console.log('C - Toggle Charging');
      console.log('I - Send IR Event');
      console.log('Q - Quit');
      break;
  }
});

console.log('\n🎮 Controls:');
console.log('S - Send Online Status');
console.log('O - Send Offline Status');
console.log('C - Toggle Charging');
console.log('I - Send IR Event');
console.log('Q - Quit');
console.log('\n📊 Simulating real-time data...');
