import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  Space,
  Tag,
  Modal,
  Form,
  InputNumber,
  message,
  Statistic,
  Row,
  Col,
  Upload,
  Image
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  UploadOutlined
} from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { RangePicker } = DatePicker;
const { Option } = Select;

const PaymentManager = ({ user }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    dateRange: null,
    search: ''
  });
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchTransactions();
    fetchStats();
  }, [filters]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = {
        status: filters.status !== 'all' ? filters.status : undefined,
        type: filters.type !== 'all' ? filters.type : undefined,
        search: filters.search || undefined,
        start_date: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        end_date: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
      };

      const response = await axios.get('/api/admin/payments/transactions', {
        params,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      setTransactions(response.data.transactions || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      message.error('ไม่สามารถโหลดข้อมูลการชำระเงินได้');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/admin/payments/stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching payment stats:', error);
    }
  };

  const handleVerifyPayment = async (transactionId, status, note = '') => {
    try {
      await axios.post(`/api/admin/payments/${transactionId}/verify`, {
        status,
        admin_note: note
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      message.success(`${status === 'verified' ? 'อนุมัติ' : 'ปฏิเสธ'}การชำระเงินสำเร็จ`);
      setVerifyModalVisible(false);
      fetchTransactions();
      fetchStats();
    } catch (error) {
      console.error('Error verifying payment:', error);
      message.error('ไม่สามารถอัพเดทสถานะการชำระเงินได้');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'orange',
      'verified': 'green',
      'rejected': 'red',
      'expired': 'gray'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status) => {
    const texts = {
      'pending': 'รอตรวจสอบ',
      'verified': 'อนุมัติแล้ว',
      'rejected': 'ปฏิเสธ',
      'expired': 'หมดอายุ'
    };
    return texts[status] || status;
  };

  const columns = [
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
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      )
    },
    {
      title: 'วันที่',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date) => moment(date).format('DD/MM/YYYY HH:mm')
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
              setSelectedTransaction(record);
              setModalVisible(true);
            }}
          >
            ดู
          </Button>
          {record.status === 'pending' && (
            <Button
              type="link"
              icon={<CheckOutlined />}
              onClick={() => {
                setSelectedTransaction(record);
                setVerifyModalVisible(true);
              }}
            >
              ตรวจสอบ
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="payment-manager">
      {/* Statistics */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="รายได้วันนี้"
              value={stats.today_revenue || 0}
              precision={2}
              suffix="฿"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="รายได้เดือนนี้"
              value={stats.month_revenue || 0}
              precision={2}
              suffix="฿"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="รอตรวจสอบ"
              value={stats.pending_count || 0}
              suffix="รายการ"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="ธุรกรรมทั้งหมด"
              value={stats.total_transactions || 0}
              suffix="รายการ"
            />
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
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              style={{ width: '100%' }}
            >
              <Option value="all">สถานะทั้งหมด</Option>
              <Option value="pending">รอตรวจสอบ</Option>
              <Option value="verified">อนุมัติแล้ว</Option>
              <Option value="rejected">ปฏิเสธ</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              value={filters.type}
              onChange={(value) => setFilters({ ...filters, type: value })}
              style={{ width: '100%' }}
            >
              <Option value="all">ประเภททั้งหมด</Option>
              <Option value="topup">เติมเงิน</Option>
              <Option value="charging">ชำระค่าชาร์จ</Option>
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
              onClick={fetchTransactions}
              loading={loading}
            >
              รีเฟรช
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Transactions Table */}
      <Card title="รายการธุรกรรม">
        <Table
          columns={columns}
          dataSource={transactions}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `ทั้งหมด ${total} รายการ`
          }}
        />
      </Card>

      {/* Transaction Detail Modal */}
      <Modal
        title="รายละเอียดธุรกรรม"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedTransaction && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <p><strong>รหัสธุรกรรม:</strong> {selectedTransaction.transaction_id}</p>
                <p><strong>ผู้ใช้:</strong> {selectedTransaction.User?.full_name}</p>
                <p><strong>ประเภท:</strong> {selectedTransaction.type === 'topup' ? 'เติมเงิน' : 'ชำระค่าชาร์จ'}</p>
                <p><strong>จำนวนเงิน:</strong> ฿{parseFloat(selectedTransaction.amount).toFixed(2)}</p>
              </Col>
              <Col span={12}>
                <p><strong>สถานะ:</strong> 
                  <Tag color={getStatusColor(selectedTransaction.status)} className="ml-2">
                    {getStatusText(selectedTransaction.status)}
                  </Tag>
                </p>
                <p><strong>วันที่:</strong> {moment(selectedTransaction.created_at).format('DD/MM/YYYY HH:mm')}</p>
                {selectedTransaction.admin_note && (
                  <p><strong>หมายเหตุ:</strong> {selectedTransaction.admin_note}</p>
                )}
              </Col>
            </Row>
            
            {selectedTransaction.payment_slip_url && (
              <div className="mt-4">
                <p><strong>สลิปการโอนเงิน:</strong></p>
                <Image
                  src={selectedTransaction.payment_slip_url}
                  alt="Payment Slip"
                  style={{ maxWidth: '100%', maxHeight: '400px' }}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Verify Payment Modal */}
      <Modal
        title="ตรวจสอบการชำระเงิน"
        open={verifyModalVisible}
        onCancel={() => setVerifyModalVisible(false)}
        footer={null}
      >
        {selectedTransaction && (
          <Form
            form={form}
            layout="vertical"
            onFinish={(values) => {
              handleVerifyPayment(selectedTransaction.id, values.status, values.note);
            }}
          >
            <div className="mb-4">
              <p><strong>รหัสธุรกรรม:</strong> {selectedTransaction.transaction_id}</p>
              <p><strong>ผู้ใช้:</strong> {selectedTransaction.User?.full_name}</p>
              <p><strong>จำนวนเงิน:</strong> ฿{parseFloat(selectedTransaction.amount).toFixed(2)}</p>
            </div>

            <Form.Item
              name="status"
              label="การตัดสินใจ"
              rules={[{ required: true, message: 'กรุณาเลือกการตัดสินใจ' }]}
            >
              <Select placeholder="เลือกการตัดสินใจ">
                <Option value="verified">อนุมัติ</Option>
                <Option value="rejected">ปฏิเสธ</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="note"
              label="หมายเหตุ"
            >
              <Input.TextArea rows={3} placeholder="หมายเหตุ (ถ้ามี)" />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  ยืนยัน
                </Button>
                <Button onClick={() => setVerifyModalVisible(false)}>
                  ยกเลิก
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default PaymentManager;
