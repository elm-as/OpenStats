import { useState, useEffect } from 'react';
import { useListJobsQuery, useGetJobStatusQuery, useCancelJobMutation } from '../store/api';
import type { JobStatus } from '../types';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

const statusLabels: Record<string, string> = {
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
    <div className="border rounded-lg p-3 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{current.task_type}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[current.status]}`}>
            {statusLabels[current.status]}
          </span>
        </div>
        {isActive && (
          <button
            onClick={() => cancelJob(current.id)}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Annuler
          </button>
        )}
      </div>

      {current.status === 'running' && (
        <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${current.progress}%` }}
          />
        </div>
      )}

      {current.progress_message && (
        <p className="text-xs text-gray-500">{current.progress_message}</p>
      )}

      {current.status === 'failed' && current.error_message && (
        <p className="text-xs text-red-500 mt-1 truncate" title={current.error_message}>
          {current.error_message}
        </p>
      )}

      {current.completed_at && (
        <p className="text-xs text-gray-400 mt-1">
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
        <h3 className="text-sm font-semibold text-gray-700">
          Jobs {activeJobs.length > 0 && (
            <span className="text-blue-600">({activeJobs.length} actif{activeJobs.length > 1 ? 's' : ''})</span>
          )}
        </h3>
        <button onClick={() => refetch()} className="text-xs text-gray-400 hover:text-gray-600">
          ↻
        </button>
      </div>

      {activeJobs.map(job => (
        <JobProgressBar key={job.id} job={job} />
      ))}

      {doneJobs.length > 0 && activeJobs.length > 0 && (
        <hr className="border-gray-200" />
      )}

      {doneJobs.map(job => (
        <JobProgressBar key={job.id} job={job} />
      ))}
    </div>
  );
}
