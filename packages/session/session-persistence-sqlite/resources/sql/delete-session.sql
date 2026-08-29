-- Remove one session: the sessions row cascade-deletes its events.
DELETE FROM sessions WHERE id = ?;
