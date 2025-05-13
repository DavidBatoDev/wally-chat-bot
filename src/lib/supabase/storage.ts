import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Database } from "@/types/supabase";

interface UploadedFile {
  id: string;
  path: string;
  url: string;
  name: string;
  type: string;
  size: number;
}

/**
 * Uploads a file to Supabase Storage and creates corresponding database entries
 */
export async function uploadFile(
  file: File,
  userId: string
): Promise<UploadedFile> {
  const supabase = createClientComponentClient<Database>();

  // 1. Generate a unique path for the file
  const timestamp = Date.now();
  const fileExt = file.name.split(".").pop();
  const fileName = `${timestamp}-${Math.random()
    .toString(36)
    .substring(2)}.${fileExt}`;
  const filePath = `documents/${userId}/${fileName}`;

  // 2. Upload to Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("documents")
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  // 3. Get the public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("documents").getPublicUrl(filePath);

  // 4. Create file_objects entry
  const { data: fileObject, error: fileError } = await supabase
    .from("file_objects")
    .insert({
      profile_id: userId,
      bucket: "documents",
      object_key: filePath,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select()
    .single();

  if (fileError) throw fileError;

  // 5. Create initial doc_versions entry
  const { error: versionError } = await supabase.from("doc_versions").insert({
    base_file_id: fileObject.id,
    rev: 1,
    placeholder_json: {}, // Empty for now, can be populated later
    llm_log: {}, // Empty for now, can be populated later
  });

  if (versionError) throw versionError;

  return {
    id: fileObject.id,
    path: filePath,
    url: publicUrl,
    name: file.name,
    type: file.type,
    size: file.size,
  };
}

/**
 * Gets a signed URL for a file
 */
export async function getSignedUrl(path: string): Promise<string> {
  const supabase = createClientComponentClient<Database>();
  const { data } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, 3600); // 1 hour expiry
  return data?.signedUrl || "";
}

/**
 * Gets the latest version of a document
 */
export async function getLatestDocVersion(fileId: string) {
  const supabase = createClientComponentClient<Database>();
  const { data, error } = await supabase
    .from("v_conversation_latest_doc")
    .select("*")
    .eq("base_file_id", fileId)
    .single();

  if (error) throw error;
  return data;
}
