import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  DatePicker,
  message,
  Statistic,
  Row,
  Col,
  Tabs,
  Alert
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { Line, Pie } from 'react-chartjs-2';
import axios from 'axios';
import moment from 'moment';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { TabPane } = Tabs;

const OverviewManager = ({ user }) => {
  const [logs, setLogs] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [ocppMessages, setOcppMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [chartData, setChartData] = useState({});
  const [filters, setFilters] = useState({
    level: 'all',
    category: 'all',
    dateRange: [moment().subtract(7, 'days'), moment()],
    search: ''
  });

  useEffect(() => {
    fetchOverviewData();
    // Auto refresh every 60 seconds
    const interval = setInterval(fetchOverviewData, 60000);
    return () => clearInterval(interval);
  }, [filters]);

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchLogs(),
        fetchTransactions(),
        fetchOcppMessages(),
        fetchStats()
      ]);
    } catch (error) {
      console.error('Error fetching overview data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const params = {
        level: filters.level !== 'all' ? filters.level : undefined,
        category: filters.category !== 'all' ? filters.category : undefined,
        search: filters.search || undefined,
        start_date: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        end_date: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
        limit: 100
      };

      const response = await axios.get('/api/admin/logs', {
        params,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      setLogs(response.data.logs || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const params = {
        start_date: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        end_date: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
        limit: 50
      };

      const response = await axios.get('/api/admin/payments/transactions', {
        params,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      setTransactions(response.data.transactions || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const fetchOcppMessages = async () => {
    try {
      const params = {
        start_date: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        end_date: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
        limit: 50
      };

      const response = await axios.get('/api/admin/ocpp/messages', {
        params,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      setOcppMessages(response.data.messages || []);
    } catch (error) {
      console.error('Error fetching OCPP messages:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/admin/overview/stats', {
        params: {
          start_date: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
          end_date: filters.dateRange?.[1]?.format('YYYY-MM-DD')
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      const data = response.data;
      setStats(data);

      // Prepare chart data
      if (data.daily_stats) {
        const labels = data.daily_stats.map(item => moment(item.date).format('DD/MM'));
        const revenueData = data.daily_stats.map(item => item.revenue);
        const sessionsData = data.daily_stats.map(item => item.sessions);

        setChartData({
          revenue: {
            labels,
            datasets: [{
              label: 'รายได้ (฿)',
              data: revenueData,
              borderColor: 'rgb(75, 192, 192)',
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              tension: 0.1
            }]
          },
          sessions: {
            labels,
            datasets: [{
              label: 'จำนวนการชาร์จ',
              data: sessionsData,
              borderColor: 'rgb(54, 162, 235)',
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              tension: 0.1
            }]
          },
          errorDistribution: {
            labels: ['Info', 'Warning', 'Error', 'Critical'],
            datasets: [{
              data: [
                data.log_stats?.info || 0,
                data.log_stats?.warning || 0,
                data.log_stats?.error || 0,
                data.log_stats?.critical || 0
              ],
              backgroundColor: [
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 206, 86, 0.8)',
                'rgba(255, 99, 132, 0.8)',
                'rgba(153, 102, 255, 0.8)'
              ]
            }]
          }
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const exportData = async (type) => {
    try {
      const params = {
        start_date: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        end_date: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
        type
      };

      const response = await axios.get('/api/admin/export', {
        params,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_${moment().format('YYYY-MM-DD')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success('ส่งออกข้อมูลสำเร็จ');
    } catch (error) {
      console.error('Error exporting data:', error);
      message.error('ไม่สามารถส่งออกข้อมูลได้');
    }
  };

  const getLevelColor = (level) => {
    const colors = {
      'info': 'blue',
      'warning': 'orange',
      'error': 'red',
      'critical': 'purple'
    };
    return colors[level] || 'default';
  };

  const getLevelIcon = (level) => {
    const icons = {
      'info': <InfoCircleOutlined />,
      'warning': <WarningOutlined />,
      'error': <ExclamationCircleOutlined />,
      'critical': <CloseCircleOutlined />
    };
    return icons[level] || <InfoCircleOutlined />;
  };

  const logColumns = [
    {
      title: 'เวลา',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date) => moment(date).format('HH:mm:ss')
    },
    {
      title: 'ระดับ',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level) => (
        <Tag color={getLevelColor(level)} icon={getLevelIcon(level)}>
          {level.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'หมวดหมู่',
      dataIndex: 'category',
      key: 'category',
      width: 100,
    },
    {
      title: 'ข้อความ',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: 'ผู้ใช้',
      dataIndex: ['User', 'username'],
      key: 'user',
      width: 100,
    }
  ];

  const transactionColumns = [
    {
      title: 'เวลา',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date) => moment(date).format('HH:mm:ss')
    },
    {
      title: 'รหัสธุรกรรม',
      dataIndex: 'transaction_id',
      key: 'transaction_id',
      width: 120,
    },
    {
      title: 'ผู้ใช้',
      dataIndex: ['User', 'full_name'],
      key: 'user',
      width: 120,
    },
    {
      title: 'ประเภท',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type) => type === 'topup' ? 'เติมเงิน' : 'ชำระค่าชาร์จ'
    },
    {
      title: 'จำนวนเงิน',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (amount) => `฿${parseFloat(amount).toFixed(2)}`
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const colors = {
          'pending': 'orange',
          'verified': 'green',
          'rejected': 'red'
        };
        const texts = {
          'pending': 'รอตรวจสอบ',
          'verified': 'อนุมัติแล้ว',
          'rejected': 'ปฏิเสธ'
        };
        return (
          <Tag color={colors[status]}>
            {texts[status]}
          </Tag>
        );
      }
    }
  ];

  const ocppColumns = [
    {
      title: 'เวลา',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date) => moment(date).format('HH:mm:ss')
    },
    {
      title: 'สถานี',
      dataIndex: 'station_id',
      key: 'station_id',
      width: 100,
    },
    {
      title: 'ประเภท',
      dataIndex: 'message_type',
      key: 'message_type',
      width: 80,
      render: (type) => (
        <Tag color={type === 'Call' ? 'blue' : type === 'CallResult' ? 'green' : 'red'}>
          {type}
        </Tag>
      )
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 120,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'success' ? 'green' : 'red'}>
          {status === 'success' ? 'สำเร็จ' : 'ผิดพลาด'}
        </Tag>
      )
    }
  ];

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  return (
    <div className="overview-manager">
      {/* Statistics */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="รายได้รวม"
              value={stats.total_revenue || 0}
              precision={2}
              suffix="฿"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="การชาร์จทั้งหมด"
              value={stats.total_sessions || 0}
              suffix="ครั้ง"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="ข้อผิดพลาดวันนี้"
              value={stats.today_errors || 0}
              suffix="รายการ"
              valueStyle={{ color: (stats.today_errors || 0) > 0 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="ผู้ใช้ออนไลน์"
              value={stats.online_users || 0}
              suffix="คน"
            />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={16} className="mb-6">
        <Col span={12}>
          <Card title="รายได้รายวัน" style={{ height: '400px' }}>
            {chartData.revenue && (
              <div style={{ height: '300px' }}>
                <Line data={chartData.revenue} options={chartOptions} />
              </div>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="การแจกแจงข้อผิดพลาด" style={{ height: '400px' }}>
            {chartData.errorDistribution && (
              <div style={{ height: '300px' }}>
                <Pie data={chartData.errorDistribution} options={{ ...chartOptions, maintainAspectRatio: true }} />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card className="mb-4">
        <Row gutter={16}>
          <Col span={6}>
            <Input
              placeholder="ค้นหา..."
              prefix={<SearchOutlined />}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </Col>
          <Col span={4}>
            <Select
              value={filters.level}
              onChange={(value) => setFilters({ ...filters, level: value })}
              style={{ width: '100%' }}
            >
              <Option value="all">ระดับทั้งหมด</Option>
              <Option value="info">Info</Option>
              <Option value="warning">Warning</Option>
              <Option value="error">Error</Option>
              <Option value="critical">Critical</Option>
            </Select>
          </Col>
          <Col span={6}>
            <RangePicker
              value={filters.dateRange}
              onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={4}>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={fetchOverviewData}
              loading={loading}
            >
              รีเฟรช
            </Button>
          </Col>
          <Col span={4}>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => exportData('all')}
            >
              ส่งออกข้อมูล
            </Button>
          </Col>
        </Row>
      </Card>

      {/* System Alerts */}
      {stats.system_alerts && stats.system_alerts.length > 0 && (
        <Card className="mb-4">
          <h4 className="mb-3">การแจ้งเตือนระบบ</h4>
          <Space direction="vertical" style={{ width: '100%' }}>
            {stats.system_alerts.map((alert, index) => (
              <Alert
                key={index}
                message={alert.title}
                description={alert.message}
                type={alert.type}
                showIcon
                closable
              />
            ))}
          </Space>
        </Card>
      )}

      {/* Data Tables */}
      <Tabs defaultActiveKey="logs">
        <TabPane tab="บันทึกระบบ" key="logs">
          <Card>
            <Table
              columns={logColumns}
              dataSource={logs}
              rowKey="id"
              loading={loading}
              size="small"
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `ทั้งหมด ${total} รายการ`
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab="ธุรกรรมล่าสุด" key="transactions">
          <Card>
            <Table
              columns={transactionColumns}
              dataSource={transactions}
              rowKey="id"
              loading={loading}
              size="small"
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `ทั้งหมด ${total} รายการ`
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab="ข้อความ OCPP" key="ocpp">
          <Card>
            <Table
              columns={ocppColumns}
              dataSource={ocppMessages}
              rowKey="id"
              loading={loading}
              size="small"
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `ทั้งหมด ${total} รายการ`
              }}
            />
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default OverviewManager;
