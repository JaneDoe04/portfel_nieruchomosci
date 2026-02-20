import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

	function persistUser(userData) {
	const payload = {
		_id: userData._id,
		email: userData.email,
		name: userData.name,
		role: userData.role,
	};
	localStorage.setItem("user", JSON.stringify(payload));
	return payload;
}

export function AuthProvider({ children }) {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const token = localStorage.getItem("token");
		if (!token) {
			setLoading(false);
			return;
		}
		api
			.get("/auth/me")
			.then(({ data }) => {
				const payload = persistUser(data);
				setUser(payload);
			})
			.catch(() => {
				localStorage.removeItem("token");
				localStorage.removeItem("user");
				setUser(null);
			})
			.finally(() => setLoading(false));
	}, []);

	const login = async (email, password) => {
		const { data } = await api.post("/auth/login", { email, password });
		localStorage.setItem("token", data.token);
		const payload = persistUser(data);
		setUser(payload);
		return data;
	};

	const register = async (email, password, name) => {
		const { data } = await api.post("/auth/register", { email, password, name });
		localStorage.setItem("token", data.token);
		const payload = persistUser(data);
		setUser(payload);
		return data;
	};

	const updateUser = (userData) => {
		const payload = persistUser(userData);
		setUser(payload);
	};

	const logout = () => {
		localStorage.removeItem("token");
		localStorage.removeItem("user");
		setUser(null);
	};

	return (
		<AuthContext.Provider value={{ user, loading, login, register, updateUser, logout }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}
