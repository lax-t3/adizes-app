import { apiClient } from "./client";

export type UserProfile = {
  user_id: string;
  email: string;
  name: string;
  phone: string | null;
};

export async function getProfile(): Promise<UserProfile> {
  const { data } = await apiClient.get("/auth/profile");
  return data;
}

export async function updateProfile(payload: {
  name: string;
  email: string;
  phone?: string | null;
}): Promise<UserProfile> {
  const { data } = await apiClient.put("/auth/profile", payload);
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.put("/auth/password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}
