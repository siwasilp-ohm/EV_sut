import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Modal,
  Form,
  InputNumber,
  message,
  Statistic,
  Row,
  Col,
  Switch,
  DatePicker,
  Avatar
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  EditOutlined,
  PlusOutlined,
  UserOutlined,
  WalletOutlined
} from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { Option } = Select;
const { RangePicker } = DatePicker;

const UserManager = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({
    role: 'all',
    status: 'all',
    search: ''
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [walletForm] = Form.useForm();

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [filters]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {
        role: filters.role !== 'all' ? filters.role : undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        search: filters.search || undefined,
      };

      const response = await axios.get('/api/admin/users', {
        params,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      message.error('ไม่สามารถโหลดข้อมูลผู้ใช้ได้');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/admin/users/stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const handleUpdateUser = async (userId, data) => {
    try {
      await axios.put(`/api/admin/users/${userId}`, data, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      message.success('อัพเดทข้อมูลผู้ใช้สำเร็จ');
      setEditModalVisible(false);
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error('Error updating user:', error);
      message.error('ไม่สามารถอัพเดทข้อมูลผู้ใช้ได้');
    }
  };

  const handleWalletAdjustment = async (userId, data) => {
    try {
      await axios.post(`/api/admin/users/${userId}/wallet/adjust`, data, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      message.success('ปรับยอดเงินในกระเป๋าสำเร็จ');
      setWalletModalVisible(false);
      walletForm.resetFields();
      fetchUsers();
    } catch (error) {
      console.error('Error adjusting wallet:', error);
      message.error('ไม่สามารถปรับยอดเงินได้');
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      'admin': 'red',
      'service': 'orange',
      'user': 'blue'
    };
    return colors[role] || 'default';
  };

  const getRoleText = (role) => {
    const texts = {
      'admin': 'ผู้ดูแลระบบ',
      'service': 'เจ้าหน้าที่',
      'user': 'ผู้ใช้ทั่วไป'
    };
    return texts[role] || role;
  };

  const columns = [
    {
      title: 'ผู้ใช้',
      key: 'user_info',
      width: 200,
      render: (_, record) => (
        <div className="flex items-center">
          <Avatar 
            src={record.profile_image_url} 
            icon={<UserOutlined />}
            className="mr-2"
          />
          <div>
            <div className="font-medium">{record.full_name}</div>
            <div className="text-gray-500 text-sm">@{record.username}</div>
          </div>
        </div>
      )
    },
    {
      title: 'อีเมล',
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: 'เบอร์โทร',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
    },
    {
      title: 'บทบาท',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role) => (
        <Tag color={getRoleColor(role)}>
          {getRoleText(role)}
        </Tag>
      )
    },
    {
      title: 'ยอดเงินในกระเป๋า',
      dataIndex: 'wallet_balance',
      key: 'wallet_balance',
      width: 120,
      render: (balance) => `฿${parseFloat(balance || 0).toFixed(2)}`
    },
    {
      title: 'สถานะ',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
        </Tag>
      )
    },
    {
      title: 'วันที่สมัคร',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date) => moment(date).format('DD/MM/YYYY')
    },
    {
      title: 'เข้าสู่ระบบล่าสุด',
      dataIndex: 'last_login',
      key: 'last_login',
      width: 120,
      render: (date) => date ? moment(date).format('DD/MM/YYYY') : 'ไม่เคย'
    },
    {
      title: 'การดำเนินการ',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedUser(record);
              setModalVisible(true);
            }}
          >
            ดู
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedUser(record);
              form.setFieldsValue(record);
              setEditModalVisible(true);
            }}
          >
            แก้ไข
          </Button>
          <Button
            type="link"
            icon={<WalletOutlined />}
            onClick={() => {
              setSelectedUser(record);
              setWalletModalVisible(true);
            }}
          >
            กระเป๋าเงิน
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="user-manager">
      {/* Statistics */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="ผู้ใช้ทั้งหมด"
              value={stats.total_users || 0}
              suffix="คน"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="ผู้ใช้ใหม่เดือนนี้"
              value={stats.new_users_this_month || 0}
              suffix="คน"
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="ผู้ใช้ที่เปิดใช้งาน"
              value={stats.active_users || 0}
              suffix="คน"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="ยอดเงินรวมในระบบ"
              value={stats.total_wallet_balance || 0}
              precision={2}
              suffix="฿"
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card className="mb-4">
        <Row gutter={16}>
          <Col span={8}>
            <Input
              placeholder="ค้นหาชื่อ, อีเมล, หรือเบอร์โทร..."
              prefix={<SearchOutlined />}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </Col>
          <Col span={4}>
            <Select
              value={filters.role}
              onChange={(value) => setFilters({ ...filters, role: value })}
              style={{ width: '100%' }}
            >
              <Option value="all">บทบาททั้งหมด</Option>
              <Option value="admin">ผู้ดูแลระบบ</Option>
              <Option value="service">เจ้าหน้าที่</Option>
              <Option value="user">ผู้ใช้ทั่วไป</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              style={{ width: '100%' }}
            >
              <Option value="all">สถานะทั้งหมด</Option>
              <Option value="active">เปิดใช้งาน</Option>
              <Option value="inactive">ปิดใช้งาน</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={fetchUsers}
              loading={loading}
            >
              รีเฟรช
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Users Table */}
      <Card title="รายการผู้ใช้">
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `ทั้งหมด ${total} คน`
          }}
        />
      </Card>

      {/* User Detail Modal */}
      <Modal
        title="รายละเอียดผู้ใช้"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedUser && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <div className="flex items-center mb-4">
                  <Avatar 
                    src={selectedUser.profile_image_url} 
                    icon={<UserOutlined />}
                    size={64}
                    className="mr-4"
                  />
                  <div>
                    <h3 className="mb-1">{selectedUser.full_name}</h3>
                    <Tag color={getRoleColor(selectedUser.role)}>
                      {getRoleText(selectedUser.role)}
                    </Tag>
                  </div>
                </div>
                
                <p><strong>ชื่อผู้ใช้:</strong> {selectedUser.username}</p>
                <p><strong>อีเมล:</strong> {selectedUser.email}</p>
                <p><strong>เบอร์โทร:</strong> {selectedUser.phone}</p>
                <p><strong>ยอดเงินในกระเป๋า:</strong> ฿{parseFloat(selectedUser.wallet_balance || 0).toFixed(2)}</p>
              </Col>
              <Col span={12}>
                <p><strong>สถานะ:</strong> 
                  <Tag color={selectedUser.is_active ? 'green' : 'red'} className="ml-2">
                    {selectedUser.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </Tag>
                </p>
                <p><strong>วันที่สมัคร:</strong> {moment(selectedUser.created_at).format('DD/MM/YYYY HH:mm')}</p>
                <p><strong>เข้าสู่ระบบล่าสุด:</strong> {selectedUser.last_login ? moment(selectedUser.last_login).format('DD/MM/YYYY HH:mm') : 'ไม่เคย'}</p>
                <p><strong>จำนวนรถที่ลงทะเบียน:</strong> {selectedUser.vehicle_count || 0} คัน</p>
                <p><strong>จำนวนครั้งที่ชาร์จ:</strong> {selectedUser.charging_sessions_count || 0} ครั้ง</p>
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      {/* Edit User Modal */}
      <Modal
        title="แก้ไขข้อมูลผู้ใช้"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            handleUpdateUser(selectedUser.id, values);
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="full_name"
                label="ชื่อ-นามสกุล"
                rules={[{ required: true, message: 'กรุณาใส่ชื่อ-นามสกุล' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="username"
                label="ชื่อผู้ใช้"
                rules={[{ required: true, message: 'กรุณาใส่ชื่อผู้ใช้' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="email"
                label="อีเมล"
                rules={[
                  { required: true, message: 'กรุณาใส่อีเมล' },
                  { type: 'email', message: 'รูปแบบอีเมลไม่ถูกต้อง' }
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="เบอร์โทร"
                rules={[{ required: true, message: 'กรุณาใส่เบอร์โทร' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="role"
                label="บทบาท"
                rules={[{ required: true, message: 'กรุณาเลือกบทบาท' }]}
              >
                <Select>
                  <Option value="admin">ผู้ดูแลระบบ</Option>
                  <Option value="service">เจ้าหน้าที่</Option>
                  <Option value="user">ผู้ใช้ทั่วไป</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="is_active"
                label="สถานะ"
                valuePropName="checked"
              >
                <Switch checkedChildren="เปิดใช้งาน" unCheckedChildren="ปิดใช้งาน" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                บันทึก
              </Button>
              <Button onClick={() => setEditModalVisible(false)}>
                ยกเลิก
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Wallet Adjustment Modal */}
      <Modal
        title="ปรับยอดเงินในกระเป๋า"
        open={walletModalVisible}
        onCancel={() => setWalletModalVisible(false)}
        footer={null}
        width={500}
      >
        {selectedUser && (
          <div>
            <div className="mb-4">
              <p><strong>ผู้ใช้:</strong> {selectedUser.full_name}</p>
              <p><strong>ยอดเงินปัจจุบัน:</strong> ฿{parseFloat(selectedUser.wallet_balance || 0).toFixed(2)}</p>
            </div>

            <Form
              form={walletForm}
              layout="vertical"
              onFinish={(values) => {
                handleWalletAdjustment(selectedUser.id, values);
              }}
            >
              <Form.Item
                name="type"
                label="ประเภทการปรับยอด"
                rules={[{ required: true, message: 'กรุณาเลือกประเภท' }]}
              >
                <Select placeholder="เลือกประเภท">
                  <Option value="add">เพิ่มเงิน</Option>
                  <Option value="subtract">หักเงิน</Option>
                  <Option value="set">กำหนดยอดใหม่</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="amount"
                label="จำนวนเงิน (฿)"
                rules={[{ required: true, message: 'กรุณาใส่จำนวนเงิน' }]}
              >
                <InputNumber
                  min={0}
                  step={0.01}
                  style={{ width: '100%' }}
                  placeholder="0.00"
                />
              </Form.Item>

              <Form.Item
                name="note"
                label="หมายเหตุ"
                rules={[{ required: true, message: 'กรุณาใส่หมายเหตุ' }]}
              >
                <Input.TextArea rows={3} placeholder="เหตุผลในการปรับยอด..." />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">
                    ยืนยัน
                  </Button>
                  <Button onClick={() => setWalletModalVisible(false)}>
                    ยกเลิก
                  </Button>
                </Space>
              </Form.Item>
            </Form>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                <strong>คำเตือน:</strong> การปรับยอดเงินจะบันทึกเป็นประวัติและไม่สามารถยกเลิกได้
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UserManager;
