export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="skeleton h-7 w-48 rounded-[var(--radius-sm)]" />
        <div className="skeleton h-4 w-72 rounded-[var(--radius-sm)]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-28 rounded-[var(--radius-lg)]" />
        ))}
      </div>
      <div className="skeleton h-64 rounded-[var(--radius-lg)]" />
    </div>
  );
}
