"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

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

interface HarvestData {
  strain_id: string;
  strain_name: string;
  bigs_lbs: number;
  smalls_lbs: number;
  micros_lbs: number;
  bigs_price_per_lb: number;
  smalls_price_per_lb: number;
  micros_price_per_lb: number;
}

interface HarvestSummary {
  total_harvest_lbs: number;
  yield_per_light: number;
  total_revenue: number;
  revenue_per_light: number;
  cost_to_grow: number;
  profit_loss: number;
  cost_per_lb: number;
  net_income_per_lb: number;
  net_income_sales_ratio: number;
  harvest_data: HarvestData[];
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

  // Harvest modal states
  const [showHarvestModal, setShowHarvestModal] = useState(false);
  const [selectedBatchForHarvest, setSelectedBatchForHarvest] =
    useState<Batch | null>(null);
  const [harvestData, setHarvestData] = useState<HarvestData[]>([]);
  const [harvestSummary, setHarvestSummary] = useState<HarvestSummary | null>(
    null
  );
  const [harvestDataSaved, setHarvestDataSaved] = useState(false);

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
      console.log(
        "Batch statuses:",
        data?.map((b) => ({ id: b.id, status: b.status }))
      );

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
      console.log(
        "Processed batches set to state:",
        processedBatches?.map((b) => ({ id: b.id, status: b.status }))
      );
    } catch (error) {
      console.error("Error loading batches:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateBatchCode = async (roomName: string, roomId: string) => {
    const date = new Date();
    const year = date.getFullYear();

    // Extract room number from room name (e.g., "Flower Room 7" -> "R7")
    const roomNumberMatch = roomName.match(/(\d+)/);
    const roomNumber = roomNumberMatch ? roomNumberMatch[1] : "1";
    const roomCode = `R${roomNumber}`;

    // Get the count of existing batches for this room in the current year
    const { data: existingBatches, error } = await supabase
      .from("batches")
      .select("batch_code")
      .eq("room_id", roomId)
      .like("batch_code", `${roomCode}-${year}-%`);

    if (error) {
      console.error("Error counting existing batches:", error);
      // Fallback to 01 if there's an error
      return `${roomCode}-${year}-01`;
    }

    // Calculate the next batch number for this room/year
    const batchCount = (existingBatches?.length || 0) + 1;
    const batchNumber = String(batchCount).padStart(2, "0");

    return `${roomCode}-${year}-${batchNumber}`;
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
        newBatch.batch_code ||
        (room ? await generateBatchCode(room.name, room.id) : "");

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
    // If changing to harvested, open harvest modal first
    if (newStatus === "harvested") {
      const batch = batches.find((b) => b.id === batchId);
      if (batch) {
        setSelectedBatchForHarvest(batch);
        initializeHarvestData(batch);
        setShowHarvestModal(true);
        return; // Don't update status yet, will do it after harvest data entry
      }
    }

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

  const initializeHarvestData = (batch: Batch) => {
    // Initialize harvest data for each strain in the batch
    const initialData: HarvestData[] = [];

    if (batch.batch_strains && batch.batch_strains.length > 0) {
      batch.batch_strains.forEach((assignment: any) => {
        // Get strain name from the nested strains object or fallback to assignment.strain_name
        const strainName =
          assignment.strains?.name ||
          assignment.strain_name ||
          "Unknown Strain";

        initialData.push({
          strain_id: assignment.strain_id,
          strain_name: strainName,
          bigs_lbs: 0,
          smalls_lbs: 0,
          micros_lbs: 0,
          bigs_price_per_lb: 0,
          smalls_price_per_lb: 0,
          micros_price_per_lb: 0,
        });
      });
    } else if (batch.strain_name) {
      // Fallback for single strain batches
      initialData.push({
        strain_id: batch.strain_id || "",
        strain_name: batch.strain_name,
        bigs_lbs: 0,
        smalls_lbs: 0,
        micros_lbs: 0,
        bigs_price_per_lb: 0,
        smalls_price_per_lb: 0,
        micros_price_per_lb: 0,
      });
    }

    setHarvestData(initialData);
    setHarvestSummary(null);
    setHarvestDataSaved(false);
  };

  const updateHarvestData = (
    strainId: string,
    field: keyof Omit<HarvestData, "strain_id" | "strain_name">,
    value: number
  ) => {
    setHarvestData((prev) =>
      prev.map((data) =>
        data.strain_id === strainId ? { ...data, [field]: value } : data
      )
    );
  };

  const calculateCostToGrow = async (
    batchId: string,
    roomId: string,
    startDate: string
  ) => {
    try {
      // Calculate days from start date to today
      const start = new Date(startDate);
      const today = new Date();
      const daysActive = Math.ceil(
        (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Get room info for lights calculation
      const room = rooms.find((r) => r.id === roomId);
      const totalLights = room?.lights || 0;

      // Get cost entries for this batch and room during the active period
      const { data: costEntries, error } = await supabase
        .from("cost_entries")
        .select("amount, category, date")
        .or(`batch_id.eq.${batchId},room_id.eq.${roomId}`)
        .gte("date", startDate)
        .lte("date", today.toISOString().split("T")[0]);

      if (error) {
        console.error("Error loading cost entries:", error);
        return 0;
      }

      // Calculate total costs
      const totalCosts =
        costEntries?.reduce((sum, entry) => sum + entry.amount, 0) || 0;

      // Add estimated electricity cost for lights (if not already included)
      // Assuming $0.15 per kWh and 1000W per light, 18 hours per day
      const electricityCostPerLightPerDay = 0.15 * 1 * 18; // $2.70 per light per day
      const totalElectricityCost =
        totalLights * electricityCostPerLightPerDay * daysActive;

      return totalCosts + totalElectricityCost;
    } catch (error) {
      console.error("Error calculating cost to grow:", error);
      return 0;
    }
  };

  const calculateHarvestSummary = async () => {
    const totalHarvest = harvestData.reduce(
      (total, strain) =>
        total + strain.bigs_lbs + strain.smalls_lbs + strain.micros_lbs,
      0
    );

    const totalRevenue = harvestData.reduce(
      (total, strain) =>
        total +
        strain.bigs_lbs * strain.bigs_price_per_lb +
        strain.smalls_lbs * strain.smalls_price_per_lb +
        strain.micros_lbs * strain.micros_price_per_lb,
      0
    );

    const totalLights = selectedBatchForHarvest?.lights_assigned || 1;
    const yieldPerLight = totalHarvest / totalLights;
    const revenuePerLight = totalRevenue / totalLights;

    // Calculate cost to grow
    const costToGrow = selectedBatchForHarvest
      ? await calculateCostToGrow(
          selectedBatchForHarvest.id,
          selectedBatchForHarvest.room_id || "",
          selectedBatchForHarvest.start_date
        )
      : 0;

    const profitLoss = totalRevenue - costToGrow;
    const costPerLb = totalHarvest > 0 ? costToGrow / totalHarvest : 0;
    const netIncomePerLb = totalHarvest > 0 ? profitLoss / totalHarvest : 0;
    const netIncomeSalesRatio =
      totalRevenue > 0 ? (profitLoss / totalRevenue) * 100 : 0;

    const summary: HarvestSummary = {
      total_harvest_lbs: totalHarvest,
      yield_per_light: yieldPerLight,
      total_revenue: totalRevenue,
      revenue_per_light: revenuePerLight,
      cost_to_grow: costToGrow,
      profit_loss: profitLoss,
      cost_per_lb: costPerLb,
      net_income_per_lb: netIncomePerLb,
      net_income_sales_ratio: netIncomeSalesRatio,
      harvest_data: harvestData,
    };

    setHarvestSummary(summary);
    return summary;
  };

  const handleSaveHarvestData = async () => {
    if (!selectedBatchForHarvest) return;

    const summary = await calculateHarvestSummary();

    try {
      // 1. First, save the harvest summary
      const { data: harvestSummaryData, error: summaryError } = await supabase
        .from("harvest_summaries")
        .insert({
          batch_id: selectedBatchForHarvest.id,
          total_harvest_lbs: summary.total_harvest_lbs,
          yield_per_light: summary.yield_per_light,
          total_lights: selectedBatchForHarvest.lights_assigned || 0,
          harvest_date: new Date().toISOString().split("T")[0], // Today's date
        })
        .select()
        .single();

      if (summaryError) {
        console.error("Error saving harvest summary:", summaryError);
        alert("Error saving harvest summary. Please try again.");
        return;
      }

      // 2. Then, save the harvest details for each strain
      const harvestDetails = harvestData.map((strain) => ({
        harvest_summary_id: harvestSummaryData.id,
        strain_id: strain.strain_id,
        strain_name: strain.strain_name,
        bigs_lbs: strain.bigs_lbs,
        smalls_lbs: strain.smalls_lbs,
        micros_lbs: strain.micros_lbs,
      }));

      const { error: detailsError } = await supabase
        .from("harvest_details")
        .insert(harvestDetails);

      if (detailsError) {
        console.error("Error saving harvest details:", detailsError);
        alert("Error saving harvest details. Please try again.");
        return;
      }

      // 3. Finally, update batch status to harvested
      console.log(
        "Updating batch status to harvested for batch:",
        selectedBatchForHarvest.id
      );
      const { data: updatedBatch, error: batchError } = await supabase
        .from("batches")
        .update({ status: "harvested" })
        .eq("id", selectedBatchForHarvest.id)
        .select()
        .single();

      if (batchError) {
        console.error("Error updating batch status:", batchError);
        alert("Error updating batch status. Please try again.");
        return;
      }

      console.log("Batch status updated successfully:", updatedBatch);

      // Update local state immediately
      setBatches((prevBatches) => {
        const updatedBatches = prevBatches.map((batch) =>
          batch.id === selectedBatchForHarvest.id
            ? { ...batch, status: "harvested" as const }
            : batch
        );
        console.log(
          "Updated local state with harvested status for batch:",
          selectedBatchForHarvest.id
        );
        return updatedBatches;
      });

      console.log("Harvest data saved successfully:", {
        summary: harvestSummaryData,
        details: harvestDetails,
      });

      // Mark as saved and keep modal open to show summary
      setHarvestDataSaved(true);

      // Update local state immediately
      setBatches((prevBatches) => {
        const updatedBatches = prevBatches.map((batch) =>
          batch.id === selectedBatchForHarvest.id
            ? { ...batch, status: "harvested" as const }
            : batch
        );
        console.log(
          "Updated local state with harvested status for batch:",
          selectedBatchForHarvest.id
        );
        return updatedBatches;
      });
    } catch (error) {
      console.error("Error saving harvest data:", error);
      alert("Error saving harvest data. Please try again.");
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

    const date = new Date(dateString);

    // Get ordinal suffix for day (1st, 2nd, 3rd, 4th, etc.)
    const getOrdinalSuffix = (day: number) => {
      if (day > 3 && day < 21) return "th";
      switch (day % 10) {
        case 1:
          return "st";
        case 2:
          return "nd";
        case 3:
          return "rd";
        default:
          return "th";
      }
    };

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const ordinalSuffix = getOrdinalSuffix(day);

    return `${month} ${day}${ordinalSuffix} ${year}`;
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
                          {formatDate(batch.expected_harvest)}
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
                      onChange={async (e) => {
                        setNewBatch({ ...newBatch, room_id: e.target.value });
                        if (e.target.value) {
                          const room = rooms.find(
                            (r) => r.id === e.target.value
                          );
                          if (room) {
                            const batchCode = await generateBatchCode(
                              room.name,
                              room.id
                            );
                            setNewBatch((prev) => ({
                              ...prev,
                              batch_code: batchCode,
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

      {/* Harvest Data Entry Modal */}
      <AnimatePresence>
        {showHarvestModal && selectedBatchForHarvest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-start justify-center pt-8 pb-8"
            onClick={() => {
              setShowHarvestModal(false);
              setSelectedBatchForHarvest(null);
              setHarvestData([]);
              setHarvestSummary(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 400,
                duration: 0.2,
              }}
              className="relative w-11/12 md:w-4/5 lg:w-3/4 max-w-6xl mx-4 bg-white rounded-2xl shadow-2xl border border-gray-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    Harvest Data Entry
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 font-medium">
                    {selectedBatchForHarvest.batch_code} -{" "}
                    {selectedBatchForHarvest.room_name}
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowHarvestModal(false);
                    setSelectedBatchForHarvest(null);
                    setHarvestData([]);
                    setHarvestSummary(null);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-all duration-200"
                  aria-label="Close modal"
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
                </motion.button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Instructions */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">
                    Instructions
                  </h4>
                  <p className="text-sm text-blue-800">
                    Enter the harvest data for each strain in this batch. Input
                    the weight in pounds (lbs) for Bigs, Smalls, and Micros. The
                    system will automatically calculate the total harvest and
                    yield per light.
                  </p>
                </div>

                {/* Strain Harvest Data Entry */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900">
                    Harvest Data by Strain
                  </h4>

                  {harvestData.map((strain, index) => (
                    <div
                      key={strain.strain_id}
                      className="bg-gray-50 p-5 rounded-xl border border-gray-200"
                    >
                      <div className="flex items-center mb-4">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                        <h5 className="text-base font-semibold text-gray-900">
                          {strain.strain_name}
                        </h5>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Bigs (lbs)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={strain.bigs_lbs === 0 ? "" : strain.bigs_lbs}
                            onChange={(e) =>
                              updateHarvestData(
                                strain.strain_id,
                                "bigs_lbs",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400"
                            placeholder="0.0"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Smalls (lbs)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={
                              strain.smalls_lbs === 0 ? "" : strain.smalls_lbs
                            }
                            onChange={(e) =>
                              updateHarvestData(
                                strain.strain_id,
                                "smalls_lbs",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400"
                            placeholder="0.0"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Micros (lbs)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={
                              strain.micros_lbs === 0 ? "" : strain.micros_lbs
                            }
                            onChange={(e) =>
                              updateHarvestData(
                                strain.strain_id,
                                "micros_lbs",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400"
                            placeholder="0.0"
                          />
                        </div>
                      </div>

                      {/* Price Inputs */}
                      <div className="mt-6">
                        <h6 className="text-sm font-medium text-gray-700 mb-3">
                          Sale Price per Pound ($)
                        </h6>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-2">
                              Bigs Price ($/lb)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                strain.bigs_price_per_lb === 0
                                  ? ""
                                  : strain.bigs_price_per_lb
                              }
                              onChange={(e) =>
                                updateHarvestData(
                                  strain.strain_id,
                                  "bigs_price_per_lb",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                              placeholder="0.00"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-2">
                              Smalls Price ($/lb)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                strain.smalls_price_per_lb === 0
                                  ? ""
                                  : strain.smalls_price_per_lb
                              }
                              onChange={(e) =>
                                updateHarvestData(
                                  strain.strain_id,
                                  "smalls_price_per_lb",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                              placeholder="0.00"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-2">
                              Micros Price ($/lb)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                strain.micros_price_per_lb === 0
                                  ? ""
                                  : strain.micros_price_per_lb
                              }
                              onChange={(e) =>
                                updateHarvestData(
                                  strain.strain_id,
                                  "micros_price_per_lb",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Strain Total */}
                      <div className="mt-3 pt-3 border-t border-gray-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600">
                              Total Weight:
                            </span>
                            <span className="text-sm font-semibold text-gray-900">
                              {(
                                strain.bigs_lbs +
                                strain.smalls_lbs +
                                strain.micros_lbs
                              ).toFixed(1)}{" "}
                              lbs
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600">
                              Total Revenue:
                            </span>
                            <span className="text-sm font-semibold text-green-700">
                              $
                              {(
                                strain.bigs_lbs * strain.bigs_price_per_lb +
                                strain.smalls_lbs * strain.smalls_price_per_lb +
                                strain.micros_lbs * strain.micros_price_per_lb
                              ).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Harvest Summary */}
                {harvestSummary && (
                  <div className="bg-green-50 p-5 rounded-xl border border-green-200">
                    <h4 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                      Harvest Summary
                      {harvestDataSaved && (
                        <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✓ Saved
                        </span>
                      )}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div className="bg-white p-4 rounded-lg border border-green-200">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-700">
                            {harvestSummary.total_harvest_lbs.toFixed(1)}
                          </div>
                          <div className="text-xs text-green-600 font-medium">
                            Total Harvest (lbs)
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-green-200">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-700">
                            {harvestSummary.yield_per_light.toFixed(2)}
                          </div>
                          <div className="text-xs text-green-600 font-medium">
                            Yield per Light (lbs)
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-green-200">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-700">
                            ${harvestSummary.total_revenue.toFixed(2)}
                          </div>
                          <div className="text-xs text-green-600 font-medium">
                            Total Revenue
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-green-200">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-700">
                            ${harvestSummary.revenue_per_light.toFixed(2)}
                          </div>
                          <div className="text-xs text-green-600 font-medium">
                            Revenue per Light
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cost and Profit Analysis */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
                      <h5 className="text-md font-semibold text-blue-900 mb-3">
                        Cost & Profit Analysis
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-white p-3 rounded-lg border border-blue-200">
                          <div className="text-center">
                            <div className="text-lg font-bold text-blue-700">
                              ${harvestSummary.cost_to_grow.toFixed(2)}
                            </div>
                            <div className="text-xs text-blue-600 font-medium">
                              Cost to Grow
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-blue-200">
                          <div className="text-center">
                            <div
                              className={`text-lg font-bold ${
                                harvestSummary.profit_loss >= 0
                                  ? "text-green-700"
                                  : "text-red-700"
                              }`}
                            >
                              ${harvestSummary.profit_loss.toFixed(2)}
                            </div>
                            <div className="text-xs text-blue-600 font-medium">
                              Profit/Loss
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-blue-200">
                          <div className="text-center">
                            <div className="text-lg font-bold text-blue-700">
                              ${harvestSummary.cost_per_lb.toFixed(2)}
                            </div>
                            <div className="text-xs text-blue-600 font-medium">
                              Cost per lb
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-blue-200">
                          <div className="text-center">
                            <div
                              className={`text-lg font-bold ${
                                harvestSummary.net_income_per_lb >= 0
                                  ? "text-green-700"
                                  : "text-red-700"
                              }`}
                            >
                              ${harvestSummary.net_income_per_lb.toFixed(2)}
                            </div>
                            <div className="text-xs text-blue-600 font-medium">
                              Net Income per lb
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-blue-200">
                          <div className="text-center">
                            <div
                              className={`text-lg font-bold ${
                                harvestSummary.net_income_sales_ratio >= 0
                                  ? "text-green-700"
                                  : "text-red-700"
                              }`}
                            >
                              {harvestSummary.net_income_sales_ratio.toFixed(1)}
                              %
                            </div>
                            <div className="text-xs text-blue-600 font-medium">
                              Net Income/Sales %
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100">
                  {harvestDataSaved ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setShowHarvestModal(false);
                        setSelectedBatchForHarvest(null);
                        setHarvestData([]);
                        setHarvestSummary(null);
                        setHarvestDataSaved(false);
                      }}
                      className="px-8 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg hover:shadow-xl rounded-xl transition-all duration-200"
                    >
                      Close
                    </motion.button>
                  ) : (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setShowHarvestModal(false);
                          setSelectedBatchForHarvest(null);
                          setHarvestData([]);
                          setHarvestSummary(null);
                          setHarvestDataSaved(false);
                        }}
                        className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200"
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSaveHarvestData}
                        className="px-8 py-3 text-sm font-medium text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-lg hover:shadow-xl rounded-xl transition-all duration-200"
                      >
                        Calculate & Save Harvest Data
                      </motion.button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
