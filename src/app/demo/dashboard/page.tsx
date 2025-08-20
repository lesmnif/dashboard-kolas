"use client";

import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface DashboardData {
  totalCostThisMonth: number;
  costPerGram: number;
  activeBatches: number;
  nextHarvestDate: string | null;
  totalRooms: number;
  activeRooms: number;
  costBreakdown: any[];
  monthlyCosts: any[];
  roomUtilization: any[];
  categoryTrends: any[];
}

type TimePeriod = "1M" | "3M" | "6M" | "1Y" | "ALL";

export default function Dashboard() {
  const supabase = createClient();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("1M"); // Default to last month
  const [customDateRange, setCustomDateRange] = useState({
    startDate: "",
    endDate: "",
  });
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalCostThisMonth: 0,
    costPerGram: 0,
    activeBatches: 0,
    nextHarvestDate: null,
    totalRooms: 0,
    activeRooms: 0,
    costBreakdown: [],
    monthlyCosts: [],
    roomUtilization: [],
    categoryTrends: [],
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [timePeriod, useCustomRange, customDateRange]); // Reload when time period or custom range changes

  const getDateRange = (period: TimePeriod) => {
    if (
      useCustomRange &&
      customDateRange.startDate &&
      customDateRange.endDate
    ) {
      return {
        startDate: customDateRange.startDate,
        endDate: customDateRange.endDate,
      };
    }

    const now = new Date();
    const startDate = new Date();

    switch (period) {
      case "1M":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "3M":
        startDate.setMonth(now.getMonth() - 3);
        break;
      case "6M":
        startDate.setMonth(now.getMonth() - 6);
        break;
      case "1Y":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case "ALL":
        // Limit "ALL" to last 5 years to prevent too many intervals
        startDate.setFullYear(now.getFullYear() - 5);
        break;
    }

    return {
      startDate: startDate.toISOString().split("T")[0],
      endDate: now.toISOString().split("T")[0],
    };
  };

  const loadDashboardData = async () => {
    try {
      // Set refreshing state if this is not the initial load
      if (!loading) {
        setIsRefreshing(true);
      }

      console.log("Loading dashboard data for period:", timePeriod);
      const { startDate, endDate } = getDateRange(timePeriod);

      // Get cost entries for the selected time period
      const { data: costEntries, error: costError } = await supabase
        .from("cost_entries")
        .select("amount, date")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (costError) {
        console.error("Error loading cost entries:", costError);
      }

      // Debug: Check what date range all cost entries cover
      const { data: allCostEntries, error: allCostError } = await supabase
        .from("cost_entries")
        .select("amount, date")
        .order("date", { ascending: false });

      if (allCostError) {
        console.error("Error loading all cost entries:", allCostError);
      }

      console.log("Data range debug:", {
        selectedRange: { startDate, endDate },
        selectedPeriodData: costEntries?.length || 0,
        allDataCount: allCostEntries?.length || 0,
        oldestEntry: allCostEntries?.[allCostEntries.length - 1]?.date,
        newestEntry: allCostEntries?.[0]?.date,
        sampleEntries: allCostEntries?.slice(0, 3),
      });

      // Get active batches
      const { data: batches, error: batchesError } = await supabase
        .from("batches")
        .select("status, expected_harvest, batch_code")
        .eq("status", "active");

      if (batchesError) {
        console.error("Error loading batches:", batchesError);
      }

      // Get rooms data
      const { data: rooms, error: roomsError } = await supabase
        .from("rooms")
        .select("status, name");

      if (roomsError) {
        console.error("Error loading rooms:", roomsError);
      }

      // Calculate dashboard metrics
      const totalCostThisMonth =
        costEntries?.reduce(
          (sum, entry) => sum + parseFloat(entry.amount),
          0
        ) || 0;
      const activeBatches = batches?.length || 0;
      const totalRooms = rooms?.length || 0;
      const activeRooms =
        rooms?.filter((room) => room.status === "active").length || 0;

      // Calculate cost per gram (simplified calculation)
      const costPerGram =
        activeBatches > 0 ? totalCostThisMonth / (activeBatches * 50) : 0; // Assuming 50g per batch for now

      // Find next harvest date
      const nextHarvest = batches
        ?.filter((batch) => batch.expected_harvest)
        .sort(
          (a, b) =>
            new Date(a.expected_harvest).getTime() -
            new Date(b.expected_harvest).getTime()
        )[0];

      console.log("Dashboard data calculated:", {
        totalCostThisMonth,
        activeBatches,
        totalRooms,
        activeRooms,
        costEntriesCount: costEntries?.length || 0,
        batchesCount: batches?.length || 0,
        timePeriod,
        dateRange: { startDate, endDate },
        costEntries: costEntries?.slice(0, 5), // Show first 5 entries for debugging
        allCostEntries: costEntries, // Show all entries for debugging
      });

      // Calculate chart data
      const costBreakdown = await calculateCostBreakdown(startDate, endDate);
      const monthlyCosts = await calculateMonthlyCosts(startDate, endDate);
      const roomUtilization = await calculateRoomUtilization();
      const categoryTrends = await calculateCategoryTrends(startDate, endDate);

      setDashboardData({
        totalCostThisMonth,
        costPerGram,
        activeBatches,
        nextHarvestDate: nextHarvest?.expected_harvest || null,
        totalRooms,
        activeRooms,
        costBreakdown,
        monthlyCosts,
        roomUtilization,
        categoryTrends,
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const calculateCostBreakdown = async (startDate: string, endDate: string) => {
    try {
      const { data, error } = await supabase
        .from("cost_entries")
        .select("category, amount")
        .gte("date", startDate)
        .lte("date", endDate);

      if (error) {
        console.error("Error loading cost breakdown:", error);
        return [];
      }

      console.log("Cost breakdown raw data:", data);

      // Group by category and sum amounts
      const breakdown =
        data?.reduce((acc, entry) => {
          const category = entry.category;
          acc[category] = (acc[category] || 0) + parseFloat(entry.amount);
          return acc;
        }, {} as Record<string, number>) || {};

      console.log("Cost breakdown processed:", breakdown);

      const result = Object.entries(breakdown).map(([name, value]) => ({
        name,
        value,
      }));

      console.log("Cost breakdown final result:", result);

      // If no real data exists, return sample data for demonstration
      if (result.length === 0) {
        console.log(
          "No real data found, generating sample data for cost breakdown"
        );
        return [
          { name: "Utilities", value: 15000 },
          { name: "Labor", value: 25000 },
          { name: "Supplies", value: 8000 },
          { name: "Equipment", value: 12000 },
          { name: "Other", value: 5000 },
        ];
      }

      return result;
    } catch (error) {
      console.error("Error calculating cost breakdown:", error);
      return [];
    }
  };

  const calculateMonthlyCosts = async (startDate: string, endDate: string) => {
    try {
      const { data, error } = await supabase
        .from("cost_entries")
        .select("amount, date")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });

      if (error) {
        console.error("Error loading monthly costs:", error);
        return [];
      }

      console.log("Monthly costs raw data:", data);

      // Calculate the number of days in the range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Determine interval size based on date range
      let intervalDays = 5; // Default 5-day intervals
      if (daysDiff <= 30) {
        intervalDays = 5; // 5-day intervals for up to 30 days
      } else if (daysDiff <= 90) {
        intervalDays = 7; // Weekly intervals for up to 90 days
      } else if (daysDiff <= 365) {
        intervalDays = 30; // Monthly intervals for up to 1 year
      } else {
        intervalDays = 90; // Quarterly intervals for longer periods
      }

      // Create intervals based on the date range
      const intervals = [];
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);

      // Safety check: limit to maximum 24 intervals to prevent performance issues
      const maxIntervals = 24;
      let intervalCount = 0;

      for (
        let currentDate = new Date(startDateObj);
        currentDate <= endDateObj && intervalCount < maxIntervals;
        currentDate.setDate(currentDate.getDate() + intervalDays)
      ) {
        const intervalStart = new Date(currentDate);
        const intervalEnd = new Date(currentDate);
        intervalEnd.setDate(intervalEnd.getDate() + intervalDays - 1);

        // Don't exceed the end date
        if (intervalEnd > endDateObj) {
          intervalEnd.setTime(endDateObj.getTime());
        }

        intervals.push({
          start: intervalStart.toISOString().split("T")[0],
          end: intervalEnd.toISOString().split("T")[0],
          label: intervalStart.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
        });

        intervalCount++;
      }

      // Group data by intervals
      const intervalData = intervals.map((interval) => {
        const intervalCosts =
          data?.filter((entry) => {
            const entryDate = entry.date;
            return entryDate >= interval.start && entryDate <= interval.end;
          }) || [];

        const totalCost = intervalCosts.reduce(
          (sum, entry) => sum + parseFloat(entry.amount),
          0
        );

        return {
          period: interval.label,
          cost: totalCost,
        };
      });

      console.log("Monthly costs final result:", intervalData);

      // If no real data exists, return sample data for demonstration
      if (intervalData.every((item) => item.cost === 0)) {
        console.log(
          "No real data found, generating sample data for monthly costs"
        );
        return intervals.map((interval, index) => ({
          period: interval.label,
          cost: Math.floor(Math.random() * 50000) + 10000, // Random cost between 10k-60k
        }));
      }

      return intervalData;
    } catch (error) {
      console.error("Error calculating monthly costs:", error);
      return [];
    }
  };

  const calculateRoomUtilization = async () => {
    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("name, status");

      if (error) {
        console.error("Error loading room utilization:", error);
        return [];
      }

      return (
        data?.map((room) => ({
          name: room.name,
          active: room.status === "active" ? 1 : 0,
          inactive: room.status === "inactive" ? 1 : 0,
          archived: room.status === "archived" ? 1 : 0,
        })) || []
      );
    } catch (error) {
      console.error("Error calculating room utilization:", error);
      return [];
    }
  };

  const calculateCategoryTrends = async (
    startDate: string,
    endDate: string
  ) => {
    try {
      const { data, error } = await supabase
        .from("cost_entries")
        .select("category, amount, date")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });

      if (error) {
        console.error("Error loading category trends:", error);
        return [];
      }

      console.log("Category trends raw data:", data);
      console.log("Available categories:", [
        ...new Set(data?.map((entry) => entry.category) || []),
      ]);

      // Define category mapping from existing categories to target categories
      const categoryMapping: Record<string, string> = {
        Clones: "Cost of Goods Sold",
        "Nutrients & Coco": "Cost of Goods Sold",
        Testing: "Cost of Goods Sold",
        Utilities: "Expenses",
        Labor: "Expenses",
        Trimming: "Expenses",
        Supplies: "Expenses",
        Security: "Expenses",
        Equipment: "Other Expenses",
        Insurance: "Other Expenses",
        Taxes: "Other Expenses",
        Rent: "Other Expenses",
        Other: "Other Expenses",
      };

      // Calculate the number of days in the range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Determine interval size based on date range
      let intervalDays = 5; // Default 5-day intervals
      if (daysDiff <= 30) {
        intervalDays = 5; // 5-day intervals for up to 30 days
      } else if (daysDiff <= 90) {
        intervalDays = 7; // Weekly intervals for up to 90 days
      } else if (daysDiff <= 365) {
        intervalDays = 30; // Monthly intervals for up to 1 year
      } else {
        intervalDays = 90; // Quarterly intervals for longer periods
      }

      // Create intervals based on the date range
      const intervals = [];
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);

      // Safety check: limit to maximum 24 intervals to prevent performance issues
      const maxIntervals = 24;
      let intervalCount = 0;

      for (
        let currentDate = new Date(startDateObj);
        currentDate <= endDateObj && intervalCount < maxIntervals;
        currentDate.setDate(currentDate.getDate() + intervalDays)
      ) {
        const intervalStart = new Date(currentDate);
        const intervalEnd = new Date(currentDate);
        intervalEnd.setDate(intervalEnd.getDate() + intervalDays - 1);

        // Don't exceed the end date
        if (intervalEnd > endDateObj) {
          intervalEnd.setTime(endDateObj.getTime());
        }

        intervals.push({
          start: intervalStart.toISOString().split("T")[0],
          end: intervalEnd.toISOString().split("T")[0],
          label: intervalStart.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
        });
      }

      // Group by mapped category and intervals
      const trends = intervals.map((interval) => {
        const intervalData =
          data?.filter((entry) => {
            const entryDate = entry.date;
            return entryDate >= interval.start && entryDate <= interval.end;
          }) || [];

        const intervalTrends = intervalData.reduce((acc, entry) => {
          const mappedCategory =
            categoryMapping[entry.category] || "Other Expenses";
          acc[mappedCategory] =
            (acc[mappedCategory] || 0) + parseFloat(entry.amount);
          return acc;
        }, {} as Record<string, number>);

        return {
          period: interval.label,
          "Cost of Goods Sold": intervalTrends["Cost of Goods Sold"] || 0,
          Expenses: intervalTrends["Expenses"] || 0,
          "Other Expenses": intervalTrends["Other Expenses"] || 0,
          "Net Income":
            (intervalTrends["Cost of Goods Sold"] || 0) +
            (intervalTrends["Expenses"] || 0) +
            (intervalTrends["Other Expenses"] || 0) * 0.15, // 15% of total expenses as "profit"
        };
      });

      console.log("Category trends final result:", trends);

      // If no real data exists, return sample data for demonstration
      if (
        trends.every(
          (item) =>
            item["Cost of Goods Sold"] === 0 &&
            item["Expenses"] === 0 &&
            item["Other Expenses"] === 0
        )
      ) {
        console.log(
          "No real data found, generating sample data for category trends"
        );
        return intervals.map((interval, index) => {
          const costOfGoodsSold = Math.floor(Math.random() * 20000) + 10000;
          const expenses = Math.floor(Math.random() * 15000) + 8000;
          const otherExpenses = Math.floor(Math.random() * 8000) + 4000;
          const netIncome = Math.floor(
            (costOfGoodsSold + expenses + otherExpenses) * 0.15
          );

          return {
            period: interval.label,
            "Cost of Goods Sold": costOfGoodsSold,
            Expenses: expenses,
            "Other Expenses": otherExpenses,
            "Net Income": netIncome,
          };
        });
      }

      return trends;
    } catch (error) {
      console.error("Error calculating category trends:", error);
      return [];
    }
  };

  const getTimePeriodLabel = (period: TimePeriod) => {
    switch (period) {
      case "1M":
        return "Last Month";
      case "3M":
        return "Last 3 Months";
      case "6M":
        return "Last 6 Months";
      case "1Y":
        return "Last Year";
      case "ALL":
        return "All Time";
      default:
        return "Unknown Period";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-6">
              {/* Logo and Brand */}
              <div className="flex items-center space-x-3">
                <img
                  src="/HARVEST_GRID.png"
                  alt="Harvest Grid Logo"
                  className="h-14 w-auto"
                />
                <div className="flex flex-col">
                  <h1 className="text-xl font-bold text-gray-900">
                    Harvest Grid
                  </h1>
                  <div className="flex items-center space-x-2">
                    <p className="text-xs text-gray-500">
                      Cultivation Management System
                    </p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Dashboard
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <nav className="flex space-x-4">
                <Link
                  href="/demo/dashboard"
                  className="text-gray-900 hover:text-green-600 px-3 py-2 text-sm font-medium border-b-2 border-green-600"
                >
                  Dashboard
                </Link>
                <Link
                  href="/demo/cost-entry"
                  className="text-gray-500 hover:text-green-600 px-3 py-2 text-sm font-medium hover:border-b-2 hover:border-green-600"
                >
                  Cost Entry
                </Link>
                <Link
                  href="/demo/facility"
                  className="text-gray-500 hover:text-green-600 px-3 py-2 text-sm font-medium hover:border-b-2 hover:border-green-600"
                >
                  Facility
                </Link>
                <Link
                  href="/demo/batches"
                  className="text-gray-500 hover:text-green-600 px-3 py-2 text-sm font-medium hover:border-b-2 hover:border-green-600"
                >
                  Batches
                </Link>
              </nav>
              <div className="flex items-center space-x-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-3 py-2 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Go to Production Mode
                </Link>
                <div className="flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-md">
                  <svg
                    className="w-4 h-4 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">
                    Admin
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Time Period Filter */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              Dashboard Overview
            </h2>
            <div className="flex items-center space-x-4">
              {/* Preset Periods */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Time Period:</span>
                <div className="flex bg-white border border-gray-200 rounded-lg shadow-sm">
                  {(["1M", "3M", "6M", "1Y", "ALL"] as TimePeriod[]).map(
                    (period) => (
                      <button
                        key={period}
                        onClick={() => {
                          setTimePeriod(period);
                          setUseCustomRange(false);
                        }}
                        className={`px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                          timePeriod === period && !useCustomRange
                            ? "bg-green-600 text-white"
                            : "text-gray-600 hover:text-green-600 hover:bg-gray-50"
                        } ${period === "1M" ? "rounded-l-lg" : ""} ${
                          period === "ALL" ? "rounded-r-lg" : ""
                        }`}
                      >
                        {period}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Custom Date Range Toggle */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setUseCustomRange(!useCustomRange)}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    useCustomRange
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Custom Range
                </button>
              </div>
            </div>
          </div>

          {/* Custom Date Range Inputs */}
          {useCustomRange && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700">
                  Select Date Range
                </h4>
                <button
                  onClick={() => {
                    const today = new Date();
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(today.getDate() - 30);
                    setCustomDateRange({
                      startDate: thirtyDaysAgo.toISOString().split("T")[0],
                      endDate: today.toISOString().split("T")[0],
                    });
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Last 30 Days
                </button>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <label
                    htmlFor="start-date"
                    className="text-sm font-medium text-gray-700"
                  >
                    From:
                  </label>
                  <input
                    type="date"
                    id="start-date"
                    value={customDateRange.startDate}
                    onChange={(e) =>
                      setCustomDateRange({
                        ...customDateRange,
                        startDate: e.target.value,
                      })
                    }
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <label
                    htmlFor="end-date"
                    className="text-sm font-medium text-gray-700"
                  >
                    To:
                  </label>
                  <input
                    type="date"
                    id="end-date"
                    value={customDateRange.endDate}
                    onChange={(e) =>
                      setCustomDateRange({
                        ...customDateRange,
                        endDate: e.target.value,
                      })
                    }
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500 mt-1">
            Showing data for:{" "}
            {useCustomRange
              ? `${customDateRange.startDate} to ${customDateRange.endDate}`
              : getTimePeriodLabel(timePeriod)}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Cost This Month */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Total Cost (
                  {useCustomRange
                    ? `${customDateRange.startDate} to ${customDateRange.endDate}`
                    : getTimePeriodLabel(timePeriod)}
                  )
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  $
                  {loading
                    ? "..."
                    : dashboardData.totalCostThisMonth.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  {loading
                    ? "Loading..."
                    : `${dashboardData.activeBatches} active batches`}
                </p>
              </div>
            </div>
          </div>

          {/* Cost per Gram */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Cost per Gram (Est.)
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  ${loading ? "..." : dashboardData.costPerGram.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">
                  {loading ? "Loading..." : "per gram estimate"}
                </p>
              </div>
            </div>
          </div>

          {/* Active Batches */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Active Batches
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? "..." : dashboardData.activeBatches}
                </p>
                <p className="text-xs text-blue-600">
                  {loading
                    ? "Loading..."
                    : `${dashboardData.activeRooms} active rooms`}
                </p>
              </div>
            </div>
          </div>

          {/* Next Harvest Date */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-orange-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Next Harvest Date
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading
                    ? "..."
                    : dashboardData.nextHarvestDate
                    ? new Date(
                        dashboardData.nextHarvestDate
                      ).toLocaleDateString()
                    : "No harvest scheduled"}
                </p>
                <p className="text-xs text-orange-600">
                  {loading
                    ? "Loading..."
                    : dashboardData.nextHarvestDate
                    ? "Next harvest"
                    : "No active batches"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Cost Breakdown Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Cost Breakdown by Category (
                {useCustomRange
                  ? `${customDateRange.startDate} to ${customDateRange.endDate}`
                  : getTimePeriodLabel(timePeriod)}
                )
              </h3>
              <div className="text-sm text-gray-500">
                Total: $
                {dashboardData.costBreakdown
                  .reduce((sum, item) => sum + item.value, 0)
                  .toLocaleString()}
              </div>
            </div>
            <div className="h-64">
              {loading || isRefreshing ? (
                <div className="h-full flex items-center justify-center">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    <p className="text-gray-500 text-sm">
                      {loading ? "Loading..." : "Updating chart..."}
                    </p>
                  </div>
                </div>
              ) : dashboardData.costBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.costBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 13, fontWeight: "500" }}
                      axisLine={{ stroke: "#e5e7eb" }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: "#e5e7eb" }}
                      tickFormatter={(value) =>
                        `$${(value / 1000).toFixed(0)}k`
                      }
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        `$${Number(value).toLocaleString()}`,
                        name,
                      ]}
                      labelStyle={{
                        color: "#1f2937",
                        fontWeight: "600",
                        fontSize: "14px",
                      }}
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {dashboardData.costBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="#3B82F6" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500">No cost data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Monthly Costs Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Cost Trends (
                {useCustomRange
                  ? `${customDateRange.startDate} to ${customDateRange.endDate}`
                  : getTimePeriodLabel(timePeriod)}
                )
              </h3>
              <div className="text-sm text-gray-500">
                {dashboardData.monthlyCosts.length > 0 && (
                  <>
                    Avg: $
                    {(
                      dashboardData.monthlyCosts.reduce(
                        (sum, item) => sum + item.cost,
                        0
                      ) / dashboardData.monthlyCosts.length
                    ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </>
                )}
              </div>
            </div>
            <div className="h-64">
              {loading || isRefreshing ? (
                <div className="h-full flex items-center justify-center">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    <p className="text-gray-500 text-sm">
                      {loading ? "Loading..." : "Updating chart..."}
                    </p>
                  </div>
                </div>
              ) : dashboardData.monthlyCosts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboardData.monthlyCosts}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: "#e5e7eb" }}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: "#e5e7eb" }}
                      tickFormatter={(value) =>
                        `$${(value / 1000).toFixed(0)}k`
                      }
                    />
                    <Tooltip
                      formatter={(value) => [
                        `$${Number(value).toLocaleString()}`,
                        "Cost",
                      ]}
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="cost"
                      stroke="#10B981"
                      fill="#10B981"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500">No monthly data available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Additional Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Room Utilization Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Room Utilization
              </h3>
              <div className="text-sm text-gray-500">
                {dashboardData.roomUtilization.length > 0 && (
                  <>Total: {dashboardData.roomUtilization.length} rooms</>
                )}
              </div>
            </div>
            <div className="h-64">
              {loading || isRefreshing ? (
                <div className="h-full flex items-center justify-center">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    <p className="text-gray-500 text-sm">
                      {loading ? "Loading..." : "Updating chart..."}
                    </p>
                  </div>
                </div>
              ) : dashboardData.roomUtilization.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.roomUtilization}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: "#e5e7eb" }}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: "#e5e7eb" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        paddingTop: "10px",
                      }}
                    />
                    <Bar
                      dataKey="active"
                      stackId="a"
                      fill="#10B981"
                      name="Active"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="inactive"
                      stackId="a"
                      fill="#6B7280"
                      name="Inactive"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="archived"
                      stackId="a"
                      fill="#EF4444"
                      name="Archived"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500">No room data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Category Trends Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Cost Categories Over Time (
                {useCustomRange
                  ? `${customDateRange.startDate} to ${customDateRange.endDate}`
                  : getTimePeriodLabel(timePeriod)}
                )
              </h3>
              <div className="text-sm text-gray-500">
                {(() => {
                  const { startDate, endDate } = getDateRange(timePeriod);
                  const start = new Date(startDate);
                  const end = new Date(endDate);
                  const daysDiff = Math.ceil(
                    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
                  );

                  if (daysDiff <= 30) return "5-day intervals";
                  if (daysDiff <= 90) return "Weekly intervals";
                  if (daysDiff <= 365) return "Monthly intervals";
                  return "Quarterly intervals";
                })()}
              </div>
            </div>
            <div className="h-64">
              {loading || isRefreshing ? (
                <div className="h-full flex items-center justify-center">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    <p className="text-gray-500 text-sm">
                      {loading ? "Loading..." : "Updating chart..."}
                    </p>
                  </div>
                </div>
              ) : dashboardData.categoryTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.categoryTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: "#e5e7eb" }}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: "#e5e7eb" }}
                      tickFormatter={(value) =>
                        `$${(value / 1000).toFixed(0)}k`
                      }
                    />
                    <Tooltip
                      formatter={(value) => [
                        `$${Number(value).toLocaleString()}`,
                        "Amount",
                      ]}
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        paddingTop: "10px",
                      }}
                    />
                    <Bar
                      dataKey="Cost of Goods Sold"
                      stackId="a"
                      fill="#1e40af"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="Expenses"
                      stackId="a"
                      fill="#f97316"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="Other Expenses"
                      stackId="a"
                      fill="#059669"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="Net Income"
                      stackId="a"
                      fill="#06b6d4"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500">No category data available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-center">
          <Link
            href="/cost-entry"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Add New Cost Entry
          </Link>
        </div>
      </main>
    </div>
  );
}
