import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, CheckCircle, Clock, TrendingUp, BarChart3, User, Calendar, Award } from 'lucide-react';
import apiService from '../../services/api';

interface UserWorkStat {
  user_id: number;
  user_name: string;
  user_email: string;
  user_department: string;
  total_work_count: number;
  completed_count: number;
  pending_count: number;
  completion_rate: number;
  last_completed_at: string;
}

interface WorkStatsSummary {
  totalUsers: number;
  totalCompleted: number;
  totalPending: number;
  averageCompletionRate: number;
}

const AdminWorkStatsPage: React.FC = () => {
  const navigate = useNavigate();
  const [userStats, setUserStats] = useState<UserWorkStat[]>([]);
  const [summary, setSummary] = useState<WorkStatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<'users' | 'overview'>('overview');

  // 회원별 업무 통계 조회
  const fetchUserWorkStats = async () => {
    try {
      setLoading(true);
      const response = await apiService.getUserWorkStats();
      
      if (response.success && response.data) {
        setUserStats(response.data.userStats);
        setSummary(response.data.summary);
      } else {
        setError(response.message || '업무 통계를 불러오는데 실패했습니다.');
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다.');
      console.error('Fetch user work stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 데이터 정리 함수
  const handleCleanupData = async () => {
    if (!window.confirm('미완료된 업무 데이터를 모두 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiService.cleanupWorkStatusData();
      
      if (response.success) {
        alert(`데이터 정리 완료!\n\n삭제된 레코드: ${response.data.deletedCount}개\n현재 완료된 업무: ${response.data.currentStats.completedRecords}개`);
        // 데이터 새로고침
        fetchUserWorkStats();
      } else {
        setError(response.message || '데이터 정리 중 오류가 발생했습니다.');
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다.');
      console.error('Cleanup data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserWorkStats();
  }, []);

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
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
          <p className="mt-4 text-gray-600">업무 통계를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">업무 처리 통계</h1>
                <p className="text-sm text-gray-600">회원별 업무 처리 현황을 확인합니다</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-medium text-gray-900">
                {userStats.length}명의 회원
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <div className="w-5 h-5 text-red-500 mr-2">⚠️</div>
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* 전체 통계 카드 */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-4">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">전체 회원</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.totalUsers}명</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg mr-4">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">완료된 업무</p>
                    <p className="text-2xl font-bold text-gray-900">{summary.totalCompleted}개</p>
                  </div>
                </div>
                <button
                  onClick={handleCleanupData}
                  className="px-3 py-1 bg-red-50 text-red-600 text-sm rounded-md hover:bg-red-100 transition-colors duration-200"
                  title="미완료 업무 데이터 정리"
                >
                  데이터 정리
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 회원별 통계 테이블 */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">회원별 업무 처리 현황</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    회원 정보
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    완료
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    최근 완료
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {userStats.map((stat) => (
                  <tr key={stat.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{stat.user_name}</div>
                          <div className="text-sm text-gray-500">{stat.user_email}</div>
                          {stat.user_department && (
                            <div className="text-xs text-gray-400">{stat.user_department}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                        <span className="text-sm font-medium text-green-600">{stat.completed_count}개</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(stat.last_completed_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {userStats.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">업무 처리 데이터가 없습니다</h3>
              <p className="text-gray-600">회원들이 업무를 처리하면 여기에 통계가 표시됩니다.</p>
            </div>
          )}
        </div>

        {/* 상위 성과자 */}
        {userStats.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Award className="w-5 h-5 text-yellow-500 mr-2" />
                상위 성과자
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {userStats.slice(0, 3).map((stat, index) => (
                  <div key={stat.user_id} className="text-center">
                    <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center ${
                      index === 0 ? 'bg-yellow-100' : 
                      index === 1 ? 'bg-gray-100' : 'bg-orange-100'
                    }`}>
                      <span className={`text-xl font-bold ${
                        index === 0 ? 'text-yellow-600' : 
                        index === 1 ? 'text-gray-600' : 'text-orange-600'
                      }`}>
                        {index + 1}
                      </span>
                    </div>
                    <h3 className="font-medium text-gray-900">{stat.user_name}</h3>
                    <p className="text-sm text-gray-500">{stat.user_department || '부서 미지정'}</p>
                    <p className="text-lg font-bold text-blue-600 mt-2">{stat.completed_count}개 완료</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminWorkStatsPage; 