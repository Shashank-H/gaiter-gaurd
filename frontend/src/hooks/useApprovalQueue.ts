import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/endpoints';

/**
 * PendingAction — matches the backend approval queue entry shape
 */
export interface PendingAction {
  action_id: string;
  agent_name: string;
  service_id: number;
  method: string;
  target_url: string;
  intent: string;
  risk_score: number;
  risk_explanation: string;
  request_headers: Record<string, string>;
  request_body: string | null;
  created_at: string;
}

/**
 * useApprovalQueue — polls pending approvals every 5 seconds.
 * Pauses polling when the browser tab is hidden.
 */
export function useApprovalQueue() {
  return useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => api.listPendingApprovals(),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    select: (data) => data.approvals as PendingAction[],
  });
}
