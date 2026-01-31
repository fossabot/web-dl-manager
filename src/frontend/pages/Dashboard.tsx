import React, { useEffect, useState } from 'react';

interface Stats {
  activeTasks: number;
  completedToday: number;
  storageUsed: string;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats>({ activeTasks: 0, completedToday: 0, storageUsed: '0 GB' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => console.error('Failed to fetch stats:', err));
  }, []);

  if (loading) return <div className="p-8 text-center">Loading dashboard...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
          <h2 className="text-sm font-medium text-gray-500 uppercase">Active Tasks</h2>
          <p className="text-3xl font-bold text-gray-800">{stats.activeTasks}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
          <h2 className="text-sm font-medium text-gray-500 uppercase">Completed Today</h2>
          <p className="text-3xl font-bold text-gray-800">{stats.completedToday}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-orange-500">
          <h2 className="text-sm font-medium text-gray-500 uppercase">Storage Used</h2>
          <p className="text-3xl font-bold text-gray-800">{stats.storageUsed}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;