"use client";
import { wooFetch } from "@/lib/woo/client";
export default function Leak() { return <button onClick={() => wooFetch("wc/v3/products")}>x</button>; }
