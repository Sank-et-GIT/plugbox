const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },

  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },

  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true
  },

  type: {
    type: String,
    enum: ['session_completed', 'session_started', 'payment_received', 'charger_offline', 'charger_maintenance', 'new_user', 'system'],
    required: [true, 'Notification type is required']
  },

  readStatus: {
    type: String,
    enum: ['read', 'unread'],
    default: 'unread'
  },

  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },

  actionUrl: {
    type: String,
    trim: true
  },

  metadata: {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
    chargerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Charger' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },

  expiresAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ userId: 1, readStatus: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Clean up expired notifications
notificationSchema.pre('save', function(next) {
  if (this.expiresAt && this.expiresAt < new Date()) {
    return next(new Error('Notification has already expired'));
  }
  next();
});

module.exports = mongoose.model("Notification", notificationSchema);
