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
  Tooltip,
  Progress
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  EditOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  StopOutlined,
  SettingOutlined
} from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { Option } = Select;

const ChargerManager = ({ user }) => {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({
    status: 'all',
    search: ''
  });
  const [selectedStation, setSelectedStation] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchStations();
    fetchStats();
    // Auto refresh every 30 seconds
    const interval = setInterval(() => {
      fetchStations();
      fetchStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [filters]);

  const fetchStations = async () => {
    setLoading(true);
    try {
      const params = {
        status: filters.status !== 'all' ? filters.status : undefined,
        search: filters.search || undefined,
      };

      const response = await axios.get('/api/admin/stations', {
        params,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      setStations(response.data.stations || []);
    } catch (error) {
      console.error('Error fetching stations:', error);
      message.error('ไม่สามารถโหลดข้อมูลเครื่องชาร์จได้');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/admin/stations/stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching station stats:', error);
    }
  };

  const handleUpdateStation = async (stationId, data) => {
    try {
      await axios.put(`/api/admin/stations/${stationId}`, data, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      message.success('อัพเดทข้อมูลเครื่องชาร์จสำเร็จ');
      setEditModalVisible(false);
      fetchStations();
    } catch (error) {
      console.error('Error updating station:', error);
      message.error('ไม่สามารถอัพเดทข้อมูลเครื่องชาร์จได้');
    }
  };

  const handleRemoteControl = async (stationId, action) => {
    try {
      await axios.post(`/api/admin/stations/${stationId}/control`, {
        action
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      message.success(`ส่งคำสั่ง ${action} สำเร็จ`);
      fetchStations();
    } catch (error) {
      console.error('Error sending remote control:', error);
      message.error('ไม่สามารถส่งคำสั่งได้');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Available': 'green',
      'Occupied': 'blue',
      'Reserved': 'orange',
      'Unavailable': 'red',
      'Faulted': 'red',
      'Offline': 'gray'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status) => {
    const texts = {
      'Available': 'พร้อมใช้งาน',
      'Occupied': 'กำลังชาร์จ',
      'Reserved': 'จองแล้ว',
      'Unavailable': 'ไม่พร้อมใช้งาน',
      'Faulted': 'เกิดข้อผิดพลาด',
      'Offline': 'ออฟไลน์'
    };
    return texts[status] || status;
  };

  const columns = [
    {
      title: 'รหัสสถานี',
      dataIndex: 'station_id',
      key: 'station_id',
      width: 120,
    },
    {
      title: 'ชื่อสถานี',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      )
    },
    {
      title: 'กำลังไฟ',
      dataIndex: 'max_power',
      key: 'max_power',
      width: 100,
      render: (power) => `${power} kW`
    },
    {
      title: 'ราคา',
      dataIndex: 'price_per_kwh',
      key: 'price_per_kwh',
      width: 100,
      render: (price) => `฿${parseFloat(price).toFixed(2)}/kWh`
    },
    {
      title: 'การใช้งานวันนี้',
      key: 'usage',
      width: 150,
      render: (_, record) => {
        const usage = record.daily_usage || 0;
        const maxUsage = 24; // hours
        const percentage = (usage / maxUsage) * 100;
        return (
          <Tooltip title={`ใช้งาน ${usage.toFixed(1)} ชั่วโมง`}>
            <Progress 
              percent={percentage} 
              size="small" 
              status={percentage > 80 ? 'success' : 'normal'}
            />
          </Tooltip>
        );
      }
    },
    {
      title: 'อัพเดทล่าสุด',
      dataIndex: 'last_heartbeat',
      key: 'last_heartbeat',
      width: 120,
      render: (date) => date ? moment(date).format('HH:mm:ss') : 'ไม่ทราบ'
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
              setSelectedStation(record);
              setModalVisible(true);
            }}
          >
            ดู
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedStation(record);
              form.setFieldsValue(record);
              setEditModalVisible(true);
            }}
          >
            แก้ไข
          </Button>
          <Button
            type="link"
            icon={<SettingOutlined />}
            onClick={() => {
              setSelectedStation(record);
              setTestModalVisible(true);
            }}
          >
            ควบคุม
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="charger-manager">
      {/* Statistics */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="เครื่องชาร์จทั้งหมด"
              value={stats.total_stations || 0}
              suffix="เครื่อง"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="พร้อมใช้งาน"
              value={stats.available_stations || 0}
              suffix="เครื่อง"
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="กำลังชาร์จ"
              value={stats.occupied_stations || 0}
              suffix="เครื่อง"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="ออฟไลน์"
              value={stats.offline_stations || 0}
              suffix="เครื่อง"
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card className="mb-4">
        <Row gutter={16}>
          <Col span={8}>
            <Input
              placeholder="ค้นหาชื่อสถานี หรือ รหัสสถานี..."
              prefix={<SearchOutlined />}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </Col>
          <Col span={6}>
            <Select
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              style={{ width: '100%' }}
            >
              <Option value="all">สถานะทั้งหมด</Option>
              <Option value="Available">พร้อมใช้งาน</Option>
              <Option value="Occupied">กำลังชาร์จ</Option>
              <Option value="Reserved">จองแล้ว</Option>
              <Option value="Unavailable">ไม่พร้อมใช้งาน</Option>
              <Option value="Faulted">เกิดข้อผิดพลาด</Option>
              <Option value="Offline">ออฟไลน์</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={fetchStations}
              loading={loading}
            >
              รีเฟรช
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Stations Table */}
      <Card title="รายการเครื่องชาร์จ">
        <Table
          columns={columns}
          dataSource={stations}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `ทั้งหมด ${total} เครื่อง`
          }}
        />
      </Card>

      {/* Station Detail Modal */}
      <Modal
        title="รายละเอียดเครื่องชาร์จ"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedStation && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <p><strong>รหัสสถานี:</strong> {selectedStation.station_id}</p>
                <p><strong>ชื่อสถานี:</strong> {selectedStation.name}</p>
                <p><strong>ที่อยู่:</strong> {selectedStation.address}</p>
                <p><strong>กำลังไฟสูงสุด:</strong> {selectedStation.max_power} kW</p>
                <p><strong>ราคา:</strong> ฿{parseFloat(selectedStation.price_per_kwh).toFixed(2)}/kWh</p>
              </Col>
              <Col span={12}>
                <p><strong>สถานะ:</strong> 
                  <Tag color={getStatusColor(selectedStation.status)} className="ml-2">
                    {getStatusText(selectedStation.status)}
                  </Tag>
                </p>
                <p><strong>เปิดใช้งาน:</strong> {selectedStation.is_active ? 'เปิด' : 'ปิด'}</p>
                <p><strong>Heartbeat ล่าสุด:</strong> {selectedStation.last_heartbeat ? moment(selectedStation.last_heartbeat).format('DD/MM/YYYY HH:mm:ss') : 'ไม่ทราบ'}</p>
                <p><strong>สร้างเมื่อ:</strong> {moment(selectedStation.created_at).format('DD/MM/YYYY HH:mm')}</p>
              </Col>
            </Row>
            
            {selectedStation.error_code && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                <p><strong>รหัสข้อผิดพลาด:</strong> {selectedStation.error_code}</p>
                {selectedStation.error_info && (
                  <p><strong>รายละเอียด:</strong> {selectedStation.error_info}</p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Edit Station Modal */}
      <Modal
        title="แก้ไขข้อมูลเครื่องชาร์จ"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            handleUpdateStation(selectedStation.id, values);
          }}
        >
          <Form.Item
            name="name"
            label="ชื่อสถานี"
            rules={[{ required: true, message: 'กรุณาใส่ชื่อสถานี' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="address"
            label="ที่อยู่"
            rules={[{ required: true, message: 'กรุณาใส่ที่อยู่' }]}
          >
            <Input.TextArea rows={2} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="max_power"
                label="กำลังไฟสูงสุด (kW)"
                rules={[{ required: true, message: 'กรุณาใส่กำลังไฟ' }]}
              >
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="price_per_kwh"
                label="ราคาต่อหน่วย (฿/kWh)"
                rules={[{ required: true, message: 'กรุณาใส่ราคา' }]}
              >
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="is_active"
            label="เปิดใช้งาน"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

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

      {/* Remote Control Modal */}
      <Modal
        title="ควบคุมเครื่องชาร์จ"
        open={testModalVisible}
        onCancel={() => setTestModalVisible(false)}
        footer={null}
        width={500}
      >
        {selectedStation && (
          <div>
            <div className="mb-4">
              <p><strong>สถานี:</strong> {selectedStation.name}</p>
              <p><strong>สถานะปัจจุบัน:</strong> 
                <Tag color={getStatusColor(selectedStation.status)} className="ml-2">
                  {getStatusText(selectedStation.status)}
                </Tag>
              </p>
            </div>

            <div className="space-y-2">
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => handleRemoteControl(selectedStation.id, 'unlock')}
                block
              >
                ปลดล็อคเครื่องชาร์จ
              </Button>
              
              <Button
                icon={<StopOutlined />}
                onClick={() => handleRemoteControl(selectedStation.id, 'reset')}
                block
              >
                รีเซ็ตเครื่องชาร์จ
              </Button>
              
              <Button
                danger
                onClick={() => handleRemoteControl(selectedStation.id, 'stop')}
                block
              >
                หยุดการชาร์จ (ฉุกเฉิน)
              </Button>
            </div>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                <strong>คำเตือน:</strong> การควบคุมระยะไกลจะส่งผลต่อผู้ใช้งานที่กำลังชาร์จ กรุณาใช้ด้วยความระมัดระวัง
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ChargerManager;
