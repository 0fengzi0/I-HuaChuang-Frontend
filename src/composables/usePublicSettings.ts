import { useQuery } from '@tanstack/vue-query'
import { apiRequest, type PublicSettings } from '../api/client'

export function usePublicSettings() {
  return useQuery({
    queryKey: ['public-settings'],
    queryFn: () => apiRequest<PublicSettings>('/api/settings/public'),
  })
}
