-- ============================================================================
-- Run this AFTER creating a Storage bucket named "branding" from the
-- Supabase Dashboard (Storage → New bucket → name it "branding" → check
-- "Public bucket"). This adds a policy so only admins can upload/replace
-- files in it (public bucket already allows anyone to *read*).
-- ============================================================================

drop policy if exists "branding_admin_write" on storage.objects;
create policy "branding_admin_write" on storage.objects
  for all
  using (bucket_id = 'branding' and public.is_admin())
  with check (bucket_id = 'branding' and public.is_admin());
