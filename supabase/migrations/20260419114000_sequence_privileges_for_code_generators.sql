begin;

grant usage, select, update on sequence public.customer_code_seq to authenticated;
grant usage, select, update on sequence public.ticket_code_seq to authenticated;

grant usage, select, update on sequence public.customer_code_seq to service_role;
grant usage, select, update on sequence public.ticket_code_seq to service_role;

commit;
