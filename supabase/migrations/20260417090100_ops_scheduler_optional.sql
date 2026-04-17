-- Optional ops migration: schedule run-automation via pg_cron + pg_net.
-- Không bắt buộc cho core bootstrap.
--
-- Cách dùng:
-- 1) Thay __PROJECT_REF__ bằng project ref thật.
-- 2) Thay __SERVICE_ROLE_JWT__ bằng service role JWT tương ứng môi trường.
-- 3) Chạy lại file này mỗi khi cần cập nhật cron schedule.

begin;

select cron.unschedule('run-daily-automation')
where exists (
  select 1
  from cron.job
  where jobname = 'run-daily-automation'
);

-- 09:00 Asia/Ho_Chi_Minh = 02:00 UTC
select cron.schedule(
  'run-daily-automation',
  '0 2 * * *',
  $$select net.http_post(
      url := 'https://oqkqncodmvvndofkfmux.supabase.co/functions/v1/run-automation',
      headers := jsonb_build_object(
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xa3FuY29kbXZ2bmRvZmtmbXV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQwNTU0NCwiZXhwIjoyMDkxOTgxNTQ0fQ.cDAPwbQsTEtU6MsBs4co-3ZRTUucEUq-Pj0Oy4CsogY',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )$$
);

commit;
