begin;

-- Lịch chạy automation hàng ngày lúc 09:00 (Asia/Ho_Chi_Minh) = 02:00 UTC.
-- Thay [project-ref] và [service-role-key] trước khi chạy trên từng môi trường.
select cron.unschedule('run-daily-automation')
where exists (
  select 1
  from cron.job
  where jobname = 'run-daily-automation'
);

select cron.schedule(
  'run-daily-automation',
  '0 2 * * *',
  $$select net.http_post(
      url := 'https://pxbignjlvdqvecflzfda.supabase.co/functions/v1/run-automation',
      headers := jsonb_build_object(
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4YmlnbmpsdmRxdmVjZmx6ZmRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjMwOTAxNCwiZXhwIjoyMDkxODg1MDE0fQ.htVwmi-2OQWDG-OEaihH0CTJJbvqO2GaeGxFNFHnkxk',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )$$
);

commit;
