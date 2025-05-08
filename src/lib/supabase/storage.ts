import { supabase } from "@/lib/supabase/client";

export const uploadFile = async (file: File, userId: string) => {
  try {
    // Create a unique file name using timestamp and original name
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    const filePath = `documents/${fileName}`;

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from("documents")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    // Get the public URL for the uploaded file
    const {
      data: { publicUrl },
    } = supabase.storage.from("documents").getPublicUrl(filePath);

    return {
      path: filePath,
      url: publicUrl,
      name: file.name,
      type: file.type,
      size: file.size,
    };
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
};

export const deleteFile = async (filePath: string) => {
  try {
    const { error } = await supabase.storage
      .from("documents")
      .remove([filePath]);

    if (error) throw error;
  } catch (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
};
