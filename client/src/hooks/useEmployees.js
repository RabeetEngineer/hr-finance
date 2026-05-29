import { useEffect, useState } from "react";
import { employeeService } from "@/services/employeeService";

export const useEmployees = (params = {}) => {
  const [employees, setEmployees] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEmployees = async (query = params) => {
    setLoading(true);
    setError(null);
    try {
      const response = await employeeService.list(query);
      setEmployees(response.data.data || []);
      setMeta(response.data.meta || { page: 1, limit: 20, total: 0, pages: 1 });
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to fetch employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  return {
    employees,
    meta,
    loading,
    error,
    refresh: () => fetchEmployees(params),
    setEmployees,
    setMeta,
  };
};

