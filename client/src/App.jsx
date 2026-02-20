import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/Layout/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import ApartmentList from "./components/apartments/ApartmentList";
import ApiSettings from "./pages/ApiSettings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";

export default function App() {
	return (
		<AuthProvider>
			<Routes>
				<Route path="/login" element={<Login />} />
				<Route path="/register" element={<Register />} />
				<Route
					path='/'
					element={
						<ProtectedRoute>
							<DashboardLayout />
						</ProtectedRoute>
					}
				>
					<Route
						index
						element={<Dashboard />}
					/>
					<Route
						path='apartments'
						element={<ApartmentList />}
					/>
					<Route path="api-settings" element={<ApiSettings />} />
					<Route path="profile" element={<Profile />} />
				</Route>
				<Route
					path='*'
					element={
						<Navigate
							to='/'
							replace
						/>
					}
				/>
			</Routes>
		</AuthProvider>
	);
}
