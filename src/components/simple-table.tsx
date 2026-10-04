type SimpleTableProps<T> = {
  columns: Array<{
    label: string;
    render: (item: T) => React.ReactNode;
  }>;
  data: T[];
};

export function SimpleTable<T>({ columns, data }: SimpleTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="card__body">
        <div className="eyebrow">Empty</div>
        <p className="muted">No records found for this view.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.label}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, itemIndex) => (
            <tr key={itemIndex}>
              {columns.map((column) => (
                <td key={column.label}>{column.render(item)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
