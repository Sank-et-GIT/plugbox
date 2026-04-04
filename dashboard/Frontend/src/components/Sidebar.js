import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Home, 
  Zap, 
  Users, 
  Settings, 
  Menu, 
  X,
  DollarSign,
  Calendar,
  User,
  FileText,
  CreditCard,
  TrendingUp,
  Bell
} from 'lucide-react';

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  const isVendor = user?.role === 'vendor';
  const isAdmin = ['admin', 'super_admin'].includes(user?.role);

  const vendorMenuItems = [
    { path: '/vendor/chargers', icon: Zap, label: 'My Chargers' },
    { path: '/vendor/earnings', icon: DollarSign, label: 'Earnings' },
    { path: '/vendor/profile', icon: User, label: 'Profile' },
  ];

  const adminMenuItems = [
    { path: '/admin/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/chargers', icon: Zap, label: 'Chargers' },
    { path: '/vendors', icon: Users, label: 'Vendors' },
    { path: '/users', icon: User, label: 'Users' },
    { path: '/sessions', icon: Calendar, label: 'Sessions' },
    { path: '/payments', icon: CreditCard, label: 'Payments' },
    { path: '/payouts', icon: TrendingUp, label: 'Payouts' },
    { path: '/reports', icon: FileText, label: 'Reports' },
    { path: '/notifications', icon: Bell, label: 'Notifications' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const menuItems = isVendor ? vendorMenuItems : adminMenuItems;

  return (
    <div className={`${collapsed ? 'w-16' : 'w-64'} bg-white shadow-lg transition-all duration-300 ease-in-out`}>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className={`flex items-center ${collapsed ? 'justify-center' : ''}`}>
            <Zap className="h-8 w-8 text-primary-600" />
            {!collapsed && <span className="ml-2 text-xl font-bold text-gray-900">PlugBox</span>}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-lg hover:bg-gray-100"
          >
            {collapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <nav className="mt-8">
        <div className="px-4">
          {!collapsed && (
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              {isVendor ? 'Vendor Portal' : 'Admin Portal'}
            </p>
          )}
        </div>
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-600 border-r-2 border-primary-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <div className={`flex items-center ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-primary-600" />
          </div>
          {!collapsed && (
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name || user?.companyName || user?.email}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user?.role}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
