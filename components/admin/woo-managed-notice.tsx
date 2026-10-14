type Props = {
  what: string;   // e.g. "Products", "Categories"
  href: string;   // WP admin link
};

export function WooManagedNotice({ what, href }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 mb-5 px-4 py-3 rounded-xl border border-[#5BB8D4]/30 bg-[#5BB8D4]/5">
      <p className="text-sm text-gray-600">
        <span className="font-semibold text-gray-800">{what} are managed in WooCommerce.</span>{" "}
        Add, edit and delete them in the WordPress admin; the shops update within a minute.
      </p>
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="shrink-0 inline-flex items-center gap-1.5 bg-[#3DBFA4] hover:bg-[#35ab93] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
        Open WooCommerce
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}
