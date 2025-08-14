"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

interface CostEntry {
  id: string;
  date: string;
  category: string;
  room_id: string | null;
  batch_id: string | null;
  amount: number;
  notes?: string;
  created_at: string;
  room_name?: string;
  batch_name?: string;
}

interface Room {
  id: string;
  name: string;
}

interface Batch {
  id: string;
  batch_code: string;
}

export default function CostEntry() {
  const supabase = createClient();

  const [formData, setFormData] = useState({
    date: "",
    category: "",
    room_id: "",
    batch_id: "",
    amount: "",
    notes: "",
  });

  const [costEntries, setCostEntries] = useState<CostEntry[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Load rooms and batches on component mount
  useEffect(() => {
    loadRoomsAndBatches();
    loadCostEntries();
  }, []);

  const loadRoomsAndBatches = async () => {
    try {
      console.log("Loading rooms and batches...");

      // Load rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from("rooms")
        .select("id, name")
        .order("name");

      if (roomsError) {
        console.error("Error loading rooms:", roomsError);
        console.error("Rooms error details:", {
          message: roomsError.message,
          details: roomsError.details,
          hint: roomsError.hint,
        });
      } else {
        console.log("Rooms loaded:", roomsData);
        setRooms(roomsData || []);
      }

      // Load batches
      const { data: batchesData, error: batchesError } = await supabase
        .from("batches")
        .select("id, batch_code")
        .order("batch_code");

      if (batchesError) {
        console.error("Error loading batches:", batchesError);
        console.error("Batches error details:", {
          message: batchesError.message,
          details: batchesError.details,
          hint: batchesError.hint,
        });
      } else {
        console.log("Batches loaded:", batchesData);
        setBatches(batchesData || []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const loadCostEntries = async () => {
    try {
      console.log("Loading cost entries...");

      // First, let's try a simple query to see if the table exists
      const { data: simpleData, error: simpleError } = await supabase
        .from("cost_entries")
        .select("*")
        .limit(1);

      if (simpleError) {
        console.error("Simple query error:", simpleError);
        return;
      }

      console.log("Simple query successful, data:", simpleData);

      // Now try the full query with joins
      const { data, error } = await supabase
        .from("cost_entries")
        .select(
          `
          *,
          rooms(name),
          batches(batch_code)
        `
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading cost entries:", error);
        console.error("Error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
      } else {
        console.log("Cost entries loaded:", data);
        const formattedEntries =
          data?.map((entry) => ({
            ...entry,
            room_name: entry.rooms?.name,
            batch_name: entry.batches?.batch_code,
          })) || [];
        setCostEntries(formattedEntries);
      }
    } catch (error) {
      console.error("Error loading cost entries:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data, error } = await supabase
        .from("cost_entries")
        .insert({
          date: formData.date,
          category: formData.category,
          room_id: formData.room_id || null,
          batch_id: formData.batch_id || null,
          amount: parseFloat(formData.amount),
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Error saving cost entry:", error);
        alert("Error saving cost entry. Please try again.");
      } else {
        // Reload cost entries to get the latest data
        await loadCostEntries();

        // Reset form
        setFormData({
          date: "",
          category: "",
          room_id: "",
          batch_id: "",
          amount: "",
          notes: "",
        });
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("Error saving cost entry. Please try again.");
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
                      Cost Entry
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
                  className="text-gray-900 hover:text-green-600 px-3 py-2 text-sm font-medium border-b-2 border-green-600"
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
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date Field */}
            <div>
              <label
                htmlFor="date"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Date
              </label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-500"
              />
            </div>

            {/* Category Field */}
            <div>
              <label
                htmlFor="category"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Category
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
              >
                <option value="" className="text-gray-500">
                  Select a category
                </option>
                <option value="Clones">Clones</option>
                <option value="Nutrients & Coco">Nutrients & Coco</option>
                <option value="Testing">Testing</option>
                <option value="Utilities">Utilities</option>
                <option value="Labor">Labor</option>
                <option value="Trimming">Trimming</option>
                <option value="Supplies">Supplies</option>
                <option value="Security">Security</option>
                <option value="Equipment">Equipment</option>
                <option value="Insurance">Insurance</option>
                <option value="Taxes">Taxes</option>
                <option value="Rent">Rent</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Room Field */}
            <div>
              <label
                htmlFor="room_id"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Room
              </label>
              <select
                id="room_id"
                name="room_id"
                value={formData.room_id}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
              >
                <option value="" className="text-gray-500">
                  Select a room (optional)
                </option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Batch Field */}
            <div>
              <label
                htmlFor="batch_id"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Batch
              </label>
              <select
                id="batch_id"
                name="batch_id"
                value={formData.batch_id}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
              >
                <option value="" className="text-gray-500">
                  Select a batch (optional)
                </option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_code}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes Field */}
            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Notes (Optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                placeholder="Add any additional notes..."
              />
            </div>

            {/* Amount Field */}
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Amount ($)
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-500"
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                className="inline-flex hover:cursor-pointer items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Save
              </button>
            </div>
          </form>
        </div>

        {/* Cost History Table */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Cost History
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Room
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Batch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {costEntries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No cost entries yet. Add your first entry above.
                    </td>
                  </tr>
                ) : (
                  costEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {entry.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {entry.room_name || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {entry.batch_name || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${entry.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
