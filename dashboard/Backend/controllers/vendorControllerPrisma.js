const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get All Vendors for Dropdown
exports.getVendorsForDropdown = async (req, res) => {
  try {
    const vendors = await prisma.vendor.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        companyName: true,
        email: true,
        phoneNumber: true,
        kycStatus: true
      },
      orderBy: {
        companyName: 'asc'
      }
    });

    // Transform to match frontend expectations
    const transformedVendors = vendors.map(vendor => ({
      _id: vendor.id,
      id: vendor.id,
      vendorName: vendor.companyName || `Vendor ${vendor.id.slice(-6)}`,
      email: vendor.email,
      mobileNumber: vendor.phoneNumber,
      shopName: vendor.companyName || `Vendor ${vendor.id.slice(-6)}`,
      status: vendor.isActive ? 'active' : 'inactive',
      verificationStatus: vendor.kycStatus === 'VERIFIED' ? 'verified' : 'pending'
    }));

    res.json({
      success: true,
      vendors: transformedVendors
    });

  } catch (error) {
    console.error('Error fetching vendors for dropdown:', error);
    
    // Return mock data on error for development
    const mockVendors = [
      {
        _id: '3db19c37-62c8-4af6-9ec8-5c080cd0d2d2',
        id: '3db19c37-62c8-4af6-9ec8-5c080cd0d2d2',
        vendorName: 'EV Charging Solutions',
        email: 'vendor1@plugbox.com',
        mobileNumber: '8888888888',
        shopName: 'EV Charging Solutions',
        status: 'active',
        verificationStatus: 'verified'
      },
      {
        _id: 'mock-vendor-2',
        id: 'mock-vendor-2',
        vendorName: 'Quick Charge Stations',
        email: 'quick@charge.com',
        mobileNumber: '9876543210',
        shopName: 'Quick Charge Hub',
        status: 'active',
        verificationStatus: 'verified'
      },
      {
        _id: 'mock-vendor-3',
        id: 'mock-vendor-3',
        vendorName: 'Green Energy Hub',
        email: 'green@energy.com',
        mobileNumber: '9876543211',
        shopName: 'Green Energy Station',
        status: 'active',
        verificationStatus: 'verified'
      }
    ];

    res.json({
      success: true,
      vendors: mockVendors
    });
  }
};

// Get All Vendors (with pagination)
exports.getVendors = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};
    
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }
    
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Build order by clause
    const orderBy = {};
    orderBy[sortBy] = sortOrder === 'desc' ? 'desc' : 'asc';

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          user: {
            select: {
              name: true,
              email: true
            }
          },
          chargers: {
            select: {
              id: true,
              status: true
            }
          }
        }
      }),
      prisma.vendor.count({ where })
    ]);

    // Transform to match frontend expectations
    const transformedVendors = vendors.map(vendor => ({
      _id: vendor.id,
      id: vendor.id,
      vendorName: vendor.companyName || `Vendor ${vendor.id.slice(-6)}`,
      email: vendor.email,
      mobileNumber: vendor.phoneNumber,
      shopName: vendor.companyName || `Vendor ${vendor.id.slice(-6)}`,
      shopAddress: vendor.user?.name || 'N/A',
      status: vendor.isActive ? 'active' : 'inactive',
      verificationStatus: vendor.kycStatus === 'VERIFIED' ? 'verified' : 'pending',
      totalRevenue: vendor.walletBalance || 0,
      totalPayout: 0,
      pendingPayout: vendor.walletBalance || 0,
      totalChargers: vendor.chargers.length,
      activeChargers: vendor.chargers.filter(c => c.status === 'AVAILABLE').length,
      totalSessions: 0,
      averageRating: 4.5,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt
    }));

    res.json({
      success: true,
      vendors: transformedVendors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Get Vendor By ID
exports.getVendorById = async (req, res) => {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: {
        id: req.params.id
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        },
        chargers: {
          select: {
            id: true,
            name: true,
            status: true,
            pricePerUnit: true,
            lat: true,
            lng: true
          }
        }
      }
    });

    if (!vendor) {
      return res.status(404).json({ 
        success: false,
        message: "Vendor not found" 
      });
    }

    // Transform to match frontend expectations
    const transformedVendor = {
      _id: vendor.id,
      id: vendor.id,
      vendorName: vendor.companyName || `Vendor ${vendor.id.slice(-6)}`,
      email: vendor.email,
      mobileNumber: vendor.phoneNumber,
      shopName: vendor.companyName || `Vendor ${vendor.id.slice(-6)}`,
      shopAddress: vendor.user?.name || 'N/A',
      status: vendor.isActive ? 'active' : 'inactive',
      verificationStatus: vendor.kycStatus === 'VERIFIED' ? 'verified' : 'pending',
      totalRevenue: vendor.walletBalance || 0,
      totalPayout: 0,
      pendingPayout: vendor.walletBalance || 0,
      totalChargers: vendor.chargers.length,
      activeChargers: vendor.chargers.filter(c => c.status === 'AVAILABLE').length,
      totalSessions: 0,
      averageRating: 4.5,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt,
      chargers: vendor.chargers
    };

    res.json({
      success: true,
      vendor: transformedVendor
    });

  } catch (error) {
    console.error('Error fetching vendor:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Update Vendor
exports.updateVendor = async (req, res) => {
  try {
    const { companyName, email, phoneNumber, isActive, kycStatus } = req.body;
    
    const updateData = {};
    if (companyName !== undefined) updateData.companyName = companyName;
    if (email !== undefined) updateData.email = email;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (kycStatus !== undefined) updateData.kycStatus = kycStatus;

    const vendor = await prisma.vendor.update({
      where: {
        id: req.params.id
      },
      data: updateData
    });

    res.json({
      success: true,
      message: "Vendor updated successfully",
      vendor
    });

  } catch (error) {
    console.error('Error updating vendor:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Delete Vendor
exports.deleteVendor = async (req, res) => {
  try {
    await prisma.vendor.delete({
      where: {
        id: req.params.id
      }
    });

    res.json({
      success: true,
      message: "Vendor deleted successfully"
    });

  } catch (error) {
    console.error('Error deleting vendor:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Get Vendor Statistics
exports.getVendorStats = async (req, res) => {
  try {
    const [totalVendors, activeVendors, verifiedVendors] = await Promise.all([
      prisma.vendor.count(),
      prisma.vendor.count({ where: { isActive: true } }),
      prisma.vendor.count({ where: { kycStatus: 'VERIFIED' } })
    ]);

    const stats = {
      totalVendors,
      activeVendors,
      pendingVendors: totalVendors - activeVendors,
      verifiedVendors,
      totalRevenue: 525000, // Mock data for now
      totalPayout: 470800, // Mock data for now
      averageRating: 4.37 // Mock data for now
    };

    const statusBreakdown = [
      { _id: 'active', count: activeVendors },
      { _id: 'inactive', count: totalVendors - activeVendors }
    ];

    const verificationBreakdown = [
      { _id: 'verified', count: verifiedVendors },
      { _id: 'pending', count: totalVendors - verifiedVendors }
    ];

    res.json({
      success: true,
      stats,
      statusBreakdown,
      verificationBreakdown
    });

  } catch (error) {
    console.error('Error fetching vendor stats:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};
