import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FaUserCog, FaLock, FaSave } from 'react-icons/fa';

export default function Profile() {
  const { user, loadUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleProfileUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/auth/profile', { firstName, lastName, phone });
      loadUser();
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setChangingPassword(true);
    try {
      await api.put('/auth/password', { oldPassword, newPassword });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <FaUserCog className="w-5 h-5 text-primary-600" />
          Account Information
        </h2>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Email</label>
              <input className="input-field bg-gray-50 dark:bg-gray-700/50 cursor-not-allowed" value={user?.email || ''} disabled />
            </div>
            <div>
              <label className="label">Role</label>
              <input className="input-field bg-gray-50 dark:bg-gray-700/50 cursor-not-allowed capitalize" value={user?.role || ''} disabled />
            </div>
            <div>
              <label className="label">First Name</label>
              <input className="input-field" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input className="input-field" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Phone</label>
              <input className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={saving}>
              <FaSave className="w-4 h-4 mr-1" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <FaLock className="w-5 h-5 text-primary-600" />
          Change Password
        </h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Current Password</label>
              <input type="password" className="input-field" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
            </div>
            <div>
              <label className="label">New Password</label>
              <input type="password" className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input type="password" className="input-field" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={changingPassword}>
              <FaLock className="w-4 h-4 mr-1" />
              {changingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
