import React, { useState, useEffect } from 'react';
import { Users, DollarSign, Zap, Clock, TrendingUp, Activity } from 'lucide-react';
import StatCard from '../components/StatCard';
import ChargerStatus from '../components/ChargerStatus';
import RevenueChart from '../components/RevenueChart';
import SessionsChart from '../components/SessionsChart';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    vendors: { total: 0, active: 0 },
    chargers: { total: 0, active: 0 },
    users: { total: 0 },
    sessions: { total: 0, active: 0 },
    revenue: { total: 0 }
  });
  const [revenueData, setRevenueData] = useState([]);
  const [sessionsData, setSessionsData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAdminDashboardData();
    } else {
      fetchVendorDashboardData();
    }
  }, [user]);

  const fetchAdminDashboardData = async () => {
    try {
      const response = await axios.get('/api/admin/dashboard');
      setStats(response.data.stats);
    } catch (error) {
      console.error('Failed to fetch admin dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendorDashboardData = async () => {
    try {
      const [statsResponse, revenueResponse, sessionsResponse] = await Promise.all([
        axios.get('/api/dashboard/stats'),
        axios.get('/api/dashboard/revenue-trend?days=30'),
        axios.get('/api/dashboard/sessions-over-time?days=30')
      ]);

      setStats(statsResponse.data);
      setRevenueData(revenueResponse.data);
      setSessionsData(sessionsResponse.data);
    } catch (error) {
      console.error('Failed to fetch vendor dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Admin Dashboard View
  if (user?.role === 'admin') {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome to your PlugBox admin dashboard</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
          <StatCard
            title="Total Users"
            value={stats.users.total.toLocaleString()}
            change="Active"
            changeType="positive"
            icon={Users}
            color="blue"
          />
          
          <StatCard
            title="Vendors"
            value={`${stats.vendors.active}/${stats.vendors.total}`}
            change="Active"
            changeType="positive"
            icon={DollarSign}
            color="green"
          />
          
          <StatCard
            title="Chargers"
            value={`${stats.chargers.active}/${stats.chargers.total}`}
            change="Online"
            changeType="positive"
            icon={Zap}
            color="purple"
          />
          
          <StatCard
            title="Active Sessions"
            value={stats.sessions.active.toLocaleString()}
            change="Live"
            changeType="neutral"
            icon={Clock}
            color="orange"
          />
          
          <StatCard
            title="Total Revenue"
            value={`₹${(stats.revenue.total / 100).toLocaleString()}`}
            change="All time"
            changeType="positive"
            icon={TrendingUp}
            color="green"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">System Overview</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Total Vendors</span>
                <span className="font-semibold">{stats.vendors.total}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Active Vendors</span>
                <span className="font-semibold text-green-600">{stats.vendors.active}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Total Chargers</span>
                <span className="font-semibold">{stats.chargers.total}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Active Chargers</span>
                <span className="font-semibold text-green-600">{stats.chargers.active}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Total Sessions</span>
                <span className="font-semibold">{stats.sessions.total}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Active Sessions</span>
                <span className="font-semibold text-blue-600">{stats.sessions.active}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button 
                onClick={() => window.location.href = '/admin/vendors'}
                className="w-full text-left px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <p className="font-medium text-gray-900">Manage Vendors</p>
                <p className="text-xs text-gray-500">View and manage all vendors</p>
              </button>
              <button 
                onClick={() => window.location.href = '/admin/chargers'}
                className="w-full text-left px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <p className="font-medium text-gray-900">Manage Chargers</p>
                <p className="text-xs text-gray-500">View and manage all chargers</p>
              </button>
              <button 
                onClick={() => window.location.href = '/admin/users'}
                className="w-full text-left px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <p className="font-medium text-gray-900">Manage Users</p>
                <p className="text-xs text-gray-500">View and manage all users</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Vendor Dashboard View (original implementation)
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Vendor Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome to your PlugBox vendor dashboard</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
        <StatCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          change={`+${stats.newUsersThisWeek}`}
          changeType="positive"
          icon={Users}
          color="blue"
        />
        
        <StatCard
          title="Vendors"
          value={stats.totalVendors.toLocaleString()}
          change={`+${stats.newVendorsThisWeek} new`}
          changeType="positive"
          icon={DollarSign}
          color="green"
        />
        
        <StatCard
          title="Chargers"
          value={stats.totalChargers.toLocaleString()}
          change="98.5%"
          changeType="positive"
          icon={Zap}
          color="purple"
        />
        
        <StatCard
          title="Active Sessions"
          value={stats.activeSessions.toLocaleString()}
          change="Real-time"
          changeType="neutral"
          icon={Clock}
          color="orange"
        />
        
        <StatCard
          title="Revenue Today"
          value={`₹${stats.revenueToday.toLocaleString()}`}
          change={`${stats.revenueChange}%`}
          changeType={stats.revenueChange >= 0 ? 'positive' : 'negative'}
          icon={TrendingUp}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h2>
            <RevenueChart data={revenueData} />
          </div>
        </div>
        
        <div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Payout</h2>
            <div className="space-y-4">
              <div>
                <p className="text-2xl font-bold text-gray-900">₹{stats.pendingPayout.toLocaleString()}</p>
                <p className="text-sm text-gray-600">To {stats.totalVendors} vendors</p>
              </div>
              <button className="w-full bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors duration-200">
                Process Payouts
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Charger Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <ChargerStatus
              status="Available"
              count={stats.chargerStatus.available}
              color="green"
            />
            <ChargerStatus
              status="In Session"
              count={stats.chargerStatus.in_session}
              color="blue"
            />
            <ChargerStatus
              status="Offline"
              count={stats.chargerStatus.offline}
              color="red"
            />
            <ChargerStatus
              status="Reserved"
              count={stats.chargerStatus.reserved}
              color="yellow"
            />
            <ChargerStatus
              status="Maintenance"
              count={stats.chargerStatus.maintenance}
              color="gray"
            />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sessions Over Time</h2>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <SessionsChart data={sessionsData} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activities</h2>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <Activity className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Charging session completed</p>
                    <p className="text-xs text-gray-500">User completed charging at Station #{item}</p>
                  </div>
                  <span className="text-xs text-gray-400">{item}h ago</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button className="w-full text-left px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <p className="font-medium text-gray-900">Add New Vendor</p>
                <p className="text-xs text-gray-500">Register a new charging vendor</p>
              </button>
              <button className="w-full text-left px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <p className="font-medium text-gray-900">Add New Charger</p>
                <p className="text-xs text-gray-500">Install a new charging station</p>
              </button>
              <button className="w-full text-left px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <p className="font-medium text-gray-900">Generate Report</p>
                <p className="text-xs text-gray-500">Download monthly analytics</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
