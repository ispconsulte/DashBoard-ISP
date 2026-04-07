-- Add INSERT policy for avatars bucket (allows any authenticated or anon upload, bucket is already public)
CREATE POLICY "Anyone can upload avatars"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'avatars');

-- Also add UPDATE policy for upsert to work
-- (existing update policy requires auth.uid match which won't work with external auth)
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Anyone can update avatars"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'avatars');
