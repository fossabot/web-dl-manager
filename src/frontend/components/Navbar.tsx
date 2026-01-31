import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, ListTodo, Settings, LogIn } from 'lucide-react';

const Navbar: React.FC = () => {
  return (
    <nav className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="text-xl font-bold text-blue-600">Web-DL Manager</Link>
            <div className="hidden md:flex space-x-4">
              <Link to="/" className="flex items-center text-gray-700 hover:text-blue-600">
                <LayoutDashboard className="w-4 h-4 mr-1" /> Dashboard
              </Link>
              <Link to="/tasks" className="flex items-center text-gray-700 hover:text-blue-600">
                <ListTodo className="w-4 h-4 mr-1" /> Tasks
              </Link>
              <Link to="/settings" className="flex items-center text-gray-700 hover:text-blue-600">
                <Settings className="w-4 h-4 mr-1" /> Settings
              </Link>
            </div>
          </div>
          <div>
            <Link to="/login" className="flex items-center text-gray-700 hover:text-blue-600">
              <LogIn className="w-4 h-4 mr-1" /> Login
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
