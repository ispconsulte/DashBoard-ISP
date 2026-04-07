
-- Fix clientes: restrict read to admins only (they already have ALL via "Admin full access clientes")
DROP POLICY IF EXISTS "Authenticated read clientes" ON public.clientes;

-- Add UPDATE policy for avatars storage scoped to owning user
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
