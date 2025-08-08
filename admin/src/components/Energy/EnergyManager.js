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
  Progress
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  SolarOutlined
} from '@ant-design/icons';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import axios from 'axios';
import moment from 'moment';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const { RangePicker } = DatePicker;
const { Option } = Select;

const EnergyManager = ({ user }) => {
  const [inverters, setInverters] = useState([]);
  const [energyData, setEnergyData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [chartData, setChartData] = useState({});
  const [selectedInverter, setSelectedInverter] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [controlModalVisible, setControlModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    dateRange: [moment().subtract(7, 'days'), moment()],
    search: ''
  });
  const [form] = Form.useForm();

  useEffect(() => {
    fetchInverters();
    fetchEnergyStats();
    fetchEnergyData();
    // Auto refresh every 30 seconds
    const interval = setInterval(() => {
      fetchInverters();
      fetchEnergyStats();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchEnergyData();
  }, [filters.dateRange]);

  const fetchInverters = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/energy/inverters', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setInverters(response.data.inverters || []);
    } catch (error) {
      console.error('Error fetching inverters:', error);
      message.error('ไม่สามารถโหลดข้อมูลอินเวอร์เตอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  const fetchEnergyStats = async () => {
    try {
      const response = await axios.get('/api/energy/stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching energy stats:', error);
    }
  };

  const fetchEnergyData = async () => {
    try {
      const params = {
        start_date: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        end_date: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
      };

      const response = await axios.get('/api/energy/production', {
        params,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      const data = response.data.data || [];
      setEnergyData(data);

      // Prepare chart data
      const labels = data.map(item => moment(item.date).format('DD/MM'));
      const productionData = data.map(item => item.total_production);
      const consumptionData = data.map(item => item.total_consumption);

      setChartData({
        labels,
        datasets: [
          {
            label: 'ผลิตไฟฟ้า (kWh)',
            data: productionData,
            borderColor: 'rgb(255, 193, 7)',
            backgroundColor: 'rgba(255, 193, 7, 0.2)',
            tension: 0.1
          },
          {
            label: 'ใช้ไฟฟ้า (kWh)',
            data: consumptionData,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            tension: 0.1
          }
        ]
      });
    } catch (error) {
      console.error('Error fetching energy data:', error);
    }
  };

  const handleInverterControl = async (inverterId, action, value = null) => {
    try {
      await axios.post(`/api/energy/inverters/${inverterId}/control`, {
        action,
        value
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      message.success(`ส่งคำสั่ง ${action} สำเร็จ`);
      setControlModalVisible(false);
      fetchInverters();
    } catch (error) {
      console.error('Error controlling inverter:', error);
      message.error('ไม่สามารถส่งคำสั่งได้');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'online': 'green',
      'offline': 'red',
      'fault': 'red',
      'maintenance': 'orange'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status) => {
    const texts = {
      'online': 'ออนไลน์',
      'offline': 'ออฟไลน์',
      'fault': 'เกิดข้อผิดพลาด',
      'maintenance': 'ซ่อมบำรุง'
    };
    return texts[status] || status;
  };

  const columns = [
    {
      title: 'รหัสอินเวอร์เตอร์',
      dataIndex: 'inverter_id',
      key: 'inverter_id',
      width: 150,
    },
    {
      title: 'ชื่อ',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      )
    },
    {
      title: 'กำลังไฟปัจจุบัน',
      dataIndex: 'current_power',
      key: 'current_power',
      width: 120,
      render: (power) => `${(power || 0).toFixed(2)} kW`
    },
    {
      title: 'กำลังไฟสูงสุด',
      dataIndex: 'rated_power',
      key: 'rated_power',
      width: 120,
      render: (power) => `${power} kW`
    },
    {
      title: 'ประสิทธิภาพ',
      key: 'efficiency',
      width: 120,
      render: (_, record) => {
        const efficiency = record.current_power && record.rated_power 
          ? (record.current_power / record.rated_power) * 100 
          : 0;
        return (
          <Progress 
            percent={efficiency} 
            size="small" 
            status={efficiency > 80 ? 'success' : efficiency > 50 ? 'normal' : 'exception'}
          />
        );
      }
    },
    {
      title: 'ผลิตวันนี้',
      dataIndex: 'daily_production',
      key: 'daily_production',
      width: 120,
      render: (production) => `${(production || 0).toFixed(2)} kWh`
    },
    {
      title: 'อัพเดทล่าสุด',
      dataIndex: 'last_update',
      key: 'last_update',
      width: 120,
      render: (date) => date ? moment(date).format('HH:mm:ss') : 'ไม่ทราบ'
    },
    {
      title: 'การดำเนินการ',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedInverter(record);
              setModalVisible(true);
            }}
          >
            ดู
          </Button>
          <Button
            type="link"
            icon={<SettingOutlined />}
            onClick={() => {
              setSelectedInverter(record);
              setControlModalVisible(true);
            }}
          >
            ควบคุม
          </Button>
        </Space>
      )
    }
  ];

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'การผลิตและใช้พลังงาน',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'kWh'
        }
      }
    }
  };

  return (
    <div className="energy-manager">
      {/* Statistics */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="ผลิตไฟฟ้าวันนี้"
              value={stats.today_production || 0}
              precision={2}
              suffix="kWh"
              prefix={<SolarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="ใช้ไฟฟ้าวันนี้"
              value={stats.today_consumption || 0}
              precision={2}
              suffix="kWh"
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="อินเวอร์เตอร์ออนไลน์"
              value={stats.online_inverters || 0}
              suffix={`/ ${stats.total_inverters || 0}`}
              valueStyle={{ color: stats.online_inverters === stats.total_inverters ? '#3f8600' : '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="ประสิทธิภาพเฉลี่ย"
              value={stats.average_efficiency || 0}
              precision={1}
              suffix="%"
              valueStyle={{ color: (stats.average_efficiency || 0) > 80 ? '#3f8600' : '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Energy Chart */}
      <Card title="กราฟการผลิตและใช้พลังงาน" className="mb-4">
        <div className="mb-4">
          <RangePicker
            value={filters.dateRange}
            onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
            format="DD/MM/YYYY"
          />
        </div>
        <div style={{ height: '400px' }}>
          {chartData.labels && (
            <Line data={chartData} options={chartOptions} />
          )}
        </div>
      </Card>

      {/* Filters */}
      <Card className="mb-4">
        <Row gutter={16}>
          <Col span={8}>
            <Input
              placeholder="ค้นหาชื่ออินเวอร์เตอร์..."
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
              <Option value="online">ออนไลน์</Option>
              <Option value="offline">ออฟไลน์</Option>
              <Option value="fault">เกิดข้อผิดพลาด</Option>
              <Option value="maintenance">ซ่อมบำรุง</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={fetchInverters}
              loading={loading}
            >
              รีเฟรช
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Inverters Table */}
      <Card title="รายการอินเวอร์เตอร์">
        <Table
          columns={columns}
          dataSource={inverters.filter(inv => 
            filters.status === 'all' || inv.status === filters.status
          ).filter(inv =>
            !filters.search || inv.name.toLowerCase().includes(filters.search.toLowerCase()) ||
            inv.inverter_id.toLowerCase().includes(filters.search.toLowerCase())
          )}
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

      {/* Inverter Detail Modal */}
      <Modal
        title="รายละเอียดอินเวอร์เตอร์"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedInverter && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <p><strong>รหัสอินเวอร์เตอร์:</strong> {selectedInverter.inverter_id}</p>
                <p><strong>ชื่อ:</strong> {selectedInverter.name}</p>
                <p><strong>รุ่น:</strong> {selectedInverter.model}</p>
                <p><strong>กำลังไฟสูงสุด:</strong> {selectedInverter.rated_power} kW</p>
                <p><strong>IP Address:</strong> {selectedInverter.ip_address}</p>
              </Col>
              <Col span={12}>
                <p><strong>สถานะ:</strong> 
                  <Tag color={getStatusColor(selectedInverter.status)} className="ml-2">
                    {getStatusText(selectedInverter.status)}
                  </Tag>
                </p>
                <p><strong>กำลังไฟปัจจุบัน:</strong> {(selectedInverter.current_power || 0).toFixed(2)} kW</p>
                <p><strong>แรงดันไฟฟ้า:</strong> {(selectedInverter.voltage || 0).toFixed(1)} V</p>
                <p><strong>กระแสไฟฟ้า:</strong> {(selectedInverter.current || 0).toFixed(2)} A</p>
                <p><strong>อัพเดทล่าสุด:</strong> {selectedInverter.last_update ? moment(selectedInverter.last_update).format('DD/MM/YYYY HH:mm:ss') : 'ไม่ทราบ'}</p>
              </Col>
            </Row>
            
            <div className="mt-4">
              <h4>สถิติการผลิต</h4>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="วันนี้"
                    value={selectedInverter.daily_production || 0}
                    precision={2}
                    suffix="kWh"
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="เดือนนี้"
                    value={selectedInverter.monthly_production || 0}
                    precision={2}
                    suffix="kWh"
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="ทั้งหมด"
                    value={selectedInverter.total_production || 0}
                    precision={2}
                    suffix="kWh"
                  />
                </Col>
              </Row>
            </div>
          </div>
        )}
      </Modal>

      {/* Inverter Control Modal */}
      <Modal
        title="ควบคุมอินเวอร์เตอร์"
        open={controlModalVisible}
        onCancel={() => setControlModalVisible(false)}
        footer={null}
        width={500}
      >
        {selectedInverter && (
          <div>
            <div className="mb-4">
              <p><strong>อินเวอร์เตอร์:</strong> {selectedInverter.name}</p>
              <p><strong>สถานะปัจจุบัน:</strong> 
                <Tag color={getStatusColor(selectedInverter.status)} className="ml-2">
                  {getStatusText(selectedInverter.status)}
                </Tag>
              </p>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={(values) => {
                handleInverterControl(selectedInverter.id, values.action, values.value);
              }}
            >
              <Form.Item
                name="action"
                label="คำสั่ง"
                rules={[{ required: true, message: 'กรุณาเลือกคำสั่ง' }]}
              >
                <Select placeholder="เลือกคำสั่ง">
                  <Option value="start">เริ่มการทำงาน</Option>
                  <Option value="stop">หยุดการทำงาน</Option>
                  <Option value="reset">รีเซ็ต</Option>
                  <Option value="set_power_limit">กำหนดขีดจำกัดพลังงาน</Option>
                </Select>
              </Form.Item>

              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => 
                  prevValues.action !== currentValues.action
                }
              >
                {({ getFieldValue }) =>
                  getFieldValue('action') === 'set_power_limit' ? (
                    <Form.Item
                      name="value"
                      label="ขีดจำกัดพลังงาน (%)"
                      rules={[{ required: true, message: 'กรุณาใส่ค่าขีดจำกัด' }]}
                    >
                      <InputNumber
                        min={0}
                        max={100}
                        style={{ width: '100%' }}
                        addonAfter="%"
                      />
                    </Form.Item>
                  ) : null
                }
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">
                    ส่งคำสั่ง
                  </Button>
                  <Button onClick={() => setControlModalVisible(false)}>
                    ยกเลิก
                  </Button>
                </Space>
              </Form.Item>
            </Form>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                <strong>คำเตือน:</strong> การควบคุมอินเวอร์เตอร์จะส่งผลต่อการผลิตไฟฟ้า กรุณาใช้ด้วยความระมัดระวัง
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EnergyManager;
