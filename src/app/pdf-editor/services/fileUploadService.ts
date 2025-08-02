/**
 * File upload service for Supabase storage integration
 */

import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/AuthStore";

export interface FileUploadResult {
  publicUrl: string;
  filePath: string;
  fileName: string;
}

export class FileUploadError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = "FileUploadError";
  }
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

    return {
      publicUrl: publicUrlData.publicUrl,
      filePath: filePath,
      fileName: uniqueFileName,
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
 * Delete a file from Supabase storage
 */
export async function deleteFileFromSupabase(
  filePath: string
): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from("project-files")
      .remove([filePath]);

    if (error) {
      console.error(`Failed to delete file ${filePath}:`, error);
      return false;
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
