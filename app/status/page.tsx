'use client';

import { useState, useEffect } from 'react';
import { Card, Statistic, Button, Space, Table, Row, Col, Progress, Spin, message, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

interface Task {
  id: string;
  url: string;
  status: string;
  createdAt: string;
}

interface TaskTableData extends Task {
  key: string;
}

interface SystemStats {
  totalTasks: number;
  completedTasks: number;
  runningTasks: number;
  failedTasks: number;
}

interface SystemInfo {
  system: {
    platform: string;
    arch: string;
    uptime: number;
  };
  cpu: {
    cores: number;
    model: string;
    speed: number;
    usage: number;
    loadAverage: {
      oneMinute: number;
      fiveMinutes: number;
      fifteenMinutes: number;
    };
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  timestamp: string;
}

export default function StatusPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [tasks, setTasks] = useState<TaskTableData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async (): Promise<void> => {
    setLoading(true);
    try {
      // 获取任务数据
      const tasksRes = await fetch('/api/tasks');
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData.map((t: Task) => ({ ...t, key: t.id })));

        const totalTasks = tasksData.length;
        const completedTasks = tasksData.filter((t: Task) => t.status === 'completed').length;
        const runningTasks = tasksData.filter((t: Task) => t.status === 'downloading').length;
        const failedTasks = tasksData.filter((t: Task) => t.status === 'failed').length;

        setStats({
          totalTasks,
          completedTasks,
          runningTasks,
          failedTasks,
        });
      }

      // 获取系统信息
      const sysRes = await fetch('/api/system-info');
      if (sysRes.ok) {
        const sysData = await sysRes.json();
        setSystemInfo(sysData);
      }
    } catch (err) {
      console.error('Failed to fetch system status:', err);
      message.error('无法获取系统状态');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      downloading: 'processing',
      completed: 'success',
      failed: 'error',
      queued: 'default',
      paused: 'warning',
      compressing: 'processing',
      uploading: 'processing',
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      downloading: '下载中',
      completed: '已完成',
      failed: '失败',
      queued: '等待中',
      paused: '已暂停',
      compressing: '压缩中',
      uploading: '上传中',
    };
    return labels[status] || status;
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}天 ${hours}小时 ${minutes}分钟`;
  };

  const getMemoryStatus = (percentage: number): 'success' | 'normal' | 'exception' => {
    if (percentage > 80) {
      return 'exception';
    }
    if (percentage > 60) {
      return 'normal';
    }
    return 'success';
  };

  const columns = [
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Spin spinning={loading}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 任务统计 */}
          <Row gutter={16}>
            <Col xs={12} sm={6}>
              <Card>
                <Statistic title="总任务数" value={stats?.totalTasks || 0} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <Statistic
                  title="已完成"
                  value={stats?.completedTasks || 0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <Statistic
                  title="运行中"
                  value={stats?.runningTasks || 0}
                  valueStyle={{ color: '#1677ff' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <Statistic
                  title="失败"
                  value={stats?.failedTasks || 0}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 系统信息 */}
          {systemInfo && (
            <Row gutter={16}>
              {/* CPU 信息 */}
              <Col xs={24} sm={12} md={8}>
                <Card title="CPU 信息" size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <span>核心数: </span>
                      <strong>{systemInfo.cpu.cores}</strong>
                    </div>
                    <div>
                      <span>频率: </span>
                      <strong>{systemInfo.cpu.speed} MHz</strong>
                    </div>
                    <div>
                      <span>1min 负载: </span>
                      <strong>{systemInfo.cpu.loadAverage.oneMinute.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span>5min 负载: </span>
                      <strong>{systemInfo.cpu.loadAverage.fiveMinutes.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span>15min 负载: </span>
                      <strong>{systemInfo.cpu.loadAverage.fifteenMinutes.toFixed(2)}</strong>
                    </div>
                  </Space>
                </Card>
              </Col>

              {/* 内存信息 */}
              <Col xs={24} sm={12} md={8}>
                <Card title="内存信息" size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <span>总内存: </span>
                      <strong>{systemInfo.memory.total} MB</strong>
                    </div>
                    <div>
                      <span>已用: </span>
                      <strong>{systemInfo.memory.used} MB</strong>
                    </div>
                    <div>
                      <span>空闲: </span>
                      <strong>{systemInfo.memory.free} MB</strong>
                    </div>
                    <div>
                      <span>使用率: </span>
                      <strong>{systemInfo.memory.percentage}%</strong>
                    </div>
                    <Progress
                      percent={systemInfo.memory.percentage}
                      status={getMemoryStatus(systemInfo.memory.percentage)}
                    />
                  </Space>
                </Card>
              </Col>

              {/* 系统信息 */}
              <Col xs={24} sm={12} md={8}>
                <Card title="系统信息" size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <span>平台: </span>
                      <strong>{systemInfo.system.platform}</strong>
                    </div>
                    <div>
                      <span>架构: </span>
                      <strong>{systemInfo.system.arch}</strong>
                    </div>
                    <div>
                      <span>运行时间: </span>
                      <strong>{formatUptime(systemInfo.system.uptime)}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                      更新于: {new Date(systemInfo.timestamp).toLocaleString('zh-CN')}
                    </div>
                  </Space>
                </Card>
              </Col>
            </Row>
          )}

          {/* 任务列表 */}
          <Card
            title="近期任务"
            extra={
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={fetchData}
              >
                刷新
              </Button>
            }
          >
            <Table
              columns={columns}
              dataSource={tasks.slice(0, 10)}
              loading={loading}
              pagination={false}
              size="small"
            />
          </Card>
        </Space>
      </Spin>
    </div>
  );
}
