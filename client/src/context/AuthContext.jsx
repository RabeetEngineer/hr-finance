import { createContext, useEffect, useMemo, useState } from "react";
import { loginRequest, meRequest } from "@/services/authService";
import api from "@/services/api";

export const AuthContext = createContext(null);

const USER_KEY = "hrf_user";
const TOKEN_KEY = "hrf_token";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem(USER_KEY);
    return cached ? JSON.parse(cached) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common.Authorization;
    }
  }, [token]);

  useEffect(() => {
    const bootstrap = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await meRequest();
        setUser(response.data.data);
        localStorage.setItem(USER_KEY, JSON.stringify(response.data.data));
      } catch (_error) {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setToken("");
        delete api.defaults.headers.common.Authorization;
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [token]);

  const login = async (credentials) => {
    const response = await loginRequest(credentials);
    const { user: authenticatedUser, token: authToken } = response.data.data;
    setUser(authenticatedUser);
    setToken(authToken);
    localStorage.setItem(USER_KEY, JSON.stringify(authenticatedUser));
    localStorage.setItem(TOKEN_KEY, authToken);
    api.defaults.headers.common.Authorization = `Bearer ${authToken}`;
    return authenticatedUser;
  };

  const logout = () => {
    setUser(null);
    setToken("");
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    delete api.defaults.headers.common.Authorization;
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(user && token),
      login,
      logout,
      setUser,
    }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
