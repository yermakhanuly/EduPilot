import { create } from 'zustand'

export const useAssistantStore = create((set) => ({
  activeConversationId: null,
  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),
}))