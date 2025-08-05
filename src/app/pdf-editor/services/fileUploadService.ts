/**
 * File upload service for Supabase storage integration
 */

import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/AuthStore";

export interface FileUploadResult {
  publicUrl: string;
  filePath: string;
  fileName: string;
  fileObjectId?: string; // UUID from file_objects table
}

export class FileUploadError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = "FileUploadError";
  }
}

/**
 * Create a record in the file_objects table
 */
async function createFileObjectRecord(
  profileId: string,
  bucket: string,
  objectKey: string,
  mimeType: string,
  sizeBytes: number
): Promise<string> {
  const { data, error } = await supabase
    .from("file_objects")
    .insert({
      profile_id: profileId,
      bucket: bucket,
      object_key: objectKey,
      mime_type: mimeType,
      size_bytes: sizeBytes,
    })
    .select("id")
    .single();

  if (error) {
    throw new FileUploadError(
      `Failed to create file_objects record: ${error.message}`,
      error
    );
  }

  if (!data?.id) {
    throw new FileUploadError("Failed to get file_objects record ID");
  }

  return data.id;
}

/**
 * Upload a file to Supabase storage and return its public URL
 */
export async function uploadFileToSupabase(
  file: File,
  folder: string = "documents"
): Promise<FileUploadResult> {
  try {
    // Get current user
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new FileUploadError("User must be authenticated to upload files");
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split(".").pop() || "";
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFileName = `${timestamp}_${sanitizedFileName}`;

    // Create file path: userId/folder/uniqueFileName
    const filePath = `${user.id}/${folder}/${uniqueFileName}`;

    // Upload file to storage
    const { data, error } = await supabase.storage
      .from("project-files") // Using 'project-files' bucket for project-related files
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      throw new FileUploadError(
        `Failed to upload file to storage: ${error.message}`,
        error
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("project-files")
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      throw new FileUploadError("Failed to get public URL for uploaded file");
    }

    // Create record in file_objects table
    let fileObjectId: string | undefined;
    try {
      fileObjectId = await createFileObjectRecord(
        user.id,
        "project-files",
        filePath,
        file.type || "application/octet-stream",
        file.size
      );
    } catch (fileObjectError) {
      // Log the error but don't fail the upload
      console.warn("Failed to create file_objects record:", fileObjectError);
      // Optionally, you could choose to fail the entire upload here
      // by re-throwing the error if file tracking is critical
    }

    return {
      publicUrl: publicUrlData.publicUrl,
      filePath: filePath,
      fileName: uniqueFileName,
      fileObjectId: fileObjectId,
    };
  } catch (error) {
    if (error instanceof FileUploadError) {
      throw error;
    }
    throw new FileUploadError(
      `Unexpected error during file upload: ${error}`,
      error
    );
  }
}

/**
 * Delete a record from the file_objects table
 */
async function deleteFileObjectRecord(fileObjectId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("file_objects")
      .delete()
      .eq("id", fileObjectId);

    if (error) {
      console.error(
        `Failed to delete file_objects record ${fileObjectId}:`,
        error
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      `Unexpected error deleting file_objects record ${fileObjectId}:`,
      error
    );
    return false;
  }
}

/**
 * Delete a file from Supabase storage and its corresponding file_objects record
 */
export async function deleteFileFromSupabase(
  filePath: string,
  fileObjectId?: string
): Promise<boolean> {
  try {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("project-files")
      .remove([filePath]);

    if (storageError) {
      console.error(`Failed to delete file ${filePath}:`, storageError);
      return false;
    }

    // Delete from file_objects table if fileObjectId is provided
    if (fileObjectId) {
      const fileObjectDeleted = await deleteFileObjectRecord(fileObjectId);
      if (!fileObjectDeleted) {
        console.warn(
          `File deleted from storage but failed to delete file_objects record ${fileObjectId}`
        );
      }
    }

    return true;
  } catch (error) {
    console.error(`Unexpected error deleting file ${filePath}:`, error);
    return false;
  }
}

/**
 * Upload a file and get its public URL, with fallback to blob URL for unauthenticated users
 */
export async function uploadFileWithFallback(file: File): Promise<{
  url: string;
  isSupabaseUrl: boolean;
  filePath?: string;
  fileObjectId?: string;
}> {
  try {
    const { user } = useAuthStore.getState();

    if (user) {
      // User is authenticated, upload to Supabase
      const result = await uploadFileToSupabase(file, "documents");
      return {
        url: result.publicUrl,
        isSupabaseUrl: true,
        filePath: result.filePath,
        fileObjectId: result.fileObjectId,
      };
    } else {
      // User not authenticated, use blob URL as fallback
      const blobUrl = URL.createObjectURL(file);
      return {
        url: blobUrl,
        isSupabaseUrl: false,
      };
    }
  } catch (error) {
    console.warn(
      "Failed to upload to Supabase, falling back to blob URL:",
      error
    );
    // Fallback to blob URL if Supabase upload fails
    const blobUrl = URL.createObjectURL(file);
    return {
      url: blobUrl,
      isSupabaseUrl: false,
    };
  }
}

/**
 * Check if a URL is a Supabase storage URL
 */
export function isSupabaseUrl(url: string): boolean {
  return url.includes("supabase.co") && url.includes("/storage/");
}

/**
 * Get all file objects for a specific profile
 */
export async function getFileObjectsByProfile(
  profileId: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("file_objects")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new FileUploadError(
        `Failed to fetch file objects: ${error.message}`,
        error
      );
    }

    return data || [];
  } catch (error) {
    console.error("Error fetching file objects:", error);
    return [];
  }
}

/**
 * Extract file path from Supabase public URL
 */
export function extractFilePathFromUrl(url: string): string | null {
  if (!isSupabaseUrl(url)) {
    return null;
  }

  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    const storageIndex = pathParts.indexOf("storage");
    const objectIndex = pathParts.indexOf("object");

    if (
      storageIndex !== -1 &&
      objectIndex !== -1 &&
      objectIndex > storageIndex
    ) {
      // Extract everything after 'object/public/project-files/'
      const relevantParts = pathParts.slice(objectIndex + 3); // Skip 'object', 'public', 'project-files'
      return relevantParts.join("/");
    }

    return null;
  } catch (error) {
    console.error("Error extracting file path from URL:", error);
    return null;
  }
}
