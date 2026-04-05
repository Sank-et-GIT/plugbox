import io from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect(url = 'http://localhost:5002') {
    if (this.socket?.connected) {
      return Promise.resolve(this.socket);
    }

    return new Promise((resolve, reject) => {
      this.socket = io(url, {
        transports: ['websocket'],
        autoConnect: true,
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to WebSocket server');
        resolve(this.socket);
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Disconnected from WebSocket server');
      });

      this.socket.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      });

      // Set up event listeners
      this.setupEventListeners();
    });
  }

  setupEventListeners() {
    // Charger updates
    this.socket.on('charger-update', (data) => {
      this.emit('charger-update', data);
    });

    // Energy readings
    this.socket.on('energy-reading', (data) => {
      this.emit('energy-reading', data);
    });

    // Session updates
    this.socket.on('session-update', (data) => {
      this.emit('session-update', data);
    });

    // Vendor updates
    this.socket.on('vendor-update', (data) => {
      this.emit('vendor-update', data);
    });

    // Command responses
    this.socket.on('command-sent', (data) => {
      this.emit('command-sent', data);
    });

    this.socket.on('command-error', (data) => {
      this.emit('command-error', data);
    });
  }

  // Join charger room for real-time updates
  joinChargerRoom(chargerId) {
    if (this.socket?.connected) {
      this.socket.emit('join-charger-room', chargerId);
      console.log(`👂 Joined charger room: ${chargerId}`);
    }
  }

  // Join vendor room
  joinVendorRoom(vendorId) {
    if (this.socket?.connected) {
      this.socket.emit('join-vendor-room', vendorId);
      console.log(`👂 Joined vendor room: ${vendorId}`);
    }
  }

  // Send charger command
  sendChargerCommand(chargerId, command, payload = null) {
    if (this.socket?.connected) {
      this.socket.emit('charger-command', {
        chargerId,
        command,
        payload
      });
      console.log(`📤 Command sent: ${command} to charger ${chargerId}`);
    }
  }

  // Event emitter methods
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
