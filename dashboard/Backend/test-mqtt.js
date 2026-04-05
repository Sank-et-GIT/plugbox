const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
  console.log('Connected to MQTT broker for testing');
  
  // Test charger status
  client.publish('charger001/status', JSON.stringify({
    status: 'online',
    mac: 'AA:BB:CC:DD:EE:FF'
  }));
  
  // Test energy data
  setTimeout(() => {
    client.publish('charger001/data', JSON.stringify({
      voltage: 230,
      current: 10,
      power: 2300,
      energy: 1.5,
      frequency: 50,
      pf: 0.95
    }));
  }, 1000);
  
  // Test IR event
  setTimeout(() => {
    client.publish('charger001/ir', JSON.stringify({
      event: 'door_closed',
      button_pressed: true
    }));
  }, 2000);
  
  setTimeout(() => {
    client.end();
    console.log('Test completed');
  }, 3000);
});

client.on('error', (err) => {
  console.error('MQTT Error:', err);
});
