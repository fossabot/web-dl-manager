'use client';

import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Space, Table, Tag, Spin, message, Button } from 'antd';
import { Activity, BarChart3, Zap, RefreshCw } from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';

interface Task {
  id: string;
  url: string;
  status: string;
  createdAt: string;
}

interface SystemStats {
  totalTasks: number;
  completedTasks: number;
  runningTasks: number;
  failedTasks: number;
  uptime: number;
}

export default function StatusPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const tasksRes = await fetch('/api/tasks');
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData);

        const totalTasks = tasksData.length;
        const completedTasks = tasksData.filter((t: Task) => t.status === 'completed').length;
        const runningTasks = tasksData.filter((t: Task) => t.status === 'downloading').length;
        const failedTasks = tasksData.filter((t: Task) => t.status === 'failed').length;

        setStats({
          totalTasks,
          completedTasks,
          runningTasks,
          failedTasks,
          uptime: Math.floor(Date.now() / 1000),
        });
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
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      downloading: 'processing',
      completed: 'success',
      failed: 'error',
      queued: 'default',
      paused: 'warning',
      compressing: 'processing',
      uploading: 'processing',
    };
    return statusMap[status] || 'default';
  };

  const getStatusLabel = (status: string) => {
    const labelMap: Record<string, string> = {
      downloading: '下载中',
      completed: '已完成',
      failed: '失败',
      queued: '等待中',
      paused: '已暂停',
      compressing: '压缩中',
      uploading: '上传中',
    };
    return labelMap[status] || status;
  };

  const columns: ColumnsType<Task> = [
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      width: 300,
      ellipsis: true,
      render: (text) => (
        <span title={text} className="truncate">
          {text}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => new Date(date).toLocaleString('zh-CN'),
    },
  ];

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spin size="large" tip="加载系统状态中..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Activity size={32} className="text-blue-500" />
            <h1 className="text-3xl font-bold">系统状态</h1>
          </div>
          <Button
            type="primary"
            icon={<RefreshCw size={16} />}
            onClick={fetchData}
            loading={loading}
          >
            刷新
          </Button>
        </div>

        {/* 统计卡片 */}
        <Row gutter={[16, 16]} className="mb-8">
          <Col xs={24} sm={12} lg={6}>
            <Card
              className="bg-slate-800 border-slate-700 hover:border-blue-500 transition-colors"
              bordered
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div className="flex items-center gap-2 text-slate-400">
                  <BarChart3 size={20} />
                  <span>总任务数</span>
                </div>
                <Statistic
                  value={stats?.totalTasks || 0}
                  valueStyle={{ color: '#fff' }}
                />
              </Space>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card
              className="bg-slate-800 border-slate-700 hover:border-green-500 transition-colors"
              bordered
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div className="flex items-center gap-2 text-slate-400">
                  <Activity size={20} className="text-green-500" />
                  <span>已完成</span>
                </div>
                <Statistic
                  value={stats?.completedTasks || 0}
                  valueStyle={{ color: '#22c55e' }}
                />
              </Space>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card
              className="bg-slate-800 border-slate-700 hover:border-yellow-500 transition-colors"
              bordered
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div className="flex items-center gap-2 text-slate-400">
                  <Zap size={20} className="text-yellow-500" />
                  <span>运行中</span>
                </div>
                <Statistic
                  value={stats?.runningTasks || 0}
                  valueStyle={{ color: '#eab308' }}
                />
              </Space>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card
              className="bg-slate-800 border-slate-700 hover:border-red-500 transition-colors"
              bordered
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div className="flex items-center gap-2 text-slate-400">
                  <Activity size={20} className="text-red-500" />
                  <span>失败</span>
                </div>
                <Statistic
                  value={stats?.failedTasks || 0}
                  valueStyle={{ color: '#ef4444' }}
                />
              </Space>
            </Card>
          </Col>
        </Row>

        {/* 任务列表 */}
        <Card
          title="近期任务"
          className="bg-slate-800 border-slate-700"
          bodyStyle={{ padding: '0' }}
        >
          <Table
            columns={columns}
            dataSource={tasks.slice(0, 10).map((task) => ({
              ...task,
              key: task.id,
            }))}
            loading={loading}
            pagination={false}
            rowClassName="bg-slate-700 hover:bg-slate-600 border-slate-700"
            scroll={{ x: true }}
          />
        </Card>
      </div>
    </div>
  );
}
