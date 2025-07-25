import React, { useEffect, useState } from 'react';
import { useQueryClient } from 'react-query';
import apiService from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

const PAGE_SIZE = 20;

const ExcelSearchPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [columns, setColumns] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [allData, setAllData] = useState<any[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [workDate, setWorkDate] = useState(new Date().toISOString().split('T')[0]);
  const [teamList, setTeamList] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [showExtendedColumns, setShowExtendedColumns] = useState(false);
  const [showWorkCompleteModal, setShowWorkCompleteModal] = useState(false);
  const [selectedRowForWork, setSelectedRowForWork] = useState<any>(null);
  const [completedRows, setCompletedRows] = useState<Set<number>>(new Set());

  // 파일 목록 불러오기
  useEffect(() => {
    apiService.getExcelFiles({ limit: 100 }).then(res => {
      if (res.data?.files) {
        setFiles(res.data.files);
        if (res.data.files.length > 0) {
          setSelectedFileId(res.data.files[0].id);
        }
      }
    });
  }, []);

  // 컬럼 정보 불러오기 (한 번만)
  useEffect(() => {
    if (!selectedFileId) return;
    
    // 컬럼 정보 먼저 가져오기
    apiService.getExcelData(selectedFileId, { page: 1, limit: 1 }).then(res => {
      if (res.data?.columns) {
        setColumns(res.data.columns);
      }
    });
  }, [selectedFileId]);

  // 팀 목록 불러오기 (전체 데이터에서)
  useEffect(() => {
    if (!selectedFileId) return;
    
    // 새로운 팀 목록 API 사용
    apiService.getTeamList(selectedFileId, 8).then(res => {
      if (res.data?.teams) {
        setTeamList(res.data.teams);
        // 자동 선택 제거 - 사용자가 직접 선택하도록 함
        // if (!selectedTeam && res.data.teams.length > 0) setSelectedTeam(res.data.teams[0]);
      }
    }).catch(error => {
      console.error('팀 목록 로드 실패:', error);
    });
  }, [selectedFileId]);

  // 데이터 불러오기
  useEffect(() => {
    if (!selectedFileId || columns.length === 0) return;
    setLoading(true);
    
    // 서버 사이드에서 팀 필터링과 검색을 함께 처리
    const searchParams: any = { page, limit: PAGE_SIZE };
    if (search) searchParams.search = search;

    // 팀 필터링을 위한 검색 조건 구성
    if (!searchParams.criteria) searchParams.criteria = {};
    if (search) searchParams.criteria.search = search;
    if (selectedTeam) {
      const teamColName = columns[8].column_name;
      // 이스케이프된 따옴표 제거하고 깔끔한 값만 전송
      const cleanTeamValue = selectedTeam.replace(/^"|"$/g, '').replace(/^\\"|\\"$/g, '');
      searchParams.criteria.selectedTeam = cleanTeamValue;
      searchParams.criteria.teamColumnName = teamColName;
      console.log('팀 필터링 적용:', { selectedTeam, cleanTeamValue, teamColName, searchParams });
    }
    
    console.log('API 호출 파라미터:', searchParams);
    
    // 캐시 방지를 위한 타임스탬프 추가
    const timestamp = Date.now();
    searchParams._t = timestamp;
    
    apiService.searchExcelData(selectedFileId, searchParams).then(res => {
      console.log('API 응답:', res.data);
      console.log('데이터 개수:', res.data?.data?.length);
      console.log('페이지네이션:', res.data?.pagination);
      console.log('컬럼 정보:', res.data?.columns);
      
      // 실제 데이터 내용 확인
      if (res.data?.data && res.data.data.length > 0) {
        console.log('첫 번째 행 데이터:', res.data.data[0]);
        console.log('팀 컬럼명:', columns[8]?.column_name);
        console.log('팀 값들:', res.data.data.map(row => row.row_data[columns[8]?.column_name]));
        console.log('모든 행의 row_data 키들:', res.data.data[0]?.row_data ? Object.keys(res.data.data[0].row_data) : '없음');
      }
      
      if (res.data) {
        setData(res.data.data || []);
        setTotalRows(res.data.pagination?.total || 0);
        // 컬럼 정보는 이미 있으므로 다시 설정하지 않음
      }
      setLoading(false);
    }).catch((error) => {
      console.error('API 에러:', error);
      setLoading(false);
    });
  }, [selectedFileId, page, search, selectedTeam]); // search만 의존성에 둠

  // 팀 선택 핸들러
  const handleTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTeam = e.target.value;
    console.log('팀 선택 변경:', { oldTeam: selectedTeam, newTeam });
    setSelectedTeam(newTeam);
    setPage(1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput); // 검색 버튼 클릭 시에만 검색어 반영
  };

  // 길게 터치 핸들러
  const handleLongPress = (row: any) => {
    setSelectedRowForWork(row);
    setShowWorkCompleteModal(true);
  };

  // 터치 시작 핸들러
  const handleTouchStart = (row: any, e: React.TouchEvent) => {
    const timer = setTimeout(() => {
      handleLongPress(row);
    }, 500); // 0.5초 길게 터치

    // 터치 종료 시 타이머 취소
    const handleTouchEnd = () => {
      clearTimeout(timer);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    document.addEventListener('touchend', handleTouchEnd);
  };

  // 업무 완료 처리 핸들러
  const handleWorkComplete = async (isComplete: boolean) => {
    if (!selectedRowForWork) return;

    try {
      await apiService.checkWorkItem(selectedRowForWork.id, {
        isCompleted: isComplete,
        notes: isComplete ? `업무일: ${workDate}` : '업무 완료 해제'
      });
      
      if (isComplete) {
        setCompletedRows(prev => new Set([...prev, selectedRowForWork.id]));
        alert('업무 완료 처리되었습니다.');
      } else {
        setCompletedRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(selectedRowForWork.id);
          return newSet;
        });
        alert('업무 완료가 해제되었습니다.');
      }
      
      // 대시보드 데이터 캐시 무효화
      queryClient.invalidateQueries('workStats');
      queryClient.invalidateQueries('userWorkStatus');
      
      setShowWorkCompleteModal(false);
      setSelectedRowForWork(null);
    } catch (error: any) {
      console.error('업무 처리 실패:', error);
      
      // 업무 해제 권한 오류인 경우 특별한 메시지 표시
      if (error.response?.status === 403) {
        alert(error.response.data.message || '업무 해제 권한이 없습니다.');
      } else {
        alert('업무 처리 중 오류가 발생했습니다.');
      }
    }
  };

  // 완료된 업무 목록 불러오기
  useEffect(() => {
    if (selectedFileId) {
      loadCompletedWork();
    }
  }, [selectedFileId, page]);

  const [completedWorkData, setCompletedWorkData] = useState<{[key: number]: any}>({});

  const loadCompletedWork = async () => {
    try {
      const response = await apiService.getCompletedWork({
        fileId: selectedFileId,
        startDate: workDate,
        endDate: workDate
      });
      if (response.data?.workStatuses) {
        const completedIds = new Set(response.data.workStatuses.map((work: any) => work.excel_data_id));
        setCompletedRows(completedIds);
        
        // 완료된 업무 데이터를 저장 (사용자 정보 포함)
        const workDataMap: {[key: number]: any} = {};
        response.data.workStatuses.forEach((work: any) => {
          workDataMap[work.excel_data_id] = work;
        });
        setCompletedWorkData(workDataMap);
      }
    } catch (error) {
      console.error('완료된 업무 로드 실패:', error);
    }
  };

  // 기본 표시 컬럼과 확장 컬럼 분리
  const basicColumns = columns.filter((col: any) => 
    !['담당자', '자산 내역', '위치내역'].includes(col.column_name)
  );
  const extendedColumns = columns.filter((col: any) => 
    ['담당자', '자산 내역', '위치내역'].includes(col.column_name)
  );

  // 현재 표시할 컬럼들
  const visibleColumns = showExtendedColumns ? columns : basicColumns;

  return (
    <div className="page-container">
      <div className="page-content max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">엑셀 데이터 검색</h1>
        {/* 업무일 선택 */}
        <div className="mb-4 flex items-center gap-4">
          <label className="font-medium">업무일:</label>
          <input
            type="date"
            value={workDate}
            onChange={e => setWorkDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        {/* 팀 선택 */}
        <div className="mb-4 flex items-center gap-4">
          <label className="font-medium">팀 선택:</label>
          <select
            value={selectedTeam}
            onChange={handleTeamChange}
            className="border rounded px-2 py-1 z-10"
            style={{ minWidth: 120 }}
          >
            <option value="">전체 팀</option>
            {teamList.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
          {teamList.length === 0 && (
            <span className="text-sm text-gray-400 ml-2">엑셀 데이터에 팀 정보가 없습니다.</span>
          )}
        </div>
        {/* 검색 */}
        <form onSubmit={handleSearch} className="mb-4 flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="자산번호 / 주소 / 전철역 등으로 검색하세요"
            className="border rounded px-2 py-1 flex-1"
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-1 rounded">검색</button>
        </form>
        
        {/* 사용 안내 */}
        <div className="mb-4 p-3 bg-blue-50 rounded text-sm text-blue-700">
          💡 <strong>전체 업무 현황:</strong> 이 화면에서는 모든 사용자가 완료한 업무가 표시됩니다.
          {completedRows.size > 0 && (
            <span className="ml-2">완료된 항목: <strong>{completedRows.size}개</strong></span>
          )}
          <br />
          <span className="text-xs text-blue-600">
            💡 <strong>사용법:</strong> 항목을 길게 터치하면 업무 완료/해제 설정이 가능합니다. 
            본인이 처리한 업무만 해제할 수 있습니다.
          </span>
        </div>
        
        {/* 더보기 버튼 */}
        {extendedColumns.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowExtendedColumns(!showExtendedColumns)}
              className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
            >
              {showExtendedColumns ? '간단히 보기' : '더보기'}
              <span className="text-xs">
                {showExtendedColumns ? '▼' : '▶'}
              </span>
              {!showExtendedColumns && (
                <span className="text-gray-500 text-xs">
                  (담당자, 자산 내역, 위치내역 포함)
                </span>
              )}
            </button>
          </div>
        )}
        
        {/* 데이터 테이블 */}
        <div className="overflow-x-auto bg-white rounded shadow border">
          {loading ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : data.length === 0 ? (
            <div className="p-8 text-center text-gray-500">데이터가 없습니다.</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  {visibleColumns.map((col: any) => (
                    <th key={col.column_index} className="border-b border-r border-gray-200 px-3 py-2 bg-gray-50 text-center font-semibold">
                      {col.display_name || col.column_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row: any, i: number) => (
                  <tr 
                    key={i} 
                    className={`hover:bg-blue-50 cursor-pointer transition-colors ${
                      completedRows.has(row.id) ? 'bg-green-50 hover:bg-green-100' : ''
                    }`}
                    onTouchStart={(e) => handleTouchStart(row, e)}
                    onClick={() => {
                      // 클릭 시에도 길게 터치 효과 (데스크톱용)
                      setTimeout(() => handleLongPress(row), 500);
                    }}
                  >
                    {visibleColumns.map((col: any) => (
                      <td key={col.column_index} className="border-b border-r border-gray-200 px-3 py-2 text-center">
                        {row.row_data[col.column_name]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {/* 페이징 */}
        <div className="flex justify-between items-center mt-4">
          <div>총 {data.length}건</div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >이전</button>
            <span>{page} / {Math.ceil(totalRows / PAGE_SIZE) || 1}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil(totalRows / PAGE_SIZE)}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >다음</button>
          </div>
        </div>
      </div>
      
      {/* 업무 완료 확인 모달 */}
      {showWorkCompleteModal && selectedRowForWork && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {completedRows.has(selectedRowForWork.id) ? '업무 완료 해제' : '업무 완료 처리'}
            </h3>
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-600 mb-2">선택된 항목:</p>
              <p className="font-medium">{selectedRowForWork.row_data?.자산 || '자산 정보 없음'}</p>
              <p className="text-sm text-gray-500">{selectedRowForWork.row_data?.설치팀 || ''}</p>
              {completedRows.has(selectedRowForWork.id) && completedWorkData[selectedRowForWork.id] && (
                <p className="text-sm text-blue-600 mt-2">
                  완료자: {completedWorkData[selectedRowForWork.id].user?.name || '알 수 없음'}
                </p>
              )}
            </div>
            
            {/* 타인의 업무인 경우 안내 메시지 */}
            {completedRows.has(selectedRowForWork.id) && 
             completedWorkData[selectedRowForWork.id] && 
             completedWorkData[selectedRowForWork.id].user?.id !== user?.id && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-yellow-800 text-sm">
                  <strong>{completedWorkData[selectedRowForWork.id].user?.name}</strong> 회원이 처리한 업무입니다.
                  <br />
                  본인이 처리한 업무만 해제할 수 있습니다.
                </p>
              </div>
            )}
            
            <p className="mb-6 text-gray-700">
              {completedRows.has(selectedRowForWork.id) 
                ? '이 항목의 업무 완료를 해제하시겠습니까?' 
                : '이 항목을 업무 완료 처리하시겠습니까?'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowWorkCompleteModal(false);
                  setSelectedRowForWork(null);
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => handleWorkComplete(!completedRows.has(selectedRowForWork.id))}
                disabled={completedRows.has(selectedRowForWork.id) && 
                         completedWorkData[selectedRowForWork.id] && 
                         completedWorkData[selectedRowForWork.id].user?.id !== user?.id}
                className={`px-4 py-2 text-white rounded ${
                  completedRows.has(selectedRowForWork.id) 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {completedRows.has(selectedRowForWork.id) ? '해제' : '완료'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExcelSearchPage; 