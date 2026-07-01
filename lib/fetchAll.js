// Fetch every row from a Supabase/PostgREST query, paginating past the
// server's ~1000-row response cap.
//
// A single `.select()` silently returns at most ~1000 rows. With an ORDER BY
// that means the tail of the result set is dropped — e.g. `.order('date')`
// (ascending) quietly discards the most recent transactions once the table
// grows past 1000 rows. Any view that needs the full history must page.
//
// Pass a factory that returns a *fresh* query builder each call (builders are
// single-use once `.range()`/await runs). Resolves to the full array of rows.
// Errors are logged and the rows gathered so far are returned, matching the
// existing pages' tolerance for a null/empty result.
export async function fetchAllRows(makeQuery, pageSize = 1000) {
  let from = 0
  const all = []
  for (;;) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1)
    if (error) {
      console.error('fetchAllRows:', error.message)
      break
    }
    all.push(...(data || []))
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return all
}
