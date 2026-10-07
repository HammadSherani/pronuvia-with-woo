type StripeLoadingOverlayProps = {
  visible: boolean;
};

export function StripeLoadingOverlay({ visible }: StripeLoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-white/95 px-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label="Loading secure payment form"
    >
      <div className="flex flex-col items-center text-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#3DBFA4]" />
        <p className="mt-4 text-base font-semibold text-gray-800">Loading secure payment</p>
        <p className="mt-1 text-sm text-gray-500">Please wait while the payment form loads.</p>
      </div>
    </div>
  );
}
