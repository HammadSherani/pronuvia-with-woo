export function CatalogUnavailable() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
      <p className="text-sm font-medium text-gray-600">The product catalogue is temporarily unavailable.</p>
      <p className="text-xs text-gray-400 mt-1">Please refresh in a minute.</p>
    </div>
  );
}
