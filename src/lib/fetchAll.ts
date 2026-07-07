const PAGE_SIZE = 1000

/**
 * Supabase/PostgREST caps unpaginated responses at a server-side row limit
 * (1000 on this project) -- a plain .select() silently returns only the
 * first page with no error, which is easy to miss since small result sets
 * never hit it. Any query that can return more than ~1000 rows (values
 * tables, especially once scoped to multiple categories/quarters at once)
 * must page through with .range() instead of a single unbounded call.
 */
export async function fetchAllRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  let all: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await buildPage(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}
