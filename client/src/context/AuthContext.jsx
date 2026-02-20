import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { clearAuth, setToken, setUser as persistUserToStorage, getToken } from "../utils/authStorage";

const AuthContext = createContext(null);

function userPayload(data) {
	return {
		_id: data._id,
		email: data.email,
		name: data.name,
		role: data.role,
	};
}

export function AuthProvider({ children }) {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);
	const navigate = useNavigate();

	// Przy starcie: jeśli jest token, zweryfikuj przez /auth/me
	useEffect(() => {
		const token = getToken();
		if (!token) {
			setLoading(false);
			return;
		}
		api
			.get("/auth/me")
			.then(({ data }) => {
				const payload = userPayload(data);
				persistUserToStorage(payload);
				setUser(payload);
			})
			.catch(() => {
				clearAuth();
				setUser(null);
			})
			.finally(() => setLoading(false));
	}, []);

	// Gdy użytkownik wyloguje się w innej karcie – ta karta też ma się wylogować
	useEffect(() => {
		const onStorage = (e) => {
			if (e.key === "token" && e.newValue === null) {
				setUser(null);
				navigate("/login", { replace: true });
			}
		};
		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
	}, [navigate]);

	const login = async (email, password) => {
		const { data } = await api.post("/auth/login", { email, password });
		setToken(data.token);
		const payload = userPayload(data);
		persistUserToStorage(payload);
		setUser(payload);
		return data;
	};

	const register = async (email, password, name) => {
		const { data } = await api.post("/auth/register", { email, password, name });
		setToken(data.token);
		const payload = userPayload(data);
		persistUserToStorage(payload);
		setUser(payload);
		return data;
	};

	const updateUser = (userData) => {
		const payload = userPayload(userData);
		persistUserToStorage(payload);
		setUser(payload);
	};

	const logout = () => {
		clearAuth();
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
