const io = require('socket.io-client');

console.log('🔌 WebSocket Real-Time Data Monitor');
console.log('===================================');

const socket = io('http://localhost:5002');

socket.on('connect', () => {
  console.log('✅ Connected to Dashboard WebSocket');
  console.log('🏠 Socket ID:', socket.id);
  
  // Join all charger rooms for monitoring
  socket.emit('join-charger-room', '14');
  socket.emit('join-vendor-room', 'test-vendor');
  
  console.log('👂 Joined monitoring rooms');
  console.log('📊 Waiting for real-time updates...\n');
});

socket.on('charger-update', (data) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n🔋 [${timestamp}] Charger Update:`);
  console.log('📦 Data:', JSON.stringify(data, null, 2));
  console.log('─'.repeat(50));
});

socket.on('energy-reading', (data) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n⚡ [${timestamp}] Energy Reading:`);
  console.log('📦 Data:', JSON.stringify(data, null, 2));
  if (data.reading?.power) {
    console.log('💡 Power Consumption:', data.reading.power, 'Watts');
  }
  console.log('─'.repeat(50));
});

socket.on('session-update', (data) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n🚗 [${timestamp}] Session Update:`);
  console.log('📦 Data:', JSON.stringify(data, null, 2));
  console.log('─'.repeat(50));
});

socket.on('vendor-update', (data) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n🏢 [${timestamp}] Vendor Update:`);
  console.log('📦 Data:', JSON.stringify(data, null, 2));
  console.log('─'.repeat(50));
});

socket.on('command-sent', (data) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n📤 [${timestamp}] Command Sent:`);
  console.log('📦 Data:', JSON.stringify(data, null, 2));
  console.log('─'.repeat(50));
});

socket.on('command-error', (data) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n❌ [${timestamp}] Command Error:`);
  console.log('📦 Error:', JSON.stringify(data, null, 2));
  console.log('─'.repeat(50));
});

socket.on('disconnect', () => {
  console.log('🔴 Disconnected from WebSocket');
});

socket.on('error', (err) => {
  console.error('❌ WebSocket Error:', err);
});

// Test sending a command
setTimeout(() => {
  console.log('\n🧪 Testing command sending...');
  socket.emit('charger-command', {
    chargerId: 14,
    command: 'unlock',
    payload: { test: true }
  });
}, 3000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down WebSocket monitor...');
  socket.disconnect();
  process.exit(0);
});
