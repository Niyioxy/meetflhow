"use client";

import { useEffect } from "react";
import { event } from "@/lib/gtag";

export function SignupConversion() {
  useEffect(() => {
    event("sign_up");
  }, []);

  return null;
}
