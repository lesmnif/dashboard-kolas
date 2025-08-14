"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface Room {
  id: string;
  name: string;
  lights: number | null;
  status: "active" | "inactive" | "archived";
  created_at: string;
  updated_at: string;
  current_batch?: string;
  has_current_batch?: boolean;
  batch_start_date?: string;
  batch_end_date?: string;
}

export default function Facility() {
  const supabase = createClient();

  const [rooms, setRooms] = useState<Room[]>([]);

  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const [newRoom, setNewRoom] = useState({
    name: "",
    lights: "",
  });

  // Load rooms on component mount
  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      console.log("Loading rooms...");

      const { data, error } = await supabase
        .from("rooms")
        .select(
          `
            *,
            batches(batch_code, status, start_date, expected_harvest)
          `
        )
        .order("name");

      if (error) {
        console.error("Error loading rooms:", error);
        console.error("Error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
      } else {
        console.log("Rooms loaded:", data);

        // Process rooms to add current batch info
        const processedRooms =
          data?.map((room) => {
            const activeBatch = room.batches?.find(
              (batch: any) => batch.status === "active"
            );

            return {
              ...room,
              current_batch: activeBatch?.batch_code || null,
              has_current_batch: !!activeBatch,
              batch_start_date: activeBatch?.start_date || null,
              batch_end_date: activeBatch?.expected_harvest || null,
            };
          }) || [];

        setRooms(processedRooms);
      }
    } catch (error) {
      console.error("Error loading rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data, error } = await supabase
        .from("rooms")
        .insert({
          name: newRoom.name,
          lights: parseInt(newRoom.lights) || null,
          status: "active",
        })
        .select()
        .single();

      if (error) {
        console.error("Error adding room:", error);
        alert("Error adding room. Please try again.");
      } else {
        // Reload rooms to get the latest data
        await loadRooms();

        // Reset form
        setNewRoom({ name: "", lights: "" });
        setModalVisible(false);
        setTimeout(() => setShowAddModal(false), 300);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("Error adding room. Please try again.");
    }
  };

  const handleDeleteRoom = async (id: string) => {
    const room = rooms.find((r) => r.id === id);
    if (room && !room.has_current_batch) {
      try {
        const { error } = await supabase.from("rooms").delete().eq("id", id);

        if (error) {
          console.error("Error deleting room:", error);
          alert("Error deleting room. Please try again.");
        } else {
          // Reload rooms to get the latest data
          await loadRooms();
        }
      } catch (error) {
        console.error("Error deleting room:", error);
        alert("Error deleting room. Please try again.");
      }
    }
  };

  const handleBatchClick = async (room: Room) => {
    // Show modal immediately with basic info
    setSelectedBatch({
      batch_code: room.current_batch,
      rooms: { name: room.name },
      start_date: room.batch_start_date,
      expected_harvest: room.batch_end_date,
      status: "active", // Default status since we only show active batches
    });
    setShowBatchModal(true);
    setBatchLoading(true);

    try {
      // Fetch detailed batch information in the background
      const { data: batchData, error } = await supabase
        .from("batches")
        .select(
          `
          *,
          rooms(name, lights),
          strains(name, strain_code, class),
          batch_strains(
            id,
            strain_id,
            lights_assigned,
            percentage,
            strains(name, strain_code)
          )
        `
        )
        .eq("room_id", room.id)
        .eq("status", "active")
        .single();

      if (error) {
        console.error("Error loading batch details:", error);
        setBatchLoading(false);
        // Keep the modal open with basic info, just show an error for detailed data
        return;
      }

      setSelectedBatch(batchData);
    } catch (error) {
      console.error("Error loading batch details:", error);
      // Keep the modal open with basic info
    } finally {
      setBatchLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    return status === "Active"
      ? "text-green-600 bg-green-100"
      : "text-gray-600 bg-gray-100";
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
                      Facility
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
                  className="text-gray-900 hover:text-green-600 px-3 py-2 text-sm font-medium border-b-2 border-green-600"
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
        {/* Add Room Button */}
        <div className="mb-6">
          <button
            onClick={() => {
              setShowAddModal(true);
              setTimeout(() => setModalVisible(true), 10);
            }}
            className="inline-flex items-center hover:cursor-pointer px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
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
            Add Room
          </button>
        </div>

        {/* Rooms Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Cultivation Rooms
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Room Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lights
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Batch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Batch Start Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estimated End Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {room.name}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {room.lights || "—"}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {room.current_batch ? (
                        <button
                          onClick={() => handleBatchClick(room)}
                          className="text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded"
                        >
                          {room.current_batch}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(room.batch_start_date || null)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(room.batch_end_date || null)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          room.status
                        )}`}
                      >
                        {room.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleDeleteRoom(room.id)}
                        disabled={room.has_current_batch}
                        className={`text-red-600 hover:text-red-900 ${
                          room.has_current_batch
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                        title={
                          room.has_current_batch
                            ? "Cannot delete room with active batch"
                            : "Delete room"
                        }
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add Room Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black bg-opacity-2 pointer-events-none"></div>
          {/* Modal Container */}
          <div className="relative z-10 pointer-events-none">
            <div
              className={`bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 ease-out pointer-events-auto ${
                modalVisible
                  ? "scale-100 opacity-100 translate-y-0"
                  : "scale-95 opacity-0 translate-y-4"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Add New Room
                </h3>
                <button
                  onClick={() => {
                    setModalVisible(false);
                    setTimeout(() => setShowAddModal(false), 300);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
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

              {/* Modal Body */}
              <form onSubmit={handleAddRoom} className="p-6 space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Room Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={newRoom.name}
                    onChange={(e) =>
                      setNewRoom({ ...newRoom, name: e.target.value })
                    }
                    required
                    placeholder="Enter room name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="lights"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Number of Lights *
                  </label>
                  <input
                    type="number"
                    id="lights"
                    value={newRoom.lights}
                    onChange={(e) =>
                      setNewRoom({ ...newRoom, lights: e.target.value })
                    }
                    required
                    min="0"
                    placeholder="Enter number of lights"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                  />
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setModalVisible(false);
                      setTimeout(() => setShowAddModal(false), 300);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
                  >
                    Add Room
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Batch Details Modal */}
      <AnimatePresence>
        {showBatchModal && selectedBatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-start justify-center pt-16 pb-8"
            onClick={() => {
              setShowBatchModal(false);
              setSelectedBatch(null);
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
              className="relative w-11/12 md:w-3/4 lg:w-1/2 max-w-4xl mx-4 bg-white rounded-2xl shadow-2xl border border-gray-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    Batch Details
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 font-medium">
                    {selectedBatch.batch_code}
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowBatchModal(false);
                    setSelectedBatch(null);
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
              <div className="p-6 space-y-6">
                {/* Basic Info Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-5 rounded-xl border border-gray-200">
                      <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                        Batch Information
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Code:</span>
                          <span className="text-sm font-semibold text-gray-900 bg-white px-3 py-1 rounded-full">
                            {selectedBatch.batch_code}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Status:</span>
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                              selectedBatch.status === "active"
                                ? "bg-green-100 text-green-800 border border-green-200"
                                : "bg-gray-100 text-gray-800 border border-gray-200"
                            }`}
                          >
                            {selectedBatch.status
                              ? selectedBatch.status.charAt(0).toUpperCase() +
                                selectedBatch.status.slice(1)
                              : "Active"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Room:</span>
                          <span className="text-sm font-semibold text-gray-900 bg-white px-3 py-1 rounded-full">
                            {selectedBatch.rooms?.name}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border border-blue-200">
                      <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                        Timeline
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">
                            Start Date:
                          </span>
                          <span className="text-sm font-semibold text-gray-900 bg-white px-3 py-1 rounded-full">
                            {formatDate(selectedBatch.start_date)}
                          </span>
                        </div>
                        {selectedBatch.expected_harvest && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">
                              Expected Harvest:
                            </span>
                            <span className="text-sm font-semibold text-gray-900 bg-white px-3 py-1 rounded-full">
                              {formatDate(selectedBatch.expected_harvest)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-xl border border-purple-200">
                      <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                        <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                        Strain Information
                      </h4>
                      {batchLoading ? (
                        <div className="space-y-3">
                          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm animate-pulse">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-20"></div>
                              </div>
                              <div className="text-right">
                                <div className="h-6 bg-gray-200 rounded w-16 mb-1"></div>
                                <div className="h-6 bg-gray-200 rounded w-12"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : selectedBatch.batch_strains &&
                        selectedBatch.batch_strains.length > 0 ? (
                        <div className="space-y-3">
                          {selectedBatch.batch_strains.map(
                            (assignment: any, index: number) => (
                              <div
                                key={index}
                                className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                      {assignment.strains?.name ||
                                        "Unknown Strain"}
                                    </p>
                                    {assignment.strains?.strain_code && (
                                      <p className="text-xs text-gray-600 mt-1">
                                        Code: {assignment.strains.strain_code}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium mb-1">
                                      {assignment.lights_assigned} lights
                                    </div>
                                    <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                                      {assignment.percentage}%
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      ) : selectedBatch.strains ? (
                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                          <p className="text-sm font-semibold text-gray-900">
                            {selectedBatch.strains.name}
                          </p>
                          {selectedBatch.strains.strain_code && (
                            <p className="text-xs text-gray-600 mt-1">
                              Code: {selectedBatch.strains.strain_code}
                            </p>
                          )}
                          {selectedBatch.strains.class && (
                            <p className="text-xs text-gray-600 mt-1">
                              Class: {selectedBatch.strains.class}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">
                          No strain information available
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowBatchModal(false);
                      setSelectedBatch(null);
                    }}
                    className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200"
                  >
                    Close
                  </motion.button>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link
                      href="/batches"
                      className="inline-block px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-green-600 to-green-700 border border-transparent rounded-xl hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      Go to Batches
                    </Link>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
