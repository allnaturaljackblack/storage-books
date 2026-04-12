// Print-only header for P&L, Balance Sheet, and other exported reports.
// Hidden in the browser; rendered in print/PDF via .print-only CSS class.

export default function PrintHeader({ logoUrl, reportName, subtitle, title, dateRange, preparedBy }) {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="print-only" style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {/* Left: logo + company name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo"
              style={{ height: '52px', width: 'auto', objectFit: 'contain' }}
            />
          )}
          <div>
            {reportName && (
              <p style={{ margin: 0, fontWeight: '700', fontSize: '16px', color: '#0f172a' }}>
                {reportName}
              </p>
            )}
            {subtitle && (
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right: report type + dates */}
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>
            {title}
          </p>
          {dateRange && (
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#475569' }}>
              {dateRange}
            </p>
          )}
          <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#94a3b8' }}>
            Prepared {today}{preparedBy ? ` by ${preparedBy}` : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
