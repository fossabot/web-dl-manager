'use client';

import { useState, useEffect } from 'react';
import { Table, Tag, Space, Button, Typography, Card, message, Popconfirm, Tooltip } from 'antd';
import { ListTodo, Trash2, Eye, ExternalLink, RefreshCw } from 'lucide-react';
import Link from 'next/link';

const { Title } = Typography;

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    } catch (err) {
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
      render: (_: any, record: any) => (
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
        <Link href="/">
          <Button type="primary" shape="round">新建任务</Button>
        </Link>
      </div>

      <Card className="shadow-sm border-slate-800" styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          className="ant-table-custom"
        />
      </Card>
    </div>
  );
}