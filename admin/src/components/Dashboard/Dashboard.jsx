import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Alert, Table, Tag, Progress, Button } from 'antd';
import { 
    ThunderboltOutlined, 
    CarOutlined, 
    DollarOutlined, 
    UserOutlined,
    BatteryTwoTone,
    SunOutlined,
    WarningOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import { Line, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
} from 'chart.js';
import './Dashboard.css';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

const Dashboard = () => {
    const [dashboardData, setDashboardData] = useState({
        stats: {
            totalStations: 0,
            activeStations: 0,
            totalUsers: 0,
            activeSessions: 0,
            todayRevenue: 0,
            solarProduction: 0
        },
        alerts: [],
        recentSessions: [],
        energyData: [],
        stationStatus: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 30000); // Update every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchDashboardData = async () => {
        try {
            const response = await fetch('/api/admin/dashboard', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            setDashboardData(data);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const energyChartData = {
        labels: dashboardData.energyData.map(item => 
            new Date(item.timestamp).toLocaleTimeString('th-TH', { 
                hour: '2-digit', 
                minute: '2-digit' 
            })
        ),
        datasets: [
            {
                label: 'พลังงานแสงอาทิตย์ (kW)',
                data: dashboardData.energyData.map(item => item.solar_power),
                borderColor: 'rgb(255, 193, 7)',
                backgroundColor: 'rgba(255, 193, 7, 0.2)',
                tension: 0.1
            },
            {
                label: 'การใช้พลังงาน (kW)',
                data: dashboardData.energyData.map(item => item.consumption),
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                tension: 0.1
            }
        ]
    };

    const stationStatusData = {
        labels: ['ว่าง', 'กำลังชาร์จ', 'ปิดปรุงบำรุง', 'ออฟไลน์'],
        datasets: [{
            data: [
                dashboardData.stationStatus.filter(s => s.status === 'available').length,
                dashboardData.stationStatus.filter(s => s.status === 'occupied').length,
                dashboardData.stationStatus.filter(s => s.status === 'maintenance').length,
                dashboardData.stationStatus.filter(s => s.status === 'offline').length
            ],
            backgroundColor: [
                '#52c41a',
                '#1890ff',
                '#faad14',
                '#ff4d4f'
            ]
        }]
    };

    const sessionColumns = [
        {
            title: 'รหัสเซสชัน',
            dataIndex: 'session_code',
            key: 'session_code',
            width: 120
        },
        {
            title: 'ผู้ใช้',
            dataIndex: ['user', 'username'],
            key: 'username',
            width: 100
        },
        {
            title: 'สถานี',
            dataIndex: ['station', 'name'],
            key: 'station_name',
            width: 150
        },
        {
            title: 'สถานะ',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status) => {
                const statusConfig = {
                    'charging': { color: 'blue', text: 'กำลังชาร์จ' },
                    'completed': { color: 'green', text: 'เสร็จสิ้น' },
                    'preparing': { color: 'orange', text: 'เตรียมพร้อม' },
                    'faulted': { color: 'red', text: 'ขัดข้อง' }
                };
                const config = statusConfig[status] || { color: 'default', text: status };
                return <Tag color={config.color}>{config.text}</Tag>;
            }
        },
        {
            title: 'พลังงาน (kWh)',
            dataIndex: 'energy_delivered',
            key: 'energy_delivered',
            width: 120,
            render: (energy) => parseFloat(energy || 0).toFixed(2)
        },
        {
            title: 'ค่าใช้จ่าย (฿)',
            dataIndex: 'cost_total',
            key: 'cost_total',
            width: 100,
            render: (cost) => parseFloat(cost || 0).toFixed(2)
        }
    ];

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h1>แดชบอร์ดการจัดการ</h1>
                <Button 
                    type="primary" 
                    onClick={fetchDashboardData}
                    loading={loading}
                >
                    รีเฟรช
                </Button>
            </div>

            {/* Key Statistics */}
            <Row gutter={[16, 16]} className="stats-row">
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="สถานีชาร์จทั้งหมด"
                            value={dashboardData.stats.totalStations}
                            prefix={<ThunderboltOutlined />}
                            valueStyle={{ color: '#1890ff' }}
                        />
                        <div className="stat-subtitle">
                            ออนไลน์: {dashboardData.stats.activeStations}
                        </div>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="ผู้ใช้งานทั้งหมด"
                            value={dashboardData.stats.totalUsers}
                            prefix={<UserOutlined />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="เซสชันที่ใช้งาน"
                            value={dashboardData.stats.activeSessions}
                            prefix={<CarOutlined />}
                            valueStyle={{ color: '#faad14' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="รายได้วันนี้"
                            value={dashboardData.stats.todayRevenue}
                            prefix={<DollarOutlined />}
                            suffix="฿"
                            precision={2}
                            valueStyle={{ color: '#722ed1' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Solar Energy Status */}
            <Row gutter={[16, 16]} className="energy-row">
                <Col xs={24} lg={12}>
                    <Card title="การผลิตพลังงานแสงอาทิตย์" extra={<SunOutlined />}>
                        <Statistic
                            title="กำลังการผลิตปัจจุบัน"
                            value={dashboardData.stats.solarProduction}
                            suffix="kW"
                            precision={2}
                            valueStyle={{ color: '#faad14' }}
                        />
                        <Progress 
                            percent={(dashboardData.stats.solarProduction / 10) * 100} 
                            strokeColor="#faad14"
                            showInfo={false}
                            className="solar-progress"
                        />
                        <div className="energy-efficiency">
                            <BatteryTwoTone twoToneColor="#52c41a" /> ประสิทธิภาพ: 95.2%
                        </div>
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card title="สถานะสถานีชาร์จ">
                        <div className="station-chart">
                            <Doughnut 
                                data={stationStatusData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            position: 'bottom'
                                        }
                                    }
                                }}
                            />
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Alerts */}
            {dashboardData.alerts.length > 0 && (
                <Row gutter={[16, 16]} className="alerts-row">
                    <Col span={24}>
                        <Card title="การแจ้งเตือน" extra={<WarningOutlined />}>
                            {dashboardData.alerts.map((alert, index) => (
                                <Alert
                                    key={index}
                                    message={alert.title}
                                    description={alert.description}
                                    type={alert.type}
                                    showIcon
                                    className="dashboard-alert"
                                />
                            ))}
                        </Card>
                    </Col>
                </Row>
            )}

            {/* Energy Chart */}
            <Row gutter={[16, 16]} className="chart-row">
                <Col span={24}>
                    <Card title="กราฟการใช้พลังงานรายชั่วโมง">
                        <div className="energy-chart">
                            <Line 
                                data={energyChartData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            position: 'top',
                                        },
                                        title: {
                                            display: false
                                        }
                                    },
                                    scales: {
                                        y: {
                                            beginAtZero: true,
                                            title: {
                                                display: true,
                                                text: 'พลังงาน (kW)'
                                            }
                                        },
                                        x: {
                                            title: {
                                                display: true,
                                                text: 'เวลา'
                                            }
                                        }
                                    }
                                }}
                            />
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Recent Sessions */}
            <Row gutter={[16, 16]} className="sessions-row">
                <Col span={24}>
                    <Card 
                        title="เซสชันการชาร์จล่าสุด" 
                        extra={<CheckCircleOutlined />}
                    >
                        <Table
                            columns={sessionColumns}
                            dataSource={dashboardData.recentSessions}
                            rowKey="id"
                            pagination={{ pageSize: 10 }}
                            size="small"
                            scroll={{ x: 800 }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default Dashboard;
