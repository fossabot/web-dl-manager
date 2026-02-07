'use client';

import { useState, useEffect } from 'react';
import { Table, Tag, Space, Button, Typography, Card, message, Popconfirm, Tooltip } from 'antd';
import { ListTodo, Trash2, Eye, RefreshCw, ChevronLeft, Filter } from 'lucide-react';
import Link from 'next/link';

const { Title } = Typography;

interface Task {
  id: string;
  url: string;
  status: string;
  createdAt: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        message.success('任务已删除');
        fetchTasks();
      }
    } catch {
      message.error('删除任务失败');
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'completed': return <Tag color="success">已完成</Tag>;
      case 'failed': return <Tag color="error">失败</Tag>;
      case 'running': return <Tag color="processing" icon={<RefreshCw size={12} className="animate-spin" />}>运行中</Tag>;
      case 'queued': return <Tag color="default">队列中</Tag>;
      case 'compressing': return <Tag color="warning">压缩中</Tag>;
      case 'uploading': return <Tag color="geekblue">上传中</Tag>;
      default: return <Tag>{status}</Tag>;
    }
  };

  // Get unique statuses for filter
  const uniqueStatuses = Array.from(new Set(tasks.map(t => t.status)));
  const statusStats = uniqueStatuses.map(status => ({
    status,
    count: tasks.filter(t => t.status === status).length,
    label: getStatusTag(status)
  }));

  // Filter tasks based on selected status
  const filteredTasks = statusFilter 
    ? tasks.filter(t => t.status === statusFilter)
    : tasks;

  const columns = [
    {
      title: '任务 ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <code className="text-xs text-slate-500">{id.slice(0, 8)}...</code>,
      width: 120,
    },
    {
      title: '目标 URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (url: string) => (
        <Tooltip title={url}>
          <span className="text-sm">{url}</span>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
      width: 120,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => <span className="text-xs text-slate-500">{new Date(date).toLocaleString()}</span>,
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Task) => (
        <Space size="middle">
          <Link href={`/status/${record.id}`}>
            <Button size="small" type="text" icon={<Eye size={14} />}>详情</Button>
          </Link>
          <Popconfirm
            title="确定要删除此任务吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" type="text" danger icon={<Trash2 size={14} />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
      width: 160,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex justify-between items-center mb-8">
        <Title level={2} className="flex items-center m-0">
          <ListTodo className="mr-3 text-blue-500" /> 任务列表
        </Title>
        <div className="flex gap-4 items-center">
          {/* Toggle Sidebar Button */}
          <Tooltip title={sidebarVisible ? '收起列表' : '展开列表'}>
            <Button
              type="text"
              icon={<ChevronLeft size={18} className={`transition-transform ${!sidebarVisible ? 'rotate-180' : ''}`} />}
              onClick={() => setSidebarVisible(!sidebarVisible)}
              className="h-10 w-10 p-0"
            />
          </Tooltip>
          <Link href="/">
            <Button type="primary" shape="round">新建任务</Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left Sidebar */}
        <div className={`transition-all duration-300 ${
          sidebarVisible ? 'w-56 opacity-100' : 'w-0 opacity-0 overflow-hidden'
        }`}>
          <Card 
            className="bg-slate-900/50 border-slate-800 sticky top-24 h-fit"
            styles={{ body: { padding: '16px' } }}
          >
            <div className="mb-4 flex items-center gap-2">
              <Filter size={16} className="text-blue-500" />
              <span className="font-semibold text-sm">任务统计</span>
            </div>
            
            <div className="space-y-2 mb-6">
              {/* Total Count */}
              <div 
                onClick={() => setStatusFilter(null)}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  statusFilter === null
                    ? 'bg-blue-600/20 border border-blue-600 text-blue-400'
                    : 'bg-slate-800/50 hover:bg-slate-700/50 text-slate-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">全部</span>
                  <span className="text-lg font-bold">{tasks.length}</span>
                </div>
              </div>

              {/* Status Filters */}
              {statusStats.map(({ status, count }) => (
                <div
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    statusFilter === status
                      ? 'bg-blue-600/20 border border-blue-600'
                      : 'bg-slate-800/50 hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{getStatusTag(status)}</span>
                    <span className={`font-bold ${statusFilter === status ? 'text-blue-400' : 'text-slate-400'}`}>
                      {count}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Clear Filter Button */}
            {statusFilter && (
              <Button 
                type="text" 
                size="small" 
                block
                onClick={() => setStatusFilter(null)}
                className="text-xs h-8"
              >
                清除过滤
              </Button>
            )}
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <Card className="shadow-sm border-slate-800" styles={{ body: { padding: 0 } }}>
            <Table
              columns={columns}
              dataSource={filteredTasks}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              className="ant-table-custom"
            />
          </Card>
        </div>
      </div>
    </div>
  );
}