const mqtt = require('mqtt');

console.log('🔍 MQTT Real-Time Data Monitor');
console.log('================================');

const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
  console.log('✅ Connected to Mosquitto broker');
  
  // Subscribe to all charger topics
  client.subscribe('+/+', (err) => {
    if (err) {
      console.error('❌ Subscription error:', err);
    } else {
      console.log('👂 Listening to all MQTT topics (+/+)');
      console.log('📊 Waiting for real-time data...\n');
    }
  });
});

client.on('message', (topic, message) => {
  const timestamp = new Date().toLocaleTimeString();
  const data = message.toString();
  
  console.log(`\n📡 [${timestamp}] Topic: ${topic}`);
  
  try {
    const jsonData = JSON.parse(data);
    console.log('📦 Data:', JSON.stringify(jsonData, null, 2));
    
    // Highlight important data
    if (topic.includes('/status')) {
      console.log('🟢 Charger Status Update');
    } else if (topic.includes('/data')) {
      console.log('⚡ Energy Reading - Power:', jsonData.power, 'W');
    } else if (topic.includes('/ir')) {
      console.log('🚪 IR Sensor Event');
    }
  } catch {
    console.log('📄 Raw Data:', data);
  }
  
  console.log('─'.repeat(50));
});

client.on('error', (err) => {
  console.error('❌ MQTT Error:', err);
});

client.on('offline', () => {
  console.log('🔴 MQTT Client Offline');
});

client.on('reconnect', () => {
  console.log('🔄 Reconnecting to MQTT...');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down MQTT monitor...');
  client.end();
  process.exit(0);
});
