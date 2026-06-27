"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { TokenBalance } from "@/types";
import { formatUsd } from "@/lib/utils";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];

interface AssetAllocationChartProps {
  assets: TokenBalance[];
}

export function AssetAllocationChart({ assets }: AssetAllocationChartProps) {
  const data = assets.map((a) => ({
    name: a.symbol,
    value: a.usdValue,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        No assets to display
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "#18181b",
            border: "1px solid #27272a",
            borderRadius: "8px",
          }}
          formatter={(value) => [
            formatUsd(Number(value ?? 0)),
            "Value",
          ]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
