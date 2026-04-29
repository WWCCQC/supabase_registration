import { useState } from 'react';

interface ForceRefreshButtonProps {
  onRefresh?: () => void;
  apiEndpoint?: string;
}

export default function ForceRefreshButton({ 
  onRefresh, 
  apiEndpoint = '/api/chart/workgroup-count' 
}: ForceRefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      // Call the API with force=true parameter
      const response = await fetch(`${apiEndpoint}?force=true`);
      const data = await response.json();
      
      setLastRefresh(new Date().toLocaleString('th-TH'));
      
      // Call the parent component's refresh callback if provided
      if (onRefresh) {
        onRefresh();
      }
      
      console.log('🔄 Force refresh completed:', data);
      
    } catch (error) {
      console.error('❌ Force refresh failed:', error);
      alert('การรีเฟรชข้อมูลล้มเหลว กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-2">
      <button
        onClick={handleForceRefresh}
        disabled={isRefreshing}
        className={`
          px-4 py-2 rounded-lg font-medium transition-all duration-200 
          ${isRefreshing 
            ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
          }
        `}
      >
        {isRefreshing ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            <span>รีเฟรชข้อมูล...</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>รีเฟรชข้อมูลทันที</span>
          </div>
        )}
      </button>
      
      {lastRefresh && (
        <p className="text-xs text-gray-500">
          รีเฟรชล่าสุด: {lastRefresh}
        </p>
      )}
      
      <p className="text-xs text-gray-400 text-center max-w-xs">
        กดเพื่อดึงข้อมูลจาก Supabase ใหม่ทันที (แก้ปัญหาข้อมูลล่าช้า 4-6 ชั่วโมง)
      </p>
    </div>
  );
}