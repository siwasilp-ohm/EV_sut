import React from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  CreditCardOutlined,
  ThunderboltOutlined,
  SolarOutlined,
  UserOutlined,
  FileTextOutlined,
  LogoutOutlined
} from '@ant-design/icons';

const { Sider } = Layout;

const Sidebar = ({ collapsed, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'แดชบอร์ด',
    },
    {
      key: '/payment',
      icon: <CreditCardOutlined />,
      label: 'จัดการการชำระเงิน',
    },
    {
      key: '/charger',
      icon: <ThunderboltOutlined />,
      label: 'จัดการเครื่องชาร์จ',
    },
    {
      key: '/energy',
      icon: <SolarOutlined />,
      label: 'จัดการพลังงาน',
    },
    {
      key: '/user',
      icon: <UserOutlined />,
      label: 'จัดการผู้ใช้',
    },
    {
      key: '/overview',
      icon: <FileTextOutlined />,
      label: 'ภาพรวม/รายงาน',
    },
  ];

  const handleMenuClick = ({ key }) => {
    if (key === 'logout') {
      onLogout();
    } else {
      navigate(key);
    }
  };

  return (
    <Sider 
      trigger={null} 
      collapsible 
      collapsed={collapsed}
      style={{
        background: '#001529',
      }}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 bg-blue-600">
          {!collapsed ? (
            <div className="text-white font-bold text-lg">
              EV Solar Admin
            </div>
          ) : (
            <div className="text-white font-bold text-xl">
              ES
            </div>
          )}
        </div>

        {/* Menu */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ flex: 1 }}
        />

        {/* User Info & Logout */}
        <div className="border-t border-gray-600">
          {!collapsed && (
            <div className="p-4 text-white text-sm">
              <div className="mb-2">
                <div className="font-medium">{user.full_name}</div>
                <div className="text-gray-400">{user.role}</div>
              </div>
            </div>
          )}
          
          <Menu
            theme="dark"
            mode="inline"
            items={[
              {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: 'ออกจากระบบ',
                className: 'text-red-400 hover:text-red-300'
              }
            ]}
            onClick={handleMenuClick}
          />
        </div>
      </div>
    </Sider>
  );
};

export default Sidebar;
