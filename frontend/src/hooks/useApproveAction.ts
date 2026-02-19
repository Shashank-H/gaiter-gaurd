import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import type { PendingAction } from './useApprovalQueue';

/**
 * useApproveAction — approves a pending action with optimistic removal from queue.
 *
 * onMutate: cancels in-flight queries and optimistically removes the card.
 * onError: reverts by invalidating to trigger a refetch.
 * onSettled: always invalidates to ensure server consistency.
 */
export function useApproveAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (actionId: string) => api.approveAction(actionId),

    onMutate: async (actionId: string) => {
      // Cancel any in-flight refetch so it doesn't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['approvals', 'pending'] });

      // Snapshot current data for rollback
      const previous = queryClient.getQueryData<PendingAction[]>(['approvals', 'pending']);

      // Optimistically remove the approved card
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
