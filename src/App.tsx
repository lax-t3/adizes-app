/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { Assessment } from "./pages/Assessment";
import { Results } from "./pages/Results";
import { Profile } from "./pages/Profile";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminCohorts } from "./pages/AdminCohorts";
import { AdminCohortDetail } from "./pages/AdminCohortDetail";
import { AdminRespondent } from "./pages/AdminRespondent";
import { AdminUsers } from "./pages/AdminUsers";
import { AdminSettings } from "./pages/AdminSettings";
import { SetPassword } from "./pages/SetPassword";
import { PolicyPage } from "./pages/PolicyPage";
import { Navbar } from "./components/layout/Navbar";
import { Footer } from "./components/layout/Footer";
import { AdminSidebar } from "./components/layout/AdminSidebar";
import { AuthGuard } from "./components/layout/AuthGuard";

function UserLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/assessment" element={<Assessment />} />
          <Route path="/results" element={<Results />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function AdminLayout() {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/dashboard" element={<AdminDashboard />} />
          <Route path="/cohorts" element={<AdminCohorts />} />
          <Route path="/cohorts/:id" element={<AdminCohortDetail />} />
          <Route path="/respondents/:id" element={<AdminRespondent />} />
          <Route path="/users" element={<AdminUsers />} />
          <Route path="/settings" element={<AdminSettings />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/terms" element={<PolicyPage slug="terms" />} />
        <Route path="/privacy" element={<PolicyPage slug="privacy" />} />
        <Route path="/refund" element={<PolicyPage slug="refund" />} />
        <Route path="/admin" element={<Landing />} />
        
        <Route element={<AuthGuard allowedRole="user" />}>
          <Route path="/*" element={<UserLayout />} />
        </Route>
        
        <Route element={<AuthGuard allowedRole="admin" />}>
          <Route path="/admin/*" element={<AdminLayout />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

