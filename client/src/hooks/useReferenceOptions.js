import { useEffect, useState } from "react";
import { wingService } from "@/services/wingService";
import { organizationUnitService } from "@/services/organizationUnitService";
import { designationService } from "@/services/designationService";
import { employeeService } from "@/services/employeeService";
import { seatService } from "@/services/seatService";
import { toSelectOptions } from "@/utils/toOptions";

const labelWithCode = (item) => `${item?.name || item?.fullName || item?.seatTitle || "Item"}${item?.code ? ` (${item.code})` : ""}`;
const labelWithPath = (item) =>
  `${item?.path || item?.name || "Unit"}${item?.code ? ` (${item.code})` : ""}${item?.type ? ` - ${item.type.replaceAll("_", " ")}` : ""}`;

export const useReferenceOptions = ({ includeEmployees = true, includeSeats = true } = {}) => {
  const [wingOptions, setWingOptions] = useState([]);
  const [officeOptions, setOfficeOptions] = useState([]);
  const [designationOptions, setDesignationOptions] = useState([]);
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [seatOptions, setSeatOptions] = useState([]);
  const [allSeatOptions, setAllSeatOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [wingsResponse, unitsResponse, designationsResponse, employeesResponse, seatsResponse] =
          await Promise.all([
            wingService.list({ limit: 500, isActive: "true" }),
            organizationUnitService.list({ limit: 1000, isActive: "true", sort: "path" }),
            designationService.list({ limit: 500, isActive: "true" }),
            includeEmployees
              ? employeeService.list({ limit: 1000, status: "active" })
              : Promise.resolve({ data: { data: [] } }),
            includeSeats ? seatService.list({ limit: 1000, isActive: "true" }) : Promise.resolve({ data: { data: [] } }),
          ]);

        if (!mounted) return;

        setWingOptions(toSelectOptions(wingsResponse.data.data, labelWithCode));
        setOfficeOptions(toSelectOptions(unitsResponse.data.data, labelWithPath));
        setDesignationOptions(toSelectOptions(designationsResponse.data.data, labelWithCode));
        setEmployeeOptions(
          toSelectOptions(employeesResponse.data.data, (item) =>
            `${item?.fullName || "Employee"}${item?.personnelNumber ? ` (${item.personnelNumber})` : ""}`
          )
        );
        const seats = seatsResponse.data.data || [];
        setAllSeatOptions(
          toSelectOptions(seats, (item) => `${item?.seatTitle || "Seat"}${item?.seatCode ? ` (${item.seatCode})` : ""}`)
        );
        setSeatOptions(
          toSelectOptions(
            seats.filter((item) => item?.seatStatus === "vacant"),
            (item) => `${item?.seatTitle || "Seat"}${item?.seatCode ? ` (${item.seatCode})` : ""}`
          )
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [includeEmployees, includeSeats]);

  return {
    loading,
    wingOptions,
    officeOptions,
    designationOptions,
    employeeOptions,
    seatOptions,
    allSeatOptions,
  };
};
