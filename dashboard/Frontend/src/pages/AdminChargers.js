import React, { useState, useEffect } from 'react';

import { Search, Filter, ToggleLeft, ToggleRight, Eye, Edit, Zap, MapPin, User, Activity, RefreshCw, Plus, Trash2, X } from 'lucide-react';

import axios from 'axios';



const AdminChargers = () => {

  const [chargers, setChargers] = useState([]);

  const [vendors, setVendors] = useState([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  const [filterStatus, setFilterStatus] = useState('all');

  const [filterVendor, setFilterVendor] = useState('all');

  const [showAddModal, setShowAddModal] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);

  const [editingCharger, setEditingCharger] = useState(null);

  // Calculate stats dynamically from chargers data
  const calculateStats = () => {
    const totalChargers = chargers.length;
    const availableChargers = chargers.filter(charger => 
      charger.status?.toLowerCase() === 'available' || 
      charger.status?.toLowerCase() === 'online'
    ).length;
    const inSessionChargers = chargers.filter(charger => 
      charger.status?.toLowerCase() === 'in_session' ||
      charger.status?.toLowerCase() === 'active'
    ).length;
    const offlineChargers = chargers.filter(charger => 
      charger.status?.toLowerCase() === 'offline'
    ).length;
    const reservedChargers = chargers.filter(charger => 
      charger.status?.toLowerCase() === 'reserved'
    ).length;
    const maintenanceChargers = chargers.filter(charger => 
      charger.status?.toLowerCase() === 'on_maintenance' ||
      charger.status?.toLowerCase() === 'maintenance'
    ).length;

    // Debug logging to verify counts
    console.log('Charger Stats Calculation:', {
      totalChargers,
      availableChargers,
      inSessionChargers,
      offlineChargers,
      reservedChargers,
      maintenanceChargers,
      allChargers: chargers.map(c => ({ id: c.id, name: c.name, status: c.status, vendor: c.vendor?.name }))
    });

    return {
      totalChargers,
      availableChargers,
      inSessionChargers,
      offlineChargers,
      reservedChargers,
      maintenanceChargers
    };
  };

  const dynamicStats = calculateStats();

  const [newCharger, setNewCharger] = useState({

    chargerName: '',

    chargerType: 'AC',

    connectorType: 'Type2',

    vendorId: '',

    pricePerUnit: '',

    location: {

      address: '',

      lat: '',

      lng: ''

    },

    status: 'Available',

    serialNumber: ''

  });



  useEffect(() => {

    fetchData();

  }, []);



  const fetchData = async () => {

    try {

      const [chargersResponse, vendorsResponse] = await Promise.all([

        axios.get('/api/admin/chargers'),

        axios.get('/api/admin/vendor-users')

      ]);

      

      setChargers(chargersResponse.data.chargers || []);

      setVendors(vendorsResponse.data.vendors || []);

    } catch (error) {

      console.error('Failed to fetch data:', error);

    } finally {

      setLoading(false);

      setRefreshing(false);

    }

  };



  const fetchChargers = async () => {

    try {

      const response = await axios.get('/api/admin/chargers');

      setChargers(response.data.chargers || []);

    } catch (error) {

      console.error('Failed to fetch chargers:', error);

    } finally {

      setRefreshing(false);

    }

  };



  const handleRefresh = async () => {

    setRefreshing(true);

    await fetchData();

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

      const chargerData = {

        ...newCharger,

        location: {

          ...newCharger.location,

          lat: parseFloat(newCharger.location.lat),

          lng: parseFloat(newCharger.location.lng)

        },

        pricePerUnit: parseFloat(newCharger.pricePerUnit)

      };



      const response = await axios.post('/api/admin/chargers-mongo', chargerData);

      

      setShowAddModal(false);

      setNewCharger({

        chargerName: '',

        chargerType: 'AC',

        connectorType: 'Type2',

        vendorId: '',

        pricePerUnit: '',

        location: {

          address: '',

          lat: '',

          lng: ''

        },

        status: 'Available',

        serialNumber: ''

      });

      await fetchData();

      console.log('Charger created:', response.data.message);

    } catch (error) {

      console.error('Failed to create charger:', error);

      alert(error.response?.data?.message || 'Failed to create charger');

    }

  };



  const handleUpdateCharger = async () => {

    try {

      const chargerData = {

        ...editingCharger,

        location: {

          ...editingCharger.location,

          lat: parseFloat(editingCharger.location.lat),

          lng: parseFloat(editingCharger.location.lng)

        },

        pricePerUnit: parseFloat(editingCharger.pricePerUnit)

      };



      const response = await axios.put(`/api/admin/chargers/${editingCharger.id}`, chargerData);

      

      setShowEditModal(false);

      setEditingCharger(null);

      await fetchData();

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

      await fetchData();

      console.log('Charger deleted:', response.data.message);

    } catch (error) {

      console.error('Failed to delete charger:', error);

      alert(error.response?.data?.message || 'Failed to delete charger');

    }

  };



  const openEditModal = (charger) => {

    setEditingCharger({

      ...charger,

      location: charger.location || { address: '', lat: '', lng: '' }

    });

    setShowEditModal(true);

  };



  const filteredChargers = chargers.filter(charger => {

    const matchesSearch = charger.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         charger.deviceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         charger.vendor?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         charger.location?.address?.toLowerCase().includes(searchTerm.toLowerCase());

    

    const matchesFilter = filterStatus === 'all' || charger.status === filterStatus;

    const matchesVendor = filterVendor === 'all' || charger.vendor?.id === filterVendor;

    

    return matchesSearch && matchesFilter && matchesVendor;

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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-600">Total Chargers</p>

              <p className="text-2xl font-bold text-gray-900">{dynamicStats.totalChargers}</p>

            </div>

            <div className="bg-blue-100 p-3 rounded-full">

              <Zap className="h-6 w-6 text-blue-600" />

            </div>

          </div>

        </div>



        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-600">Available</p>

              <p className="text-2xl font-bold text-green-600">{dynamicStats.availableChargers}</p>

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

              <p className="text-2xl font-bold text-blue-600">{dynamicStats.inSessionChargers}</p>

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

              <p className="text-2xl font-bold text-red-600">{dynamicStats.offlineChargers}</p>

            </div>

            <div className="bg-red-100 p-3 rounded-full">

              <Activity className="h-6 w-6 text-red-600" />

            </div>

          </div>

        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-600">Reserved</p>

              <p className="text-2xl font-bold text-purple-600">{dynamicStats.reservedChargers}</p>

            </div>

            <div className="bg-purple-100 p-3 rounded-full">

              <Zap className="h-6 w-6 text-purple-600" />

            </div>

          </div>

        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-600">Maintenance</p>

              <p className="text-2xl font-bold text-yellow-600">{dynamicStats.maintenanceChargers}</p>

            </div>

            <div className="bg-yellow-100 p-3 rounded-full">

              <Activity className="h-6 w-6 text-yellow-600" />

            </div>

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

                  Type

                </th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">

                  Location

                </th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">

                  Price/Unit

                </th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">

                  Status

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

                      <div className="text-sm text-gray-500">ID: {charger.deviceId}</div>

                      {charger.serialNumber && (

                        <div className="text-xs text-gray-400">SN: {charger.serialNumber}</div>

                      )}

                    </div>

                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">

                    <div className="text-sm text-gray-900">{charger.vendor?.name || 'Unknown'}</div>

                    <div className="text-sm text-gray-500">{charger.vendor?.email || 'No email'}</div>

                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">

                    <div className="text-sm text-gray-900">{charger.chargerType}</div>

                    <div className="text-sm text-gray-500">{charger.connectorType}</div>

                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">

                    <div className="flex items-center text-sm text-gray-900">

                      <MapPin className="h-4 w-4 mr-1 text-gray-400" />

                      {charger.location?.address || 'No location'}

                    </div>

                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">

                    <div className="text-sm text-gray-900">₹{charger.pricePerUnit}</div>

                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">

                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(charger.status)}`}>

                      {charger.status?.replace('_', ' ') || charger.status}

                    </span>

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

                        <option value="Available">Available</option>

                        <option value="Offline">Offline</option>

                        <option value="On_Maintenance">Maintenance</option>

                        <option value="In_Session">In Session</option>

                        <option value="Reserved">Reserved</option>

                      </select>

                      <button 

                        onClick={() => openEditModal(charger)}

                        className="p-1 text-blue-600 hover:text-blue-900" 

                        title="Edit"

                      >

                        <Edit className="h-5 w-5" />

                      </button>

                      <button 

                        onClick={() => handleDeleteCharger(charger.id)}

                        className="p-1 text-red-600 hover:text-red-900" 

                        title="Delete"

                      >

                        <Trash2 className="h-5 w-5" />

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



      {/* Add Charger Modal */}

      {showAddModal && (

        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">

          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            <div className="flex justify-between items-center mb-4">

              <h2 className="text-xl font-bold text-gray-900">Add New Charger</h2>

              <button

                onClick={() => setShowAddModal(false)}

                className="text-gray-400 hover:text-gray-600"

              >

                <X className="h-5 w-5" />

              </button>

            </div>

            

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Charger Name *

                </label>

                <input

                  type="text"

                  value={newCharger.chargerName}

                  onChange={(e) => setNewCharger({...newCharger, chargerName: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  placeholder="Enter charger name"

                  required

                />

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Vendor *

                </label>

                <select

                  value={newCharger.vendorId}

                  onChange={(e) => setNewCharger({...newCharger, vendorId: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  required

                >

                  <option value="">Select Vendor</option>

                  {vendors.map(vendor => (

                    <option key={vendor.vendorId} value={vendor.vendorId}>

                      {vendor.companyName || vendor.name}

                    </option>

                  ))}

                </select>

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Charger Type *

                </label>

                <select

                  value={newCharger.chargerType}

                  onChange={(e) => setNewCharger({...newCharger, chargerType: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  required

                >

                  <option value="AC">AC</option>

                  <option value="DC">DC</option>

                  <option value="DC_Fast">DC Fast</option>

                  <option value="Type1">Type1</option>

                  <option value="Type2">Type2</option>

                  <option value="CCS">CCS</option>

                  <option value="CHAdeMO">CHAdeMO</option>

                  <option value="Tesla">Tesla</option>

                </select>

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Connector Type *

                </label>

                <select

                  value={newCharger.connectorType}

                  onChange={(e) => setNewCharger({...newCharger, connectorType: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  required

                >

                  <option value="Type1">Type1</option>

                  <option value="Type2">Type2</option>

                  <option value="CCS">CCS</option>

                  <option value="CHAdeMO">CHAdeMO</option>

                  <option value="Tesla">Tesla</option>

                  <option value="GB/T">GB/T</option>

                  <option value="J1772">J1772</option>

                </select>

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Price per Unit (₹) *

                </label>

                <input

                  type="number"

                  step="0.01"

                  min="0"

                  value={newCharger.pricePerUnit}

                  onChange={(e) => setNewCharger({...newCharger, pricePerUnit: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  placeholder="Enter price per unit"

                  required

                />

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Status

                </label>

                <select

                  value={newCharger.status}

                  onChange={(e) => setNewCharger({...newCharger, status: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                >

                  <option value="Available">Available</option>

                  <option value="Offline">Offline</option>

                  <option value="On_Maintenance">Maintenance</option>

                  <option value="Reserved">Reserved</option>

                </select>

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Serial Number

                </label>

                <input

                  type="text"

                  value={newCharger.serialNumber}

                  onChange={(e) => setNewCharger({...newCharger, serialNumber: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  placeholder="Enter serial number"

                />

              </div>

              

              <div className="md:col-span-2">

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Address *

                </label>

                <input

                  type="text"

                  value={newCharger.location.address}

                  onChange={(e) => setNewCharger({...newCharger, location: {...newCharger.location, address: e.target.value}})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  placeholder="Enter charger address"

                  required

                />

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Latitude *

                </label>

                <input

                  type="number"

                  step="0.000001"

                  min="-90"

                  max="90"

                  value={newCharger.location.lat}

                  onChange={(e) => setNewCharger({...newCharger, location: {...newCharger.location, lat: e.target.value}})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  placeholder="Enter latitude"

                  required

                />

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Longitude *

                </label>

                <input

                  type="number"

                  step="0.000001"

                  min="-180"

                  max="180"

                  value={newCharger.location.lng}

                  onChange={(e) => setNewCharger({...newCharger, location: {...newCharger.location, lng: e.target.value}})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  placeholder="Enter longitude"

                  required

                />

              </div>

            </div>

            

            <div className="flex justify-end space-x-3 mt-6">

              <button

                onClick={() => setShowAddModal(false)}

                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"

              >

                Cancel

              </button>

              <button

                onClick={handleCreateCharger}

                disabled={!newCharger.chargerName || !newCharger.vendorId || !newCharger.pricePerUnit || !newCharger.location.address || !newCharger.location.lat || !newCharger.location.lng}

                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"

              >

                Create Charger

              </button>

            </div>

          </div>

        </div>

      )}



      {/* Edit Charger Modal */}

      {showEditModal && editingCharger && (

        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">

          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            <div className="flex justify-between items-center mb-4">

              <h2 className="text-xl font-bold text-gray-900">Edit Charger</h2>

              <button

                onClick={() => setShowEditModal(false)}

                className="text-gray-400 hover:text-gray-600"

              >

                <X className="h-5 w-5" />

              </button>

            </div>

            

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Charger Name *

                </label>

                <input

                  type="text"

                  value={editingCharger.chargerName}

                  onChange={(e) => setEditingCharger({...editingCharger, chargerName: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  placeholder="Enter charger name"

                  required

                />

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Vendor *

                </label>

                <select

                  value={editingCharger.vendorId?._id || editingCharger.vendorId}

                  onChange={(e) => setEditingCharger({...editingCharger, vendorId: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  required

                >

                  <option value="">Select Vendor</option>

                  {vendors.map(vendor => (

                    <option key={vendor.vendorId} value={vendor.vendorId}>

                      {vendor.companyName || vendor.name}

                    </option>

                  ))}

                </select>

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Charger Type *

                </label>

                <select

                  value={editingCharger.chargerType}

                  onChange={(e) => setEditingCharger({...editingCharger, chargerType: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  required

                >

                  <option value="AC">AC</option>

                  <option value="DC">DC</option>

                  <option value="DC_Fast">DC Fast</option>

                  <option value="Type1">Type1</option>

                  <option value="Type2">Type2</option>

                  <option value="CCS">CCS</option>

                  <option value="CHAdeMO">CHAdeMO</option>

                  <option value="Tesla">Tesla</option>

                </select>

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Connector Type *

                </label>

                <select

                  value={editingCharger.connectorType}

                  onChange={(e) => setEditingCharger({...editingCharger, connectorType: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  required

                >

                  <option value="Type1">Type1</option>

                  <option value="Type2">Type2</option>

                  <option value="CCS">CCS</option>

                  <option value="CHAdeMO">CHAdeMO</option>

                  <option value="Tesla">Tesla</option>

                  <option value="GB/T">GB/T</option>

                  <option value="J1772">J1772</option>

                </select>

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Price per Unit (₹) *

                </label>

                <input

                  type="number"

                  step="0.01"

                  min="0"

                  value={editingCharger.pricePerUnit}

                  onChange={(e) => setEditingCharger({...editingCharger, pricePerUnit: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  placeholder="Enter price per unit"

                  required

                />

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Status

                </label>

                <select

                  value={editingCharger.status}

                  onChange={(e) => setEditingCharger({...editingCharger, status: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                >

                  <option value="Available">Available</option>

                  <option value="Offline">Offline</option>

                  <option value="On_Maintenance">Maintenance</option>

                  <option value="In_Session">In Session</option>

                  <option value="Reserved">Reserved</option>

                </select>

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Serial Number

                </label>

                <input

                  type="text"

                  value={editingCharger.serialNumber}

                  onChange={(e) => setEditingCharger({...editingCharger, serialNumber: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  placeholder="Enter serial number"

                />

              </div>

              

              <div className="md:col-span-2">

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Address *

                </label>

                <input

                  type="text"

                  value={editingCharger.location?.address || ''}

                  onChange={(e) => setEditingCharger({...editingCharger, location: {...editingCharger.location, address: e.target.value}})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  placeholder="Enter charger address"

                  required

                />

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Latitude *

                </label>

                <input

                  type="number"

                  step="0.000001"

                  min="-90"

                  max="90"

                  value={editingCharger.location?.lat || ''}

                  onChange={(e) => setEditingCharger({...editingCharger, location: {...editingCharger.location, lat: e.target.value}})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  placeholder="Enter latitude"

                  required

                />

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Longitude *

                </label>

                <input

                  type="number"

                  step="0.000001"

                  min="-180"

                  max="180"

                  value={editingCharger.location?.lng || ''}

                  onChange={(e) => setEditingCharger({...editingCharger, location: {...editingCharger.location, lng: e.target.value}})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  placeholder="Enter longitude"

                  required

                />

              </div>

            </div>

            

            <div className="flex justify-end space-x-3 mt-6">

              <button

                onClick={() => setShowEditModal(false)}

                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"

              >

                Cancel

              </button>

              <button

                onClick={handleUpdateCharger}

                disabled={!editingCharger.chargerName || !editingCharger.vendorId || !editingCharger.pricePerUnit || !editingCharger.location?.address || !editingCharger.location?.lat || !editingCharger.location?.lng}

                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"

              >

                Update Charger

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

};



export default AdminChargers;

