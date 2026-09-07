export default function EndorsementTracker() {
  // No verified applicant endorsement-stage contract is available yet.
  // Do not infer upload or selection stages from generic applicant status/phase.
  const columns = [
    { title: 'Manager Approved', applicants: [] },
    { title: 'Uploaded to Portal', applicants: [] },
    { title: 'Waiting Selection', applicants: [] },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-3xl font-extrabold tracking-tight">Endorsement Tracker</h2>
        <p className="text-sm text-[#64748B] mt-1 font-medium">
          Track approved CVs being sent to external employers.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {columns.map((column) => (
          <div key={column.title} className="bg-slate-200/50 rounded-xl p-4 flex flex-col h-[600px] border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs uppercase tracking-widest text-[#0F172A] font-black">{column.title}</p>
              <span className="px-2 py-0.5 bg-slate-200 text-[#0F172A] text-xs font-bold rounded">{column.applicants.length}</span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm font-medium text-slate-400">No applicants</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
