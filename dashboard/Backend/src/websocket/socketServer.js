const { Server } = require("socket.io");
const { mqttPublish } = require("../mqtt/mqttClient");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let io;

function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join charger-specific rooms for real-time updates
    socket.on("join-charger-room", (chargerId) => {
      socket.join(`charger-${chargerId}`);
      console.log(`[Socket] Client ${socket.id} joined charger room: ${chargerId}`);
    });

    // Join vendor-specific rooms
    socket.on("join-vendor-room", (vendorId) => {
      socket.join(`vendor-${vendorId}`);
      console.log(`[Socket] Client ${socket.id} joined vendor room: ${vendorId}`);
    });

    // Handle charger commands from frontend
    socket.on("charger-command", async (data) => {
      try {
        const { chargerId, command, payload } = data;
        
        // Get charger MQTT topic from database
        const charger = await prisma.charger.findUnique({
          where: { id: chargerId }
        });

        if (!charger?.mqttTopic) {
          socket.emit("command-error", { error: "Charger not found or no MQTT topic" });
          return;
        }

        // Publish command to MQTT
        const topic = `${charger.mqttTopic}/${command}`;
        const message = payload ? JSON.stringify(payload) : command;
        
        mqttPublish(topic, message);
        
        // Store command in database
        await prisma.deviceCommand.create({
          data: {
            chargerId,
            type: command.toUpperCase(),
            status: "PENDING",
            payload: payload || null
          }
        });

        socket.emit("command-sent", { chargerId, command, timestamp: new Date() });
        console.log(`[Socket] Command sent: ${command} to charger ${chargerId}`);
        
      } catch (error) {
        console.error("[Socket] Command error:", error);
        socket.emit("command-error", { error: "Failed to send command" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
}

// Export functions to broadcast real-time updates
function broadcastChargerUpdate(chargerId, data) {
  if (io) {
    io.to(`charger-${chargerId}`).emit("charger-update", { chargerId, data });
  }
}

function broadcastVendorUpdate(vendorId, data) {
  if (io) {
    io.to(`vendor-${vendorId}`).emit("vendor-update", { vendorId, data });
  }
}

function broadcastEnergyReading(chargerId, reading) {
  if (io) {
    io.to(`charger-${chargerId}`).emit("energy-reading", { chargerId, reading });
  }
}

function broadcastSessionUpdate(sessionId, data) {
  if (io) {
    io.emit("session-update", { sessionId, data });
  }
}

module.exports = {
  initializeSocket,
  broadcastChargerUpdate,
  broadcastVendorUpdate,
  broadcastEnergyReading,
  broadcastSessionUpdate
};
