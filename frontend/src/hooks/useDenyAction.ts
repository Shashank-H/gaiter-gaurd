import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import type { PendingAction } from './useApprovalQueue';

/**
 * useDenyAction — denies a pending action with optimistic removal from queue.
 *
 * Same optimistic pattern as useApproveAction — card is removed immediately
 * from the UI, reverted on error, and server state confirmed on settled.
 */
export function useDenyAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (actionId: string) => api.denyAction(actionId),

    onMutate: async (actionId: string) => {
      // Cancel any in-flight refetch so it doesn't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['approvals', 'pending'] });

      // Snapshot current data for rollback
      const previous = queryClient.getQueryData<PendingAction[]>(['approvals', 'pending']);

      // Optimistically remove the denied card
      queryClient.setQueryData<PendingAction[]>(['approvals', 'pending'], (old) =>
        old ? old.filter((a) => a.action_id !== actionId) : old
      );

      return { previous };
    },

    onError: (_err, _actionId, context) => {
      // Revert optimistic update on failure
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['approvals', 'pending'], context.previous);
      } else {
        queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] });
      }
    },

    onSettled: () => {
      // Ensure server state is in sync
      queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] });
    },
  });
}
