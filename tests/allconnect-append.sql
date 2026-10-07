BEGIN;
DO $$
DECLARE
 p jsonb; b uuid := gen_random_uuid(); b2 uuid:=gen_random_uuid(); bad uuid:=gen_random_uuid(); r record; before_count bigint; before_hash text; after_hash text; old_date text;
BEGIN
 SELECT to_jsonb(a)-ARRAY['uuid','created_at','updated_at'], a."PERFORMANCE_DATE" INTO p,old_date FROM public.allconnect a LIMIT 1;
 SELECT count(*), md5(string_agg(md5(to_jsonb(a)::text),'' ORDER BY uuid)) INTO before_count,before_hash FROM public.allconnect a;
 INSERT INTO public.allconnect_import_rows(batch_id,row_number,payload) VALUES
 (b,1,p || jsonb_build_object('Job_Install','999999')),
 (b,2,p || jsonb_build_object('PERFORMANCE_DATE','01/01/2099','Month','2099-01','STAFF_ID','')),
 (b,3,p || jsonb_build_object('PERFORMANCE_DATE','01/01/2099','Month','2099-01','STAFF_ID',''));
 SELECT * INTO r FROM public.append_allconnect_new_dates(b,3,'test:'||b::text);
 IF r.inserted_count <> 2 OR r.skipped_count <> 1 THEN RAISE EXCEPTION 'wrong append counts'; END IF;
 IF (SELECT count(*) FROM public.allconnect) <> before_count+2 THEN RAISE EXCEPTION 'lost duplicate multiplicity'; END IF;
 SELECT md5(string_agg(md5(to_jsonb(a)::text),'' ORDER BY uuid)) INTO after_hash FROM public.allconnect a WHERE "PERFORMANCE_DATE" <> '01/01/2099';
 IF before_hash IS DISTINCT FROM after_hash THEN RAISE EXCEPTION 'existing rows changed'; END IF;
 SELECT * INTO r FROM public.append_allconnect_new_dates(b,3,'test:'||b::text);
 IF r.inserted_count <> 2 THEN RAISE EXCEPTION 'lost commit receipt'; END IF;
 INSERT INTO public.allconnect_import_rows(batch_id,row_number,payload) VALUES (b2,1,p||jsonb_build_object('PERFORMANCE_DATE','01/01/2099','Month','2099-01','Job_Install','999'));
 SELECT * INTO r FROM public.append_allconnect_new_dates(b2,1,'test:'||b2::text);
 IF r.inserted_count<>0 OR r.skipped_count<>1 THEN RAISE EXCEPTION 'replay inserted duplicate date'; END IF;
 INSERT INTO public.allconnect_import_rows(batch_id,row_number,payload) VALUES (bad,1,p||jsonb_build_object('PERFORMANCE_DATE','31/02/2099','Month','2099-02'));
 BEGIN
  PERFORM public.append_allconnect_new_dates(bad,1,'test:'||bad::text);
  RAISE EXCEPTION 'invalid calendar day accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  PERFORM public.append_allconnect_new_dates(bad,2,'test:'||bad::text);
  RAISE EXCEPTION 'truncated upload accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
ROLLBACK;
