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

export default function Dashboard() {
  const supabase = createClient();
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

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      console.log("Loading dashboard data...");

      // Get all cost entries (not just current month for now)
      const { data: costEntries, error: costError } = await supabase
        .from("cost_entries")
        .select("amount, date")
        .order("date", { ascending: false })
        .limit(50); // Get last 50 entries

      if (costError) {
        console.error("Error loading cost entries:", costError);
      }

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
      });

      // Calculate chart data
      const costBreakdown = await calculateCostBreakdown();
      const monthlyCosts = await calculateMonthlyCosts();
      const roomUtilization = await calculateRoomUtilization();
      const categoryTrends = await calculateCategoryTrends();

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
    }
  };

  const calculateCostBreakdown = async () => {
    try {
      const { data, error } = await supabase
        .from("cost_entries")
        .select("category, amount");

      if (error) {
        console.error("Error loading cost breakdown:", error);
        return [];
      }

      // Group by category and sum amounts
      const breakdown =
        data?.reduce((acc, entry) => {
          const category = entry.category;
          acc[category] = (acc[category] || 0) + parseFloat(entry.amount);
          return acc;
        }, {} as Record<string, number>) || {};

      return Object.entries(breakdown).map(([name, value]) => ({
        name,
        value,
      }));
    } catch (error) {
      console.error("Error calculating cost breakdown:", error);
      return [];
    }
  };

  const calculateMonthlyCosts = async () => {
    try {
      const { data, error } = await supabase
        .from("cost_entries")
        .select("amount, date")
        .order("date", { ascending: true });

      if (error) {
        console.error("Error loading monthly costs:", error);
        return [];
      }

      // Group by month
      const monthlyData =
        data?.reduce((acc, entry) => {
          const date = new Date(entry.date);
          const monthYear = `${date.getFullYear()}-${String(
            date.getMonth() + 1
          ).padStart(2, "0")}`;
          acc[monthYear] = (acc[monthYear] || 0) + parseFloat(entry.amount);
          return acc;
        }, {} as Record<string, number>) || {};

      return Object.entries(monthlyData).map(([month, cost]) => ({
        month,
        cost,
      }));
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

  const calculateCategoryTrends = async () => {
    try {
      const { data, error } = await supabase
        .from("cost_entries")
        .select("category, amount, date")
        .order("date", { ascending: true });

      if (error) {
        console.error("Error loading category trends:", error);
        return [];
      }

      console.log("Raw cost entries data:", data);
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

      // Define the four target categories
      const targetCategories = [
        "Cost of Goods Sold",
        "Expenses",
        "Other Expenses",
        "Net Income",
      ];

      // Group by mapped category and month
      const trends =
        data?.reduce((acc, entry) => {
          const date = new Date(entry.date);
          const monthYear = `${date.getFullYear()}-${String(
            date.getMonth() + 1
          ).padStart(2, "0")}`;

          // Map the category to our target category
          const mappedCategory =
            categoryMapping[entry.category] || "Other Expenses";

          console.log(
            `Mapping category "${entry.category}" to "${mappedCategory}"`
          );

          if (!acc[mappedCategory]) acc[mappedCategory] = {};
          acc[mappedCategory][monthYear] =
            (acc[mappedCategory][monthYear] || 0) + parseFloat(entry.amount);
          return acc;
        }, {} as Record<string, Record<string, number>>) || {};

      console.log("Processed trends data:", trends);

      // Get all unique months
      const months = [
        ...new Set(
          data?.map((entry) => {
            const date = new Date(entry.date);
            return `${date.getFullYear()}-${String(
              date.getMonth() + 1
            ).padStart(2, "0")}`;
          }) || []
        ),
      ].sort();

      // If no data exists, create sample data for demonstration
      if (months.length === 0) {
        console.log("No data found, generating sample data...");
        const sampleMonths = [
          "2024-01",
          "2024-02",
          "2024-03",
          "2024-04",
          "2024-05",
          "2024-06",
          "2024-07",
          "2024-08",
          "2024-09",
          "2024-10",
          "2024-11",
          "2024-12",
        ];

        const sampleData = sampleMonths.map((month) => {
          const monthData: any = {
            month: month.replace("-", " Q"),
          };

          // Add sample data for each category
          const costOfGoodsSold = Math.floor(Math.random() * 2000000) + 3000000;
          const expenses = Math.floor(Math.random() * 1000000) + 2000000;
          const otherExpenses = Math.floor(Math.random() * 500000) + 800000;

          // Calculate Net Income as 15% of total expenses
          const totalExpenses = costOfGoodsSold + expenses + otherExpenses;
          const netIncome = Math.floor(totalExpenses * 0.15);

          monthData["Cost of Goods Sold"] = costOfGoodsSold;
          monthData["Expenses"] = expenses;
          monthData["Other Expenses"] = otherExpenses;
          monthData["Net Income"] = netIncome;

          console.log(`Sample Month ${month}:`, {
            "Cost of Goods Sold": costOfGoodsSold,
            Expenses: expenses,
            "Other Expenses": otherExpenses,
            "Net Income": netIncome,
            Total: totalExpenses + netIncome,
          });

          return monthData;
        });

        console.log("Generated sample data:", sampleData);
        return sampleData;
      }

      // Create data structure for stacked bar chart
      const finalData = months.map((month) => {
        const monthData: any = {
          month: month.replace("-", " Q"), // Format as "2024 Q1" style
        };

        // Get values for each category
        const costOfGoodsSold = trends["Cost of Goods Sold"]?.[month] || 0;
        const expenses = trends["Expenses"]?.[month] || 0;
        const otherExpenses = trends["Other Expenses"]?.[month] || 0;

        // Calculate Net Income as a derived value (simplified calculation)
        // In a real scenario, this would be Revenue - Total Expenses
        // For now, we'll calculate it as a percentage of total costs
        const totalExpenses = costOfGoodsSold + expenses + otherExpenses;
        const netIncome = totalExpenses > 0 ? totalExpenses * 0.15 : 0; // 15% of total expenses as "profit"

        monthData["Cost of Goods Sold"] = costOfGoodsSold;
        monthData["Expenses"] = expenses;
        monthData["Other Expenses"] = otherExpenses;
        monthData["Net Income"] = netIncome;

        console.log(`Month ${month}:`, {
          "Cost of Goods Sold": costOfGoodsSold,
          Expenses: expenses,
          "Other Expenses": otherExpenses,
          "Net Income": netIncome,
          Total: totalExpenses + netIncome,
        });

        return monthData;
      });

      console.log("Final chart data:", finalData);
      return finalData;
    } catch (error) {
      console.error("Error calculating category trends:", error);
      return [];
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
                  href="/dashboard"
                  className="text-gray-900 hover:text-green-600 px-3 py-2 text-sm font-medium border-b-2 border-green-600"
                >
                  Dashboard
                </Link>
                <Link
                  href="/cost-entry"
                  className="text-gray-500 hover:text-green-600 px-3 py-2 text-sm font-medium hover:border-b-2 hover:border-green-600"
                >
                  Cost Entry
                </Link>
                <Link
                  href="/facility"
                  className="text-gray-500 hover:text-green-600 px-3 py-2 text-sm font-medium hover:border-b-2 hover:border-green-600"
                >
                  Facility
                </Link>
                <Link
                  href="/batches"
                  className="text-gray-500 hover:text-green-600 px-3 py-2 text-sm font-medium hover:border-b-2 hover:border-green-600"
                >
                  Batches
                </Link>
              </nav>
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
                <span className="text-sm font-medium text-gray-700">Admin</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                  Total Cost (All Time)
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
                Cost Breakdown by Category
              </h3>
              <div className="text-sm text-gray-500">
                Total: $
                {dashboardData.costBreakdown
                  .reduce((sum, item) => sum + item.value, 0)
                  .toLocaleString()}
              </div>
            </div>
            <div className="h-64">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500">Loading...</p>
                </div>
              ) : dashboardData.costBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboardData.costBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} ${((percent || 0) * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {dashboardData.costBreakdown.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            [
                              "#10B981", // Green
                              "#3B82F6", // Blue
                              "#F59E0B", // Amber
                              "#EF4444", // Red
                              "#8B5CF6", // Purple
                              "#06B6D4", // Cyan
                              "#F97316", // Orange
                              "#EC4899", // Pink
                            ][index % 8]
                          }
                        />
                      ))}
                    </Pie>
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
                  </PieChart>
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
                Monthly Cost Trends
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
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500">Loading...</p>
                </div>
              ) : dashboardData.monthlyCosts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboardData.monthlyCosts}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="month"
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
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500">Loading...</p>
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
                Cost Categories Over Time
              </h3>
              <div className="text-sm text-gray-500">
                Stacked monthly breakdown
              </div>
            </div>
            <div className="h-64">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500">Loading...</p>
                </div>
              ) : dashboardData.categoryTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.categoryTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="month"
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
