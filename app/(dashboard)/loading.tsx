export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-6 w-48 bg-gray-200 rounded-lg mb-2" />
          <div className="h-4 w-72 bg-gray-100 rounded-lg" />
        </div>
        <div className="h-9 w-32 bg-gray-200 rounded-lg" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-4 gap-5 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="h-1 w-10 bg-gray-200 rounded-full mb-4" />
            <div className="h-8 w-20 bg-gray-200 rounded-lg mb-1" />
            <div className="h-3 w-24 bg-gray-100 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="flex gap-6 px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
          {[140, 180, 100, 80, 80, 80].map((w, i) => (
            <div key={i} className="h-3 bg-gray-200 rounded-full" style={{ width: w }} />
          ))}
        </div>
        {/* Table rows */}
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-3 w-[140px]">
              <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
              <div className="h-3.5 flex-1 bg-gray-100 rounded-full" />
            </div>
            <div className="h-3.5 bg-gray-100 rounded-full w-[180px]" />
            <div className="h-3.5 bg-gray-100 rounded-full w-[100px]" />
            <div className="h-5 bg-gray-100 rounded-full w-[80px]" />
            <div className="h-3.5 bg-gray-100 rounded-full w-[80px]" />
            <div className="h-3.5 bg-gray-100 rounded-full w-[60px] ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
