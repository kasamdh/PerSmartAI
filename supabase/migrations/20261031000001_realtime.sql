-- Live visit updates for owners (and sitters on other devices).
--
-- Realtime evaluates each subscriber's SELECT policies before delivering a change,
-- so owners only receive changes for their own visits. Note: Realtime cannot
-- filter DELETE events by column, so clients should refetch rather than rely on
-- delete payloads.

alter publication supabase_realtime add table public.visits, public.care_events, public.media;
