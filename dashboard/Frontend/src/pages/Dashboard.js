import React, { useState, useEffect } from 'react';
import { Users, DollarSign, Zap, Clock, TrendingUp, Activity } from 'lucide-react';
import StatCard from '../components/StatCard';
import ChargerStatus from '../components/ChargerStatus';
import RevenueChart from '../components/RevenueChart';
import SessionsChart from '../components/SessionsChart';
import axios from 'axios';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    newUsersThisWeek: 0,
    totalVendors: 0,
    newVendorsThisWeek: 0,
    totalChargers: 0,
    activeSessions: 0,
    revenueToday: 0,
    revenueChange: 0,
    pendingPayout: 0,
    chargerStatus: {
      available: 0,
      in_session: 0,
      offline: 0,
      reserved: 0,
      maintenance: 0
    }
  });
  const [revenueData, setRevenueData] = useState([]);
  const [sessionsData, setSessionsData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
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
      console.error('Failed to fetch dashboard data:', error);
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

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome to your PlugBox admin dashboard</p>
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
