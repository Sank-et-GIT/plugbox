import React, { useState, useEffect } from 'react';
import { Bell, Moon, Sun, Globe, Shield, Smartphone, CreditCard, Save, X } from 'lucide-react';
import axios from 'axios';

const Settings = () => {
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      sms: false,
      push: true,
      sessionCompleted: true,
      chargerOffline: true,
      paymentReceived: true
    },
    appearance: {
      theme: 'light',
      language: 'en'
    },
    payment: {
      defaultMethod: 'wallet',
      autoTopup: false,
      lowBalanceAlert: true
    },
    security: {
      twoFactorAuth: false,
      sessionTimeout: 30
    }
  });
  const [loading, setLoading] = useState(false);
  const [showSaveMessage, setShowSaveMessage] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/vendor/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.data.success) {
        setSettings(response.data.settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.put('/api/vendor/settings', settings, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        setShowSaveMessage(true);
        setTimeout(() => setShowSaveMessage(false), 3000);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (category, setting) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: !prev[category][setting]
      }
    }));
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {showSaveMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center">
            <Shield className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800">Settings saved successfully!</span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Notifications Settings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Bell className="h-5 w-5 mr-2" />
              Notification Preferences
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="email-notifications"
                    checked={settings.notifications.email}
                    onChange={(e) => handleToggle('notifications', 'email')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="email-notifications" className="ml-2 text-sm text-gray-700">
                    Email Notifications
                  </label>
                </div>
                <span className="text-sm text-gray-500">Receive alerts via email</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="sms-notifications"
                    checked={settings.notifications.sms}
                    onChange={(e) => handleToggle('notifications', 'sms')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="sms-notifications" className="ml-2 text-sm text-gray-700">
                    SMS Notifications
                  </label>
                </div>
                <span className="text-sm text-gray-500">Receive alerts via SMS</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="push-notifications"
                    checked={settings.notifications.push}
                    onChange={(e) => handleToggle('notifications', 'push')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="push-notifications" className="ml-2 text-sm text-gray-700">
                    Push Notifications
                  </label>
                </div>
                <span className="text-sm text-gray-500">Receive push notifications on mobile app</span>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Alert Types</h3>
                <div className="space-y-2">
                  {Object.entries(settings.notifications).slice(3).map(([key, value]) => (
                    <div key={key} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`alert-${key}`}
                        checked={value}
                        onChange={(e) => handleToggle('notifications', key)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`alert-${key}`} className="ml-2 text-sm text-gray-700 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance Settings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Sun className="h-5 w-5 mr-2" />
              Appearance
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                <select
                  value={settings.appearance.theme}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    appearance: { ...prev.appearance, theme: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">System</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                <select
                  value={settings.appearance.language}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    appearance: { ...prev.appearance, language: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="en">English</option>
                  <option value="hi">हिंदी</option>
                  <option value="gu">ગુજરાતી</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Settings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Payment Settings
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Default Payment Method</label>
                <select
                  value={settings.payment.defaultMethod}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    payment: { ...prev.payment, defaultMethod: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="wallet">Wallet Balance</option>
                  <option value="card">Credit/Debit Card</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="auto-topup"
                    checked={settings.payment.autoTopup}
                    onChange={(e) => handleToggle('payment', 'autoTopup')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="auto-topup" className="ml-2 text-sm text-gray-700">
                    Auto Top-up when balance is low
                  </label>
                </div>
                <span className="text-sm text-gray-500">Automatically add funds when wallet balance is below ₹100</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="low-balance-alert"
                    checked={settings.payment.lowBalanceAlert}
                    onChange={(e) => handleToggle('payment', 'lowBalanceAlert')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="low-balance-alert" className="ml-2 text-sm text-gray-700">
                    Low Balance Alerts
                  </label>
                </div>
                <span className="text-sm text-gray-500">Get notified when wallet balance is low</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Security
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="2fa"
                    checked={settings.security.twoFactorAuth}
                    onChange={(e) => handleToggle('security', 'twoFactorAuth')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="2fa" className="ml-2 text-sm text-gray-700">
                    Two-Factor Authentication
                  </label>
                </div>
                <span className="text-sm text-gray-500">Add an extra layer of security to your account</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Session Timeout (minutes)</label>
                <select
                  value={settings.security.sessionTimeout}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    security: { ...prev.security, sessionTimeout: parseInt(e.target.value) }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                </select>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Connected Devices</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center">
                      <Smartphone className="h-4 w-4 text-gray-600 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Chrome on Windows</p>
                        <p className="text-xs text-gray-500">Last active: 2 hours ago</p>
                      </div>
                    </div>
                    <button className="text-red-600 hover:text-red-800 text-sm">
                      Revoke
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center">
                      <Smartphone className="h-4 w-4 text-gray-600 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Mobile App (Android)</p>
                        <p className="text-xs text-gray-500">Last active: 1 day ago</p>
                      </div>
                    </div>
                    <button className="text-red-600 hover:text-red-800 text-sm">
                      Revoke
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
