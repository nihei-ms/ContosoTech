import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface ChartSpec {
  type: string
  title: string
  xKey: string
  yKey: string
  data: Record<string, unknown>[]
}

const COLORS = ['#0078d4', '#00b4d8', '#0096c7', '#48cae4', '#90e0ef', '#ade8f4']

export default function ChartRenderer({ chart }: { chart: ChartSpec }) {
  const { type, title, xKey, yKey, data } = chart

  if (!data || data.length === 0 || type === 'none') return null

  const containerStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '20px 16px 12px',
    marginTop: 10,
    boxShadow: 'var(--shadow)',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--blue-dark)',
    marginBottom: 16,
    textAlign: 'center',
  }

  if (type === 'bar') {
    return (
      <div style={containerStyle}>
        <div style={titleStyle}>{title}</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 4, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 12 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ fontSize: 13 }} />
            <Bar dataKey={yKey} fill="#0078d4" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (type === 'line') {
    return (
      <div style={containerStyle}>
        <div style={titleStyle}>{title}</div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 4, right: 20, left: 10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} angle={-25} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ fontSize: 13 }} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Line type="monotone" dataKey={yKey} stroke="#0078d4" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (type === 'pie') {
    return (
      <div style={containerStyle}>
        <div style={titleStyle}>{title}</div>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={110}
              label={({ name, percent }) =>
                `${name}: ${(percent * 100).toFixed(1)}%`
              }
              labelLine
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 13 }} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // Fallback: render as a simple table
  const headers = Object.keys(data[0] || {})
  return (
    <div style={containerStyle}>
      <div style={titleStyle}>{title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {headers.map(h => (
                <th key={h} style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  background: 'var(--blue-light)',
                  borderBottom: '2px solid var(--border)',
                  fontWeight: 600,
                  color: 'var(--blue-dark)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 20).map((row, i) => (
              <tr key={i} style={{ background: i % 2 ? 'var(--bg)' : 'var(--surface)' }}>
                {headers.map(h => (
                  <td key={h} style={{ padding: '7px 12px', borderBottom: '1px solid var(--border)' }}>
                    {String(row[h] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
