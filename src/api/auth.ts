import axios from "axios";
import { apiClient } from "./client";
import type { AuthResponse } from "@/types/api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", { email, password });
  return data;
}

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/register", { name, email, password });
  return data;
}

/**
 * Set password using the raw invite/recovery token from the URL hash.
 * Uses raw axios (not apiClient) because the invite token is not stored
 * in Zustand and apiClient's 401 interceptor would redirect to login.
 */
export async function setPassword(inviteToken: string, password: string): Promise<void> {
  await axios.post(
    `${API_URL}/auth/set-password`,
    { password },
    { headers: { Authorization: `Bearer ${inviteToken}` } }
  );
}

/**
 * Save name + email after invite acceptance.
 * Named saveInviteProfile (not updateProfile) to avoid collision with
 * the identically-named export in src/api/profile.ts which uses apiClient.
 * Non-fatal — callers catch and ignore errors from this call.
 */
export async function saveInviteProfile(
  inviteToken: string,
  name: string,
  email: string
): Promise<void> {
  await axios.put(
    `${API_URL}/auth/profile`,
    { name, email },
    { headers: { Authorization: `Bearer ${inviteToken}` } }
  );
}
