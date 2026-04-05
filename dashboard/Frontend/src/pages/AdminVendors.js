import React, { useState, useEffect } from 'react';

import { Search, Filter, ToggleLeft, ToggleRight, Eye, Edit, Trash2, Users, DollarSign, Zap, Plus, X } from 'lucide-react';

import axios from 'axios';



const AdminVendors = () => {

  const [vendors, setVendors] = useState([]);

  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');

  const [filterStatus, setFilterStatus] = useState('all');

  const [showAddModal, setShowAddModal] = useState(false);

  const [showChargerModal, setShowChargerModal] = useState(false);

  const [selectedVendor, setSelectedVendor] = useState(null);

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

  const [newVendor, setNewVendor] = useState({

    name: '',

    email: '',

    phone: '',

    password: '',

    companyName: ''

  });



  useEffect(() => {

    fetchVendors();

  }, []);



  const fetchVendors = async () => {

    try {

      const response = await axios.get('/api/admin/vendor-users');

      setVendors(response.data.vendors);

    } catch (error) {

      console.error('Failed to fetch vendors:', error);

    } finally {

      setLoading(false);

    }

  };



  const handleRefresh = async () => {

    setLoading(true);

    await fetchVendors();

  };



  const handleCreateVendor = async () => {

    try {

      const response = await axios.post('/api/admin/vendor-users', newVendor);

      setShowAddModal(false);

      setNewVendor({

        name: '',

        email: '',

        phone: '',

        password: '',

        companyName: ''

      });

      await fetchVendors();

      console.log('Vendor created:', response.data.message);

    } catch (error) {

      console.error('Failed to create vendor:', error);

      alert(error.response?.data?.error || 'Failed to create vendor');

    }

  };



  const handleAddCharger = (vendor) => {

    setSelectedVendor(vendor);

    setNewCharger({

      ...newCharger,

      vendorId: vendor.vendorId || vendor.id

    });

    setShowChargerModal(true);

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

      

      setShowChargerModal(false);

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

      setSelectedVendor(null);

      await fetchVendors();

      console.log('Charger created:', response.data.message);

    } catch (error) {

      console.error('Failed to create charger:', error);

      alert(error.response?.data?.message || 'Failed to create charger');

    }

  };



  const handleDeleteVendor = async (vendorId) => {

    if (!window.confirm('Are you sure you want to delete this vendor? This action cannot be undone.')) {

      return;

    }

    

    try {

      const response = await axios.delete(`/api/admin/vendor-users/${vendorId}`);

      await fetchVendors();

      console.log('Vendor deleted:', response.data.message);

    } catch (error) {

      console.error('Failed to delete vendor:', error);

      alert(error.response?.data?.error || 'Failed to delete vendor');

    }

  };



  const toggleVendorStatus = async (vendorId, currentStatus) => {

    try {

      const response = await axios.patch(`/api/admin/vendor-users/${vendorId}/status`, {

        isActive: !currentStatus

      });

      

      // Update local state

      setVendors(vendors.map(vendor => 

        vendor.id === vendorId 

          ? { ...vendor, isActive: !currentStatus }

          : vendor

      ));

      

      console.log('Vendor status updated:', response.data.message);

    } catch (error) {

      console.error('Failed to toggle vendor status:', error);

      // Revert state if API call fails

      setVendors(vendors.map(vendor => 

        vendor.id === vendorId 

          ? { ...vendor, isActive: currentStatus }

          : vendor

      ));

    }

  };



  const filteredVendors = vendors.filter(vendor => {

    const matchesSearch = vendor.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||

                         vendor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||

                         vendor.name?.toLowerCase().includes(searchTerm.toLowerCase());

    

    const matchesFilter = filterStatus === 'all' || 

                         (filterStatus === 'active' && vendor.isActive) ||

                         (filterStatus === 'inactive' && !vendor.isActive);

    

    return matchesSearch && matchesFilter;

  });



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

        <div className="flex justify-between items-center">

          <div>

            <h1 className="text-3xl font-bold text-gray-900">Vendor Management</h1>

            <p className="text-gray-600 mt-2">Manage all charging vendors in the system</p>

          </div>

          <button

            onClick={() => setShowAddModal(true)}

            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"

          >

            <Plus className="h-5 w-5" />

            <span>Add Vendor</span>

          </button>

        </div>

      </div>



      {/* Stats Cards */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-600">Total Vendors</p>

              <p className="text-2xl font-bold text-gray-900">{vendors.length}</p>

            </div>

            <div className="bg-blue-100 p-3 rounded-full">

              <Users className="h-6 w-6 text-blue-600" />

            </div>

          </div>

        </div>



        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-600">Active Vendors</p>

              <p className="text-2xl font-bold text-green-600">{vendors.filter(v => v.isActive).length}</p>

            </div>

            <div className="bg-green-100 p-3 rounded-full">

              <DollarSign className="h-6 w-6 text-green-600" />

            </div>

          </div>

        </div>



        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-600">Total Chargers</p>

              <p className="text-2xl font-bold text-purple-600">{vendors.reduce((sum, v) => sum + (v.chargerCount || 0), 0)}</p>

            </div>

            <div className="bg-purple-100 p-3 rounded-full">

              <Zap className="h-6 w-6 text-purple-600" />

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

                placeholder="Search vendors..."

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

              <option value="active">Active</option>

              <option value="inactive">Inactive</option>

            </select>

          </div>

        </div>

      </div>



      {/* Vendors Table */}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">

        <div className="overflow-x-auto">

          <table className="min-w-full divide-y divide-gray-200">

            <thead className="bg-gray-50">

              <tr>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">

                  Vendor

                </th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">

                  Contact

                </th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">

                  Chargers

                </th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">

                  Wallet Balance

                </th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">

                  Status

                </th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">

                  Joined

                </th>

                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">

                  Actions

                </th>

              </tr>

            </thead>

            <tbody className="bg-white divide-y divide-gray-200">

              {filteredVendors.map((vendor) => (

                <tr key={vendor.id} className="hover:bg-gray-50">

                  <td className="px-6 py-4 whitespace-nowrap">

                    <div>

                      <div className="text-sm font-medium text-gray-900">{vendor.name}</div>

                      <div className="text-sm text-gray-500">{vendor.companyName}</div>

                    </div>

                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">

                    <div>

                      <div className="text-sm text-gray-900">{vendor.email}</div>

                      <div className="text-sm text-gray-500">{vendor.phoneNumber}</div>

                    </div>

                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">

                    <div className="text-sm text-gray-900">{vendor.chargerCount || 0}</div>

                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">

                    <div className="text-sm text-gray-900">₹{vendor.walletBalance?.toFixed(2) || '0.00'}</div>

                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">

                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${

                      vendor.isActive 

                        ? 'bg-green-100 text-green-800' 

                        : 'bg-red-100 text-red-800'

                    }`}>

                      {vendor.isActive ? 'Active' : 'Inactive'}

                    </span>

                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">

                    {new Date(vendor.createdAt).toLocaleDateString()}

                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">

                    <div className="flex justify-end space-x-2">

                      <button

                        onClick={() => handleAddCharger(vendor)}

                        className="p-1 text-green-600 hover:text-green-900"

                        title="Add Chargers"

                      >

                        <Zap className="h-5 w-5" />

                      </button>

                      <button

                        onClick={() => toggleVendorStatus(vendor.id, vendor.isActive)}

                        className={`p-1 rounded ${

                          vendor.isActive 

                            ? 'text-red-600 hover:text-red-900' 

                            : 'text-green-600 hover:text-green-900'

                        }`}

                        title={vendor.isActive ? 'Deactivate' : 'Activate'}

                      >

                        {vendor.isActive ? <ToggleLeft className="h-5 w-5" /> : <ToggleRight className="h-5 w-5" />}

                      </button>

                      <button className="p-1 text-blue-600 hover:text-blue-900" title="View Details">

                        <Eye className="h-5 w-5" />

                      </button>

                      <button className="p-1 text-gray-600 hover:text-gray-900" title="Edit">

                        <Edit className="h-5 w-5" />

                      </button>

                      <button

                        onClick={() => handleDeleteVendor(vendor.id)}

                        className="p-1 text-red-600 hover:text-red-900"

                        title="Delete Vendor"

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

        

        {filteredVendors.length === 0 && (

          <div className="text-center py-8">

            <p className="text-gray-500">No vendors found</p>

          </div>

        )}

      </div>



      {/* Add Vendor Modal */}

      {showAddModal && (

        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">

          <div className="bg-white rounded-lg p-6 w-full max-w-md">

            <div className="flex justify-between items-center mb-4">

              <h2 className="text-xl font-bold text-gray-900">Add New Vendor</h2>

              <button

                onClick={() => setShowAddModal(false)}

                className="text-gray-400 hover:text-gray-600"

              >

                <X className="h-5 w-5" />

              </button>

            </div>

            

            <div className="space-y-4">

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Name

                </label>

                <input

                  type="text"

                  value={newVendor.name}

                  onChange={(e) => setNewVendor({...newVendor, name: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  placeholder="Enter vendor name"

                />

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Email

                </label>

                <input

                  type="email"

                  value={newVendor.email}

                  onChange={(e) => setNewVendor({...newVendor, email: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  placeholder="Enter email address"

                />

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Phone Number *

                </label>

                <input

                  type="tel"

                  value={newVendor.phone}

                  onChange={(e) => setNewVendor({...newVendor, phone: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  placeholder="Enter phone number"

                  required

                />

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Password *

                </label>

                <input

                  type="password"

                  value={newVendor.password}

                  onChange={(e) => setNewVendor({...newVendor, password: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  placeholder="Enter password"

                  required

                />

              </div>

              

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">

                  Company Name

                </label>

                <input

                  type="text"

                  value={newVendor.companyName}

                  onChange={(e) => setNewVendor({...newVendor, companyName: e.target.value})}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  placeholder="Enter company name"

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

                onClick={handleCreateVendor}

                disabled={!newVendor.phone || !newVendor.password}

                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"

              >

                Create Vendor

              </button>

            </div>

          </div>

        </div>

      )}



      {/* Add Charger Modal */}

      {showChargerModal && (

        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">

          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            <div className="flex justify-between items-center mb-4">

              <h2 className="text-xl font-bold text-gray-900">

                Add Charger for {selectedVendor?.companyName || selectedVendor?.name}

              </h2>

              <button

                onClick={() => setShowChargerModal(false)}

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

                onClick={() => setShowChargerModal(false)}

                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"

              >

                Cancel

              </button>

              <button

                onClick={handleCreateCharger}

                disabled={!newCharger.chargerName || !newCharger.vendorId || !newCharger.pricePerUnit || !newCharger.location.address || !newCharger.location.lat || !newCharger.location.lng}

                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"

              >

                Add Charger

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

};



export default AdminVendors;

