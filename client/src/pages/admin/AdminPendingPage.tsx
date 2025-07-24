import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, User, Mail, Phone, Building, Calendar, AlertCircle } from 'lucide-react';
import apiService from '../../services/api';

interface PendingUser {
  id: number;
  email: string;
  name: string;
  phone?: string;
  department?: string;
  position?: string;
  created_at: string;
}

const AdminPendingPage: React.FC = () => {
  const navigate = useNavigate();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // 승인 대기 회원 목록 조회
  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const response = await apiService.getPendingUsers();
      if (response.success && response.data) {
        setPendingUsers(response.data.users);
      } else {
        setError(response.message || '승인 대기 회원 목록을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다.');
      console.error('Fetch pending users error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  // 사용자 승인
  const handleApprove = async (user: PendingUser) => {
    try {
      setProcessing(true);
      const response = await apiService.approveUser(user.id, {
        status: 'approved'
      });
      
      if (response.success && response.data) {
        // 목록에서 제거
        setPendingUsers(prev => prev.filter(u => u.id !== user.id));
        alert(`${user.name}님의 회원가입이 승인되었습니다.`);
      } else {
        alert(response.message || '승인 처리에 실패했습니다.');
      }
    } catch (err) {
      alert('승인 처리 중 오류가 발생했습니다.');
      console.error('Approve user error:', err);
    } finally {
      setProcessing(false);
    }
  };

  // 사용자 거절
  const handleReject = async (user: PendingUser) => {
    if (!rejectionReason.trim()) {
      alert('거절 사유를 입력해주세요.');
      return;
    }

    try {
      setProcessing(true);
      const response = await apiService.approveUser(user.id, {
        status: 'rejected',
        rejection_reason: rejectionReason
      });
      
      if (response.success && response.data) {
        // 목록에서 제거
        setPendingUsers(prev => prev.filter(u => u.id !== user.id));
        setShowRejectModal(false);
        setSelectedUser(null);
        setRejectionReason('');
        alert(`${user.name}님의 회원가입이 거절되었습니다.`);
      } else {
        alert(response.message || '거절 처리에 실패했습니다.');
      }
    } catch (err) {
      alert('거절 처리 중 오류가 발생했습니다.');
      console.error('Reject user error:', err);
    } finally {
      setProcessing(false);
    }
  };

  // 거절 모달 열기
  const openRejectModal = (user: PendingUser) => {
    setSelectedUser(user);
    setShowRejectModal(true);
  };

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">승인 대기 회원 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">승인 대기 회원</h1>
                <p className="text-sm text-gray-600">새로 가입한 회원의 승인을 관리합니다</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-medium text-gray-900">
                {pendingUsers.length}명 대기 중
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {pendingUsers.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">승인 대기 회원이 없습니다</h3>
            <p className="text-gray-600">새로운 회원가입 신청이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingUsers.map((user) => (
              <div key={user.id} className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{user.name}</h3>
                        <p className="text-sm text-gray-500">ID: {user.id}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{user.email}</span>
                      </div>
                      
                      {user.phone && (
                        <div className="flex items-center space-x-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{user.phone}</span>
                        </div>
                      )}
                      
                      {user.department && (
                        <div className="flex items-center space-x-2">
                          <Building className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{user.department}</span>
                        </div>
                      )}
                      
                      {user.position && (
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{user.position}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span>가입일: {formatDate(user.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleApprove(user)}
                      disabled={processing}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      <span>승인</span>
                    </button>
                    
                    <button
                      onClick={() => openRejectModal(user)}
                      disabled={processing}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span>거절</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 거절 사유 모달 */}
      {showRejectModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              회원가입 거절
            </h3>
            
            <p className="text-gray-600 mb-4">
              <strong>{selectedUser.name}</strong>님의 회원가입을 거절하시겠습니까?
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                거절 사유 *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="거절 사유를 입력해주세요..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                {rejectionReason.length}/500자
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedUser(null);
                  setRejectionReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleReject(selectedUser)}
                disabled={processing || !rejectionReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {processing ? '처리 중...' : '거절'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPendingPage; 