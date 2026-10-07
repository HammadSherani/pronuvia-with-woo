/** Parse page/pageSize from URL searchParams safely — usable in server and client components */
export function parsePagination(
  params: Record<string, string | string[] | undefined>,
  defaultSize = 10,
) {
  const page     = Math.max(1, parseInt(String(params.page     ?? "1"),  10) || 1);
  const pageSize = parseInt(String(params.pageSize ?? String(defaultSize)), 10) || defaultSize;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
