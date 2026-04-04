import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit, Trash2, MapPin, Zap, DollarSign, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';
import AddChargerModal from '../components/AddChargerModal';
import EditChargerModal from '../components/EditChargerModal';
import { useAuth } from '../contexts/AuthContext';

const Chargers = () => {
  const { user } = useAuth();
  const [chargers, setChargers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCharger, setSelectedCharger] = useState(null);

  // Debug log
  console.log('Chargers component - User:', user);
  console.log('Chargers component - Loading:', loading);
  console.log('Chargers component - Error:', error);
  console.log('Chargers component - Chargers count:', chargers.length);

  useEffect(() => {
    fetchChargers();
  }, [currentPage, searchTerm, statusFilter]);

  const fetchChargers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page: currentPage,
        limit: 10,
      };
      
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== 'all') params.status = statusFilter;

      // Use different endpoint based on user role
      const endpoint = user?.role === 'admin' ? '/api/chargers' : '/api/vendor/chargers';
      const response = await axios.get(endpoint, { params });
      
      // Handle different response formats
      const chargersData = user?.role === 'admin' ? response.data.chargers : response.data.data;
      setChargers(chargersData || []);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (err) {
      console.error('Error fetching chargers:', err);
      
      if (err.response?.status === 401) {
        setError('Authentication required. Please log in again.');
      } else if (err.response?.status === 403) {
        setError('Access denied. You do not have permission to view chargers.');
      } else {
        setError(err.response?.data?.message || 'Failed to load chargers');
      }
      
      setChargers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCharger = async (chargerId) => {
    if (!window.confirm('Are you sure you want to delete this charger?')) return;
    
    try {
      const endpoint = user?.role === 'admin' ? `/api/chargers/${chargerId}` : `/api/vendor/chargers/${chargerId}`;
      await axios.delete(endpoint);
      fetchChargers();
    } catch (err) {
      setError('Failed to delete charger');
      console.error('Error deleting charger:', err);
    }
  };

  const handleEditCharger = (charger) => {
    setSelectedCharger(charger);
    setShowEditModal(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Available': return 'text-green-600 bg-green-100';
      case 'In_Session': return 'text-blue-600 bg-blue-100';
      case 'Reserved': return 'text-yellow-600 bg-yellow-100';
      case 'Offline': return 'text-gray-600 bg-gray-100';
      case 'On_Maintenance': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Available': return <Zap className="h-4 w-4" />;
      case 'In_Session': return <Zap className="h-4 w-4 animate-pulse" />;
      case 'Reserved': return <Zap className="h-4 w-4" />;
      case 'Offline': return <Zap className="h-4 w-4 opacity-50" />;
      case 'On_Maintenance': return <Zap className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Charger Management</h1>
          <p className="text-gray-600 mt-1">Manage your EV charging stations</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          <span>Add Charger</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col md:flex-row gap-4 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search chargers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-600" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="Available">Available</option>
                <option value="In_Session">In Session</option>
                <option value="Reserved">Reserved</option>
                <option value="Offline">Offline</option>
                <option value="On_Maintenance">On Maintenance</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <span className="font-medium">Error:</span>
            <span className="ml-2">{error}</span>
          </div>
        </div>
      )}

      {/* Chargers Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Charger Info
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price/Unit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {chargers.length > 0 ? (
                chargers.map((charger) => (
                  <tr key={charger._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-gray-200 rounded-full h-10 w-10 flex items-center justify-center">
                          {getStatusIcon(charger.status)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{charger.chargerName}</p>
                          <p className="text-sm text-gray-600">ID: {charger.chargerId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(charger.status)}`}>
                        {charger.status?.replace('_', ' ') || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-sm text-gray-900">{charger.chargerType}</p>
                        <p className="text-xs text-gray-600">{charger.connectorType}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{formatCurrency(charger.pricePerUnit)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="truncate max-w-xs">{charger.location?.address}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditCharger(charger)}
                          className="text-blue-600 hover:text-blue-700"
                          title="Edit Charger"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCharger(charger._id)}
                          className="text-red-600 hover:text-red-700"
                          title="Delete Charger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center">
                    {error ? (
                      <div className="text-red-600">
                        <p className="font-medium">{error}</p>
                        <p className="text-sm mt-2">Please try refreshing the page or contact support.</p>
                      </div>
                    ) : (
                      <div className="text-gray-500">
                        <p className="font-medium">No chargers found</p>
                        <p className="text-sm mt-2">Get started by adding your first charger.</p>
                        <button
                          onClick={() => setShowAddModal(true)}
                          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Add Your First Charger
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modals */}
      <AddChargerModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onChargerAdded={fetchChargers}
      />

      <EditChargerModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        charger={selectedCharger}
        onChargerUpdated={fetchChargers}
      />
    </div>
  );
};

export default Chargers;
