"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

interface Room {
  id: string;
  name: string;
  area: number | null;
  lights: number | null;
  status: "active" | "inactive" | "archived";
  strain_id: string | null;
  created_at: string;
  updated_at: string;
  strain_name?: string;
  current_batch?: string;
  has_current_batch?: boolean;
  batch_start_date?: string;
  batch_end_date?: string;
}

interface Strain {
  id: string;
  strain_code: string | null;
  name: string;
  class: string | null;
  abbreviation: string | null;
}

export default function Facility() {
  const supabase = createClient();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [strains, setStrains] = useState<Strain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRoom, setNewRoom] = useState({
    name: "",
    area: "",
    lights: "",
    strain_id: "",
  });

  // Load rooms on component mount
  useEffect(() => {
    loadRoomsAndStrains();
  }, []);

  const loadRoomsAndStrains = async () => {
    try {
      console.log("Loading rooms and strains...");

      // Load strains
      const { data: strainsData, error: strainsError } = await supabase
        .from("strains")
        .select("id, strain_code, name, class, abbreviation")
        .order("name");

      if (strainsError) {
        console.error("Error loading strains:", strainsError);
      } else {
        console.log("Strains loaded:", strainsData);
        setStrains(strainsData || []);
      }

      // Load rooms with strain info
      await loadRooms();
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const loadRooms = async () => {
    try {
      console.log("Loading rooms...");

      const { data, error } = await supabase
        .from("rooms")
        .select(
          `
            *,
            batches(batch_code, status, start_date, expected_harvest),
            strains(name)
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
              strain_name: room.strains?.name,
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
          area: parseFloat(newRoom.area) || null,
          lights: parseInt(newRoom.lights) || null,
          strain_id: newRoom.strain_id || null,
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
        setNewRoom({ name: "", area: "", lights: "", strain_id: "" });
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

  const handleEditRoom = async (
    id: string,
    field: keyof Room,
    value: string | number | null
  ) => {
    try {
      const { error } = await supabase
        .from("rooms")
        .update({ [field]: value })
        .eq("id", id);

      if (error) {
        console.error("Error updating room:", error);
        alert("Error updating room. Please try again.");
      } else {
        // Reload rooms to get the latest data
        await loadRooms();
      }
    } catch (error) {
      console.error("Error updating room:", error);
      alert("Error updating room. Please try again.");
    }
  };

  const getStatusColor = (status: string) => {
    return status === "Active"
      ? "text-green-600 bg-green-100"
      : "text-gray-600 bg-gray-100";
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString();
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
                    Area (m²)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lights
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned Strain
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
                      {editingId === room.id ? (
                        <input
                          type="text"
                          value={room.name}
                          onChange={(e) =>
                            handleEditRoom(room.id, "name", e.target.value)
                          }
                          onBlur={() => setEditingId(null)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900"
                          autoFocus
                          aria-label="Edit room name"
                          title="Edit room name"
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:text-green-600"
                          onClick={() => setEditingId(room.id)}
                        >
                          {room.name}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {editingId === room.id ? (
                        <input
                          type="number"
                          value={room.area || ""}
                          onChange={(e) =>
                            handleEditRoom(
                              room.id,
                              "area",
                              parseFloat(e.target.value) || null
                            )
                          }
                          onBlur={() => setEditingId(null)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-gray-900"
                          aria-label="Edit room area"
                          title="Edit room area"
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:text-green-600"
                          onClick={() => setEditingId(room.id)}
                        >
                          {room.area || "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {editingId === room.id ? (
                        <input
                          type="number"
                          value={room.lights || ""}
                          onChange={(e) =>
                            handleEditRoom(
                              room.id,
                              "lights",
                              parseInt(e.target.value) || null
                            )
                          }
                          onBlur={() => setEditingId(null)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-gray-900"
                          aria-label="Edit room lights"
                          title="Edit room lights"
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:text-green-600"
                          onClick={() => setEditingId(room.id)}
                        >
                          {room.lights || "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {editingId === room.id ? (
                        <select
                          value={room.strain_id || ""}
                          onChange={(e) =>
                            handleEditRoom(
                              room.id,
                              "strain_id",
                              e.target.value || null
                            )
                          }
                          onBlur={() => setEditingId(null)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900"
                          aria-label="Edit assigned strain"
                          title="Edit assigned strain"
                        >
                          <option value="">No strain assigned</option>
                          {strains.map((strain) => (
                            <option key={strain.id} value={strain.id}>
                              {strain.name}{" "}
                              {strain.strain_code
                                ? `(${strain.strain_code})`
                                : ""}{" "}
                              {strain.class ? `[${strain.class}]` : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="cursor-pointer hover:text-green-600"
                          onClick={() => setEditingId(room.id)}
                        >
                          {room.strain_name || "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {room.current_batch || "—"}
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
                    htmlFor="area"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Area (m²) *
                  </label>
                  <input
                    type="number"
                    id="area"
                    value={newRoom.area}
                    onChange={(e) =>
                      setNewRoom({ ...newRoom, area: e.target.value })
                    }
                    required
                    min="0"
                    step="0.1"
                    placeholder="Enter area in square meters"
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

                <div>
                  <label
                    htmlFor="strain_id"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Assigned Strain
                  </label>
                  <select
                    id="strain_id"
                    value={newRoom.strain_id}
                    onChange={(e) =>
                      setNewRoom({ ...newRoom, strain_id: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                  >
                    <option value="">Select a strain (optional)</option>
                    {strains.map((strain) => (
                      <option key={strain.id} value={strain.id}>
                        {strain.name}{" "}
                        {strain.strain_code ? `(${strain.strain_code})` : ""}{" "}
                        {strain.class ? `[${strain.class}]` : ""}
                      </option>
                    ))}
                  </select>
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
    </div>
  );
}
