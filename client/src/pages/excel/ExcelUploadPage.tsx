import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../../services/api';

interface UploadProgress {
  fileId: number;
  filename: string;
  progress: number;
  isProcessed: boolean;
  totalRows: number;
  processedRows: number;
}

const ExcelUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 파일 선택 처리
  const handleFileSelect = (file: File) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('지원하지 않는 파일 형식입니다. (.xlsx, .xls, .csv 파일만 가능)');
      return;
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB
      toast.error('파일 크기가 너무 큽니다. (최대 100MB)');
      return;
    }

    setSelectedFile(file);
  };

  // 드래그 앤 드롭 처리
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // 파일 업로드 처리
  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('업로드할 파일을 선택해주세요.');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      if (description) {
        formData.append('description', description);
      }
      
      if (tags) {
        const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        formData.append('tags', JSON.stringify(tagArray));
      }

      const response = await apiService.uploadExcelFile(formData);
      
      if (response.success) {
        toast.success('파일이 업로드되었습니다. 처리 중입니다.');
        setUploadProgress({
          fileId: response.data.fileId,
          filename: response.data.filename,
          progress: 0,
          isProcessed: false,
          totalRows: 0,
          processedRows: 0
        });
        
        // 진행률 폴링 시작
        pollUploadProgress(response.data.fileId);
      } else {
        toast.error(response.message || '업로드에 실패했습니다.');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || '업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  // 진행률 폴링
  const pollUploadProgress = async (fileId: number) => {
    const poll = async () => {
      try {
        const response = await apiService.getUploadProgress(fileId);
        if (response.success) {
          setUploadProgress({
            fileId: response.data.fileId,
            filename: response.data.filename,
            progress: response.data.progress,
            isProcessed: response.data.isProcessed,
            totalRows: response.data.totalRows,
            processedRows: response.data.processedRows
          });

          if (!response.data.isProcessed) {
            // 아직 처리 중이면 2초 후 다시 폴링
            setTimeout(poll, 2000);
          } else {
            toast.success('파일 처리가 완료되었습니다!');
            setTimeout(() => {
              navigate('/excel/search');
            }, 2000);
          }
        }
      } catch (error) {
        console.error('Progress polling error:', error);
      }
    };

    poll();
  };

  // 파일 제거
  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="max-w-2xl mx-auto">
          {/* 헤더 */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">엑셀 파일 업로드</h1>
            <p className="text-gray-600">
              엑셀 파일을 업로드하여 데이터를 분석하고 업무를 관리할 수 있습니다.
            </p>
          </div>

          {/* 업로드 영역 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : selectedFile
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <div className="space-y-4">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {selectedFile.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  <button
                    onClick={handleRemoveFile}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <X className="w-4 h-4 mr-2" />
                    파일 제거
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      파일을 드래그하여 업로드하거나 클릭하여 선택하세요
                    </h3>
                    <p className="text-sm text-gray-500">
                      .xlsx, .xls, .csv 파일 (최대 100MB)
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <File className="w-4 h-4 mr-2" />
                    파일 선택
                  </button>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className="hidden"
            />
          </div>

          {/* 파일 정보 입력 */}
          {selectedFile && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">파일 정보</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    설명 (선택사항)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="파일에 대한 설명을 입력하세요..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    태그 (선택사항)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="태그1, 태그2, 태그3 (쉼표로 구분)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 업로드 버튼 */}
          {selectedFile && (
            <div className="flex justify-center">
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    업로드 중...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    파일 업로드
                  </>
                )}
              </button>
            </div>
          )}

          {/* 업로드 진행률 */}
          {uploadProgress && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">처리 진행률</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>{uploadProgress.filename}</span>
                    <span>{uploadProgress.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress.progress}%` }}
                    />
                  </div>
                </div>

                <div className="text-sm text-gray-600">
                  {uploadProgress.isProcessed ? (
                    <div className="flex items-center text-green-600">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      처리 완료 ({uploadProgress.totalRows}행)
                    </div>
                  ) : (
                    <div className="flex items-center text-blue-600">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      처리 중... ({uploadProgress.processedRows}/{uploadProgress.totalRows}행)
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExcelUploadPage; 