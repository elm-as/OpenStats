import { useListJobsQuery, useGetJobStatusQuery, useCancelJobMutation } from '../../store/api';
import type { JobStatus } from '../../types';

const STATUS_TAGS: Record<string, string> = {
  pending: 'ui-tag ui-tag-warning',
  running: 'ui-tag ui-tag-info',
  completed: 'ui-tag ui-tag-ok',
  failed: 'ui-tag ui-tag-danger',
  cancelled: 'ui-tag ui-tag-neutral',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  running: 'En cours',
  completed: 'Terminé',
  failed: 'Échoué',
  cancelled: 'Annulé',
};

function JobProgressBar({ job }: { job: JobStatus }) {
  const isActive = job.status === 'running' || job.status === 'pending';
  const { data: liveJob } = useGetJobStatusQuery(job.id, {
    pollingInterval: isActive ? 2000 : 0,
    skip: !isActive,
  });
  const [cancelJob] = useCancelJobMutation();
  const current = liveJob || job;

  return (
    <div className="ui-panel p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold truncate" style={{ color: 'var(--ui-text)' }}>
            {current.task_type}
          </span>
          <span className={STATUS_TAGS[current.status] ?? 'ui-tag'}>
            {STATUS_LABELS[current.status] ?? current.status}
          </span>
        </div>
        {isActive && (
          <button
            onClick={() => cancelJob(current.id)}
            className="text-xs ui-t-danger hover:underline"
          >
            Annuler
          </button>
        )}
      </div>

      {current.status === 'running' && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-[var(--ui-radius-sm)] overflow-hidden" style={{ background: 'var(--ui-bg-sunken)' }}>
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${current.progress}%`, background: 'var(--ui-accent)' }}
            />
          </div>
          <span className="text-[11px] ui-num ui-t-muted">{current.progress}%</span>
        </div>
      )}

      {current.progress_message && (
        <p className="text-[11px] ui-t-muted">{current.progress_message}</p>
      )}

      {current.status === 'failed' && current.error_message && (
        <p className="text-[11px] ui-t-danger truncate" title={current.error_message}>
          {current.error_message}
        </p>
      )}

      {current.completed_at && (
        <p className="text-[11px] ui-t-faint ui-num">
          {new Date(current.completed_at).toLocaleString('fr-FR')}
        </p>
      )}
    </div>
  );
}

export default function JobQueue({ datasetId }: { datasetId: string }) {
  const { data, refetch } = useListJobsQuery({ datasetId }, { pollingInterval: 5000 });
  const jobs = data?.jobs || [];

  const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'pending');
  const doneJobs = jobs.filter(j => j.status !== 'running' && j.status !== 'pending').slice(0, 5);

  if (jobs.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold ui-t">
          Tâches {activeJobs.length > 0 && (
            <span className="ui-t-accent ui-num">({activeJobs.length} actif{activeJobs.length > 1 ? 's' : ''})</span>
          )}
        </h3>
        <button onClick={() => refetch()} className="ui-btn ui-btn-ghost text-xs">
          ↻
        </button>
      </div>

      {activeJobs.map(job => <JobProgressBar key={job.id} job={job} />)}
      {doneJobs.map(job => <JobProgressBar key={job.id} job={job} />)}
    </div>
  );
}
