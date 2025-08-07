"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import EnhancedBatches from "./enhanced-page";


export default function Batches() {
  return <EnhancedBatches />;
}