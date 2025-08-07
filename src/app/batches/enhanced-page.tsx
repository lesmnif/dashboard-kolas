"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

interface Batch {
  id: string;
  room_id: string | null;
  strain_id: string | null;
  batch_code: string | null;
  start_date: string;
  expected_harvest: string | null;
  status: "planned" | "active" | "harvested" | "archived";
  created_at: string;
  updated_at: string;
  room_name?: string;
  strain_name?: string;
  flip_date?: string;
  lights_assigned?: number;
  strain_percentage?: number;
  batch_strains?: BatchStrainAssignment[];
}

interface Room {
  id: string;
  name: string;
  area: number | null;
  lights: number | null;
  status: string;
  strain_id: string | null;
}

interface Strain {
  id: string;
  strain_code: string | null;
  name: string;
  class: string | null;
  abbreviation: string | null;
}

interface BatchStrain {
  strain_id: string;
  strain_name: string;
  lights_assigned: number;
  percentage: number;
}

interface BatchStrainAssignment {
  id: string;
  batch_id: string;
  strain_id: string;
  strain_name?: string;
  lights_assigned: number;
  percentage: number;
  created_at: string;
  updated_at: string;
}

export default function EnhancedBatches() {
  const supabase = createClient();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [strains, setStrains] = useState<Strain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newBatch, setNewBatch] = useState({
    room_id: "",
    batch_code: "",
    start_date: "",
    expected_harvest: "",
    flip_date: "",
    status: "planned" as "planned" | "active" | "harvested" | "archived",
  });

  const [batchStrains, setBatchStrains] = useState<BatchStrain[]>([]);
  const [selectedStrain, setSelectedStrain] = useState("");
  const [lightsForStrain, setLightsForStrain] = useState("");
  const [percentageForStrain, setPercentageForStrain] = useState("");

  // Load data on component mount
  useEffect(() => {
    loadBatchesAndData();
  }, []);

  const loadBatchesAndData = async () => {
    try {
      console.log("Loading batches and related data...");

      // Load strains
      const { data: strainsData, error: strainsError } = await supabase
        .from("strains")
        .select("id, strain_code, name, class, abbreviation")
        .order("name");

      if (strainsError) {
        console.error("Error loading strains:", strainsError);
      } else {
        setStrains(strainsData || []);
      }

      // Load rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from("rooms")
        .select("id, name, area, lights, status, strain_id")
        .order("name");

      if (roomsError) {
        console.error("Error loading rooms:", roomsError);
      } else {
        setRooms(roomsData || []);
      }

      // Load batches with related data
      await loadBatches();
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const loadBatches = async () => {
    try {
      console.log("Loading batches...");

      // First, try to load batches with batch_strains if the table exists
      let { data, error } = await supabase
        .from("batches")
        .select(
          `
            *,
            rooms(name, lights),
            strains(name),
            batch_strains(
              id,
              strain_id,
              lights_assigned,
              percentage,
              strains(name)
            )
          `
        )
        .order("status", { ascending: true })
        .order("start_date", { ascending: true });

      if (error) {
        console.error("Error loading batches with strain assignments:", error);

        // Fallback to basic batch loading if batch_strains table doesn't exist
        const { data: basicData, error: basicError } = await supabase
          .from("batches")
          .select(
            `
              *,
              rooms(name, lights),
              strains(name)
            `
          )
          .order("status", { ascending: true })
          .order("start_date", { ascending: true });

        if (basicError) {
          console.error("Error loading basic batches:", basicError);
          return;
        }

        data = basicData;
      }

      console.log("Batches loaded:", data);

      // Process batches to add derived data
      const processedBatches =
        data?.map((batch) => {
          // Calculate flip date (typically 2 weeks after start date)
          const startDate = new Date(batch.start_date);
          const flipDate = new Date(startDate);
          flipDate.setDate(startDate.getDate() + 14); // 2 weeks later

          // Calculate total lights and percentages from batch_strains
          let totalLights = 0;
          let totalPercentage = 0;
          let strainNames: string[] = [];

          if (batch.batch_strains && batch.batch_strains.length > 0) {
            batch.batch_strains.forEach((assignment: any) => {
              totalLights += assignment.lights_assigned || 0;
              totalPercentage += assignment.percentage || 0;
              if (assignment.strains?.name) {
                strainNames.push(assignment.strains.name);
              }
            });
          } else {
            // Fallback to primary strain
            totalLights = batch.rooms?.lights || 0;
            totalPercentage = 100;
            strainNames = [batch.strains?.name || ""];
          }

          return {
            ...batch,
            room_name: batch.rooms?.name,
            strain_name: strainNames.join(", "),
            flip_date: flipDate.toISOString().split("T")[0],
            lights_assigned: totalLights,
            strain_percentage: totalPercentage,
          };
        }) || [];

      setBatches(processedBatches);
    } catch (error) {
      console.error("Error loading batches:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateBatchCode = (roomName: string) => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const roomCode = roomName.replace(/\s+/g, "").substring(0, 3).toUpperCase();
    return `${roomCode}-${year}${month}${day}`;
  };

  const handleAddStrainToBatch = () => {
    if (!selectedStrain || !lightsForStrain || !percentageForStrain) {
      alert("Please fill in all strain details");
      return;
    }

    const strain = strains.find((s) => s.id === selectedStrain);
    if (!strain) return;

    // Check if strain is already added
    if (batchStrains.some((s) => s.strain_id === selectedStrain)) {
      alert("This strain is already added to the batch");
      return;
    }

    const newStrain: BatchStrain = {
      strain_id: selectedStrain,
      strain_name: strain.name,
      lights_assigned: parseInt(lightsForStrain),
      percentage: parseFloat(percentageForStrain),
    };

    setBatchStrains([...batchStrains, newStrain]);
    setSelectedStrain("");
    setLightsForStrain("");
    setPercentageForStrain("");
  };

  const removeStrainFromBatch = (index: number) => {
    setBatchStrains(batchStrains.filter((_, i) => i !== index));
  };

  const validateBatchStrains = () => {
    if (batchStrains.length === 0) {
      alert("Please add at least one strain to the batch");
      return false;
    }

    const totalPercentage = batchStrains.reduce(
      (sum, strain) => sum + strain.percentage,
      0
    );
    if (totalPercentage > 100) {
      alert("Total percentage cannot exceed 100%");
      return false;
    }

    const room = rooms.find((r) => r.id === newBatch.room_id);
    if (room) {
      const totalLights = batchStrains.reduce(
        (sum, strain) => sum + strain.lights_assigned,
        0
      );
      if (totalLights > (room.lights || 0)) {
        alert(
          `Total lights assigned (${totalLights}) cannot exceed room capacity (${room.lights})`
        );
        return false;
      }
    }

    return true;
  };

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newBatch.room_id || !newBatch.start_date) {
      alert("Please fill in required fields");
      return;
    }

    if (!validateBatchStrains()) {
      return;
    }

    try {
      // Get room info for batch code generation
      const room = rooms.find((r) => r.id === newBatch.room_id);
      const batchCode =
        newBatch.batch_code || (room ? generateBatchCode(room.name) : "");

      // Create the batch
      const { data: batchData, error: batchError } = await supabase
        .from("batches")
        .insert({
          room_id: newBatch.room_id,
          strain_id: batchStrains[0].strain_id, // Use first strain as primary
          batch_code: batchCode,
          start_date: newBatch.start_date,
          expected_harvest: newBatch.expected_harvest || null,
          status: newBatch.status,
        })
        .select()
        .single();

      if (batchError) {
        console.error("Error adding batch:", batchError);
        alert("Error adding batch. Please try again.");
        return;
      }

      // Create batch strain assignments
      const strainAssignments: Omit<
        BatchStrainAssignment,
        "id" | "created_at" | "updated_at"
      >[] = batchStrains.map((strain) => ({
        batch_id: batchData.id,
        strain_id: strain.strain_id,
        lights_assigned: strain.lights_assigned,
        percentage: strain.percentage,
      }));

      // Try to insert strain assignments if the table exists
      try {
        const { error: assignmentsError } = await supabase
          .from("batch_strains")
          .insert(strainAssignments);

        if (assignmentsError) {
          console.error("Error adding strain assignments:", assignmentsError);
          console.log(
            "Batch created but strain assignments failed. You may need to create the batch_strains table."
          );
        } else {
          console.log("Batch and strain assignments created successfully");
        }
      } catch (error) {
        console.log(
          "batch_strains table may not exist yet. Batch created with primary strain only."
        );
        console.log("Strain assignments to create:", strainAssignments);
      }

      // Reload batches
      await loadBatches();

      // Reset form
      setNewBatch({
        room_id: "",
        batch_code: "",
        start_date: "",
        expected_harvest: "",
        flip_date: "",
        status: "planned",
      });
      setBatchStrains([]);
      setModalVisible(false);
      setTimeout(() => setShowAddModal(false), 300);
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("Error adding batch. Please try again.");
    }
  };

  const handleUpdateBatchStatus = async (
    batchId: string,
    newStatus: Batch["status"]
  ) => {
    try {
      const { error } = await supabase
        .from("batches")
        .update({ status: newStatus })
        .eq("id", batchId);

      if (error) {
        console.error("Error updating batch status:", error);
        alert("Error updating batch status. Please try again.");
      } else {
        await loadBatches();
      }
    } catch (error) {
      console.error("Error updating batch status:", error);
      alert("Error updating batch status. Please try again.");
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (confirm("Are you sure you want to delete this batch?")) {
      try {
        const { error } = await supabase
          .from("batches")
          .delete()
          .eq("id", batchId);

        if (error) {
          console.error("Error deleting batch:", error);
          alert("Error deleting batch. Please try again.");
        } else {
          await loadBatches();
        }
      } catch (error) {
        console.error("Error deleting batch:", error);
        alert("Error deleting batch. Please try again.");
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "planned":
        return "text-blue-600 bg-blue-100";
      case "active":
        return "text-green-600 bg-green-100";
      case "harvested":
        return "text-orange-600 bg-orange-100";
      case "archived":
        return "text-gray-600 bg-gray-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString();
  };

  const calculateDaysRemaining = (expectedHarvest: string | null) => {
    if (!expectedHarvest) return null;
    const today = new Date();
    const harvestDate = new Date(expectedHarvest);
    const diffTime = harvestDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
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
                  className="h-8 w-auto"
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
                      Batch Management
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <nav className="flex space-x-4">
                <Link
                  href="/dashboard"
                  className="text-gray-500 hover:text-green-600 px-3 py-2 text-sm font-medium hover:border-b-2 hover:border-green-600"
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
                  className="text-gray-900 hover:text-green-600 px-3 py-2 text-sm font-medium border-b-2 border-green-600"
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
                <span className="text-sm font-medium text-gray-700">
                  Manager
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Batch Management
            </h1>
            <p className="text-gray-600 mt-2">
              Manage cultivation batches with multiple strains and light
              assignments
            </p>
          </div>
          <button
            onClick={() => {
              setShowAddModal(true);
              setTimeout(() => setModalVisible(true), 10);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
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
            Add New Batch
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Total Batches
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? "..." : batches.length}
                </p>
              </div>
            </div>
          </div>

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
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Active Batches
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading
                    ? "..."
                    : batches.filter((b) => b.status === "active").length}
                </p>
              </div>
            </div>
          </div>

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
                  Planned Batches
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading
                    ? "..."
                    : batches.filter((b) => b.status === "planned").length}
                </p>
              </div>
            </div>
          </div>

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
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Harvested</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading
                    ? "..."
                    : batches.filter((b) => b.status === "harvested").length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Batches Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">All Batches</h2>
          </div>
          <div className="overflow-x-auto min-w-full">
            {loading ? (
              <div className="p-6 text-center">
                <p className="text-gray-500">Loading batches...</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      Batch Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      Room
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                      Strains
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      Start Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      Flip Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      Expected Harvest
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {batches.map((batch) => {
                    const daysRemaining = calculateDaysRemaining(
                      batch.expected_harvest
                    );
                    return (
                      <tr key={batch.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {batch.batch_code || "—"}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {batch.room_name || "—"}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div>{batch.strain_name || "—"}</div>
                            {batch.lights_assigned && (
                              <div className="text-xs text-gray-500">
                                {batch.lights_assigned} lights,{" "}
                                {batch.strain_percentage}% of room
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(batch.start_date)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(batch.flip_date || null)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            {formatDate(batch.expected_harvest)}
                            {daysRemaining !== null && (
                              <div className="text-xs text-gray-500">
                                {daysRemaining > 0
                                  ? `${daysRemaining} days left`
                                  : daysRemaining < 0
                                  ? `${Math.abs(daysRemaining)} days overdue`
                                  : "Today"}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                              batch.status
                            )}`}
                          >
                            {batch.status.charAt(0).toUpperCase() +
                              batch.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <select
                              value={batch.status}
                              onChange={(e) =>
                                handleUpdateBatchStatus(
                                  batch.id,
                                  e.target.value as Batch["status"]
                                )
                              }
                              className="text-xs border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white"
                              aria-label="Update batch status"
                              title="Update batch status"
                            >
                              <option value="planned">Planned</option>
                              <option value="active">Active</option>
                              <option value="harvested">Harvested</option>
                              <option value="archived">Archived</option>
                            </select>
                            <button
                              onClick={() => handleDeleteBatch(batch.id)}
                              className="text-red-600 hover:text-red-900 text-xs"
                              aria-label="Delete batch"
                              title="Delete batch"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!loading && batches.length === 0 && (
              <div className="p-6 text-center">
                <p className="text-gray-500">
                  No batches found. Create your first batch to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Batch Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Add New Batch
                </h3>
                <button
                  onClick={() => {
                    setModalVisible(false);
                    setTimeout(() => setShowAddModal(false), 300);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Close modal"
                  title="Close modal"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAddBatch} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Room *
                    </label>
                    <select
                      value={newBatch.room_id}
                      onChange={(e) => {
                        setNewBatch({ ...newBatch, room_id: e.target.value });
                        if (e.target.value) {
                          const room = rooms.find(
                            (r) => r.id === e.target.value
                          );
                          if (room) {
                            setNewBatch((prev) => ({
                              ...prev,
                              batch_code: generateBatchCode(room.name),
                            }));
                          }
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-white"
                      required
                      aria-label="Select room for batch"
                      title="Select room for batch"
                    >
                      <option value="">Select a room</option>
                      {rooms
                        .filter((r) => r.status === "active")
                        .map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.name} ({room.lights} lights)
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Batch Code
                    </label>
                    <input
                      type="text"
                      value={newBatch.batch_code}
                      onChange={(e) =>
                        setNewBatch({ ...newBatch, batch_code: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-gray-50"
                      placeholder="Auto-generated"
                      aria-label="Batch code"
                      title="Batch code"
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={newBatch.start_date}
                      onChange={(e) =>
                        setNewBatch({ ...newBatch, start_date: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-white"
                      required
                      aria-label="Batch start date"
                      title="Batch start date"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expected Harvest Date
                    </label>
                    <input
                      type="date"
                      value={newBatch.expected_harvest}
                      onChange={(e) =>
                        setNewBatch({
                          ...newBatch,
                          expected_harvest: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-white"
                      aria-label="Expected harvest date"
                      title="Expected harvest date"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Initial Status
                    </label>
                    <select
                      value={newBatch.status}
                      onChange={(e) =>
                        setNewBatch({
                          ...newBatch,
                          status: e.target.value as
                            | "planned"
                            | "active"
                            | "harvested"
                            | "archived",
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-white"
                      aria-label="Select batch status"
                      title="Select batch status"
                    >
                      <option value="planned">Planned</option>
                      <option value="active">Active</option>
                    </select>
                  </div>
                </div>

                {/* Strain Assignment Section */}
                <div className="border-t pt-4">
                  <h4 className="text-md font-medium text-gray-900 mb-4">
                    Strain Assignments
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Strain
                      </label>
                      <select
                        value={selectedStrain}
                        onChange={(e) => setSelectedStrain(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-white"
                        aria-label="Select strain for batch"
                        title="Select strain for batch"
                      >
                        <option value="">Select strain</option>
                        {strains.map((strain) => (
                          <option key={strain.id} value={strain.id}>
                            {strain.name}{" "}
                            {strain.strain_code
                              ? `(${strain.strain_code})`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lights Assigned
                      </label>
                      <input
                        type="number"
                        value={lightsForStrain}
                        onChange={(e) => setLightsForStrain(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-white"
                        placeholder="Number of lights"
                        aria-label="Lights assigned to strain"
                        title="Lights assigned to strain"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Percentage of Room
                      </label>
                      <input
                        type="number"
                        value={percentageForStrain}
                        onChange={(e) => setPercentageForStrain(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-white"
                        placeholder="%"
                        min="0"
                        max="100"
                        aria-label="Percentage of room for strain"
                        title="Percentage of room for strain"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddStrainToBatch}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    Add Strain
                  </button>

                  {/* Display added strains */}
                  {batchStrains.length > 0 && (
                    <div className="mt-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">
                        Assigned Strains:
                      </h5>
                      <div className="space-y-2">
                        {batchStrains.map((strain, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-gray-50 p-3 rounded-md"
                          >
                            <div>
                              <span className="font-medium">
                                {strain.strain_name}
                              </span>
                              <span className="text-sm text-gray-500 ml-2">
                                ({strain.lights_assigned} lights,{" "}
                                {strain.percentage}%)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeStrainFromBatch(index)}
                              className="text-red-600 hover:text-red-800"
                              aria-label="Remove strain from batch"
                              title="Remove strain from batch"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Summary */}
                      <div className="mt-3 p-3 bg-blue-50 rounded-md">
                        <div className="text-sm text-blue-800">
                          <div>
                            Total Lights:{" "}
                            {batchStrains.reduce(
                              (sum, s) => sum + s.lights_assigned,
                              0
                            )}
                          </div>
                          <div>
                            Total Percentage:{" "}
                            {batchStrains.reduce(
                              (sum, s) => sum + s.percentage,
                              0
                            )}
                            %
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setModalVisible(false);
                      setTimeout(() => setShowAddModal(false), 300);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Create Batch
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
