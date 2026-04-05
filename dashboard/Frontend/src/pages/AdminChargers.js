import React, { useState, useEffect } from 'react';
import { Search, Filter, ToggleLeft, ToggleRight, Eye, Edit, Zap, MapPin, User, Activity, RefreshCw, Plus, Trash2, X } from 'lucide-react';
import axios from 'axios';

const AdminChargers = () => {
  const [chargers, setChargers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCharger, setEditingCharger] = useState(null);
  const [newCharger, setNewCharger] = useState({
    name: '',
    displayName: '',
    status: 'OFFLINE',
    vendorId: '',
    lat: '',
    lng: '',
    address: ''
  });

  useEffect(() => {
    fetchChargers();
  }, []);

  const fetchChargers = async () => {
    try {
      const response = await axios.get('/api/admin/chargers');
      setChargers(response.data.chargers);
    } catch (error) {
      console.error('Failed to fetch chargers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchChargers();
  };

  const toggleChargerStatus = async (chargerId, newStatus) => {
    try {
      const response = await axios.patch(`/api/admin/chargers/${chargerId}/status`, {
        status: newStatus
      });
      
      // Update local state
      setChargers(chargers.map(charger => 
        charger.id === chargerId 
          ? { ...charger, status: newStatus }
          : charger
      ));
      
      console.log('Charger status updated:', response.data.message);
    } catch (error) {
      console.error('Failed to toggle charger status:', error);
    }
  };

  const handleCreateCharger = async () => {
    try {
      const response = await axios.post('/api/admin/chargers', {
        ...newCharger,
        lat: parseFloat(newCharger.lat),
        lng: parseFloat(newCharger.lng)
      });
      
      setShowAddModal(false);
      setNewCharger({
        name: '',
        displayName: '',
        status: 'OFFLINE',
        vendorId: '',
        lat: '',
        lng: '',
        address: ''
      });
      await fetchChargers();
      console.log('Charger created:', response.data.message);
    } catch (error) {
      console.error('Failed to create charger:', error);
      alert(error.response?.data?.message || 'Failed to create charger');
    }
  };

  const handleUpdateCharger = async () => {
    try {
      const response = await axios.put(`/api/admin/chargers/${editingCharger.id}`, {
        ...editingCharger,
        lat: parseFloat(editingCharger.lat),
        lng: parseFloat(editingCharger.lng)
      });
      
      setShowEditModal(false);
      setEditingCharger(null);
      await fetchChargers();
      console.log('Charger updated:', response.data.message);
    } catch (error) {
      console.error('Failed to update charger:', error);
      alert(error.response?.data?.message || 'Failed to update charger');
    }
  };

  const handleDeleteCharger = async (chargerId) => {
    if (!window.confirm('Are you sure you want to delete this charger? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await axios.delete(`/api/admin/chargers/${chargerId}`);
      await fetchChargers();
      console.log('Charger deleted:', response.data.message);
    } catch (error) {
      console.error('Failed to delete charger:', error);
      alert(error.response?.data?.message || 'Failed to delete charger');
    }
  };

  const openEditModal = (charger) => {
    setEditingCharger({
      ...charger,
      lat: charger.lat?.toString() || '',
      lng: charger.lng?.toString() || ''
    });
    setShowEditModal(true);
  };

  const filteredChargers = chargers.filter(charger => {
    const matchesSearch = charger.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         charger.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         charger.vendor?.companyName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || charger.status?.toLowerCase() === filterStatus.toLowerCase();
    
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'AVAILABLE':
      case 'ONLINE': return 'bg-green-100 text-green-800';
      case 'OFFLINE': return 'bg-red-100 text-red-800';
      case 'ON_MAINTENANCE':
      case 'MAINTENANCE': return 'bg-yellow-100 text-yellow-800';
      case 'IN_SESSION': return 'bg-blue-100 text-blue-800';
      case 'RESERVED': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
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
        <h1 className="text-3xl font-bold text-gray-900">Charger Management</h1>
        <p className="text-gray-600 mt-2">Manage all charging stations in the system</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Chargers</p>
              <p className="text-2xl font-bold text-gray-900">{chargers.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Zap className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Online</p>
              <p className="text-2xl font-bold text-green-600">{chargers.filter(c => c.status?.toLowerCase() === 'available' || c.status?.toLowerCase() === 'online').length}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">In Session</p>
              <p className="text-2xl font-bold text-blue-600">{chargers.filter(c => c.status?.toLowerCase() === 'in_session').length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Zap className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Offline</p>
              <p className="text-2xl font-bold text-red-600">{chargers.filter(c => c.status?.toLowerCase() === 'offline').length}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <Activity className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search chargers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => {
                if (e.target.value === 'refresh') {
                  handleRefresh();
                  // Reset to previous value after refresh
                  e.target.value = filterStatus;
                } else {
                  setFilterStatus(e.target.value);
                }
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="refresh" className="text-blue-600 font-semibold">
                🔄 Refresh Status
              </option>
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="offline">Offline</option>
              <option value="in_session">In Session</option>
              <option value="reserved">Reserved</option>
              <option value="on_maintenance">Maintenance</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chargers Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Charger
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sessions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Added
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredChargers.map((charger) => (
                <tr key={charger.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{charger.name}</div>
                      <div className="text-sm text-gray-500">{charger.displayName}</div>
                      <div className="text-xs text-gray-400">ID: {charger.id}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{charger.vendor?.companyName}</div>
                    <div className="text-sm text-gray-500">{charger.vendor?.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                      {charger.location?.address || 'No location'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(charger.status)}`}>
                      {charger.status?.replace('_', ' ') || charger.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {charger.sessionCount || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(charger.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <select
                        value={charger.status}
                        onChange={(e) => toggleChargerStatus(charger.id, e.target.value)}
                        className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                      >
                        <option value="available">Available</option>
                        <option value="offline">Offline</option>
                        <option value="on_maintenance">Maintenance</option>
                        <option value="in_session">In Session</option>
                        <option value="reserved">Reserved</option>
                      </select>
                      <button className="p-1 text-blue-600 hover:text-blue-900" title="View Details">
                        <Eye className="h-5 w-5" />
                      </button>
                      <button className="p-1 text-gray-600 hover:text-gray-900" title="Edit">
                        <Edit className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredChargers.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No chargers found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminChargers;
