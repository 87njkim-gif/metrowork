import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import apiService from '../../services/api';

const WorkTodayPage: React.FC = () => {
  const { user } = useAuth();
  const [completedWork, setCompletedWork] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // 완료된 업무 목록 불러오기 (현재 사용자만)
  useEffect(() => {
    if (user) {
      loadCompletedWork();
    }
  }, [selectedDate, user]);

  const loadCompletedWork = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await apiService.getCompletedWork({
        startDate: selectedDate,
        endDate: selectedDate,
        limit: 100,  // 최대 100개까지 표시
        userId: user.id  // 현재 사용자 ID 추가
      });
      
      if (response.data?.workStatuses) {
        setCompletedWork(response.data.workStatuses);
      } else {
        setCompletedWork([]);
      }
    } catch (error) {
      console.error('완료된 업무 로드 실패:', error);
      setCompletedWork([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-content max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">내 업무 완료 현황</h1>
        
        {/* 개인 업무 안내 */}
        <div className="mb-4 p-3 bg-blue-50 rounded text-sm text-blue-700">
          💡 <strong>개인 업무 관리:</strong> 이 화면에서는 본인이 완료한 업무만 표시됩니다.
          전체 업무 현황을 확인하려면 "검색" 화면을 이용하세요.
        </div>
        
        {/* 날짜 선택 */}
        <div className="mb-4 flex items-center gap-4">
          <label className="font-medium">업무일:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>

        {/* 완료된 업무 목록 */}
        <div className="overflow-x-auto bg-white rounded shadow border">
          {loading ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : completedWork.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {selectedDate}에 완료한 업무가 없습니다.
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="border-b border-r border-gray-200 px-3 py-2 bg-gray-50 text-center font-semibold">자산</th>
                  <th className="border-b border-r border-gray-200 px-3 py-2 bg-gray-50 text-center font-semibold">업무용 PC 설치 장소</th>
                  <th className="border-b border-r border-gray-200 px-3 py-2 bg-gray-50 text-center font-semibold">설치팀</th>
                  <th className="border-b border-r border-gray-200 px-3 py-2 bg-gray-50 text-center font-semibold">완료 시간</th>
                </tr>
              </thead>
              <tbody>
                {completedWork.map((work: any, i: number) => (
                  <tr key={i} className="hover:bg-green-50">
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-center">
                      {work.excel_data?.row_data?.자산 || '-'}
                    </td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-center">
                      {work.excel_data?.row_data?.['업무용 PC 설치 장소'] || '-'}
                    </td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-center">
                      {work.excel_data?.row_data?.설치팀 || '-'}
                    </td>
                    <td className="border-b border-r border-gray-200 px-3 py-2 text-center">
                      {work.completed_at ? new Date(work.completed_at).toLocaleString('ko-KR') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 통계 */}
        {completedWork.length > 0 && (
          <div className="mt-4 p-4 bg-green-50 rounded">
            <p className="text-green-800">
              {selectedDate}에 총 <strong>{completedWork.length}개</strong>의 업무를 완료했습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkTodayPage; 