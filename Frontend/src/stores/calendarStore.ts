import { create } from 'zustand';
import {
  createCalendarEvent as insertCalendarEvent,
  deleteCalendarEvent as removeCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent as persistCalendarEvent,
} from '../db/repositories/calendar.repo';

export type EventType = 'exam' | 'assignment' | 'session' | 'other';

export interface CalendarEvent {
  id: string;
  space_id: string;
  title: string;
  type: EventType;
  event_date: string;
  created_at?: string;
  updated_at?: string;
}

interface CalendarState {
  loadedSpaceId: string | null;
  events: CalendarEvent[];
  loading: boolean;
  fetchEvents: (spaceId: string) => Promise<void>;
  createEvent: (data: Omit<CalendarEvent, 'id'>) => Promise<void>;
  updateEvent: (id: string, spaceId: string, data: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string, spaceId: string) => Promise<void>;
}

let fetchVersion = 0;

export const useCalendarStore = create<CalendarState>((set, get) => ({
  loadedSpaceId: null,
  events: [],
  loading: false,

  fetchEvents: async (spaceId) => {
    const version = ++fetchVersion;
    if (get().loadedSpaceId !== spaceId) set({ events: [], loadedSpaceId: null });
    set({ loading: get().loadedSpaceId !== spaceId });
    try {
      const events = await listCalendarEvents(spaceId);
      if (version === fetchVersion) set({ events, loadedSpaceId: spaceId, loading: false });
    } catch (error) {
      console.error('Could not load local calendar events:', error);
      if (version === fetchVersion) set({ loading: false });
      throw error;
    }
  },

  createEvent: async (data) => {
    await insertCalendarEvent(data);
    await get().fetchEvents(data.space_id);
  },

  updateEvent: async (id, spaceId, data) => {
    await persistCalendarEvent(id, spaceId, data);
    await get().fetchEvents(spaceId);
  },

  deleteEvent: async (id, spaceId) => {
    await removeCalendarEvent(id, spaceId);
    await get().fetchEvents(spaceId);
  },
}));
